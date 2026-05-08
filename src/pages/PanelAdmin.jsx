import React, { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf";

const getBadgeStyle = (estado) => {
  if (estado === "Operativo") return { background: "#e8f5e9", color: "#2e7d32", whiteSpace:"nowrap", display:"inline-block" };
  if (estado === "Operativo con observaciones") return { background: "#fff8e1", color: "#f57f17", whiteSpace:"nowrap", display:"inline-block" };
  return { background: "#ffebee", color: "#c62828", whiteSpace:"nowrap", display:"inline-block" };
};

const ordenarPisos = (a, b) => {
  const orden = ["sotano", "sÃ³tano", "subsuelo", "ss"];
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

const initiales = (nombre) => {
  const words = nombre.trim().split(" ");
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return nombre.substring(0, 2).toUpperCase();
};

const colorAvatar = (nombre) => {
  const colores = [
    { bg: "#e8f0fe", color: "#1a5fa8" },
    { bg: "#e8f5e9", color: "#2e7d32" },
    { bg: "#f3e5f5", color: "#6a1b9a" },
    { bg: "#fff8e1", color: "#e65100" },
    { bg: "#fce4ec", color: "#c62828" },
    { bg: "#e0f2f1", color: "#00695c" },
  ];
  let sum = 0;
  for (let i = 0; i < nombre.length; i++) sum += nombre.charCodeAt(i);
  return colores[sum % colores.length];
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
    <tr><td colspan="13" class="titulo">HVAC - Sistema de Mantenimiento</td></tr>
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
  a.download = `equipos-${cliente.replace(/\s+/g, "-")}-${new Date().getFullYear()}.xls`;
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
  pdf.text("HVAC - Sistema de Mantenimiento", margen, 13);
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
      if (idx % 2 === 0) { pdf.setFillColor(248, 249, 250); pdf.rect(margen, y - 3, 277, 7, "F"); }
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
        } else if (i === 1) { pdf.setTextColor(106, 27, 154); }
        else { pdf.setTextColor(50, 50, 50); }
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
  pdf.text(`HVAC Sistema de Mantenimiento - hvac-qr-system-1odv.vercel.app`, margen, 205);
  pdf.save(`equipos-${cliente.replace(/\s+/g, "-")}-${new Date().getFullYear()}.pdf`);
};

export default function PanelAdmin() {
  const [equipos, setEquipos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [clienteAbierto, setClienteAbierto] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState("Todos");
  const [obsAbierto, setObsAbierto] = useState(null);
  const navigate = useNavigate();

  useEffect(() => { cargarEquipos(); }, []);

  const cargarEquipos = async () => {
    const snapshot = await getDocs(collection(db, "equipos"));
    const lista = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    setEquipos(lista);
    const clientesUnicos = [...new Set(lista.map(e => e.cliente || "Sin cliente"))];
    setClientes(clientesUnicos);
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/");
  };

  const agrupados = {};
  equipos.forEach(e => {
    const cliente = e.cliente || "Sin cliente";
    if (!agrupados[cliente]) agrupados[cliente] = [];
    agrupados[cliente].push(e);
  });

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
          <div style={s.navDivider}></div>
          <span style={s.navTitle}>Panel Maestro</span>
        </div>
        <div style={s.navBtns}>
          <button style={s.btnSuccess} onClick={() => navigate("/crear-usuario")}>+ Crear usuario</button>
          <button style={s.btnDefault} onClick={() => navigate("/registrar")}>+ Nuevo equipo</button>
          <button style={s.btnDanger} onClick={handleLogout}>Salir</button>
        </div>
      </div>

      <div style={s.content}>

        {/* STATS GLOBALES */}
        <div style={s.statsGrid}>
          <div style={s.statCard}>
            <div style={{ ...s.statNum, color: "#1a5fa8" }}>{clientes.length}</div>
            <div style={s.statLabel}>Clientes</div>
          </div>
          <div style={s.statCard}>
            <div style={s.statNum}>{equipos.length}</div>
            <div style={s.statLabel}>Equipos</div>
          </div>
          <div style={s.statCard}>
            <div style={{ ...s.statNum, color: "#2e7d32" }}>{equipos.filter(e => e.estado === "Operativo").length}</div>
            <div style={s.statLabel}>Operativos</div>
          </div>
          <div style={s.statCard}>
            <div style={{ ...s.statNum, color: "#e65100" }}>{equipos.filter(e => e.estado === "Operativo con observaciones").length}</div>
            <div style={s.statLabel}>Con obs.</div>
          </div>
          <div style={s.statCard}>
            <div style={{ ...s.statNum, color: "#c62828" }}>{equipos.filter(e => e.estado === "Fuera de servicio").length}</div>
            <div style={s.statLabel}>Fuera serv.</div>
          </div>
        </div>

        {/* CARDS POR CLIENTE */}
        <div style={s.cardsGrid}>
          {Object.entries(agrupados).map(([cliente, equiposCliente]) => {
            const op = equiposCliente.filter(e => e.estado === "Operativo").length;
            const obs = equiposCliente.filter(e => e.estado === "Operativo con observaciones").length;
            const fs = equiposCliente.filter(e => e.estado === "Fuera de servicio").length;
            const total = equiposCliente.length;
            const pOp = total ? Math.round((op / total) * 100) : 0;
            const pObs = total ? Math.round((obs / total) * 100) : 0;
            const pFs = total ? Math.round((fs / total) * 100) : 0;
            const av = colorAvatar(cliente);
            const abierto = clienteAbierto === cliente;

            const porPiso = agruparPorPiso(equiposCliente);
            const pisosOrdenados = Object.keys(porPiso).sort(ordenarPisos);
            let itemNum = 1;

            const equiposFiltrados = filtroEstado === "Todos"
              ? equiposCliente
              : equiposCliente.filter(e => e.estado === filtroEstado);

            return (
              <div key={cliente} style={s.card}>
                {/* Header card */}
                <div style={s.cardHeader}>
                  <div style={{ ...s.avatar, background: av.bg, color: av.color }}>{initiales(cliente)}</div>
                  <div style={s.cardInfo}>
                    <div style={s.cardNombre}>{cliente}</div>
                    <div style={s.cardSub}>{total} equipo{total !== 1 ? "s" : ""} registrado{total !== 1 ? "s" : ""}</div>
                  </div>
                  <div style={s.cardBtns}>
                    <button style={s.btnExcel} onClick={() => exportarExcel(cliente, equiposCliente)}>Excel</button>
                    <button style={s.btnPdf} onClick={() => exportarPDF(cliente, equiposCliente)}>PDF</button>
                  </div>
                </div>

                {/* Mini stats */}
                <div style={s.miniStats}>
                  <div style={{ ...s.miniStat, background: op > 0 ? "#e8f5e9" : "#f5f5f5" }}>
                    <div style={{ ...s.miniNum, color: op > 0 ? "#2e7d32" : "#aaa" }}>{op}</div>
                    <div style={{ ...s.miniLabel, color: op > 0 ? "#2e7d32" : "#aaa" }}>Operativo</div>
                  </div>
                  <div style={{ ...s.miniStat, background: obs > 0 ? "#fff8e1" : "#f5f5f5" }}>
                    <div style={{ ...s.miniNum, color: obs > 0 ? "#e65100" : "#aaa" }}>{obs}</div>
                    <div style={{ ...s.miniLabel, color: obs > 0 ? "#e65100" : "#aaa" }}>Con obs.</div>
                  </div>
                  <div style={{ ...s.miniStat, background: fs > 0 ? "#ffebee" : "#f5f5f5" }}>
                    <div style={{ ...s.miniNum, color: fs > 0 ? "#c62828" : "#aaa" }}>{fs}</div>
                    <div style={{ ...s.miniLabel, color: fs > 0 ? "#c62828" : "#aaa" }}>Fuera serv.</div>
                  </div>
                </div>

                {/* Barra estado */}
                <div style={s.barraWrap}>
                  <div style={s.barra}>
                    {pOp > 0 && <div style={{ width: `${pOp}%`, background: "#43a047", height: "100%" }}></div>}
                    {pObs > 0 && <div style={{ width: `${pObs}%`, background: "#ffa726", height: "100%" }}></div>}
                    {pFs > 0 && <div style={{ width: `${pFs}%`, background: "#ef5350", height: "100%" }}></div>}
                  </div>
                </div>

                {/* BotÃ³n ver equipos */}
                <button
                  style={{ ...s.btnVerLista, background: abierto ? "#1a5fa8" : "white", color: abierto ? "white" : "#1a5fa8" }}
                  onClick={() => navigate(`/admin/cliente/${encodeURIComponent(cliente)}`)}
                >
                 {"â–¼ Ver lista de equipos"}
                </button>

};