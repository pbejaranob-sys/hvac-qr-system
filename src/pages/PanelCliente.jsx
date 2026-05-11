import React, { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf";

const ordenarPisos = (a, b) => {
  const orden = ["sotano", "sótano", "subsuelo", "ss"];
  const aLow = a.toLowerCase(); const bLow = b.toLowerCase();
  if (orden.includes(aLow)) return -1; if (orden.includes(bLow)) return 1;
  const aNum = parseInt(a); const bNum = parseInt(b);
  if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
  return a.localeCompare(b);
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

const exportarPDF = (cliente, equipos) => {
  const pdf = new jsPDF("l", "mm", "a4"); const M = 10; let y = 15;
  pdf.setFillColor(26, 115, 232); pdf.rect(0, 0, 297, 20, "F");
  pdf.setFontSize(13); pdf.setFont("helvetica", "bold"); pdf.setTextColor(255, 255, 255);
  pdf.text("HVAC - Sistema de Mantenimiento", M, 13);
  pdf.setFontSize(10); pdf.setFont("helvetica", "normal");
  pdf.text(`Cliente: ${cliente}   Generado: ${new Date().toLocaleDateString("es-PE")}   Total: ${equipos.length} equipos`, M, 19);
  y = 28;
  const cols = [8, 14, 14, 20, 16, 14, 16, 16, 13, 11, 11, 22, 42];
  const headers = ["#", "Codigo", "Piso", "Ambiente", "Tipo", "Marca", "Modelo", "Serie", "Cap.", "Refrig.", "Volt.", "Estado", "Obs."];
  const drawH = () => {
    pdf.setFillColor(21, 101, 192); pdf.rect(M, y - 4, 277, 8, "F");
    pdf.setFontSize(7.5); pdf.setFont("helvetica", "bold"); pdf.setTextColor(255, 255, 255);
    let x = M; headers.forEach((h, i) => { pdf.text(h, x + 1, y + 1); x += cols[i]; }); y += 7;
  };
  drawH();
  const porPiso = agruparPorPiso(equipos); let item = 1;
  Object.keys(porPiso).sort(ordenarPisos).forEach(p => {
    if (y > 185) { pdf.addPage(); y = 15; drawH(); }
    pdf.setFillColor(187, 222, 251); pdf.rect(M, y - 3, 277, 7, "F");
    pdf.setFontSize(8); pdf.setFont("helvetica", "bold"); pdf.setTextColor(13, 71, 161);
    pdf.text(`PISO: ${p.toUpperCase()}`, M + 2, y + 2); y += 7;
    porPiso[p].forEach((e, idx) => {
      if (y > 185) { pdf.addPage(); y = 15; drawH(); }
      if (idx % 2 === 0) { pdf.setFillColor(248, 249, 250); pdf.rect(M, y - 3, 277, 7, "F"); }
      const fila = [String(item++), e.codigo || "-", e.piso || "-", e.ambiente || "-", e.tipoEquipo || "-", e.marca || "-", e.modelo || "-", e.serie || "-", e.capacidad || "-", e.tipoRefrigerante || "-", e.voltaje ? `${e.voltaje}V` : "-", e.estado || "Operativo", e.observaciones || "-"];
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(7); let x = M;
      fila.forEach((val, i) => {
        if (i === 11) { if (val === "Operativo") pdf.setTextColor(27, 94, 32); else if (val === "Operativo con observaciones") pdf.setTextColor(230, 81, 0); else pdf.setTextColor(183, 28, 28); }
        else if (i === 1) pdf.setTextColor(106, 27, 154); else pdf.setTextColor(50, 50, 50);
        pdf.text(pdf.splitTextToSize(val, cols[i] - 2)[0], x + 1, y + 2); x += cols[i];
      });
      pdf.setDrawColor(220, 220, 220); pdf.line(M, y + 4, M + 277, y + 4); y += 7;
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
  const [filtroPiso, setFiltroPiso] = useState("Todos");
  const [modalEquipo, setModalEquipo] = useState(null);
  const [modalTipo, setModalTipo] = useState(null); // "info"
  const [obsAbierto, setObsAbierto] = useState(null);
  const [vistaActual, setVistaActual] = useState("sedes"); // "sedes" | "equipos"
  const [sedeActual, setSedeActual] = useState(null);
  const navigate = useNavigate();

useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { navigate("/"); return; }
      try {
        // Buscar datos del usuario por UID primero, luego por email
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

          // Cargar equipos del cliente
          const eSnap = await getDocs(query(collection(db, "equipos"), where("cliente", "==", empresa)));
          const lista = eSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          setEquipos(lista);

          // Cargar sedes del cliente
          try {
            const sSnap = await getDocs(query(collection(db, "sedes"), where("cliente", "==", empresa)));
            const listaSedes = sSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            setSedes(listaSedes);
            if (listaSedes.length === 0) setVistaActual("equipos");
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

  const getObs = (e) => {
    const arr = e.observacionesArray || [];
    const norm = arr.map(o => typeof o === "string" ? { texto: o, fecha: "", tecnico: "" } : o);
    const filtradas = norm.filter(o => o?.texto?.trim());
    if (filtradas.length > 0) return filtradas;
    return e.observaciones?.split(/\n|;/).map(o => ({ texto: o.trim(), fecha: "", tecnico: "" })).filter(o => o.texto) || [];
  };

  const getRec = (e) => e.recomendacionesArray?.filter(Boolean) ||
    e.recomendaciones?.split(/\n|;/).map(r => r.trim()).filter(Boolean) || [];

  const getCor = (e) => e.correctivosArray?.filter(c => c.descripcion) || [];

  const equiposMostrados = sedeActual
    ? equipos.filter(e => e.sede === sedeActual.nombre)
    : equipos;

  const equiposFiltrados = equiposMostrados.filter(e => {
    const okE = filtroEstado === "Todos" || e.estado === filtroEstado;
    const okP = filtroPiso === "Todos" || (e.piso || "Sin piso") === filtroPiso;
    return okE && okP;
  });

  const tot = equiposMostrados.length;
  const op = equiposMostrados.filter(e => e.estado === "Operativo").length;
  const obs = equiposMostrados.filter(e => e.estado === "Operativo con observaciones").length;
  const fs = equiposMostrados.filter(e => e.estado === "Fuera de servicio").length;
  const pisos = ["Todos", ...new Set(equiposMostrados.map(e => e.piso).filter(Boolean))];

  const getBadge = (estado) => {
    const map = { "Operativo": { bg: "#e8f5e9", color: "#2e7d32" }, "Operativo con observaciones": { bg: "#fff8e1", color: "#e65100" }, "Fuera de servicio": { bg: "#ffebee", color: "#c62828" } };
    const st = map[estado] || map["Operativo"];
    return <span style={{ fontSize: "11px", padding: "3px 10px", background: st.bg, color: st.color, borderRadius: "20px", fontWeight: 500 }}>{estado === "Operativo con observaciones" ? "Con obs." : estado || "Operativo"}</span>;
  };

  const getCronColor = (estado) => ({
    realizado: { bg: "#e8f5e9", border: "#a5d6a7", color: "#2e7d32", label: "✅ Realizado" },
    pendiente: { bg: "#fff8e1", border: "#ffe082", color: "#e65100", label: "⏳ Pendiente" },
    programado: { bg: "#f5f5f5", border: "#e0e0e0", color: "#888", label: "📆 Programado" },
  }[estado] || { bg: "#f5f5f5", border: "#e0e0e0", color: "#888", label: "📆 Programado" });

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
              <span style={s.navTitle}>🏢 {sedeActual.nombre}</span>
            </>
          ) : (
            <span style={s.navEmpresa}>{usuario?.empresa}</span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {vistaActual === "equipos" && (
            <>
              <button style={s.btnExcel} onClick={() => exportarExcel(usuario?.empresa, equiposMostrados)}>
                <i className="ti ti-file-spreadsheet" aria-hidden="true"></i> Excel
              </button>
              <button style={s.btnPdf} onClick={() => exportarPDF(usuario?.empresa, equiposMostrados)}>
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
              return (
                <div key={sede.id} style={s.sedeCard}>
                  <div style={s.sedeHeader}>
                    <div style={s.sedeIcon}>🏢</div>
                    <div>
                      <div style={s.sedeNombre}>{sede.nombre}</div>
                      <div style={s.sedeDireccion}>{sede.direccion}</div>
                    </div>
                  </div>
                  <div style={s.miniStats}>
                    <div style={{ ...s.mini, background: "#e8f5e9" }}><div style={{ ...s.miniNum, color: "#2e7d32" }}>{opS}</div><div style={{ ...s.miniLabel, color: "#2e7d32" }}>Operativo</div></div>
                    <div style={{ ...s.mini, background: "#fff8e1" }}><div style={{ ...s.miniNum, color: "#e65100" }}>{obsS}</div><div style={{ ...s.miniLabel, color: "#e65100" }}>Con obs.</div></div>
                    <div style={{ ...s.mini, background: fsS > 0 ? "#ffebee" : "#f5f5f5" }}><div style={{ ...s.miniNum, color: fsS > 0 ? "#c62828" : "#aaa" }}>{fsS}</div><div style={{ ...s.miniLabel, color: fsS > 0 ? "#c62828" : "#aaa" }}>Fuera serv.</div></div>
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
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "12px", color: "#888" }}>Piso:</span>
                  <select style={{ fontSize: "12px", padding: "5px 10px", borderRadius: "6px", border: "0.5px solid #ddd" }} value={filtroPiso} onChange={e => setFiltroPiso(e.target.value)}>
                    {pisos.map(p => <option key={p} value={p}>{p === "Todos" ? "Todos los pisos" : `Piso ${p}`}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                  <thead>
                    <tr style={{ background: "#f8f9fa" }}>
                      {["#", "Código", "Piso", "Ambiente", "Tipo equipo", "Marca/Modelo", "Estado", "Acciones"].map(h => (
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
                            <td style={{ padding: "10px 14px" }}>{getBadge(equipo.estado)}</td>
                            <td style={{ padding: "10px 14px" }}>
                              <div style={{ display: "flex", gap: "5px" }}>
                                <button style={s.btnInfo} onClick={() => { setModalEquipo(equipo); setModalTipo("info"); }}>Info</button>
                                <button
                                  style={{ fontSize: "11px", padding: "4px 10px", borderRadius: "5px", cursor: "pointer", fontWeight: 500, whiteSpace: "nowrap", border: `0.5px solid ${abierto ? "#ffa726" : "#ddd"}`, background: abierto ? "#e65100" : "#fff8e1", color: abierto ? "white" : "#e65100", opacity: numObs === 0 ? 0.45 : 1 }}
                                  onClick={() => setObsAbierto(abierto ? null : equipo.id)}
                                >
                                  {"Obs "}
                                  <span style={{ background: abierto ? "white" : "#e65100", color: abierto ? "#e65100" : "white", borderRadius: "20px", fontSize: "9px", padding: "1px 5px", fontWeight: 700, marginRight: "3px" }}>{numObs}</span>
                                  {abierto ? "▴" : "▾"}
                                </button>
                              </div>
                            </td>
                          </tr>
                          {abierto && (
                            <tr style={{ borderBottom: "0.5px solid #f5f5f5" }}>
                              <td colSpan={8} style={{ padding: "0", background: "#fffdf5", borderTop: "2px solid #ffa726" }}>
                                <div style={{ padding: "12px 16px" }}>
                                  <div style={{ fontSize: "11px", fontWeight: 500, color: "#e65100", marginBottom: "8px" }}>⚠️ {numObs} observación{numObs !== 1 ? "es" : ""} — {equipo.codigo || equipo.ambiente}</div>
                                  {numObs === 0 ? (
                                    <div style={{ fontSize: "12px", color: "#aaa", fontStyle: "italic" }}>Sin observaciones registradas</div>
                                  ) : (
                                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                      {obsArr.filter(o => o.texto?.trim()).map((o, idx) => (
                                        <div key={idx} style={{ background: "white", border: "0.5px solid #ffe082", borderLeft: "3px solid #ffa726", borderRadius: "8px", padding: "8px 12px" }}>
                                          <div style={{ fontSize: "12px", color: "#333", lineHeight: 1.5 }}>{o.texto}</div>
                                          <div style={{ fontSize: "10px", color: "#888", marginTop: "3px" }}>
                                            {o.fecha && <span>{o.fecha}</span>}
                                            {o.fecha && o.tecnico && <span> · </span>}
                                            {o.tecnico && <span>Técnico: {o.tecnico}</span>}
                                          </div>
                                        </div>
                                      ))}
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

      {/* Modal ficha técnica o observaciones */}
      {modalEquipo && (
        <div style={s.modalOverlay} onClick={() => setModalEquipo(null)}>
          <div style={s.modalCard} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "13px", fontWeight: 500, color: "#222" }}>
                  {modalTipo === "info" ? "📋 Ficha técnica" : "⚠️ Observaciones"}
                </span>
                {modalEquipo.codigo && <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "20px", background: "#f3e5f5", color: "#6a1b9a", fontFamily: "monospace", fontWeight: 700 }}>{modalEquipo.codigo}</span>}
                <span style={{ fontSize: "11px", padding: "3px 10px", borderRadius: "20px", background: modalEquipo.estado === "Operativo" ? "#e8f5e9" : modalEquipo.estado === "Operativo con observaciones" ? "#fff8e1" : "#ffebee", color: modalEquipo.estado === "Operativo" ? "#2e7d32" : modalEquipo.estado === "Operativo con observaciones" ? "#e65100" : "#c62828", fontWeight: 500 }}>{modalEquipo.estado === "Operativo con observaciones" ? "Con obs." : modalEquipo.estado || "Operativo"}</span>
              </div>
              <button style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer", color: "#888" }} onClick={() => setModalEquipo(null)}>✕</button>
            </div>

            <div style={{ overflowY: "auto", maxHeight: "65vh" }}>
              {modalTipo === "info" ? (
                <>
                  {/* Ubicación */}
                  <div style={s.modalSec}>
                    <div style={s.modalSecTitulo}>📍 Ubicación</div>
                    <div style={s.grid3}>
                      <div style={s.campo}><span style={s.campoLabel}>Cliente</span><span style={s.campoVal}>{modalEquipo.cliente || "-"}</span></div>
                      <div style={s.campo}><span style={s.campoLabel}>Sede</span><span style={modalEquipo.sede ? s.campoVal : s.campoVacio}>{modalEquipo.sede || "Sin sede"}</span></div>
                      <div style={s.campo}><span style={s.campoLabel}>Piso</span><span style={s.campoVal}>{modalEquipo.piso || "-"}</span></div>
                    </div>
                    <div style={{ marginTop: "10px" }}>
                      <div style={s.campo}><span style={s.campoLabel}>Ambiente</span><span style={s.campoVal}>{modalEquipo.ambiente || "-"}</span></div>
                    </div>
                  </div>

                  {/* Ficha técnica */}
                  <div style={s.modalSec}>
                    <div style={s.modalSecTitulo}>📋 Ficha técnica</div>
                    <div style={s.grid2}>
                      <div style={s.campo}><span style={s.campoLabel}>Tipo de equipo</span><span style={modalEquipo.tipoEquipo ? s.campoVal : s.campoVacio}>{modalEquipo.tipoEquipo || "Sin registrar"}</span></div>
                      <div style={s.campo}><span style={s.campoLabel}>Marca</span><span style={modalEquipo.marca ? s.campoVal : s.campoVacio}>{modalEquipo.marca || "Sin registrar"}</span></div>
                      <div style={s.campo}><span style={s.campoLabel}>Modelo</span><span style={modalEquipo.modelo ? s.campoVal : s.campoVacio}>{modalEquipo.modelo || "Sin registrar"}</span></div>
                      <div style={s.campo}><span style={s.campoLabel}>N° de Serie</span><span style={modalEquipo.serie ? s.campoVal : s.campoVacio}>{modalEquipo.serie || "Sin registrar"}</span></div>
                      <div style={s.campo}><span style={s.campoLabel}>Capacidad</span><span style={modalEquipo.capacidad ? s.campoVal : s.campoVacio}>{modalEquipo.capacidad ? `${modalEquipo.capacidad} BTU` : "Sin registrar"}</span></div>
                      <div style={s.campo}><span style={s.campoLabel}>Refrigerante</span><span style={modalEquipo.tipoRefrigerante ? s.campoVal : s.campoVacio}>{modalEquipo.tipoRefrigerante || "Sin registrar"}</span></div>
                    </div>
                  </div>

                  {/* Eléctricos */}
                  <div style={s.modalSec}>
                    <div style={s.modalSecTitulo}>⚡ Datos eléctricos</div>
                    <div style={s.grid3}>
                      <div style={s.campo}><span style={s.campoLabel}>Voltaje</span><span style={modalEquipo.voltaje ? s.campoVal : s.campoVacio}>{modalEquipo.voltaje ? `${modalEquipo.voltaje}V` : "Sin registrar"}</span></div>
                      <div style={s.campo}><span style={s.campoLabel}>Amperaje</span><span style={modalEquipo.amperaje ? s.campoVal : s.campoVacio}>{modalEquipo.amperaje ? `${modalEquipo.amperaje}A` : "Sin registrar"}</span></div>
                      <div style={s.campo}><span style={s.campoLabel}>Fases</span><span style={s.campoVal}>{modalEquipo.fases || "Monofásico"}</span></div>
                    </div>
                  </div>

                  {/* Mantenimiento */}
                  <div style={s.modalSec}>
                    <div style={s.modalSecTitulo}>🔧 Mantenimiento</div>
                    <div style={s.grid2}>
                      <div style={s.campo}><span style={s.campoLabel}>Estado</span><span style={{ fontSize: "13px", fontWeight: 500, color: modalEquipo.estado === "Operativo" ? "#2e7d32" : modalEquipo.estado === "Operativo con observaciones" ? "#e65100" : "#c62828" }}>{modalEquipo.estado || "Operativo"}</span></div>
                      <div style={s.campo}><span style={s.campoLabel}>Último mantenimiento</span><span style={modalEquipo.ultimoMantenimiento ? s.campoVal : s.campoVacio}>{modalEquipo.ultimoMantenimiento || "Sin registro"}</span></div>
                      <div style={s.campo}><span style={s.campoLabel}>Fecha de registro</span><span style={s.campoVal}>{modalEquipo.fechaRegistro || "-"}</span></div>
                    </div>
                  </div>

                  {/* Cronograma */}
                  {modalEquipo.cronograma && modalEquipo.cronograma.length > 0 && (
                    <div style={s.modalSec}>
                      <div style={s.modalSecTitulo}>📅 Cronograma de mantenimiento</div>
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

                  {/* Observaciones */}
                  <div style={s.modalSec}>
                    <div style={s.modalSecTitulo}>⚠️ Observaciones</div>
                    {getObs(modalEquipo).length > 0 ? getObs(modalEquipo).map((o, i) => (
                      <div key={i} style={s.obsItem}>
                        <div>{o.texto}</div>
                        {(o.fecha||o.tecnico)&&<div style={{fontSize:"10px",color:"#888",marginTop:"3px"}}>{o.fecha}{o.fecha&&o.tecnico?" · ":""}{o.tecnico?"Técnico: "+o.tecnico:""}</div>}
                      </div>
                    )) : <div style={s.vaciomsg}>Sin observaciones registradas</div>}
                  </div>

                  {/* Correctivos */}
                  <div style={s.modalSec}>
                    <div style={s.modalSecTitulo}>🔧 Correctivos realizados</div>
                    {getCor(modalEquipo).length > 0 ? getCor(modalEquipo).map((c, i) => (
                      <div key={i} style={s.corItem}>
                        <span>{c.descripcion}</span>
                        {c.fecha && <span style={{ fontSize: "11px", color: "#888", flexShrink: 0, marginLeft: "10px" }}>{c.fecha}</span>}
                      </div>
                    )) : <div style={s.vaciomsg}>Sin correctivos registrados</div>}
                  </div>

                  {/* Recomendaciones */}
                  <div style={{ ...s.modalSec, borderBottom: "none" }}>
                    <div style={s.modalSecTitulo}>💡 Recomendaciones</div>
                    {getRec(modalEquipo).length > 0 ? getRec(modalEquipo).map((r, i) => (
                      <div key={i} style={s.recItem}>{r}</div>
                    )) : <div style={s.vaciomsg}>Sin recomendaciones registradas</div>}
                  </div>
                </>
              ) : (
                <div style={s.modalSec}>
                  <div style={s.modalSecTitulo}>⚠️ Observaciones — {modalEquipo.codigo || modalEquipo.ambiente}</div>
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
  miniStats: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "6px", padding: "10px 14px" },
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