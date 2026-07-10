import { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useParams, useNavigate } from "react-router-dom";
import jsPDF from "jspdf";

const GRUPO_POR_TIPO = {
  "Fan Coil": "fancoil", "UMA": "fancoil", "Manejadora de Aire": "fancoil",
  "Split Piso Techo": "expansion", "Split Pared": "expansion", "Split Ducto": "expansion",
  "Split Fancoil": "expansion", "Split Cassete": "expansion", "Ventana": "expansion",
  "Autocontenido": "expansion", "Precisión": "expansion",
  "VRV Evaporador": "vrv", "VRV Condensador": "vrv",
  "Fancoil AH": "fancoil", "Pared AH": "fancoil", "UMA AH": "fancoil",
  "Ventilación": "ventilacion", "Extractor": "ventilacion", "Inyector": "ventilacion",
  "Cortina de aire": "ventilacion", "Jetfan": "ventilacion", "Presurizador": "ventilacion",
  "Chiller": "pendiente", "Torre de Enfriamiento": "pendiente", "Bombas de agua": "pendiente",
};

const IconoEquipo = ({ grupo }) => {
  if (grupo === "fancoil") return (
    <svg width="46" height="46" viewBox="0 0 100 100">
      <rect x="8" y="18" width="84" height="26" rx="6" fill="#e6f1fb" stroke="#378add" strokeWidth="1.4"/>
      <rect x="13" y="23" width="14" height="16" rx="3" fill="#b5d4f4" stroke="#85b7eb" strokeWidth="0.7"/>
      <rect x="31" y="23" width="14" height="16" rx="3" fill="#b5d4f4" stroke="#85b7eb" strokeWidth="0.7"/>
      <line x1="51" y1="22" x2="51" y2="43" stroke="#378add" strokeWidth="1"/>
      <line x1="59" y1="22" x2="59" y2="43" stroke="#378add" strokeWidth="1"/>
      <line x1="67" y1="22" x2="67" y2="43" stroke="#378add" strokeWidth="1"/>
      <line x1="75" y1="22" x2="75" y2="43" stroke="#378add" strokeWidth="1"/>
      <rect x="8" y="43" width="84" height="4" rx="2" fill="#85b7eb"/>
      <path d="M14 60 Q22 53 30 60 Q38 67 46 60 Q54 53 62 60 Q70 67 78 60" stroke="#378add" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
      <path d="M18 70 Q26 63 34 70 Q42 77 50 70 Q58 63 66 70" stroke="#85b7eb" strokeWidth="1" fill="none" strokeLinecap="round"/>
      <circle cx="88" cy="24" r="3" fill="#2e7d32"/>
    </svg>
  );
  if (grupo === "expansion") return (
    <svg width="46" height="46" viewBox="0 0 100 100">
      <rect x="4" y="8" width="38" height="26" rx="5" fill="#e6f1fb" stroke="#378add" strokeWidth="1.3"/>
      <rect x="8" y="12" width="8" height="18" rx="2" fill="#b5d4f4"/>
      <rect x="19" y="12" width="8" height="18" rx="2" fill="#b5d4f4"/>
      <rect x="4" y="33" width="38" height="3.5" rx="1.5" fill="#85b7eb"/>
      <path d="M7 44 Q13 39 19 44 Q25 49 31 44" stroke="#378add" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
      <circle cx="38" cy="11" r="2.5" fill="#2e7d32"/>
      <rect x="55" y="20" width="40" height="72" rx="6" fill="#e1f5ee" stroke="#1d9e75" strokeWidth="1.3"/>
      <rect x="59" y="25" width="32" height="6" rx="2" fill="#9fe1cb"/>
      <rect x="59" y="34" width="32" height="6" rx="2" fill="#9fe1cb"/>
      <rect x="59" y="43" width="32" height="6" rx="2" fill="#9fe1cb"/>
      <rect x="59" y="52" width="32" height="6" rx="2" fill="#5dcaa5"/>
      <circle cx="91" cy="23" r="2.5" fill="#2e7d32"/>
      <path d="M42 22 Q48 22 48 30 L48 56 Q48 60 55 60" stroke="#85b7eb" strokeWidth="1.2" fill="none" strokeDasharray="4,2.5"/>
    </svg>
  );
  if (grupo === "ventilacion") return (
    <svg width="46" height="46" viewBox="0 0 100 100">
      <path d="M52 6 A36 36 0 1 1 15 42" stroke="#0f6e56" strokeWidth="3" fill="none" strokeLinecap="round" strokeDasharray="4,5"/>
      <circle cx="50" cy="46" r="32" fill="#e1f5ee" stroke="#0f6e56" strokeWidth="2"/>
      <g stroke="#0f6e56" strokeWidth="2" fill="#9fe1cb" strokeLinejoin="round">
        <path d="M50 46 L50 18 Q50 14 54 14 Q58 14 58 18 L58 40 Z"/>
        <path d="M50 46 L68 27 Q71 24 74 27 Q77 30 74 33 L58 50 Z"/>
        <path d="M50 46 L78 46 Q82 46 82 50 Q82 54 78 54 L58 50 Z"/>
        <path d="M50 46 L68 65 Q71 68 68 71 Q65 74 62 71 L46 54 Z"/>
        <path d="M50 46 L50 74 Q50 78 46 78 Q42 78 42 74 L42 50 Z"/>
        <path d="M50 46 L32 65 Q29 68 26 65 Q23 62 26 59 L42 42 Z"/>
        <path d="M50 46 L22 46 Q18 46 18 42 Q18 38 22 38 L42 42 Z"/>
        <path d="M50 46 L32 27 Q29 24 32 21 Q35 18 38 21 L54 38 Z"/>
      </g>
      <circle cx="50" cy="46" r="7" fill="#e1f5ee" stroke="#0f6e56" strokeWidth="2"/>
      <path d="M27 78 L18 96 M73 78 L82 96" stroke="#0f6e56" strokeWidth="2" strokeLinecap="round"/>
      <line x1="12" y1="96" x2="88" y2="96" stroke="#0f6e56" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
  if (grupo === "vrv") return (
    <svg width="46" height="46" viewBox="0 0 100 100">
      <rect x="4" y="4" width="92" height="40" rx="6" fill="#faeeda" stroke="#ba7517" strokeWidth="1.4"/>
      <rect x="8" y="9" width="11" height="30" rx="3" fill="#fac775" stroke="#ef9f27" strokeWidth="0.8"/>
      <rect x="23" y="9" width="11" height="30" rx="3" fill="#fac775" stroke="#ef9f27" strokeWidth="0.8"/>
      <rect x="38" y="9" width="11" height="30" rx="3" fill="#fac775" stroke="#ef9f27" strokeWidth="0.8"/>
      <circle cx="79" cy="24" r="13" fill="#fac775" stroke="#ba7517" strokeWidth="1.2"/>
      <circle cx="79" cy="24" r="7" fill="#ef9f27" stroke="#ba7517" strokeWidth="0.8"/>
      <circle cx="93" cy="7" r="2.5" fill="#2e7d32"/>
      <rect x="18" y="52" width="64" height="40" rx="6" fill="#e1f5ee" stroke="#1d9e75" strokeWidth="1.3"/>
      <rect x="22" y="57" width="56" height="7" rx="2" fill="#9fe1cb"/>
      <rect x="22" y="67" width="56" height="7" rx="2" fill="#9fe1cb"/>
      <rect x="22" y="77" width="56" height="7" rx="2" fill="#5dcaa5"/>
    </svg>
  );
  return (
    <svg width="46" height="46" viewBox="0 0 100 100">
      <rect x="6" y="4" width="88" height="46" rx="6" fill="#f0f4f8" stroke="#888" strokeWidth="1.3"/>
      <rect x="10" y="8" width="36" height="38" rx="4" fill="#e6f1fb" stroke="#378add" strokeWidth="1"/>
      <rect x="50" y="8" width="40" height="38" rx="4" fill="#e1f5ee" stroke="#1d9e75" strokeWidth="1"/>
      <circle cx="46" cy="27" r="10" fill="#f0f4f8" stroke="#888" strokeWidth="1.2"/>
      <circle cx="46" cy="27" r="5" fill="#e6f1fb" stroke="#378add" strokeWidth="1"/>
      <rect x="14" y="56" width="72" height="16" rx="4" fill="#f5f5f5" stroke="#ccc" strokeWidth="1"/>
      <circle cx="28" cy="64" r="5" fill="#b5d4f4" stroke="#378add" strokeWidth="0.8"/>
      <circle cx="50" cy="64" r="5" fill="#b5d4f4" stroke="#378add" strokeWidth="0.8"/>
      <circle cx="72" cy="64" r="5" fill="#9fe1cb" stroke="#1d9e75" strokeWidth="0.8"/>
    </svg>
  );
};

const getBadgeStyle = (estado) => {
  if (estado === "Operativo") return { background: "#e8f5e9", color: "#2e7d32" };
  if (estado === "Operativo con observaciones") return { background: "#fff8e1", color: "#f57f17" };
  return { background: "#ffebee", color: "#c62828" };
};

export default function VistaEquipo() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [equipo, setEquipo] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [tamanoQR, setTamanoQR] = useState("2x2");
  const [escala, setEscala] = useState(3);
  const [imprimiendo, setImprimiendo] = useState(false);
  const [esPub, setEsPub] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [pdfGenerado, setPdfGenerado] = useState(false);

  useEffect(() => { cargarEquipo(); }, []);
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => {
      setEsPub(!user);
      setAuthChecked(true);
    });
    return () => unsub();
  }, []);
  useEffect(() => {
    if (authChecked && esPub && equipo && !cargando && !pdfGenerado) {
      setPdfGenerado(true);
      generarPDF("ver");
    }
  }, [authChecked, esPub, equipo, cargando, pdfGenerado]);

  const cargarEquipo = async () => {
    try {
      const snap = await getDoc(doc(db, "equipos", id));
      if (snap.exists()) setEquipo({ id: snap.id, ...snap.data() });
    } catch (e) { console.error(e); }
    setCargando(false);
  };

  const getQRpx = () => {
    if (tamanoQR === "2x2") return 76;
    if (tamanoQR === "3x3") return 113;
    if (tamanoQR === "5x5") return 189;
    return escala * 37.8;
  };

  // Observaciones con causa sincronizada desde protocolo
  const getObs = () => {
    const arr = equipo.observacionesArray || [];
    const norm = arr.map(o => typeof o === "string"
      ? { texto: o, fecha: "", tecnico: "", causa: "" }
      : { texto: o.texto || "", fecha: o.fecha || "", tecnico: o.tecnico || "", causa: o.causa || "" }
    );
    const filtradas = norm.filter(o => o?.texto?.trim());
    if (filtradas.length > 0) return filtradas;
    return equipo.observaciones?.split(/\n|;/).map(o => ({ texto: o.trim(), fecha: "", tecnico: "", causa: "" })).filter(o => o.texto) || [];
  };

  const getRec = () => equipo.recomendacionesArray?.filter(Boolean) ||
    equipo.recomendaciones?.split(/\n|;/).map(r => r.trim()).filter(Boolean) || [];

  const getCor = () => {
    if (equipo.correctivosArray?.length > 0) return equipo.correctivosArray.filter(c => c.descripcion);
    if (equipo.correctivos) return equipo.correctivos.split(/\n|;/).map(c => ({ descripcion: c.trim(), fecha: "" })).filter(c => c.descripcion);
    return [];
  };

  const getCron = () => equipo.cronograma?.length > 0 ? equipo.cronograma : [
    { label: "1er Trimestre", fecha: "", estado: "programado" },
    { label: "2do Trimestre", fecha: "", estado: "programado" },
    { label: "3er Trimestre", fecha: "", estado: "programado" },
    { label: "4to Trimestre", fecha: "", estado: "programado" },
  ];

  const cronColor = (estado) => ({
    realizado: { bg: "#e8f5e9", border: "#a5d6a7", color: "#2e7d32", icon: "✅" },
    pendiente:  { bg: "#fff8e1", border: "#ffe082", color: "#e65100", icon: "⏳" },
    programado: { bg: "#f5f5f5", border: "#e0e0e0", color: "#888", icon: "📆" },
  }[estado] || { bg: "#f5f5f5", border: "#e0e0e0", color: "#888", icon: "📆" });

  const imprimirQR = () => {
    const url = window.location.href;
    const px = Math.round(getQRpx());
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${px * 2}x${px * 2}&data=${encodeURIComponent(url)}`;
    const win = window.open("", "_blank");
    win.document.write(`<html><head><title>QR ${equipo.codigo || ""}</title>
    <style>body{margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:Arial;background:white;}
    .info{text-align:center;margin-top:10px;font-size:12px;color:#555;}</style></head><body>
    <img src="${qrUrl}" width="${px}" height="${px}"/>
    <div class="info"><b>${equipo.codigo || ""}</b><br/>${equipo.cliente || ""} · Piso ${equipo.piso || ""} · ${equipo.ambiente || ""}</div>
    <script>window.onload=()=>window.print();</script></body></html>`);
    win.document.close();
  };

  const imprimirFicha = () => {
    const obsArr = getObs(), recArr = getRec(), corArr = getCor(), cronArr = getCron();
    const badgeColor = equipo.estado === "Operativo" ? "#2e7d32" : equipo.estado === "Operativo con observaciones" ? "#e65100" : "#c62828";
    const badgeBg = equipo.estado === "Operativo" ? "#e8f5e9" : equipo.estado === "Operativo con observaciones" ? "#fff8e1" : "#ffebee";
    const qrPx = Math.round(getQRpx()) * 2;
    const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=${qrPx}x${qrPx}&data=${encodeURIComponent(window.location.href)}`;

    const esVentF = GRUPO_POR_TIPO[equipo.tipoEquipo] === "ventilacion";
    const campo = (l, v) => v ? `<div style="background:#f8f9fa;border-radius:6px;padding:7px 10px;"><div style="font-size:10px;color:#888;margin-bottom:2px;">${l}</div><div style="font-size:12px;font-weight:600;color:#222;">${v}</div></div>` : "";
    const filaGen = [
      campo("Cliente", equipo.cliente), campo("Sede", equipo.sede), campo("Piso", equipo.piso), campo("Ambiente", equipo.ambiente),
      campo("Marca", equipo.marca), campo("Modelo", equipo.modelo), campo("N° Serie", equipo.serie),
      campo("Capacidad", equipo.capacidad ? equipo.capacidad + (esVentF ? " CFM" : " BTU") : null),
    ].filter(Boolean).join("");
    const filaElec = [
      !esVentF ? campo("Refrigerante", equipo.tipoRefrigerante) : "",
      campo("Voltaje de placa", equipo.voltaje ? equipo.voltaje + "V" : null), campo("Amperaje nominal", equipo.amperaje ? equipo.amperaje + "A" : null),
      campo("Fases", equipo.fases),
      campo("Voltaje cond.", equipo.condVoltaje ? equipo.condVoltaje + "V" : null),
      campo("Amperaje cond.", equipo.condAmperaje ? equipo.condAmperaje + "A" : null),
      campo("Modelo compresor", equipo.modeloCompresor),
    ].filter(Boolean).join("");
    const filaMotor = [
      campo("Contrato", equipo.contrato), campo("Modelo de faja", equipo.modeloFaja), campo("N° de fajas", equipo.numFajas),
      campo("Marca motor", equipo.marcaMotor), campo("Modelo motor", equipo.modeloMotor), campo("N° serie motor", equipo.serieMotor),
    ].filter(Boolean).join("");
    const campos = `<div class="campos">${filaGen}</div>` +
      (filaElec ? `<div class="campos" style="margin-top:8px">${filaElec}</div>` : "") +
      (filaMotor ? `<div class="campos" style="margin-top:8px">${filaMotor}</div>` : "");

    // Observaciones con causa en tabla
    const obsHtml = obsArr.length > 0 ? `
      <table style="width:100%;border-collapse:collapse;font-size:11px;">
        <thead><tr>
          <th style="background:#fff3e0;color:#e65100;padding:5px 8px;text-align:left;width:34%">Observación</th>
          <th style="background:#fce4ec;color:#c62828;padding:5px 8px;text-align:left;width:33%">Causa</th>
          <th style="background:#e8f5e9;color:#2e7d32;padding:5px 8px;text-align:left;width:33%">Recomendación</th>
        </tr></thead>
        <tbody>${obsArr.map((o, i) => `
          <tr style="background:${i % 2 === 0 ? "white" : "#fafafa"}">
            <td style="padding:6px 8px;border-bottom:0.5px solid #f0f0f0;color:#e65100;background:#fff8e1;">
              <div>${o.texto}</div>
              ${o.fecha || o.tecnico ? `<div style="font-size:9px;color:#aaa;margin-top:2px;">${o.fecha || ""}${o.fecha && o.tecnico ? " · " : ""}${o.tecnico ? "Téc: " + o.tecnico : ""}</div>` : ""}
            </td>
            <td style="padding:6px 8px;border-bottom:0.5px solid #f0f0f0;color:#c62828;background:#fef0f0;">${o.causa || "—"}</td>
            <td style="padding:6px 8px;border-bottom:0.5px solid #f0f0f0;color:#2e7d32;background:#e8f5e9;">${recArr[i] || "—"}</td>
          </tr>`).join("")}
        </tbody>
      </table>` : `<div style="font-size:12px;color:#aaa;font-style:italic;">Sin observaciones</div>`;

    const cronColors = { realizado: { bg: "#e8f5e9", color: "#2e7d32", icon: "✅" }, pendiente: { bg: "#fff8e1", color: "#e65100", icon: "⏳" }, programado: { bg: "#f5f5f5", color: "#888", icon: "📆" } };
    const cronHtml = cronArr.map(t => { const c = cronColors[t.estado] || cronColors.programado; return `<div style="background:${c.bg};border-radius:8px;padding:10px;text-align:center;flex:1;"><div style="font-size:11px;font-weight:700;color:${c.color};margin-bottom:3px;">${t.label}</div><div style="font-size:11px;color:${c.color};">${t.fecha || "Sin fecha"}</div><div style="font-size:10px;color:${c.color};margin-top:3px;">${c.icon} ${t.estado}</div></div>`; }).join("");

    const syncBadge = equipo.ultimoProtocolo ? `<span style="font-size:10px;padding:2px 8px;background:#e8f5e9;color:#2e7d32;border-radius:20px;margin-left:8px;">🔄 Sincronizado ${equipo.ultimoProtocolo}</span>` : "";

    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Ficha — ${equipo.codigo || equipo.marca}</title>
    <style>@page{size:A4;margin:14mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:13px;color:#222;background:white;margin:0}
    .header{background:#1a5fa8;color:white;padding:13px 20px;display:flex;justify-content:space-between;align-items:center}
    .logo{font-size:18px;font-weight:900;letter-spacing:2px}.badge{background:${badgeBg};color:${badgeColor};padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700}
    .sec{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#1a5fa8;border-left:3px solid #1a5fa8;padding-left:8px;margin:14px 0 8px}
    .campos{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}.cron{display:flex;gap:8px}
    .btn-print{display:block;margin:12px auto;padding:10px 24px;background:#1a5fa8;color:white;border:none;border-radius:8px;font-size:14px;cursor:pointer;font-weight:600}
    @media print{.btn-print{display:none!important}}</style></head><body>
    <div class="header"><div class="logo">HVAC</div><div class="badge">${equipo.estado === "Operativo con observaciones" ? "Con observaciones" : equipo.estado || "Operativo"}</div></div>
    <button class="btn-print" onclick="window.print()">🖨️ Imprimir ficha</button>
    <div style="padding:0 16px 16px">
      <div style="background:#f8f9fa;border-radius:8px;padding:12px 16px;margin:14px 0 0">
        <div style="font-size:15px;font-weight:700;color:#1a5fa8;">${equipo.marca || ""} / ${equipo.modelo || ""}</div>
        <div style="font-size:12px;color:#555;margin-top:4px;">${equipo.tipoEquipo || ""} · Código: <b>${equipo.codigo || "-"}</b> · ${equipo.cliente || ""} · Piso ${equipo.piso || ""} · ${equipo.ambiente || ""}</div>
      </div>
      <div class="sec">Datos del equipo</div>${campos}
      <div class="sec">Observaciones · Causa · Recomendación ${syncBadge}</div>${obsHtml}
      <div class="sec">Cronograma de mantenimiento</div><div class="cron">${cronHtml}</div>
      <div style="display:flex;align-items:center;gap:14px;border-top:.5px solid #ddd;margin-top:16px;padding-top:12px">
        <img src="${qrSrc}" width="70" height="70"/>
        <div><div style="font-size:10px;color:#aaa;margin-top:2px;">Generado: ${new Date().toLocaleDateString("es-PE")} · HVAC Sistema de Mantenimiento</div></div>
      </div>
    </div>
    <script>setTimeout(()=>window.print(),600);</script></body></html>`;

    const win = window.open("", "_blank");
    win.document.write(html);
    win.document.close();
  };

  const generarPDF = async (modo = "descargar") => {
    setImprimiendo(true);
    try {
      const pdf = new jsPDF("p", "mm", "a4");
      const W = 210, M = 14, C = W - M * 2;
      let y = 0;
      const check = (h = 10) => { if (y + h > 280) { pdf.addPage(); y = 14; } };

      pdf.setFillColor(26, 95, 168); pdf.rect(0, 0, W, 22, "F");
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(14); pdf.setTextColor(255, 255, 255);
      pdf.text("HVAC", M, 14);
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(9); pdf.setTextColor(200, 220, 255);
      pdf.text("SISTEMA DE MANTENIMIENTO", M + 22, 14);
      const ec = equipo.estado === "Operativo" ? [46, 125, 50] : equipo.estado === "Operativo con observaciones" ? [230, 81, 0] : [198, 40, 40];
      pdf.setFillColor(255, 248, 225); pdf.roundedRect(W - M - 52, 7, 52, 8, 2, 2, "F");
      pdf.setFontSize(7.5); pdf.setTextColor(...ec);
      pdf.text(equipo.estado === "Operativo con observaciones" ? "Con observaciones" : (equipo.estado || "Operativo"), W - M - 26, 12.5, { align: "center" });
      y = 30;

      pdf.setFillColor(248, 249, 250); pdf.rect(M, y, C, 14, "F");
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(11); pdf.setTextColor(26, 95, 168);
      pdf.text(`${equipo.marca || "-"} / ${equipo.modelo || "-"} — ${equipo.tipoEquipo || "-"}`, M + 3, y + 6);
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(8.5); pdf.setTextColor(100, 100, 100);
      pdf.text(`Cliente: ${equipo.cliente || "-"}   Piso: ${equipo.piso || "-"}   Ambiente: ${equipo.ambiente || "-"}   Cod: ${equipo.codigo || "-"}`, M + 3, y + 11.5);
      y += 18;

      const secTit = (txt, r, g, b) => {
        check(8); pdf.setFillColor(r, g, b); pdf.rect(M, y, 3, 5, "F");
        pdf.setFont("helvetica", "bold"); pdf.setFontSize(8.5); pdf.setTextColor(r, g, b);
        pdf.text(txt.toUpperCase(), M + 5, y + 4); y += 8;
      };

      const gridCards = (items, cols, br, bg, bb) => {
        const cW = (C - (cols - 1) * 3) / cols, cH = 12;
        const rows = Math.ceil(items.length / cols);
        check(rows * (cH + 2) + 2);
        items.forEach((item, i) => {
          const col = i % cols, row = Math.floor(i / cols);
          const x = M + col * (cW + 3), cy = y + row * (cH + 2);
          pdf.setFillColor(br, bg, bb); pdf.rect(x, cy, cW, cH, "F");
          pdf.setFont("helvetica", "normal"); pdf.setFontSize(7); pdf.setTextColor(150, 150, 150);
          pdf.text(item[0], x + 3, cy + 4);
          pdf.setFont("helvetica", "bold"); pdf.setFontSize(8.5); pdf.setTextColor(30, 30, 30);
          pdf.text(String(item[1] || "-"), x + 3, cy + 9);
        });
        y += rows * (cH + 2) + 2;
      };

      const esVent = GRUPO_POR_TIPO[equipo.tipoEquipo] === "ventilacion";

      secTit("Datos del equipo", 26, 95, 168);
      gridCards([
        ["Cliente", equipo.cliente], ["Sede", equipo.sede], ["Piso", equipo.piso], ["Ambiente", equipo.ambiente],
        ["Marca", equipo.marca], ["Modelo", equipo.modelo], ["N° Serie", equipo.serie],
        ["Capacidad", equipo.capacidad ? equipo.capacidad + (esVent ? " CFM" : " BTU") : null],
      ], 4, 248, 249, 250);
      gridCards([
        !esVent && ["Refrigerante", equipo.tipoRefrigerante],
        ["Voltaje de placa", equipo.voltaje ? equipo.voltaje + "V" : null],
        ["Amperaje nominal", equipo.amperaje ? equipo.amperaje + "A" : null],
        ["Fases", equipo.fases],
        equipo.condVoltaje && ["Voltaje cond.", equipo.condVoltaje + "V"],
        equipo.condAmperaje && ["Amperaje cond.", equipo.condAmperaje + "A"],
        equipo.modeloCompresor && ["Modelo compresor", equipo.modeloCompresor],
      ].filter(Boolean), 3, 248, 249, 250);
      if (equipo.contrato || equipo.modeloFaja || equipo.numFajas || equipo.marcaMotor || equipo.modeloMotor || equipo.serieMotor) {
        gridCards([
          ["Contrato", equipo.contrato], ["Modelo de faja", equipo.modeloFaja], ["N° de fajas", equipo.numFajas],
          ["Marca motor", equipo.marcaMotor], ["Modelo motor", equipo.modeloMotor], ["N° serie motor", equipo.serieMotor],
        ].filter(([, v]) => v), 3, 248, 249, 250);
      }

      // Observaciones con causa
      const obs = getObs();
      if (obs.length > 0) {
        secTit("Observaciones · Causa · Recomendación", 230, 81, 0);
        const rec = getRec();
        const colW = (C - 4) / 3;
        obs.forEach((o, i) => {
          const h = 12; check(h + 2);
          pdf.setFillColor(255, 248, 225); pdf.rect(M, y, colW, h, "F");
          pdf.setFillColor(254, 240, 240); pdf.rect(M + colW + 2, y, colW, h, "F");
          pdf.setFillColor(232, 245, 233); pdf.rect(M + (colW + 2) * 2, y, colW, h, "F");
          pdf.setFont("helvetica", "normal"); pdf.setFontSize(7.5);
          pdf.setTextColor(230, 81, 0); pdf.text(pdf.splitTextToSize(o.texto, colW - 4)[0], M + 2, y + 5);
          pdf.setTextColor(198, 40, 40); pdf.text(pdf.splitTextToSize(o.causa || "—", colW - 4)[0], M + colW + 4, y + 5);
          pdf.setTextColor(46, 125, 50); pdf.text(pdf.splitTextToSize(rec[i] ? (typeof rec[i] === "string" ? rec[i] : rec[i].texto || "—") : "—", colW - 4)[0], M + (colW + 2) * 2 + 2, y + 5);
          if (o.fecha || o.tecnico) {
            const meta = [o.fecha, o.tecnico ? "Téc: " + o.tecnico : ""].filter(Boolean).join(" · ");
            pdf.setFontSize(6.5); pdf.setTextColor(150, 150, 150);
            pdf.text(meta, M + 2, y + 10);
          }
          y += h + 2;
        });
        y += 2;
      }

      // Cronograma
      const cron = getCron();
      secTit("Cronograma de mantenimiento", 26, 95, 168);
      const tW = (C - (cron.length - 1) * 3) / cron.length, tH = 14;
      check(tH + 2);
      cron.forEach((t, i) => {
        const x = M + i * (tW + 3);
        const col = { realizado: { bg: [232, 245, 233], text: [46, 125, 50] }, pendiente: { bg: [255, 248, 225], text: [230, 81, 0] }, programado: { bg: [245, 245, 245], text: [130, 130, 130] } }[t.estado] || { bg: [245, 245, 245], text: [130, 130, 130] };
        pdf.setFillColor(...col.bg); pdf.rect(x, y, tW, tH, "F");
        pdf.setFont("helvetica", "bold"); pdf.setFontSize(7); pdf.setTextColor(...col.text);
        pdf.text(t.label, x + tW / 2, y + 4, { align: "center" });
        pdf.setFont("helvetica", "normal");
        pdf.text(t.fecha || "-", x + tW / 2, y + 8.5, { align: "center" });
        pdf.text(t.estado, x + tW / 2, y + 13, { align: "center" });
      });
      y += tH + 6;

      // QR
      check(25);
      const urlE = `${window.location.origin}/equipo/${id}`;
      const px = Math.round(getQRpx());
      const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=${px * 2}x${px * 2}&data=${encodeURIComponent(urlE)}`;
      const qrImg = await new Promise(res => {
        const img = new Image(); img.crossOrigin = "anonymous";
        img.onload = () => { const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; c.getContext("2d").drawImage(img, 0, 0); res(c.toDataURL("image/png")); };
        img.onerror = () => res(null); img.src = qrSrc;
      });
      if (qrImg) pdf.addImage(qrImg, "PNG", M, y, 22, 22);
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(7.5); pdf.setTextColor(150, 150, 150);
      pdf.text("HVAC Sistema de Mantenimiento", W - M, y + 5, { align: "right" });
      pdf.text(`Generado: ${new Date().toLocaleDateString("es-PE")}`, W - M, y + 10, { align: "right" });
      pdf.setDrawColor(220, 220, 220); pdf.line(M, 287, W - M, 287);
      pdf.setFontSize(7); pdf.setTextColor(180, 180, 180);
      pdf.text(`Reporte · ${equipo.cliente || ""} · ${equipo.codigo || id.slice(0, 6).toUpperCase()}`, M, 291);

      if (modo === "ver") {
        const blob = pdf.output("blob");
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank") || (window.location.href = url);
      } else {
        pdf.save(`reporte-${equipo.codigo || id.slice(0, 6)}.pdf`);
      }
    } catch (e) { console.error(e); alert("Error PDF: " + e.message); }
    setImprimiendo(false);
  };

  if (cargando || !authChecked) return <div style={s.centro}>Cargando...</div>;
  if (!equipo) return <div style={s.centro}>Equipo no encontrado</div>;
  if (esPub) return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#f0f4f8", fontFamily: "Arial,sans-serif", gap: "12px" }}>
      <div style={{ fontSize: "48px" }}>📄</div>
      <div style={{ fontSize: "16px", fontWeight: 700, color: "#1a5fa8" }}>Preparando ficha técnica...</div>
      <div style={{ fontSize: "12px", color: "#555" }}>
        {equipo.codigo && <span style={{ fontFamily: "monospace", background: "#f3e5f5", color: "#6a1b9a", padding: "2px 6px", borderRadius: "4px", marginRight: "6px" }}>{equipo.codigo}</span>}
        {equipo.marca} {equipo.modelo}
      </div>
      <div style={{ fontSize: "11px", color: "#aaa" }}>HVAC Sistema de Mantenimiento</div>
    </div>
  );

  const px = Math.round(getQRpx());
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${px * 2}x${px * 2}&data=${encodeURIComponent(window.location.href)}`;
  const obs = getObs(), rec = getRec(), cor = getCor(), cron = getCron();
  const cronCols = cron.length <= 2 ? "1fr 1fr" : cron.length <= 4 ? `repeat(${cron.length}, 1fr)` : "repeat(4, 1fr)";

  return (
    <div style={s.page}>
      <div style={s.navbar}>
        <div style={s.navLeft}>
          <div style={s.logo}>
            <span style={{ color: "#1a5fa8" }}>H</span>
            <span style={{ color: "#1a5fa8", marginRight: "-6px" }}>V</span>
            <span style={{ color: "#f0c040", marginLeft: "2px" }}>A</span>
            <span style={{ color: "#1a5fa8", marginLeft: "2px" }}>C</span>
          </div>
          <div style={s.div}></div>
          <button style={s.btnBack} onClick={() => navigate(-1)}>← Volver</button>
        </div>
        <span style={{ ...s.badge, ...getBadgeStyle(equipo.estado) }}>{equipo.estado || "Operativo"}</span>
      </div>

      <div style={s.content}>
        <div style={s.layout}>

          {/* SIDEBAR */}
          <div style={s.sidebar}>
            <div style={s.sCard}>
              <div style={s.iconWrap}><IconoEquipo grupo={GRUPO_POR_TIPO[equipo.tipoEquipo] || "pendiente"} /></div>
              <div style={s.sNombre}>{equipo.marca || "-"} / {equipo.modelo || "-"}</div>
              <span style={s.sTipo}>{equipo.tipoEquipo || "-"}</span>
            </div>
            <div style={s.sCard}>
              <div style={s.sLbl}>Ubicación</div>
              <div style={s.sVal}>🏢 {equipo.cliente || "-"}</div>
              <div style={{ ...s.sVal, color: "#888", marginTop: "4px" }}>📍 Piso {equipo.piso || "-"} · {equipo.ambiente || "-"}</div>
            </div>
            <div style={s.sCard}>
              <div style={s.sLbl}>Código</div>
              <span style={s.codTag}>{equipo.codigo || "-"}</span>
            </div>
            <div style={s.sCard}>
              <div style={s.sLbl}>Último mantenimiento</div>
              <div style={s.sVal}>📅 {equipo.ultimoMantenimiento || "Sin registro"}</div>
              {equipo.ultimoProtocolo && (
                <div style={{ fontSize: "10px", color: "#2e7d32", marginTop: "4px", background: "#e8f5e9", padding: "2px 6px", borderRadius: "10px", display: "inline-block" }}>
                  🔄 Protocolo {equipo.ultimoProtocolo}
                </div>
              )}
            </div>
            <button style={s.btnQR} onClick={imprimirQR}>🖨️ Imprimir QR</button>
            <button style={{ ...s.btnQR, background: "#c62828", color: "white", border: "none" }} onClick={generarPDF} disabled={imprimiendo}>
              {imprimiendo ? "Generando..." : "📄 Descargar PDF"}
            </button>
          </div>

          {/* MAIN */}
          <div style={s.main}>

            <div style={s.sec}>
              <div style={s.secT}>📋 Datos del equipo</div>
              <div style={s.g4}>
                {[["Cliente", equipo.cliente], ["Sede", equipo.sede], ["Piso", equipo.piso], ["Ambiente", equipo.ambiente],
                  ["Marca", equipo.marca], ["Modelo", equipo.modelo], ["N° Serie", equipo.serie],
                  ["Capacidad", equipo.capacidad ? equipo.capacidad + (GRUPO_POR_TIPO[equipo.tipoEquipo] === "ventilacion" ? " CFM" : " BTU") : null],
                ].map(([l, v]) => (
                  <div key={l}><div style={s.fl}>{l}</div><div style={s.fv}>{v || "-"}</div></div>
                ))}
              </div>
              <div style={{ ...s.g4, marginTop: "10px" }}>
                {[
                  GRUPO_POR_TIPO[equipo.tipoEquipo] !== "ventilacion" && ["Refrigerante", equipo.tipoRefrigerante],
                  ["Voltaje de placa", equipo.voltaje ? equipo.voltaje + "V" : null],
                  ["Amperaje nominal", equipo.amperaje ? equipo.amperaje + "A" : null],
                  ["Fases", equipo.fases],
                  equipo.condVoltaje && ["Voltaje cond.", equipo.condVoltaje + "V"],
                  equipo.condAmperaje && ["Amperaje cond.", equipo.condAmperaje + "A"],
                  equipo.modeloCompresor && ["Modelo compresor", equipo.modeloCompresor],
                ].filter(Boolean).map(([l, v]) => (
                  <div key={l}><div style={s.fl}>{l}</div><div style={s.fv}>{v || "-"}</div></div>
                ))}
              </div>
              {(equipo.contrato || equipo.modeloFaja || equipo.numFajas || equipo.marcaMotor || equipo.modeloMotor || equipo.serieMotor) && (
                <div style={{ ...s.g4, marginTop: "10px" }}>
                  {[
                    ["Contrato", equipo.contrato], ["Modelo de faja", equipo.modeloFaja], ["N° de fajas", equipo.numFajas],
                    ["Marca motor", equipo.marcaMotor], ["Modelo motor", equipo.modeloMotor], ["N° serie motor", equipo.serieMotor],
                  ].filter(([, v]) => v).map(([l, v]) => (
                    <div key={l}><div style={s.fl}>{l}</div><div style={s.fv}>{v}</div></div>
                  ))}
                </div>
              )}
            </div>

            {/* Observaciones en formato columnas */}
            <div style={s.sec}>
              <div style={{ ...s.secT, display: "flex", alignItems: "center", gap: "8px", justifyContent: "space-between" }}>
                <span>⚠️ Observación · Causa · Recomendación</span>
                {equipo.ultimoProtocolo && (
                  <span style={{ fontSize: "9px", padding: "2px 7px", borderRadius: "20px", background: "#e8f5e9", color: "#2e7d32", border: "0.5px solid #a5d6a7" }}>
                    🔄 desde protocolo {equipo.ultimoProtocolo}
                  </span>
                )}
              </div>
              {obs.length > 0 ? (
                <>
                  <div style={s.ocrHdr}>
                    <span></span>
                    <span style={s.ocrHdrLbl}>Observación</span>
                    <span style={s.ocrHdrLbl}>Causa</span>
                    <span style={s.ocrHdrLbl}>Recomendación</span>
                  </div>
                  {obs.map((o, i) => (
                    <div key={i} style={s.ocrRow}>
                      <div style={s.ocrNum}>{i + 1}</div>
                      <div>
                        <div style={s.cellObs}>{o.texto}</div>
                        {(o.fecha || o.tecnico) && (
                          <div style={{ fontSize: "9px", color: "#aaa", marginTop: "2px" }}>
                            {o.fecha}{o.fecha && o.tecnico ? " · " : ""}{o.tecnico ? "Téc: " + o.tecnico : ""}
                          </div>
                        )}
                      </div>
                      <div style={s.cellCausa}>{o.causa || "—"}</div>
                      <div style={s.cellRec}>{typeof rec[i] === "string" ? rec[i] : rec[i]?.texto || "—"}</div>
                    </div>
                  ))}
                </>
              ) : (
                <div style={{ fontSize: "12px", color: "#aaa", fontStyle: "italic", padding: "6px 0" }}>Sin observaciones registradas</div>
              )}
            </div>

            {/* Correctivos */}
            {cor.length > 0 && (
              <div style={s.sec}>
                <div style={s.secT}>🔧 Correctivos realizados</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {cor.map((c, i) => (
                    <div key={i} style={s.iCor}>
                      <div style={{ fontSize: "12px", fontWeight: 500, color: "#222" }}>{typeof c === "object" ? c.descripcion : c}</div>
                      {typeof c === "object" && c.fecha && <div style={{ fontSize: "11px", color: "#888" }}>📅 {c.fecha}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Cronograma dinámico */}
            <div style={s.sec}>
              <div style={s.secT}>
                📅 Cronograma de mantenimiento
                {equipo.frecuencia && <span style={{ fontSize: "9px", padding: "2px 7px", borderRadius: "20px", background: "#e8f0fe", color: "#1a5fa8", border: "0.5px solid #c5d5e8", marginLeft: "8px" }}>{equipo.frecuencia}</span>}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: cronCols, gap: "8px" }}>
                {cron.map(({ label, fecha, estado }, i) => {
                  const col = cronColor(estado);
                  return (
                    <div key={i} style={{ textAlign: "center", padding: "10px 8px", borderRadius: "8px", background: col.bg, border: `0.5px solid ${col.border}` }}>
                      <div style={{ fontSize: "10px", color: col.color, fontWeight: 500, marginBottom: "4px" }}>{label}</div>
                      <div style={{ fontSize: "11px", color: col.color, marginBottom: "4px" }}>{fecha || "Sin fecha"}</div>
                      <div style={{ fontSize: "10px", color: col.color }}>{col.icon} {estado.charAt(0).toUpperCase() + estado.slice(1)}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* QR */}
            <div style={s.sec}>
              <div style={s.secT}>📱 Código QR</div>
              <div style={{ display: "flex", gap: "20px", alignItems: "flex-start", flexWrap: "wrap" }}>
                <div style={{ textAlign: "center" }}>
                  <img src={qrUrl} alt="QR" style={{ width: px, height: px, border: "0.5px solid #e0e0e0", borderRadius: "8px" }} />
                  <div style={{ fontSize: "10px", color: "#888", marginTop: "4px" }}>Vista previa</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "11px", color: "#888", marginBottom: "10px" }}>Tamaño de impresión:</div>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "12px" }}>
                    {["2x2", "3x3", "5x5", "personalizado"].map(t => (
                      <div key={t} onClick={() => setTamanoQR(t)}
                        style={{ display: "flex", alignItems: "center", gap: "6px", padding: "7px 12px", border: tamanoQR === t ? "2px solid #1a5fa8" : "0.5px solid #ddd", borderRadius: "8px", background: tamanoQR === t ? "#e8f0fe" : "white", cursor: "pointer" }}>
                        <div style={{ width: "14px", height: "14px", borderRadius: "50%", border: tamanoQR === t ? "2px solid #1a5fa8" : "1.5px solid #aaa", background: tamanoQR === t ? "#1a5fa8" : "white", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {tamanoQR === t && <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: "white" }}></div>}
                        </div>
                        <span style={{ fontSize: "12px", fontWeight: tamanoQR === t ? 500 : 400, color: tamanoQR === t ? "#1a5fa8" : "#333" }}>
                          {t === "personalizado" ? "Personalizado" : `${t} cm`}
                        </span>
                      </div>
                    ))}
                  </div>
                  {tamanoQR === "personalizado" && (
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 12px", background: "#f5f5f5", borderRadius: "8px", border: "0.5px solid #e0e0e0", marginBottom: "12px" }}>
                      <span style={{ fontSize: "11px", color: "#888", whiteSpace: "nowrap" }}>Escala:</span>
                      <input type="range" min="1" max="10" value={escala} onChange={e => setEscala(Number(e.target.value))} style={{ flex: 1 }} />
                      <span style={{ fontSize: "12px", fontWeight: 500, minWidth: "36px" }}>{escala} cm</span>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <button style={s.btnImp} onClick={imprimirQR}>🖨️ Imprimir QR</button>
                    <button style={{ ...s.btnImp, background: "#e8f0fe", color: "#1a5fa8", border: "0.5px solid #c5d5e8" }} onClick={imprimirFicha}>🖨️ Imprimir ficha</button>
                    <button style={s.btnPDF} onClick={() => generarPDF("descargar")} disabled={imprimiendo}>
                      {imprimiendo ? "Generando..." : "📄 Descargar PDF"}
                    </button>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

const s = {
  page: { minHeight: "100vh", background: "#f0f4f8", fontFamily: "Inter, Arial, sans-serif" },
  navbar: { background: "white", borderBottom: "0.5px solid #e0e0e0", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10 },
  navLeft: { display: "flex", alignItems: "center", gap: "12px" },
  logo: { fontFamily: "'Arial Black', sans-serif", fontWeight: 900, fontSize: "20px", display: "flex", alignItems: "baseline", letterSpacing: "1px" },
  div: { width: "1px", height: "18px", background: "#e0e0e0" },
  btnBack: { background: "none", border: "none", color: "#1a5fa8", cursor: "pointer", fontSize: "13px", fontWeight: 500, padding: 0 },
  badge: { padding: "3px 12px", borderRadius: "20px", fontSize: "11px", fontWeight: 500, whiteSpace: "nowrap" },
  content: { maxWidth: "1200px", margin: "0 auto", padding: "20px 24px" },
  layout: { display: "flex", gap: "16px", alignItems: "flex-start" },
  sidebar: { width: "185px", flexShrink: 0, display: "flex", flexDirection: "column", gap: "10px" },
  sCard: { background: "white", border: "0.5px solid #e0e0e0", borderRadius: "12px", padding: "12px 14px" },
  iconWrap: { width: "60px", height: "60px", borderRadius: "12px", background: "#f8f9fa", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px" },
  sNombre: { fontSize: "13px", fontWeight: 500, color: "#222", textAlign: "center", marginBottom: "5px" },
  sTipo: { fontSize: "10px", padding: "2px 8px", background: "#e8f0fe", color: "#1a5fa8", borderRadius: "20px", display: "inline-block" },
  sLbl: { fontSize: "10px", color: "#888", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" },
  sVal: { fontSize: "12px", color: "#222" },
  codTag: { fontSize: "13px", padding: "3px 8px", background: "#f3e5f5", color: "#6a1b9a", borderRadius: "5px", fontFamily: "monospace", fontWeight: 700 },
  btnQR: { width: "100%", fontSize: "11px", padding: "8px", borderRadius: "8px", border: "0.5px solid #ddd", background: "white", cursor: "pointer", fontWeight: 500 },
  main: { flex: 1, display: "flex", flexDirection: "column", gap: "10px", minWidth: 0 },
  sec: { background: "white", border: "0.5px solid #e0e0e0", borderRadius: "12px", padding: "14px" },
  secT: { fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "10px" },
  g4: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "10px" },
  g3: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "10px" },
  fl: { fontSize: "10px", color: "#888", marginBottom: "3px" },
  fv: { fontSize: "12px", fontWeight: 500, color: "#222" },
  ocrHdr: { display: "grid", gridTemplateColumns: "24px 1fr 1fr 1fr", gap: "8px", paddingBottom: "4px" },
  ocrHdrLbl: { fontSize: "8.5px", color: "#aaa", textTransform: "uppercase", letterSpacing: "0.05em" },
  ocrRow: { display: "grid", gridTemplateColumns: "24px 1fr 1fr 1fr", gap: "8px", alignItems: "start", marginBottom: "7px" },
  ocrNum: { fontSize: "11px", color: "#aaa", fontWeight: 700, paddingTop: "8px", textAlign: "center" },
  cellObs: { fontSize: "11px", color: "#e65100", background: "#fff8e1", padding: "7px 9px", borderRadius: "6px", border: "0.5px solid #ffa726" },
  cellCausa: { fontSize: "11px", color: "#c62828", background: "#fef0f0", padding: "7px 9px", borderRadius: "6px", border: "0.5px solid #ef9a9a" },
  cellRec: { fontSize: "11px", color: "#2e7d32", background: "#e8f5e9", padding: "7px 9px", borderRadius: "6px", border: "0.5px solid #66bb6a" },
  iCor: { padding: "9px 12px", background: "#f5f5f5", borderRadius: "8px", borderLeft: "3px solid #1a5fa8" },
  btnImp: { fontSize: "11px", padding: "7px 16px", borderRadius: "8px", border: "0.5px solid #ddd", background: "white", cursor: "pointer", fontWeight: 500 },
  btnPDF: { fontSize: "11px", padding: "7px 16px", borderRadius: "8px", background: "#c62828", color: "white", border: "none", cursor: "pointer", fontWeight: 500 },
  centro: { textAlign: "center", padding: "3rem", fontSize: "16px", color: "#888" },
};
