import React from "react";
import { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx-js-style";
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

  const estiloTitulo = { font: { bold: true, sz: 14, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "1A73E8" } }, alignment: { horizontal: "left" } };
  const estiloSubtitulo = { font: { sz: 10, color: { rgb: "555555" } }, fill: { fgColor: { rgb: "F0F4F8" } } };
  const estiloHeader = { font: { bold: true, sz: 10, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "1565C0" } }, alignment: { horizontal: "center", wrapText: true }, border: { bottom: { style: "thin", color: { rgb: "FFFFFF" } } } };
  const estiloPiso = { font: { bold: true, sz: 10, color: { rgb: "0D47A1" } }, fill: { fgColor: { rgb: "BBDEFB" } } };
  const estiloFila = { font: { sz: 9 }, alignment: { wrapText: true, vertical: "center" }, border: { bottom: { style: "thin", color: { rgb: "E0E0E0" } } } };
  const estiloFilaAlt = { font: { sz: 9 }, fill: { fgColor: { rgb: "F8F9FA" } }, alignment: { wrapText: true, vertical: "center" }, border: { bottom: { style: "thin", color: { rgb: "E0E0E0" } } } };
  const estiloOp = { font: { bold: true, sz: 9, color: { rgb: "1B5E20" } }, fill: { fgColor: { rgb: "C8E6C9" } }, alignment: { horizontal: "center" } };
  const estiloObs = { font: { bold: true, sz: 9, color: { rgb: "E65100" } }, fill: { fgColor: { rgb: "FFF9C4" } }, alignment: { horizontal: "center" } };
  const estiloFs = { font: { bold: true, sz: 9, color: { rgb: "B71C1C" } }, fill: { fgColor: { rgb: "FFCDD2" } }, alignment: { horizontal: "center" } };

  const getEstadoStyle = (estado) => {
    if (estado === "Operativo") return estiloOp;
    if (estado === "Operativo con observaciones") return estiloObs;
    return estiloFs;
  };

  const ws = {};
  let row = 0;

  const setCell = (r, c, v, s) => {
    const ref = XLSX.utils.encode_cell({ r, c });
    ws[ref] = { v, s };
  };

  setCell(row, 0, "HVAC QR System — Reporte de equipos", estiloTitulo);
  row++;
  setCell(row, 0, `Cliente: ${cliente}`, estiloSubtitulo);
  setCell(row, 2, `Generado: ${new Date().toLocaleDateString("es-PE")}`, estiloSubtitulo);
  setCell(row, 4, `Total: ${equiposCliente.length} equipos`, estiloSubtitulo);
  row++;
  row++;

  const headers = ["#", "Piso", "Ambiente", "Tipo equipo", "Marca", "Modelo", "N° Serie", "Capacidad (BTU)", "Refrigerante", "Voltaje", "Estado", "Observaciones"];
  headers.forEach((h, c) => setCell(row, c, h, estiloHeader));
  row++;

  pisosOrdenados.forEach(piso => {
    setCell(row, 0, `PISO: ${piso.toUpperCase()}`, estiloPiso);
    for (let c = 1; c < 12; c++) setCell(row, c, "", estiloPiso);
    row++;
    porPiso[piso].forEach((e, idx) => {
      const estilo = idx % 2 === 0 ? estiloFila : estiloFilaAlt;
      const datos = [
        item++, e.piso || "—", e.ambiente || "—", e.tipoEquipo || "—",
        e.marca || "—", e.modelo || "—", e.serie || "—",
        e.capacidad || "—", e.tipoRefrigerante || "—",
        e.voltaje ? `${e.voltaje}V` : "—",
        e.estado || "Operativo", e.observaciones || "—"
      ];
      datos.forEach((v, c) => {
        if (c === 10) setCell(row, c, v, getEstadoStyle(String(v)));
        else setCell(row, c, v, estilo);
      });
      row++;
    });
  });

  ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: row, c: 11 } });
  ws["!cols"] = [{wch:5},{wch:10},{wch:18},{wch:16},{wch:12},{wch:14},{wch:14},{wch:14},{wch:12},{wch:10},{wch:22},{wch:40}];
  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 11 } }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, cliente.slice(0,31));
  XLSX.writeFile(wb, `equipos-${cliente.replace(/\s+/g,"-")}-${new Date().getFullYear()}.xlsx`);
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
  pdf.text("HVAC QR System — Reporte de equipos", margen, 13);
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  pdf.text(`Cliente: ${cliente}   ·   Generado: ${new Date().toLocaleDateString("es-PE")}   ·   Total: ${equiposCliente.length} equipos`, margen, 19);
  y = 28;

  const porPiso = agruparPorPiso(equiposCliente);
  const pisosOrdenados = Object.keys(porPiso).sort(ordenarPisos);
  let item = 1;
  const cols = [10, 18, 22, 18, 14, 18, 18, 14, 12, 12, 24, 47];
  const headers = ["#", "Piso", "Ambiente", "Tipo equipo", "Marca", "Modelo", "Serie", "Capacidad", "Refrig.", "Voltaje", "Estado", "Observaciones"];

  const dibujarEncabezado = () => {
    pdf.setFillColor(21, 101, 192);
    pdf.rect(margen, y - 4, 277, 8, "F");
    pdf.setFontSize(8);
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
        String(item++), e.piso || "—", e.ambiente || "—", e.tipoEquipo || "—",
        e.marca || "—", e.modelo || "—", e.serie || "—",
        e.capacidad ? `${e.capacidad} BTU` : "—",
        e.tipoRefrigerante || "—", e.voltaje ? `${e.voltaje}V` : "—",
        e.estado || "Operativo", e.observaciones || "—"
      ];
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(50, 50, 50);
      pdf.setFontSize(7.5);
      let x = margen;
      fila.forEach((val, i) => {
        if (i === 10) {
          if (val === "Operativo") pdf.setTextColor(27, 94, 32);
          else if (val === "Operativo con observaciones") pdf.setTextColor(230, 81, 0);
          else pdf.setTextColor(183, 28, 28);
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
  pdf.text(`HVAC QR System · hvac-qr-system-1odv.vercel.app`, margen, 205);
  pdf.save(`equipos-${cliente.replace(/\s+/g,"-")}-${new Date().getFullYear()}.pdf`);
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

  const equiposFiltrados = equipos
    .filter(e => filtro === "Todos" || (e.cliente || "Sin cliente") === filtro)
    .filter(e => filtroEstado === "Todos" || e.estado === filtroEstado);

  const agrupados = {};
  equiposFiltrados.forEach((equipo) => {
    const cliente = equipo.cliente || "Sin cliente";
    if (!agrupados[cliente]) agrupados[cliente] = [];
    agrupados[cliente].push(equipo);
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
            <div style={styles.tablaWrapper}>
              <table style={styles.tabla}>
                <thead>
                  <tr style={styles.thead}>
                    <th style={styles.th}>Item</th>
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
                        <td colSpan={9} style={styles.pisoHeader}>
                          🏢 {piso === "Sin piso" ? "Sin piso asignado" : `Piso ${piso}`}
                        </td>
                      </tr>
                      {porPiso[piso].map((equipo) => {
                        const item = itemNum++;
                        return (
                          <tr key={equipo.id} style={styles.tr}>
                            <td style={styles.td}>{item}</td>
                            <td style={styles.td}>{equipo.piso || "—"}</td>
                            <td style={styles.td}>{equipo.ambiente || "—"}</td>
                            <td style={styles.td}>{equipo.tipoEquipo || "—"}</td>
                            <td style={styles.td}>{equipo.marca || "—"}</td>
                            <td style={styles.td}>{equipo.modelo || "—"}</td>
                            <td style={styles.td}>{equipo.serie || "—"}</td>
                            <td style={styles.td}>
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
  container: { minHeight: "100vh", background: "#f0f4f8", padding: "1.5rem" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "1rem" },
  titulo: { color: "#1a73e8", margin: 0 },
  headerBtns: { display: "flex", gap: "0.5rem", flexWrap: "wrap" },
  statsRow: { display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "10px", marginBottom: "1.5rem" },
  stat: { background: "white", borderRadius: "10px", padding: "0.75rem", textAlign: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" },
  statNum: { fontSize: "24px", fontWeight: "700", color: "#1a73e8" },
  statLabel: { fontSize: "11px", color: "#888", marginTop: "4px" },
  filtroRow: { background: "white", borderRadius: "10px", padding: "1rem", marginBottom: "1.5rem", display: "flex", flexDirection: "column", gap: "0.75rem" },
  filtroGrupo: { display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" },
  filtroLabel: { fontSize: "14px", color: "#555", fontWeight: "600", minWidth: "60px" },
  filtrosBtns: { display: "flex", gap: "8px", flexWrap: "wrap" },
  filtroBtn: { padding: "6px 14px", borderRadius: "20px", border: "1px solid #ddd", background: "white", cursor: "pointer", fontSize: "13px", color: "#555" },
  filtroActivo: { background: "#1a73e8", color: "white", border: "1px solid #1a73e8" },
  clienteBloque: { background: "white", borderRadius: "12px", padding: "1.25rem", marginBottom: "1.5rem", boxShadow: "0 2px 10px rgba(0,0,0,0.07)" },
  clienteHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", paddingBottom: "0.75rem", borderBottom: "2px solid #f0f4f8", flexWrap: "wrap", gap: "8px" },
  clienteLeft: { display: "flex", alignItems: "center", gap: "12px" },
  clienteNombre: { fontSize: "17px", fontWeight: "700", color: "#1a73e8" },
  clienteCount: { fontSize: "13px", color: "#888", background: "#f0f4f8", padding: "3px 10px", borderRadius: "20px" },
  exportBtns: { display: "flex", gap: "8px" },
  btnExcel: { background: "#217346", color: "white", border: "none", borderRadius: "8px", padding: "7px 14px", cursor: "pointer", fontSize: "13px", fontWeight: "500" },
  btnPdfExp: { background: "#e53935", color: "white", border: "none", borderRadius: "8px", padding: "7px 14px", cursor: "pointer", fontSize: "13px", fontWeight: "500" },
  tablaWrapper: { overflowX: "auto" },
  tabla: { width: "100%", borderCollapse: "collapse", fontSize: "13px" },
  thead: { background: "#f0f4f8" },
  th: { padding: "10px 12px", textAlign: "left", fontWeight: "600", color: "#444", whiteSpace: "nowrap", borderBottom: "2px solid #e0e0e0" },
  thSelect: { border: "none", background: "transparent", fontWeight: "600", color: "#444", fontSize: "13px", cursor: "pointer", padding: "0" },
  pisoHeader: { background: "#e3f2fd", color: "#1565c0", fontWeight: "700", padding: "8px 12px", fontSize: "13px" },
  tr: { borderBottom: "1px solid #f0f0f0" },
  td: { padding: "10px 12px", color: "#444", whiteSpace: "nowrap" },
  badge: { padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: "600", whiteSpace: "nowrap" },
  acciones: { display: "flex", gap: "6px" },
  btnVerde: { background: "#34a853", color: "white", border: "none", borderRadius: "8px", padding: "8px 14px", cursor: "pointer", fontSize: "13px" },
  btnAzul: { background: "#1a73e8", color: "white", border: "none", borderRadius: "8px", padding: "8px 14px", cursor: "pointer", fontSize: "13px" },
  btnRojo: { background: "#ea4335", color: "white", border: "none", borderRadius: "8px", padding: "8px 14px", cursor: "pointer", fontSize: "13px" },
  btnInfo: { background: "#1a73e8", color: "white", border: "none", borderRadius: "8px", padding: "6px 10px", cursor: "pointer", fontSize: "12px" },
  btnEditar: { background: "#f9ab00", color: "white", border: "none", borderRadius: "8px", padding: "6px 10px", cursor: "pointer", fontSize: "12px" },
  btnCotizar: { background: "#9c27b0", color: "white", border: "none", borderRadius: "8px", padding: "6px 10px", cursor: "pointer", fontSize: "12px" }
};