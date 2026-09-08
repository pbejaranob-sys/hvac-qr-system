import { useState, useEffect } from "react";
import { db } from "../firebase";
import { doc, updateDoc, collection, addDoc, serverTimestamp, runTransaction } from "firebase/firestore";
import jsPDF from "jspdf";

const FONT = "'Manrope', -apple-system, sans-serif";

function useManropeFont() {
  useEffect(() => {
    if (document.getElementById("font-manrope")) return;
    const link = document.createElement("link");
    link.id = "font-manrope";
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&display=swap";
    document.head.appendChild(link);
  }, []);
}

// ---- Mapeo tipo → grupo de protocolo ----
const GRUPO_POR_TIPO = {
  "Split Piso Techo": "expansion", "Split Pared": "expansion", "Split Ducto": "expansion",
  "Split Fancoil": "expansion", "Split Cassete": "expansion", "Ventana": "expansion",
  "Autocontenido": "expansion", "Precisión": "expansion",
  "VRV Evaporador": "expansion", "VRV Condensador": "expansion",
  "Split Muro": "expansion", "Split Techo": "expansion", "Cassette": "expansion",
  "Casete": "expansion", "Cassete": "expansion",
  "Fancoil AH": "fancoil", "Pared AH": "fancoil", "UMA AH": "fancoil", "Fan Coil": "fancoil",
  "Ventilación": "ventilacion", "Extractor": "ventilacion", "Inyector": "ventilacion",
  "Cortina de aire": "ventilacion", "Jetfan": "ventilacion", "Presurizador": "ventilacion",
};

const GRUPOS_INFO = {
  expansion: { label: "Expansión Directa (Split / VRV)", color: "#1a4fc0", emoji: "❄️" },
  fancoil: { label: "Fan Coil / UMA Agua Helada", color: "#185fa5", emoji: "💧" },
  ventilacion: { label: "Ventilación / Extracción", color: "#0f6e56", emoji: "🌀" },
};

// ---- Ítems de estatus ----
const FANCOIL_ITEMS = [
  "Balance de caudal de aire", "Estado válvula agua helada", "Aislamiento térmico",
  "Estado de llave termomagnética", "Estado de contactores", "Funcionamiento de dampers",
  "Velocidad motores ventiladores", "Sensor de suministros de aire", "Sensor de diferencial de presión",
  "Sensor de arranque y parada", "Sensor de temperatura ambiente", "Limpieza de contactos",
  "Lubricación de motores", "Lubricación de chumaceras", "Templado de fajas",
  "Alineamiento de poleas", "Estado de impulsor de aire", "Limpieza de filtros de aire",
  "Limpieza bandeja de condesado", "Lavado de coil",
];
const EXPANSION_ITEMS = [
  "Limpieza de filtros de aire", "Limpieza de bandeja de drenaje", "Limpieza de serpentín evaporador",
  "Descarte visual de fugas de refrigerante", "Limpieza de serpentín condensador",
  "Limpieza externa condensador", "Ajuste de terminales eléctricos de compresores y motores",
  "Ajuste de terminales eléctricos de contactores y borneras", "Limpieza de difusores y rejillas",
  "Comprobación de eficiencia de filtros secadores",
  "Verificación de operación del sistema de control termostato y tarjetas",
  "Pintado de impulsores, bases y soportes",
];
const VENTILACION_ITEMS = [
  "Verificación de funcionamiento", "Ajuste y limpieza de impulsores de aire",
  "Revisión y templado de fajas", "Ajuste de pernos de anclaje y elementos antivibratorios",
  "Prueba del normal funcionamiento de tableros de arranque", "Limpieza de filtros de aire",
  "Lubricación de bocinas y rodamientos(s)", "Pintado de impulsores de aire",
  "Lubricación de chumaceras(s)", "Medición de caudal de aire",
  "Revisión de rodamientos del motor(s)", "Desmontaje parcial y limpieza de los motores eléctricos(s)",
  "Pintura de estructura(s)",
];

// ---- Cálculos ----
const calcDesbalance = (a, b, c) => {
  const vals = [a, b, c].map(parseFloat).filter(v => !isNaN(v));
  if (vals.length < 2) return "";
  const prom = vals.reduce((s, v) => s + v, 0) / vals.length;
  if (prom === 0) return "";
  const maxD = Math.max(...vals.map(v => Math.abs(v - prom)));
  return ((maxD / prom) * 100).toFixed(1) + "%";
};
const calcDelta = (a, b) => {
  const x = parseFloat(a), y = parseFloat(b);
  if (isNaN(x) || isNaN(y)) return "";
  return Math.abs(x - y).toFixed(1) + " °C";
};

// ---- Estado vacío de un protocolo ----
const protocoloVacio = (grupo, equipo) => ({
  grupo,
  fecha: new Date().toISOString().split("T")[0],
  tecnico: "", tipoServicio: "Preventivo", ordenTrabajo: "",
  monofasico: equipo?.fases === "Monofásico",
  vL1L2: "", vL2L3: "", vL3L1: "",
  aL1: "", aL2: "", aL3: "",
  megL1T: "", megL2T: "", megL3T: "", megL1L2: "", megL2L3: "", megL3L1: "",
  // Expansión
  condVL1L2: "", condVL2L3: "", condVL3L1: "",
  condAL1: "", condAL2: "", condAL3: "",
  condMegL1T: "", condMegL2T: "", condMegL3T: "",
  condMegL1L2: "", condMegL2L3: "", condMegL3L1: "",
  presSuccion: "", presLiquido: "", tSatMedida: "", tSatTabla: "",
  tRetornoEvap: "", tSuministroEvap: "", tAmbCondensador: "", tTrabajoMotor: "",
  // Fancoil
  tEntradaAgua: "", tSalidaAgua: "", presEntradaAgua: "", presSalidaAgua: "",
  tRetornoAire: "", tSuministroAire: "",
  // Ventilacion
  caudalAire: "",
  estatusItems: {},
  observaciones: [{ observacion: "", causa: "", recomendacion: "" }],
  estadoFinal: equipo?.estado || "Operativo",
});

// ---- Iconos SVG ----
const IconPersona = ({ color = "#1a4fc0" }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="8" r="3.5" stroke={color} strokeWidth="1.6" />
    <path d="M5 20c1.2-4 4-6 7-6s5.8 2 7 6" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);
const IconLlave = ({ color = "#fff" }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M14.7 6.3a3 3 0 0 1-3.9 3.9L5 16v3h3l5.8-5.8a3 3 0 0 1 3.9-3.9l-2.2 2.2-1.4-1.4 2.2-2.2z" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
);
const IconCandado = () => (
  <svg width="52%" height="52%" viewBox="0 0 24 24" fill="none">
    <rect x="5" y="10" width="14" height="10" rx="2" stroke="white" strokeWidth="1.6" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="white" strokeWidth="1.6" />
  </svg>
);
const IconChevron = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M9 6l6 6-6 6" stroke="#9aa2b3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconFicha = ({ color }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <rect x="4.5" y="4" width="15" height="17" rx="1.6" stroke={color} strokeWidth="1.7" />
    <path d="M9.2 4.6a2.8 2.8 0 0 1 5.6 0" stroke={color} strokeWidth="1.7" />
    <rect x="8.6" y="3.2" width="6.8" height="3.2" rx="0.8" stroke={color} strokeWidth="1.7" fill="#e5f0ff" />
    <circle cx="8" cy="10.4" r="0.9" fill={color} />
    <line x1="10.4" y1="10.4" x2="16" y2="10.4" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    <circle cx="8" cy="13.2" r="0.9" fill={color} />
    <line x1="10.4" y1="13.2" x2="16" y2="13.2" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    <circle cx="8" cy="16" r="0.9" fill={color} />
    <line x1="10.4" y1="16" x2="16" y2="16" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    <rect x="7.6" y="18" width="8.4" height="2.6" rx="0.5" stroke={color} strokeWidth="1.6" />
  </svg>
);
const IconCheck = ({ color }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M5 13l4 4 10-10" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconAlerta = ({ color }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M12 3l9 16H3l9-16z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 10v4M12 17h.01" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);
const IconGota = ({ color = "#1a4fc0" }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M12 2c3 4 6 7.5 6 11.5A6 6 0 0 1 6 13.5C6 9.5 9 6 12 2z" stroke={color} strokeWidth="1.7" strokeLinejoin="round" />
  </svg>
);
const IconReemplazo = ({ color = "#7c3fd8" }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M17 2l4 4-4 4" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M3 12V10a4 4 0 0 1 4-4h14" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <path d="M7 22l-4-4 4-4" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M21 12v2a4 4 0 0 1-4 4H3" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);
const IconFlechaAtras = ({ color = "#1a4fc0", size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M15 18l-6-6 6-6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconGuardar = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" />
    <path d="M7 21v-7h10v7M7 3v5h8" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" />
  </svg>
);
const IconPDF = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M4 4h11l5 5v11H4V4z" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" />
    <path d="M14 4v5h5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M8 12h8M8 16h5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

// ---- Componentes de campo reutilizables ----
const FieldReadonly = ({ label, value }) => (
  <div>
    <div style={sf.fieldLabel}>{label}</div>
    <div style={sf.readonlyBox}>{value || "—"}</div>
  </div>
);
const FieldInput = ({ label, value, onChange, type = "text", placeholder = "" }) => (
  <div>
    <div style={sf.fieldLabel}>{label}</div>
    <input type={type} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)}
      style={sf.input} />
  </div>
);
const FieldSelect = ({ label, value, onChange, options }) => (
  <div>
    <div style={sf.fieldLabel}>{label}</div>
    <select value={value} onChange={e => onChange(e.target.value)} style={sf.input}>
      {options.map(o => <option key={o}>{o}</option>)}
    </select>
);
const FieldCalc = ({ label, value }) => (
  <div>
    <div style={sf.fieldLabel}>{label}</div>
    <div style={sf.calcBox}>{value || "—"}</div>
  </div>
);
const EstatusRow = ({ item, value, onChange }) => {
  const color = value === "Falla" ? "#a52b2b" : value === "Observado" ? "#a8720b" : value === "N/A" ? "#8a92a6" : "#1c7a44";
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid #eef1f6" }}>
      <span style={{ fontSize: "13px", color: "#26314d", flex: 1 }}>{item}</span>
      <select value={value || ""} onChange={e => onChange(e.target.value)}
        style={{ fontSize: "12px", padding: "5px 8px", borderRadius: "8px", border: "1px solid #dfe6f5", background: "#f9fafc", fontFamily: FONT, color, fontWeight: 700, minWidth: "110px" }}>
        <option value="">—</option>
        <option value="OK">OK</option>
        <option value="Observado">Observado</option>
        <option value="Falla">Falla</option>
        <option value="N/A">N/A</option>
      </select>
    </div>
  );
};

// ---- PDF por grupo ----
const generarPDF = (equipo, prot) => {
  const pdf = new jsPDF("p", "mm", "a4");
  const M = 14, PW = 210, CW = PW - M * 2;
  let y = 14;
  const grupo = prot.grupo || GRUPO_POR_TIPO[equipo.tipoEquipo] || "fancoil";
  const grupoInfo = GRUPOS_INFO[grupo] || GRUPOS_INFO.fancoil;

  pdf.setFillColor(26, 79, 192); pdf.rect(0, 0, PW, 22, "F");
  pdf.setFontSize(13); pdf.setFont("helvetica", "bold"); pdf.setTextColor(255, 255, 255);
  pdf.text(`HVAC - Protocolo ${grupoInfo.emoji} ${grupoInfo.label}`, M, 10);
  pdf.setFontSize(9); pdf.setFont("helvetica", "normal");
  pdf.text(`${equipo.cliente || ""} · ${equipo.sede || ""} · ${equipo.ambiente || ""}   Fecha: ${prot.fecha}   Técnico: ${prot.tecnico || "—"}`, M, 18);
  y = 30;

  const check = h => { if (y + h > 280) { pdf.addPage(); y = 14; } };
  const seccion = titulo => {
    check(10); pdf.setFillColor(229, 240, 255); pdf.rect(M, y, CW, 7, "F");
    pdf.setFontSize(9); pdf.setFont("helvetica", "bold"); pdf.setTextColor(18, 36, 94);
    pdf.text(titulo, M + 3, y + 5); y += 10;
  };
  const campo4 = (items) => {
    check(12);
    const cw = CW / 4;
    items.forEach(([label, val], i) => {
      const x = M + i * cw;
      pdf.setFontSize(7); pdf.setFont("helvetica", "normal"); pdf.setTextColor(140, 140, 140);
      pdf.text(label, x, y);
      pdf.setFont("helvetica", "bold"); pdf.setTextColor(15, 27, 61);
      pdf.text(String(val || "—"), x, y + 4.5);
    });
    y += 12;
  };

  seccion("Datos del equipo");
  campo4([["Cliente", equipo.cliente], ["Sede", equipo.sede], ["Piso", equipo.piso], ["Ambiente", equipo.ambiente]]);
  campo4([["Marca", equipo.marca], ["Modelo", equipo.modelo], ["Serie", equipo.serie], ["Capacidad", equipo.capacidad]]);
  campo4([["Voltaje placa", equipo.voltaje ? equipo.voltaje + "V" : "—"], ["Amperaje", equipo.amperaje ? equipo.amperaje + "A" : "—"], ["Fases", equipo.fases], ["Tipo equipo", equipo.tipoEquipo]]);

  seccion("Datos del servicio");
  campo4([["Fecha", prot.fecha], ["Técnico", prot.tecnico], ["Tipo", prot.tipoServicio], ["OT", prot.ordenTrabajo || "—"]]);

  const esMono = equipo?.fases === "Monofásico";
  seccion("Parámetros eléctricos");
  campo4([["V L1-L2", prot.vL1L2 || "—"], ["V L2-L3", esMono ? "N/A" : (prot.vL2L3 || "—")], ["V L3-L1", esMono ? "N/A" : (prot.vL3L1 || "—")], ["Desbal. V", calcDesbalance(prot.vL1L2, prot.vL2L3, prot.vL3L1) || "—"]]);
  campo4([["A L1", prot.aL1 || "—"], ["A L2", prot.aL2 || "—"], ["A L3", esMono ? "N/A" : (prot.aL3 || "—")], ["Desbal. A", calcDesbalance(prot.aL1, prot.aL2, prot.aL3) || "—"]]);
  campo4([["Meg L1-T", prot.megL1T || "—"], ["Meg L2-T", prot.megL2T || "—"], ["Meg L3-T", prot.megL3T || "—"], ["Meg L1-L2", prot.megL1L2 || "—"]]);

  if (grupo === "expansion") {
    seccion("Condensador");
    campo4([["V L1-L2", prot.condVL1L2 || "—"], ["V L2-L3", esMono ? "N/A" : (prot.condVL2L3 || "—")], ["A L1", prot.condAL1 || "—"], ["A L2", prot.condAL2 || "—"]]);
    seccion("Refrigeración");
    campo4([["P. succión", prot.presSuccion || "—"], ["P. líquido", prot.presLiquido || "—"], ["T° sat. medida", prot.tSatMedida || "—"], ["T° sat. tabla", prot.tSatTabla || "—"]]);
    campo4([["T° retorno evap.", prot.tRetornoEvap || "—"], ["T° suministro evap.", prot.tSuministroEvap || "—"], ["T° amb. cond.", prot.tAmbCondensador || "—"], ["T° trabajo motor", prot.tTrabajoMotor || "—"]]);
  }
  if (grupo === "fancoil") {
    seccion("Temperaturas y presiones");
    campo4([["T° mot.", prot.tTrabajoMotor || "—"], ["T° ent. agua", prot.tEntradaAgua || "—"], ["T° sal. agua", prot.tSalidaAgua || "—"], ["∆ agua", calcDelta(prot.tEntradaAgua, prot.tSalidaAgua) || "—"]]);
    campo4([["P. ent. agua", prot.presEntradaAgua || "—"], ["P. sal. agua", prot.presSalidaAgua || "—"], ["T° retorno aire", prot.tRetornoAire || "—"], ["T° suministro aire", prot.tSuministroAire || "—"]]);
  }
  if (grupo === "ventilacion") {
    seccion("Parámetros de operación");
    campo4([["T° trabajo motor", prot.tTrabajoMotor || "—"], ["Caudal de aire", prot.caudalAire ? prot.caudalAire + " CFM" : "—"], ["", ""], ["", ""]]);
  }

  // Estatus
  const items = grupo === "fancoil" ? FANCOIL_ITEMS : grupo === "expansion" ? EXPANSION_ITEMS : VENTILACION_ITEMS;
  const estatusItems = prot.estatusItems || {};
  const itemsConValor = items.filter(it => estatusItems[it]);
  if (itemsConValor.length > 0) {
    seccion("Estado de componentes");
    const cw2 = CW / 2;
    itemsConValor.forEach((item, i) => {
      if (i % 2 === 0) check(8);
      const x = M + (i % 2) * cw2;
      const val = estatusItems[item];
      const [cr, cg, cb] = val === "Falla" ? [165, 43, 43] : val === "Observado" ? [168, 114, 11] : val === "N/A" ? [138, 146, 166] : [28, 122, 68];
      pdf.setFontSize(7.5); pdf.setFont("helvetica", "normal"); pdf.setTextColor(38, 49, 77);
      pdf.text(item, x + 2, y + (i % 2 === 0 && i > 0 ? 0 : 0) + 4.5);
      pdf.setFillColor(val === "Falla" ? 253 : val === "Observado" ? 255 : val === "N/A" ? 244 : 230, val === "Falla" ? 238 : val === "Observado" ? 248 : val === "N/A" ? 246 : 247, val === "Falla" ? 238 : val === "Observado" ? 230 : val === "N/A" ? 251 : 236);
      pdf.roundedRect(x + cw2 - 24, y + (i % 2 === 0 && i > 0 ? 0 : 0) + 1, 22, 5.5, 1.5, 1.5, "F");
      pdf.setFontSize(6.5); pdf.setFont("helvetica", "bold"); pdf.setTextColor(cr, cg, cb);
      pdf.text(val, x + cw2 - 13, y + (i % 2 === 0 && i > 0 ? 0 : 0) + 4.8, { align: "center" });
      if (i % 2 === 1) y += 8;
    });
    if (itemsConValor.length % 2 !== 0) y += 8;
  }

  // Observaciones
  const obsValidas = (prot.observaciones || []).filter(o => o.observacion?.trim());
  if (obsValidas.length > 0) {
    seccion("Observación · Causa · Recomendación");
    const col = (CW - 8) / 3;
    obsValidas.forEach((o, i) => {
      check(22);
      pdf.setFontSize(6.5); pdf.setFont("helvetica", "normal"); pdf.setTextColor(130, 130, 130);
      pdf.text(String(i + 1), M, y + 4);
      [[o.observacion, [255, 248, 230], [138, 91, 10]], [o.causa || "—", [253, 238, 238], [165, 43, 43]], [o.recomendacion || "—", [230, 247, 236], [28, 122, 68]]].forEach(([txt, bg, color], j) => {
        const cx = M + 8 + j * (col + 1);
        pdf.setFillColor(...bg); pdf.rect(cx, y, col, 18, "F");
        pdf.setFontSize(7); pdf.setFont("helvetica", "normal"); pdf.setTextColor(...color);
        pdf.text(pdf.splitTextToSize(txt || "—", col - 4).slice(0, 3), cx + 2, y + 5);
      });
      y += 21;
    });
  }

  seccion("Resultado del servicio");
  campo4([["Estado final", prot.estadoFinal], ["Técnico", prot.tecnico], ["", ""], ["", ""]]);

  pdf.setFontSize(7.5); pdf.setTextColor(150, 150, 150);
  pdf.text("HVAC Sistema de Mantenimiento", M, 290);
  pdf.save(`protocolo-${grupo}-${equipo.codigo || equipo.ambiente || "equipo"}-${prot.fecha}.pdf`);
};

// ========================================
// COMPONENTE PRINCIPAL
// ========================================
export default function AccesoEquipo({ equipo, onVerInforme }) {
  useManropeFont();

  const [vista, setVista] = useState("home");
  const [rol, setRol] = useState(null);
  const [codigo, setCodigo] = useState("");
  const [hasError, setHasError] = useState(false);
  const [mensajeAveria, setMensajeAveria] = useState("");
  const [enviandoAveria, setEnviandoAveria] = useState(false);
  const [errorAveria, setErrorAveria] = useState("");

  // Protocolo
  const [prot, setProt] = useState(null);
  const [guardandoProt, setGuardandoProt] = useState(false);
  const [errorProt, setErrorProt] = useState("");
  const [protGuardado, setProtGuardado] = useState(false);

  // Carga de refrigerante
  const [formCarga, setFormCarga] = useState({ tipo: "carga", kg: "", tecnico: "" });
  const [guardandoCarga, setGuardandoCarga] = useState(false);
  const [errorCarga, setErrorCarga] = useState("");

  // Reemplazo
  const [formReemplazo, setFormReemplazo] = useState({
    marca: "", modelo: "", serie: "", capacidad: "", tipoRefrigerante: "",
    fases: "Monofásico", voltaje: "", amperaje: "", cargaNominal: "",
    cargaAdicionalInstalacion: "", kgRecuperados: "", tecnico: "",
  });
  const [guardandoReemplazo, setGuardandoReemplazo] = useState(false);
  const [errorReemplazo, setErrorReemplazo] = useState("");

  const grupo = GRUPO_POR_TIPO[equipo?.tipoEquipo];
  const esConGas = ["Split Piso Techo","Split Pared","Split Ducto","Split Fancoil","Split Cassete","Ventana","Autocontenido","Precisión","VRV Evaporador","VRV Condensador"].includes(equipo?.tipoEquipo);
  const esMono = equipo?.fases === "Monofásico";

  const CODIGOS = { cliente: "0001", tecnico: "1001" };
  const LABELS = { cliente: "Cliente", tecnico: "Técnico" };

  const elegirRol = r => { setRol(r); setCodigo(""); setHasError(false); setVista("password"); };
  const enviarCodigo = () => {
    if (codigo === CODIGOS[rol]) { setVista("menu"); setHasError(false); }
    else { setHasError(true); setCodigo(""); }
  };
  const volverAHome = () => { setVista("home"); setRol(null); setCodigo(""); setHasError(false); };

  const setP = (campo, val) => setProt(prev => ({ ...prev, [campo]: val }));
  const setEstatus = (item, val) => setProt(prev => ({ ...prev, estatusItems: { ...prev.estatusItems, [item]: val } }));
  const updateObs = (i, campo, val) => setProt(prev => {
    const obs = [...prev.observaciones];
    obs[i] = { ...obs[i], [campo]: val };
    return { ...prev, observaciones: obs };
  });
  const addObs = () => setProt(prev => ({ ...prev, observaciones: [...prev.observaciones, { observacion: "", causa: "", recomendacion: "" }] }));
  const removeObs = i => setProt(prev => ({ ...prev, observaciones: prev.observaciones.filter((_, idx) => idx !== i) }));

  const abrirMantenimiento = () => {
    if (!grupo) { alert("Este tipo de equipo aún no tiene protocolo disponible."); return; }
    setProt(protocoloVacio(grupo, equipo));
    setErrorProt("");
    setProtGuardado(false);
    setVista("mantenimiento");
  };

  const guardarProtocolo = async () => {
    setGuardandoProt(true); setErrorProt("");
    try {
      const historial = equipo.protocolos || [];
      const nuevos = [prot, ...historial].slice(0, 10);
      const obsSync = (prot.observaciones || []).filter(o => o.observacion?.trim()).map(o => ({ texto: o.observacion, causa: o.causa || "", rec: o.recomendacion || "", fecha: prot.fecha, tecnico: prot.tecnico }));
      const recSync = (prot.observaciones || []).filter(o => o.recomendacion?.trim()).map(o => o.recomendacion);
      await updateDoc(doc(db, "equipos", equipo.id), {
        protocolos: nuevos,
        observacionesArray: obsSync.map(o => ({ texto: o.texto, fecha: o.fecha, tecnico: o.tecnico, causa: o.causa })),
        observaciones: obsSync.map(o => o.texto).join("\n"),
        recomendacionesArray: recSync,
        recomendaciones: recSync.join("\n"),
        estado: prot.estadoFinal,
        ultimoMantenimiento: prot.fecha,
        ultimoProtocolo: prot.fecha,
        ultimoTecnico: prot.tecnico,
      });
      setProtGuardado(true);
    } catch (e) { setErrorProt("No se pudo guardar. Intenta de nuevo."); }
    setGuardandoProt(false);
  };

  const guardarCarga = async e => {
    e.preventDefault();
    if (!formCarga.kg) return;
    setGuardandoCarga(true); setErrorCarga("");
    try {
      await addDoc(collection(db, "movimientosRefrigerante"), {
        equipoId: equipo.id, equipoAmbiente: equipo.ambiente || "", equipoCodigo: equipo.codigo || "",
        cliente: equipo.cliente || "", sede: equipo.sede || "",
        tipo: formCarga.tipo, kg: Number(formCarga.kg),
        fecha: new Date().toISOString().split("T")[0], tecnico: formCarga.tecnico,
        fechaRegistro: serverTimestamp(),
      });
      setVista("carga_guardada");
    } catch { setErrorCarga("No se pudo guardar. Intenta de nuevo."); }
    setGuardandoCarga(false);
  };

  const guardarReemplazo = async e => {
    e.preventDefault();
    if (!formReemplazo.marca) return;
    setGuardandoReemplazo(true); setErrorReemplazo("");
    const equipoViejoId = equipo.id;
    try {
      const nuevoRef = doc(collection(db, "equipos"));
      const movRecRef = (formReemplazo.kgRecuperados && Number(formReemplazo.kgRecuperados) > 0) ? doc(collection(db, "movimientosRefrigerante")) : null;
      const movCargaRef = (formReemplazo.cargaAdicionalInstalacion && Number(formReemplazo.cargaAdicionalInstalacion) > 0) ? doc(collection(db, "movimientosRefrigerante")) : null;
      await runTransaction(db, async tx => {
        const vRef = doc(db, "equipos", equipoViejoId);
        const vSnap = await tx.get(vRef);
        if (!vSnap.exists()) throw new Error("Equipo no encontrado.");
        const viejo = vSnap.data();
        const hoy = new Date().toISOString().split("T")[0];
        tx.set(nuevoRef, { ...Object.fromEntries(["cliente","sede","adminid","codigo","piso","ambiente","tipoEquipo"].map(k => [k, viejo[k] || ""])), marca: formReemplazo.marca, modelo: formReemplazo.modelo, serie: formReemplazo.serie, capacidad: formReemplazo.capacidad, tipoRefrigerante: formReemplazo.tipoRefrigerante, fases: formReemplazo.fases, voltaje: formReemplazo.voltaje, amperaje: formReemplazo.amperaje, cargaNominal: formReemplazo.cargaNominal, estado: "Operativo", cicloVida: "activo", equipoAnteriorId: equipoViejoId, equipoReemplazoId: null, historialCount: (viejo.historialCount || 0) + 1, fechaInstalacion: hoy, fechaBaja: null, fechaRegistro: hoy });
        tx.update(vRef, { cicloVida: "reemplazado", fechaBaja: hoy, equipoReemplazoId: nuevoRef.id });
        if (movRecRef) tx.set(movRecRef, { equipoId: equipoViejoId, equipoAmbiente: viejo.ambiente || "", equipoCodigo: viejo.codigo || "", cliente: viejo.cliente || "", sede: viejo.sede || "", tipo: "recuperacion_baja", kg: Number(formReemplazo.kgRecuperados), fecha: hoy, tecnico: formReemplazo.tecnico, fechaRegistro: serverTimestamp() });
        if (movCargaRef) tx.set(movCargaRef, { equipoId: nuevoRef.id, equipoAmbiente: viejo.ambiente || "", equipoCodigo: viejo.codigo || "", cliente: viejo.cliente || "", sede: viejo.sede || "", tipo: "carga", kg: Number(formReemplazo.cargaAdicionalInstalacion), fecha: hoy, tecnico: formReemplazo.tecnico, fechaRegistro: serverTimestamp() });
      });
      setVista("reemplazo_guardado");
    } catch (err) { setErrorReemplazo("No se pudo completar: " + err.message); }
    setGuardandoReemplazo(false);
  };

  const enviarAveria = async () => {
    if (!mensajeAveria.trim()) return;
    setEnviandoAveria(true);
    try {
      await addDoc(collection(db, "averias"), { equipoId: equipo.id, equipoCodigo: equipo.codigo || "", cliente: equipo.cliente || "", sede: equipo.sede || "", ambiente: equipo.ambiente || "", piso: equipo.piso || "", tipoReportante: rol === "tecnico" ? "Técnico" : "Cliente", nombreReportante: rol === "tecnico" ? "Técnico" : (equipo.cliente || "Cliente"), mensaje: mensajeAveria.trim(), fecha: serverTimestamp(), atendida: false });
      setVista("enviado");
    } catch { setErrorAveria("No se pudo enviar. Intenta de nuevo."); }
    setEnviandoAveria(false);
  };

  const menuItems = [
    { key: "ficha", title: "Ver ficha técnica", subtitle: "Datos del equipo", bg: "#ffffff", border: "#c3d6fb", iconBg: "#e5f0ff", titleColor: "#0f1b3d", icon: <IconFicha color="#1a4fc0" />, onClick: onVerInforme },
    ...(rol === "tecnico" ? [{ key: "mantenimiento", title: "Registrar mantenimiento", subtitle: grupo ? `Protocolo ${GRUPOS_INFO[grupo]?.label || ""}` : "Protocolo de mantenimiento", bg: "#ffffff", border: "#c3d6fb", iconBg: "#e6f7ec", titleColor: "#0f1b3d", icon: <IconCheck color="#1c9a53" />, onClick: abrirMantenimiento }] : []),
    ...(rol === "tecnico" && esConGas ? [{ key: "carga", title: "Registrar carga de refrigerante", subtitle: "Solo Split, VRV y Chiller", bg: "#f3f8fe", border: "#1a4fc0", iconBg: "#ffffff", titleColor: "#0f1b3d", icon: <IconGota color="#1a4fc0" />, onClick: () => { setFormCarga({ tipo: "carga", kg: "", tecnico: "" }); setVista("carga"); } }] : []),
    ...(rol === "tecnico" && esConGas ? [{ key: "reemplazo", title: "Reemplazar equipo", subtitle: "El equipo actual queda como historial", bg: "#ffffff", border: "#e2d4fb", iconBg: "#f1e9fb", titleColor: "#0f1b3d", icon: <IconReemplazo color="#7c3fd8" />, onClick: () => { setFormReemplazo({ marca: "", modelo: "", serie: "", capacidad: equipo.capacidad || "", tipoRefrigerante: equipo.tipoRefrigerante || "", fases: equipo.fases || "Monofásico", voltaje: equipo.voltaje || "", amperaje: equipo.amperaje || "", cargaNominal: equipo.cargaNominal || "", cargaAdicionalInstalacion: "", kgRecuperados: "", tecnico: "" }); setVista("reemplazo"); } }] : []),
    { key: "averia", title: "Reportar avería", subtitle: "Describir el problema", bg: "#fdeeee", border: "#f6d3d3", iconBg: "#fbdada", titleColor: "#a52b2b", icon: <IconAlerta color="#c23b3b" />, onClick: () => setVista("averia") },
  ];

  // ============ HOME ============
  if (vista === "home") return (
    <div style={st.homeBg}>
      <div style={st.homeCol}>
        <div style={st.homeLogoWrap}><div style={st.homeLogoBox}><img src="/assets/hvac-isotipo-filled.png" alt="HVAC" style={st.homeLogoImg} /></div></div>
        <div style={st.homeBtnsWrap}>
          <button style={st.btnCliente} onClick={() => elegirRol("cliente")}><IconPersona color="#1a4fc0" /> Cliente</button>
          <button style={st.btnTecnico} onClick={() => elegirRol("tecnico")}><IconLlave color="#fff" /> Técnico</button>
        </div>
      </div>
    </div>
  );

  // ============ PASSWORD ============
  if (vista === "password") return (
    <div style={st.homeBg}>
      <div style={st.pwCol}>
        <div style={st.pwBadge}><IconCandado /></div>
        <div style={{ textAlign: "center" }}>
          <div style={st.pwTitulo}>Acceso {LABELS[rol]}</div>
          <div style={st.pwSub}>Ingresa tu contraseña de 4 dígitos</div>
        </div>
        <input type="password" inputMode="numeric" maxLength={4} autoFocus value={codigo}
          onChange={e => { setCodigo(e.target.value.replace(/\D/g, "").slice(0, 4)); setHasError(false); }}
          onKeyDown={e => e.key === "Enter" && enviarCodigo()}
          placeholder="••••" style={st.pwInput} />
        {hasError && <div style={st.pwError}>Contraseña incorrecta, intenta de nuevo.</div>}
        <button style={st.pwBtnIngresar} onClick={enviarCodigo}>Ingresar</button>
        <button style={st.pwBtnVolver} onClick={volverAHome}>← Volver</button>
      </div>
    </div>
  );

  // ============ MENU ============
  if (vista === "menu") return (
    <div style={st.menuBg}>
      <div style={st.menuCol}>
        <div style={st.menuLogoWrap}><img src="/assets/hvac-isotipo-blue.png" alt="HVAC" style={st.menuLogoImg} /></div>
        <div style={st.menuChipRow}>
          <span style={st.rolChip}>{LABELS[rol]}</span>
          <span style={st.dotMuted}>·</span>
          <span style={st.sesionTxt}>Sesión activa</span>
        </div>
        <div style={st.menuLista}>
          {menuItems.map(item => (
            <button key={item.key} onClick={item.onClick} style={{ ...st.menuItem, background: item.bg, border: `1px solid ${item.border}` }}>
              <div style={{ ...st.menuIconTile, background: item.iconBg }}>{item.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ ...st.menuItemTitulo, color: item.titleColor }}>{item.title}</div>
                <div style={st.menuItemSub}>{item.subtitle}</div>
              </div>
              <IconChevron />
            </button>
          ))}
        </div>
        <button style={st.btnSalir} onClick={volverAHome}><IconFlechaAtras /> Salir</button>
        <div style={st.footerTxt}>HVAC Sistema de Mantenimiento</div>
      </div>
    </div>
  );

  // ============ REGISTRAR MANTENIMIENTO ============
  if (vista === "mantenimiento" && prot) {
    const grupoInfo = GRUPOS_INFO[prot.grupo] || GRUPOS_INFO.fancoil;
    const items = prot.grupo === "fancoil" ? FANCOIL_ITEMS : prot.grupo === "expansion" ? EXPANSION_ITEMS : VENTILACION_ITEMS;

    return (
      <div style={st.menuBg}>
        <div style={{ width: "100%", maxWidth: "640px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "4px 2px 6px" }}>
            <button onClick={() => setVista("menu")} style={st.btnVolverCirculo}><IconFlechaAtras size={18} /></button>
            <div>
              <div style={st.formTitulo}>Registrar mantenimiento</div>
              <div style={st.formSub}>{grupoInfo.emoji} {grupoInfo.label}</div>
            </div>
          </div>

          {protGuardado && (
            <div style={{ background: "#e6f7ec", border: "1px solid #c3ecd2", borderRadius: "12px", padding: "12px 16px", display: "flex", alignItems: "center", gap: "10px" }}>
              <IconCheck color="#1c7a44" />
              <span style={{ fontSize: "13px", fontWeight: 700, color: "#1c7a44" }}>Protocolo guardado correctamente</span>
            </div>
          )}

          {/* Datos del equipo */}
          <div style={st.card}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <div style={st.cardTitulo}>Datos del equipo</div>
              <span style={{ background: "#e5f0ff", color: "#1a4fc0", fontWeight: 700, fontSize: "11px", padding: "3px 10px", borderRadius: "20px" }}>Copiado de info</span>
            </div>
            <div style={st.gridAuto}>
              {[["Cliente", equipo.cliente], ["Sede", equipo.sede], ["Piso", equipo.piso], ["Ambiente", equipo.ambiente], ["Marca", equipo.marca], ["Modelo", equipo.modelo], ["N° Serie", equipo.serie], ["Capacidad", equipo.capacidad], ["Tipo refrigerante", equipo.tipoRefrigerante || "—"], ["Voltaje de placa", equipo.voltaje ? `${equipo.voltaje}V` : "—"], ["Amperaje nominal", equipo.amperaje ? `${equipo.amperaje}A` : "—"], ["Fases", equipo.fases || "—"]].map(([label, val]) => (
                <FieldReadonly key={label} label={label} value={val} />
              ))}
            </div>
          </div>

          {/* Datos del servicio */}
          <div style={st.card}>
            <div style={st.cardTitulo}>Datos del servicio</div>
            <div style={st.gridAuto}>
              <FieldInput label="Fecha" type="date" value={prot.fecha} onChange={v => setP("fecha", v)} />
              <FieldInput label="Técnico" value={prot.tecnico} onChange={v => setP("tecnico", v)} placeholder="Nombre del técnico" />
              <FieldSelect label="Tipo de servicio" value={prot.tipoServicio} onChange={v => setP("tipoServicio", v)} options={["Preventivo", "Correctivo"]} />
              <FieldInput label="N° de orden de trabajo" value={prot.ordenTrabajo} onChange={v => setP("ordenTrabajo", v)} placeholder="OT-0000" />
            </div>
          </div>

          {/* Parámetros eléctricos - Evaporador (o único para fancoil/ventilacion) */}
          <div style={st.card}>
            <div style={st.cardTitulo}>
              {prot.grupo === "expansion" ? "⚡ Parámetros eléctricos — Evaporador" : "⚡ Parámetros eléctricos"}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12.5px", fontWeight: 600, color: "#6b7488", cursor: "pointer" }}>
                <input type="checkbox" checked={prot.monofasico} onChange={e => setP("monofasico", e.target.checked)} style={{ accentColor: "#1a4fc0" }} />
                Equipo monofásico
              </label>
            </div>

            <div style={st.subLabel}>Voltaje en marcha (V)</div>
            <div style={st.gridSm}>
              <FieldInput label="L1-L2" value={prot.vL1L2} onChange={v => setP("vL1L2", v)} placeholder="0.0" />
              {!prot.monofasico && <FieldInput label="L2-L3" value={prot.vL2L3} onChange={v => setP("vL2L3", v)} placeholder="0.0" />}
              {!prot.monofasico && <FieldInput label="L3-L1" value={prot.vL3L1} onChange={v => setP("vL3L1", v)} placeholder="0.0" />}
            </div>
            <div style={st.gridMd}>
              <FieldReadonly label="Voltaje en placa (V)" value={equipo.voltaje ? `${equipo.voltaje}V` : "—"} />
              <FieldCalc label="Desbalance de voltaje" value={calcDesbalance(prot.vL1L2, prot.vL2L3, prot.vL3L1)} />
            </div>

            <div style={st.subLabel}>Amperaje en marcha (A)</div>
            <div style={st.gridSm}>
              <FieldInput label="L1" value={prot.aL1} onChange={v => setP("aL1", v)} placeholder="0.0" />
              <FieldInput label="L2" value={prot.aL2} onChange={v => setP("aL2", v)} placeholder="0.0" />
              {!prot.monofasico && <FieldInput label="L3" value={prot.aL3} onChange={v => setP("aL3", v)} placeholder="0.0" />}
            </div>
            <div style={st.gridMd}>
              <FieldReadonly label="Amperaje en placa (A)" value={equipo.amperaje ? `${equipo.amperaje}A` : "—"} />
              <FieldCalc label="Desbalance de amperaje" value={calcDesbalance(prot.aL1, prot.aL2, prot.aL3)} />
            </div>

            <div style={st.subLabel}>Megado (Ω)</div>
            <div style={st.gridSm}>
              {[["megL1T","L1-T"],["megL2T","L2-T"],["megL3T","L3-T"],["megL1L2","L1-L2"],["megL2L3","L2-L3"],["megL3L1","L3-L1"]].map(([k,l]) => (
                <FieldInput key={k} label={l} value={prot[k]} onChange={v => setP(k, v)} placeholder="0.0" />
              ))}
            </div>
          </div>

          {/* Condensador - solo expansión */}
          {prot.grupo === "expansion" && (
            <div style={st.card}>
              <div style={st.cardTitulo}>⚡ Parámetros eléctricos — Condensador</div>
              <div style={st.subLabel}>Voltaje en marcha (V)</div>
              <div style={st.gridSm}>
                <FieldInput label="L1-L2" value={prot.condVL1L2} onChange={v => setP("condVL1L2", v)} placeholder="0.0" />
                {!prot.monofasico && <FieldInput label="L2-L3" value={prot.condVL2L3} onChange={v => setP("condVL2L3", v)} placeholder="0.0" />}
                {!prot.monofasico && <FieldInput label="L3-L1" value={prot.condVL3L1} onChange={v => setP("condVL3L1", v)} placeholder="0.0" />}
              </div>
              <div style={st.gridMd}>
                <FieldReadonly label="Voltaje en placa (V)" value={equipo.condVoltaje ? `${equipo.condVoltaje}V` : equipo.voltaje ? `${equipo.voltaje}V` : "—"} />
                <FieldCalc label="Desbalance de voltaje" value={calcDesbalance(prot.condVL1L2, prot.condVL2L3, prot.condVL3L1)} />
              </div>
              <div style={st.subLabel}>Amperaje en marcha (A)</div>
              <div style={st.gridSm}>
                <FieldInput label="L1" value={prot.condAL1} onChange={v => setP("condAL1", v)} placeholder="0.0" />
                <FieldInput label="L2" value={prot.condAL2} onChange={v => setP("condAL2", v)} placeholder="0.0" />
                {!prot.monofasico && <FieldInput label="L3" value={prot.condAL3} onChange={v => setP("condAL3", v)} placeholder="0.0" />}
              </div>
              <div style={st.gridMd}>
                <FieldReadonly label="Amperaje en placa (A)" value={equipo.condAmperaje ? `${equipo.condAmperaje}A` : equipo.amperaje ? `${equipo.amperaje}A` : "—"} />
                <FieldCalc label="Desbalance de amperaje" value={calcDesbalance(prot.condAL1, prot.condAL2, prot.condAL3)} />
              </div>
              <div style={st.subLabel}>Megado condensador (Ω)</div>
              <div style={st.gridSm}>
                {[["condMegL1T","L1-T"],["condMegL2T","L2-T"],["condMegL3T","L3-T"],["condMegL1L2","L1-L2"],["condMegL2L3","L2-L3"],["condMegL3L1","L3-L1"]].map(([k,l]) => (
                  <FieldInput key={k} label={l} value={prot[k]} onChange={v => setP(k, v)} placeholder="0.0" />
                ))}
              </div>
            </div>
          )}

          {/* Refrigeración - solo expansión */}
          {prot.grupo === "expansion" && (
            <div style={st.card}>
              <div style={st.cardTitulo}>❄️ Parámetros de refrigeración</div>
              <div style={st.gridMd2}>
                <FieldInput label="Presión succión (PSI)" value={prot.presSuccion} onChange={v => setP("presSuccion", v)} placeholder="0.0" />
                <FieldInput label="Presión líquido (PSI)" value={prot.presLiquido} onChange={v => setP("presLiquido", v)} placeholder="0.0" />
                <FieldInput label="T° sat. succión medida (°C)" value={prot.tSatMedida} onChange={v => setP("tSatMedida", v)} placeholder="0.0" />
                <FieldInput label="T° sat. succión tabla (°C)" value={prot.tSatTabla} onChange={v => setP("tSatTabla", v)} placeholder="0.0" />
                <FieldCalc label="Superheat (auto)" value={calcDelta(prot.tSatMedida, prot.tSatTabla)} />
                <FieldInput label="T° retorno aire evap. (°C)" value={prot.tRetornoEvap} onChange={v => setP("tRetornoEvap", v)} placeholder="0.0" />
                <FieldInput label="T° suministro aire evap. (°C)" value={prot.tSuministroEvap} onChange={v => setP("tSuministroEvap", v)} placeholder="0.0" />
                <FieldInput label="T° amb. condensador (°C)" value={prot.tAmbCondensador} onChange={v => setP("tAmbCondensador", v)} placeholder="0.0" />
                <FieldInput label="T° trabajo motor (°C)" value={prot.tTrabajoMotor} onChange={v => setP("tTrabajoMotor", v)} placeholder="0.0" />
              </div>
            </div>
          )}

          {/* Temperaturas y presiones - solo fancoil */}
          {prot.grupo === "fancoil" && (
            <div style={st.card}>
              <div style={st.cardTitulo}>🌡️ Temperaturas y presiones</div>
              <div style={st.gridMd2}>
                <FieldInput label="T° trabajo motor (°C)" value={prot.tTrabajoMotor} onChange={v => setP("tTrabajoMotor", v)} placeholder="0.0" />
                <FieldInput label="T° entrada de agua (°C)" value={prot.tEntradaAgua} onChange={v => setP("tEntradaAgua", v)} placeholder="0.0" />
                <FieldInput label="T° salida de agua (°C)" value={prot.tSalidaAgua} onChange={v => setP("tSalidaAgua", v)} placeholder="0.0" />
                <FieldCalc label="∆ Temperatura de agua" value={calcDelta(prot.tEntradaAgua, prot.tSalidaAgua)} />
                <FieldInput label="Presión de entrada (PSI)" value={prot.presEntradaAgua} onChange={v => setP("presEntradaAgua", v)} placeholder="0.0" />
                <FieldInput label="Presión de salida (PSI)" value={prot.presSalidaAgua} onChange={v => setP("presSalidaAgua", v)} placeholder="0.0" />
                <FieldCalc label="∆ Presión de agua" value={calcDelta(prot.presEntradaAgua, prot.presSalidaAgua)} />
                <FieldInput label="T° retorno de aire (°C)" value={prot.tRetornoAire} onChange={v => setP("tRetornoAire", v)} placeholder="0.0" />
                <FieldInput label="T° suministro de aire (°C)" value={prot.tSuministroAire} onChange={v => setP("tSuministroAire", v)} placeholder="0.0" />
                <FieldCalc label="∆ Temperatura de aire" value={calcDelta(prot.tRetornoAire, prot.tSuministroAire)} />
              </div>
            </div>
          )}

          {/* Parámetros ventilación */}
          {prot.grupo === "ventilacion" && (
            <div style={st.card}>
              <div style={st.cardTitulo}>🌀 Parámetros de operación</div>
              <div style={st.gridMd}>
                <FieldInput label="T° trabajo motor (°C)" value={prot.tTrabajoMotor} onChange={v => setP("tTrabajoMotor", v)} placeholder="0.0" />
                <FieldInput label="Caudal de aire (CFM)" value={prot.caudalAire} onChange={v => setP("caudalAire", v)} placeholder="0.0" />
              </div>
            </div>
          )}

          {/* Estado de componentes */}
          <div style={st.card}>
            <div style={{ ...st.cardTitulo, marginBottom: "8px" }}>Estado de componentes</div>
            {items.map(item => (
              <EstatusRow key={item} item={item} value={(prot.estatusItems || {})[item] || ""}
                onChange={v => setEstatus(item, v)} />
            ))}
          </div>

          {/* Observación · Causa · Recomendación */}
          <div style={st.card}>
            <div style={st.cardTitulo}>Observación · Causa · Recomendación</div>
            {prot.observaciones.map((o, i) => (
              <div key={i} style={st.filaCard}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ background: "#e5f0ff", color: "#1a4fc0", fontWeight: 800, fontSize: "12px", width: "22px", height: "22px", borderRadius: "7px", display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
                  {prot.observaciones.length > 1 && <button onClick={() => removeObs(i)} style={st.btnRemoveFila}>×</button>}
                </div>
                <div>
                  <div style={{ ...sf.fieldLabel, color: "#8a5b0a" }}>Observación</div>
                  <textarea rows={2} placeholder="Descripción de lo observado" value={o.observacion}
                    onChange={e => updateObs(i, "observacion", e.target.value)}
                    style={{ ...st.textarea, border: "1px solid #f3dfa3", color: "#8a5b0a", background: "#fff8e6" }} />
                </div>
                <div>
                  <div style={{ ...sf.fieldLabel, color: "#a52b2b" }}>Causa</div>
                  <textarea rows={2} placeholder="Causa probable" value={o.causa}
                    onChange={e => updateObs(i, "causa", e.target.value)}
                    style={{ ...st.textarea, border: "1px solid #f6d3d3", color: "#a52b2b", background: "#fdeeee" }} />
                </div>
                <div>
                  <div style={{ ...sf.fieldLabel, color: "#1c7a44" }}>Recomendación</div>
                  <textarea rows={2} placeholder="Recomendación para el cliente" value={o.recomendacion}
                    onChange={e => updateObs(i, "recomendacion", e.target.value)}
                    style={{ ...st.textarea, border: "1px solid #c3ecd2", color: "#1c7a44", background: "#e6f7ec" }} />
                </div>
              </div>
            ))}
            <button onClick={addObs} style={st.btnAddFila}>+ Agregar observación</button>
          </div>

          {/* Resultado del servicio */}
          <div style={st.card}>
            <div style={st.cardTitulo}>Resultado del servicio</div>
            <div style={st.gridMd}>
              <div>
                <div style={sf.fieldLabel}>Estado final del equipo</div>
                <select value={prot.estadoFinal} onChange={e => setP("estadoFinal", e.target.value)} style={sf.input}>
                  <option value="Operativo">Operativo</option>
                  <option value="Operativo con observaciones">Operativo con observaciones</option>
                  <option value="Fuera de servicio">Fuera de servicio</option>
                </select>
              </div>
              <FieldReadonly label="Técnico responsable" value={prot.tecnico || "—"} />
            </div>
          </div>

          {errorProt && <div style={{ color: "#c23b3b", fontSize: "13px", textAlign: "center" }}>{errorProt}</div>}

          <div style={{ display: "flex", gap: "12px" }}>
            <button onClick={guardarProtocolo} disabled={guardandoProt}
              style={{ ...st.btnGuardar, flex: 1, background: "#1c9a53", boxShadow: "0 8px 20px rgba(28,154,83,0.28)", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
              <IconGuardar />{guardandoProt ? "Guardando..." : "Guardar protocolo"}
            </button>
            <button onClick={() => prot && generarPDF(equipo, prot)}
              style={{ ...st.btnGuardar, flex: 1, background: "#c23b3b", boxShadow: "0 8px 20px rgba(194,59,59,0.28)", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
              <IconPDF />Descargar PDF
            </button>
          </div>
          <button onClick={() => setVista("menu")} style={st.btnCancelar}>Cancelar</button>
        </div>
      </div>
    );
  }

  // ============ REPORTAR AVERÍA ============
  if (vista === "averia") return (
    <div style={st.menuBg}><div style={st.pwCol}><div style={st.modalCard}>
      <div style={{ fontWeight: 800, fontSize: "clamp(16px,4.5vw,18px)", color: "#0f1b3d", marginBottom: "6px", textAlign: "left" }}>Reportar avería</div>
      <div style={{ color: "#6b7488", fontSize: "13px", marginBottom: "14px", textAlign: "left" }}>Describe el problema que presenta el equipo</div>
      <textarea value={mensajeAveria} onChange={e => setMensajeAveria(e.target.value)}
        placeholder="El equipo hace un ruido extraño y no enfría bien..."
        style={{ ...st.textarea, minHeight: "100px" }} />
      {errorAveria && <div style={{ color: "#c23b3b", fontSize: "12px", marginBottom: "10px" }}>{errorAveria}</div>}
      <button onClick={enviarAveria} disabled={enviandoAveria} style={st.btnGuardar}>{enviandoAveria ? "Enviando..." : "Enviar reporte"}</button>
      <button style={{ ...st.pwBtnVolver, color: "#1a4fc0", display: "block", margin: "8px auto 0" }} onClick={() => setVista("menu")}>← Volver</button>
    </div></div></div>
  );

  // ============ CARGA DE REFRIGERANTE ============
  if (vista === "carga") return (
    <div style={st.menuBg}><div style={st.pwCol}><div style={st.modalCard}>
      <div style={{ fontWeight: 800, fontSize: "18px", color: "#0f1b3d", marginBottom: "4px", textAlign: "left" }}>Registrar carga de refrigerante</div>
      <div style={{ color: "#6b7488", fontSize: "12px", marginBottom: "16px", textAlign: "left" }}>{equipo.codigo ? `${equipo.codigo} · ` : ""}{equipo.ambiente || "-"}</div>
      <form onSubmit={guardarCarga} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div>
          <div style={sf.fieldLabel}>Movimiento</div>
          <div style={{ display: "flex", gap: "8px" }}>
            {["carga","recuperacion"].map(t => (
              <div key={t} onClick={() => setFormCarga({ ...formCarga, tipo: t })}
                style={{ flex: 1, textAlign: "center", padding: "10px", borderRadius: "10px", cursor: "pointer", fontSize: "12.5px", fontWeight: 700, fontFamily: FONT, background: formCarga.tipo === t ? "#1a4fc0" : "#f4f6fb", color: formCarga.tipo === t ? "white" : "#8a92a6" }}>
                {t === "carga" ? "Carga" : "Recuperación"}
              </div>
            ))}
          </div>
        </div>
        <div><div style={sf.fieldLabel}>Kg de refrigerante</div><input style={sf.input} type="number" step="0.1" placeholder="0.5" value={formCarga.kg} onChange={e => setFormCarga({ ...formCarga, kg: e.target.value })} required /></div>
        <div><div style={sf.fieldLabel}>Tu nombre</div><input style={sf.input} placeholder="Nombre del técnico" value={formCarga.tecnico} onChange={e => setFormCarga({ ...formCarga, tecnico: e.target.value })} /></div>
        {errorCarga && <div style={{ color: "#c23b3b", fontSize: "12px" }}>{errorCarga}</div>}
        <button type="submit" disabled={guardandoCarga} style={st.btnGuardar}>{guardandoCarga ? "Guardando..." : "Guardar carga"}</button>
        <button type="button" style={{ ...st.pwBtnVolver, color: "#1a4fc0", display: "block", margin: "0 auto" }} onClick={() => setVista("menu")}>← Volver</button>
      </form>
    </div></div></div>
  );

  // ============ CARGA GUARDADA ============
  if (vista === "carga_guardada") return (
    <div style={st.menuBg}><div style={st.pwCol}><div style={st.modalCard}>
      <div style={{ width: "52px", height: "52px", borderRadius: "50%", background: "#e6f7ec", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}><IconCheck color="#1c9a53" /></div>
      <div style={st.modalTitulo}>Carga registrada</div>
      <div style={st.modalTexto}>Queda visible en el historial de refrigerante del equipo.</div>
      <button style={{ ...st.btnGuardar, marginTop: "18px" }} onClick={() => setVista("menu")}>Volver al menú</button>
    </div></div></div>
  );

  // ============ REEMPLAZAR EQUIPO ============
  if (vista === "reemplazo") return (
    <div style={st.menuBg}><div style={st.pwCol}><div style={st.modalCard}>
      <div style={{ fontWeight: 800, fontSize: "18px", color: "#0f1b3d", marginBottom: "4px", textAlign: "left" }}>Reemplazar equipo</div>
      <div style={{ color: "#6b7488", fontSize: "12px", marginBottom: "10px", textAlign: "left" }}>{equipo.codigo ? `${equipo.codigo} · ` : ""}{equipo.ambiente || "-"}</div>
      <div style={{ background: "#fdeeee", border: "1px solid #f6d3d3", borderRadius: "10px", padding: "9px 11px", marginBottom: "14px" }}>
        <span style={{ fontSize: "11px", color: "#a52b2b", fontWeight: 600 }}>El equipo actual queda como historial. Esta acción no se puede deshacer desde el teléfono.</span>
      </div>
      <form onSubmit={guardarReemplazo} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div style={{ fontSize: "10px", fontWeight: 700, color: "#8a92a6", textTransform: "uppercase", letterSpacing: "0.05em" }}>Datos generales</div>
        <div><div style={sf.fieldLabel}>Marca (equipo nuevo)</div><input style={sf.input} value={formReemplazo.marca} onChange={e => setFormReemplazo({ ...formReemplazo, marca: e.target.value })} required /></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
          <div><div style={sf.fieldLabel}>Modelo</div><input style={sf.input} value={formReemplazo.modelo} onChange={e => setFormReemplazo({ ...formReemplazo, modelo: e.target.value })} /></div>
          <div><div style={sf.fieldLabel}>N° serie</div><input style={sf.input} value={formReemplazo.serie} onChange={e => setFormReemplazo({ ...formReemplazo, serie: e.target.value })} /></div>
        </div>
        <div><div style={sf.fieldLabel}>Capacidad (BTU)</div><input style={sf.input} value={formReemplazo.capacidad} onChange={e => setFormReemplazo({ ...formReemplazo, capacidad: e.target.value })} /></div>
        <div style={{ fontSize: "10px", fontWeight: 700, color: "#1a4fc0", textTransform: "uppercase", letterSpacing: "0.05em" }}>Eléctrico y refrigerante</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
          <div><div style={sf.fieldLabel}>Refrigerante</div><select style={sf.input} value={formReemplazo.tipoRefrigerante} onChange={e => setFormReemplazo({ ...formReemplazo, tipoRefrigerante: e.target.value })}><option value="">Seleccionar...</option>{["R-22","R-410A","R-32","R-407C","R-134A","Otro"].map(r => <option key={r}>{r}</option>)}</select></div>
          <div><div style={sf.fieldLabel}>Fases</div><select style={sf.input} value={formReemplazo.fases} onChange={e => setFormReemplazo({ ...formReemplazo, fases: e.target.value })}><option>Monofásico</option><option>Trifásico</option></select></div>
          <div><div style={sf.fieldLabel}>Voltaje placa (V)</div><input style={sf.input} value={formReemplazo.voltaje} onChange={e => setFormReemplazo({ ...formReemplazo, voltaje: e.target.value })} /></div>
          <div><div style={sf.fieldLabel}>Amperaje placa (A)</div><input style={sf.input} value={formReemplazo.amperaje} onChange={e => setFormReemplazo({ ...formReemplazo, amperaje: e.target.value })} /></div>
          <div><div style={sf.fieldLabel}>Carga nominal (kg)</div><input style={sf.input} type="number" step="0.1" value={formReemplazo.cargaNominal} onChange={e => setFormReemplazo({ ...formReemplazo, cargaNominal: e.target.value })} /></div>
          <div><div style={sf.fieldLabel}>Carga adic. inst. (kg)</div><input style={sf.input} type="number" step="0.1" placeholder="0.0" value={formReemplazo.cargaAdicionalInstalacion} onChange={e => setFormReemplazo({ ...formReemplazo, cargaAdicionalInstalacion: e.target.value })} /></div>
        </div>
        <div style={{ fontSize: "10px", fontWeight: 700, color: "#a52b2b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Baja del equipo anterior</div>
        <div><div style={sf.fieldLabel}>Kg de gas recuperados</div><input style={sf.input} type="number" step="0.1" placeholder="0.0" value={formReemplazo.kgRecuperados} onChange={e => setFormReemplazo({ ...formReemplazo, kgRecuperados: e.target.value })} /></div>
        <div><div style={sf.fieldLabel}>Tu nombre</div><input style={sf.input} placeholder="Nombre del técnico" value={formReemplazo.tecnico} onChange={e => setFormReemplazo({ ...formReemplazo, tecnico: e.target.value })} /></div>
        {errorReemplazo && <div style={{ color: "#c23b3b", fontSize: "12px" }}>{errorReemplazo}</div>}
        <button type="submit" disabled={guardandoReemplazo} style={{ ...st.btnGuardar, background: "#7c3fd8" }}>{guardandoReemplazo ? "Guardando..." : "Confirmar reemplazo"}</button>
        <button type="button" style={{ ...st.pwBtnVolver, color: "#1a4fc0", display: "block", margin: "0 auto" }} onClick={() => setVista("menu")}>← Volver</button>
      </form>
    </div></div></div>
  );

  // ============ REEMPLAZO GUARDADO ============
  if (vista === "reemplazo_guardado") return (
    <div style={st.menuBg}><div style={st.pwCol}><div style={st.modalCard}>
      <div style={{ width: "52px", height: "52px", borderRadius: "50%", background: "#f1e9fb", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}><IconReemplazo color="#7c3fd8" /></div>
      <div style={st.modalTitulo}>Equipo reemplazado</div>
      <div style={st.modalTexto}>El equipo anterior quedó guardado como historial.</div>
      <button style={{ ...st.btnGuardar, marginTop: "18px" }} onClick={() => setVista("menu")}>Volver al menú</button>
    </div></div></div>
  );

  // ============ ENVIADO ============
  return (
    <div style={st.menuBg}><div style={st.pwCol}><div style={st.modalCard}>
      <div style={{ width: "52px", height: "52px", borderRadius: "50%", background: "#e6f7ec", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}><IconCheck color="#1c9a53" /></div>
      <div style={st.modalTitulo}>Reporte enviado</div>
      <div style={st.modalTexto}>El equipo de mantenimiento fue notificado.</div>
    </div></div></div>
  );
}

// ---- Estilos campos ----
const sf = {
  fieldLabel: { fontWeight: 600, fontSize: "11.5px", color: "#8a92a6", marginBottom: "5px" },
  readonlyBox: { width: "100%", boxSizing: "border-box", border: "1px solid #e7ebf3", borderRadius: "11px", padding: "11px 12px", fontSize: "13.5px", fontWeight: 700, color: "#12245e", background: "#eef1f6" },
  calcBox: { width: "100%", boxSizing: "border-box", border: "1px solid #e7ebf3", borderRadius: "11px", padding: "11px 12px", fontSize: "13.5px", fontWeight: 700, color: "#1a4fc0", background: "#eef1f6" },
  input: { width: "100%", boxSizing: "border-box", border: "1px solid #dfe6f5", borderRadius: "11px", padding: "10px 11px", fontFamily: FONT, fontSize: "14px", color: "#0f1b3d", background: "#f9fafc" },
};

const st = {
  homeBg: { position: "relative", width: "100%", minHeight: "100vh", background: "#3d4feb", fontFamily: FONT, display: "flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box", padding: "clamp(16px,5vw,32px)", overflow: "hidden" },
  homeCol: { position: "relative", zIndex: 1, width: "100%", maxWidth: "420px", minHeight: "min(88vh,780px)", display: "flex", flexDirection: "column", boxSizing: "border-box" },
  homeLogoWrap: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 0" },
  homeLogoBox: { width: "clamp(126px,33vw,168px)", height: "clamp(126px,33vw,168px)", display: "flex", alignItems: "center", justifyContent: "center" },
  homeLogoImg: { width: "100%", height: "100%", objectFit: "contain", filter: "drop-shadow(0.5px 0 0 #123a8f) drop-shadow(-0.5px 0 0 #123a8f) drop-shadow(0 0.5px 0 #123a8f) drop-shadow(0 -0.5px 0 #123a8f) drop-shadow(0 6px 14px rgba(0,20,80,0.25))" },
  homeBtnsWrap: { display: "flex", flexDirection: "column", alignItems: "center", gap: "clamp(10px,2.2vh,14px)", padding: "0 4px clamp(120px,22vh,170px)" },
  btnCliente: { width: "100%", boxSizing: "border-box", background: "#fff", color: "#1a4fc0", border: "none", borderRadius: "14px", padding: "clamp(14px,3.6vh,17px) 20px", fontFamily: FONT, fontWeight: 700, fontSize: "clamp(15px,4vw,17px)", cursor: "pointer", boxShadow: "0 8px 20px rgba(0,20,80,0.18)", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" },
  btnTecnico: { width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.14)", color: "#fff", border: "1.5px solid rgba(255,255,255,0.55)", borderRadius: "14px", padding: "clamp(14px,3.6vh,17px) 20px", fontFamily: FONT, fontWeight: 700, fontSize: "clamp(15px,4vw,17px)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" },
  pwCol: { position: "relative", zIndex: 1, width: "100%", maxWidth: "380px", display: "flex", flexDirection: "column", alignItems: "center", gap: "clamp(18px,4vh,26px)" },
  pwBadge: { width: "clamp(68px,18vw,88px)", height: "clamp(68px,18vw,88px)", borderRadius: "26%", background: "rgba(255,255,255,0.12)", border: "1.5px solid rgba(255,255,255,0.28)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 10px 30px rgba(0,20,80,0.25)" },
  pwTitulo: { color: "#fff", fontWeight: 800, fontSize: "clamp(18px,5vw,22px)" },
  pwSub: { color: "rgba(255,255,255,0.7)", fontWeight: 500, fontSize: "clamp(12px,3.2vw,14px)", marginTop: "6px" },
  pwInput: { width: "100%", boxSizing: "border-box", textAlign: "center", letterSpacing: "0.6em", fontSize: "clamp(22px,7vw,28px)", fontWeight: 700, color: "#fff", background: "rgba(255,255,255,0.12)", border: "1.5px solid rgba(255,255,255,0.4)", borderRadius: "14px", padding: "clamp(12px,3vh,16px) 12px", fontFamily: FONT },
  pwError: { color: "#ffd7d7", fontWeight: 600, fontSize: "13px", marginTop: "-10px" },
  pwBtnIngresar: { width: "100%", boxSizing: "border-box", background: "#fff", color: "#1a4fc0", border: "none", borderRadius: "14px", padding: "clamp(13px,3.4vh,16px) 20px", fontFamily: FONT, fontWeight: 700, fontSize: "clamp(15px,4vw,16px)", cursor: "pointer", boxShadow: "0 8px 20px rgba(0,20,80,0.18)" },
  pwBtnVolver: { background: "none", border: "none", color: "rgba(255,255,255,0.75)", fontFamily: FONT, fontWeight: 600, fontSize: "clamp(12px,3.2vw,13px)", cursor: "pointer", padding: "6px" },
  menuBg: { width: "100%", minHeight: "100vh", background: "#f4f6fb", fontFamily: FONT, display: "flex", alignItems: "flex-start", justifyContent: "center", boxSizing: "border-box", padding: "clamp(20px,6vw,40px) clamp(16px,5vw,24px)" },
  menuCol: { width: "100%", maxWidth: "480px", display: "flex", flexDirection: "column", alignItems: "center", gap: "clamp(16px,3vh,20px)" },
  menuLogoWrap: { display: "flex", alignItems: "center", justifyContent: "center", marginTop: "8px" },
  menuLogoImg: { width: "clamp(100px,26vw,132px)", height: "clamp(100px,26vw,132px)", objectFit: "contain" },
  menuChipRow: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", justifyContent: "center" },
  rolChip: { background: "#e7e4fb", color: "#5b4fd8", fontWeight: 700, fontSize: "12px", padding: "4px 10px", borderRadius: "7px" },
  dotMuted: { color: "#8a92a6", fontSize: "12px" },
  sesionTxt: { color: "#26314d", fontWeight: 600, fontSize: "13px" },
  menuLista: { width: "100%", display: "flex", flexDirection: "column", gap: "12px", marginTop: "8px" },
  menuItem: { width: "100%", boxSizing: "border-box", borderRadius: "16px", padding: "clamp(14px,3.4vh,18px) clamp(14px,3.4vw,18px)", display: "flex", alignItems: "center", gap: "14px", cursor: "pointer", textAlign: "left", fontFamily: FONT },
  menuIconTile: { width: "42px", height: "42px", minWidth: "42px", borderRadius: "11px", display: "flex", alignItems: "center", justifyContent: "center" },
  menuItemTitulo: { fontWeight: 700, fontSize: "clamp(14px,3.8vw,16px)" },
  menuItemSub: { fontWeight: 500, fontSize: "clamp(12px,3.2vw,13px)", color: "#6b7488", marginTop: "2px" },
  btnSalir: { background: "none", border: "none", color: "#1a4fc0", fontFamily: FONT, fontWeight: 700, fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", padding: "4px" },
  footerTxt: { color: "#8a92a6", fontWeight: 600, fontSize: "12px", marginTop: "16px" },
  btnVolverCirculo: { background: "#fff", border: "1px solid #dfe6f5", borderRadius: "10px", width: "38px", height: "38px", minWidth: "38px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
  formTitulo: { fontWeight: 800, fontSize: "clamp(17px,4.6vw,20px)", color: "#12245e", fontFamily: FONT },
  formSub: { fontWeight: 600, fontSize: "clamp(11px,3vw,12.5px)", color: "#8a92a6", fontFamily: FONT },
  card: { background: "#fff", border: "1px solid #e7ebf3", borderRadius: "18px", padding: "clamp(16px,4vw,22px)", display: "flex", flexDirection: "column", gap: "14px", fontFamily: FONT },
  cardTitulo: { fontWeight: 800, fontSize: "clamp(13px,3.4vw,14.5px)", color: "#1a4fc0", letterSpacing: "0.02em" },
  subLabel: { fontWeight: 700, fontSize: "12.5px", color: "#26314d", marginBottom: "4px", marginTop: "4px" },
  gridAuto: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: "12px" },
  gridSm: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(90px,1fr))", gap: "10px" },
  gridMd: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: "12px" },
  gridMd2: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: "12px" },
  filaCard: { border: "1px solid #eef1f6", borderRadius: "14px", padding: "14px", display: "flex", flexDirection: "column", gap: "10px", position: "relative", background: "#fafbfd" },
  btnRemoveFila: { background: "#fdeeee", border: "none", color: "#c23b3b", width: "26px", height: "26px", borderRadius: "8px", fontWeight: 800, cursor: "pointer", fontSize: "14px", lineHeight: 1 },
  textarea: { width: "100%", boxSizing: "border-box", borderRadius: "11px", padding: "10px 11px", fontFamily: FONT, fontSize: "13.5px", fontWeight: 600, background: "#fff", resize: "vertical" },
  btnAddFila: { background: "#e5f0ff", color: "#1a4fc0", border: "1px dashed #a9c8fb", borderRadius: "12px", padding: "12px", fontFamily: FONT, fontWeight: 700, fontSize: "13.5px", cursor: "pointer" },
  btnGuardar: { width: "100%", boxSizing: "border-box", background: "#1a4fc0", color: "#fff", border: "none", borderRadius: "14px", padding: "16px 20px", fontFamily: FONT, fontWeight: 700, fontSize: "clamp(15px,4vw,16px)", cursor: "pointer", boxShadow: "0 8px 20px rgba(26,79,192,0.28)" },
  btnCancelar: { background: "none", border: "none", color: "#6b7488", fontFamily: FONT, fontWeight: 600, fontSize: "13px", cursor: "pointer", padding: "6px", textAlign: "center" },
  modalCard: { width: "100%", background: "#fff", borderRadius: "20px", padding: "clamp(24px,6vw,32px)", boxShadow: "0 20px 50px rgba(0,10,40,0.35)", boxSizing: "border-box", textAlign: "center", fontFamily: FONT, maxHeight: "88vh", overflowY: "auto" },
  modalTitulo: { fontWeight: 800, fontSize: "clamp(16px,4.5vw,18px)", color: "#0f1b3d" },
  modalTexto: { color: "#5b6478", fontSize: "clamp(13px,3.6vw,14px)", marginTop: "8px", lineHeight: 1.5 },
};
