import { useState, useEffect } from "react";
import { db } from "../firebase";
import { doc, updateDoc, collection, addDoc, serverTimestamp, runTransaction } from "firebase/firestore";

// Fuente Manrope (usada en el diseño de Claude Design) — se inyecta una sola vez.
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

// Tipos de equipo que usan el formato de protocolo "Fan Coil / UMA" (mismo criterio que Protocolo.jsx)
const TIPOS_FANCOIL = ["Fancoil AH", "Pared AH", "UMA AH", "Fan Coil"];

// Tipos de equipo que manejan gas refrigerante (Split/VRV/Chiller) — mismo criterio que VistaSede.jsx.
// Fan Coil/UMA NO se incluyen: trabajan con agua helada, no con refrigerante.
const TIPOS_CON_GAS = [
  "Split Piso Techo", "Split Pared", "Split Ducto", "Split Fancoil", "Split Cassete",
  "Ventana", "Autocontenido", "Precisión", "VRV Evaporador", "VRV Condensador", "Chiller",
];

// Checklist de estatus — mismos 20 ítems y mismo texto exacto que usa Protocolo.jsx,
// para que el PDF y el historial ya existentes sigan funcionando con lo que se guarde aquí.
const FANCOIL_ITEMS = [
  "Balance de caudal de aire", "Estado válvula agua helada", "Aislamiento térmico",
  "Estado de llave termomagnética", "Estado de contactores", "Funcionamiento de dampers",
  "Velocidad motores ventiladores", "Sensor de suministros de aire", "Sensor de diferencial de presión",
  "Sensor de arranque y parada", "Sensor de temperatura ambiente", "Limpieza de contactos",
  "Lubricación de motores", "Lubricación de chumaceras", "Templado de fajas",
  "Alineamiento de poleas", "Estado de impulsor de aire", "Limpieza de filtros de aire",
  "Limpieza bandeja de condesado", "Lavado de coil",
];

const defaultStatus = () => {
  const s = {};
  FANCOIL_ITEMS.forEach(item => { s[item] = "OK"; });
  return s;
};

const defaultMant = (equipo) => ({
  fecha: new Date().toISOString().split("T")[0],
  tecnico: "",
  tipoServicio: "Preventivo",
  ordenTrabajo: "",
  monofasico: equipo?.fases === "Monofásico",
  voltajeMarcha: { l1l2: "", l2l3: "", l3l1: "" },
  amperajeMarcha: { l1: "", l2: "", l3: "" },
  megado: { l1t: "", l2t: "", l3t: "", l1l2: "", l2l3: "", l3l1: "" },
  tempTrabajoMotor: "", tempEntradaAgua: "", tempSalidaAgua: "",
  presionEntrada: "", presionSalida: "",
  tempRetornoAire: "", tempSuministroAire: "",
  status: defaultStatus(),
  filas: [{ obs: "", causa: "", rec: "" }],
  estadoFinal: "Operativo",
});

const calcDesbalance = (vals) => {
  const nums = vals.filter(v => v !== "" && v !== null && !isNaN(v)).map(Number);
  if (nums.length < 2) return "";
  const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
  if (!avg) return "";
  const maxDev = Math.max(...nums.map(v => Math.abs(v - avg)));
  return ((maxDev / avg) * 100).toFixed(1) + "%";
};
const calcDelta = (a, b) => {
  if (a === "" || b === "" || a == null || b == null || isNaN(a) || isNaN(b)) return "";
  return (Number(a) - Number(b)).toFixed(1);
};

// ---- Iconos inline (SVG), tal como en el handoff de Claude Design ----
const IconPersona = ({ color = "#1a4fc0" }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="8" r="3.5" stroke={color} strokeWidth="1.6" />
    <path d="M5 20c1.2-4 4-6 7-6s5.8 2 7 6" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);
const IconLlave = ({ color = "#ffffff" }) => (
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

// Flujo público al escanear el QR de un equipo: elegir Cliente o Técnico,
// validar contraseña de 4 dígitos, y llegar al menú de acciones por rol.
export default function AccesoEquipo({ equipo, onVerInforme }) {
  useManropeFont();

  const [vista, setVista] = useState("home"); // home | password | menu | mantenimiento | mant_guardado | averia | enviado
  const [rol, setRol] = useState(null); // "cliente" | "tecnico"
  const [codigo, setCodigo] = useState("");
  const [hasError, setHasError] = useState(false);
  const [mensajeAveria, setMensajeAveria] = useState("");
  const [enviandoAveria, setEnviandoAveria] = useState(false);
  const [errorAveria, setErrorAveria] = useState("");
  const [mant, setMant] = useState(() => defaultMant(equipo));
  const [guardandoMant, setGuardandoMant] = useState(false);
  const [errorMant, setErrorMant] = useState("");

  const [formCarga, setFormCarga] = useState({ tipo: "carga", kg: "", tecnico: "" });
  const [guardandoCarga, setGuardandoCarga] = useState(false);
  const [errorCarga, setErrorCarga] = useState("");

  const [formReemplazo, setFormReemplazo] = useState({
    marca: "", modelo: "", serie: "", capacidad: "",
    tipoRefrigerante: "", fases: "Monofásico", voltaje: "", amperaje: "",
    cargaNominal: "", cargaAdicionalInstalacion: "", kgRecuperados: "", tecnico: "",
  });
  const [guardandoReemplazo, setGuardandoReemplazo] = useState(false);
  const [errorReemplazo, setErrorReemplazo] = useState("");

  const esFancoil = TIPOS_FANCOIL.includes(equipo?.tipoEquipo);
  const esConGas = TIPOS_CON_GAS.includes(equipo?.tipoEquipo);

  // Contraseñas de acceso: Cliente = 0001, Técnico = 1001.
  const CODIGOS = { cliente: "0001", tecnico: "1001" };
  const LABELS = { cliente: "Cliente", tecnico: "Técnico" };

  const elegirRol = (r) => {
    setRol(r);
    setCodigo("");
    setHasError(false);
    setVista("password");
  };

  const onCodeChange = (e) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 4);
    setCodigo(digits);
    setHasError(false);
  };

  const enviarCodigo = () => {
    if (codigo === CODIGOS[rol]) {
      setHasError(false);
      setVista("menu");
    } else {
      setHasError(true);
      setCodigo("");
    }
  };

  const volverAHome = () => {
    setVista("home");
    setRol(null);
    setCodigo("");
    setHasError(false);
  };

  const guardarCarga = async (e) => {
    e.preventDefault();
    if (!formCarga.kg) return;
    setGuardandoCarga(true);
    setErrorCarga("");
    try {
      await addDoc(collection(db, "movimientosRefrigerante"), {
        equipoId: equipo.id,
        equipoAmbiente: equipo.ambiente || "",
        equipoCodigo: equipo.codigo || "",
        cliente: equipo.cliente || "",
        sede: equipo.sede || "",
        tipo: formCarga.tipo,
        kg: Number(formCarga.kg),
        fecha: new Date().toISOString().split("T")[0],
        tecnico: formCarga.tecnico,
        fechaRegistro: serverTimestamp(),
      });
      setVista("carga_guardada");
    } catch (err) {
      setErrorCarga("No se pudo guardar. Intenta de nuevo.");
    }
    setGuardandoCarga(false);
  };

  const guardarReemplazo = async (e) => {
    e.preventDefault();
    if (!formReemplazo.marca) return;
    setGuardandoReemplazo(true);
    setErrorReemplazo("");
    const equipoViejoId = equipo.id;
    try {
      const nuevoRef = doc(collection(db, "equipos"));
      const movRecuperacionRef = (formReemplazo.kgRecuperados && Number(formReemplazo.kgRecuperados) > 0)
        ? doc(collection(db, "movimientosRefrigerante"))
        : null;
      const movCargaInicialRef = (formReemplazo.cargaAdicionalInstalacion && Number(formReemplazo.cargaAdicionalInstalacion) > 0)
        ? doc(collection(db, "movimientosRefrigerante"))
        : null;

      await runTransaction(db, async (tx) => {
        const viejoRef = doc(db, "equipos", equipoViejoId);
        const viejoSnap = await tx.get(viejoRef);
        if (!viejoSnap.exists()) throw new Error("El equipo original ya no existe.");
        const viejo = viejoSnap.data();
        const hoy = new Date().toISOString().split("T")[0];

        tx.set(nuevoRef, {
          cliente: viejo.cliente || "", sede: viejo.sede || "", adminid: viejo.adminid || "",
          codigo: viejo.codigo || "", piso: viejo.piso || "", ambiente: viejo.ambiente || "",
          tipoEquipo: viejo.tipoEquipo || "",
          marca: formReemplazo.marca, modelo: formReemplazo.modelo, serie: formReemplazo.serie,
          capacidad: formReemplazo.capacidad,
          tipoRefrigerante: formReemplazo.tipoRefrigerante,
          fases: formReemplazo.fases,
          voltaje: formReemplazo.voltaje,
          amperaje: formReemplazo.amperaje,
          cargaNominal: formReemplazo.cargaNominal,
          estado: "Operativo",
          cicloVida: "activo",
          equipoAnteriorId: equipoViejoId,
          equipoReemplazoId: null,
          historialCount: (viejo.historialCount || 0) + 1,
          fechaInstalacion: hoy,
          fechaBaja: null,
          fechaRegistro: hoy,
        });

        tx.update(viejoRef, {
          cicloVida: "reemplazado",
          fechaBaja: hoy,
          equipoReemplazoId: nuevoRef.id,
        });

        if (movRecuperacionRef) {
          tx.set(movRecuperacionRef, {
            equipoId: equipoViejoId,
            equipoAmbiente: viejo.ambiente || "",
            equipoCodigo: viejo.codigo || "",
            cliente: viejo.cliente || "", sede: viejo.sede || "",
            tipo: "recuperacion_baja",
            kg: Number(formReemplazo.kgRecuperados),
            fecha: hoy,
            tecnico: formReemplazo.tecnico,
            fechaRegistro: serverTimestamp(),
          });
        }

        if (movCargaInicialRef) {
          tx.set(movCargaInicialRef, {
            equipoId: nuevoRef.id,
            equipoAmbiente: viejo.ambiente || "",
            equipoCodigo: viejo.codigo || "",
            cliente: viejo.cliente || "", sede: viejo.sede || "",
            tipo: "carga",
            kg: Number(formReemplazo.cargaAdicionalInstalacion),
            fecha: hoy,
            tecnico: formReemplazo.tecnico,
            fechaRegistro: serverTimestamp(),
          });
        }
      });

      setVista("reemplazo_guardado");
    } catch (err) {
      setErrorReemplazo("No se pudo completar el reemplazo: " + err.message);
    }
    setGuardandoReemplazo(false);
  };

  const enviarAveria = async () => {
    if (!mensajeAveria.trim()) return;
    setEnviandoAveria(true);
    try {
      await addDoc(collection(db, "averias"), {
        equipoId: equipo.id,
        equipoCodigo: equipo.codigo || "",
        cliente: equipo.cliente || "",
        sede: equipo.sede || "",
        ambiente: equipo.ambiente || "",
        piso: equipo.piso || "",
        tipoReportante: rol === "tecnico" ? "Técnico" : "Cliente",
        nombreReportante: rol === "tecnico" ? "Técnico" : (equipo.cliente || "Cliente"),
        mensaje: mensajeAveria.trim(),
        fecha: serverTimestamp(),
        atendida: false,
      });
      setVista("enviado");
    } catch (e) {
      setErrorAveria("No se pudo enviar el reporte. Intenta de nuevo.");
    }
    setEnviandoAveria(false);
  };

  // ---- Registrar mantenimiento ----
  const abrirMantenimiento = () => {
    if (!esFancoil) {
      // Otros formatos (Expansión, Ventilación) usan el Protocolo.jsx completo por ahora.
      window.location.href = `/protocolo?equipo=${equipo.id}&tecnico=1`;
      return;
    }
    setMant(defaultMant(equipo));
    setErrorMant("");
    setVista("mantenimiento");
  };

  const setField = (field, value) => setMant(prev => ({ ...prev, [field]: value }));
  const setNested = (group, field, value) => setMant(prev => ({ ...prev, [group]: { ...prev[group], [field]: value } }));
  const setStatus = (item, value) => setMant(prev => ({ ...prev, status: { ...prev.status, [item]: value } }));
  const updateFila = (i, field, value) => setMant(prev => ({ ...prev, filas: prev.filas.map((f, idx) => idx === i ? { ...f, [field]: value } : f) }));
  const addFila = () => setMant(prev => ({ ...prev, filas: [...prev.filas, { obs: "", causa: "", rec: "" }] }));
  const removeFila = (i) => setMant(prev => ({ ...prev, filas: prev.filas.filter((_, idx) => idx !== i) }));

  const guardarMantenimiento = async () => {
    setGuardandoMant(true);
    setErrorMant("");
    try {
      const protocolo = {
        grupo: "fancoil",
        fecha: mant.fecha, tecnico: mant.tecnico, tipoServicio: mant.tipoServicio, ordenTrabajo: mant.ordenTrabajo,
        vL1L2: mant.voltajeMarcha.l1l2, vL2L3: mant.monofasico ? "" : mant.voltajeMarcha.l2l3, vL3L1: mant.monofasico ? "" : mant.voltajeMarcha.l3l1,
        vPlacaL1L2: equipo.voltaje || "", vPlacaL2L3: equipo.voltaje || "", vPlacaL3L1: equipo.voltaje || "",
        aL1: mant.amperajeMarcha.l1, aL2: mant.amperajeMarcha.l2, aL3: mant.monofasico ? "" : mant.amperajeMarcha.l3,
        aPlacaL1: equipo.amperaje || "", aPlacaL2: equipo.amperaje || "", aPlacaL3: equipo.amperaje || "",
        megL1T: mant.megado.l1t, megL2T: mant.megado.l2t, megL3T: mant.megado.l3t,
        megL1L2: mant.megado.l1l2, megL2L3: mant.megado.l2l3, megL3L1: mant.megado.l3l1,
        tTrabajoMotor: mant.tempTrabajoMotor, tEntradaAgua: mant.tempEntradaAgua, tSalidaAgua: mant.tempSalidaAgua,
        presEntradaAgua: mant.presionEntrada, presSalidaAgua: mant.presionSalida,
        tRetornoAire: mant.tempRetornoAire, tSuministroAire: mant.tempSuministroAire,
        estatusItems: mant.status,
        observaciones: mant.filas,
        estadoFinal: mant.estadoFinal === "Con observaciones" ? "Operativo con observaciones" : mant.estadoFinal,
        actividades: {},
      };

      const historial = equipo.protocolos || [];
      const nuevos = [protocolo, ...historial].slice(0, 10);

      const obsSync = protocolo.observaciones
        .filter(o => o.obs?.trim())
        .map(o => ({ texto: o.obs, causa: o.causa || "", rec: o.rec || "", fecha: protocolo.fecha, tecnico: protocolo.tecnico }));
      const recSync = protocolo.observaciones.filter(o => o.rec?.trim()).map(o => o.rec);

      await updateDoc(doc(db, "equipos", equipo.id), {
        protocolos: nuevos,
        observacionesArray: obsSync.map(o => ({ texto: o.texto, fecha: o.fecha, tecnico: o.tecnico, causa: o.causa })),
        observaciones: obsSync.map(o => o.texto).join("\n"),
        recomendacionesArray: recSync,
        recomendaciones: recSync.join("\n"),
        estado: protocolo.estadoFinal,
        ultimoMantenimiento: protocolo.fecha,
        ultimoProtocolo: protocolo.fecha,
        ultimoTecnico: protocolo.tecnico,
      });

      setVista("mant_guardado");
    } catch (e) {
      setErrorMant("No se pudo guardar el registro. Intenta de nuevo.");
    }
    setGuardandoMant(false);
  };

  // ---- Items del menú, según rol ----
  const menuItems = [
    {
      key: "ficha",
      title: "Ver ficha técnica",
      subtitle: "Datos del equipo",
      bg: "#ffffff", border: "#c3d6fb", iconBg: "#e5f0ff", titleColor: "#0f1b3d",
      icon: <IconFicha color="#1a4fc0" />,
      onClick: onVerInforme,
    },
    ...(rol === "tecnico" ? [{
      key: "mantenimiento",
      title: "Registrar mantenimiento",
      subtitle: "Checklist, parámetros y observaciones",
      bg: "#ffffff", border: "#c3d6fb", iconBg: "#e6f7ec", titleColor: "#0f1b3d",
      icon: <IconCheck color="#1c9a53" />,
      onClick: abrirMantenimiento,
    }] : []),
    ...(rol === "tecnico" && esConGas ? [{
      key: "carga",
      title: "Registrar carga de refrigerante",
      subtitle: "Solo Split, VRV y Chiller",
      bg: "#f3f8fe", border: "#1a4fc0", iconBg: "#ffffff", titleColor: "#0f1b3d",
      icon: <IconGota color="#1a4fc0" />,
      onClick: () => { setFormCarga({ tipo: "carga", kg: "", tecnico: "" }); setVista("carga"); },
    }] : []),
    ...(rol === "tecnico" && esConGas ? [{
      key: "reemplazo",
      title: "Reemplazar equipo",
      subtitle: "El equipo actual queda como historial",
      bg: "#ffffff", border: "#e2d4fb", iconBg: "#f1e9fb", titleColor: "#0f1b3d",
      icon: <IconReemplazo color="#7c3fd8" />,
      onClick: () => {
        setFormReemplazo({
          marca: "", modelo: "", serie: "", capacidad: equipo.capacidad || "",
          tipoRefrigerante: equipo.tipoRefrigerante || "", fases: equipo.fases || "Monofásico",
          voltaje: equipo.voltaje || "", amperaje: equipo.amperaje || "",
          cargaNominal: equipo.cargaNominal || "", cargaAdicionalInstalacion: "", kgRecuperados: "", tecnico: "",
        });
        setVista("reemplazo");
      },
    }] : []),
    {
      key: "averia",
      title: "Reportar avería",
      subtitle: "Describir el problema",
      bg: "#fdeeee", border: "#f6d3d3", iconBg: "#fbdada", titleColor: "#a52b2b",
      icon: <IconAlerta color="#c23b3b" />,
      onClick: () => setVista("averia"),
    },
  ];

  // ============ HOME ============
  if (vista === "home") {
    return (
      <div style={st.homeBg}>
        <div style={st.homeCol}>
          <div style={st.homeLogoWrap}>
            <div style={st.homeLogoBox}>
              <img src="/assets/hvac-isotipo-filled.png" alt="HVAC Control" style={st.homeLogoImg} />
            </div>
          </div>
          <div style={st.homeBtnsWrap}>
            <button style={st.btnCliente} onClick={() => elegirRol("cliente")}>
              <IconPersona color="#1a4fc0" /> Cliente
            </button>
            <button style={st.btnTecnico} onClick={() => elegirRol("tecnico")}>
              <IconLlave color="#ffffff" /> Técnico
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============ PASSWORD ============
  if (vista === "password") {
    return (
      <div style={st.homeBg}>
        <div style={st.pwCol}>
          <div style={st.pwBadge}><IconCandado /></div>
          <div style={{ textAlign: "center" }}>
            <div style={st.pwTitulo}>Acceso {LABELS[rol]}</div>
            <div style={st.pwSub}>Ingresa tu contraseña de 4 dígitos</div>
          </div>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            autoFocus
            value={codigo}
            onChange={onCodeChange}
            onKeyDown={(e) => e.key === "Enter" && enviarCodigo()}
            placeholder="••••"
            style={st.pwInput}
          />
          {hasError && <div style={st.pwError}>Contraseña incorrecta, intenta de nuevo.</div>}
          <button style={st.pwBtnIngresar} onClick={enviarCodigo}>Ingresar</button>
          <button style={st.pwBtnVolver} onClick={volverAHome}>← Volver</button>
        </div>
      </div>
    );
  }

  // ============ MENU ============
  if (vista === "menu") {
    return (
      <div style={st.menuBg}>
        <div style={st.menuCol}>
          <div style={st.menuLogoWrap}>
            <img src="/assets/hvac-isotipo-blue.png" alt="HVAC Control" style={st.menuLogoImg} />
          </div>
          <div style={st.menuChipRow}>
            <span style={st.rolChip}>{LABELS[rol]}</span>
            <span style={st.dotMuted}>·</span>
            <span style={st.sesionTxt}>Sesión activa</span>
          </div>
          <div style={st.menuLista}>
            {menuItems.map(item => (
              <button
                key={item.key}
                onClick={item.onClick}
                style={{ ...st.menuItem, background: item.bg, border: `1px solid ${item.border}` }}
              >
                <div style={{ ...st.menuIconTile, background: item.iconBg }}>{item.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ ...st.menuItemTitulo, color: item.titleColor }}>{item.title}</div>
                  <div style={st.menuItemSub}>{item.subtitle}</div>
                </div>
                <IconChevron />
              </button>
            ))}
          </div>
          <button style={st.btnSalir} onClick={volverAHome}>
            <IconFlechaAtras /> Salir
          </button>
          <div style={st.footerTxt}>HVAC Sistema de Mantenimiento</div>
        </div>
      </div>
    );
  }

  // ============ REGISTRAR MANTENIMIENTO (Fan Coil / UMA) ============
  if (vista === "mantenimiento") {
    const fichaFields = [
      ["Tipo de equipo", equipo.tipoEquipo], ["Código", equipo.codigo],
      ["Modelo", equipo.modelo], ["Serie", equipo.serie],
      ["Ambiente", equipo.ambiente], ["Marca", equipo.marca],
    ];
    const voltajeFields = [
      { key: "l1l2", label: "L1-L2", value: mant.voltajeMarcha.l1l2, onChange: e => setNested("voltajeMarcha", "l1l2", e.target.value) },
      ...(mant.monofasico ? [] : [
        { key: "l2l3", label: "L2-L3", value: mant.voltajeMarcha.l2l3, onChange: e => setNested("voltajeMarcha", "l2l3", e.target.value) },
        { key: "l3l1", label: "L3-L1", value: mant.voltajeMarcha.l3l1, onChange: e => setNested("voltajeMarcha", "l3l1", e.target.value) },
      ]),
    ];
    const amperajeFields = [
      { key: "l1", label: "L1", value: mant.amperajeMarcha.l1, onChange: e => setNested("amperajeMarcha", "l1", e.target.value) },
      { key: "l2", label: "L2", value: mant.amperajeMarcha.l2, onChange: e => setNested("amperajeMarcha", "l2", e.target.value) },
      ...(mant.monofasico ? [] : [{ key: "l3", label: "L3", value: mant.amperajeMarcha.l3, onChange: e => setNested("amperajeMarcha", "l3", e.target.value) }]),
    ];
    const megadoFields = [
      ["l1t", "L1-T"], ["l2t", "L2-T"], ["l3t", "L3-T"], ["l1l2", "L1-L2"], ["l2l3", "L2-L3"], ["l3l1", "L3-L1"],
    ].map(([key, label]) => ({ key, label, value: mant.megado[key], onChange: e => setNested("megado", key, e.target.value) }));

    const deltaAgua = calcDelta(mant.tempEntradaAgua, mant.tempSalidaAgua);
    const deltaPresion = calcDelta(mant.presionEntrada, mant.presionSalida);
    const deltaAire = calcDelta(mant.tempRetornoAire, mant.tempSuministroAire);
    const tempPresionFields = [
      { key: "motor", label: "T° trabajo motor (°C)", value: mant.tempTrabajoMotor, editable: true, onChange: e => setField("tempTrabajoMotor", e.target.value) },
      { key: "entAgua", label: "T° entrada de agua (°C)", value: mant.tempEntradaAgua, editable: true, onChange: e => setField("tempEntradaAgua", e.target.value) },
      { key: "salAgua", label: "T° salida de agua (°C)", value: mant.tempSalidaAgua, editable: true, onChange: e => setField("tempSalidaAgua", e.target.value) },
      { key: "deltaAgua", label: "∆ Temp. de agua", value: deltaAgua, readonly: true },
      { key: "presEnt", label: "Presión de entrada (PSI)", value: mant.presionEntrada, editable: true, onChange: e => setField("presionEntrada", e.target.value) },
      { key: "presSal", label: "Presión de salida (PSI)", value: mant.presionSalida, editable: true, onChange: e => setField("presionSalida", e.target.value) },
      { key: "deltaPres", label: "∆ Presión de agua", value: deltaPresion, readonly: true },
      { key: "retAire", label: "T° retorno de aire (°C)", value: mant.tempRetornoAire, editable: true, onChange: e => setField("tempRetornoAire", e.target.value) },
      { key: "sumAire", label: "T° suministro de aire (°C)", value: mant.tempSuministroAire, editable: true, onChange: e => setField("tempSuministroAire", e.target.value) },
      { key: "deltaAire", label: "∆ Temp. de aire", value: deltaAire, readonly: true },
    ];
    const desbalanceVoltaje = mant.monofasico ? "N/A" : (calcDesbalance([mant.voltajeMarcha.l1l2, mant.voltajeMarcha.l2l3, mant.voltajeMarcha.l3l1]) || "—");
    const desbalanceAmperaje = calcDesbalance([mant.amperajeMarcha.l1, mant.amperajeMarcha.l2, mant.amperajeMarcha.l3]) || "—";
    const statusColor = (v) => v === "Falla" ? "#c23b3b" : v === "Observado" ? "#b8860b" : v === "N/A" ? "#8a92a6" : "#1c9a53";

    return (
      <div style={st.menuBg}>
        <div style={{ width: "100%", maxWidth: "640px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>

          <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "4px 2px 6px" }}>
            <button onClick={() => setVista("menu")} style={st.btnVolverCirculo}><IconFlechaAtras size={18} /></button>
            <div>
              <div style={st.formTitulo}>Registrar mantenimiento</div>
              <div style={st.formSub}>Protocolo Fan Coil / UMA · {equipo.codigo || equipo.ambiente}</div>
            </div>
          </div>

          {/* Datos del servicio */}
          <div style={st.card}>
            <div style={st.cardTitulo}>Datos del servicio</div>
            <div>
              <div style={st.subLabel}>Ficha del equipo</div>
              <div style={st.gridAuto}>
                {fichaFields.map(([label, val]) => (
                  <div key={label}>
                    <div style={st.fieldLabel}>{label}</div>
                    <div style={st.readonlyBox}>{val || "—"}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ ...st.gridAuto, marginTop: "12px" }}>
              <div>
                <div style={st.subLabel}>Fecha</div>
                <input type="date" value={mant.fecha} onChange={e => setField("fecha", e.target.value)} style={st.input} />
              </div>
              <div>
                <div style={st.subLabel}>Técnico</div>
                <input type="text" placeholder="Nombre del técnico" value={mant.tecnico} onChange={e => setField("tecnico", e.target.value)} style={st.input} />
              </div>
              <div>
                <div style={st.subLabel}>N° de orden de trabajo</div>
                <input type="text" placeholder="OT-0000" value={mant.ordenTrabajo} onChange={e => setField("ordenTrabajo", e.target.value)} style={st.input} />
              </div>
            </div>
            <div style={{ marginTop: "6px" }}>
              <div style={st.subLabel}>Tipo de servicio</div>
              <div style={{ display: "flex", gap: "22px", flexWrap: "wrap" }}>
                {["Preventivo", "Correctivo"].map(v => (
                  <label key={v} style={st.radioLabel}>
                    <input type="radio" name="tipoServicio" checked={mant.tipoServicio === v} onChange={() => setField("tipoServicio", v)} style={st.radioInput} />
                    {v}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Parámetros eléctricos */}
          <div style={st.card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
              <div style={st.cardTitulo}>Parámetros eléctricos</div>
              <label style={st.checkLabel}>
                <input type="checkbox" checked={mant.monofasico} onChange={e => setField("monofasico", e.target.checked)} style={st.radioInput} />
                Equipo monofásico
              </label>
            </div>
            <div>
              <div style={st.subLabel}>Voltaje en marcha (V)</div>
              <div style={st.gridSm}>
                {voltajeFields.map(f => (
                  <div key={f.key}>
                    <div style={st.fieldLabel}>{f.label}</div>
                    <input type="number" step="0.1" inputMode="decimal" placeholder="0.0" value={f.value} onChange={f.onChange} style={st.input} />
                  </div>
                ))}
              </div>
            </div>
            <div style={st.gridMd}>
              <div>
                <div style={st.fieldLabel}>Voltaje en placa (V) · ficha técnica</div>
                <div style={st.readonlyBox}>{equipo.voltaje ? `${equipo.voltaje}` : "—"}</div>
              </div>
              <div>
                <div style={st.fieldLabel}>Desbalance de voltaje</div>
                <div style={st.readonlyBoxAccent}>{desbalanceVoltaje}</div>
              </div>
            </div>
            <div>
              <div style={st.subLabel}>Amperaje en marcha (A)</div>
              <div style={st.gridSm}>
                {amperajeFields.map(f => (
                  <div key={f.key}>
                    <div style={st.fieldLabel}>{f.label}</div>
                    <input type="number" step="0.1" inputMode="decimal" placeholder="0.0" value={f.value} onChange={f.onChange} style={st.input} />
                  </div>
                ))}
              </div>
            </div>
            <div style={st.gridMd}>
              <div>
                <div style={st.fieldLabel}>Amperaje en placa (A) · ficha técnica</div>
                <div style={st.readonlyBox}>{equipo.amperaje ? `${equipo.amperaje}` : "—"}</div>
              </div>
              <div>
                <div style={st.fieldLabel}>Desbalance de amperaje</div>
                <div style={st.readonlyBoxAccent}>{desbalanceAmperaje}</div>
              </div>
            </div>
            <div>
              <div style={st.subLabel}>Megado (Ω)</div>
              <div style={st.gridSm}>
                {megadoFields.map(f => (
                  <div key={f.key}>
                    <div style={st.fieldLabel}>{f.label}</div>
                    <input type="number" step="0.1" inputMode="decimal" placeholder="0.0" value={f.value} onChange={f.onChange} style={st.input} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Temperaturas y presiones */}
          <div style={st.card}>
            <div style={st.cardTitulo}>Temperaturas y presiones</div>
            <div style={st.gridMd2}>
              {tempPresionFields.map(f => (
                <div key={f.key}>
                  <div style={st.fieldLabel}>{f.label}</div>
                  {f.readonly
                    ? <div style={st.readonlyBoxAccent}>{f.value || "—"}</div>
                    : <input type="number" step="0.1" inputMode="decimal" placeholder="0.0" value={f.value} onChange={f.onChange} style={st.input} />}
                </div>
              ))}
            </div>
          </div>

          {/* Estado de componentes */}
          <div style={st.card}>
            <div style={{ ...st.cardTitulo, marginBottom: "8px" }}>Estado de componentes</div>
            {FANCOIL_ITEMS.map(item => (
              <div key={item} style={st.statusRow}>
                <div style={st.statusLabel}>{item}</div>
                <select value={mant.status[item]} onChange={e => setStatus(item, e.target.value)} style={{ ...st.select, color: statusColor(mant.status[item]) }}>
                  <option value="OK">OK</option>
                  <option value="Observado">Observado</option>
                  <option value="Falla">Falla</option>
                  <option value="N/A">N/A</option>
                </select>
              </div>
            ))}
          </div>

          {/* Observación / Causa / Recomendación */}
          <div style={st.card}>
            <div style={st.cardTitulo}>Observación · Causa · Recomendación</div>
            {mant.filas.map((fila, i) => (
              <div key={i} style={st.filaCard}>
                {mant.filas.length > 1 && (
                  <button onClick={() => removeFila(i)} style={st.btnRemoveFila}>×</button>
                )}
                <div>
                  <div style={st.fieldLabel}>Observación</div>
                  <textarea rows={2} placeholder="Descripción de lo observado" value={fila.obs} onChange={e => updateFila(i, "obs", e.target.value)} style={st.textarea} />
                </div>
                <div>
                  <div style={st.fieldLabel}>Causa</div>
                  <textarea rows={2} placeholder="Causa probable" value={fila.causa} onChange={e => updateFila(i, "causa", e.target.value)} style={st.textarea} />
                </div>
                <div>
                  <div style={st.fieldLabel}>Recomendación</div>
                  <textarea rows={2} placeholder="Recomendación para el cliente" value={fila.rec} onChange={e => updateFila(i, "rec", e.target.value)} style={st.textarea} />
                </div>
              </div>
            ))}
            <button onClick={addFila} style={st.btnAddFila}>+ Agregar fila</button>
          </div>

          {/* Estado final */}
          <div style={st.card}>
            <div style={st.cardTitulo}>Estado final del equipo</div>
            <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
              {["Operativo", "Operativo con observaciones", "Fuera de servicio"].map(v => (
                <label key={v} style={st.radioLabel}>
                  <input type="radio" name="estadoFinal" checked={mant.estadoFinal === v} onChange={() => setField("estadoFinal", v)} style={st.radioInput} />
                  {v === "Operativo con observaciones" ? "Con observaciones" : v}
                </label>
              ))}
            </div>
          </div>

          {errorMant && <div style={{ color: "#c23b3b", fontSize: "13px", textAlign: "center" }}>{errorMant}</div>}

          <button onClick={guardarMantenimiento} disabled={guardandoMant} style={st.btnGuardar}>
            {guardandoMant ? "Guardando..." : "Guardar registro"}
          </button>
          <button onClick={() => setVista("menu")} style={st.btnCancelar}>Cancelar</button>
        </div>
      </div>
    );
  }

  // ============ MANTENIMIENTO GUARDADO ============
  if (vista === "mant_guardado") {
    return (
      <div style={st.menuBg}>
        <div style={st.pwCol}>
          <div style={st.modalCard}>
            <div style={{ width: "52px", height: "52px", borderRadius: "50%", background: "#e6f7ec", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <IconCheck color="#1c9a53" />
            </div>
            <div style={st.modalTitulo}>Mantenimiento registrado</div>
            <div style={st.modalTexto}>El registro se guardó correctamente en la ficha del equipo.</div>
            <button style={st.modalBtn} onClick={() => setVista("menu")}>Entendido</button>
          </div>
        </div>
      </div>
    );
  }

  // ============ REPORTAR AVERÍA ============
  if (vista === "averia") {
    return (
      <div style={st.menuBg}>
        <div style={st.pwCol}>
          <div style={st.modalCard}>
            <div style={{ fontWeight: 800, fontSize: "clamp(16px,4.5vw,18px)", color: "#0f1b3d", marginBottom: "6px", textAlign: "left" }}>Reportar avería</div>
            <div style={{ color: "#6b7488", fontSize: "clamp(12px,3.2vw,13px)", marginBottom: "14px", textAlign: "left" }}>Describe el problema que presenta el equipo</div>
            <textarea
              value={mensajeAveria}
              onChange={(e) => setMensajeAveria(e.target.value)}
              placeholder="El equipo hace un ruido extraño y no enfría bien..."
              style={{ ...st.textarea, minHeight: "100px" }}
            />
            {errorAveria && <div style={{ color: "#c23b3b", fontSize: "12px", marginBottom: "10px" }}>{errorAveria}</div>}
            <button onClick={enviarAveria} disabled={enviandoAveria} style={st.btnGuardar}>
              {enviandoAveria ? "Enviando..." : "Enviar reporte"}
            </button>
            <button style={{ ...st.pwBtnVolver, color: "#1a4fc0", display: "block", margin: "8px auto 0" }} onClick={() => setVista("menu")}>← Volver</button>
          </div>
        </div>
      </div>
    );
  }

  // ============ REGISTRAR CARGA DE REFRIGERANTE ============
  if (vista === "carga") {
    return (
      <div style={st.menuBg}>
        <div style={st.pwCol}>
          <div style={st.modalCard}>
            <div style={{ fontWeight: 800, fontSize: "clamp(16px,4.5vw,18px)", color: "#0f1b3d", marginBottom: "4px", textAlign: "left" }}>Registrar carga de refrigerante</div>
            <div style={{ color: "#6b7488", fontSize: "clamp(11px,3vw,12px)", marginBottom: "16px", textAlign: "left" }}>{equipo.codigo ? `${equipo.codigo} · ` : ""}{equipo.ambiente || "-"}</div>
            <form onSubmit={guardarCarga} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={st.labelForm}>Movimiento</label>
                <div style={{ display: "flex", gap: "8px" }}>
                  {["carga", "recuperacion"].map(t => (
                    <div
                      key={t}
                      onClick={() => setFormCarga({ ...formCarga, tipo: t })}
                      style={{ flex: 1, textAlign: "center", padding: "10px", borderRadius: "10px", cursor: "pointer", fontSize: "12.5px", fontWeight: 700, fontFamily: "inherit", background: formCarga.tipo === t ? "#1a4fc0" : "#f4f6fb", color: formCarga.tipo === t ? "white" : "#8a92a6" }}
                    >
                      {t === "carga" ? "Carga" : "Recuperación"}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label style={st.labelForm}>Kg de refrigerante</label>
                <input style={st.inputForm} type="number" step="0.1" placeholder="0.5" value={formCarga.kg} onChange={e => setFormCarga({ ...formCarga, kg: e.target.value })} required />
              </div>
              <div>
                <label style={st.labelForm}>Tu nombre</label>
                <input style={st.inputForm} placeholder="Nombre del técnico" value={formCarga.tecnico} onChange={e => setFormCarga({ ...formCarga, tecnico: e.target.value })} />
              </div>
              {errorCarga && <div style={{ color: "#c23b3b", fontSize: "12px" }}>{errorCarga}</div>}
              <button type="submit" disabled={guardandoCarga} style={st.btnGuardar}>{guardandoCarga ? "Guardando..." : "Guardar carga"}</button>
              <button type="button" style={{ ...st.pwBtnVolver, color: "#1a4fc0", display: "block", margin: "0 auto" }} onClick={() => setVista("menu")}>← Volver</button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ============ CARGA GUARDADA ============
  if (vista === "carga_guardada") {
    return (
      <div style={st.menuBg}>
        <div style={st.pwCol}>
          <div style={st.modalCard}>
            <div style={{ width: "52px", height: "52px", borderRadius: "50%", background: "#e6f7ec", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <IconCheck color="#1c9a53" />
            </div>
            <div style={st.modalTitulo}>Carga registrada</div>
            <div style={st.modalTexto}>Queda visible en el historial de refrigerante del equipo.</div>
            <button style={{ ...st.btnGuardar, marginTop: "18px" }} onClick={() => setVista("menu")}>Volver al menú</button>
          </div>
        </div>
      </div>
    );
  }

  // ============ REEMPLAZAR EQUIPO ============
  if (vista === "reemplazo") {
    return (
      <div style={st.menuBg}>
        <div style={st.pwCol}>
          <div style={st.modalCard}>
            <div style={{ fontWeight: 800, fontSize: "clamp(16px,4.5vw,18px)", color: "#0f1b3d", marginBottom: "4px", textAlign: "left" }}>Reemplazar equipo</div>
            <div style={{ color: "#6b7488", fontSize: "clamp(11px,3vw,12px)", marginBottom: "10px", textAlign: "left" }}>{equipo.codigo ? `${equipo.codigo} · ` : ""}{equipo.ambiente || "-"}</div>
            <div style={{ background: "#fdeeee", border: "1px solid #f6d3d3", borderRadius: "10px", padding: "9px 11px", marginBottom: "14px" }}>
              <span style={{ fontSize: "11px", color: "#a52b2b", fontWeight: 600 }}>El equipo actual queda como historial. No se elimina, y esta acción no se puede deshacer desde el teléfono.</span>
            </div>
            <form onSubmit={guardarReemplazo} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={st.seccionLabelForm}>Datos generales</div>
              <div>
                <label style={st.labelForm}>Marca (equipo nuevo)</label>
                <input style={st.inputForm} value={formReemplazo.marca} onChange={e => setFormReemplazo({ ...formReemplazo, marca: e.target.value })} required />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={st.labelForm}>Modelo</label>
                  <input style={st.inputForm} value={formReemplazo.modelo} onChange={e => setFormReemplazo({ ...formReemplazo, modelo: e.target.value })} />
                </div>
                <div>
                  <label style={st.labelForm}>N° serie</label>
                  <input style={st.inputForm} value={formReemplazo.serie} onChange={e => setFormReemplazo({ ...formReemplazo, serie: e.target.value })} />
                </div>
              </div>
              <div>
                <label style={st.labelForm}>Capacidad (BTU)</label>
                <input style={st.inputForm} value={formReemplazo.capacidad} onChange={e => setFormReemplazo({ ...formReemplazo, capacidad: e.target.value })} />
              </div>

              <div style={{ ...st.seccionLabelForm, color: "#1a4fc0" }}>Eléctrico y refrigerante</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={st.labelForm}>Refrigerante</label>
                  <select style={st.inputForm} value={formReemplazo.tipoRefrigerante} onChange={e => setFormReemplazo({ ...formReemplazo, tipoRefrigerante: e.target.value })}>
                    <option value="">Seleccionar...</option>
                    {["R-22", "R-410A", "R-32", "R-407C", "R-134A", "Otro"].map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label style={st.labelForm}>Fases</label>
                  <select style={st.inputForm} value={formReemplazo.fases} onChange={e => setFormReemplazo({ ...formReemplazo, fases: e.target.value })}>
                    <option>Monofásico</option><option>Trifásico</option>
                  </select>
                </div>
                <div>
                  <label style={st.labelForm}>Voltaje placa (V)</label>
                  <input style={st.inputForm} value={formReemplazo.voltaje} onChange={e => setFormReemplazo({ ...formReemplazo, voltaje: e.target.value })} />
                </div>
                <div>
                  <label style={st.labelForm}>Amperaje placa (A)</label>
                  <input style={st.inputForm} value={formReemplazo.amperaje} onChange={e => setFormReemplazo({ ...formReemplazo, amperaje: e.target.value })} />
                </div>
                <div>
                  <label style={st.labelForm}>Carga nominal (kg)</label>
                  <input style={st.inputForm} type="number" step="0.1" value={formReemplazo.cargaNominal} onChange={e => setFormReemplazo({ ...formReemplazo, cargaNominal: e.target.value })} />
                </div>
                <div>
                  <label style={st.labelForm}>Carga adic. instalación (kg)</label>
                  <input style={st.inputForm} type="number" step="0.1" placeholder="0.0" value={formReemplazo.cargaAdicionalInstalacion} onChange={e => setFormReemplazo({ ...formReemplazo, cargaAdicionalInstalacion: e.target.value })} />
                </div>
              </div>

              <div style={{ ...st.seccionLabelForm, color: "#a52b2b" }}>Baja del equipo anterior</div>
              <div>
                <label style={st.labelForm}>Kg de gas recuperados del equipo viejo</label>
                <input style={st.inputForm} type="number" step="0.1" placeholder="0.0" value={formReemplazo.kgRecuperados} onChange={e => setFormReemplazo({ ...formReemplazo, kgRecuperados: e.target.value })} />
              </div>
              <div>
                <label style={st.labelForm}>Tu nombre</label>
                <input style={st.inputForm} placeholder="Nombre del técnico" value={formReemplazo.tecnico} onChange={e => setFormReemplazo({ ...formReemplazo, tecnico: e.target.value })} />
              </div>
              {errorReemplazo && <div style={{ color: "#c23b3b", fontSize: "12px" }}>{errorReemplazo}</div>}
              <button type="submit" disabled={guardandoReemplazo} style={{ ...st.btnGuardar, background: "#7c3fd8" }}>{guardandoReemplazo ? "Guardando..." : "Confirmar reemplazo"}</button>
              <button type="button" style={{ ...st.pwBtnVolver, color: "#1a4fc0", display: "block", margin: "0 auto" }} onClick={() => setVista("menu")}>← Volver</button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ============ REEMPLAZO GUARDADO ============
  if (vista === "reemplazo_guardado") {
    return (
      <div style={st.menuBg}>
        <div style={st.pwCol}>
          <div style={st.modalCard}>
            <div style={{ width: "52px", height: "52px", borderRadius: "50%", background: "#f1e9fb", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <IconReemplazo color="#7c3fd8" />
            </div>
            <div style={st.modalTitulo}>Equipo reemplazado</div>
            <div style={st.modalTexto}>El equipo anterior quedó guardado como historial.</div>
            <button style={{ ...st.btnGuardar, marginTop: "18px" }} onClick={() => setVista("menu")}>Volver al menú</button>
          </div>
        </div>
      </div>
    );
  }

  // ============ ENVIADO ============
  return (
    <div style={st.menuBg}>
      <div style={st.pwCol}>
        <div style={st.modalCard}>
          <div style={{ width: "52px", height: "52px", borderRadius: "50%", background: "#e6f7ec", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <IconCheck color="#1c9a53" />
          </div>
          <div style={st.modalTitulo}>Reporte enviado</div>
          <div style={st.modalTexto}>El equipo de mantenimiento fue notificado.</div>
        </div>
      </div>
    </div>
  );
}

// ============ ESTILOS (tokens exactos del handoff de Claude Design) ============
const FONT = "'Manrope', -apple-system, sans-serif";

const st = {
  homeBg: {
    position: "relative", width: "100%", minHeight: "100vh", background: "#3d4feb",
    fontFamily: FONT, display: "flex", alignItems: "center", justifyContent: "center",
    boxSizing: "border-box", padding: "clamp(16px,5vw,32px)", overflow: "hidden",
  },
  homeCol: {
    position: "relative", zIndex: 1, width: "100%", maxWidth: "420px",
    minHeight: "min(88vh,780px)", display: "flex", flexDirection: "column", boxSizing: "border-box",
  },
  homeLogoWrap: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 0" },
  homeLogoBox: { width: "clamp(126px,33vw,168px)", height: "clamp(126px,33vw,168px)", display: "flex", alignItems: "center", justifyContent: "center" },
  homeLogoImg: {
    width: "100%", height: "100%", objectFit: "contain",
    filter: "drop-shadow(0.5px 0 0 #123a8f) drop-shadow(-0.5px 0 0 #123a8f) drop-shadow(0 0.5px 0 #123a8f) drop-shadow(0 -0.5px 0 #123a8f) drop-shadow(0 6px 14px rgba(0,20,80,0.25))",
  },
  homeBtnsWrap: { display: "flex", flexDirection: "column", alignItems: "center", gap: "clamp(10px,2.2vh,14px)", padding: "0 4px clamp(120px,22vh,170px)" },
  btnCliente: {
    width: "100%", boxSizing: "border-box", background: "#ffffff", color: "#1a4fc0", border: "none",
    borderRadius: "14px", padding: "clamp(14px,3.6vh,17px) 20px", fontFamily: "inherit", fontWeight: 700,
    fontSize: "clamp(15px,4vw,17px)", cursor: "pointer", boxShadow: "0 8px 20px rgba(0,20,80,0.18)",
    display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
  },
  btnTecnico: {
    width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.14)", color: "#ffffff",
    border: "1.5px solid rgba(255,255,255,0.55)", borderRadius: "14px", padding: "clamp(14px,3.6vh,17px) 20px",
    fontFamily: "inherit", fontWeight: 700, fontSize: "clamp(15px,4vw,17px)", cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
  },
  pwCol: { position: "relative", zIndex: 1, width: "100%", maxWidth: "380px", display: "flex", flexDirection: "column", alignItems: "center", gap: "clamp(18px,4vh,26px)" },
  pwBadge: { width: "clamp(68px,18vw,88px)", height: "clamp(68px,18vw,88px)", borderRadius: "26%", background: "rgba(255,255,255,0.12)", border: "1.5px solid rgba(255,255,255,0.28)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 10px 30px rgba(0,20,80,0.25)" },
  pwTitulo: { color: "#ffffff", fontWeight: 800, fontSize: "clamp(18px,5vw,22px)" },
  pwSub: { color: "rgba(255,255,255,0.7)", fontWeight: 500, fontSize: "clamp(12px,3.2vw,14px)", marginTop: "6px" },
  pwInput: { width: "100%", boxSizing: "border-box", textAlign: "center", letterSpacing: "0.6em", fontSize: "clamp(22px,7vw,28px)", fontWeight: 700, color: "#ffffff", background: "rgba(255,255,255,0.12)", border: "1.5px solid rgba(255,255,255,0.4)", borderRadius: "14px", padding: "clamp(12px,3vh,16px) 12px", fontFamily: "inherit" },
  pwError: { color: "#ffd7d7", fontWeight: 600, fontSize: "13px", marginTop: "-10px" },
  pwBtnIngresar: { width: "100%", boxSizing: "border-box", background: "#ffffff", color: "#1a4fc0", border: "none", borderRadius: "14px", padding: "clamp(13px,3.4vh,16px) 20px", fontFamily: "inherit", fontWeight: 700, fontSize: "clamp(15px,4vw,16px)", cursor: "pointer", boxShadow: "0 8px 20px rgba(0,20,80,0.18)" },
  pwBtnVolver: { background: "none", border: "none", color: "rgba(255,255,255,0.75)", fontFamily: "inherit", fontWeight: 600, fontSize: "clamp(12px,3.2vw,13px)", cursor: "pointer", padding: "6px" },

  menuBg: { width: "100%", minHeight: "100vh", background: "#f4f6fb", fontFamily: FONT, display: "flex", alignItems: "flex-start", justifyContent: "center", boxSizing: "border-box", padding: "clamp(20px,6vw,40px) clamp(16px,5vw,24px)" },
  menuCol: { width: "100%", maxWidth: "480px", display: "flex", flexDirection: "column", alignItems: "center", gap: "clamp(16px,3vh,20px)" },
  menuLogoWrap: { display: "flex", alignItems: "center", justifyContent: "center", marginTop: "8px" },
  menuLogoImg: { width: "clamp(100px,26vw,132px)", height: "clamp(100px,26vw,132px)", objectFit: "contain" },
  menuChipRow: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", justifyContent: "center" },
  rolChip: { background: "#e7e4fb", color: "#5b4fd8", fontWeight: 700, fontSize: "12px", padding: "4px 10px", borderRadius: "7px" },
  dotMuted: { color: "#8a92a6", fontSize: "12px" },
  sesionTxt: { color: "#26314d", fontWeight: 600, fontSize: "13px" },
  menuLista: { width: "100%", display: "flex", flexDirection: "column", gap: "12px", marginTop: "8px" },
  menuItem: { width: "100%", boxSizing: "border-box", borderRadius: "16px", padding: "clamp(14px,3.4vh,18px) clamp(14px,3.4vw,18px)", display: "flex", alignItems: "center", gap: "14px", cursor: "pointer", textAlign: "left", fontFamily: "inherit" },
  menuIconTile: { width: "42px", height: "42px", minWidth: "42px", borderRadius: "11px", display: "flex", alignItems: "center", justifyContent: "center" },
  menuItemTitulo: { fontWeight: 700, fontSize: "clamp(14px,3.8vw,16px)" },
  menuItemSub: { fontWeight: 500, fontSize: "clamp(12px,3.2vw,13px)", color: "#6b7488", marginTop: "2px" },
  btnSalir: { background: "none", border: "none", color: "#1a4fc0", fontFamily: "inherit", fontWeight: 700, fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", padding: "4px" },
  footerTxt: { color: "#8a92a6", fontWeight: 600, fontSize: "12px", marginTop: "16px" },

  // Formulario de mantenimiento
  btnVolverCirculo: { background: "#ffffff", border: "1px solid #dfe6f5", borderRadius: "10px", width: "38px", height: "38px", minWidth: "38px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
  formTitulo: { fontWeight: 800, fontSize: "clamp(17px,4.6vw,20px)", color: "#12245e", fontFamily: FONT },
  formSub: { fontWeight: 600, fontSize: "clamp(11px,3vw,12.5px)", color: "#8a92a6", fontFamily: FONT },
  card: { background: "#ffffff", border: "1px solid #e7ebf3", borderRadius: "18px", padding: "clamp(16px,4vw,22px)", display: "flex", flexDirection: "column", gap: "14px", fontFamily: FONT },
  cardTitulo: { fontWeight: 800, fontSize: "clamp(13px,3.4vw,14.5px)", color: "#1a4fc0", letterSpacing: "0.02em" },
  subLabel: { fontWeight: 700, fontSize: "12.5px", color: "#26314d", marginBottom: "8px" },
  fieldLabel: { fontWeight: 600, fontSize: "11.5px", color: "#8a92a6", marginBottom: "5px" },
  gridAuto: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: "12px" },
  gridSm: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(100px,1fr))", gap: "12px" },
  gridMd: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: "12px" },
  gridMd2: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: "12px" },
  input: { width: "100%", boxSizing: "border-box", border: "1px solid #dfe6f5", borderRadius: "11px", padding: "10px 11px", fontFamily: "inherit", fontSize: "14px", color: "#0f1b3d", background: "#f9fafc" },
  readonlyBox: { width: "100%", boxSizing: "border-box", border: "1px solid #e7ebf3", borderRadius: "11px", padding: "11px 12px", fontSize: "14px", color: "#6b7488", background: "#eef1f6" },
  readonlyBoxAccent: { width: "100%", boxSizing: "border-box", border: "1px solid #e7ebf3", borderRadius: "11px", padding: "10px 11px", fontSize: "14px", color: "#1a4fc0", fontWeight: 700, background: "#eef1f6" },
  radioLabel: { display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "14px", color: "#26314d", fontWeight: 600 },
  radioInput: { width: "17px", height: "17px", accentColor: "#1a4fc0" },
  checkLabel: { display: "flex", alignItems: "center", gap: "7px", fontSize: "12.5px", fontWeight: 600, color: "#6b7488", cursor: "pointer" },
  statusRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", padding: "10px 0", borderBottom: "1px solid #eef1f6" },
  statusLabel: { fontSize: "13.5px", fontWeight: 600, color: "#26314d" },
  select: { border: "1px solid #dfe6f5", borderRadius: "9px", padding: "7px 10px", fontFamily: "inherit", fontSize: "13px", fontWeight: 700, background: "#f9fafc", minWidth: "118px" },
  filaCard: { border: "1px solid #eef1f6", borderRadius: "14px", padding: "14px", display: "flex", flexDirection: "column", gap: "10px", position: "relative", background: "#fafbfd" },
  btnRemoveFila: { position: "absolute", top: "10px", right: "10px", background: "#fdeeee", border: "none", color: "#c23b3b", width: "26px", height: "26px", borderRadius: "8px", fontWeight: 800, cursor: "pointer", fontSize: "14px", lineHeight: 1 },
  textarea: { width: "100%", boxSizing: "border-box", border: "1px solid #dfe6f5", borderRadius: "11px", padding: "10px 11px", fontFamily: "inherit", fontSize: "13.5px", color: "#0f1b3d", background: "#ffffff", resize: "vertical" },
  btnAddFila: { background: "#e5f0ff", color: "#1a4fc0", border: "1px dashed #a9c8fb", borderRadius: "12px", padding: "12px", fontFamily: "inherit", fontWeight: 700, fontSize: "13.5px", cursor: "pointer" },
  btnGuardar: { width: "100%", boxSizing: "border-box", background: "#1a4fc0", color: "#ffffff", border: "none", borderRadius: "14px", padding: "16px 20px", fontFamily: FONT, fontWeight: 700, fontSize: "clamp(15px,4vw,16px)", cursor: "pointer", boxShadow: "0 8px 20px rgba(26,79,192,0.28)" },
  btnCancelar: { background: "none", border: "none", color: "#6b7488", fontFamily: FONT, fontWeight: 600, fontSize: "13px", cursor: "pointer", padding: "6px", textAlign: "center" },

  modalCard: { width: "100%", background: "#ffffff", borderRadius: "20px", padding: "clamp(24px,6vw,32px)", boxShadow: "0 20px 50px rgba(0,10,40,0.35)", boxSizing: "border-box", textAlign: "center", fontFamily: FONT, maxHeight: "88vh", overflowY: "auto" },
  modalTitulo: { fontWeight: 800, fontSize: "clamp(16px,4.5vw,18px)", color: "#0f1b3d" },
  modalTexto: { color: "#5b6478", fontSize: "clamp(13px,3.6vw,14px)", marginTop: "8px", lineHeight: 1.5 },
  modalBtn: { marginTop: "20px", width: "100%", boxSizing: "border-box", background: "#1a4fc0", color: "#fff", border: "none", borderRadius: "12px", padding: "12px 20px", fontFamily: "inherit", fontWeight: 700, fontSize: "14px", cursor: "pointer" },
  labelForm: { display: "block", fontSize: "11px", fontWeight: 700, color: "#26314d", marginBottom: "5px", textAlign: "left" },
  seccionLabelForm: { fontSize: "10px", fontWeight: 700, color: "#8a92a6", letterSpacing: "0.05em", textTransform: "uppercase", textAlign: "left", marginTop: "2px" },
  inputForm: { width: "100%", boxSizing: "border-box", border: "1px solid #dfe6f5", borderRadius: "10px", padding: "10px 12px", fontFamily: "inherit", fontSize: "13px", color: "#0f1b3d", background: "#f9fafc" },
};
