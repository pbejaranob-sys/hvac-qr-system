import React, { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf";

const getBadgeStyle = (estado) => {
  if (estado === "Operativo") return { background: "#e8f5e9", color: "#2e7d32" };
  if (estado === "Operativo con observaciones") return { background: "#fff8e1", color: "#f57f17" };
  return { background: "#ffebee", color: "#c62828" };
};

const ordenarPisos = (a, b) => {
  const orden = ["sotano", "sótano", "subsuelo", "ss"];
  const aLow = a.toLowerCase();
  const bLow = b.toLowerCase();
  if (orden.includes(aLow)) return -1;
  if (orden.includes(bLow)) return 1;
  const aNum = parseInt(a);
  const bNum = parseInt(b);
  if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
  return a.localeCompare(b);
};

const agruparPorPiso = (equipos) => {
  const porPiso = {};
  equipos.forEach(e => {
    const piso = e.piso || "Sin piso";
    if (!porPiso[piso]) porPiso[piso] = [];
    porPiso[piso].push(e);
  });
  return porPiso;
};

const exportarExcel = (cliente, equiposCliente) => {
  const porPiso = agruparPorPiso(equiposCliente);
  const pisosOrdenados = Object.keys(porPiso).sort(ordenarPisos);
  let item = 1;
  let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
  <head><meta charset="UTF-8">
  <style>
    body { font-family: Arial; font-size: 9pt; }
    .titulo { background: #1A73E8; color: white; font-size: 14pt; font-weight: bold; }
    .subtitulo { background: #F0F4F8; color: #555; font-size: 9pt; }
    .header { background: #1565C0; color: white; font-weight: bold; font-size: 9pt; text-align: center; }
    .piso { background: #BBDEFB; color: #0D47A1; font-weight: bold; font-size: 9pt; }
    .fila { font-size: 9pt; } .fila-alt { background: #F8F9FA; font-size: 9pt; }
    .op { background: #C8E6C9; color: #1B5E20; font-weight: bold; text-align: center; }
    .obs { background: #FFF9C4; color: #E65100; font-weight: bold; text-align: center; }
    .fs { background: #FFCDD2; color: #B71C1C; font-weight: bold; text-align: center; }
    .cod { background: #F3E5F5; color: #6A1B9A; font-weight: bold; text-align: center; font-family: monospace; }
    td { border: 1px solid #E0E0E0; padding: 4px 6px; }
  </style></head><body><table>
    <tr><td colspan="13" class="titulo">HVAC - Sistema de Mantenimiento</td></tr>
    <tr><td colspan="3" class="subtitulo">Cliente: ${cliente}</td><td colspan="3" class="subtitulo">Generado: ${new Date().toLocaleDateString("es-PE")}</td><td colspan="3" class="subtitulo">Total: ${equiposCliente.length} equipos</td><td colspan="4" class="subtitulo"></td></tr>
    <tr><td colspan="13"></td></tr>
    <tr><td class="header">#</td><td class="header">Codigo</td><td class="header">Piso</td><td class="header">Ambiente</td><td class="header">Tipo equipo</td><td class="header">Marca</td><td class="header">Modelo</td><td class="header">N Serie</td><td class="header">Capacidad</td><td class="header">Refrigerante</td><td class="header">Voltaje</td><td class="header">Estado</td><td class="header">Observaciones</td></tr>`;
  pisosOrdenados.forEach(piso => {
    html += `<tr><td colspan="13" class="piso">PISO: ${piso.toUpperCase()}</td></tr>`;
    porPiso[piso].forEach((e, idx) => {
      const ec = e.estado === "Operativo" ? "op" : e.estado === "Operativo con observaciones" ? "obs" : "fs";
      html += `<tr class="${idx % 2 === 0 ? "fila" : "fila-alt"}"><td>${item++}</td><td class="cod">${e.codigo || "-"}</td><td>${e.piso || "-"}</td><td>${e.ambiente || "-"}</td><td>${e.tipoEquipo || "-"}</td><td>${e.marca || "-"}</td><td>${e.modelo || "-"}</td><td>${e.serie || "-"}</td><td>${e.capacidad || "-"}</td><td>${e.tipoRefrigerante || "-"}</td><td>${e.voltaje ? e.voltaje + "V" : "-"}</td><td class="${ec}">${e.estado || "Operativo"}</td><td>${e.observaciones || "-"}</td></tr>`;
    });
  });
  html += `</table></body></html>`;
  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `equipos-${cliente.replace(/\s+/g, "-")}-${new Date().getFullYear()}.xls`;
  a.click();
  URL.revokeObjectURL(url);
};

const exportarPDF = (cliente, equiposCliente) => {
  const pdf = new jsPDF("l", "mm", "a4");
  const margen = 10; let y = 15;
  pdf.setFillColor(26, 115, 232); pdf.rect(0, 0, 297, 20, "F");
  pdf.setFontSize(13); pdf.setFont("helvetica", "bold"); pdf.setTextColor(255, 255, 255);
  pdf.text("HVAC - Sistema de Mantenimiento", margen, 13);
  pdf.setFontSize(10); pdf.setFont("helvetica", "normal");
  pdf.text(`Cliente: ${cliente}   Generado: ${new Date().toLocaleDateString("es-PE")}   Total: ${equiposCliente.length} equipos`, margen, 19);
  y = 28;
  const porPiso = agruparPorPiso(equiposCliente);
  const pisosOrdenados = Object.keys(porPiso).sort(ordenarPisos);
  let item = 1;
  const cols = [8, 14, 14, 20, 16, 14, 16, 16, 13, 11, 11, 22, 42];
  const headers = ["#", "Codigo", "Piso", "Ambiente", "Tipo", "Marca", "Modelo", "Serie", "Cap.", "Refrig.", "Volt.", "Estado", "Obs."];
  const drawHeader = () => {
    pdf.setFillColor(21, 101, 192); pdf.rect(margen, y - 4, 277, 8, "F");
    pdf.setFontSize(7.5); pdf.setFont("helvetica", "bold"); pdf.setTextColor(255, 255, 255);
    let x = margen;
    headers.forEach((h, i) => { pdf.text(h, x + 1, y + 1); x += cols[i]; });
    y += 7;
  };
  drawHeader();
  pisosOrdenados.forEach(piso => {
    if (y > 185) { pdf.addPage(); y = 15; drawHeader(); }
    pdf.setFillColor(187, 222, 251); pdf.rect(margen, y - 3, 277, 7, "F");
    pdf.setFontSize(8); pdf.setFont("helvetica", "bold"); pdf.setTextColor(13, 71, 161);
    pdf.text(`PISO: ${piso.toUpperCase()}`, margen + 2, y + 2); y += 7;
    porPiso[piso].forEach((e, idx) => {
      if (y > 185) { pdf.addPage(); y = 15; drawHeader(); }
      if (idx % 2 === 0) { pdf.setFillColor(248, 249, 250); pdf.rect(margen, y - 3, 277, 7, "F"); }
      const fila = [String(item++), e.codigo || "-", e.piso || "-", e.ambiente || "-", e.tipoEquipo || "-", e.marca || "-", e.modelo || "-", e.serie || "-", e.capacidad || "-", e.tipoRefrigerante || "-", e.voltaje ? `${e.voltaje}V` : "-", e.estado || "Operativo", e.observaciones || "-"];
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(7);
      let x = margen;
      fila.forEach((val, i) => {
        if (i === 11) { if (val === "Operativo") pdf.setTextColor(27, 94, 32); else if (val === "Operativo con observaciones") pdf.setTextColor(230, 81, 0); else pdf.setTextColor(183, 28, 28); }
        else if (i === 1) pdf.setTextColor(106, 27, 154);
        else pdf.setTextColor(50, 50, 50);
        pdf.text(pdf.splitTextToSize(val, cols[i] - 2)[0], x + 1, y + 2); x += cols[i];
      });
      pdf.setDrawColor(220, 220, 220); pdf.line(margen, y + 4, margen + 277, y + 4); y += 7;
    });
  });
  pdf.setFontSize(8); pdf.setTextColor(150, 150, 150);
  pdf.text(`HVAC Sistema de Mantenimiento`, margen, 205);
  pdf.save(`equipos-${cliente.replace(/\s+/g, "-")}-${new Date().getFullYear()}.pdf`);
};

export default function PanelCliente() {
  const [equipos, setEquipos] = useState([]);
  const [usuario, setUsuario] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState("Todos");
  const [cargando, setCargando] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { navigate("/"); return; }
      const q = query(collection(db, "usuarios"), where("email", "==", user.email));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const userData = snap.docs[0].data();
        setUsuario(userData);
        cargarEquipos(userData.empresa);
      }
    });
    return () => unsub();
  }, []);

  const cargarEquipos = async (empresa) => {
    const q = query(collection(db, "equipos"), where("cliente", "==", empresa));
    const snapshot = await getDocs(q);
    const lista = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    setEquipos(lista);
    setCargando(false);
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/");
  };

  const op = equipos.filter(e => e.estado === "Operativo").length;
  const obs = equipos.filter(e => e.estado === "Operativo con observaciones").length;
  const fs = equipos.filter(e => e.estado === "Fuera de servicio").length;
  const total = equipos.length;
  const pOp = total ? Math.round((op / total) * 100) : 0;
  const pObs = total ? Math.round((obs / total) * 100) : 0;
  const pFs = total ? Math.round((fs / total) * 100) : 0;

  const equiposFiltrados = filtroEstado === "Todos" ? equipos : equipos.filter(e => e.estado === filtroEstado);
  const porPiso = agruparPorPiso(equiposFiltrados);
  const pisosOrdenados = Object.keys(porPiso).sort(ordenarPisos);
  let itemNum = 1;

  if (cargando) return <div style={{ textAlign: "center", padding: "3rem", fontSize: "16px", color: "#888" }}>Cargando...</div>;

  return (
    <div style={s.page}>
      {/* NAVBAR */}
      <div style={s.navbar}>
        <div style={s.navLeft}>
          <div style={s.logo}>
            <span style={s.letraAzul}>H</span>
            <span style={{ ...s.letraAzul, marginRight: "-8px" }}>V</span>
            <span style={s.letraDorada}>A</span>
            <span style={{ ...s.letraAzul, marginLeft: "-2px" }}>C</span>
          </div>
          <div style={s.divider}></div>
          <span style={s.navEmpresa}>{usuario?.empresa}</span>
        </div>
        <div style={s.navRight}>
          <div style={s.avatar}>{usuario?.nombre?.substring(0, 2).toUpperCase() || "U"}</div>
          <span style={s.navNombre}>{usuario?.nombre}</span>
          <button style={s.btnSalir} onClick={handleLogout}>Salir</button>
        </div>
      </div>

      <div style={s.content}>
        {/* STATS */}
        <div style={s.statsGrid}>
          <div style={s.statCard}><div style={s.statNum}>{total}</div><div style={s.statLabel}>Total equipos</div></div>
          <div style={{ ...s.statCard, background: "#e8f5e9", border: "0.5px solid #a5d6a7" }}><div style={{ ...s.statNum, color: "#2e7d32" }}>{op}</div><div style={{ ...s.statLabel, color: "#2e7d32" }}>Operativos</div></div>
          <div style={{ ...s.statCard, background: "#fff8e1", border: "0.5px solid #ffe082" }}><div style={{ ...s.statNum, color: "#e65100" }}>{obs}</div><div style={{ ...s.statLabel, color: "#e65100" }}>Con obs.</div></div>
          <div style={{ ...s.statCard, background: "#ffebee", border: "0.5px solid #ef9a9a" }}><div style={{ ...s.statNum, color: "#c62828" }}>{fs}</div><div style={{ ...s.statLabel, color: "#c62828" }}>Fuera serv.</div></div>
        </div>

        {total === 0 ? (
          <div style={s.vacio}>No hay equipos registrados aún.</div>
        ) : (
          <>
            {/* BARRAS */}
            <div style={s.barrasCard}>
              {[["Operativo", pOp, "#43a047", "#2e7d32"], ["Con observaciones", pObs, "#ffa726", "#e65100"], ["Fuera de servicio", pFs, "#ef5350", "#c62828"]].map(([label, pct, bg, color]) => (
                <div key={label} style={s.barraFila}>
                  <span style={s.barraLabel}>{label}</span>
                  <div style={s.barraTrack}><div style={{ width: `${pct}%`, height: "100%", background: bg }}></div></div>
                  <span style={{ ...s.barraPct, color }}>{pct}%</span>
                </div>
              ))}
            </div>

            {/* TABLA */}
            <div style={s.tablaCard}>
              <div style={s.tablaHeaderRow}>
                <div style={s.tablaHeaderLeft}>
                  <span style={s.tablaTitle}>Lista de equipos</span>
                  <span style={s.tablaBadge}>{total} equipo{total !== 1 ? "s" : ""}</span>
                </div>
                <div style={s.tablaHeaderRight}>
                  <button style={s.btnExcel} onClick={() => exportarExcel(usuario?.empresa, equipos)}>Excel</button>
                  <button style={s.btnPdf} onClick={() => exportarPDF(usuario?.empresa, equipos)}>PDF</button>
                </div>
              </div>
              <div style={s.filtroWrap}>
                <span style={s.filtroLabel}>Filtrar:</span>
                {["Todos", "Operativo", "Operativo con observaciones", "Fuera de servicio"].map(f => (
                  <button key={f} style={{ ...s.filtroBtn, ...(filtroEstado === f ? s.filtroBtnActivo : {}) }} onClick={() => setFiltroEstado(f)}>
                    {f === "Operativo con observaciones" ? "Con obs." : f}
                  </button>
                ))}
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={s.tabla}>
                  <thead>
                    <tr style={s.thead}>
                      {["#", "Código", "Piso", "Ambiente", "Tipo equipo", "Marca / Modelo", "Serie", "Estado", "Acciones"].map(h => (
                        <th key={h} style={s.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pisosOrdenados.map(piso => (
                      <React.Fragment key={piso}>
                        <tr><td colSpan={9} style={s.pisoHeader}>Piso {piso === "Sin piso" ? "sin asignar" : piso}</td></tr>
                        {porPiso[piso].map(equipo => {
                          const item = itemNum++;
                          return (
                            <tr key={equipo.id} style={s.tr}>
                              <td style={{ ...s.td, textAlign: "center", color: "#888" }}>{item}</td>
                              <td style={{ ...s.td, textAlign: "center" }}>{equipo.codigo ? <span style={s.codigo}>{equipo.codigo}</span> : "-"}</td>
                              <td style={{ ...s.td, textAlign: "center" }}>{equipo.piso || "-"}</td>
                              <td style={s.td}>{equipo.ambiente || "-"}</td>
                              <td style={s.td}>{equipo.tipoEquipo || "-"}</td>
                              <td style={s.td}>{equipo.marca || "-"}{equipo.modelo ? ` / ${equipo.modelo}` : ""}</td>
                              <td style={s.td}>{equipo.serie || "-"}</td>
                              <td style={{ ...s.td, textAlign: "center" }}>
                                <span style={{ ...s.badge, ...getBadgeStyle(equipo.estado) }}>
                                  {equipo.estado === "Operativo con observaciones" ? "Con obs." : equipo.estado || "Operativo"}
                                </span>
                              </td>
                              <td style={s.td}>
                                <div style={s.acciones}>
                                  <button style={s.btnInfo} onClick={() => navigate(`/equipo/${equipo.id}`)}>Info</button>
                                  <button style={s.btnCotizar} onClick={() => navigate(`/cotizacion/${equipo.id}`)}>Cotizar</button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const s = {
  page: { minHeight: "100vh", background: "#f0f4f8", fontFamily: "Inter, Arial, sans-serif" },
  navbar: { background: "white", borderBottom: "0.5px solid #e0e0e0", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10 },
  navLeft: { display: "flex", alignItems: "center", gap: "12px" },
  logo: { fontFamily: "'Arial Black', sans-serif", fontWeight: 900, fontSize: "20px", display: "flex", alignItems: "baseline" },
  letraAzul: { color: "#1a5fa8" },
  letraDorada: { color: "#f0c040" },
  divider: { width: "1px", height: "18px", background: "#e0e0e0" },
  navEmpresa: { fontSize: "14px", fontWeight: 500, color: "#222" },
  navRight: { display: "flex", alignItems: "center", gap: "10px" },
  avatar: { width: "30px", height: "30px", borderRadius: "50%", background: "#e8f0fe", color: "#1a5fa8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 500 },
  navNombre: { fontSize: "13px", color: "#555" },
  btnSalir: { background: "#ffebee", color: "#c62828", border: "0.5px solid #ef9a9a", borderRadius: "8px", padding: "6px 14px", cursor: "pointer", fontSize: "12px", fontWeight: 500 },
  content: { maxWidth: "1200px", margin: "0 auto", padding: "20px 24px" },
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "16px" },
  statCard: { background: "white", border: "0.5px solid #e0e0e0", borderRadius: "12px", padding: "14px", textAlign: "center" },
  statNum: { fontSize: "26px", fontWeight: 500, color: "#333" },
  statLabel: { fontSize: "10px", color: "#888", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: "2px" },
  barrasCard: { background: "white", border: "0.5px solid #e0e0e0", borderRadius: "12px", padding: "14px 16px", marginBottom: "16px" },
  barraFila: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" },
  barraLabel: { fontSize: "12px", color: "#666", minWidth: "150px" },
  barraTrack: { flex: 1, height: "7px", background: "#f0f0f0", borderRadius: "4px", overflow: "hidden" },
  barraPct: { fontSize: "12px", fontWeight: 500, minWidth: "36px", textAlign: "right" },
  tablaCard: { background: "white", border: "0.5px solid #e0e0e0", borderRadius: "12px", overflow: "hidden" },
  tablaHeaderRow: { padding: "14px 16px", borderBottom: "0.5px solid #f0f0f0", display: "flex", alignItems: "center", justifyContent: "space-between" },
  tablaHeaderLeft: { display: "flex", alignItems: "center", gap: "10px" },
  tablaTitle: { fontSize: "14px", fontWeight: 500, color: "#222" },
  tablaBadge: { fontSize: "11px", padding: "2px 8px", background: "#e8f0fe", color: "#1a5fa8", borderRadius: "20px" },
  tablaHeaderRight: { display: "flex", gap: "6px" },
  btnExcel: { fontSize: "12px", padding: "5px 12px", background: "#1e7e34", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: 500 },
  btnPdf: { fontSize: "12px", padding: "5px 12px", background: "#c62828", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: 500 },
  filtroWrap: { display: "flex", alignItems: "center", gap: "6px", padding: "10px 16px", borderBottom: "0.5px solid #f0f0f0", flexWrap: "wrap" },
  filtroLabel: { fontSize: "11px", color: "#888" },
  filtroBtn: { fontSize: "11px", padding: "3px 10px", borderRadius: "20px", border: "0.5px solid #ddd", background: "white", cursor: "pointer", color: "#555" },
  filtroBtnActivo: { background: "#1a5fa8", color: "white", border: "0.5px solid #1a5fa8" },
  tabla: { width: "100%", borderCollapse: "collapse", fontSize: "12px" },
  thead: { background: "#f8f9fa" },
  th: { padding: "9px 12px", textAlign: "left", fontWeight: 500, color: "#666", borderBottom: "0.5px solid #e0e0e0", fontSize: "11px", textTransform: "uppercase", whiteSpace: "nowrap" },
  tr: { borderBottom: "0.5px solid #f5f5f5" },
  td: { padding: "9px 12px", color: "#333", fontSize: "12px" },
  badge: { padding: "2px 8px", borderRadius: "10px", fontSize: "11px", fontWeight: 500, whiteSpace: "nowrap" },
  codigo: { background: "#f3e5f5", color: "#6a1b9a", padding: "2px 6px", borderRadius: "4px", fontFamily: "monospace", fontWeight: 700, fontSize: "11px" },
  pisoHeader: { background: "#e8f0fe", color: "#1a5fa8", fontWeight: 500, padding: "6px 12px", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em" },
  acciones: { display: "flex", gap: "4px" },
  btnInfo: { background: "#1a5fa8", color: "white", border: "none", borderRadius: "4px", padding: "3px 8px", cursor: "pointer", fontSize: "11px" },
  btnCotizar: { background: "#7b1fa2", color: "white", border: "none", borderRadius: "4px", padding: "3px 8px", cursor: "pointer", fontSize: "11px" },
  vacio: { textAlign: "center", padding: "3rem", background: "white", borderRadius: "12px", color: "#888", border: "0.5px solid #e0e0e0" },
};
