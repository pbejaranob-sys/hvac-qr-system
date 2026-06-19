import admin from "firebase-admin";

function getAdmin() {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
      }),
    });
  }
  return admin;
}

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

// Detecta entradas del cronograma que requieren atención:
// - marcadas manualmente como "pendiente"
// - "programado" con fecha ya vencida (y nadie la marcó)
function equipoTienePendientes(equipo) {
  const cron = equipo.cronograma || [];
  const hoy = hoyISO();
  return cron.filter((t) => {
    if (t.estado === "pendiente") return true;
    if (t.estado === "programado" && t.fecha && t.fecha < hoy) return true;
    return false;
  });
}

async function enviarEmail(resendKey, { to, subject, html }) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "HVAC Sistema de Mantenimiento <notificaciones@hvac-control.com.pe>",
      to,
      subject,
      html,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) console.error("Resend error", res.status, data);
  return { ok: res.ok, data };
}

function tablaEquiposHtml(equipos) {
  const filas = equipos
    .map(({ data: eq, pendientes }) => {
      const items = pendientes.map((p) => `${p.label}${p.fecha ? " (" + p.fecha + ")" : ""}`).join(", ");
      return `
      <tr>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:13px;color:#222;">
          <strong>${eq.marca || ""} ${eq.modelo || ""}</strong><br/>
          <span style="color:#888;font-size:11px;">${eq.sede || "-"} &middot; Piso ${eq.piso || "-"} &middot; ${eq.ambiente || "-"}</span>
        </td>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:12px;color:#e65100;">${items}</td>
      </tr>`;
    })
    .join("");

  return `
  <table style="width:100%;border-collapse:collapse;margin-top:8px;">
    <thead>
      <tr>
        <th style="text-align:left;padding:8px 10px;font-size:11px;color:#999;text-transform:uppercase;border-bottom:2px solid #1a5fa8;">Equipo</th>
        <th style="text-align:left;padding:8px 10px;font-size:11px;color:#999;text-transform:uppercase;border-bottom:2px solid #1a5fa8;">Pendiente</th>
      </tr>
    </thead>
    <tbody>${filas}</tbody>
  </table>`;
}

function envolverHtml(titulo, subtitulo, contenidoHtml) {
  return `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f0f4f8;padding:20px;">
    <div style="background:#1a5fa8;color:white;padding:16px 20px;border-radius:8px 8px 0 0;">
      <div style="font-size:18px;font-weight:900;letter-spacing:1px;">HVAC</div>
      <div style="font-size:11px;color:#cfe0f5;letter-spacing:1px;">SISTEMA DE MANTENIMIENTO</div>
    </div>
    <div style="background:white;padding:20px;border-radius:0 0 8px 8px;">
      <h2 style="color:#1a5fa8;font-size:16px;margin:0 0 4px;">${titulo}</h2>
      <p style="color:#777;font-size:13px;margin:0 0 16px;">${subtitulo}</p>
      ${contenidoHtml}
      <p style="color:#aaa;font-size:11px;margin-top:24px;border-top:1px solid #eee;padding-top:12px;">
        Este es un correo automático de HVAC Sistema de Mantenimiento. Si tienes dudas, escríbenos a soporte@hvac-control.com.pe
      </p>
    </div>
  </div>`;
}

export default async function handler(req, res) {
  // Seguridad: solo Vercel Cron (con CRON_SECRET) puede ejecutar esto
  const authHeader = req.headers["authorization"];
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "No autorizado" });
  }

  try {
    const fbAdmin = getAdmin();
    const db = fbAdmin.firestore();
    const resendKey = process.env.RESEND_API_KEY;
    const adminEmail = process.env.ADMIN_NOTIF_EMAIL || "soporte@hvac-control.com.pe";

    const equiposSnap = await db.collection("equipos").get();
    const equipos = equiposSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    // Agrupar equipos con pendientes, por cliente (empresa)
    const porCliente = {};
    for (const eq of equipos) {
      const pendientes = equipoTienePendientes(eq);
      if (pendientes.length === 0) continue;
      const cliente = eq.cliente || "Sin cliente";
      if (!porCliente[cliente]) porCliente[cliente] = [];
      porCliente[cliente].push({ data: eq, pendientes });
    }

    const clientesConPendientes = Object.keys(porCliente);

    if (clientesConPendientes.length === 0) {
      return res.status(200).json({ ok: true, mensaje: "Sin equipos pendientes hoy." });
    }

    const usuariosSnap = await db.collection("usuarios").get();
    const usuarios = usuariosSnap.docs.map((d) => d.data());

    const resultados = [];

    for (const clienteNombre of clientesConPendientes) {
      const items = porCliente[clienteNombre];
      const usuarioCliente = usuarios.find(
        (u) => (u.empresa || u.nombre) === clienteNombre && u.rol === "cliente"
      );
      if (usuarioCliente && usuarioCliente.email) {
        const html = envolverHtml(
          `Mantenimientos pendientes — ${clienteNombre}`,
          `Tienes ${items.length} equipo${items.length !== 1 ? "s" : ""} con mantenimiento pendiente o vencido.`,
          tablaEquiposHtml(items)
        );
        const r = await enviarEmail(resendKey, {
          to: usuarioCliente.email,
          subject: `${items.length} equipo${items.length !== 1 ? "s" : ""} con mantenimiento pendiente — ${clienteNombre}`,
          html,
        });
        resultados.push({ cliente: clienteNombre, email: usuarioCliente.email, enviado: r.ok });
      } else {
        resultados.push({ cliente: clienteNombre, email: null, enviado: false, motivo: "sin email registrado" });
      }
    }

    // Resumen para el admin
    const resumenFilas = clientesConPendientes
      .map((c) => {
        const items = porCliente[c];
        return `
        <tr>
          <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:13px;color:#222;font-weight:600;">${c}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:13px;color:#e65100;text-align:center;">${items.length}</td>
        </tr>`;
      })
      .join("");

    const totalEquipos = clientesConPendientes.reduce((sum, c) => sum + porCliente[c].length, 0);

    const htmlAdmin = envolverHtml(
      "Resumen diario de mantenimientos pendientes",
      `${totalEquipos} equipo${totalEquipos !== 1 ? "s" : ""} en ${clientesConPendientes.length} cliente${clientesConPendientes.length !== 1 ? "s" : ""} requieren atención.`,
      `<table style="width:100%;border-collapse:collapse;margin-top:8px;">
        <thead>
          <tr>
            <th style="text-align:left;padding:8px 10px;font-size:11px;color:#999;text-transform:uppercase;border-bottom:2px solid #1a5fa8;">Cliente</th>
            <th style="text-align:center;padding:8px 10px;font-size:11px;color:#999;text-transform:uppercase;border-bottom:2px solid #1a5fa8;">Equipos pendientes</th>
          </tr>
        </thead>
        <tbody>${resumenFilas}</tbody>
      </table>`
    );

    await enviarEmail(resendKey, {
      to: adminEmail,
      subject: `Resumen diario: ${totalEquipos} equipos pendientes en ${clientesConPendientes.length} clientes`,
      html: htmlAdmin,
    });

    return res.status(200).json({
      ok: true,
      resultados,
      totalEquipos,
      clientes: clientesConPendientes.length,
    });
  } catch (err) {
    console.error("Error en notificar-pendientes:", err);
    return res.status(500).json({ error: err.message });
  }
}
