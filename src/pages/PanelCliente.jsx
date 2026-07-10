import React, { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { useNavigate, useSearchParams } from "react-router-dom";
import jsPDF from "jspdf";

const parsePiso = (p) => {
  if (!p) return [99, 0, 0];
  const s = String(p).toLowerCase().trim();
  const m = s.match(/s[oó]tano\s*(\d*)/);
  if (m) return [-1, -(parseInt(m[1]) || 1), 0];
  const match = s.match(/^(\d+)\s*([a-z]?)/);
  if (match) {
    const num = parseInt(match[1]);
    const letra = match[2] ? match[2].charCodeAt(0) - 96 : 0;
    return [0, num, letra];
  }
  return [1, 0, 0];
};

const sortPiso = (a, b) => {
  const [ta, na, la] = parsePiso(a.piso);
  const [tb, nb, lb] = parsePiso(b.piso);
  if (ta !== tb) return ta - tb;
  if (na !== nb) return na - nb;
  return la - lb;
};

const ordenarPisos = (a, b) => {
  const [ta, na, la] = parsePiso(a);
  const [tb, nb, lb] = parsePiso(b);
  if (ta !== tb) return ta - tb;
  if (na !== nb) return na - nb;
  return la - lb;
};

const agruparPorPiso = (equipos) => {
  const porPiso = {};
  equipos.forEach(e => { const p = e.piso || "Sin piso"; if (!porPiso[p]) porPiso[p] = []; porPiso[p].push(e); });
  return porPiso;
};

const exportarExcel = (cliente, equipos) => {
  const porPiso = agruparPorPiso(equipos);
  const pisos = Object.keys(porPiso).sort(ordenarPisos);
  let item = 1;
  let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
  <head><meta charset="UTF-8"><style>
    body{font-family:Arial;font-size:9pt;}.titulo{background:#1A73E8;color:white;font-size:14pt;font-weight:bold;}
    .header{background:#1565C0;color:white;font-weight:bold;font-size:9pt;text-align:center;}
    .piso{background:#BBDEFB;color:#0D47A1;font-weight:bold;font-size:9pt;}
    .fila{font-size:9pt;}.fila-alt{background:#F8F9FA;font-size:9pt;}
    .op{background:#C8E6C9;color:#1B5E20;font-weight:bold;text-align:center;}
    .obs{background:#FFF9C4;color:#E65100;font-weight:bold;text-align:center;}
    .fs{background:#FFCDD2;color:#B71C1C;font-weight:bold;text-align:center;}
    .cod{background:#F3E5F5;color:#6A1B9A;font-weight:bold;text-align:center;font-family:monospace;}
    td{border:1px solid #E0E0E0;padding:4px 6px;}
  </style></head><body><table>
  <tr><td colspan="13" class="titulo">HVAC - Sistema de Mantenimiento</td></tr>
  <tr><td colspan="3">Cliente: ${cliente}</td><td colspan="3">Generado: ${new Date().toLocaleDateString("es-PE")}</td><td colspan="3">Total: ${equipos.length} equipos</td><td colspan="4"></td></tr>
  <tr><td colspan="13"></td></tr>
  <tr><td class="header">#</td><td class="header">Codigo</td><td class="header">Piso</td><td class="header">Ambiente</td><td class="header">Tipo</td><td class="header">Marca</td><td class="header">Modelo</td><td class="header">Serie</td><td class="header">Capacidad</td><td class="header">Refrigerante</td><td class="header">Voltaje</td><td class="header">Estado</td><td class="header">Observaciones</td></tr>`;
  pisos.forEach(p => {
    html += `<tr><td colspan="13" class="piso">PISO: ${p.toUpperCase()}</td></tr>`;
    porPiso[p].forEach((e, idx) => {
      const ec = e.estado === "Operativo" ? "op" : e.estado === "Operativo con observaciones" ? "obs" : "fs";
      html += `<tr class="${idx % 2 === 0 ? "fila" : "fila-alt"}"><td>${item++}</td><td class="cod">${e.codigo || "-"}</td><td>${e.piso || "-"}</td><td>${e.ambiente || "-"}</td><td>${e.tipoEquipo || "-"}</td><td>${e.marca || "-"}</td><td>${e.modelo || "-"}</td><td>${e.serie || "-"}</td><td>${e.capacidad || "-"}</td><td>${e.tipoRefrigerante || "-"}</td><td>${e.voltaje ? e.voltaje + "V" : "-"}</td><td class="${ec}">${e.estado || "Operativo"}</td><td>${e.observaciones || "-"}</td></tr>`;
    });
  });
  html += `</table></body></html>`;
  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url;
  a.download = `equipos-${cliente.replace(/\s+/g, "-")}-${new Date().getFullYear()}.xls`;
  a.click(); URL.revokeObjectURL(url);
};

const getObsPDF = (e) => {
  const arr = e.observacionesArray || [];
  const norm = arr.map(o => typeof o === "string"
    ? { texto: o, fecha: "", tecnico: "", causa: "" }
    : { texto: o.texto || "", fecha: o.fecha || "", tecnico: o.tecnico || "", causa: o.causa || "" }
  );
  const filtradas = norm.filter(o => o?.texto?.trim());
  if (filtradas.length > 0) return filtradas;
  return e.observaciones?.split(/\n|;/).map(o => ({ texto: o.trim(), fecha: "", tecnico: "", causa: "" })).filter(o => o.texto) || [];
};

const getRecPDF = (e) => e.recomendacionesArray?.filter(Boolean) ||
  e.recomendaciones?.split(/\n|;/).map(r => r.trim()).filter(Boolean) || [];

const exportarPDF = (cliente, sede, equipos) => {
  const pdf = new jsPDF("l", "mm", "a4");
  const M = 10, PW = 297, CW = PW - M * 2;
  let y = 15;
  pdf.setFillColor(26, 115, 232); pdf.rect(0, 0, PW, 20, "F");
  pdf.setFontSize(13); pdf.setFont("helvetica", "bold"); pdf.setTextColor(255, 255, 255);
  pdf.text("HVAC - Sistema de Mantenimiento", M, 13);
  pdf.setFontSize(10); pdf.setFont("helvetica", "normal");
  const sedeTxt = sede ? `   Sede: (${sede.toUpperCase()})` : "";
  pdf.text(`Cliente: ${cliente}${sedeTxt}   Generado: ${new Date().toLocaleDateString("es-PE")}   Total: ${equipos.length} equipos`, M, 19);
  y = 28;

  const check = (h) => { if (y + h > 195) { pdf.addPage(); y = 15; } };

  const badge = (estado) => {
    if (estado === "Operativo") return { bg: [232, 245, 233], color: [27, 94, 32], txt: "Operativo" };
    if (estado === "Operativo con observaciones") return { bg: [255, 248, 225], color: [230, 81, 0], txt: "Con obs." };
    return { bg: [255, 235, 238], color: [183, 28, 28], txt: estado || "Operativo" };
  };

  const porPiso = agruparPorPiso(equipos); let item = 1;
  Object.keys(porPiso).sort(ordenarPisos).forEach(p => {
    check(10);
    pdf.setFillColor(187, 222, 251); pdf.rect(M, y, CW, 6, "F");
    pdf.setFontSize(8.5); pdf.setFont("helvetica", "bold"); pdf.setTextColor(13, 71, 161);
    pdf.text(`PISO: ${p.toUpperCase()}`, M + 3, y + 4.2);
    y += 9;

    porPiso[p].forEach((e) => {
      const obs = getObsPDF(e); const rec = getRecPDF(e);
      const alturaFicha = 9;
      const alturaObs = obs.length === 0 ? 6 : 4 + obs.length * 8;
      const alturaTotal = 6 + alturaFicha + alturaObs + 4;
      check(alturaTotal + 4);

      const yTop = y;
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(8); pdf.setTextColor(30, 30, 30);
      pdf.text(String(item++) + ".", M, y + 3);
      pdf.text(`${e.ambiente || "-"}`, M + 8, y + 3);
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(7.5); pdf.setTextColor(90, 90, 90);
      pdf.text(`${e.tipoEquipo || "-"} \u00b7 ${e.marca || "-"}`, M + 8 + pdf.getTextWidth(`${e.ambiente || "-"}`) + 4, y + 3);
      const bd = badge(e.estado);
      pdf.setFillColor(...bd.bg); pdf.roundedRect(M + CW - 32, y - 1, 32, 5, 1.5, 1.5, "F");
      pdf.setFontSize(7); pdf.setTextColor(...bd.color);
      pdf.text(bd.txt, M + CW - 16, y + 2.5, { align: "center" });
      y += 6;

      // Ficha técnica: fila completa de 6 columnas
      pdf.setFillColor(248, 249, 250); pdf.rect(M, y, CW, alturaFicha, "F");
      const campos = [
        ["Modelo", e.modelo || "-"], ["Serie", e.serie || "-"], ["Capacidad", e.capacidad ? `${e.capacidad} BTU` : "-"],
        ["Refrig.", e.tipoRefrigerante || "-"], ["Voltaje", e.voltaje ? `${e.voltaje}V` : "-"], ["Amperaje", e.amperaje ? `${e.amperaje}A` : "-"],
      ];
      const fcw = CW / 6;
      campos.forEach(([l, v], i) => {
        const cx = M + i * fcw + 3;
        pdf.setFont("helvetica", "normal"); pdf.setFontSize(6); pdf.setTextColor(140, 140, 140);
        pdf.text(l, cx, y + 3.5);
        pdf.setFont("helvetica", "bold"); pdf.setFontSize(7); pdf.setTextColor(30, 30, 30);
        pdf.text(String(v), cx, y + 6.8);
      });
      y += alturaFicha + 3;

      // Observaciones: fila completa debajo
      if (obs.length === 0) {
        pdf.setFont("helvetica", "italic"); pdf.setFontSize(7.5); pdf.setTextColor(160, 160, 160);
        pdf.text("Sin observaciones registradas", M, y + 2);
        y += 6;
      } else {
        const col0 = 8, colW = (CW - col0) / 3;
        pdf.setFont("helvetica", "normal"); pdf.setFontSize(6); pdf.setTextColor(150, 150, 150);
        pdf.text("Observaci\u00f3n", M + col0 + 2, y);
        pdf.text("Causa", M + col0 + colW + 2, y);
        pdf.text("Recomendaci\u00f3n", M + col0 + colW * 2 + 2, y);
        y += 2.5;
        obs.forEach((o, i) => {
          const rowH = 7.5;
          pdf.setFontSize(6.5); pdf.setTextColor(130, 130, 130);
          pdf.text(String(i + 1), M, y + 4);
          pdf.setFillColor(255, 248, 225); pdf.rect(M + col0, y, colW - 2, rowH, "F");
          pdf.setFillColor(254, 240, 240); pdf.rect(M + col0 + colW, y, colW - 2, rowH, "F");
          pdf.setFillColor(232, 245, 233); pdf.rect(M + col0 + colW * 2, y, colW - 2, rowH, "F");
          pdf.setFont("helvetica", "normal"); pdf.setFontSize(6.8);
          pdf.setTextColor(122, 74, 0); pdf.text(pdf.splitTextToSize(o.texto, colW - 6).slice(0, 2), M + col0 + 2, y + 3);
          pdf.setTextColor(138, 45, 45); pdf.text(pdf.splitTextToSize(o.causa || "\u2014", colW - 6).slice(0, 2), M + col0 + colW + 2, y + 3);
          const recTxt = rec[i] ? (typeof rec[i] === "string" ? rec[i] : rec[i].texto || "\u2014") : "\u2014";
          pdf.setTextColor(36, 92, 31); pdf.text(pdf.splitTextToSize(recTxt, colW - 6).slice(0, 2), M + col0 + colW * 2 + 2, y + 3);
          y += rowH + 1;
        });
      }

      y = yTop + alturaTotal;
      pdf.setDrawColor(230, 230, 230); pdf.line(M, y - 2, M + CW, y - 2);
    });
  });

  pdf.setFontSize(8); pdf.setTextColor(150, 150, 150);
  pdf.text(`HVAC Sistema de Mantenimiento`, M, 205);
  pdf.save(`equipos-${cliente.replace(/\s+/g, "-")}-${new Date().getFullYear()}.pdf`);
};



export default function PanelCliente() {
  const [equipos, setEquipos] = useState([]);
  const [sedes, setSedes] = useState([]);
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState("Todos");
  const [pisosSeleccionados, setPisosSeleccionados] = useState([]);
  const [pisoDropdownAbierto, setPisoDropdownAbierto] = useState(false);
  const [filtroTipoEquipo, setFiltroTipoEquipo] = useState("Todos");
  const [filtroMes, setFiltroMes] = useState("Todos");
  const [modalEquipo, setModalEquipo] = useState(null);
  const [modalTipo, setModalTipo] = useState(null);
  const [obsAbierto, setObsAbierto] = useState(null);
  const [vistaActual, setVistaActual] = useState("sedes");
  const [sedeActual, setSedeActual] = useState(null);
  const [averias, setAverias] = useState([]);
  const [averiasAbierto, setAveriasAbierto] = useState(false);
  const [detalleAveria, setDetalleAveria] = useState(null); // avería mostrada dentro del modal de ficha
  const [listaEmergenciaSede, setListaEmergenciaSede] = useState(null); // averías de una sede cuando hay 2+
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { navigate("/"); return; }
      try {
        const { doc, getDoc } = await import("firebase/firestore");
        let data = null;

        const snapUID = await getDoc(doc(db, "usuarios", user.uid));
        if (snapUID.exists()) {
          data = snapUID.data();
        } else {
          const q = query(collection(db, "usuarios"), where("email", "==", user.email));
          const snap = await getDocs(q);
          if (!snap.empty) data = snap.docs[0].data();
        }

        if (data) {
          setUsuario(data);
          const empresa = data.empresa || data.nombre || "";

          const eSnap = await getDocs(query(collection(db, "equipos"), where("cliente", "==", empresa)));
          const lista = eSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          setEquipos(lista);

          try {
            const aSnap = await getDocs(query(collection(db, "averias"), where("cliente", "==", empresa), where("atendida", "==", false)));
            setAverias(aSnap.docs.map(d => ({ id: d.id, ...d.data() })));
          } catch {
            setAverias([]);
          }

          try {
            const sSnap = await getDocs(query(collection(db, "sedes"), where("cliente", "==", empresa)));
            const listaSedes = sSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            setSedes(listaSedes);

            // Restaurar sede si viene desde protocolo
            const sedeParam = searchParams.get("sede");
            if (sedeParam && listaSedes.length > 0) {
              const sedeRestaurada = listaSedes.find(s => s.id === sedeParam);
              if (sedeRestaurada) {
                setSedeActual(sedeRestaurada);
                setVistaActual("equipos");
              } else {
                if (listaSedes.length === 0) setVistaActual("equipos");
              }
            } else {
              if (listaSedes.length === 0) setVistaActual("equipos");
            }
          } catch {
            setSedes([]);
            setVistaActual("equipos");
          }
        }
      } catch (err) {
        console.error("Error cargando datos cliente:", err);
      }
      setCargando(false);
    });
    return () => unsub();
  }, []);

  const handleLogout = async () => { await signOut(auth); navigate("/"); };

  // ---- Averías / emergencias por sede ----
  const abrirDetalleAveria = (averia) => {
    const equipo = equipos.find(e => e.id === averia.equipoId);
    if (equipo) {
      setModalEquipo(equipo);
      setModalTipo("info");
    }
    setDetalleAveria(averia);
    setListaEmergenciaSede(null);
  };

  const abrirEmergenciasSede = (sede) => {
    const averiasSede = averias.filter(a => a.sede === sede.nombre);
    if (averiasSede.length === 0) return;
    if (averiasSede.length === 1) {
      abrirDetalleAveria(averiasSede[0]);
    } else {
      setListaEmergenciaSede(averiasSede);
    }
  };

  const cerrarModalEquipo = () => {
    setModalEquipo(null);
    setModalTipo(null);
    setDetalleAveria(null);
  };

  const marcarAveriaAtendida = async (averiaId) => {
    try {
      const { doc, updateDoc, serverTimestamp } = await import("firebase/firestore");
      await updateDoc(doc(db, "averias", averiaId), { atendida: true, atendidaEn: serverTimestamp() });
      setAverias(prev => prev.filter(a => a.id !== averiaId));
      cerrarModalEquipo();
    } catch (e) {
      console.error("Error marcando avería como atendida:", e);
    }
  };

  const getObs = (e) => {
    const arr = e.observacionesArray || [];
    const norm = arr.map(o => typeof o === "string"
      ? { texto: o, fecha: "", tecnico: "", causa: "" }
      : { texto: o.texto || "", fecha: o.fecha || "", tecnico: o.tecnico || "", causa: o.causa || "" }
    );
    const filtradas = norm.filter(o => o?.texto?.trim());
    if (filtradas.length > 0) return filtradas;
    return e.observaciones?.split(/\n|;/).map(o => ({ texto: o.trim(), fecha: "", tecnico: "", causa: "" })).filter(o => o.texto) || [];
  };

  const getRec = (e) => e.recomendacionesArray?.filter(Boolean) ||
    e.recomendaciones?.split(/\n|;/).map(r => r.trim()).filter(Boolean) || [];

  const getCor = (e) => e.correctivosArray?.filter(c => c.descripcion) || [];

  const equiposMostrados = sedeActual
    ? equipos.filter(e => e.sede === sedeActual.nombre)
    : equipos;

  const fechaAMesAnio = (fecha) => {
    if (!fecha) return null;
    const d = new Date(fecha.includes("/") ? fecha.split("/").reverse().join("-") : fecha);
    if (isNaN(d)) return null;
    return d.toLocaleDateString("es-PE", { month: "short", year: "numeric" });
  };
  const fechaATimestamp = (fecha) => {
    if (!fecha) return 0;
    const d = new Date(fecha.includes("/") ? fecha.split("/").reverse().join("-") : fecha);
    return isNaN(d) ? 0 : d.getTime();
  };
  const fechaColor = (fecha) => {
    if (!fecha) return { bg: "#f5f5f5", color: "#888", border: "#e0e0e0" };
    const meses = (Date.now() - fechaATimestamp(fecha)) / (1000 * 60 * 60 * 24 * 30);
    if (meses <= 3) return { bg: "#e8f5e9", color: "#2e7d32", border: "#a5d6a7" };
    if (meses <= 6) return { bg: "#e8f0fe", color: "#1a5fa8", border: "#c5d5e8" };
    return { bg: "#ffebee", color: "#c62828", border: "#ef9a9a" };
  };

  const mesesDisponibles = ["Todos", ...new Set(
    equiposMostrados.map(e => fechaAMesAnio(e.ultimoMantenimiento)).filter(Boolean)
  )];

  const equiposFiltrados = equiposMostrados
    .filter(e => {
      const okE = filtroEstado === "Todos" || e.estado === filtroEstado;
      const okP = pisosSeleccionados.length === 0 || pisosSeleccionados.includes(e.piso || "Sin piso");
      const okT = filtroTipoEquipo === "Todos" || (e.tipoEquipo || "Sin tipo") === filtroTipoEquipo;
      const okM = filtroMes === "Todos" ||
        (filtroMes === "Sin fecha" && !e.ultimoMantenimiento) ||
        fechaAMesAnio(e.ultimoMantenimiento) === filtroMes;
      return okE && okP && okT && okM;
    })
    .sort((a, b) => {
      const todosFiltrosVacios = pisosSeleccionados.length === 0 && filtroTipoEquipo === "Todos" && filtroMes === "Todos";
      if (todosFiltrosVacios) return sortPiso(a, b);
      const fa = fechaATimestamp(a.ultimoMantenimiento);
      const fb = fechaATimestamp(b.ultimoMantenimiento);
      if (fb !== fa) return fb - fa;
      return sortPiso(a, b);
    });

  const tot = equiposMostrados.length;
  const op = equiposMostrados.filter(e => e.estado === "Operativo").length;
  const obs = equiposMostrados.filter(e => e.estado === "Operativo con observaciones").length;
  const fs = equiposMostrados.filter(e => e.estado === "Fuera de servicio").length;

  const pisos = ["Todos", ...[...new Set(equiposMostrados.map(e => e.piso).filter(Boolean))].sort(ordenarPisos)];
  const tiposEquipo = ["Todos", ...[...new Set(equiposMostrados.map(e => e.tipoEquipo).filter(Boolean))].sort()];

  const getBadge = (estado) => {
    const map = { "Operativo": { bg: "#e8f5e9", color: "#2e7d32" }, "Operativo con observaciones": { bg: "#fff8e1", color: "#e65100" }, "Fuera de servicio": { bg: "#ffebee", color: "#c62828" } };
    const st = map[estado] || map["Operativo"];
    return <span style={{ fontSize: "11px", padding: "3px 10px", background: st.bg, color: st.color, borderRadius: "20px", fontWeight: 500, whiteSpace: "nowrap", display: "inline-block" }}>{estado === "Operativo con observaciones" ? "Con obs." : estado || "Operativo"}</span>;
  };

  const getCronColor = (estado) => ({
    realizado: { bg: "#e8f5e9", border: "#a5d6a7", color: "#2e7d32", label: "Realizado" },
    pendiente: { bg: "#fff8e1", border: "#ffe082", color: "#e65100", label: "Pendiente" },
    programado: { bg: "#f5f5f5", border: "#e0e0e0", color: "#888", label: "Programado" },
  }[estado] || { bg: "#f5f5f5", border: "#e0e0e0", color: "#888", label: "Programado" });

  const GRUPO_POR_TIPO_PDF = {
    "Ventilación": "ventilacion", "Extractor": "ventilacion", "Inyector": "ventilacion",
    "Cortina de aire": "ventilacion", "Jetfan": "ventilacion", "Presurizador": "ventilacion",
  };

  const generarPDFFicha = (eq) => {
    const obs = getObs(eq);
    const rec = getRec(eq);
    const cor = getCor(eq);
    const cron = eq.cronograma || [];
    const badgeColor = eq.estado === "Operativo" ? "#2e7d32" : eq.estado === "Operativo con observaciones" ? "#e65100" : "#c62828";
    const badgeBg = eq.estado === "Operativo" ? "#e8f5e9" : eq.estado === "Operativo con observaciones" ? "#fff8e1" : "#ffebee";

    const esVentF = GRUPO_POR_TIPO_PDF[eq.tipoEquipo] === "ventilacion";
    const campo = (l, v) => v ? `<div style="background:#f8f9fa;border-radius:6px;padding:7px 10px;"><div style="font-size:10px;color:#888;margin-bottom:2px;">${l}</div><div style="font-size:12px;font-weight:600;color:#222;">${v}</div></div>` : "";
    const filaGen = [
      campo("Cliente", eq.cliente), campo("Sede", eq.sede), campo("Piso", eq.piso), campo("Ambiente", eq.ambiente),
      campo("Marca", eq.marca), campo("Modelo", eq.modelo), campo("N° Serie", eq.serie),
      campo("Capacidad", eq.capacidad ? eq.capacidad + (esVentF ? " CFM" : " BTU") : null),
    ].filter(Boolean).join("");
    const filaElec = [
      !esVentF ? campo("Refrigerante", eq.tipoRefrigerante) : "",
      campo("Voltaje de placa", eq.voltaje ? eq.voltaje + "V" : null), campo("Amperaje nominal", eq.amperaje ? eq.amperaje + "A" : null),
      campo("Fases", eq.fases),
      campo("Voltaje cond.", eq.condVoltaje ? eq.condVoltaje + "V" : null),
      campo("Amperaje cond.", eq.condAmperaje ? eq.condAmperaje + "A" : null),
      campo("Modelo compresor", eq.modeloCompresor),
    ].filter(Boolean).join("");
    const filaMotor = [
      campo("Contrato", eq.contrato), campo("Modelo de faja", eq.modeloFaja), campo("N° de fajas", eq.numFajas),
      campo("Marca motor", eq.marcaMotor), campo("Modelo motor", eq.modeloMotor), campo("N° serie motor", eq.serieMotor),
    ].filter(Boolean).join("");
    const campos = `<div class="campos">${filaGen}</div>` +
      (filaElec ? `<div class="campos" style="margin-top:8px">${filaElec}</div>` : "") +
      (filaMotor ? `<div class="campos" style="margin-top:8px">${filaMotor}</div>` : "");

    const syncBadge = eq.ultimoProtocolo ? `<span style="font-size:10px;padding:2px 8px;background:#e8f5e9;color:#2e7d32;border-radius:20px;margin-left:8px;">Sincronizado ${eq.ultimoProtocolo}</span>` : "";

    const ocrHtml = obs.length > 0 ? `
      <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:4px;">
        <thead><tr>
          <th style="background:#fff3e0;color:#e65100;padding:5px 8px;text-align:left;width:5%">#</th>
          <th style="background:#fff3e0;color:#e65100;padding:5px 8px;text-align:left;width:32%">Observación</th>
          <th style="background:#fce4ec;color:#c62828;padding:5px 8px;text-align:left;width:32%">Causa</th>
          <th style="background:#e8f5e9;color:#2e7d32;padding:5px 8px;text-align:left;width:31%">Recomendación</th>
        </tr></thead>
        <tbody>${obs.map((o, i) => `
          <tr style="background:${i % 2 === 0 ? "white" : "#fafafa"}">
            <td style="padding:5px 8px;border-bottom:0.5px solid #f0f0f0;color:#888">${i + 1}</td>
            <td style="padding:5px 8px;border-bottom:0.5px solid #f0f0f0;color:#e65100;background:#fff8e1;">
              <div>${o.texto}</div>
              ${o.fecha || o.tecnico ? `<div style="font-size:9px;color:#aaa;margin-top:2px;">${o.fecha || ""}${o.fecha && o.tecnico ? " · " : ""}${o.tecnico ? "Téc: " + o.tecnico : ""}</div>` : ""}
            </td>
            <td style="padding:5px 8px;border-bottom:0.5px solid #f0f0f0;color:#c62828;background:#fef0f0;">${o.causa || "—"}</td>
            <td style="padding:5px 8px;border-bottom:0.5px solid #f0f0f0;color:#2e7d32;background:#e8f5e9;">${rec[i] ? (typeof rec[i] === "string" ? rec[i] : rec[i].texto || "—") : "—"}</td>
          </tr>`).join("")}
        </tbody>
      </table>` : `<div style="font-size:12px;color:#aaa;font-style:italic;">Sin observaciones registradas</div>`;

    const cronColors = { realizado: { bg: "#e8f5e9", color: "#2e7d32", icon: "OK" }, pendiente: { bg: "#fff8e1", color: "#e65100", icon: "Pend." }, programado: { bg: "#f5f5f5", color: "#888", icon: "Prog." } };
    const cronHtml = cron.length > 0 ? `<div style="display:flex;gap:8px;flex-wrap:wrap;">${cron.map(t => { const c = cronColors[t.estado] || cronColors.programado; return `<div style="background:${c.bg};border-radius:8px;padding:10px;text-align:center;flex:1;min-width:80px;"><div style="font-size:11px;font-weight:700;color:${c.color};margin-bottom:3px;">${t.label}</div><div style="font-size:11px;color:${c.color};">${t.fecha || "Sin fecha"}</div><div style="font-size:10px;color:${c.color};margin-top:3px;">${c.icon} ${t.estado}</div></div>`; }).join("")}</div>` : "";

    const corHtml = cor.length > 0 ? cor.map(c => `<div style="background:#f5f5f5;border-left:3px solid #1a5fa8;border-radius:0 6px 6px 0;padding:6px 10px;font-size:12px;margin-bottom:5px;display:flex;justify-content:space-between;"><span>${c.descripcion}</span>${c.fecha ? `<span style="font-size:10px;color:#888;">${c.fecha}</span>` : ""}</div>`).join("") : "";

    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Ficha — ${eq.codigo || eq.marca}</title>
    <style>@page{size:A4;margin:14mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:13px;color:#222;background:white;margin:0}
    .header{background:#1a5fa8;color:white;padding:13px 20px;display:flex;justify-content:space-between;align-items:center}
    .logo{font-size:18px;font-weight:900;letter-spacing:2px}.badge{background:${badgeBg};color:${badgeColor};padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700}
    .sec{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#1a5fa8;border-left:3px solid #1a5fa8;padding-left:8px;margin:14px 0 8px}
    .sec.obs{color:#e65100;border-color:#e65100}.campos{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
    .cron{display:flex;gap:8px}.btn-print{display:block;margin:12px auto;padding:10px 24px;background:#1a5fa8;color:white;border:none;border-radius:8px;font-size:14px;cursor:pointer;font-weight:600}
    @media print{.btn-print{display:none!important}}</style></head><body>
    <div class="header"><div class="logo">HVAC</div><div class="badge">${eq.estado === "Operativo con observaciones" ? "Con observaciones" : eq.estado || "Operativo"}</div></div>
    <button class="btn-print" onclick="window.print()">Imprimir / Guardar PDF</button>
    <div style="padding:0 16px 16px">
      <div style="background:#f8f9fa;border-radius:8px;padding:12px 16px;margin:14px 0 0">
        <div style="font-size:15px;font-weight:700;color:#1a5fa8;">${eq.marca || ""} / ${eq.modelo || ""}</div>
        <div style="font-size:12px;color:#555;margin-top:4px;">${eq.tipoEquipo || ""} · ${eq.cliente || ""} · ${eq.sede || ""} · Piso ${eq.piso || ""} · ${eq.ambiente || ""}</div>
      </div>
      <div class="sec">Datos del equipo</div>${campos}
      <div class="sec obs">Observación · Causa · Recomendación ${syncBadge}</div>${ocrHtml}
      ${cron.length > 0 ? `<div class="sec">Cronograma de mantenimiento</div><div class="cron">${cronHtml}</div>` : ""}
      ${cor.length > 0 ? `<div class="sec">Correctivos realizados</div>${corHtml}` : ""}
      <div style="border-top:0.5px solid #ddd;margin-top:16px;padding-top:10px;font-size:10px;color:#aaa;">
        Generado: ${new Date().toLocaleDateString("es-PE")} · HVAC Sistema de Mantenimiento
      </div>
    </div>
    <script>setTimeout(()=>window.print(),600);</script></body></html>`;

    const win = window.open("", "_blank");
    win.document.write(html);
    win.document.close();
  };

  if (cargando) return <div style={s.centro}>Cargando...</div>;

  return (
    <div style={s.page}>
      {/* Navbar */}
      <div style={s.navbar}>
        <div style={s.navLeft}>
          <div style={s.logo}>
            <span style={{ color: "#1a5fa8" }}>H</span>
            <span style={{ color: "#1a5fa8", marginRight: "-6px" }}>V</span>
            <span style={{ color: "#f0c040", marginLeft: "2px" }}>A</span>
            <span style={{ color: "#1a5fa8", marginLeft: "2px" }}>C</span>
          </div>
          <div style={s.divider}></div>
          {sedeActual ? (
            <>
              <button style={s.btnBack} onClick={() => { setSedeActual(null); setVistaActual("sedes"); setFiltroEstado("Todos"); setFiltroPiso("Todos"); }}>← {usuario?.empresa}</button>
              <div style={s.divider}></div>
              <span style={s.navTitle}>{sedeActual.nombre}</span>
            </>
          ) : (
            <span style={s.navEmpresa}>{usuario?.empresa}</span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", position: "relative" }}>
          {averias.length > 0 && (
            <button
              onClick={() => setAveriasAbierto(o => !o)}
              style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 12px", borderRadius: "20px", background: "#fef0f0", color: "#791f1f", border: "0.5px solid #f0997b", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
            >
              <i className="ti ti-alert-triangle" aria-hidden="true"></i>
              Averías <span style={{ background: "#c62828", color: "white", borderRadius: "10px", padding: "1px 7px", fontSize: "11px" }}>{averias.length}</span>
            </button>
          )}
          {averiasAbierto && (
            <>
              <div style={{ position: "fixed", inset: 0, zIndex: 9 }} onClick={() => setAveriasAbierto(false)}></div>
              <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, width: "360px", maxHeight: "420px", overflowY: "auto", background: "white", border: "0.5px solid #ddd", borderRadius: "10px", boxShadow: "0 8px 24px rgba(0,0,0,0.15)", zIndex: 10, padding: "8px" }}>
                <div style={{ fontSize: "12px", fontWeight: 600, color: "#791f1f", padding: "6px 8px" }}>Averías reportadas</div>
                {averias.map(a => (
                  <div
                    key={a.id}
                    style={{ padding: "10px", borderRadius: "8px", background: "#fafafa", marginBottom: "6px", cursor: "pointer" }}
                    onClick={() => { setAveriasAbierto(false); abrirDetalleAveria(a); }}
                  >
                    <div style={{ fontSize: "12px", fontWeight: 600, color: "#222" }}>
                      {a.equipoCodigo && <span style={{ fontFamily: "monospace", background: "#f3e5f5", color: "#6a1b9a", padding: "1px 5px", borderRadius: "4px", marginRight: "6px" }}>{a.equipoCodigo}</span>}
                      {a.ambiente || "-"} {a.piso ? `· Piso ${a.piso}` : ""}
                    </div>
                    <div style={{ fontSize: "12px", color: "#555", margin: "4px 0" }}>{a.mensaje}</div>
                    <div style={{ fontSize: "10px", color: "#999" }}>
                      Reportado por {a.tipoReportante || "-"}{a.nombreReportante ? ` (${a.nombreReportante})` : ""} · {a.fecha?.toDate ? a.fecha.toDate().toLocaleString("es-PE") : ""}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          {vistaActual === "equipos" && (
            <>
              <button style={s.btnExcel} onClick={() => exportarExcel(usuario?.empresa, equiposFiltrados)}>
                <i className="ti ti-file-spreadsheet" aria-hidden="true"></i> Excel
              </button>
              <button style={s.btnPdf} onClick={() => exportarPDF(usuario?.empresa, sedeActual?.nombre, equiposFiltrados)}>
                <i className="ti ti-file-type-pdf" aria-hidden="true"></i> PDF
              </button>
            </>
          )}
          <button style={s.btnSalir} onClick={handleLogout}>Salir</button>
        </div>
      </div>

      <div style={s.content}>
        {/* Vista sedes */}
        {vistaActual === "sedes" && sedes.length > 0 && (
          <div style={s.sedesGrid}>
            {sedes.map(sede => {
              const eqSede = equipos.filter(e => e.sede === sede.nombre);
              const opS = eqSede.filter(e => e.estado === "Operativo").length;
              const obsS = eqSede.filter(e => e.estado === "Operativo con observaciones").length;
              const fsS = eqSede.filter(e => e.estado === "Fuera de servicio").length;
              const totS = eqSede.length;
              const pOpS = totS ? Math.round(opS / totS * 100) : 0;
              const pObsS = totS ? Math.round(obsS / totS * 100) : 0;
              const pFsS = totS ? Math.round(fsS / totS * 100) : 0;
              const averiasSede = averias.filter(a => a.sede === sede.nombre);
              return (
                <div key={sede.id} style={s.sedeCard}>
                  <div style={s.sedeHeader}>
                    <div style={s.sedeIcon}></div>
                    <div>
                      <div style={s.sedeNombre}>{sede.nombre}</div>
                      <div style={s.sedeDireccion}>{sede.direccion}</div>
                    </div>
                  </div>
                  <div style={s.miniStats}>
                    <div style={{ ...s.mini, background: "#e8f5e9" }}><div style={{ ...s.miniNum, color: "#2e7d32" }}>{opS}</div><div style={{ ...s.miniLabel, color: "#2e7d32" }}>Operativo</div></div>
                    <div style={{ ...s.mini, background: "#fff8e1" }}><div style={{ ...s.miniNum, color: "#e65100" }}>{obsS}</div><div style={{ ...s.miniLabel, color: "#e65100" }}>Con obs.</div></div>
                    <div style={{ ...s.mini, background: fsS > 0 ? "#ffebee" : "#f5f5f5" }}><div style={{ ...s.miniNum, color: fsS > 0 ? "#c62828" : "#aaa" }}>{fsS}</div><div style={{ ...s.miniLabel, color: fsS > 0 ? "#c62828" : "#aaa" }}>Fuera serv.</div></div>
                    <div
                      style={{ ...s.mini, background: averiasSede.length > 0 ? "#fef0f0" : "#f5f5f5", border: averiasSede.length > 0 ? "0.5px solid #f0997b" : "none", cursor: averiasSede.length > 0 ? "pointer" : "default" }}
                      onClick={() => abrirEmergenciasSede(sede)}
                    >
                      <div style={{ ...s.miniNum, color: averiasSede.length > 0 ? "#c62828" : "#aaa" }}>{averiasSede.length}</div>
                      <div style={{ ...s.miniLabel, color: averiasSede.length > 0 ? "#c62828" : "#aaa", display: "flex", alignItems: "center", justifyContent: "center", gap: "3px" }}>
                        <i className="ti ti-alert-triangle" style={{ fontSize: "10px" }} aria-hidden="true"></i>Emergencia
                      </div>
                    </div>
                  </div>
                  <div style={s.barraWrap}>
                    <div style={s.barra}>
                      {pOpS > 0 && <div style={{ width: `${pOpS}%`, background: "#43a047", height: "100%" }}></div>}
                      {pObsS > 0 && <div style={{ width: `${pObsS}%`, background: "#ffa726", height: "100%" }}></div>}
                      {pFsS > 0 && <div style={{ width: `${pFsS}%`, background: "#ef5350", height: "100%" }}></div>}
                    </div>
                  </div>
                  <button style={s.btnVerSede} onClick={() => { setSedeActual(sede); setVistaActual("equipos"); }}>
                    Ver equipos →
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Vista equipos */}
        {vistaActual === "equipos" && (
          <>
            <div style={s.statsGrid}>
              {[
                { label: "Total equipos", val: tot, color: "#1a5fa8", bg: "white", border: "1.5px solid #1a5fa8", filtro: "Todos" },
                { label: "Operativos", val: op, color: "#2e7d32", bg: "#e8f5e9", border: filtroEstado === "Operativo" ? "1.5px solid #2e7d32" : "0.5px solid #a5d6a7", filtro: "Operativo" },
                { label: "Con obs.", val: obs, color: "#e65100", bg: "#fff8e1", border: filtroEstado === "Operativo con observaciones" ? "1.5px solid #e65100" : "0.5px solid #ffe082", filtro: "Operativo con observaciones" },
                { label: "Fuera serv.", val: fs, color: "#c62828", bg: "#ffebee", border: filtroEstado === "Fuera de servicio" ? "1.5px solid #c62828" : "0.5px solid #ef9a9a", filtro: "Fuera de servicio" },
              ].map(st => (
                <div key={st.filtro} onClick={() => setFiltroEstado(filtroEstado === st.filtro ? "Todos" : st.filtro)}
                  style={{ background: st.bg, border: st.border, borderRadius: "12px", padding: "14px", textAlign: "center", cursor: "pointer", transition: "all 0.15s" }}>
                  <div style={{ fontSize: "28px", fontWeight: 500, color: st.color }}>{st.val}</div>
                  <div style={{ fontSize: "10px", color: st.color, textTransform: "uppercase", letterSpacing: "0.05em", marginTop: "4px", fontWeight: 500 }}>{st.label}</div>
                </div>
              ))}
            </div>

            <div style={s.barrasCard}>
              {[["Operativo", op, "#43a047", "#2e7d32"], ["Con observaciones", obs, "#ffa726", "#e65100"], ["Fuera de servicio", fs, "#ef5350", "#c62828"]].map(([label, val, bg, color]) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 500, color: "#555", width: "140px", flexShrink: 0 }}>{label}</span>
                  <div style={{ flex: 1, height: "8px", background: "#f0f0f0", borderRadius: "4px", overflow: "hidden" }}>
                    <div style={{ width: `${tot ? Math.round(val / tot * 100) : 0}%`, height: "100%", background: bg, borderRadius: "4px" }}></div>
                  </div>
                  <span style={{ fontSize: "12px", fontWeight: 500, color, width: "50px", textAlign: "right" }}>{val} und</span>
                </div>
              ))}
            </div>

            <div style={s.tablaCard}>
              <div style={s.tablaHeader}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "14px", fontWeight: 500, color: "#222" }}>Lista de equipos</span>
                  <span style={{ fontSize: "11px", padding: "2px 8px", background: "#e8f0fe", color: "#1a5fa8", borderRadius: "20px" }}>{equiposFiltrados.length} equipo{equiposFiltrados.length !== 1 ? "s" : ""}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "12px", color: "#888" }}>Piso:</span>
                  <div style={{ position: "relative" }}>
                    <button
                      onClick={() => setPisoDropdownAbierto(o => !o)}
                      style={{ fontSize: "12px", padding: "5px 10px", borderRadius: "6px", border: "0.5px solid #ddd", background: "white", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", minWidth: "140px", justifyContent: "space-between" }}
                    >
                      <span>{pisosSeleccionados.length === 0 ? "Todos los pisos" : pisosSeleccionados.length === 1 ? `Piso ${pisosSeleccionados[0]}` : `${pisosSeleccionados.length} pisos`}</span>
                      <span style={{ fontSize: "10px", color: "#888" }}>{pisoDropdownAbierto ? "▴" : "▾"}</span>
                    </button>
                    {pisoDropdownAbierto && (
                      <>
                        <div style={{ position: "fixed", inset: 0, zIndex: 9 }} onClick={() => setPisoDropdownAbierto(false)}></div>
                        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, background: "white", border: "0.5px solid #ddd", borderRadius: "8px", boxShadow: "0 4px 16px rgba(0,0,0,0.12)", zIndex: 10, minWidth: "180px", maxHeight: "320px", overflowY: "auto" }}>
                          <div
                            onClick={() => setPisosSeleccionados([])}
                            style={{ padding: "8px 12px", fontSize: "12px", fontWeight: 500, cursor: "pointer", background: pisosSeleccionados.length === 0 ? "#e8f0fe" : "white", color: pisosSeleccionados.length === 0 ? "#1a5fa8" : "#333", borderBottom: "0.5px solid #f0f0f0" }}
                          >
                            Todos los pisos
                          </div>
                          {pisos.filter(p => p !== "Todos").map(p => (
                            <label key={p} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "7px 12px", fontSize: "12px", cursor: "pointer", color: "#333" }}>
                              <input
                                type="checkbox"
                                checked={pisosSeleccionados.includes(p)}
                                onChange={() => setPisosSeleccionados(sel => sel.includes(p) ? sel.filter(x => x !== p) : [...sel, p])}
                              />
                              Piso {p}
                            </label>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                  <span style={{ fontSize: "12px", color: "#888" }}>Equipo:</span>
                  <select style={{ fontSize: "12px", padding: "5px 10px", borderRadius: "6px", border: "0.5px solid #ddd" }} value={filtroTipoEquipo} onChange={e => setFiltroTipoEquipo(e.target.value)}>
                    {tiposEquipo.map(t => <option key={t} value={t}>{t === "Todos" ? "Todos los equipos" : t}</option>)}
                  </select>
                  <span style={{ fontSize: "12px", color: "#888" }}>Periodo:</span>
                  <select style={{ fontSize: "12px", padding: "5px 10px", borderRadius: "6px", border: "0.5px solid #ddd" }} value={filtroMes} onChange={e => setFiltroMes(e.target.value)}>
                    {mesesDisponibles.map(m => <option key={m}>{m}</option>)}
                    <option value="Sin fecha">Sin fecha</option>
                  </select>
                  {filtroMes !== "Todos" && (
                    <button onClick={() => setFiltroMes("Todos")} style={{ fontSize: "10px", padding: "3px 8px", borderRadius: "20px", background: "#1a5fa8", color: "white", border: "none", cursor: "pointer" }}>
                      {filtroMes} X
                    </button>
                  )}
                </div>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                  <thead>
                    <tr style={{ background: "#f8f9fa" }}>
                      {["#", "Código", "Piso", "Ambiente", "Tipo equipo", "Marca/Modelo", "Estado", "Últ. mant.", "Acciones"].map(h => (
                        <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, color: "#444", borderBottom: "0.5px solid #e0e0e0", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {equiposFiltrados.map((equipo, i) => {
                      const abierto = obsAbierto === equipo.id;
                      const obsArr = getObs(equipo);
                      const numObs = obsArr.length;
                      return (
                        <React.Fragment key={equipo.id}>
                          <tr style={{ borderBottom: abierto ? "none" : "0.5px solid #f5f5f5", background: i % 2 === 0 ? "white" : "#f8f9fa" }}>
                            <td style={{ padding: "10px 14px", color: "#888", fontSize: "12px" }}>{i + 1}</td>
                            <td style={{ padding: "10px 14px" }}>
                              {equipo.codigo ? <span style={{ fontSize: "11px", padding: "2px 7px", background: "#f3e5f5", color: "#6a1b9a", borderRadius: "4px", fontFamily: "monospace", fontWeight: 700 }}>{equipo.codigo}</span> : <span style={{ color: "#aaa" }}>-</span>}
                            </td>
                            <td style={{ padding: "10px 14px", fontSize: "13px", fontWeight: 500, color: "#222" }}>{equipo.piso || "-"}</td>
                            <td style={{ padding: "10px 14px", fontSize: "13px", fontWeight: 500, color: "#222" }}>{equipo.ambiente || "-"}</td>
                            <td style={{ padding: "10px 14px", fontSize: "13px", color: "#555" }}>{equipo.tipoEquipo || "-"}</td>
                            <td style={{ padding: "10px 14px", fontSize: "13px", color: "#555" }}>
                              <div style={{ fontWeight: 500, color: "#222" }}>{equipo.marca || "-"}</div>
                              <div style={{ fontSize: "11px", color: "#888" }}>{equipo.modelo}</div>
                            </td>
                            <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>{getBadge(equipo.estado)}</td>
                            <td style={{ padding: "10px 14px" }}>
                              {(() => { const fc = fechaColor(equipo.ultimoMantenimiento); const ma = fechaAMesAnio(equipo.ultimoMantenimiento); return ma ? <span style={{ fontSize: "10px", padding: "2px 7px", borderRadius: "10px", background: fc.bg, color: fc.color, border: `0.5px solid ${fc.border}`, whiteSpace: "nowrap" }}>{ma}</span> : <span style={{ fontSize: "10px", color: "#aaa" }}>—</span>; })()}
                            </td>
                            <td style={{ padding: "10px 14px" }}>
                              <div style={{ display: "flex", gap: "5px" }}>
                                <button style={s.btnInfo} onClick={() => window.open(`/equipo/${equipo.id}?noqr=1`, "_blank")}>Info</button>
                                <button
                                  style={{ fontSize: "11px", padding: "4px 10px", borderRadius: "5px", cursor: "pointer", fontWeight: 500, whiteSpace: "nowrap", border: `0.5px solid ${abierto ? "#ffa726" : "#ddd"}`, background: abierto ? "#e65100" : "#fff8e1", color: abierto ? "white" : "#e65100", opacity: numObs === 0 ? 0.45 : 1 }}
                                  onClick={() => setObsAbierto(abierto ? null : equipo.id)}
                                >
                                  {"Obs "}
                                  <span style={{ background: abierto ? "white" : "#e65100", color: abierto ? "#e65100" : "white", borderRadius: "20px", fontSize: "9px", padding: "1px 5px", fontWeight: 700, marginRight: "3px" }}>{numObs}</span>
                                  {abierto ? "▴" : "▾"}
                                </button>
                                <button style={s.btnProto} onClick={() => navigate(`/protocolo?equipo=${equipo.id}&origen=cliente${sedeActual ? `&sede=${encodeURIComponent(sedeActual.id)}` : ""}`)}>Protocolo</button>
                              </div>
                            </td>
                          </tr>
                          {abierto && (
                            <tr style={{ borderBottom: "0.5px solid #f5f5f5" }}>
                              <td colSpan={9} style={{ padding: "0", background: "white", borderTop: "2px solid #ffa726" }}>
                                <div style={{ padding: "12px 16px" }}>
                                  <div style={{ fontSize: "11px", fontWeight: 500, color: "#e65100", marginBottom: "8px" }}>{numObs} observación{numObs !== 1 ? "es" : ""} — {equipo.codigo || equipo.ambiente}</div>
                                  {numObs === 0 ? (
                                    <div style={{ fontSize: "12px", color: "#aaa", fontStyle: "italic" }}>Sin observaciones registradas</div>
                                  ) : (
                                    <div>
                                      <div style={{ display: "grid", gridTemplateColumns: "28px 1fr 1fr 1fr", gap: "10px", padding: "0 2px 6px", fontSize: "10px", color: "#999", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                                        <span></span><span>Observación</span><span>Causa</span><span>Recomendación</span>
                                      </div>
                                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                        {(() => { const recArr = getRec(equipo); return obsArr.filter(o => o.texto?.trim()).map((o, idx) => (
                                          <div key={idx} style={{ display: "grid", gridTemplateColumns: "28px 1fr 1fr 1fr", gap: "10px", alignItems: "start" }}>
                                            <div style={{ fontSize: "11px", color: "#aaa", paddingTop: "10px", textAlign: "center" }}>{idx + 1}</div>
                                            <div style={{ background: "#fff8e1", border: "0.5px solid #ffe082", borderRadius: "8px", padding: "9px 11px" }}>
                                              <div style={{ fontSize: "12px", color: "#333", lineHeight: 1.4 }}>{o.texto}</div>
                                              {(o.fecha || o.tecnico) && (
                                                <div style={{ fontSize: "10px", color: "#aaa", marginTop: "4px" }}>
                                                  {o.fecha}{o.fecha && o.tecnico ? " · " : ""}{o.tecnico ? o.tecnico : ""}
                                                </div>
                                              )}
                                            </div>
                                            <div style={{ background: "#fef0f0", border: "0.5px solid #f0997b", borderRadius: "8px", padding: "9px 11px", fontSize: "12px", color: "#712b13" }}>{o.causa || "—"}</div>
                                            <div style={{ background: "#e8f5e9", border: "0.5px solid #97c459", borderRadius: "8px", padding: "9px 11px", fontSize: "12px", color: "#27500a" }}>{recArr[idx] ? (typeof recArr[idx] === "string" ? recArr[idx] : recArr[idx].texto || "—") : "—"}</div>
                                          </div>
                                        )); })()}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modal lista de emergencias de una sede (2 o más averías) */}
      {listaEmergenciaSede && (
        <div style={s.modalOverlay} onClick={() => setListaEmergenciaSede(null)}>
          <div style={{ ...s.modalCard, maxWidth: "420px" }} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <i className="ti ti-alert-triangle" style={{ color: "#c62828" }} aria-hidden="true"></i>
                <span style={{ fontSize: "13px", fontWeight: 500, color: "#222" }}>Equipos con emergencia</span>
                <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "20px", background: "#ffebee", color: "#c62828", fontWeight: 700 }}>{listaEmergenciaSede.length}</span>
              </div>
              <button style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer", color: "#888" }} onClick={() => setListaEmergenciaSede(null)}>X</button>
            </div>
            <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: "8px", maxHeight: "60vh", overflowY: "auto" }}>
              {listaEmergenciaSede.map(a => {
                const eq = equipos.find(e => e.id === a.equipoId);
                return (
                  <div
                    key={a.id}
                    onClick={() => abrirDetalleAveria(a)}
                    style={{ border: "0.5px solid #e0e0e0", borderRadius: "8px", padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                  >
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 500, color: "#222" }}>{eq?.tipoEquipo || "Equipo"} — {a.ambiente || eq?.ambiente || "-"}</div>
                      <div style={{ fontSize: "11px", color: "#888", marginTop: "2px" }}>
                        {a.piso ? `Piso ${a.piso}` : ""}{eq?.serie ? ` · Serie ${eq.serie}` : ""}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "11px", color: "#c62828" }}>{a.fecha?.toDate ? a.fecha.toDate().toLocaleString("es-PE") : ""}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal ficha técnica (también usado para detalle de avería/emergencia) */}
      {modalEquipo && (
        <div style={s.modalOverlay} onClick={cerrarModalEquipo}>
          <div style={s.modalCard} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "13px", fontWeight: 500, color: "#222" }}>
                  {modalTipo === "info" ? "Ficha técnica" : "Observaciones"}
                </span>
                {modalEquipo.codigo && <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "20px", background: "#f3e5f5", color: "#6a1b9a", fontFamily: "monospace", fontWeight: 700 }}>{modalEquipo.codigo}</span>}
                <span style={{ fontSize: "11px", padding: "3px 10px", borderRadius: "20px", background: modalEquipo.estado === "Operativo" ? "#e8f5e9" : modalEquipo.estado === "Operativo con observaciones" ? "#fff8e1" : "#ffebee", color: modalEquipo.estado === "Operativo" ? "#2e7d32" : modalEquipo.estado === "Operativo con observaciones" ? "#e65100" : "#c62828", fontWeight: 500 }}>{modalEquipo.estado === "Operativo con observaciones" ? "Con obs." : modalEquipo.estado || "Operativo"}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button style={{ background: "#c62828", color: "white", border: "none", borderRadius: "6px", padding: "4px 10px", fontSize: "11px", cursor: "pointer", fontWeight: 500 }} onClick={() => generarPDFFicha(modalEquipo)}>Descargar PDF</button>
                <button style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer", color: "#888" }} onClick={cerrarModalEquipo}>X</button>
              </div>
            </div>

            <div style={{ overflowY: "auto", maxHeight: "65vh" }}>
              {/* Bloque de emergencia, solo si el modal se abrió desde una avería */}
              {detalleAveria && (
                <div style={{ padding: "14px 20px", background: "#fef0f0", borderBottom: "0.5px solid #f0997b" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                    <i className="ti ti-alert-triangle" style={{ color: "#c62828", fontSize: "15px" }} aria-hidden="true"></i>
                    <span style={{ fontSize: "12px", fontWeight: 600, color: "#c62828" }}>Mensaje de emergencia</span>
                  </div>
                  <div style={{ fontSize: "13px", color: "#333", marginBottom: "6px" }}>{detalleAveria.mensaje}</div>
                  <div style={{ fontSize: "11px", color: "#791f1f", marginBottom: "10px" }}>
                    Reportado por {detalleAveria.tipoReportante || "-"}{detalleAveria.nombreReportante ? ` (${detalleAveria.nombreReportante})` : ""} · {detalleAveria.fecha?.toDate ? detalleAveria.fecha.toDate().toLocaleString("es-PE") : ""}
                  </div>
                  <button
                    style={{ width: "100%", padding: "9px", borderRadius: "8px", border: "none", background: "#c62828", color: "white", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
                    onClick={() => marcarAveriaAtendida(detalleAveria.id)}
                  >
                    Marcar como atendida
                  </button>
                  <div style={{ fontSize: "10px", color: "#a32d2d", textAlign: "center", marginTop: "6px" }}>
                    No se elimina: queda en el historial del equipo y deja de contar como emergencia activa.
                  </div>
                </div>
              )}

              {modalTipo === "info" ? (
                <>
                  <div style={s.modalSec}>
                    <div style={s.modalSecTitulo}>Datos del equipo</div>
                    <div style={s.grid3}>
                      <div style={s.campo}><span style={s.campoLabel}>Cliente</span><span style={s.campoVal}>{modalEquipo.cliente || "-"}</span></div>
                      <div style={s.campo}><span style={s.campoLabel}>Sede</span><span style={modalEquipo.sede ? s.campoVal : s.campoVacio}>{modalEquipo.sede || "Sin sede"}</span></div>
                      <div style={s.campo}><span style={s.campoLabel}>Piso</span><span style={s.campoVal}>{modalEquipo.piso || "-"}</span></div>
                      <div style={s.campo}><span style={s.campoLabel}>Ambiente</span><span style={s.campoVal}>{modalEquipo.ambiente || "-"}</span></div>
                      <div style={s.campo}><span style={s.campoLabel}>Marca</span><span style={modalEquipo.marca ? s.campoVal : s.campoVacio}>{modalEquipo.marca || "Sin registrar"}</span></div>
                      <div style={s.campo}><span style={s.campoLabel}>Modelo</span><span style={modalEquipo.modelo ? s.campoVal : s.campoVacio}>{modalEquipo.modelo || "Sin registrar"}</span></div>
                      <div style={s.campo}><span style={s.campoLabel}>N° de Serie</span><span style={modalEquipo.serie ? s.campoVal : s.campoVacio}>{modalEquipo.serie || "Sin registrar"}</span></div>
                      <div style={s.campo}><span style={s.campoLabel}>Capacidad</span><span style={modalEquipo.capacidad ? s.campoVal : s.campoVacio}>{modalEquipo.capacidad ? `${modalEquipo.capacidad} ${GRUPO_POR_TIPO_PDF[modalEquipo.tipoEquipo] === "ventilacion" ? "CFM" : "BTU"}` : "Sin registrar"}</span></div>
                    </div>
                    <div style={{ ...s.grid3, marginTop: "10px" }}>
                      {GRUPO_POR_TIPO_PDF[modalEquipo.tipoEquipo] !== "ventilacion" && (
                        <div style={s.campo}><span style={s.campoLabel}>Refrigerante</span><span style={modalEquipo.tipoRefrigerante ? s.campoVal : s.campoVacio}>{modalEquipo.tipoRefrigerante || "Sin registrar"}</span></div>
                      )}
                      <div style={s.campo}><span style={s.campoLabel}>Voltaje de placa</span><span style={modalEquipo.voltaje ? s.campoVal : s.campoVacio}>{modalEquipo.voltaje ? `${modalEquipo.voltaje}V` : "Sin registrar"}</span></div>
                      <div style={s.campo}><span style={s.campoLabel}>Amperaje nominal</span><span style={modalEquipo.amperaje ? s.campoVal : s.campoVacio}>{modalEquipo.amperaje ? `${modalEquipo.amperaje}A` : "Sin registrar"}</span></div>
                      <div style={s.campo}><span style={s.campoLabel}>Fases</span><span style={s.campoVal}>{modalEquipo.fases || "Monofásico"}</span></div>
                      {modalEquipo.condVoltaje && <div style={s.campo}><span style={s.campoLabel}>Voltaje cond.</span><span style={s.campoVal}>{modalEquipo.condVoltaje}V</span></div>}
                      {modalEquipo.condAmperaje && <div style={s.campo}><span style={s.campoLabel}>Amperaje cond.</span><span style={s.campoVal}>{modalEquipo.condAmperaje}A</span></div>}
                      {modalEquipo.modeloCompresor && <div style={s.campo}><span style={s.campoLabel}>Modelo compresor</span><span style={s.campoVal}>{modalEquipo.modeloCompresor}</span></div>}
                    </div>
                    {(modalEquipo.contrato || modalEquipo.modeloFaja || modalEquipo.numFajas || modalEquipo.marcaMotor || modalEquipo.modeloMotor || modalEquipo.serieMotor) && (
                      <div style={{ ...s.grid3, marginTop: "10px" }}>
                        {modalEquipo.contrato && <div style={s.campo}><span style={s.campoLabel}>Contrato</span><span style={s.campoVal}>{modalEquipo.contrato}</span></div>}
                        {modalEquipo.modeloFaja && <div style={s.campo}><span style={s.campoLabel}>Modelo de faja</span><span style={s.campoVal}>{modalEquipo.modeloFaja}</span></div>}
                        {modalEquipo.numFajas && <div style={s.campo}><span style={s.campoLabel}>N° de fajas</span><span style={s.campoVal}>{modalEquipo.numFajas}</span></div>}
                        {modalEquipo.marcaMotor && <div style={s.campo}><span style={s.campoLabel}>Marca motor</span><span style={s.campoVal}>{modalEquipo.marcaMotor}</span></div>}
                        {modalEquipo.modeloMotor && <div style={s.campo}><span style={s.campoLabel}>Modelo motor</span><span style={s.campoVal}>{modalEquipo.modeloMotor}</span></div>}
                        {modalEquipo.serieMotor && <div style={s.campo}><span style={s.campoLabel}>N° serie motor</span><span style={s.campoVal}>{modalEquipo.serieMotor}</span></div>}
                      </div>
                    )}
                  </div>

                  <div style={s.modalSec}>
                    <div style={s.modalSecTitulo}>Mantenimiento</div>
                    <div style={s.grid2}>
                      <div style={s.campo}><span style={s.campoLabel}>Estado</span><span style={{ fontSize: "13px", fontWeight: 500, color: modalEquipo.estado === "Operativo" ? "#2e7d32" : modalEquipo.estado === "Operativo con observaciones" ? "#e65100" : "#c62828" }}>{modalEquipo.estado || "Operativo"}</span></div>
                      <div style={s.campo}><span style={s.campoLabel}>Último mantenimiento</span><span style={modalEquipo.ultimoMantenimiento ? s.campoVal : s.campoVacio}>{modalEquipo.ultimoMantenimiento || "Sin registro"}</span></div>
                      <div style={s.campo}><span style={s.campoLabel}>Fecha de registro</span><span style={s.campoVal}>{modalEquipo.fechaRegistro || "-"}</span></div>
                    </div>
                  </div>

                  {modalEquipo.cronograma && modalEquipo.cronograma.length > 0 && (
                    <div style={s.modalSec}>
                      <div style={s.modalSecTitulo}>Cronograma de mantenimiento</div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "8px" }}>
                        {modalEquipo.cronograma.map((trim, i) => {
                          const col = getCronColor(trim.estado);
                          return (
                            <div key={i} style={{ background: col.bg, border: `0.5px solid ${col.border}`, borderRadius: "8px", padding: "8px", textAlign: "center" }}>
                              <div style={{ fontSize: "10px", color: col.color, fontWeight: 500, marginBottom: "4px" }}>{trim.label}</div>
                              <div style={{ fontSize: "11px", color: col.color }}>{trim.fecha || "-"}</div>
                              <div style={{ fontSize: "10px", color: col.color, marginTop: "3px" }}>{col.label}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div style={s.modalSec}>
                    <div style={{ ...s.modalSecTitulo, display: "flex", alignItems: "center", gap: "8px" }}>
                      Observación · Causa · Recomendación
                      {modalEquipo.ultimoProtocolo && (
                        <span style={{ fontSize: "9px", padding: "1px 6px", borderRadius: "20px", background: "#e8f5e9", color: "#2e7d32", border: "0.5px solid #a5d6a7" }}>
                          {modalEquipo.ultimoProtocolo}
                        </span>
                      )}
                    </div>
                    {getObs(modalEquipo).length > 0 ? (
                      <>
                        <div style={{ display: "grid", gridTemplateColumns: "20px 1fr 1fr 1fr", gap: "6px", marginBottom: "4px" }}>
                          <span></span>
                          <span style={{ fontSize: "8px", color: "#aaa", textTransform: "uppercase", letterSpacing: "0.05em" }}>Observación</span>
                          <span style={{ fontSize: "8px", color: "#aaa", textTransform: "uppercase", letterSpacing: "0.05em" }}>Causa</span>
                          <span style={{ fontSize: "8px", color: "#aaa", textTransform: "uppercase", letterSpacing: "0.05em" }}>Recomendación</span>
                        </div>
                        {getObs(modalEquipo).map((o, i) => {
                          const recs = getRec(modalEquipo);
                          return (
                            <div key={i} style={{ display: "grid", gridTemplateColumns: "20px 1fr 1fr 1fr", gap: "6px", marginBottom: "7px", alignItems: "start" }}>
                              <div style={{ fontSize: "10px", color: "#aaa", fontWeight: 700, paddingTop: "8px", textAlign: "center" }}>{i + 1}</div>
                              <div>
                                <div style={{ fontSize: "11px", color: "#e65100", background: "#fff8e1", padding: "6px 8px", borderRadius: "6px", border: "0.5px solid #ffa726" }}>{o.texto}</div>
                                {(o.fecha || o.tecnico) && <div style={{ fontSize: "9px", color: "#aaa", marginTop: "2px" }}>{o.fecha}{o.fecha && o.tecnico ? " · " : ""}{o.tecnico ? "Téc: " + o.tecnico : ""}</div>}
                              </div>
                              <div style={{ fontSize: "11px", color: "#c62828", background: "#fef0f0", padding: "6px 8px", borderRadius: "6px", border: "0.5px solid #ef9a9a" }}>{o.causa || "—"}</div>
                              <div style={{ fontSize: "11px", color: "#2e7d32", background: "#e8f5e9", padding: "6px 8px", borderRadius: "6px", border: "0.5px solid #66bb6a" }}>
                                {recs[i] ? (typeof recs[i] === "string" ? recs[i] : recs[i].texto || "—") : "—"}
                              </div>
                            </div>
                          );
                        })}
                      </>
                    ) : <div style={s.vaciomsg}>Sin observaciones registradas</div>}
                  </div>

                  <div style={{ ...s.modalSec, borderBottom: "none" }}>
                    <div style={s.modalSecTitulo}>Correctivos realizados</div>
                    {getCor(modalEquipo).length > 0 ? getCor(modalEquipo).map((c, i) => (
                      <div key={i} style={s.corItem}>
                        <span>{c.descripcion}</span>
                        {c.fecha && <span style={{ fontSize: "11px", color: "#888", flexShrink: 0, marginLeft: "10px" }}>{c.fecha}</span>}
                      </div>
                    )) : <div style={s.vaciomsg}>Sin correctivos registrados</div>}
                  </div>
                </>
              ) : (
                <div style={s.modalSec}>
                  <div style={s.modalSecTitulo}>Observaciones — {modalEquipo.codigo || modalEquipo.ambiente}</div>
                  {getObs(modalEquipo).length > 0 ? getObs(modalEquipo).map((o, i) => (
                    <div key={i} style={s.obsItem}>
                      <div>{o.texto}</div>
                      {(o.fecha||o.tecnico)&&<div style={{fontSize:"10px",color:"#888",marginTop:"3px"}}>{o.fecha}{o.fecha&&o.tecnico?" · ":""}{o.tecnico?"Técnico: "+o.tecnico:""}</div>}
                    </div>
                  )) : <div style={s.vaciomsg}>Sin observaciones registradas</div>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  page: { minHeight: "100vh", background: "#f0f4f8", fontFamily: "Inter, Arial, sans-serif" },
  navbar: { background: "white", borderBottom: "0.5px solid #e0e0e0", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10 },
  navLeft: { display: "flex", alignItems: "center", gap: "12px" },
  logo: { fontFamily: "'Arial Black', sans-serif", fontWeight: 900, fontSize: "20px", display: "flex", alignItems: "baseline", letterSpacing: "1px" },
  divider: { width: "1px", height: "18px", background: "#e0e0e0" },
  btnBack: { background: "none", border: "none", color: "#1a5fa8", cursor: "pointer", fontSize: "13px", fontWeight: 500, padding: 0 },
  navTitle: { fontSize: "13px", color: "#555", fontWeight: 500 },
  navEmpresa: { fontSize: "14px", fontWeight: 500, color: "#222" },
  btnSalir: { background: "#c62828", color: "white", border: "none", borderRadius: "8px", padding: "6px 14px", cursor: "pointer", fontSize: "12px", fontWeight: 500 },
  btnExcel: { fontSize: "12px", padding: "5px 12px", background: "#1e7e34", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: 500 },
  btnPdf: { fontSize: "12px", padding: "5px 12px", background: "#c62828", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: 500 },
  content: { maxWidth: "1200px", margin: "0 auto", padding: "20px 24px" },
  sedesGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" },
  sedeCard: { background: "white", border: "0.5px solid #e0e0e0", borderRadius: "12px", overflow: "hidden" },
  sedeHeader: { padding: "12px 14px", borderBottom: "0.5px solid #f0f0f0", display: "flex", alignItems: "center", gap: "10px" },
  sedeIcon: { width: "32px", height: "32px", borderRadius: "8px", background: "#e8f0fe", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" },
  sedeNombre: { fontSize: "13px", fontWeight: 500, color: "#222" },
  sedeDireccion: { fontSize: "11px", color: "#888", marginTop: "2px" },
  miniStats: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "6px", padding: "10px 14px" },
  mini: { textAlign: "center", padding: "6px", borderRadius: "8px" },
  miniNum: { fontSize: "16px", fontWeight: 500 },
  miniLabel: { fontSize: "10px", marginTop: "1px" },
  barraWrap: { padding: "0 14px 10px" },
  barra: { display: "flex", height: "5px", borderRadius: "3px", overflow: "hidden", background: "#f0f0f0" },
  btnVerSede: { width: "100%", padding: "10px", border: "none", borderTop: "0.5px solid #f0f0f0", cursor: "pointer", fontSize: "13px", fontWeight: 500, background: "white", color: "#1a5fa8" },
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "12px", marginBottom: "16px" },
  barrasCard: { background: "white", border: "0.5px solid #e0e0e0", borderRadius: "12px", padding: "14px 16px", marginBottom: "16px" },
  tablaCard: { background: "white", border: "0.5px solid #e0e0e0", borderRadius: "12px", overflow: "hidden" },
  tablaHeader: { padding: "12px 16px", borderBottom: "0.5px solid #f0f0f0", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" },
  btnInfo: { fontSize: "11px", padding: "4px 10px", background: "#1a5fa8", color: "white", border: "none", borderRadius: "5px", cursor: "pointer", fontWeight: 500 },
  btnProto: { fontSize: "11px", padding: "4px 10px", background: "#c62828", color: "white", border: "none", borderRadius: "5px", cursor: "pointer", fontWeight: 500, whiteSpace: "nowrap" },
  btnObs: { fontSize: "11px", padding: "4px 10px", background: "#fff8e1", color: "#e65100", border: "0.5px solid #ffe082", borderRadius: "5px", cursor: "pointer", fontWeight: 500 },
  modalOverlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "20px" },
  modalCard: { background: "white", borderRadius: "12px", width: "100%", maxWidth: "520px", boxShadow: "0 8px 32px rgba(0,0,0,0.15)", overflow: "hidden" },
  modalHeader: { padding: "14px 20px", borderBottom: "0.5px solid #e0e0e0", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8f9fa" },
  modalSec: { padding: "14px 20px", borderBottom: "0.5px solid #f0f0f0" },
  modalSecTitulo: { fontSize: "10px", color: "#888", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 500, marginBottom: "12px" },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" },
  grid3: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" },
  campo: { display: "flex", flexDirection: "column", gap: "3px" },
  campoLabel: { fontSize: "10px", color: "#888", textTransform: "uppercase", letterSpacing: "0.05em" },
  campoVal: { fontSize: "13px", fontWeight: 500, color: "#222" },
  campoVacio: { fontSize: "13px", color: "#aaa", fontStyle: "italic", fontWeight: 400 },
  obsItem: { background: "#fff8e1", borderLeft: "3px solid #ffa726", borderRadius: "0 8px 8px 0", padding: "7px 12px", fontSize: "12px", color: "#555", marginBottom: "6px" },
  recItem: { background: "#e8f5e9", borderLeft: "3px solid #43a047", borderRadius: "0 8px 8px 0", padding: "7px 12px", fontSize: "12px", color: "#555", marginBottom: "6px" },
  corItem: { background: "#f0f4f8", borderLeft: "3px solid #1a5fa8", borderRadius: "0 8px 8px 0", padding: "7px 12px", fontSize: "12px", color: "#555", marginBottom: "6px", display: "flex", justifyContent: "space-between", alignItems: "center" },
  vaciomsg: { fontSize: "12px", color: "#aaa", fontStyle: "italic", textAlign: "center", padding: "6px 0" },
  vacio: { textAlign: "center", padding: "3rem", background: "white", borderRadius: "12px", color: "#888", border: "0.5px solid #e0e0e0" },
  centro: { textAlign: "center", padding: "3rem", fontSize: "16px", color: "#888" },
};
