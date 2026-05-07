import React from "react";
import { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs } from "firebase/firestore";
import { signOut } from "firebase/auth";
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
    .fila { font-size: 9pt; }
    .fila-alt { background: #F8F9FA; font-size: 9pt; }
    .op { background: #C8E6C9; color: #1B5E20; font-weight: bold; text-align: center; }
    .obs { background: #FFF9C4; color: #E65100; font-weight: bold; text-align: center; }
    .fs { background: #FFCDD2; color: #B71C1C; font-weight: bold; text-align: center; }
    .cod { background: #F3E5F5; color: #6A1B9A; font-weight: bold; text-align: center; font-family: monospace; }
    td { border: 1px solid #E0E0E0; padding: 4px 6px; }
  </style></head><body>
  <table>
    <tr><td colspan="13" class="titulo">HVAC QR System - Reporte de equipos</td></tr>
    <tr>
      <td colspan="3" class="subtitulo">Cliente: ${cliente}</td>
      <td colspan="3" class="subtitulo">Generado: ${new Date().toLocaleDateString("es-PE")}</td>
      <td colspan="3" class="subtitulo">Total: ${equiposCliente.length} equipos</td>
      <td colspan="4" class="subtitulo"></td>
    </tr>
    <tr><td colspan="13"></td></tr>
    <tr>
      <td class="header">#</td>
      <td class="header">Codigo</td>
      <td class="header">Piso</td>
      <td class="header">Ambiente</td>
      <td class="header">Tipo equipo</td>
      <td class="header">Marca</td>
      <td class="header">Modelo</td>
      <td class="header">N Serie</td>
      <td class="header">Capacidad (BTU)</td>
      <td class="header">Refrigerante</td>
      <td class="header">Voltaje</td>
      <td class="header">Estado</td>
      <td class="header">Observaciones</td>
    </tr>`;
  pisosOrdenados.forEach(piso => {
    html += `<tr><td colspan="13" class="piso">PISO: ${piso.toUpperCase()}</td></tr>`;
    porPiso[piso].forEach((e, idx) => {
      const estadoClass = e.estado === "Operativo" ? "op" : e.estado === "Operativo con observaciones" ? "obs" : "fs";
      const filaClass = idx % 2 === 0 ? "fila" : "fila-alt";
      html += `<tr class="${filaClass}">
        <td>${item++}</td>
        <td class="cod">${e.codigo || "-"}</td>
        <td>${e.piso || "-"}</td>
        <td>${e.ambiente || "-"}</td>
        <td>${e.tipoEquipo || "-"}</td>
        <td>${e.marca || "-"}</td>
        <td>${e.modelo || "-"}</td>
        <td>${e.serie || "-"}</td>
        <td>${e.capacidad || "-"}</td>
        <td>${e.tipoRefrigerante || "-"}</td>
        <td>${e.voltaje ? e.voltaje + "V" : "-"}</td>
        <td class="${estadoClass}">${e.estado || "Operativo"}</td>
        <td>${e.observaciones || "-"}</td>
      </tr>`;
    });
  });
  html += `</table></body></html>`;
  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `equipos-${cliente.replace(/\s+/g,"-")}-${new Date().getFullYear()}.xls`;
  a.click();
  URL.revokeObjectURL(url);
};

const exportarPDF = (cliente, equiposCliente) => {
  const pdf = new jsPDF("l", "mm", "a4");
  const margen = 10;
  let y = 15;
  pdf.setFillColor(26, 115, 232);
  pdf.rect(0, 0, 297, 20, "F");
  pdf.setFontSize(13);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(255, 255, 255);
  pdf.text("HVAC QR System - Reporte de equipos", margen, 13);
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  pdf.text(`Cliente: ${cliente}   Generado: ${new Date().toLocaleDateString("es-PE")}   Total: ${equiposCliente.length} equipos`, margen, 19);
  y = 28;
  const porPiso = agruparPorPiso(equiposCliente);
  const pisosOrdenados = Object.keys(porPiso).sort(ordenarPisos);
  let item = 1;
  const cols = [8, 14, 14, 20, 16, 14, 16, 16, 13, 11, 11, 22, 42];
  const headers = ["#", "Codigo", "Piso", "Ambiente", "Tipo equipo", "Marca", "Modelo", "Serie", "Cap.", "Refrig.", "Volt.", "Estado", "Observaciones"];
  const dibujarEncabezado = () => {
    pdf.setFillColor(21, 101, 192);
    pdf.rect(margen, y - 4, 277, 8, "F");
    pdf.setFontSize(7.5);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(255, 255, 255);
    let x = margen;
    headers.forEach((h, i) => { pdf.text(h, x + 1, y + 1); x += cols[i]; });
    y += 7;
  };
  dibujarEncabezado();
  pisosOrdenados.forEach(piso => {
    if (y > 185) { pdf.addPage(); y = 15; dibujarEncabezado(); }
    pdf.setFillColor(187, 222, 251);
    pdf.rect(margen, y - 3, 277, 7, "F");
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(13, 71, 161);
    pdf.text(`PISO: ${piso.toUpperCase()}`, margen + 2, y + 2);
    y += 7;
    porPiso[piso].forEach((e, idx) => {
      if (y > 185) { pdf.addPage(); y = 15; dibujarEncabezado(); }
      if (idx % 2 === 0) {
        pdf.setFillColor(248, 249, 250);
        pdf.rect(margen, y - 3, 277, 7, "F");
      }
      const fila = [
        String(item++), e.codigo || "-", e.piso || "-", e.ambiente || "-",
        e.tipoEquipo || "-", e.marca || "-", e.modelo || "-", e.serie || "-",
        e.capacidad ? `${e.capacidad}` : "-",
        e.tipoRefrigerante || "-", e.voltaje ? `${e.voltaje}V` : "-",
        e.estado || "Operativo", e.observaciones || "-"
      ];
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7);
      let x = margen;
      fila.forEach((val, i) => {
        if (i === 11) {
          if (val === "Operativo") pdf.setTextColor(27, 94, 32);
          else if (val === "Operativo con observaciones") pdf.setTextColor(230, 81, 0);
          else pdf.setTextColor(183, 28, 28);
        } else if (i === 1) {
          pdf.setTextColor(106, 27, 154);
        } else {
          pdf.setTextColor(50, 50, 50);
        }
        const texto = pdf.splitTextToSize(val, cols[i] - 2);
        pdf.text(texto[0], x + 1, y + 2);
        x += cols[i];
      });
      pdf.setDrawColor(220, 220, 220);
      pdf.line(margen, y + 4, margen + 277, y + 4);
      y += 7;
    });
  });
  pdf.setFontSize(8);
  pdf.setTextColor(150, 150, 150);
  pdf.text(`HVAC QR System - hvac-qr-system-1odv.vercel.app`, margen, 205);
  pdf.save(`equipos-${cliente.replace(/\s+/g,"-")}-${new Date().getFullYear()}.pdf`);
};

const barStyles = {
  contenedor: { padding: "16px 20px", background: "#f9fafb", borderRadius: "8px", marginBottom: "16px", border: "1px solid #e0e0e0" },
  titulo: { fontWeight: "bold", fontSize: "13px", color: "#555", marginBottom: "12px" },
  fila: { display: "flex", alignItems: "center", marginBottom: "8px", gap: "10px" },
  etiqueta: { width: "180px", fontSize: "13px", color: "#444" },
  track: { flex: 1, height: "12px", background: "#e0e0e0", borderRadius: "6px", overflow: "hidden" },
  fill: { height: "100%", borderRadius: "6px" },
  pct: { width: "40px", textAlign: "right", fontSize: "13px", fontWeight: "bold" },
  combinada: { display: "flex", height: "10px", borderRadius: "6px", overflow: "hidden", marginTop: "10px" },
  leyenda: { display: "flex", gap: "16px", marginTop: "8px", fontSize: "12px", color: "#666", flexWrap: "wrap" },
  leyendaItem: { display: "flex", alignItems: "center", gap: "5px" },
  dot: { width: "10px", height: "10px", borderRadius: "50%" },
};

const BarrasEstado = ({ equipos }) => {
  const total = equipos.length;
  if (total === 0) return null;
  const op = equipos.filter(e => e.estado === "Operativo").length;
  const obs = equipos.filter(e => e.estado === "Operativo con observaciones").length;
  const fs = equipos.filter(e => e.estado === "Fuera de servicio").length;
  const pOp = Math.round((op / total) * 100);
  const pObs = Math.round((obs / total) * 100);
  const pFs = Math.round((fs / total) * 100);
  return (
    <div style={barStyles.contenedor}>
      <div style={barStyles.titulo}>📊 Estado de equipos</div>
      <div style={barStyles.fila}>
        <span style={barStyles.etiqueta}>✅ Operativo</span>
        <div style={barStyles.track}><div style={{...barStyles.fill, width:`${pOp}%`, background:"#43a047"}}></div></div>
        <span style={{...barStyles.pct, color:"#2e7d32"}}>{pOp}%</span>
      </div>
      <div style={barStyles.fila}>
        <span style={barStyles.etiqueta}>⚠️ Con observaciones</span>
        <div style={barStyles.track}><div style={{...barStyles.fill, width:`${pObs}%`, background:"#ffa726"}}></div></div>
        <span style={{...barStyles.pct, color:"#e65100"}}>{pObs}%</span>
      </div>
      <div style={barStyles.fila}>
        <span style={barStyles.etiqueta}>🔴 Fuera de servicio</span>
        <div style={barStyles.track}><div style={{...barStyles.fill, width:`${pFs}%`, background:"#ef5350"}}></div></div>
        <span style={{...barStyles.pct, color:"#c62828"}}>{pFs}%</span>
      </div>
      <div style={barStyles.combinada}>
        <div style={{width:`${pOp}%`, background:"#43a047"}}></div>
        <div style={{width:`${pObs}%`, background:"#ffa726"}}></div>
        <div style={{width:`${pFs}%`, background:"#ef5350"}}></div>
      </div>
      <div style={barStyles.leyenda}>
        <div style={barStyles.leyendaItem}><div style={{...barStyles.dot, background:"#43a047"}}></div>Operativo {pOp}%</div>
        <div style={barStyles.leyendaItem}><div style={{...barStyles.dot, background:"#ffa726"}}></div>Con observaciones {pObs}%</div>
        <div style={barStyles.leyendaItem}><div style={{...barStyles.dot, background:"#ef5350"}}></div>Fuera de servicio {pFs}%</div>
      </div>
    </div>
  );
};

export default function PanelAdmin() {
  const [equipos, setEquipos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [filtro, setFiltro] = useState("Todos");
  const [filtroEstado, setFiltroEstado] = useState("Todos");
  const navigate = useNavigate();

  useEffect(() => { cargarEquipos(); }, []);

  const cargarEquipos = async () => {
    const snapshot = await getDocs(collection(db, "equipos"));
    const lista = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    setEquipos(lista);
    const clientesUnicos = ["Todos", ...new Set(lista.map(e => e.cliente || "Sin cliente"))];
    setClientes(clientesUnicos);
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/");
  };

  const agrupados = {};
  const equiposFiltrados = filtro === "Todos" ? equipos : equipos.filter(e => e.cliente === filtro);
  const equiposFiltradosEstado = filtroEstado === "Todos" ? equiposFiltrados : equiposFiltrados.filter(e => e.estado === filtroEstado);

  equiposFiltradosEstado.forEach(e => {
    const cliente = e.cliente || "Sin cliente";
    if (!agrupados[cliente]) agrupados[cliente] = [];
    agrupados[cliente].push(e);
  });

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.titulo}>👑 Panel Maestro</h1>
        <div style={styles.headerBtns}>
          <button style={styles.btnVerde} onClick={() => navigate("/crear-usuario")}>+ Crear usuario</button>
          <button style={styles.btnAzul} onClick={() => navigate("/registrar")}>+ Nuevo equipo</button>
          <button style={styles.btnRojo} onClick={handleLogout}>Cerrar sesión</button>
        </div>
      </div>

      <div style={styles.statsRow}>
        <div style={styles.stat}><div style={styles.statNum}>{clientes.length - 1}</div><div style={styles.statLabel}>Clientes</div></div>
        <div style={styles.stat}><div style={styles.statNum}>{equipos.length}</div><div style={styles.statLabel}>Equipos totales</div></div>
        <div style={styles.stat}><div style={{...styles.statNum, color:"#2e7d32"}}>{equipos.filter(e => e.estado === "Operativo").length}</div><div style={styles.statLabel}>Operativos</div></div>
        <div style={styles.stat}><div style={{...styles.statNum, color:"#f57f17"}}>{equipos.filter(e => e.estado === "Operativo con observaciones").length}</div><div style={styles.statLabel}>Con observaciones</div></div>
        <div style={styles.stat}><div style={{...styles.statNum, color:"#c62828"}}>{equipos.filter(e => e.estado === "Fuera de servicio").length}</div><div style={styles.statLabel}>Fuera de servicio</div></div>
      </div>

      <div style={styles.filtroRow}>
        <div style={styles.filtroGrupo}>
          <span style={styles.filtroLabel}>Cliente:</span>
          <div style={styles.filtrosBtns}>
            {clientes.map(c => (
              <button key={c} style={{...styles.filtroBtn, ...(filtro === c ? styles.filtroActivo : {})}} onClick={() => setFiltro(c)}>{c}</button>
            ))}
          </div>
        </div>
      </div>

      {Object.entries(agrupados).map(([cliente, equiposCliente]) => {
        const porPiso = agruparPorPiso(equiposCliente);
        const pisosOrdenados = Object.keys(porPiso).sort(ordenarPisos);
        let itemNum = 1;
        return (
          <div key={cliente} style={styles.clienteBloque}>
            <div style={styles.clienteHeader}>
              <div style={styles.clienteLeft}>
                <span style={styles.clienteNombre}>👤 {cliente}</span>
                <span style={styles.clienteCount}>{equiposCliente.length} equipo{equiposCliente.length !== 1 ? "s" : ""}</span>
              </div>
              <div style={styles.exportBtns}>
                <button style={styles.btnExcel} onClick={() => exportarExcel(cliente, equiposCliente)}>📊 Excel</button>
                <button style={styles.btnPdfExp} onClick={() => exportarPDF(cliente, equiposCliente)}>📄 PDF</button>
              </div>
            </div>

            <BarrasEstado equipos={equiposCliente} />

            <div style={styles.tablaWrapper}>
              <table style={styles.tabla}>
                <thead>
                  <tr style={styles.thead}>
                    <th style={styles.th}>Item</th>
                    <th style={styles.th}>Código</th>
                    <th style={styles.th}>Piso</th>
                    <th style={styles.th}>Ambiente</th>
                    <th style={styles.th}>Tipo equipo</th>
                    <th style={styles.th}>Marca</th>
                    <th style={styles.th}>Modelo</th>
                    <th style={styles.th}>Serie</th>
                    <th style={styles.th}>
                      <select style={styles.thSelect} value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
                        <option value="Todos">Estado ▼</option>
                        <option value="Operativo">✅ Operativo</option>
                        <option value="Operativo con observaciones">⚠️ Con observaciones</option>
                        <option value="Fuera de servicio">🔴 Fuera de servicio</option>
                      </select>
                    </th>
                    <th style={styles.th}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {pisosOrdenados.map(piso => (
                    <React.Fragment key={piso}>
                      <tr>
                        <td colSpan={10} style={styles.pisoHeader}>
                          🏢 {piso === "Sin piso" ? "Sin piso asignado" : `Piso ${piso}`}
                        </td>
                      </tr>
                      {porPiso[piso].map((equipo) => {
                        const item = itemNum++;
                        return (
                          <tr key={equipo.id} style={styles.tr}>
                            <td style={{...styles.td, textAlign:"center"}}>{item}</td>
                            <td style={{...styles.td, textAlign:"center"}}>
                              {equipo.codigo ? <span style={styles.codigo}>{equipo.codigo}</span> : "-"}
                            </td>
                            <td style={{...styles.td, textAlign:"center"}}>{equipo.piso || "-"}</td>
                            <td style={{...styles.td, textAlign:"center"}}>{equipo.ambiente || "-"}</td>
                            <td style={{...styles.td, textAlign:"center"}}>{equipo.tipoEquipo || "-"}</td>
                            <td style={{...styles.td, textAlign:"center"}}>{equipo.marca || "-"}</td>
                            <td style={{...styles.td, textAlign:"center"}}>{equipo.modelo || "-"}</td>
                            <td style={{...styles.td, textAlign:"center"}}>{equipo.serie || "-"}</td>
                            <td style={{...styles.td, textAlign:"center"}}>
                              <span style={{...styles.badge, ...getBadgeStyle(equipo.estado)}}>
                                {equipo.estado || "Operativo"}
                              </span>
                            </td>
                            <td style={styles.td}>
                              <div style={styles.acciones}>
                                <button style={styles.btnInfo} onClick={() => navigate(`/equipo/${equipo.id}`)}>Información</button>
                                <button style={styles.btnEditar} onClick={() => navigate(`/registrar?id=${equipo.id}`)}>Editar</button>
                                <button style={styles.btnCotizar} onClick={() => navigate(`/cotizacion/${equipo.id}`)}>Cotización</button>
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
        );
      })}
    </div>
  );
}

const styles = {
  container: { maxWidth: "1200px", margin: "0 auto", padding: "20px", fontFamily: "Inter, sans-serif" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "12px" },
  titulo: { fontSize: "28px", fontWeight: "700", color: "#1a73e8", margin: 0 },
  headerBtns: { display: "flex", gap: "10px", flexWrap: "wrap" },
  btnVerde: { background: "#43a047", color: "white", border: "none", borderRadius: "8px", padding: "10px 18px", cursor: "pointer", fontWeight: "600", fontSize: "14px" },
  btnAzul: { background: "#1a73e8", color: "white", border: "none", borderRadius: "8px", padding: "10px 18px", cursor: "pointer", fontWeight: "600", fontSize: "14px" },
  btnRojo: { background: "#e53935", color: "white", border: "none", borderRadius: "8px", padding: "10px 18px", cursor: "pointer", fontWeight: "600", fontSize: "14px" },
  statsRow: { display: "flex", gap: "16px", marginBottom: "24px", flexWrap: "wrap" },
  stat: { flex: 1, minWidth: "140px", background: "white", borderRadius: "12px", padding: "20px", textAlign: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.08)", border: "1px solid #f0f0f0" },
  statNum: { fontSize: "32px", fontWeight: "700", color: "#1a73e8" },
  statLabel: { fontSize: "12px", color: "#888", marginTop: "4px", textTransform: "uppercase", letterSpacing: "0.05em" },
  filtroRow: { background: "white", borderRadius: "12px", padding: "16px 20px", marginBottom: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", border: "1px solid #f0f0f0" },
  filtroGrupo: { display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" },
  filtroLabel: { fontWeight: "600", color: "#555", fontSize: "14px" },
  filtrosBtns: { display: "flex", gap: "8px", flexWrap: "wrap" },
  filtroBtn: { padding: "6px 14px", borderRadius: "20px", border: "1px solid #ddd", background: "white", cursor: "pointer", fontSize: "13px", color: "#555" },
  filtroActivo: { background: "#1a73e8", color: "white", border: "1px solid #1a73e8" },
  clienteBloque: { background: "white", borderRadius: "12px", padding: "20px", marginBottom: "24px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", border: "1px solid #f0f0f0" },
  clienteHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" },
  clienteLeft: { display: "flex", alignItems: "center", gap: "10px" },
  clienteNombre: { fontSize: "18px", fontWeight: "700", color: "#333" },
  clienteCount: { background: "#e8f0fe", color: "#1a73e8", borderRadius: "20px", padding: "2px 10px", fontSize: "13px", fontWeight: "600" },
  exportBtns: { display: "flex", gap: "8px" },
  btnExcel: { background: "#1e7e34", color: "white", border: "none", borderRadius: "8px", padding: "8px 16px", cursor: "pointer", fontWeight: "600", fontSize: "13px" },
  btnPdfExp: { background: "#c62828", color: "white", border: "none", borderRadius: "8px", padding: "8px 16px", cursor: "pointer", fontWeight: "600", fontSize: "13px" },
  tablaWrapper: { overflowX: "auto" },
  tabla: { width: "100%", borderCollapse: "collapse", fontSize: "13px" },
  thead: { background: "#f8f9fa" },
  th: { padding: "10px 12px", textAlign: "left", fontWeight: "600", color: "#555", borderBottom: "2px solid #e0e0e0", whiteSpace: "nowrap", fontSize: "12px", textTransform: "uppercase" },
  thSelect: { background: "transparent", border: "none", cursor: "pointer", fontWeight: "600", color: "#555", fontSize: "12px", textTransform: "uppercase" },
  tr: { borderBottom: "1px solid #f0f0f0" },
  td: { padding: "10px 12px", color: "#333", fontSize: "13px" },
  badge: { padding: "3px 10px", borderRadius: "12px", fontSize: "12px", fontWeight: "600", whiteSpace: "nowrap" },
  codigo: { background: "#f3e5f5", color: "#6a1b9a", padding: "2px 8px", borderRadius: "6px", fontFamily: "monospace", fontWeight: "700", fontSize: "12px" },
  pisoHeader: { background: "#e3f2fd", color: "#0d47a1", fontWeight: "700", padding: "8px 12px", fontSize: "13px" },
  acciones: { display: "flex", gap: "6px", flexWrap: "wrap" },
  btnInfo: { background: "#1a73e8", color: "white", border: "none", borderRadius: "6px", padding: "5px 10px", cursor: "pointer", fontSize: "12px", fontWeight: "600" },
  btnEditar: { background: "#f57c00", color: "white", border: "none", borderRadius: "6px", padding: "5px 10px", cursor: "pointer", fontSize: "12px", fontWeight: "600" },
  btnCotizar: { background: "#7b1fa2", color: "white", border: "none", borderRadius: "6px", padding: "5px 10px", cursor: "pointer", fontSize: "12px", fontWeight: "600" },
};
