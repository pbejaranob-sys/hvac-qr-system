import React, { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs, getDoc, query, where, deleteDoc, doc, updateDoc, addDoc, serverTimestamp, runTransaction } from "firebase/firestore";
import { useNavigate, useParams } from "react-router-dom";
import jsPDF from "jspdf";

const FONT = "'Manrope', -apple-system, sans-serif";

const TIPOS_CON_GAS = [
  "Split Piso Techo", "Split Pared", "Split Ducto", "Split Fancoil", "Split Cassete",
  "Ventana", "Autocontenido", "PrecisiÃ³n", "VRV Evaporador", "VRV Condensador", "Chiller",
];

function useManropeAndBodyReset() {
  useEffect(() => {
    if (!document.getElementById("font-manrope")) {
      const link = document.createElement("link");
      link.id = "font-manrope";
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap";
      document.head.appendChild(link);
    }
    const prevMargin = document.body.style.margin;
    const prevBg = document.body.style.background;
    document.body.style.margin = "0";
    document.body.style.background = "#eef1f6";
    return () => {
      document.body.style.margin = prevMargin;
      document.body.style.background = prevBg;
    };
  }, []);
}

const parsePiso = (p) => {
  if (!p) return [99, 0];
  const s = String(p).toLowerCase().trim();
  const sotanoMatch = s.match(/s[oÃ³]tano\s*(\d*)/);
  if (sotanoMatch) return [-1, -(parseInt(sotanoMatch[1]) || 1)];
  const num = parseFloat(s);
  if (!isNaN(num)) return [0, num];
  return [1, 0];
};

const sortPiso = (a, b) => {
  const [ta, na] = parsePiso(a.piso);
  const [tb, nb] = parsePiso(b.piso);
  return ta !== tb ? ta - tb : na - nb;
};

const SvgCalCron = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.8"/>
    <path d="M4 10h16M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    <path d="M8 14h2M12 14h2M16 14h.01M8 17h2M12 17h2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
);
const SvgFlecha = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ display: "inline", verticalAlign: "-2px" }}>
    <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const SvgEliminar = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const SvgAlerta = ({ color = "currentColor" }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M12 3l9 16H3l9-16z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 10v4M12 17h.01" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);
const SvgEditarChico = ({ color = "currentColor" }) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
    <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const SvgHistorial = ({ color = "currentColor" }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path d="M3 12a9 9 0 1 0 3-6.7" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <path d="M3 4v5h5" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 8v4l3 2" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const SvgReemplazo = ({ color = "currentColor" }) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
    <path d="M17 2l4 4-4 4" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M3 12V10a4 4 0 0 1 4-4h14" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <path d="M7 22l-4-4 4-4" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M21 12v2a4 4 0 0 1-4 4H3" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);
const SvgChevron = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M9 6l6 6-6 6" stroke="#c3cad9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const SvgGota = ({ color = "currentColor" }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
    <path d="M12 2c3 4 6 7.5 6 11.5A6 6 0 0 1 6 13.5C6 9.5 9 6 12 2z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
  </svg>
);
const SvgLista = ({ color = "currentColor" }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
);
const SvgObs = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
    <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ---- ExportaciÃ³n Excel / PDF ----
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
const getRec = (e) => e.recomendacionesArray?.filter(Boolean) ||
  e.recomendaciones?.split(/\n|;/).map(r => r.trim()).filter(Boolean) || [];

const exportarExcelSede = (cliente, sede, equipos) => {
  let item = 1;
  let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"><style>body{font-family:Arial;font-size:9pt;}.titulo{background:#1A4FC0;color:white;font-size:14pt;font-weight:bold;}.header{background:#1a4fc0;color:white;font-weight:bold;font-size:9pt;text-align:center;}.fila{font-size:9pt;}.fila-alt{background:#F8F9FA;font-size:9pt;}.op{background:#e6f7ec;color:#1c7a44;font-weight:bold;text-align:center;}.obs{background:#fff8e6;color:#8a5b0a;font-weight:bold;text-align:center;}.fs{background:#fdeeee;color:#a52b2b;font-weight:bold;text-align:center;}.cod{background:#e5f0ff;color:#1a4fc0;font-weight:bold;text-align:center;font-family:monospace;}td{border:1px solid #E0E0E0;padding:4px 6px;}</style></head><body><table><tr><td colspan="12" class="titulo">HVAC - Sistema de Mantenimiento</td></tr><tr><td colspan="3">Cliente: ${cliente}</td><td colspan="3">Sede: ${sede}</td><td colspan="3">Generado: ${new Date().toLocaleDateString("es-PE")}</td><td colspan="3">Total: ${equipos.length} equipos</td></tr><tr><td colspan="12"></td></tr><tr><td class="header">#</td><td class="header">Codigo</td><td class="header">Piso</td><td class="header">Ambiente</td><td class="header">Tipo</td><td class="header">Marca</td><td class="header">Modelo</td><td class="header">Serie</td><td class="header">Estado</td><td class="header">Ult. Mant.</td><td class="header">Observaciones</td><td class="header">Recomendaciones</td></tr>`;
  equipos.forEach((e, idx) => {
    const ec = e.estado === "Operativo" ? "op" : e.estado === "Operativo con observaciones" ? "obs" : "fs";
    const obsTxt = getObsPDF(e).map(o => o.texto).join(" | ") || "-";
    const recTxt = getRecPDF(e).map(r => typeof r === "string" ? r : r.texto || "").join(" | ") || "-";
    html += `<tr class="${idx % 2 === 0 ? "fila" : "fila-alt"}"><td>${item++}</td><td class="cod">${e.codigo || "-"}</td><td>${e.piso || "-"}</td><td>${e.ambiente || "-"}</td><td>${e.tipoEquipo || "-"}</td><td>${e.marca || "-"}</td><td>${e.modelo || "-"}</td><td>${e.serie || "-"}</td><td class="${ec}">${e.estado || "Operativo"}</td><td>${e.ultimoMantenimiento || "-"}</td><td>${obsTxt}</td><td>${recTxt}</td></tr>`;
  });
  html += `</table></body></html>`;
  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url;
  a.download = `equipos-${cliente.replace(/\s+/g, "-")}-${sede.replace(/\s+/g, "-")}-${new Date().getFullYear()}.xls`;
  a.click(); URL.revokeObjectURL(url);
};

const exportarPDFSede = (cliente, sede, equipos) => {
  const pdf = new jsPDF("l", "mm", "a4");
  const M = 10, PW = 297, CW = PW - M * 2;
  let y = 28;
  pdf.setFillColor(26, 79, 192); pdf.rect(0, 0, PW, 20, "F");
  pdf.setFontSize(13); pdf.setFont("helvetica", "bold"); pdf.setTextColor(255, 255, 255);
  pdf.text("HVAC - Sistema de Mantenimiento", M, 13);
  pdf.setFontSize(10); pdf.setFont("helvetica", "normal");
  pdf.text(`Cliente: ${cliente}   Sede: ${sede}   Generado: ${new Date().toLocaleDateString("es-PE")}   Total: ${equipos.length} equipos`, M, 19);
  const check = (h) => { if (y + h > 195) { pdf.addPage(); y = 15; } };
  const badge = (estado) => {
    if (estado === "Operativo") return { bg: [230, 247, 236], color: [28, 122, 68], txt: "Operativo" };
    if (estado === "Operativo con observaciones") return { bg: [255, 248, 230], color: [138, 91, 10], txt: "Con obs." };
    return { bg: [253, 238, 238], color: [165, 43, 43], txt: estado || "Operativo" };
  };
  equipos.forEach((e, i) => {
    const obsItems = getObsPDF(e); const rec = getRecPDF(e);
    const alturaFicha = 9;
    const alturaObs = obsItems.length === 0 ? 6 : 4 + obsItems.length * 8;
    const alturaTotal = 6 + alturaFicha + alturaObs + 4;
    check(alturaTotal + 4);
    const yTop = y;
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(8); pdf.setTextColor(30, 30, 30);
    pdf.text(String(i + 1) + ".", M, y + 3);
    pdf.text(`${e.ambiente || "-"}`, M + 8, y + 3);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(7.5); pdf.setTextColor(90, 90, 90);
    pdf.text(`${e.tipoEquipo || "-"} \u00b7 ${e.marca || "-"}`, M + 8 + pdf.getTextWidth(`${e.ambiente || "-"}`) + 4, y + 3);
    const bd = badge(e.estado);
    pdf.setFillColor(...bd.bg); pdf.roundedRect(M + CW - 32, y - 1, 32, 5, 1.5, 1.5, "F");
    pdf.setFontSize(7); pdf.setTextColor(...bd.color);
    pdf.text(bd.txt, M + CW - 16, y + 2.5, { align: "center" });
    y += 6;
    pdf.setFillColor(248, 249, 250); pdf.rect(M, y, CW, alturaFicha, "F");
    const campos = [["Codigo", e.codigo || "-"], ["Piso", e.piso || "-"], ["Modelo", e.modelo || "-"], ["Serie", e.serie || "-"], ["Ult. mant.", e.ultimoMantenimiento || "-"], ["Estado", bd.txt]];
    const fcw = CW / 6;
    campos.forEach(([l, v], idx) => {
      const cx = M + idx * fcw + 3;
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(6); pdf.setTextColor(140, 140, 140);
      pdf.text(l, cx, y + 3.5);
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(7); pdf.setTextColor(30, 30, 30);
      pdf.text(String(v), cx, y + 6.8);
    });
    y += alturaFicha + 3;
    if (obsItems.length === 0) {
      pdf.setFont("helvetica", "italic"); pdf.setFontSize(7.5); pdf.setTextColor(160, 160, 160);
      pdf.text("Sin observaciones registradas", M, y + 2); y += 6;
    } else {
      const col0 = 8, colW = (CW - col0) / 3;
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(6); pdf.setTextColor(150, 150, 150);
      pdf.text("Observaci\u00f3n", M + col0 + 2, y); pdf.text("Causa", M + col0 + colW + 2, y); pdf.text("Recomendaci\u00f3n", M + col0 + colW * 2 + 2, y);
      y += 2.5;
      obsItems.forEach((o, idx) => {
        const rowH = 7.5;
        pdf.setFontSize(6.5); pdf.setTextColor(130, 130, 130); pdf.text(String(idx + 1), M, y + 4);
        pdf.setFillColor(255, 248, 230); pdf.rect(M + col0, y, colW - 2, rowH, "F");
        pdf.setFillColor(253, 238, 238); pdf.rect(M + col0 + colW, y, colW - 2, rowH, "F");
        pdf.setFillColor(230, 247, 236); pdf.rect(M + col0 + colW * 2, y, colW - 2, rowH, "F");
        pdf.setFont("helvetica", "normal"); pdf.setFontSize(6.8);
        pdf.setTextColor(138, 91, 10); pdf.text(pdf.splitTextToSize(o.texto, colW - 6).slice(0, 2), M + col0 + 2, y + 3);
        pdf.setTextColor(165, 43, 43); pdf.text(pdf.splitTextToSize(o.causa || "\u2014", colW - 6).slice(0, 2), M + col0 + colW + 2, y + 3);
        const recTxt = rec[idx] ? (typeof rec[idx] === "string" ? rec[idx] : rec[idx].texto || "\u2014") : "\u2014";
        pdf.setTextColor(28, 122, 68); pdf.text(pdf.splitTextToSize(recTxt, colW - 6).slice(0, 2), M + col0 + colW * 2 + 2, y + 3);
        y += rowH + 1;
      });
    }
    y = yTop + alturaTotal;
    pdf.setDrawColor(230, 230, 230); pdf.line(M, y - 2, M + CW, y - 2);
  });
  pdf.save(`equipos-${cliente.replace(/\s+/g, "-")}-${sede.replace(/\s+/g, "-")}-${new Date().getFullYear()}.pdf`);
};

// ============================================================
// COMPONENTE CRONOGRAMA — se inserta como {vista === "cronograma"}
// ============================================================
function CronogramaView({ equipos }) {
  const [subVistaCron, setSubVistaCron] = useState('resumen');
  const [filtroFreqEq, setFiltroFreqEq] = useState('todos');
  const [filtroEstadoEq, setFiltroEstadoEq] = useState('todos');

  const hoy = new Date();
  const MES_HOY = hoy.getMonth();
  const ANIO_HOY = hoy.getFullYear();
  const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

  const FREQ_MESES_MAP = { mensual:1, bimensual:2, trimestral:3, cuatrimestral:4, semestral:6, anual:12 };
  const FREQ_INFO = {
    mensual:      { label:'Mensual',      color:'#7c3fd8', periodos: Array.from({length:12},(_,i)=>({label:MESES[i],meses:[i]})) },
    bimensual:    { label:'Bimensual',    color:'#0d7a6c', periodos: [{label:'Ene-Feb',meses:[0,1]},{label:'Mar-Abr',meses:[2,3]},{label:'May-Jun',meses:[4,5]},{label:'Jul-Ago',meses:[6,7]},{label:'Sep-Oct',meses:[8,9]},{label:'Nov-Dic',meses:[10,11]}] },
    trimestral:   { label:'Trimestral',   color:'#1a4fc0', periodos: [{label:'T1',sublabel:'Ene-Mar',meses:[0,1,2]},{label:'T2',sublabel:'Abr-Jun',meses:[3,4,5]},{label:'T3',sublabel:'Jul-Sep',meses:[6,7,8]},{label:'T4',sublabel:'Oct-Dic',meses:[9,10,11]}] },
    cuatrimestral:{ label:'Cuatrimestral',color:'#a8720b', periodos: [{label:'C1',sublabel:'Ene-Abr',meses:[0,1,2,3]},{label:'C2',sublabel:'May-Ago',meses:[4,5,6,7]},{label:'C3',sublabel:'Sep-Dic',meses:[8,9,10,11]}] },
    semestral:    { label:'Semestral',    color:'#0d6e58', periodos: [{label:'S1',sublabel:'Ene-Jun',meses:[0,1,2,3,4,5]},{label:'S2',sublabel:'Jul-Dic',meses:[6,7,8,9,10,11]}] },
    anual:        { label:'Anual',        color:'#8a92a6', periodos: [{label:'Anual',meses:[0,1,2,3,4,5,6,7,8,9,10,11]}] },
  };

  // Equipos con frecuencia definida
  const eqsConFreq = equipos.filter(e => e.frecuencia && FREQ_INFO[e.frecuencia]);
  const TOTAL = eqsConFreq.length;

  // Estado individual por periodo
  const estadoEq = (eq) => {
    if (!eq.ultimoMantenimiento) return 'sin';
    const ult = new Date(eq.ultimoMantenimiento.includes('/') ? eq.ultimoMantenimiento.split('/').reverse().join('-') : eq.ultimoMantenimiento);
    if (isNaN(ult)) return 'sin';
    const fM = FREQ_MESES_MAP[eq.frecuencia] || 3;
    const vTot = ult.getFullYear() * 12 + ult.getMonth() + fM;
    const hTot = ANIO_HOY * 12 + MES_HOY;
    if (hTot < vTot) return 'aldia';
    if (hTot === vTot) return 'proceso';
    return 'vencido';
  };

  const tieneProtEn = (eq, meses) => (eq.protocolos || []).some(p => {
    if (!p.fecha) return false;
    const d = new Date(p.fecha);
    return meses.includes(d.getMonth()) && d.getFullYear() === ANIO_HOY;
  });

  const estadoPeriodo = (meses) => {
    const hTot = ANIO_HOY * 12 + MES_HOY;
    const min = Math.min(...meses), max = Math.max(...meses);
    if (hTot < ANIO_HOY * 12 + min) return 'futuro';
    if (hTot <= ANIO_HOY * 12 + max) return 'curso';
    return 'pasado';
  };

  const esPeriodoActual = (freq, per) => {
    const meses = per.meses;
    const hTot = ANIO_HOY * 12 + MES_HOY;
    const min = Math.min(...meses), max = Math.max(...meses);
    return hTot >= ANIO_HOY * 12 + min && hTot <= ANIO_HOY * 12 + max;
  };

  // Conteos globales
  const countEstados = { aldia: 0, proceso: 0, vencido: 0, sin: 0 };
  eqsConFreq.forEach(eq => countEstados[estadoEq(eq)]++);
  const pctGlobal = TOTAL > 0 ? Math.round((countEstados.aldia + countEstados.proceso) / TOTAL * 100) : 0;

  // Frecuencias presentes
  const freqsPresentes = [...new Set(eqsConFreq.map(e => e.frecuencia))].filter(f => FREQ_INFO[f]);

  // Colores barras
  const C_VERDE = '#2ecc71';
  const C_ROJO  = '#e05252';
  const C_AZUL  = '#3a8ff0';
  const C_GRIS  = '#e7ebf3';

  const CFG_ESTADO = {
    aldia:   { color:'#1c9a53', bg:'#e6f7ec', dot:'#1c9a53', label:'Al día' },
    proceso: { color:'#1a4fc0', bg:'#e5f0ff', dot:'#1a4fc0', label:'En proceso' },
    vencido: { color:'#c23b3b', bg:'#fdeeee', dot:'#c23b3b', label:'Vencido' },
    sin:     { color:'#8a92a6', bg:'#f4f6fb', dot:'#c3cad9', label:'Sin fecha' },
  };

  const FONT = "'Manrope', -apple-system, sans-serif";

  // ---- Barra apilada vertical ----
  const BarraVertical = ({ real, total, est, isActual, h = 72 }) => {
    const pendiente = total - real;
    const hReal = real > 0 ? Math.round(real / total * h) : 0;
    const hPend = h - hReal;
    if (est === 'futuro') return (
      <div style={{ width: '100%', height: h, background: C_GRIS, borderRadius: '5px 5px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: '7px', color: '#b0b8c9', fontWeight: 700, transform: 'rotate(-90deg)', whiteSpace: 'nowrap' }}>prog.</span>
      </div>
    );
    if (est === 'curso') return (
      <div style={{ width: '100%', height: h, borderRadius: '5px 5px 0 0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {hPend > 0 && <div style={{ flex: hPend, background: C_AZUL, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {pendiente > 0 && <span style={{ fontSize: '9px', fontWeight: 800, color: '#fff' }}>{pendiente}</span>}
        </div>}
        {hReal > 0 && <div style={{ flex: hReal, background: C_VERDE, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {real > 0 && <span style={{ fontSize: '9px', fontWeight: 800, color: '#fff' }}>{real}</span>}
        </div>}
      </div>
    );
    return (
      <div style={{ width: '100%', height: h, borderRadius: '5px 5px 0 0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {hPend > 0 && <div style={{ flex: hPend, background: C_ROJO, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {pendiente > 0 && <span style={{ fontSize: '9px', fontWeight: 800, color: '#fff' }}>{pendiente}</span>}
        </div>}
        {hReal > 0 && <div style={{ flex: hReal, background: C_VERDE, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {real > 0 && <span style={{ fontSize: '9px', fontWeight: 800, color: '#fff' }}>{real}</span>}
        </div>}
      </div>
    );
  };

  // ---- FreqCard: card por frecuencia con barras ----
  const FreqCard = ({ freq }) => {
    const info = FREQ_INFO[freq];
    const eqsF = eqsConFreq.filter(e => e.frecuencia === freq);
    const total = eqsF.length;
    const ests = eqsF.map(estadoEq);
    const d = { aldia: ests.filter(e => e === 'aldia').length, proceso: ests.filter(e => e === 'proceso').length, vencido: ests.filter(e => e === 'vencido').length, sin: ests.filter(e => e === 'sin').length };
    const ok = d.aldia + d.proceso;
    const p = Math.round(ok / total * 100);

    return (
      <div style={{ background: '#fff', border: '1px solid #e7ebf3', borderRadius: 14, padding: 16, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ background: info.color + '18', color: info.color, fontWeight: 700, fontSize: 11, padding: '3px 10px', borderRadius: 20 }}>{info.label}</span>
            <span style={{ fontSize: 11, color: '#8a92a6', fontWeight: 600 }}>{total} equipos</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', height: 8, width: 60, borderRadius: 4, overflow: 'hidden', gap: 1 }}>
              <div style={{ width: Math.round(d.aldia/total*100)+'%', background: '#1c9a53' }}></div>
              <div style={{ width: Math.round(d.proceso/total*100)+'%', background: '#1a4fc0' }}></div>
              <div style={{ width: Math.round(d.vencido/total*100)+'%', background: '#c23b3b' }}></div>
              <div style={{ width: Math.round(d.sin/total*100)+'%', background: '#c3cad9' }}></div>
            </div>
            <span style={{ fontWeight: 800, fontSize: 13, color: p >= 80 ? '#1c9a53' : p >= 50 ? '#f3a827' : '#c23b3b' }}>{p}%</span>
          </div>
        </div>

        {/* Barras verticales */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 88 }}>
          {info.periodos.map((per, idx) => {
            const real = eqsF.filter(eq => tieneProtEn(eq, per.meses)).length;
            const est = estadoPeriodo(per.meses);
            const isActual = esPeriodoActual(freq, per);
            const numColor = est === 'futuro' ? 'transparent' : est === 'curso' ? C_AZUL : real === total ? C_VERDE : real > 0 ? '#a8720b' : C_ROJO;
            return (
              <div key={idx}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 2,
                  opacity: isActual ? 1 : 0.22, transition: 'opacity 0.2s', cursor: 'pointer' }}
                onMouseEnter={e => { if (!isActual) e.currentTarget.style.opacity = '0.90'; }}
                onMouseLeave={e => { if (!isActual) e.currentTarget.style.opacity = '0.22'; }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: numColor, minHeight: 14, display: 'flex', alignItems: 'flex-end' }}>
                  {est !== 'futuro' ? `${real}/${total}` : ''}
                </div>
                <BarraVertical real={real} total={total} est={est} isActual={isActual} h={68} />
                {isActual && <div style={{ width: '100%', height: 3, background: info.color, borderRadius: 2, marginTop: 2 }}></div>}
              </div>
            );
          })}
        </div>
        <div style={{ height: 1, background: '#eef1f6', marginTop: 0 }}></div>
        <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
          {info.periodos.map((per, idx) => {
            const isActual = esPeriodoActual(freq, per);
            return (
              <div key={idx} style={{ flex: 1, textAlign: 'center', fontSize: freq === 'mensual' ? 8 : 9, fontWeight: isActual ? 800 : 500, color: isActual ? info.color : '#c3cad9' }}>
                {per.label}
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10, paddingTop: 8, borderTop: '1px solid #eef1f6' }}>
          <span style={{ fontSize: 10.5, color: '#1c9a53', fontWeight: 700 }}>✓ Al día: {d.aldia}</span>
          <span style={{ fontSize: 10.5, color: '#1a4fc0', fontWeight: 700 }}>● Proceso: {d.proceso}</span>
          <span style={{ fontSize: 10.5, color: '#c23b3b', fontWeight: 700 }}>✗ Vencido: {d.vencido}</span>
          {d.sin > 0 && <span style={{ fontSize: 10.5, color: '#8a92a6', fontWeight: 700 }}>— Sin fecha: {d.sin}</span>}
        </div>
      </div>
    );
  };

  // ---- Vista Cronograma por periodos ----
  const CronogramaDetalle = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {freqsPresentes.map(freq => {
        const info = FREQ_INFO[freq];
        const eqsF = eqsConFreq.filter(e => e.frecuencia === freq);
        const total = eqsF.length;
        return (
          <div key={freq} style={{ background: '#fff', border: '1px solid #e7ebf3', borderRadius: 14, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ background: info.color + '18', color: info.color, fontWeight: 700, fontSize: 11, padding: '3px 10px', borderRadius: 20 }}>{info.label}</span>
              <span style={{ fontSize: 11, color: '#8a92a6', fontWeight: 600 }}>{total} equipos</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {info.periodos.map((per, idx) => {
                const real = eqsF.filter(eq => tieneProtEn(eq, per.meses)).length;
                const est = estadoPeriodo(per.meses);
                const pendiente = total - real;
                const pct2 = Math.round(real / total * 100);
                const isActual = esPeriodoActual(freq, per);
                let bg, border, titColor, badge;
                if (est === 'futuro') { bg = '#f9fafc'; border = '#eef1f6'; titColor = '#8a92a6'; badge = 'Programado'; }
                else if (est === 'curso') { bg = '#eef6ff'; border = '#c3d6fb'; titColor = '#1a4fc0'; badge = 'En curso ●'; }
                else {
                  if (real === total) { bg = '#e6f7ec'; border = '#c3ecd2'; titColor = '#1c9a53'; badge = 'Completo ✓'; }
                  else if (real > 0) { bg = '#fffdf4'; border = '#f3dfa3'; titColor = '#a8720b'; badge = 'Parcial'; }
                  else { bg = '#fff5f5'; border = '#f6d3d3'; titColor = '#c23b3b'; badge = 'No ejecutado ✗'; }
                }
                return (
                  <div key={idx} style={{ background: bg, border: `1.5px solid ${border}`, borderRadius: 12, padding: '10px 13px', boxShadow: isActual ? '0 2px 10px rgba(26,79,192,0.12)' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 800, fontSize: 12.5, color: '#12245e' }}>{per.label}{per.sublabel ? ` · ${per.sublabel}` : ''}</span>
                        <span style={{ fontWeight: 700, fontSize: 10, padding: '2px 8px', borderRadius: 20, background: border, color: titColor }}>{badge}</span>
                      </div>
                      <span style={{ fontWeight: 800, fontSize: 14, color: titColor }}>{real}/{total}</span>
                    </div>
                    <div style={{ height: 10, borderRadius: 5, overflow: 'hidden', display: 'flex', gap: 2 }}>
                      {real > 0 && <div style={{ flex: real, background: C_VERDE, borderRadius: 5 }}></div>}
                      {est === 'curso' && pendiente > 0 && <div style={{ flex: pendiente, background: C_AZUL, borderRadius: 5 }}></div>}
                      {est === 'pasado' && pendiente > 0 && <div style={{ flex: pendiente, background: C_ROJO, borderRadius: 5 }}></div>}
                      {est === 'futuro' && <div style={{ flex: total, background: C_GRIS, borderRadius: 5 }}></div>}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
                      <div style={{ display: 'flex', gap: 10 }}>
                        {real > 0 && <span style={{ fontSize: 10, color: '#1c9a53', fontWeight: 700 }}>✓ {real} realizados</span>}
                        {est === 'curso' && pendiente > 0 && <span style={{ fontSize: 10, color: '#1a4fc0', fontWeight: 700 }}>● {pendiente} pendientes</span>}
                        {est === 'pasado' && pendiente > 0 && <span style={{ fontSize: 10, color: '#c23b3b', fontWeight: 700 }}>✗ {pendiente} vencidos</span>}
                      </div>
                      {est !== 'futuro' && <span style={{ fontSize: 10, color: titColor, fontWeight: 700 }}>{pct2}%</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );

  // ---- Vista Por equipo ----
  const PorEquipo = () => {
    const filtrados = eqsConFreq.filter(eq => {
      const okE = filtroEstadoEq === 'todos' || estadoEq(eq) === filtroEstadoEq;
      const okF = filtroFreqEq === 'todos' || eq.frecuencia === filtroFreqEq;
      return okE && okF;
    });
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ fontWeight: 800, fontSize: 13, color: '#12245e' }}>Lista de equipos</span>
          <span style={{ background: '#e5f0ff', color: '#1a4fc0', fontWeight: 700, fontSize: 11, padding: '3px 9px', borderRadius: 20 }}>{filtrados.length} equipos</span>
        </div>
        {/* Filtro estado */}
        <div style={{ fontSize: 10, color: '#c3cad9', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6 }}>Estado</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {[['todos','Todos',TOTAL,'#26314d','#f4f6fb','#e7ebf3'],['aldia','Al día',countEstados.aldia,'#1c9a53','#e6f7ec','#c3ecd2'],['proceso','En proceso',countEstados.proceso,'#1a4fc0','#e5f0ff','#c3d6fb'],['vencido','Vencido',countEstados.vencido,'#a52b2b','#fdeeee','#f6d3d3'],['sin','Sin fecha',countEstados.sin,'#8a92a6','#f4f6fb','#e7ebf3']].map(([k,lbl,n,color,bg,border]) => (
            <button key={k} onClick={() => setFiltroEstadoEq(k)}
              style={{ borderRadius: 20, padding: '5px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: FONT, background: filtroEstadoEq === k ? color : bg, color: filtroEstadoEq === k ? '#fff' : color, border: `1.5px solid ${border}` }}>
              {lbl} {n}
            </button>
          ))}
        </div>
        {/* Filtro frecuencia */}
        <div style={{ fontSize: 10, color: '#c3cad9', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6 }}>Frecuencia</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {[['todos','Todas'],...freqsPresentes.map(f => [f, FREQ_INFO[f].label + ' ('+eqsConFreq.filter(e=>e.frecuencia===f).length+')'])].map(([k,lbl]) => {
            const color = k === 'todos' ? '#26314d' : FREQ_INFO[k]?.color || '#26314d';
            const bg = k === 'todos' ? '#f4f6fb' : color + '18';
            return (
              <button key={k} onClick={() => setFiltroFreqEq(k)}
                style={{ borderRadius: 20, padding: '5px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: FONT, background: filtroFreqEq === k ? color : bg, color: filtroFreqEq === k ? '#fff' : color, border: `1.5px solid ${color}30` }}>
                {lbl}
              </button>
            );
          })}
        </div>
        {/* Lista */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtrados.map(eq => {
            const est = estadoEq(eq);
            const cfg = CFG_ESTADO[est];
            const fM = FREQ_MESES_MAP[eq.frecuencia] || 3;
            const MESES_L = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
            let nextStr = '—';
            if (eq.ultimoMantenimiento) {
              const ult = new Date(eq.ultimoMantenimiento.includes('/') ? eq.ultimoMantenimiento.split('/').reverse().join('-') : eq.ultimoMantenimiento);
              if (!isNaN(ult)) {
                const vTot = ult.getFullYear() * 12 + ult.getMonth() + fM;
                nextStr = MESES_L[vTot % 12] + ' ' + Math.floor(vTot / 12);
              }
            }
            const fc = FREQ_INFO[eq.frecuencia]?.color || '#8a92a6';
            return (
              <div key={eq.id} style={{ background: '#fff', border: '1px solid #e7ebf3', borderRadius: 12, padding: '11px 13px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }}></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#0f1b3d', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{eq.ambiente || eq.codigo || '—'}</div>
                  <div style={{ fontSize: 11, color: '#8a92a6', fontWeight: 600, marginTop: 1 }}>
                    Piso {eq.piso || '—'} · <span style={{ color: fc, fontWeight: 700 }}>{FREQ_INFO[eq.frecuencia]?.label}</span> · {eq.tipoEquipo}
                  </div>
                  {eq.ultimoMantenimiento && <div style={{ fontSize: 10.5, color: '#8a92a6', marginTop: 1 }}>Último: {eq.ultimoMantenimiento}</div>}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 10.5, padding: '3px 9px', borderRadius: 20, background: cfg.bg, color: cfg.color }}>{cfg.label}</div>
                  <div style={{ fontSize: 10, color: '#8a92a6', fontWeight: 600, marginTop: 3 }}>Vence: {nextStr}</div>
                </div>
              </div>
            );
          })}
          {filtrados.length === 0 && (
            <div style={{ textAlign: 'center', color: '#aab1c2', fontStyle: 'italic', padding: '20px 0', fontSize: 13 }}>
              No hay equipos con estos filtros
            </div>
          )}
        </div>
      </div>
    );
  };

  if (TOTAL === 0) return (
    <div style={{ textAlign: 'center', padding: '40px 20px', color: '#8a92a6' }}>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Sin datos de cronograma</div>
      <div style={{ fontSize: 13 }}>Asigna una frecuencia de mantenimiento a cada equipo desde el formulario de registro.</div>
    </div>
  );

  return (
    <div>
      {/* Tabs internos del cronograma */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, background: '#fff', border: '1px solid #e7ebf3', borderRadius: 14, padding: 10 }}>
        {[['resumen','Resumen'],['cronograma','Cronograma'],['equipo','Por equipo']].map(([k,lbl]) => (
          <button key={k} onClick={() => setSubVistaCron(k)}
            style={{ flex: 1, textAlign: 'center', padding: '8px 6px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none', fontFamily: FONT, background: subVistaCron === k ? '#1a4fc0' : '#f4f6fb', color: subVistaCron === k ? '#fff' : '#6b7488' }}>
            {lbl}
          </button>
        ))}
      </div>

      {/* RESUMEN */}
      {subVistaCron === 'resumen' && (
        <div>
          {/* Stats globales */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
            {[['Al día',countEstados.aldia,'#1c9a53','#e6f7ec','#c3ecd2'],['En proceso',countEstados.proceso,'#1a4fc0','#e5f0ff','#c3d6fb'],['Vencidos',countEstados.vencido,'#a52b2b','#fdeeee','#f6d3d3'],['Sin fecha',countEstados.sin,'#8a92a6','#f4f6fb','#e7ebf3']].map(([lbl,n,color,bg,border]) => (
              <div key={lbl} style={{ background: bg, border: `1.5px solid ${border}`, borderRadius: 12, padding: '13px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                <div style={{ fontWeight: 800, fontSize: 24, color }}>{n}</div>
                <div style={{ fontWeight: 700, fontSize: 10, color: '#6b7488', letterSpacing: '0.04em', textAlign: 'center' }}>{lbl.toUpperCase()}</div>
              </div>
            ))}
          </div>
          {/* Barra global */}
          <div style={{ background: '#fff', border: '1px solid #e7ebf3', borderRadius: 14, padding: 14, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontWeight: 800, fontSize: 13, color: '#12245e' }}>Avance global {ANIO_HOY}</span>
              <span style={{ fontWeight: 800, fontSize: 15, color: pctGlobal >= 80 ? '#1c9a53' : pctGlobal >= 50 ? '#f3a827' : '#c23b3b' }}>{pctGlobal}%</span>
            </div>
            <div style={{ display: 'flex', height: 12, borderRadius: 6, overflow: 'hidden', gap: 2, marginBottom: 8 }}>
              <div style={{ width: Math.round(countEstados.aldia/TOTAL*100)+'%', background: '#1c9a53', borderRadius: 6 }}></div>
              <div style={{ width: Math.round(countEstados.proceso/TOTAL*100)+'%', background: '#1a4fc0', borderRadius: 6 }}></div>
              <div style={{ width: Math.round(countEstados.vencido/TOTAL*100)+'%', background: '#c23b3b', borderRadius: 6 }}></div>
              <div style={{ width: Math.round(countEstados.sin/TOTAL*100)+'%', background: '#c3cad9', borderRadius: 6 }}></div>
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {[['#2ecc71','Realizados'],['#e05252','Vencidos'],['#3a8ff0','En proceso']].map(([c,lbl]) => (
                <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: c }}></div>
                  <span style={{ fontSize: 10.5, color: '#6b7488', fontWeight: 600 }}>{c === '#2ecc71' ? 'Verde' : c === '#e05252' ? 'Rojo' : 'Azul'} = {lbl}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Cards por frecuencia */}
          {freqsPresentes.map(freq => <FreqCard key={freq} freq={freq} />)}
        </div>
      )}

      {/* CRONOGRAMA */}
      {subVistaCron === 'cronograma' && <CronogramaDetalle />}

      {/* POR EQUIPO */}
      {subVistaCron === 'equipo' && <PorEquipo />}
    </div>
  );
}

export default function VistaSede() {
  useManropeAndBodyReset();

  const { clienteNombre, sedeNombre } = useParams();
  const cliente = decodeURIComponent(clienteNombre);
  const sede = decodeURIComponent(sedeNombre);
  const [equipos, setEquipos] = useState([]);
  const [pisoFiltro, setPisoFiltro] = useState("Todos");
  const [tipoFiltro, setTipoFiltro] = useState("Todos");
  const [estadoFiltro, setEstadoFiltro] = useState("Todos");
  const [mesFiltro, setMesFiltro] = useState("Todos");

  const [averias, setAverias] = useState([]);
  const [detalleAveria, setDetalleAveria] = useState(null);
  const [listaEmergencia, setListaEmergencia] = useState(null);
  const [historialAverias, setHistorialAverias] = useState(null);
  const [historialAbierto, setHistorialAbierto] = useState(false);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);

  const [vista, setVista] = useState("equipos");
  const [movimientos, setMovimientos] = useState(null);
  const [kgRecuperadosHistorico, setKgRecuperadosHistorico] = useState(null);
  const [cargandoMovimientos, setCargandoMovimientos] = useState(false);
  const [modalCargaAbierto, setModalCargaAbierto] = useState(false);
  const [formCarga, setFormCarga] = useState({ equipoId: "", tipo: "carga", kg: "", fecha: new Date().toISOString().split("T")[0], tecnico: "" });
  const [guardandoCarga, setGuardandoCarga] = useState(false);

  const [historialesEquipo, setHistorialesEquipo] = useState({});
  const [historialEquipoAbierto, setHistorialEquipoAbierto] = useState({});
  const [cargandoHistorialEquipo, setCargandoHistorialEquipo] = useState({});
  const [modalReemplazoAbierto, setModalReemplazoAbierto] = useState(null);
  const [formReemplazo, setFormReemplazo] = useState({
    marca: "", modelo: "", serie: "", capacidad: "",
    tipoRefrigerante: "", fases: "MonofÃ¡sico", voltaje: "", amperaje: "",
    cargaNominal: "", cargaAdicionalInstalacion: "", kgRecuperados: "",
  });
  const [guardandoReemplazo, setGuardandoReemplazo] = useState(false);
  const [historialCargasAbierto, setHistorialCargasAbierto] = useState({});
  const [editandoHistorialItem, setEditandoHistorialItem] = useState(null);
  const [formEditHistorial, setFormEditHistorial] = useState({
    marca: "", modelo: "", serie: "", capacidad: "",
    tipoRefrigerante: "", fases: "MonofÃ¡sico", voltaje: "", amperaje: "", cargaNominal: "",
    fechaInstalacion: "", fechaBaja: "",
  });
  const [guardandoEditHistorial, setGuardandoEditHistorial] = useState(false);

  // NUEVO: estado para observaciones expandibles
  const [obsAbiertas, setObsAbiertas] = useState({});
  const toggleObs = (id) => setObsAbiertas(prev => ({ ...prev, [id]: !prev[id] }));

  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) cargarEquipos(user.uid);
    });
    return () => unsubscribe();
  }, [clienteNombre, sedeNombre]);

  const cargarEquipos = async (uid) => {
    const q = query(collection(db, "equipos"),
      where("adminid", "==", uid),
      where("cliente", "==", cliente),
      where("sede", "==", sede)
    );
    const snap = await getDocs(q);
    const todos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    setEquipos(todos.filter(e => e.cicloVida !== "reemplazado"));
    try {
      const qA = query(collection(db, "averias"),
        where("cliente", "==", cliente),
        where("sede", "==", sede),
        where("atendida", "==", false)
      );
      const snapA = await getDocs(qA);
      setAverias(snapA.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch { setAverias([]); }
  };

  const handleEliminar = async (equipoId) => {
    if (!window.confirm("Â¿Eliminar este equipo? Esta acciÃ³n no se puede deshacer.")) return;
    await deleteDoc(doc(db, "equipos", equipoId));
    setEquipos(prev => prev.filter(e => e.id !== equipoId));
  };

  const toggleHistorialEquipo = async (eq) => {
    const abierto = historialEquipoAbierto[eq.id];
    setHistorialEquipoAbierto(prev => ({ ...prev, [eq.id]: !abierto }));
    if (abierto || historialesEquipo[eq.id] || !eq.equipoAnteriorId) return;
    setCargandoHistorialEquipo(prev => ({ ...prev, [eq.id]: true }));
    try {
      const cadena = [];
      let cursorId = eq.equipoAnteriorId;
      while (cursorId) {
        const snap = await getDoc(doc(db, "equipos", cursorId));
        if (!snap.exists()) break;
        const data = { id: snap.id, ...snap.data() };
        cadena.push(data);
        cursorId = data.equipoAnteriorId || null;
      }
      await Promise.all(cadena.map(async (h) => {
        try {
          const movSnap = await getDocs(query(collection(db, "movimientosRefrigerante"), where("equipoId", "==", h.id), where("tipo", "==", "recuperacion_baja")));
          h.kgRecuperados = movSnap.docs.reduce((acc, d) => acc + (Number(d.data().kg) || 0), 0);
        } catch { h.kgRecuperados = null; }
      }));
      setHistorialesEquipo(prev => ({ ...prev, [eq.id]: cadena }));
    } catch (e) {
      console.error("Error cargando historial del equipo:", e);
      setHistorialesEquipo(prev => ({ ...prev, [eq.id]: [] }));
    }
    setCargandoHistorialEquipo(prev => ({ ...prev, [eq.id]: false }));
  };

  const abrirEditarHistorialItem = async (ownerId, item) => {
    setEditandoHistorialItem({ ownerId, item });
    setFormEditHistorial({ marca: item.marca || "", modelo: item.modelo || "", serie: item.serie || "", capacidad: item.capacidad || "", tipoRefrigerante: item.tipoRefrigerante || "", fases: item.fases || "MonofÃ¡sico", voltaje: item.voltaje || "", amperaje: item.amperaje || "", cargaNominal: item.cargaNominal || "", fechaInstalacion: item.fechaInstalacion || "", fechaBaja: item.fechaBaja || "", cargaAdicionalInstalacion: "", cargaAdicionalMovId: null, kgRecuperados: "", kgRecuperadosMovId: null });
    try {
      const snap = await getDocs(query(collection(db, "movimientosRefrigerante"), where("equipoId", "==", item.id)));
      const movs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const cargaInicial = movs.find(m => m.tipo === "carga");
      const recuperacion = movs.find(m => m.tipo === "recuperacion_baja");
      setFormEditHistorial(prev => ({ ...prev, cargaAdicionalInstalacion: cargaInicial ? String(cargaInicial.kg) : "", cargaAdicionalMovId: cargaInicial ? cargaInicial.id : null, kgRecuperados: recuperacion ? String(recuperacion.kg) : "", kgRecuperadosMovId: recuperacion ? recuperacion.id : null }));
    } catch (e) { console.error("Error cargando movimientos del historial:", e); }
  };

  const guardarEditHistorial = async (e) => {
    e.preventDefault();
    if (!editandoHistorialItem) return;
    setGuardandoEditHistorial(true);
    try {
      const { ownerId, item } = editandoHistorialItem;
      const { cargaAdicionalInstalacion, cargaAdicionalMovId, kgRecuperados, kgRecuperadosMovId, ...datosEquipo } = formEditHistorial;
      await updateDoc(doc(db, "equipos", item.id), datosEquipo);
      if (cargaAdicionalInstalacion && Number(cargaAdicionalInstalacion) > 0) {
        if (cargaAdicionalMovId) { await updateDoc(doc(db, "movimientosRefrigerante", cargaAdicionalMovId), { kg: Number(cargaAdicionalInstalacion) }); }
        else { await addDoc(collection(db, "movimientosRefrigerante"), { equipoId: item.id, equipoAmbiente: item.ambiente || "", equipoCodigo: item.codigo || "", cliente, sede, tipo: "carga", kg: Number(cargaAdicionalInstalacion), fecha: datosEquipo.fechaInstalacion || new Date().toISOString().split("T")[0], tecnico: "", fechaRegistro: serverTimestamp() }); }
      }
      if (kgRecuperados && Number(kgRecuperados) > 0) {
        if (kgRecuperadosMovId) { await updateDoc(doc(db, "movimientosRefrigerante", kgRecuperadosMovId), { kg: Number(kgRecuperados) }); }
        else { await addDoc(collection(db, "movimientosRefrigerante"), { equipoId: item.id, equipoAmbiente: item.ambiente || "", equipoCodigo: item.codigo || "", cliente, sede, tipo: "recuperacion_baja", kg: Number(kgRecuperados), fecha: datosEquipo.fechaBaja || new Date().toISOString().split("T")[0], tecnico: "", fechaRegistro: serverTimestamp() }); }
      }
      setHistorialesEquipo(prev => ({ ...prev, [ownerId]: (prev[ownerId] || []).map(h => h.id === item.id ? { ...h, ...datosEquipo, kgRecuperados: Number(kgRecuperados) || 0 } : h) }));
      setEditandoHistorialItem(null);
      setKgRecuperadosHistorico(null);
      cargarRecuperacionHistorica(true);
    } catch (err) { alert("Error al guardar: " + err.message); }
    setGuardandoEditHistorial(false);
  };

  const eliminarHistorialItem = async (eq, idx) => {
    const cadena = historialesEquipo[eq.id] || [];
    const item = cadena[idx];
    if (!item) return;
    if (!window.confirm(`Â¿Eliminar "${item.marca} ${item.modelo}" del historial? Esta acciÃ³n no se puede deshacer.`)) return;
    const predecesorId = item.equipoAnteriorId || null;
    const sucesorId = idx === 0 ? eq.id : cadena[idx - 1].id;
    try {
      await deleteDoc(doc(db, "equipos", item.id));
      await updateDoc(doc(db, "equipos", sucesorId), { equipoAnteriorId: predecesorId });
      if (predecesorId) { await updateDoc(doc(db, "equipos", predecesorId), { equipoReemplazoId: sucesorId }); }
      if (sucesorId === eq.id) {
        await updateDoc(doc(db, "equipos", eq.id), { historialCount: Math.max(0, (eq.historialCount || 1) - 1) });
        setEquipos(prev => prev.map(e => e.id === eq.id ? { ...e, equipoAnteriorId: predecesorId, historialCount: Math.max(0, (e.historialCount || 1) - 1) } : e));
      }
      setHistorialesEquipo(prev => ({ ...prev, [eq.id]: cadena.filter((_, i) => i !== idx) }));
    } catch (err) { alert("Error al eliminar: " + err.message); }
  };

  const abrirModalReemplazo = (eq) => {
    setModalReemplazoAbierto(eq);
    setFormReemplazo({ marca: "", modelo: "", serie: "", capacidad: eq.capacidad || "", tipoRefrigerante: eq.tipoRefrigerante || "", fases: eq.fases || "MonofÃ¡sico", voltaje: eq.voltaje || "", amperaje: eq.amperaje || "", cargaNominal: eq.cargaNominal || "", cargaAdicionalInstalacion: "", kgRecuperados: "" });
  };

  const guardarReemplazo = async (e) => {
    e.preventDefault();
    if (!modalReemplazoAbierto || !formReemplazo.marca) return;
    setGuardandoReemplazo(true);
    const equipoViejoId = modalReemplazoAbierto.id;
    try {
      const nuevoRef = doc(collection(db, "equipos"));
      const movRecuperacionRef = (formReemplazo.kgRecuperados && Number(formReemplazo.kgRecuperados) > 0) ? doc(collection(db, "movimientosRefrigerante")) : null;
      const movCargaInicialRef = (formReemplazo.cargaAdicionalInstalacion && Number(formReemplazo.cargaAdicionalInstalacion) > 0) ? doc(collection(db, "movimientosRefrigerante")) : null;
      await runTransaction(db, async (tx) => {
        const viejoRef = doc(db, "equipos", equipoViejoId);
        const viejoSnap = await tx.get(viejoRef);
        if (!viejoSnap.exists()) throw new Error("El equipo original ya no existe.");
        const viejo = viejoSnap.data();
        const hoy = new Date().toISOString().split("T")[0];
        tx.set(nuevoRef, { cliente, sede, adminid: auth.currentUser?.uid || "", codigo: viejo.codigo || "", piso: viejo.piso || "", ambiente: viejo.ambiente || "", tipoEquipo: viejo.tipoEquipo || "", marca: formReemplazo.marca, modelo: formReemplazo.modelo, serie: formReemplazo.serie, capacidad: formReemplazo.capacidad, tipoRefrigerante: formReemplazo.tipoRefrigerante, fases: formReemplazo.fases, voltaje: formReemplazo.voltaje, amperaje: formReemplazo.amperaje, cargaNominal: formReemplazo.cargaNominal, estado: "Operativo", cicloVida: "activo", equipoAnteriorId: equipoViejoId, equipoReemplazoId: null, historialCount: (viejo.historialCount || 0) + 1, fechaInstalacion: hoy, fechaBaja: null, fechaRegistro: hoy });
        tx.update(viejoRef, { cicloVida: "reemplazado", fechaBaja: hoy, equipoReemplazoId: nuevoRef.id });
        if (movRecuperacionRef) { tx.set(movRecuperacionRef, { equipoId: equipoViejoId, equipoAmbiente: viejo.ambiente || "", equipoCodigo: viejo.codigo || "", cliente, sede, tipo: "recuperacion_baja", kg: Number(formReemplazo.kgRecuperados), fecha: hoy, tecnico: "", fechaRegistro: serverTimestamp() }); }
        if (movCargaInicialRef) { tx.set(movCargaInicialRef, { equipoId: nuevoRef.id, equipoAmbiente: viejo.ambiente || "", equipoCodigo: viejo.codigo || "", cliente, sede, tipo: "carga", kg: Number(formReemplazo.cargaAdicionalInstalacion), fecha: hoy, tecnico: "", fechaRegistro: serverTimestamp() }); }
      });
      setModalReemplazoAbierto(null);
      setHistorialesEquipo({}); setHistorialEquipoAbierto({});
      cargarEquipos(auth.currentUser?.uid);
      if (movRecuperacionRef) { setKgRecuperadosHistorico(null); cargarRecuperacionHistorica(true); }
    } catch (err) { alert("Error al reemplazar el equipo: " + err.message); }
    setGuardandoReemplazo(false);
  };

  const equiposConGas = equipos.filter(e => TIPOS_CON_GAS.includes(e.tipoEquipo));

  const cargarMovimientos = async () => {
    if (movimientos !== null || equiposConGas.length === 0) return;
    setCargandoMovimientos(true);
    try {
      const ids = equiposConGas.map(e => e.id);
      const chunks = [];
      for (let i = 0; i < ids.length; i += 10) chunks.push(ids.slice(i, i + 10));
      const resultados = await Promise.all(chunks.map(chunk => getDocs(query(collection(db, "movimientosRefrigerante"), where("equipoId", "in", chunk)))));
      setMovimientos(resultados.flatMap(snap => snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    } catch (e) { console.error("Error cargando movimientos de refrigerante:", e); setMovimientos([]); }
    setCargandoMovimientos(false);
  };

  const cargarRecuperacionHistorica = async (force = false) => {
    if (kgRecuperadosHistorico !== null && !force) return;
    try {
      const snap = await getDocs(query(collection(db, "movimientosRefrigerante"), where("sede", "==", sede), where("tipo", "==", "recuperacion_baja")));
      setKgRecuperadosHistorico(snap.docs.reduce((acc, d) => acc + (Number(d.data().kg) || 0), 0));
    } catch (e) { console.error("Error cargando recuperaciÃ³n histÃ³rica:", e); setKgRecuperadosHistorico(0); }
  };

  const irARefrigerantes = () => { setVista("refrigerantes"); cargarMovimientos(); cargarRecuperacionHistorica(); };

  const [editandoMovimiento, setEditandoMovimiento] = useState(null);

  const abrirModalCarga = (equipoIdPreseleccionado = "") => {
    setEditandoMovimiento(null);
    setFormCarga({ equipoId: equipoIdPreseleccionado, tipo: "carga", kg: "", fecha: new Date().toISOString().split("T")[0], tecnico: "" });
    setModalCargaAbierto(true);
  };
  const abrirEditarMovimiento = (mov) => { setEditandoMovimiento(mov); setFormCarga({ equipoId: mov.equipoId, tipo: mov.tipo, kg: String(mov.kg), fecha: mov.fecha, tecnico: mov.tecnico || "" }); setModalCargaAbierto(true); };
  const handleEliminarMovimiento = async (movId) => {
    if (!window.confirm("Â¿Eliminar este registro de refrigerante? Esta acciÃ³n no se puede deshacer.")) return;
    try { await deleteDoc(doc(db, "movimientosRefrigerante", movId)); setMovimientos(prev => (prev || []).filter(m => m.id !== movId)); } catch (err) { alert("Error al eliminar: " + err.message); }
  };

  const guardarCarga = async (e) => {
    e.preventDefault();
    if (!formCarga.equipoId || !formCarga.kg) return;
    setGuardandoCarga(true);
    try {
      const eq = equipos.find(x => x.id === formCarga.equipoId);
      if (editandoMovimiento) {
        const actualizado = { tipo: formCarga.tipo, kg: Number(formCarga.kg), fecha: formCarga.fecha, tecnico: formCarga.tecnico };
        await updateDoc(doc(db, "movimientosRefrigerante", editandoMovimiento.id), actualizado);
        setMovimientos(prev => (prev || []).map(m => m.id === editandoMovimiento.id ? { ...m, ...actualizado } : m));
      } else {
        const nuevo = { equipoId: formCarga.equipoId, equipoAmbiente: eq?.ambiente || "", equipoCodigo: eq?.codigo || "", cliente, sede, tipo: formCarga.tipo, kg: Number(formCarga.kg), fecha: formCarga.fecha, tecnico: formCarga.tecnico, fechaRegistro: serverTimestamp() };
        const ref = await addDoc(collection(db, "movimientosRefrigerante"), nuevo);
        setMovimientos(prev => [{ id: ref.id, ...nuevo, fechaRegistro: { toDate: () => new Date() } }, ...(prev || [])]);
      }
      setModalCargaAbierto(false); setEditandoMovimiento(null);
    } catch (err) { alert("Error al guardar: " + err.message); }
    setGuardandoCarga(false);
  };

  const hace12Meses = () => { const d = new Date(); d.setMonth(d.getMonth() - 12); return d; };
  const kgAnadidos12m = (equipoId) => { if (!movimientos) return 0; const corte = hace12Meses(); return movimientos.filter(m => m.equipoId === equipoId && m.tipo === "carga" && new Date(m.fecha) >= corte).reduce((acc, m) => acc + (Number(m.kg) || 0), 0); };
  const estadoFuga = (pct) => { if (pct === null) return { label: "Sin datos", bg: "#f4f6fb", color: "#8a92a6" }; if (pct >= 20) return { label: "CrÃ­tico", bg: "#fdeeee", color: "#a52b2b" }; if (pct >= 10) return { label: "Alerta", bg: "#fff3d6", color: "#a8720b" }; return { label: "OK", bg: "#e6f7ec", color: "#1c7a44" }; };

  const refrigerantesData = equiposConGas.map(eq => { const nominal = Number(eq.cargaNominal) || 0; const anadido = kgAnadidos12m(eq.id); const pct = nominal > 0 ? (anadido / nominal) * 100 : null; return { equipo: eq, nominal, anadido, pct, estado: estadoFuga(pct) }; });
  const kgInstalados = refrigerantesData.reduce((acc, r) => acc + r.nominal, 0);
  const kgAnadidosTotal = refrigerantesData.reduce((acc, r) => acc + r.anadido, 0);
  const tasaFugaPromedio = kgInstalados > 0 ? (kgAnadidosTotal / kgInstalados) * 100 : 0;
  const enAlerta = refrigerantesData.filter(r => r.pct !== null && r.pct >= 10).length;
  const mesesChart = (() => { const meses = []; const hoy = new Date(); for (let i = 11; i >= 0; i--) { const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1); meses.push({ label: d.toLocaleDateString("es-PE", { month: "short" }), year: d.getFullYear(), month: d.getMonth() }); } return meses.map(m => { const kg = (movimientos || []).filter(mv => mv.tipo === "carga" && (() => { const fd = new Date(mv.fecha); return fd.getFullYear() === m.year && fd.getMonth() === m.month; })()).reduce((acc, mv) => acc + (Number(mv.kg) || 0), 0); return { ...m, kg }; }); })();
  const maxKgMes = Math.max(0.1, ...mesesChart.map(m => m.kg));

  const abrirDetalleAveria = (averia) => { setDetalleAveria(averia); setListaEmergencia(null); setHistorialAbierto(false); };
  const cerrarDetalleAveria = () => setDetalleAveria(null);
  const abrirEmergencias = () => { if (averias.length === 0) return; if (averias.length === 1) abrirDetalleAveria(averias[0]); else setListaEmergencia(averias); };
  const marcarAveriaAtendida = async (averiaId) => { try { await updateDoc(doc(db, "averias", averiaId), { atendida: true, atendidaEn: serverTimestamp() }); const averiaAtendida = averias.find(a => a.id === averiaId); setAverias(prev => prev.filter(a => a.id !== averiaId)); if (averiaAtendida && historialAverias !== null) { setHistorialAverias(prev => [{ ...averiaAtendida, atendida: true, atendidaEn: { toDate: () => new Date() } }, ...prev]); } cerrarDetalleAveria(); } catch (e) { console.error("Error marcando averÃ­a como atendida:", e); } };
  const abrirHistorial = async () => { setHistorialAbierto(true); setListaEmergencia(null); if (historialAverias !== null) return; setCargandoHistorial(true); try { const hSnap = await getDocs(query(collection(db, "averias"), where("cliente", "==", cliente), where("sede", "==", sede), where("atendida", "==", true))); setHistorialAverias(hSnap.docs.map(d => ({ id: d.id, ...d.data() }))); } catch (e) { console.error("Error cargando historial:", e); setHistorialAverias([]); } setCargandoHistorial(false); };

  const getObsCount = (e) => { const arr = e.observacionesArray || []; const norm = arr.map(o => typeof o === "string" ? { texto: o } : o); return norm.filter(o => o?.texto?.trim()).length; };

  const total = equipos.length;
  const op = equipos.filter(e => e.estado === "Operativo").length;
  const obs = equipos.filter(e => e.estado === "Operativo con observaciones").length;
  const fs = equipos.filter(e => e.estado === "Fuera de servicio").length;
  const pOp = total ? Math.round((op / total) * 100) : 0;
  const pObs = total ? Math.round((obs / total) * 100) : 0;
  const pFs = total ? Math.round((fs / total) * 100) : 0;

  const fechaAMesAnio = (fecha) => { if (!fecha) return null; const d = new Date(fecha.includes("/") ? fecha.split("/").reverse().join("-") : fecha); if (isNaN(d)) return null; return d.toLocaleDateString("es-PE", { month: "short", year: "numeric" }); };
  const fechaATimestamp = (fecha) => { if (!fecha) return 0; const d = new Date(fecha.includes("/") ? fecha.split("/").reverse().join("-") : fecha); return isNaN(d) ? 0 : d.getTime(); };
  const fechaColor = (fecha) => { if (!fecha) return { bg: "#f4f6fb", color: "#8a92a6", border: "#e7ebf3" }; const meses = (Date.now() - fechaATimestamp(fecha)) / (1000 * 60 * 60 * 24 * 30); if (meses <= 3) return { bg: "#e6f7ec", color: "#1c7a44", border: "#c3ecd2" }; if (meses <= 6) return { bg: "#e5f0ff", color: "#1a4fc0", border: "#c3d6fb" }; return { bg: "#fdeeee", color: "#a52b2b", border: "#f6d3d3" }; };
  const mesesDisponibles = ["Todos", ...new Set(equipos.map(e => fechaAMesAnio(e.ultimoMantenimiento)).filter(Boolean))];
  const pisos = ["Todos", ...[...new Set(equipos.map(e => e.piso).filter(Boolean))].sort((a, b) => { const [ta, na] = parsePiso({ piso: a }); const [tb, nb] = parsePiso({ piso: b }); return ta !== tb ? ta - tb : na - nb; })];
  const tiposEquipo = ["Todos", ...[...new Set(equipos.map(e => e.tipoEquipo).filter(Boolean))].sort()];

  const equiposFiltrados = equipos.filter(e => {
    const pasaPiso = pisoFiltro === "Todos" || e.piso === pisoFiltro;
    const pasaTipo = tipoFiltro === "Todos" || (e.tipoEquipo || "Sin tipo") === tipoFiltro;
    const pasaEstado = estadoFiltro === "Todos" || (estadoFiltro === "Operativo" && e.estado === "Operativo") || (estadoFiltro === "Con obs." && e.estado === "Operativo con observaciones") || (estadoFiltro === "Fuera serv." && e.estado === "Fuera de servicio");
    const pasaMes = mesFiltro === "Todos" || (mesFiltro === "Sin fecha" && !e.ultimoMantenimiento) || fechaAMesAnio(e.ultimoMantenimiento) === mesFiltro;
    return pasaPiso && pasaTipo && pasaEstado && pasaMes;
  }).sort((a, b) => { const fa = fechaATimestamp(a.ultimoMantenimiento); const fb = fechaATimestamp(b.ultimoMantenimiento); if (fb !== fa) return fb - fa; return sortPiso(a, b); });

  return (
    <div style={s.page}>
      <div style={s.navbar}>
        <div style={s.navLeft}>
          <div style={s.logoBox}><img src="/assets/hvac-isotipo-filled.png" alt="HVAC" style={s.logoImg} /></div>
          <div style={s.divider}></div>
          <button style={s.btnBack} onClick={() => navigate(`/cliente/${clienteNombre}`)}><SvgFlecha /> {cliente}</button>
          <div style={s.divider}></div>
          <span style={s.navTitle}>{sede}</span>
        </div>
        <div style={s.navBtns}>
          <button style={s.btnExcel} onClick={() => exportarExcelSede(cliente, sede, equiposFiltrados)}>Excel</button>
          <button style={s.btnPdf} onClick={() => exportarPDFSede(cliente, sede, equiposFiltrados)}>PDF</button>
          <button style={s.btnPrimary} onClick={() => navigate(`/registrar?cliente=${encodeURIComponent(cliente)}&sede=${encodeURIComponent(sede)}`)}>
            + Nuevo equipo
          </button>
        </div>
      </div>

      <div style={s.content}>
        <div style={s.tabsWrap}>
          <button style={{ ...s.tabBtn, ...(vista === "equipos" ? s.tabBtnActiva : {}) }} onClick={() => setVista("equipos")}><SvgLista /> Equipos</button>
          <button style={{ ...s.tabBtn, ...(vista === "cronograma" ? s.tabBtnActivaCron : {}) }} onClick={() => setVista("cronograma")}><SvgCalCron /> Cronograma</button>
          {equiposConGas.length > 0 && (
            <button style={{ ...s.tabBtn, ...(vista === "refrigerantes" ? s.tabBtnActivaRef : {}) }} onClick={irARefrigerantes}><SvgGota /> Refrigerantes</button>
          )}
        </div>

        {vista === "equipos" && (<>
        <div style={s.statsGrid}>
          <div style={{ ...s.statCard, border: `1.5px solid ${estadoFiltro === "Todos" ? "#1a4fc0" : "#e7ebf3"}`, cursor: "pointer" }} onClick={() => setEstadoFiltro("Todos")}><div style={{ ...s.statNum, color: "#1a4fc0" }}>{total}</div><div style={s.statLabel}>Total equipos</div></div>
          <div style={{ ...s.statCard, background: "#e6f7ec", cursor: "pointer", border: `1.5px solid ${estadoFiltro === "Operativo" ? "#1c7a44" : "#c3ecd2"}` }} onClick={() => setEstadoFiltro(estadoFiltro === "Operativo" ? "Todos" : "Operativo")}><div style={{ ...s.statNum, color: "#1c7a44" }}>{op}</div><div style={s.statLabel}>Operativos</div></div>
          <div style={{ ...s.statCard, background: "#fff3d6", cursor: "pointer", border: `1.5px solid ${estadoFiltro === "Con obs." ? "#a8720b" : "#f3dfa3"}` }} onClick={() => setEstadoFiltro(estadoFiltro === "Con obs." ? "Todos" : "Con obs.")}><div style={{ ...s.statNum, color: "#a8720b" }}>{obs}</div><div style={s.statLabel}>Con obs.</div></div>
          <div style={{ ...s.statCard, background: "#fdeeee", cursor: "pointer", border: `1.5px solid ${estadoFiltro === "Fuera serv." ? "#a52b2b" : "#f6d3d3"}` }} onClick={() => setEstadoFiltro(estadoFiltro === "Fuera serv." ? "Todos" : "Fuera serv.")}><div style={{ ...s.statNum, color: "#a52b2b" }}>{fs}</div><div style={s.statLabel}>Fuera serv.</div></div>
          <div style={{ background: averias.length > 0 ? "#fdeeee" : "#f4f6fb", border: `1.5px solid ${averias.length > 0 ? "#f6d3d3" : "#e7ebf3"}`, borderRadius: "16px", padding: "20px", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", textAlign: "center" }}>
            <div style={{ cursor: averias.length > 0 ? "pointer" : "default" }} onClick={abrirEmergencias}><div style={{ ...s.statNum, color: averias.length > 0 ? "#a52b2b" : "#9aa2b3" }}>{averias.length}</div><div style={s.statLabel}>Emergencia</div></div>
            <a href="#" onClick={(e) => { e.preventDefault(); abrirHistorial(); }} style={{ fontSize: "11.5px", fontWeight: 700, color: "#1a4fc0", textDecoration: "underline", marginTop: "2px" }}>Historial</a>
          </div>
        </div>

        {total > 0 && (
          <div style={s.barrasCard}>
            <div style={s.barraRow}><span style={s.barraLabel}>Operativo</span><div style={s.barraTrack}><div style={{ width: `${pOp}%`, background: "#1c9a53", height: "100%", borderRadius: "4px" }}></div></div><span style={{ ...s.barraNum, color: "#1c7a44" }}>{op} und</span></div>
            <div style={s.barraRow}><span style={s.barraLabel}>Con observaciones</span><div style={s.barraTrack}><div style={{ width: `${pObs}%`, background: "#e8a020", height: "100%", borderRadius: "4px" }}></div></div><span style={{ ...s.barraNum, color: "#a8720b" }}>{obs} und</span></div>
            <div style={{ ...s.barraRow, borderBottom: "none" }}><span style={s.barraLabel}>Fuera de servicio</span><div style={s.barraTrack}><div style={{ width: `${pFs}%`, background: "#c23b3b", height: "100%", borderRadius: "4px" }}></div></div><span style={{ ...s.barraNum, color: "#a52b2b" }}>{fs} und</span></div>
          </div>
        )}

        {total === 0 ? (
          <div style={s.empty}><div style={{ fontSize: "14px", fontWeight: 700, color: "#c3cad9", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Sin equipos</div><div style={{ fontSize: "14px", color: "#6b7488", marginBottom: "14px", fontWeight: 600 }}>No hay equipos en esta sede</div><button style={s.btnPrimary} onClick={() => navigate(`/registrar?cliente=${encodeURIComponent(cliente)}&sede=${encodeURIComponent(sede)}`)}>+ Registrar primer equipo</button></div>
        ) : (
          <div style={s.tablaWrap}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid #f2f4f8", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
              <span style={{ fontSize: "14.5px", fontWeight: 800, color: "#12245e" }}>Lista de equipos <span style={{ fontSize: "11.5px", fontWeight: 700, background: "#e5f0ff", color: "#1a4fc0", padding: "3px 10px", borderRadius: "20px", marginLeft: "8px" }}>{equiposFiltrados.length} equipos</span></span>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <span style={s.filterLabel}>Piso:</span><select style={s.selectFiltro} value={pisoFiltro} onChange={e => setPisoFiltro(e.target.value)}>{pisos.map(p => <option key={p}>{p}</option>)}</select>
                <span style={s.filterLabel}>Equipo:</span><select style={s.selectFiltro} value={tipoFiltro} onChange={e => setTipoFiltro(e.target.value)}>{tiposEquipo.map(t => <option key={t} value={t}>{t === "Todos" ? "Todos los equipos" : t}</option>)}</select>
                <span style={s.filterLabel}>Periodo:</span><select style={s.selectFiltro} value={mesFiltro} onChange={e => setMesFiltro(e.target.value)}>{mesesDisponibles.map(m => <option key={m}>{m}</option>)}<option value="Sin fecha">Sin fecha</option></select>
                {mesFiltro !== "Todos" && <button onClick={() => setMesFiltro("Todos")} style={{ fontSize: "10.5px", padding: "4px 9px", borderRadius: "20px", background: "#1a4fc0", color: "white", border: "none", cursor: "pointer", fontWeight: 700 }}>{mesFiltro} X</button>}
              </div>
            </div>
            <div style={{ overflowX: "auto" }}><div style={{ minWidth: "0" }}>
              <div style={s.tablaHeader}>{["#", "CÃ³digo", "Piso", "Ambiente", "Tipo", "Marca/Modelo", "Serie", "Estado", "Ãšlt. mant.", "Acciones"].map(h => <span key={h} style={s.thCell}>{h}</span>)}</div>
              {equiposFiltrados.map((eq, i) => {
                const fc = fechaColor(eq.ultimoMantenimiento);
                const mesAnio = fechaAMesAnio(eq.ultimoMantenimiento);
                const tieneHistorial = !!eq.equipoAnteriorId;
                const histAbierto = historialEquipoAbierto[eq.id];
                const numObs = getObsCount(eq);
                return (
                  <React.Fragment key={eq.id}>
                    <div style={{ ...s.tablaRow, background: i % 2 === 0 ? "white" : "#fafbfd" }}>
                      <span style={s.tdCell}>{i + 1}</span>
                      <span style={s.tdCell}>{eq.codigo ? <span style={s.codigo}>{eq.codigo}</span> : <span style={{ color: "#c3cad9" }}>-</span>}</span>
                      <span style={s.tdCell}>{eq.piso || "-"}</span>
                      <span style={{ ...s.tdCell, fontWeight: 700, color: "#0f1b3d", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={eq.ambiente || ""}>{eq.ambiente || "-"}</span>
                      <span style={{ ...s.tdCell, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={eq.tipoEquipo || ""}>{eq.tipoEquipo || "-"}</span>
                      <span style={{ ...s.tdCell, minWidth: 0, overflow: "hidden" }}><div style={{ fontWeight: 700, fontSize: "12px", color: "#0f1b3d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={eq.marca || ""}>{eq.marca}</div><div style={{ fontSize: "10.5px", color: "#9aa2b3", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={eq.modelo || ""}>{eq.modelo}</div></span>
                      <span style={{ ...s.tdCell, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={eq.serie || ""}>{eq.serie || "â€”"}</span>
                      <span style={{ ...s.tdCell, minWidth: 0, overflow: "hidden" }}><span style={eq.estado === "Operativo" ? s.badgeOp : eq.estado === "Operativo con observaciones" ? s.badgeObs : s.badgeFs}>{eq.estado === "Operativo" ? "Operativo" : eq.estado === "Operativo con observaciones" ? "Con obs." : "Fuera serv."}</span></span>
                      <span style={{ ...s.tdCell, minWidth: 0, overflow: "hidden" }}>{mesAnio ? <span style={{ fontSize: "11px", padding: "3px 9px", borderRadius: "20px", background: fc.bg, color: fc.color, border: `1px solid ${fc.border}`, whiteSpace: "nowrap", fontWeight: 700 }}>{mesAnio}</span> : <span style={{ fontSize: "11px", color: "#c3cad9" }}>â€”</span>}</span>
                      <span style={{ ...s.tdCell, minWidth: 0, overflow: "hidden" }}>
                        <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                          <button style={s.btnInfo} onClick={() => navigate(`/equipo/${eq.id}`)}>Info</button>
                          <button style={{ ...s.btnObsSede, background: obsAbiertas[eq.id] ? "#a8720b" : "#fff3d6", color: obsAbiertas[eq.id] ? "white" : "#a8720b", opacity: numObs === 0 ? 0.5 : 1 }} onClick={() => toggleObs(eq.id)}><SvgObs /> {numObs}</button>
                          <button style={s.btnEditar} onClick={() => navigate(`/registrar?id=${eq.id}`)}>Editar</button>
                          <button style={s.btnProto} onClick={() => navigate(`/protocolo?equipo=${eq.id}`)}>Protocolo</button>
                          <button style={s.btnReemplazar} onClick={() => abrirModalReemplazo(eq)} title="Reemplazar equipo"><SvgReemplazo /></button>
                          <button style={s.btnEliminar} onClick={() => handleEliminar(eq.id)}><SvgEliminar /></button>
                          {tieneHistorial && <button style={s.btnHistorial} onClick={() => toggleHistorialEquipo(eq)} title={`${eq.historialCount || 1} reemplazo(s) anterior(es)`}><SvgHistorial /> {eq.historialCount || 1}</button>}
                        </div>
                      </span>
                    </div>
                    {/* NUEVO: Panel de observaciones expandible con 3 columnas */}
                    {obsAbiertas[eq.id] && (() => {
                      const obsArr = getObsPDF(eq);
                      const numObsArr = obsArr.length;
                      const recArr = getRec(eq);
                      return (
                        <div style={{ background: "#fafbfd", borderTop: "2px solid #f3dfa3", borderBottom: "1px solid #f2f4f8", padding: "14px 18px" }}>
                          <div style={{ fontSize: "11.5px", fontWeight: 700, color: "#a8720b", marginBottom: "10px" }}>{numObsArr} observaciÃ³n{numObsArr !== 1 ? "es" : ""} â€” {eq.codigo || eq.ambiente}</div>
                          {numObsArr === 0 ? (
                            <div style={{ fontSize: "12.5px", color: "#c3cad9", textAlign: "center", padding: "8px 0" }}>Sin observaciones registradas</div>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                              {obsArr.map((o, idx) => (
                                <div key={idx} style={{ display: "grid", gridTemplateColumns: "20px 1fr 1fr 1fr", gap: "8px", alignItems: "start" }}>
                                  <div style={{ fontSize: "10px", color: "#8a92a6", paddingTop: "8px", textAlign: "center" }}>{idx + 1}</div>
                                  <div style={{ background: "#fff8e6", border: "1px solid #f3dfa3", borderRadius: "9px", padding: "8px 10px" }}>
                                    <div style={{ fontSize: "11.5px", color: "#26314d", lineHeight: 1.4 }}>{o.texto}</div>
                                    {(o.fecha || o.tecnico) && <div style={{ fontSize: "9.5px", color: "#aab1c2", marginTop: "4px" }}>{o.fecha}{o.fecha && o.tecnico ? " Â· " : ""}{o.tecnico}</div>}
                                  </div>
                                  <div style={{ background: "#fdeeee", border: "1px solid #f6d3d3", borderRadius: "9px", padding: "8px 10px", fontSize: "11.5px", color: "#a52b2b" }}>{o.causa || "â€”"}</div>
                                  <div style={{ background: "#e6f7ec", border: "1px solid #c3ecd2", borderRadius: "9px", padding: "8px 10px", fontSize: "11.5px", color: "#1c7a44" }}>{recArr[idx] ? (typeof recArr[idx] === "string" ? recArr[idx] : recArr[idx].texto || "â€”") : "â€”"}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                    {tieneHistorial && histAbierto && (
                      <div style={s.historialPanel}>
                        {cargandoHistorialEquipo[eq.id] ? (<div style={{ fontSize: "12px", color: "#8a92a6", padding: "6px 0" }}>Cargando historial...</div>) : (
                          <div style={s.historialLinea}>
                            {(historialesEquipo[eq.id] || []).map((h, idx) => (
                              <div key={h.id} style={s.historialItem}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
                                  <div><div style={{ fontWeight: 700, fontSize: "11.5px", color: "#26314d" }}>{h.marca} {h.modelo} {h.serie ? `Â· ${h.serie}` : ""}</div><div style={{ fontSize: "10.5px", color: "#8a92a6", marginTop: "2px" }}>{h.fechaInstalacion || "?"} â€“ {h.fechaBaja || "?"}</div></div>
                                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}><span style={s.chipReemplazado}>Reemplazado</span><button style={s.btnEditarMov} onClick={() => abrirEditarHistorialItem(eq.id, h)} title="Editar"><SvgEditarChico /></button><button style={s.btnEliminarMov} onClick={() => eliminarHistorialItem(eq, idx)} title="Eliminar"><SvgEliminar /></button></div>
                                </div>
                                {h.kgRecuperados > 0 && <div style={s.chipRecuperado}><SvgGota color="#a8720b" /> RecuperaciÃ³n final: {h.kgRecuperados.toFixed(1)} kg {h.tipoRefrigerante || ""} al dar de baja</div>}
                              </div>
                            ))}
                            <div style={{ fontSize: "10px", color: "#c3cad9", textAlign: "center", marginTop: "2px" }}>Editar/eliminar historial solo visible para admin y superadmin</div>
                          </div>
                        )}
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div></div>
          </div>
        )}
        </>)}

        {vista === "cronograma" && (
          <CronogramaView equipos={equipos} />
        )}

        {vista === "refrigerantes" && (<>
            <div style={s.statsGrid}>
              <div style={s.statCard}><div style={{ ...s.statNum, color: "#1a4fc0" }}>{kgInstalados.toFixed(1)}</div><div style={s.statLabel}>Kg instalados</div></div>
              <div style={s.statCard}><div style={{ ...s.statNum, color: "#1c7a44" }}>{kgAnadidosTotal.toFixed(1)}</div><div style={s.statLabel}>Kg aÃ±adidos 12m</div></div>
              <div style={{ ...s.statCard, background: tasaFugaPromedio >= 10 ? "#fff3d6" : "white" }}><div style={{ ...s.statNum, color: tasaFugaPromedio >= 20 ? "#a52b2b" : tasaFugaPromedio >= 10 ? "#a8720b" : "#1c7a44" }}>{tasaFugaPromedio.toFixed(1)}%</div><div style={s.statLabel}>Tasa de fuga</div></div>
              <div style={{ ...s.statCard, background: enAlerta > 0 ? "#fdeeee" : "white" }}><div style={{ ...s.statNum, color: enAlerta > 0 ? "#a52b2b" : "#8a92a6" }}>{enAlerta} / {equiposConGas.length}</div><div style={s.statLabel}>En alerta</div></div>
              <div style={s.statCard}><div style={{ ...s.statNum, color: "#7c3fd8" }}>{kgRecuperadosHistorico === null ? "â€¦" : kgRecuperadosHistorico.toFixed(1)}</div><div style={s.statLabel}>Kg recuperados (histÃ³rico)</div></div>
            </div>
            <div style={s.barrasCard}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}><span style={{ fontSize: "14px", fontWeight: 800, color: "#12245e" }}>Refrigerante aÃ±adido por mes (kg)</span><button style={s.btnPrimary} onClick={() => abrirModalCarga()}>+ Registrar carga</button></div>
              {cargandoMovimientos ? (<div style={{ textAlign: "center", color: "#8a92a6", padding: "20px 0" }}>Cargando...</div>) : (
                <div style={{ display: "flex", alignItems: "flex-end", gap: "8px", height: "140px", padding: "0 4px" }}>
                  {mesesChart.map((m, i) => (<div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}><div style={{ width: "100%", maxWidth: "26px", height: `${Math.max(3, (m.kg / maxKgMes) * 110)}px`, background: m.kg > 0 ? "#1a4fc0" : "#eef1f6", borderRadius: "4px 4px 0 0" }} title={`${m.kg.toFixed(1)} kg`}></div><span style={{ fontSize: "10px", color: "#8a92a6", fontWeight: 600, textTransform: "capitalize" }}>{m.label}</span></div>))}
                </div>
              )}
            </div>
            <div style={s.tablaWrap}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid #f2f4f8" }}><span style={{ fontSize: "14.5px", fontWeight: 800, color: "#12245e" }}>Equipos con carga de gas</span></div>
              {refrigerantesData.length === 0 ? (<div style={{ padding: "30px", textAlign: "center", color: "#8a92a6", fontSize: "13px", fontWeight: 600 }}>No hay equipos Split, VRV o Chiller registrados en esta sede.</div>) : (
                <div>
                  <div style={s.tablaHeaderRef}>{["CÃ³digo", "Piso", "Equipo", "Gas", "Carga nominal", "AÃ±adido 12m", "Fuga", "Estado", ""].map(h => <span key={h} style={s.thCell}>{h}</span>)}</div>
                  {refrigerantesData.map((r, i) => {
                    const movsEquipo = (movimientos || []).filter(m => m.equipoId === r.equipo.id).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
                    const cargasAbierto = historialCargasAbierto[r.equipo.id];
                    return (
                    <React.Fragment key={r.equipo.id}>
                    <div style={{ ...s.tablaRowRef, background: i % 2 === 0 ? "white" : "#fafbfd" }}>
                      <span style={s.tdCell}>{r.equipo.codigo ? <span style={s.codigo}>{r.equipo.codigo}</span> : <span style={{ color: "#c3cad9" }}>-</span>}</span>
                      <span style={s.tdCell}>{r.equipo.piso || "-"}</span>
                      <span style={{ ...s.tdCell, minWidth: 0 }}><div style={{ fontWeight: 700, color: "#0f1b3d" }}>{r.equipo.tipoEquipo} â€” {r.equipo.ambiente || "-"}</div><div style={{ fontSize: "10.5px", color: "#9aa2b3", marginTop: "2px" }}>{r.equipo.marca || ""} {r.equipo.modelo || ""}{r.equipo.serie ? ` Â· ${r.equipo.serie}` : ""}</div></span>
                      <span style={s.tdCell}>{r.equipo.tipoRefrigerante || "â€”"}</span>
                      <span style={s.tdCell}>{r.nominal > 0 ? `${r.nominal.toFixed(1)} kg` : "Sin dato"}</span>
                      <span style={s.tdCell}>{r.anadido.toFixed(1)} kg</span>
                      <span style={{ ...s.tdCell, fontWeight: 700, color: r.estado.color }}>{r.pct === null ? "â€”" : `${r.pct.toFixed(1)}%`}</span>
                      <span style={s.tdCell}><span style={{ fontSize: "11px", padding: "3px 9px", borderRadius: "20px", background: r.estado.bg, color: r.estado.color, fontWeight: 700 }}>{r.estado.label}</span></span>
                      <span style={{ ...s.tdCell, display: "flex", gap: "5px" }}>
                        <button style={s.btnRegistrarChico} onClick={() => abrirModalCarga(r.equipo.id)}>+ Carga</button>
                        {movsEquipo.length > 0 && <button style={s.btnHistorialChico} onClick={() => setHistorialCargasAbierto(prev => ({ ...prev, [r.equipo.id]: !prev[r.equipo.id] }))}><SvgHistorial /> {movsEquipo.length}</button>}
                      </span>
                    </div>
                    {cargasAbierto && (
                      <div style={s.historialCargasPanel}>
                        {movsEquipo.map(m => (
                          <div key={m.id} style={s.historialCargaItem}>
                            <span style={{ ...s.chipMovimiento, ...(m.tipo === "carga" ? s.chipCarga : m.tipo === "recuperacion_baja" ? s.chipRecuperacionBaja : s.chipRecuperacion) }}>{m.tipo === "carga" ? "Carga" : m.tipo === "recuperacion_baja" ? "RecuperaciÃ³n (baja)" : "RecuperaciÃ³n"}</span>
                            <span style={{ fontSize: "12px", fontWeight: 700, color: "#0f1b3d" }}>{Number(m.kg).toFixed(1)} kg</span>
                            <span style={{ fontSize: "11.5px", color: "#8a92a6" }}>{m.fecha}</span>
                            <span style={{ fontSize: "11.5px", color: "#8a92a6" }}>{m.tecnico || "â€”"}</span>
                            <div style={{ display: "flex", gap: "4px", justifyContent: "flex-end" }}><button style={s.btnEditarMov} onClick={() => abrirEditarMovimiento(m)} title="Editar registro"><SvgEditarChico /></button><button style={s.btnEliminarMov} onClick={() => handleEliminarMovimiento(m.id)} title="Eliminar registro"><SvgEliminar /></button></div>
                          </div>
                        ))}
                      </div>
                    )}
                    </React.Fragment>);
                  })}
                </div>
              )}
            </div>
        </>)}
      </div>

      {/* Modal registrar carga de refrigerante */}
      {modalCargaAbierto && (
        <div style={s.modalOverlay} onClick={() => { setModalCargaAbierto(false); setEditandoMovimiento(null); }}>
          <div style={{ ...s.averiaCard, maxWidth: "440px" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: "15px", fontWeight: 800, color: "#12245e", marginBottom: "16px" }}>{editandoMovimiento ? "Editar registro de refrigerante" : "Registrar carga de refrigerante"}</div>
            <form onSubmit={guardarCarga} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div><label style={s.labelModal}>Equipo</label>{editandoMovimiento ? (<div style={{ ...s.inputModal, background: "#f4f6fb", color: "#8a92a6" }}>{equiposConGas.find(eq => eq.id === formCarga.equipoId)?.ambiente || editandoMovimiento.equipoAmbiente || "Equipo"}</div>) : (<select style={s.inputModal} value={formCarga.equipoId} onChange={e => setFormCarga({ ...formCarga, equipoId: e.target.value })} required><option value="">Seleccionar equipo...</option>{equiposConGas.map(eq => <option key={eq.id} value={eq.id}>{eq.tipoEquipo} â€” {eq.ambiente || "-"} {eq.codigo ? `(${eq.codigo})` : ""}</option>)}</select>)}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}><div><label style={s.labelModal}>Movimiento</label><select style={s.inputModal} value={formCarga.tipo} onChange={e => setFormCarga({ ...formCarga, tipo: e.target.value })}><option value="carga">Carga (gas aÃ±adido)</option><option value="recuperacion">RecuperaciÃ³n</option></select></div><div><label style={s.labelModal}>Kg</label><input style={s.inputModal} type="number" step="0.1" placeholder="0.5" value={formCarga.kg} onChange={e => setFormCarga({ ...formCarga, kg: e.target.value })} required /></div></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}><div><label style={s.labelModal}>Fecha</label><input style={s.inputModal} type="date" value={formCarga.fecha} onChange={e => setFormCarga({ ...formCarga, fecha: e.target.value })} required /></div><div><label style={s.labelModal}>TÃ©cnico</label><input style={s.inputModal} placeholder="Nombre" value={formCarga.tecnico} onChange={e => setFormCarga({ ...formCarga, tecnico: e.target.value })} /></div></div>
              <div style={{ display: "flex", gap: "10px", marginTop: "6px" }}><button type="button" style={s.btnVerProtocolo} onClick={() => { setModalCargaAbierto(false); setEditandoMovimiento(null); }}>Cancelar</button><button type="submit" style={s.btnMarcarAtendida} disabled={guardandoCarga}>{guardandoCarga ? "Guardando..." : editandoMovimiento ? "Guardar cambios" : "Guardar"}</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Modal editar item del historial de equipos */}
      {editandoHistorialItem && (
        <div style={s.modalOverlay} onClick={() => setEditandoHistorialItem(null)}>
          <div style={{ ...s.averiaCard, maxWidth: "500px", maxHeight: "88vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: "15px", fontWeight: 800, color: "#12245e", marginBottom: "16px" }}>Editar equipo del historial</div>
            <form onSubmit={guardarEditHistorial} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={s.seccionLabel}>Datos generales</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}><div><label style={s.labelModal}>Marca</label><input style={s.inputModal} value={formEditHistorial.marca} onChange={e => setFormEditHistorial({ ...formEditHistorial, marca: e.target.value })} /></div><div><label style={s.labelModal}>Modelo</label><input style={s.inputModal} value={formEditHistorial.modelo} onChange={e => setFormEditHistorial({ ...formEditHistorial, modelo: e.target.value })} /></div><div><label style={s.labelModal}>NÂ° de serie</label><input style={s.inputModal} value={formEditHistorial.serie} onChange={e => setFormEditHistorial({ ...formEditHistorial, serie: e.target.value })} /></div><div><label style={s.labelModal}>Capacidad (BTU)</label><input style={s.inputModal} value={formEditHistorial.capacidad} onChange={e => setFormEditHistorial({ ...formEditHistorial, capacidad: e.target.value })} /></div></div>
              <div style={{ ...s.seccionLabel, color: "#1a4fc0" }}>Datos elÃ©ctricos y refrigerante</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}><div><label style={s.labelModal}>Tipo de refrigerante</label><select style={s.inputModal} value={formEditHistorial.tipoRefrigerante} onChange={e => setFormEditHistorial({ ...formEditHistorial, tipoRefrigerante: e.target.value })}><option value="">Seleccionar...</option>{["R-22", "R-410A", "R-32", "R-407C", "R-134A", "Otro"].map(r => <option key={r}>{r}</option>)}</select></div><div><label style={s.labelModal}>Fases</label><select style={s.inputModal} value={formEditHistorial.fases} onChange={e => setFormEditHistorial({ ...formEditHistorial, fases: e.target.value })}><option>MonofÃ¡sico</option><option>TrifÃ¡sico</option></select></div><div><label style={s.labelModal}>Voltaje de placa (V)</label><input style={s.inputModal} value={formEditHistorial.voltaje} onChange={e => setFormEditHistorial({ ...formEditHistorial, voltaje: e.target.value })} /></div><div><label style={s.labelModal}>Amperaje de placa (A)</label><input style={s.inputModal} value={formEditHistorial.amperaje} onChange={e => setFormEditHistorial({ ...formEditHistorial, amperaje: e.target.value })} /></div><div><label style={s.labelModal}>Carga nominal (kg)</label><input style={s.inputModal} type="number" step="0.1" value={formEditHistorial.cargaNominal} onChange={e => setFormEditHistorial({ ...formEditHistorial, cargaNominal: e.target.value })} /></div><div><label style={s.labelModal}>Carga adicional por instalaciÃ³n (kg)</label><input style={s.inputModal} type="number" step="0.1" placeholder="0.0" value={formEditHistorial.cargaAdicionalInstalacion} onChange={e => setFormEditHistorial({ ...formEditHistorial, cargaAdicionalInstalacion: e.target.value })} /></div></div>
              <div style={{ ...s.seccionLabel, color: "#a52b2b" }}>Baja del equipo</div>
              <div><label style={s.labelModal}>Kg de refrigerante recuperados al dar de baja</label><input style={s.inputModal} type="number" step="0.1" placeholder="0.0" value={formEditHistorial.kgRecuperados} onChange={e => setFormEditHistorial({ ...formEditHistorial, kgRecuperados: e.target.value })} /></div>
              <div style={s.seccionLabel}>Fechas de servicio</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}><div><label style={s.labelModal}>Fecha instalaciÃ³n</label><input style={s.inputModal} type="date" value={formEditHistorial.fechaInstalacion} onChange={e => setFormEditHistorial({ ...formEditHistorial, fechaInstalacion: e.target.value })} /></div><div><label style={s.labelModal}>Fecha de baja</label><input style={s.inputModal} type="date" value={formEditHistorial.fechaBaja} onChange={e => setFormEditHistorial({ ...formEditHistorial, fechaBaja: e.target.value })} /></div></div>
              <div style={{ display: "flex", gap: "10px", marginTop: "6px" }}><button type="button" style={s.btnVerProtocolo} onClick={() => setEditandoHistorialItem(null)}>Cancelar</button><button type="submit" style={s.btnMarcarAtendida} disabled={guardandoEditHistorial}>{guardandoEditHistorial ? "Guardando..." : "Guardar cambios"}</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Modal reemplazar equipo */}
      {modalReemplazoAbierto && (
        <div style={s.modalOverlay} onClick={() => setModalReemplazoAbierto(null)}>
          <div style={{ ...s.averiaCard, maxWidth: "520px", maxHeight: "88vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: "15px", fontWeight: 800, color: "#12245e", marginBottom: "4px" }}>Reemplazar equipo</div>
            <div style={{ fontSize: "12px", color: "#8a92a6", marginBottom: "16px", fontWeight: 600 }}>{modalReemplazoAbierto.codigo ? `${modalReemplazoAbierto.codigo} Â· ` : ""}{modalReemplazoAbierto.ambiente || "-"} â€” el equipo actual queda como historial, no se elimina.</div>
            <form onSubmit={guardarReemplazo} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={s.seccionLabel}>Datos generales</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}><div><label style={s.labelModal}>Marca (nuevo equipo)</label><input style={s.inputModal} value={formReemplazo.marca} onChange={e => setFormReemplazo({ ...formReemplazo, marca: e.target.value })} required /></div><div><label style={s.labelModal}>Modelo</label><input style={s.inputModal} value={formReemplazo.modelo} onChange={e => setFormReemplazo({ ...formReemplazo, modelo: e.target.value })} /></div><div><label style={s.labelModal}>NÂ° de serie</label><input style={s.inputModal} value={formReemplazo.serie} onChange={e => setFormReemplazo({ ...formReemplazo, serie: e.target.value })} /></div><div><label style={s.labelModal}>Capacidad (BTU)</label><input style={s.inputModal} value={formReemplazo.capacidad} onChange={e => setFormReemplazo({ ...formReemplazo, capacidad: e.target.value })} /></div></div>
              <div style={{ ...s.seccionLabel, color: "#1a4fc0" }}>Datos elÃ©ctricos y refrigerante</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}><div><label style={s.labelModal}>Tipo de refrigerante</label><select style={s.inputModal} value={formReemplazo.tipoRefrigerante} onChange={e => setFormReemplazo({ ...formReemplazo, tipoRefrigerante: e.target.value })}><option value="">Seleccionar...</option>{["R-22", "R-410A", "R-32", "R-407C", "R-134A", "Otro"].map(r => <option key={r}>{r}</option>)}</select></div><div><label style={s.labelModal}>Fases</label><select style={s.inputModal} value={formReemplazo.fases} onChange={e => setFormReemplazo({ ...formReemplazo, fases: e.target.value })}><option>MonofÃ¡sico</option><option>TrifÃ¡sico</option></select></div><div><label style={s.labelModal}>Voltaje de placa (V)</label><input style={s.inputModal} value={formReemplazo.voltaje} onChange={e => setFormReemplazo({ ...formReemplazo, voltaje: e.target.value })} /></div><div><label style={s.labelModal}>Amperaje de placa (A)</label><input style={s.inputModal} value={formReemplazo.amperaje} onChange={e => setFormReemplazo({ ...formReemplazo, amperaje: e.target.value })} /></div><div><label style={s.labelModal}>Carga nominal (kg)</label><input style={s.inputModal} type="number" step="0.1" value={formReemplazo.cargaNominal} onChange={e => setFormReemplazo({ ...formReemplazo, cargaNominal: e.target.value })} /></div><div><label style={s.labelModal}>Carga adicional por instalaciÃ³n (kg)</label><input style={s.inputModal} type="number" step="0.1" placeholder="0.0" value={formReemplazo.cargaAdicionalInstalacion} onChange={e => setFormReemplazo({ ...formReemplazo, cargaAdicionalInstalacion: e.target.value })} /></div></div>
              <div style={{ fontSize: "10.5px", color: "#8a92a6", marginTop: "-8px" }}>Si la tuberÃ­a requiere mÃ¡s gas que la carga de fÃ¡brica, se registra como la carga inicial del equipo nuevo.</div>
              <div style={{ ...s.seccionLabel, color: "#a52b2b" }}>Baja del equipo anterior</div>
              <div><label style={s.labelModal}>Kg de refrigerante recuperados del equipo dado de baja</label><input style={s.inputModal} type="number" step="0.1" placeholder="0.0" value={formReemplazo.kgRecuperados} onChange={e => setFormReemplazo({ ...formReemplazo, kgRecuperados: e.target.value })} /><div style={{ fontSize: "10.5px", color: "#8a92a6", marginTop: "4px" }}>Queda registrado como recuperaciÃ³n final â€” evidencia de cumplimiento, no se libera a la atmÃ³sfera.</div></div>
              <div style={{ display: "flex", gap: "10px", marginTop: "6px" }}><button type="button" style={s.btnVerProtocolo} onClick={() => setModalReemplazoAbierto(null)}>Cancelar</button><button type="submit" style={s.btnMarcarAtendida} disabled={guardandoReemplazo}>{guardandoReemplazo ? "Guardando..." : "Confirmar reemplazo"}</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Modal lista de emergencias activas */}
      {listaEmergencia && (<div style={s.modalOverlay} onClick={() => setListaEmergencia(null)}><div style={s.listaCard} onClick={e => e.stopPropagation()}><div style={s.listaHeader}><SvgAlerta color="#a52b2b" /><span style={s.listaTitulo}>Equipos con emergencia</span><span style={s.listaBadgeCount}>{listaEmergencia.length}</span><button style={s.btnCerrarX} onClick={() => setListaEmergencia(null)}>X</button></div><div style={s.listaBody}>{listaEmergencia.map(a => { const eq = equipos.find(e => e.id === a.equipoId); return (<div key={a.id} onClick={() => abrirDetalleAveria(a)} style={s.listaItem}><div style={{ minWidth: 0, flex: 1 }}><div style={s.listaItemNombre}>{eq?.tipoEquipo || "Equipo"} â€” {a.ambiente || eq?.ambiente || "-"}</div><div style={s.listaItemMeta}>{a.piso ? `Piso ${a.piso}` : ""}{eq?.serie ? ` Â· Serie ${eq.serie}` : ""}</div></div><div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}><span style={s.listaItemFecha}>{a.fecha?.toDate ? a.fecha.toDate().toLocaleDateString("es-PE") + ", " + a.fecha.toDate().toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }) : ""}</span><SvgChevron /></div></div>); })}</div></div></div>)}

      {/* Modal historial */}
      {historialAbierto && (<div style={s.modalOverlay} onClick={() => setHistorialAbierto(false)}><div style={s.listaCard} onClick={e => e.stopPropagation()}><div style={s.listaHeader}><span style={s.listaTitulo}>Historial de averÃ­as â€” {sede}</span><button style={s.btnCerrarX} onClick={() => setHistorialAbierto(false)}>X</button></div><div style={s.listaBody}>{cargandoHistorial ? (<div style={{ fontSize: "12.5px", color: "#8a92a6", textAlign: "center", padding: "20px 0" }}>Cargando historial...</div>) : !historialAverias || historialAverias.length === 0 ? (<div style={{ fontSize: "12.5px", color: "#aab1c2", fontStyle: "italic", textAlign: "center", padding: "20px 0" }}>Sin averÃ­as atendidas registradas</div>) : historialAverias.slice().sort((a, b) => (b.atendidaEn?.toDate ? b.atendidaEn.toDate().getTime() : 0) - (a.atendidaEn?.toDate ? a.atendidaEn.toDate().getTime() : 0)).map(a => { const eq = equipos.find(e => e.id === a.equipoId); return (<div key={a.id} onClick={() => abrirDetalleAveria(a)} style={s.listaItem}><div style={{ minWidth: 0, flex: 1 }}><div style={s.listaItemNombre}>{eq?.tipoEquipo || "Equipo"} â€” {a.ambiente || eq?.ambiente || "-"}</div><div style={s.listaItemMeta}>{a.piso ? `Piso ${a.piso}` : ""}</div></div><div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}><span style={s.atendidaChip}>Atendida</span><SvgChevron /></div></div>); })}</div></div></div>)}

      {/* Modal detalle de averÃ­a */}
      {detalleAveria && (() => { const eq = equipos.find(e => e.id === detalleAveria.equipoId); const atendida = !!detalleAveria.atendida; return (<div style={s.modalOverlay} onClick={cerrarDetalleAveria}><div style={{ ...s.averiaCard, border: `1px solid ${atendida ? "#c3ecd2" : "#f6d3d3"}` }} onClick={e => e.stopPropagation()}><div style={s.averiaHeaderRow}><div><div style={s.averiaTitulo}>{eq?.tipoEquipo || "Equipo"} â€” {(detalleAveria.ambiente || eq?.ambiente || "").toString().toLowerCase()}</div><div style={s.averiaSub}>Piso {detalleAveria.piso || eq?.piso || "-"} Â· {eq?.marca || "-"} Â· {eq?.modelo || detalleAveria.equipoCodigo || "-"}</div></div><span style={atendida ? s.badgeAtendida : s.badgeEmergencia}>{atendida ? "Atendida" : "Con emergencia"}</span></div><div style={s.averiaTabla}><div style={s.averiaFila}><span style={s.averiaLabel}>NÂ° de serie</span><span style={s.averiaValor}>{eq?.serie || "-"}</span></div><div style={s.averiaFila}><span style={s.averiaLabel}>Estado</span><span style={s.averiaValor}>{eq?.estado || "-"}</span></div><div style={s.averiaFila}><span style={s.averiaLabel}>Ãšlt. mantenimiento</span><span style={s.averiaValor}>{eq?.ultimoMantenimiento || "Sin registro"}</span></div><div style={s.averiaFila}><span style={s.averiaLabel}>Observaciones abiertas</span><span style={s.averiaValor}>{eq ? getObsCount(eq) : 0}</span></div></div><div style={s.averiaDivider}></div><div style={{ ...s.averiaMsgLabel, color: atendida ? "#1c7a44" : "#a52b2b" }}>{atendida ? "AverÃ­a atendida" : "Mensaje de emergencia"}</div><div style={{ ...s.averiaMsgBox, background: atendida ? "#e6f7ec" : "#fdeeee", border: `1px solid ${atendida ? "#c3ecd2" : "#f6d3d3"}` }}><div style={s.averiaMsgTxt}>{detalleAveria.mensaje}</div><div style={{ fontSize: "11px", color: "#8a92a6" }}>{detalleAveria.fecha?.toDate ? detalleAveria.fecha.toDate().toLocaleString("es-PE") : ""}</div></div>{atendida ? (<div style={s.averiaAtendidaTxt}>Atendida: {detalleAveria.atendidaEn?.toDate ? detalleAveria.atendidaEn.toDate().toLocaleString("es-PE") : "-"}</div>) : (<><div style={{ display: "flex", gap: "8px", marginTop: "14px" }}>{eq && <button style={s.btnVerProtocolo} onClick={() => navigate(`/protocolo?equipo=${eq.id}`)}>Ver protocolo</button>}<button style={s.btnMarcarAtendida} onClick={() => marcarAveriaAtendida(detalleAveria.id)}>Marcar como atendida</button></div><div style={s.averiaCaption}>No se elimina: pasa a historial de averÃ­as atendidas y deja de contar en el badge de emergencia.</div></>)}</div></div>); })()}
    </div>
  );
}

const s = {
  page: { minHeight: "100vh", width: "100%", background: "#eef1f6", fontFamily: FONT, boxSizing: "border-box" },
  navbar: { background: "white", borderBottom: "1px solid #e7ebf3", padding: "14px clamp(16px,4vw,32px)", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10, flexWrap: "wrap", gap: "12px" },
  navLeft: { display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" },
  logoBox: { width: "40px", height: "40px", minWidth: "40px", borderRadius: "10px", background: "#1a4fc0", display: "flex", alignItems: "center", justifyContent: "center" },
  logoImg: { width: "25px", height: "25px", objectFit: "contain", filter: "brightness(0) invert(1)" },
  divider: { width: "1px", height: "18px", background: "#e7ebf3" },
  btnBack: { background: "none", border: "none", color: "#1a4fc0", cursor: "pointer", fontSize: "13.5px", fontWeight: 700, padding: 0, fontFamily: "inherit" },
  navTitle: { fontSize: "14.5px", color: "#26314d", fontWeight: 700 },
  navBtns: { display: "flex", gap: "8px" },
  btnPrimary: { background: "#1a4fc0", color: "white", border: "none", borderRadius: "10px", padding: "9px 16px", cursor: "pointer", fontSize: "13px", fontWeight: 700, fontFamily: "inherit" },
  btnExcel: { background: "#e6f7ec", color: "#1c7a44", border: "none", borderRadius: "10px", padding: "9px 16px", cursor: "pointer", fontSize: "13px", fontWeight: 700, fontFamily: "inherit" },
  btnPdf: { background: "#fdeeee", color: "#a52b2b", border: "none", borderRadius: "10px", padding: "9px 16px", cursor: "pointer", fontSize: "13px", fontWeight: 700, fontFamily: "inherit" },
  content: { maxWidth: "1300px", margin: "0 auto", padding: "clamp(16px,4vw,32px)" },
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: "14px", marginBottom: "20px" },
  statCard: { background: "white", border: "1px solid #e7ebf3", borderRadius: "16px", padding: "20px", textAlign: "center" },
  statNum: { fontSize: "clamp(26px,3.5vw,32px)", fontWeight: 800 },
  statLabel: { fontSize: "11px", color: "#8a92a6", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: "4px", fontWeight: 700 },
  barrasCard: { background: "white", border: "1px solid #e7ebf3", borderRadius: "16px", padding: "18px 20px", marginBottom: "20px" },
  barraRow: { display: "flex", alignItems: "center", gap: "14px", padding: "8px 0", borderBottom: "1px solid #f2f4f8" },
  barraLabel: { fontSize: "13px", color: "#26314d", width: "150px", flexShrink: 0, fontWeight: 700 },
  barraTrack: { flex: 1, height: "8px", background: "#eef1f6", borderRadius: "4px", overflow: "hidden" },
  barraNum: { fontSize: "13px", fontWeight: 700, width: "60px", textAlign: "right" },
  tablaWrap: { background: "white", border: "1px solid #e7ebf3", borderRadius: "16px", overflow: "hidden" },
  tablaHeader: { display: "grid", gridTemplateColumns: "24px 64px 40px 1.1fr 0.8fr 1fr 0.85fr 76px 76px 260px", gap: "6px", padding: "12px 16px", background: "#fafbfd", borderBottom: "1px solid #eef1f6" },
  tablaRow: { display: "grid", gridTemplateColumns: "24px 64px 40px 1.1fr 0.8fr 1fr 0.85fr 76px 76px 260px", gap: "6px", padding: "12px 16px", borderBottom: "1px solid #f2f4f8", alignItems: "center" },
  thCell: { fontSize: "10.5px", color: "#8a92a6", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700, whiteSpace: "nowrap" },
  tdCell: { fontSize: "12.5px", color: "#26314d" },
  codigo: { fontSize: "11px", padding: "3px 8px", borderRadius: "7px", background: "#e5f0ff", color: "#1a4fc0", fontFamily: "monospace", fontWeight: 700 },
  badgeOp: { fontSize: "11px", padding: "4px 10px", borderRadius: "20px", background: "#e6f7ec", color: "#1c7a44", fontWeight: 700, whiteSpace: "nowrap" },
  badgeObs: { fontSize: "11px", padding: "4px 10px", borderRadius: "20px", background: "#fff3d6", color: "#a8720b", fontWeight: 700, whiteSpace: "nowrap" },
  badgeFs: { fontSize: "11px", padding: "4px 10px", borderRadius: "20px", background: "#fdeeee", color: "#a52b2b", fontWeight: 700, whiteSpace: "nowrap" },
  btnInfo: { fontSize: "9.5px", padding: "5px 6px", background: "#1a4fc0", color: "white", border: "none", borderRadius: "7px", cursor: "pointer", fontWeight: 700, fontFamily: "inherit" },
  btnObsSede: { fontSize: "9.5px", padding: "5px 6px", border: "none", borderRadius: "7px", cursor: "pointer", fontWeight: 700, fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: "3px" },
  btnEditar: { fontSize: "9.5px", padding: "5px 6px", background: "#a8720b", color: "white", border: "none", borderRadius: "7px", cursor: "pointer", fontWeight: 700, fontFamily: "inherit" },
  btnProto: { fontSize: "9.5px", padding: "5px 6px", background: "#a52b2b", color: "white", border: "none", borderRadius: "7px", cursor: "pointer", fontWeight: 700, fontFamily: "inherit" },
  btnEliminar: { fontSize: "9.5px", padding: "5px 6px", background: "#fdeeee", color: "#a52b2b", border: "none", borderRadius: "7px", cursor: "pointer" },
  btnReemplazar: { fontSize: "9.5px", padding: "5px 6px", background: "#f1e9fb", color: "#7c3fd8", border: "none", borderRadius: "7px", cursor: "pointer" },
  btnHistorial: { fontSize: "9.5px", padding: "5px 6px", background: "#fff3d6", color: "#a8720b", border: "none", borderRadius: "7px", cursor: "pointer", fontWeight: 700, display: "flex", alignItems: "center", gap: "2px", fontFamily: "inherit", whiteSpace: "nowrap" },
  historialPanel: { gridColumn: "1 / -1", background: "#fafbfd", borderBottom: "1px solid #f2f4f8", padding: "10px 16px 14px 66px" },
  historialLinea: { display: "flex", flexDirection: "column", gap: "8px", paddingLeft: "14px", borderLeft: "2px dashed #d3d1c7" },
  historialItem: { border: "1px dashed #d3d1c7", borderRadius: "10px", padding: "9px 12px", opacity: 0.75, background: "white" },
  chipReemplazado: { fontSize: "9.5px", fontWeight: 700, padding: "2px 8px", borderRadius: "20px", background: "#f4f6fb", color: "#8a92a6", whiteSpace: "nowrap" },
  chipRecuperado: { display: "flex", alignItems: "center", gap: "6px", fontSize: "10.5px", color: "#a8720b", fontWeight: 600, background: "#fff3d6", border: "1px solid #f3dfa3", borderRadius: "9px", padding: "7px 10px", marginTop: "9px" },
  filterLabel: { fontSize: "12.5px", color: "#6b7488", fontWeight: 600 },
  selectFiltro: { fontSize: "12.5px", padding: "6px 10px", border: "1px solid #dfe6f5", borderRadius: "8px", background: "#f9fafc", color: "#26314d", fontFamily: "inherit", fontWeight: 600 },
  empty: { background: "white", border: "1px solid #e7ebf3", borderRadius: "16px", padding: "48px", textAlign: "center" },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(10,25,70,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "20px", boxSizing: "border-box" },
  listaCard: { background: "white", borderRadius: "18px", width: "100%", maxWidth: "420px", boxShadow: "0 20px 50px rgba(0,10,40,0.3)", overflow: "hidden", fontFamily: FONT },
  listaHeader: { display: "flex", alignItems: "center", gap: "8px", padding: "16px 18px", borderBottom: "1px solid #f2f4f8" },
  listaTitulo: { fontSize: "14px", fontWeight: 700, color: "#12245e", flex: 1 },
  listaBadgeCount: { fontSize: "11px", minWidth: "20px", height: "20px", padding: "0 6px", borderRadius: "10px", background: "#a52b2b", color: "white", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" },
  btnCerrarX: { background: "none", border: "none", fontSize: "15px", cursor: "pointer", color: "#8a92a6", padding: 0, marginLeft: "6px" },
  listaBody: { padding: "12px 14px", display: "flex", flexDirection: "column", gap: "8px", maxHeight: "60vh", overflowY: "auto" },
  listaItem: { background: "white", border: "1px solid #eef1f6", borderRadius: "12px", padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", cursor: "pointer" },
  listaItemNombre: { fontSize: "13.5px", fontWeight: 700, color: "#0f1b3d" },
  listaItemMeta: { fontSize: "11.5px", color: "#8a92a6", marginTop: "3px", fontWeight: 600 },
  listaItemFecha: { fontSize: "11px", color: "#a52b2b", fontWeight: 700, whiteSpace: "nowrap" },
  atendidaChip: { fontSize: "11px", padding: "3px 9px", borderRadius: "20px", background: "#e6f7ec", color: "#1c7a44", fontWeight: 700, whiteSpace: "nowrap" },
  averiaCard: { background: "white", borderRadius: "16px", width: "100%", maxWidth: "420px", padding: "20px", boxShadow: "0 20px 50px rgba(0,10,40,0.3)", boxSizing: "border-box", fontFamily: FONT },
  averiaHeaderRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px", gap: "10px" },
  averiaTitulo: { fontSize: "15px", fontWeight: 700, color: "#12245e", textAlign: "left" },
  averiaSub: { fontSize: "12px", color: "#8a92a6", marginTop: "3px", textAlign: "left", fontWeight: 600 },
  badgeEmergencia: { fontSize: "11px", padding: "3px 9px", background: "#fdeeee", color: "#a52b2b", borderRadius: "20px", fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0 },
  badgeAtendida: { fontSize: "11px", padding: "3px 9px", background: "#e6f7ec", color: "#1c7a44", borderRadius: "20px", fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0 },
  averiaTabla: { display: "flex", flexDirection: "column", gap: "10px", marginBottom: "14px" },
  averiaFila: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  averiaLabel: { fontSize: "12px", color: "#8a92a6", fontWeight: 600 },
  averiaValor: { fontSize: "13px", color: "#12245e", fontWeight: 700 },
  averiaDivider: { height: "1px", background: "#eef1f6", margin: "2px 0 14px" },
  averiaMsgLabel: { fontSize: "12px", fontWeight: 700, marginBottom: "7px" },
  averiaMsgBox: { borderRadius: "12px", padding: "12px" },
  averiaMsgTxt: { fontSize: "12.5px", color: "#0f1b3d", marginBottom: "6px", lineHeight: 1.4, fontWeight: 500 },
  averiaAtendidaTxt: { fontSize: "12px", color: "#1c7a44", fontWeight: 700, marginTop: "10px" },
  btnVerProtocolo: { flex: 1, height: "42px", borderRadius: "10px", border: "1px solid #dfe6f5", background: "white", color: "#12245e", fontSize: "13px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" },
  btnMarcarAtendida: { flex: 1, height: "42px", borderRadius: "10px", border: "none", background: "#a52b2b", color: "white", fontSize: "13px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" },
  averiaCaption: { fontSize: "11px", color: "#8a92a6", textAlign: "center", marginTop: "10px", lineHeight: 1.4, fontWeight: 600 },
  tabsWrap: { display: "flex", gap: "8px", marginBottom: "18px" },
  tabBtn: { display: "flex", alignItems: "center", gap: "7px", background: "white", color: "#6b7488", border: "1px solid #e7ebf3", borderRadius: "11px", padding: "10px 18px", fontFamily: "inherit", fontWeight: 700, fontSize: "13px", cursor: "pointer" },
  tabBtnActiva: { background: "#12245e", color: "white", border: "1px solid #12245e" },
  tabBtnActivaRef: { background: "#1a4fc0", color: "white", border: "1px solid #1a4fc0" },
  tabBtnActivaCron: { background: "#7c3fd8", color: "white", border: "1px solid #7c3fd8" },
  tablaHeaderRef: { display: "grid", gridTemplateColumns: "76px 50px 1.3fr 0.7fr 0.9fr 0.9fr 0.7fr 0.8fr 140px", gap: "8px", padding: "10px 18px", background: "#fafbfd", borderBottom: "1px solid #eef1f6" },
  tablaRowRef: { display: "grid", gridTemplateColumns: "76px 50px 1.3fr 0.7fr 0.9fr 0.9fr 0.7fr 0.8fr 140px", gap: "8px", padding: "12px 18px", borderBottom: "1px solid #f2f4f8", alignItems: "center" },
  btnRegistrarChico: { fontSize: "10.5px", padding: "5px 9px", background: "#e5f0ff", color: "#1a4fc0", border: "none", borderRadius: "7px", cursor: "pointer", fontWeight: 700, fontFamily: "inherit", whiteSpace: "nowrap" },
  btnHistorialChico: { fontSize: "10.5px", padding: "5px 8px", background: "#fff3d6", color: "#a8720b", border: "none", borderRadius: "7px", cursor: "pointer", fontWeight: 700, fontFamily: "inherit", display: "flex", alignItems: "center", gap: "3px", whiteSpace: "nowrap" },
  historialCargasPanel: { background: "#fafbfd", borderBottom: "1px solid #f2f4f8", padding: "10px 18px 14px 18px", display: "flex", flexDirection: "column", gap: "7px" },
  historialCargaItem: { display: "grid", gridTemplateColumns: "140px 70px 100px 1fr 62px", gap: "10px", alignItems: "center", background: "white", border: "1px solid #eef1f6", borderRadius: "9px", padding: "8px 12px" },
  chipMovimiento: { fontSize: "10px", fontWeight: 700, padding: "3px 9px", borderRadius: "20px", width: "fit-content", whiteSpace: "nowrap" },
  chipCarga: { background: "#e6f7ec", color: "#1c7a44" },
  chipRecuperacion: { background: "#e5f0ff", color: "#1a4fc0" },
  chipRecuperacionBaja: { background: "#fff3d6", color: "#a8720b" },
  btnEditarMov: { fontSize: "10px", padding: "5px 6px", background: "#fff3d6", color: "#a8720b", border: "none", borderRadius: "6px", cursor: "pointer" },
  btnEliminarMov: { fontSize: "10px", padding: "5px 6px", background: "#fdeeee", color: "#a52b2b", border: "none", borderRadius: "6px", cursor: "pointer" },
  labelModal: { display: "block", fontWeight: 700, fontSize: "12px", color: "#26314d", marginBottom: "5px" },
  seccionLabel: { fontSize: "11px", fontWeight: 700, color: "#8a92a6", letterSpacing: "0.05em", textTransform: "uppercase", marginTop: "2px" },
  inputModal: { width: "100%", boxSizing: "border-box", border: "1px solid #dfe6f5", borderRadius: "10px", padding: "9px 11px", fontFamily: "inherit", fontSize: "13.5px", color: "#0f1b3d", background: "#f9fafc" },
};
