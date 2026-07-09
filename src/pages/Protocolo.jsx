import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useNavigate, useSearchParams } from "react-router-dom";
import jsPDF from "jspdf";

// ============ DEFINICIÓN DE TIPOS DE PROTOCOLO ============
// Mapea cada tipoEquipo al grupo de protocolo que le corresponde
const GRUPO_POR_TIPO = {
  // Grupo 1 → Expansión Directa
  "Split Piso Techo": "expansion",
  "Split Pared": "expansion",
  "Split Ducto": "expansion",
  "Split Fancoil": "expansion",
  "Split Cassete": "expansion",
  "Ventana": "expansion",
  "Autocontenido": "expansion",
  "Precisión": "expansion",
  "VRV Evaporador": "vrv",
  "VRV Condensador": "vrv",
  // Compatibilidad nombres anteriores
  "Split Muro": "expansion",
  "Split Techo": "expansion",
  "Cassette": "expansion",
  "Casete": "expansion",
  "Cassete": "expansion",
  // Grupo 2 → Fancoil / UMA Agua Helada
  "Fancoil AH": "fancoil",
  "Pared AH": "fancoil",
  "UMA AH": "fancoil",
  "Fan Coil": "fancoil",
  // Grupo 3 → Ventilación
  "Ventilación": "ventilacion",
  "Extractor": "ventilacion",
  "Inyector": "ventilacion",
  "Cortina de aire": "ventilacion",
  "Jetfan": "ventilacion",
  "Presurizador": "ventilacion",
  // Grupo 4 → En preparación
  "Chiller": "pendiente",
  "Torre de Enfriamiento": "pendiente",
  "Bombas de agua": "pendiente",
};

const GRUPOS = {
  expansion: { label: "Expansión Directa (Split / VRV)", color: "#1a5fa8", icon: "❄️" },
  fancoil: { label: "Manejadora / Fan Coil / UMA Agua Helada", color: "#185fa5", icon: "💧" },
  ventilacion: { label: "Ventilación / Extracción / Inyección", color: "#0f6e56", icon: "🌀" },
  vrv: { label: "Sistema VRV", color: "#5c35cc", icon: "🔁" },
  pendiente: { label: "Protocolo en preparación", color: "#888", icon: "🔧" },
};

// ============ CÁLCULOS AUTOMÁTICOS ============
const calcDesbalance = (a, b, c) => {
  const vals = [a, b, c].map(parseFloat).filter(v => !isNaN(v));
  if (vals.length < 2) return "";
  const prom = vals.reduce((s, v) => s + v, 0) / vals.length;
  if (prom === 0) return "";
  const maxDesv = Math.max(...vals.map(v => Math.abs(v - prom)));
  return ((maxDesv / prom) * 100).toFixed(1);
};

const calcDelta = (a, b) => {
  const x = parseFloat(a), y = parseFloat(b);
  if (isNaN(x) || isNaN(y)) return "";
  return Math.abs(x - y).toFixed(1);
};

// ============ ESTRUCTURA VACÍA DE UN PROTOCOLO ============
const protocoloVacio = (grupo) => ({
  grupo,
  fecha: new Date().toISOString().split("T")[0],
  tecnico: "",
  tipoServicio: "Preventivo",
  ordenTrabajo: "",
  // Eléctricos (comunes)
  vL1L2: "", vL2L3: "", vL3L1: "",
  vPlacaL1L2: "", vPlacaL2L3: "", vPlacaL3L1: "",
  aL1: "", aL2: "", aL3: "",
  aPlacaL1: "", aPlacaL2: "", aPlacaL3: "",
  megL1T: "", megL2T: "", megL3T: "",
  megL1L2: "", megL2L3: "", megL3L1: "",
  // Refrigeración (expansion)
  presSuccion: "", presLiquido: "", tSatMedida: "", tSatTabla: "",
  tRetornoEvap: "", tSuministroEvap: "", tAmbCondensador: "",
  calentadorAceite: false,
  condVL1L2: "", condVL2L3: "", condVL3L1: "",
  condAL1: "", condAL2: "", condAL3: "",
  condMegL1T: "", condMegL2T: "", condMegL3T: "",
  condMegL1L2: "", condMegL2L3: "", condMegL3L1: "",
  modeloCompresor: "",
  // Ventilacion
  ventiladorNum: "", tipoVentilador: "",
  // Ventilación
  tTrabajoMotor: "", caudalAire: "",
  // Fancoil agua
  tEntradaAgua: "", tSalidaAgua: "", presEntradaAgua: "", presSalidaAgua: "",
  tRetornoAire: "", tSuministroAire: "", velocidadVent: "",
  estadoValvula: "OK", funcionamientoDampers: "OK",
  sensorArranque: "OK", sensorTempAmb: "OK", sensorSuministro: "OK",
  sensorDifPresion: "OK", estadoContactores: "OK", estadoImpulsor: "OK",
  llaveTermo: "OK", balanceCaudal: "OK",
  // Campos específicos Fan Coil / UMA (formato Carrier)
  contrato: "", modeloFaja: "", numFajas: "", marcaMotor: "", modeloMotor: "", serieMotor: "", fancoilNum: "",
  // Actividades (checklist) - objeto dinámico
  actividades: {},
  // Estatus de items (formato Carrier: OK / Observado / Falla / N/A)
  estatusItems: {},
  // Observaciones dinámicas
  observaciones: [{ obs: "", causa: "", rec: "" }],
  // Resultado
  estadoFinal: "Operativo",
});

const obsDesFicha = (data) => {
  const arr = data.observacionesArray || [];
  const norm = arr.map(o => typeof o === "string"
    ? { obs: o, causa: "", rec: "" }
    : { obs: o.texto || "", causa: o.causa || "", rec: "" }
  ).filter(o => o.obs.trim());
  const recs = data.recomendacionesArray?.filter(Boolean) ||
    data.recomendaciones?.split(/\n|;/).map(r => r.trim()).filter(Boolean) || [];
  if (norm.length > 0) {
    recs.forEach((r, i) => { if (norm[i]) norm[i].rec = typeof r === "string" ? r : r.texto || ""; });
    return norm;
  }
  return [{ obs: "", causa: "", rec: "" }];
};

// ============ CHECKLISTS POR GRUPO ============
const CHECKLISTS = {
  expansion: {
    "Evaporador": ["Limpieza filtros de aire", "Limpieza serpentín", "Limpieza bandeja drenaje", "Limpieza difusores/rejillas"],
    "Condensador": ["Limpieza serpentín", "Limpieza externa", "Descarte visual de fugas", "Filtros secadores"],
    "Eléctrico/Control": ["Ajuste terminales compresor", "Ajuste borneras/contactores", "Control, termostato, tarjetas", "Pintado bases y soportes"],
  },
  ventilacion: {
    "Limpieza": ["Limpieza filtros de aire", "Ajuste y limpieza impulsores", "Pintado impulsores de aire", "Pintura de estructura", "Desmontaje y limpieza motor"],
    "Mecánica": ["Revisión rodamientos motor", "Lubricación bocinas/rodamientos", "Lubricación chumaceras", "Revisión y templado de fajas", "Pernos anclaje/antivibratorios"],
    "Eléctrico": ["Prueba tableros de arranque", "Medición caudal de aire", "Verificación funcionamiento"],
  },
  fancoil: {
    "Actividades": ["Limpieza filtros de aire", "Lavado de coil", "Limpieza bandeja condensado", "Limpieza de contactos", "Lubricación chumaceras", "Templado de fajas", "Alineamiento de poleas", "Aislamiento térmico", "Lubricación de motores"],
  },
  chiller: {
    "Limpieza": ["Condensador (aire/agua)", "Evaporador / tubos", "Ventiladores condensador", "Filtros tipo Y agua", "Gabinete general"],
    "Revisión": ["Detección de fugas", "Conexiones eléctricas", "Contactores / relés", "Sensores y sondas", "Códigos de falla"],
    "Control/Agua": ["Flow switch", "Presostatos alta/baja", "Tratamiento de agua", "Calibración setpoint", "Prueba funcionamiento"],
  },
  torre: {
    "Limpieza": ["Relleno / fill (panal)", "Tina / depósito", "Boquillas aspersión", "Separador de gotas", "Filtro / colador", "Desincrustación"],
    "Mecánica": ["Engrase rodamientos", "Tensión de fajas", "Aceite del reductor", "Aspas ventilador", "Estructura / soportes"],
    "Agua/Control": ["Válvula flotador", "Dosificación química", "Control legionella", "Conexiones eléctricas", "Prueba funcionamiento"],
  },
};

// ============ FORMATO CARRIER FAN COIL / UMA ============
// Columna izquierda: parámetros con valor numérico (key del form, etiqueta, unidad)
const FANCOIL_PARAMS_IZQ = [
  { tipo: "elec3", label: "Voltaje en placa", sub: "Voltaje en marcha", unidad: "V", keys: ["vL1L2", "vL2L3", "vL3L1"], heads: ["L1-L2", "L2-L3", "L3-L1"] },
  { tipo: "auto", label: "Desbalance de voltaje", unidad: "%", calc: "desbV" },
  { tipo: "elec3", label: "Amperaje en placa", sub: "Amperaje en marcha", unidad: "A", keys: ["aL1", "aL2", "aL3"], heads: ["L1", "L2", "L3"] },
  { tipo: "auto", label: "Desbalance de voltaje", unidad: "%", calc: "desbA" },
  { tipo: "meg", label: "MEGADO", sub: "L1-T", unidad: "\u03A9", key: "megL1T" },
  { tipo: "meg", label: "", sub: "L2-T", unidad: "\u03A9", key: "megL2T" },
  { tipo: "meg", label: "", sub: "L3-T", unidad: "\u03A9", key: "megL3T" },
  { tipo: "meg", label: "", sub: "L1-L2", unidad: "\u03A9", key: "megL1L2" },
  { tipo: "meg", label: "", sub: "L2-L3", unidad: "\u03A9", key: "megL2L3" },
  { tipo: "meg", label: "", sub: "L3-L1", unidad: "\u03A9", key: "megL3L1" },
  { tipo: "val", label: "Temperatura de trabajo de motor", unidad: "°C", key: "tTrabajoMotor" },
  { tipo: "val", label: "Temperatura de entrada de agua", unidad: "°C", key: "tEntradaAgua" },
  { tipo: "val", label: "Temperatura de salida de agua", unidad: "°C", key: "tSalidaAgua" },
  { tipo: "auto", label: "∆ Temperatura de agua", unidad: "°C", calc: "dTagua" },
  { tipo: "val", label: "Presion de entrada de agua", unidad: "PSI", key: "presEntradaAgua" },
  { tipo: "val", label: "Presion de salida de agua", unidad: "PSI", key: "presSalidaAgua" },
  { tipo: "auto", label: "∆ Presion de agua", unidad: "PSI", calc: "dPagua" },
  { tipo: "val", label: "Temperatura de retorno de aire", unidad: "°C", key: "tRetornoAire" },
  { tipo: "val", label: "Temperatura de suministro de aire", unidad: "°C", key: "tSuministroAire" },
  { tipo: "auto", label: "∆ Temperatura de aire", unidad: "°C", calc: "dTaire" },
];
// Columna derecha: ítems con Estatus (OK / Observado / Falla / N/A)
const FANCOIL_ITEMS_DER = [
  "Balance de caudal de aire", "Estado válvula agua helada", "Aislamiento térmico",
  "Estado de llave termomagnética", "Estado de contactores", "Funcionamiento de dampers",
  "Velocidad motores ventiladores", "Sensor de suministros de aire", "Sensor de diferencial de presión",
  "Sensor de arranque y parada", "Sensor de temperatura ambiente", "Limpieza de contactos",
  "Lubricación de motores", "Lubricación de chumaceras", "Templado de fajas",
  "Alineamiento de poleas", "Estado de impulsor de aire", "Limpieza de filtros de aire",
  "Limpieza bandeja de condesado", "Lavado de coil",
];

// ============ ÍTEMS ESTATUS EXPANSIÓN DIRECTA ============
const EXPANSION_ITEMS_DER = [
  "Descarte visual de fugas de refrigerante",
  "Limpieza de serpentín condensador",
  "Limpieza externa condensador",
  "Ajuste de terminales eléctricos de compresores y motores",
  "Ajuste de terminales eléctricos de contactores y borneras",
  "Limpieza de difusores y rejillas",
  "Comprobación de eficiencia de filtros secadores",
  "Verificación de operación del sistema de control termostato y tarjetas",
  "Pintado de impulsores, bases y soportes",
];

// ============ ÍTEMS ESTATUS VENTILACIÓN ============
const VENTILACION_ITEMS_DER = [
  "Verificación de funcionamiento",
  "Ajuste y limpieza de impulsores de aire",
  "Revisión y templado de fajas",
  "Ajuste de pernos de anclaje y elementos antivibratorios",
  "Prueba del normal funcionamiento de tableros de arranque",
  "Limpieza de filtros de aire",
  "Lubricación de bocinas y rodamientos(s)",
  "Pintado de impulsores de aire",
  "Lubricación de chumaceras(s)",
  "Medición de caudal de aire",
  "Revisión de rodamientos del motor(s)",
  "Desmontaje parcial y limpieza de los motores eléctricos(s)",
  "Pintura de estructura(s)",
];

export default function Protocolo() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const equipoId = searchParams.get("equipo");
  const origen = searchParams.get("origen");
  const origenSede = searchParams.get("sede");

  const handleVolver = () => {
    if (origen === "cliente") {
      if (origenSede) {
        navigate(`/cliente?sede=${origenSede}`);
      } else {
        navigate("/cliente");
      }
    } else {
      navigate(-1);
    }
  };
  const [equipo, setEquipo] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [protocolos, setProtocolos] = useState([]); // historial (máx 10)
  const [indexActual, setIndexActual] = useState(0);
  const [form, setForm] = useState(null);
  const [soloLectura, setSoloLectura] = useState(false); // true = cliente (solo ve)
  const [esPub, setEsPub] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [pdfGenerado, setPdfGenerado] = useState(false);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      if (user && equipoId) {
        // Detectar rol: si NO es superadmin ni admin, es cliente (solo lectura)
        let esLectura = true;
        try {
          const snapUser = await getDoc(doc(db, "usuarios", user.uid));
          if (snapUser.exists()) {
            const u = snapUser.data();
            const esAdmin = u.superadmin === true || u.rol === "admin";
            esLectura = !esAdmin;
          }
        } catch {
          esLectura = true;
        }
        setEsPub(false);
        setAuthChecked(true);
        setSoloLectura(esLectura);
        cargarEquipo(esLectura);
      } else if (equipoId) {
        // Acceso público (QR escaneado sin sesión): solo lectura, mostrar/abrir PDF
        setEsPub(true);
        setAuthChecked(true);
        setSoloLectura(true);
        cargarEquipo(true);
      }
    });
    return () => unsub();
  }, [equipoId]);

  // Si es acceso público, generar y abrir el PDF automáticamente
  useEffect(() => {
    if (authChecked && esPub && equipo && form && !cargando && !pdfGenerado) {
      setPdfGenerado(true);
      exportarPDF("ver");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecked, esPub, equipo, form, cargando, pdfGenerado]);

  const cargarEquipo = async (esLectura = false) => {
    const ref = doc(db, "equipos", equipoId);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data();
      setEquipo({ id: equipoId, ...data });
      const grupo = GRUPO_POR_TIPO[data.tipoEquipo] || "expansion";
      const historial = data.protocolos || [];
      if (historial.length > 0) {
        setProtocolos(historial);
        // Rellenar campos nuevos de placa si el protocolo fue guardado antes de que existieran
        const prot = { ...historial[0] };
        if (!prot.vPlacaL1L2 && data.voltaje) { prot.vPlacaL1L2 = data.voltaje; prot.vPlacaL2L3 = data.voltaje; prot.vPlacaL3L1 = data.voltaje; }
        if (!prot.aPlacaL1 && data.amperaje) { prot.aPlacaL1 = data.amperaje; prot.aPlacaL2 = data.amperaje; prot.aPlacaL3 = data.amperaje; }
        setForm(prot);
        setIndexActual(0);
      } else {
        setProtocolos([]);
        if (!esLectura) {
          const nuevo = protocoloVacio(grupo);
          nuevo.observaciones = obsDesFicha(data);
          nuevo.estadoFinal = data.estado || "Operativo";
          // Auto-copiar voltaje y amperaje de placa desde la ficha del equipo
          if (data.voltaje) {
            nuevo.vPlacaL1L2 = data.voltaje;
            nuevo.vPlacaL2L3 = data.voltaje;
            nuevo.vPlacaL3L1 = data.voltaje;
          }
          if (data.amperaje) {
            nuevo.aPlacaL1 = data.amperaje;
            nuevo.aPlacaL2 = data.amperaje;
            nuevo.aPlacaL3 = data.amperaje;
          }
          setForm(nuevo);
        } else {
          setForm(null);
        }
        setIndexActual(-1);
      }
    }
    setCargando(false);
  };

  const set = (campo, valor) => setForm(prev => ({ ...prev, [campo]: valor }));

  const setActividad = (item, val) => setForm(prev => ({
    ...prev, actividades: { ...prev.actividades, [item]: val }
  }));

  const setEstatus = (item, val) => setForm(prev => ({
    ...prev, estatusItems: { ...(prev.estatusItems || {}), [item]: val }
  }));

  // Observaciones dinámicas
  const addObs = () => setForm(prev => ({ ...prev, observaciones: [...prev.observaciones, { obs: "", causa: "", rec: "" }] }));
  const removeObs = (i) => setForm(prev => ({ ...prev, observaciones: prev.observaciones.filter((_, idx) => idx !== i) }));
  const updateObs = (i, campo, val) => setForm(prev => {
    const n = [...prev.observaciones];
    n[i] = { ...n[i], [campo]: val };
    return { ...prev, observaciones: n };
  });

  const nuevoProtocolo = () => {
    if (protocolos.length >= 10) {
      alert("Máximo 10 protocolos por equipo. Elimina uno antiguo para crear uno nuevo.");
      return;
    }
    const grupo = GRUPO_POR_TIPO[equipo.tipoEquipo] || "expansion";
    const nuevo = protocoloVacio(grupo);
    nuevo.observaciones = obsDesFicha(equipo);
    nuevo.estadoFinal = equipo.estado || "Operativo";
    setForm(nuevo);
    setIndexActual(-1);
  };

  const seleccionarProtocolo = (i) => {
    setForm(protocolos[i]);
    setIndexActual(i);
  };

  const guardar = async () => {
    setGuardando(true);
    try {
      let nuevos;
      if (indexActual === -1) {
        nuevos = [form, ...protocolos].slice(0, 10);
      } else {
        nuevos = [...protocolos];
        nuevos[indexActual] = form;
      }

      // Sincronizar observaciones, recomendaciones y estado con la ficha del equipo
      const obsSync = form.observaciones
        .filter(o => o.obs?.trim())
        .map(o => ({ texto: o.obs, causa: o.causa || "", rec: o.rec || "", fecha: form.fecha, tecnico: form.tecnico }));

      const recSync = form.observaciones
        .filter(o => o.rec?.trim())
        .map(o => o.rec);

      await updateDoc(doc(db, "equipos", equipoId), {
        protocolos: nuevos,
        // Sincronizar con ficha
        observacionesArray: obsSync.map(o => ({ texto: o.texto, fecha: o.fecha, tecnico: o.tecnico, causa: o.causa })),
        observaciones: obsSync.map(o => o.texto).join("\n"),
        recomendacionesArray: recSync,
        recomendaciones: recSync.join("\n"),
        estado: form.estadoFinal,
        ultimoMantenimiento: form.fecha,
        ultimoProtocolo: form.fecha,
        ultimoTecnico: form.tecnico,
      });

      setProtocolos(nuevos);
      setIndexActual(indexActual === -1 ? 0 : indexActual);
      alert("Protocolo guardado y ficha del equipo actualizada ✅");
    } catch (err) {
      alert("Error al guardar: " + err.message);
    }
    setGuardando(false);
  };

  const eliminarProtocolo = async (i) => {
    if (!window.confirm("¿Eliminar este protocolo? No se puede deshacer.")) return;
    const nuevos = protocolos.filter((_, idx) => idx !== i);
    await updateDoc(doc(db, "equipos", equipoId), { protocolos: nuevos });
    setProtocolos(nuevos);
    if (nuevos.length > 0) { setForm(nuevos[0]); setIndexActual(0); }
    else nuevoProtocolo();
  };

  // ===== REPORTE EXPANSIÓN DIRECTA =====
  const exportarPDFExpansion = async (modo = "descargar") => {
    if (!equipo || !form) return;
    const pdf = new jsPDF("p", "mm", "a4");
    const W = 210, M = 10, C = W - M * 2;
    let y = 10;
    const RH = 5.5;
    const half = C / 2;

    const cv = (calc) => {
      if (calc === "desbV") return calcDesbalance(form.vL1L2, form.vL2L3, form.vL3L1) || "";
      if (calc === "desbA") return calcDesbalance(form.aL1, form.aL2, form.aL3) || "";
      return "";
    };

    const cell = (x, y2, w, h, txt, opts = {}) => {
      pdf.setDrawColor(0); pdf.rect(x, y2, w, h);
      if (txt !== undefined && txt !== null && txt !== "") {
        pdf.setFont("helvetica", opts.bold ? "bold" : "normal");
        pdf.setFontSize(opts.sz || 7); pdf.setTextColor(0);
        const lines = pdf.splitTextToSize(String(txt), w - 1.5);
        const ty = y2 + h / 2 + (opts.sz || 7) * 0.18;
        if (opts.center) lines.forEach((l, i) => pdf.text(l, x + w / 2, ty + i * (opts.sz || 7) * 0.4, { align: "center" }));
        else lines.forEach((l, i) => pdf.text(l, x + 1, ty + i * (opts.sz || 7) * 0.4));
      }
    };

    // Encabezado empresa
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(8); pdf.setTextColor(0);
    pdf.text(equipo.cliente || "", W - M, y + 2, { align: "right" });
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(6.5);
    pdf.text(equipo.sede || "", W - M, y + 6, { align: "right" });
    y += 14;

    // Título
    pdf.rect(M, y, C, 7);
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(9); pdf.setTextColor(0);
    pdf.text("REPORTE DE MANTENIMIENTO DE EXPANSION DIRECTA", W / 2, y + 5, { align: "center" });
    y += 7;

    // Filas encabezado: 6 filas x 2 columnas
    const lw = C * 0.22, vw = half - lw;
    const infoRows = [
      ["CLIENTE", equipo.cliente || "", "N\xB0 SERIE", equipo.serie || ""],
      ["CONTRATO", equipo.contrato || form.contrato || "", "CAPACIDAD", equipo.capacidad ? equipo.capacidad + " BTU" : ""],
      ["EQUIPO N\xB0", equipo.codigo || equipo.fancoilNum || "", "MODELO DE COMPRESOR", equipo.modeloCompresor || form.modeloCompresor || ""],
      ["MARCA", equipo.marca || "", "TECNICO RESPONSABLE", form.tecnico || ""],
      ["MODELO", equipo.modelo || "", "FECHA", form.fecha || ""],
    ];
    infoRows.forEach(([l1, v1, l2, v2]) => {
      cell(M, y, lw, RH, l1, { sz: 6.5 });
      cell(M + lw, y, vw, RH, v1, { sz: 6.5 });
      cell(M + half, y, lw, RH, l2, { sz: 6.5 });
      cell(M + half + lw, y, vw, RH, v2, { sz: 6.5 });
      y += RH;
    });

    // Header PARAMETROS
    const pH = 5;
    pdf.setFillColor(220, 220, 220);
    pdf.rect(M, y, half, pH, "FD"); pdf.rect(M + half, y, half, pH, "FD");
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(8); pdf.setTextColor(0);
    pdf.text("PARAMETROS — EVAPORADOR", M + half / 2, y + 3.5, { align: "center" });
    pdf.text("PARAMETROS — CONDENSADOR", M + half + half / 2, y + 3.5, { align: "center" });
    y += pH;

    // Proporciones tabla izquierda
    const LW = half, RW = half;
    const LX = M, RX = M + half;
    const NW = LW * 0.44, SW = LW * 0.16, UW = LW * 0.09;
    const VTW = LW * 0.31; // area total de valores
    const RH2 = 5.5;
    const esMono = equipo?.fases === "Monof\u00e1sico";

    // Función helper fila electrica
    const drawElecRow = (ry, nm, un, vals, hds, placa) => {
      if (placa) { pdf.setFillColor(240, 244, 248); pdf.rect(LX, ry, LW, RH2, "F"); }
      pdf.setDrawColor(0); pdf.rect(LX, ry, LW, RH2);
      const nameW = NW + SW;
      const valX = LX + nameW + UW;
      const cw = VTW / vals.length;
      pdf.line(LX + nameW, ry, LX + nameW, ry + RH2);
      pdf.line(valX, ry, valX, ry + RH2);
      for (let k = 1; k < vals.length; k++) pdf.line(valX + k * cw, ry, valX + k * cw, ry + RH2);
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(6.5);
      pdf.setTextColor(placa ? 90 : 0, placa ? 90 : 0, placa ? 90 : 0);
      pdf.splitTextToSize(nm, nameW - 1.5).forEach((l, li) => pdf.text(l, LX + 1, ry + 3.2 + li * 2.5));
      pdf.setFontSize(6.5); pdf.setTextColor(20, 20, 20);
      pdf.text(un, LX + nameW + UW / 2, ry + 3.5, { align: "center" });
      hds.forEach((h, hi) => {
        pdf.setFont("helvetica", "normal"); pdf.setFontSize(5); pdf.setTextColor(100, 100, 100);
        pdf.text(h, valX + hi * cw + cw / 2, ry + 1.8, { align: "center" });
      });
      vals.forEach((v, vi) => {
        pdf.setFont("helvetica", "bold"); pdf.setFontSize(7);
        pdf.setTextColor(placa ? 80 : 0, placa ? 80 : 0, placa ? 80 : 0);
        pdf.text(String(v || ""), valX + vi * cw + cw / 2, ry + 4.2, { align: "center" });
      });
    };

    const drawSimpleRow = (ry, nm, sub, un, val, placa) => {
      if (placa) { pdf.setFillColor(240, 244, 248); pdf.rect(LX, ry, LW, RH2, "F"); }
      pdf.setDrawColor(0); pdf.rect(LX, ry, LW, RH2);
      if (sub) { pdf.line(LX + NW, ry, LX + NW, ry + RH2); }
      pdf.line(LX + NW + SW, ry, LX + NW + SW, ry + RH2);
      pdf.line(LX + NW + SW + UW, ry, LX + NW + SW + UW, ry + RH2);
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(6.5); pdf.setTextColor(0);
      pdf.splitTextToSize(nm, (sub ? NW : NW + SW) - 1.5).forEach((l, li) => pdf.text(l, LX + 1, ry + 3.2 + li * 2.5));
      if (sub) { pdf.setFontSize(5.5); pdf.setTextColor(60); sub.split("\n").forEach((sl, si) => pdf.text(sl, LX + NW + 0.5, ry + 2.5 + si * 2.2)); }
      pdf.setFontSize(6.5); pdf.setTextColor(20);
      pdf.text(un, LX + NW + SW + UW / 2, ry + 3.5, { align: "center" });
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(7); pdf.setTextColor(0);
      pdf.text(String(val || ""), LX + LW - 1, ry + 3.5, { align: "right" });
    };

    const drawEstatus = (ry, nm, est, isRight) => {
      const X = isRight ? RX : LX;
      const W2 = isRight ? RW : LW;
      const DNR = W2 * 0.72, DER = W2 * 0.28;
      pdf.setDrawColor(0); pdf.rect(X, ry, W2, RH2);
      pdf.line(X + DNR, ry, X + DNR, ry + RH2);
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(6.5); pdf.setTextColor(0);
      const t = pdf.splitTextToSize(nm, DNR - 1.5)[0];
      pdf.text(t, X + 1, ry + 3.5);
      pdf.setFontSize(6); pdf.setTextColor(80);
      pdf.text("Estatus", X + DNR + DER / 2, ry + 2, { align: "center" });
      if (est) {
        const ec = est === "OK" ? [46,125,50] : est === "Falla" ? [198,40,40] : est === "Observado" ? [230,81,0] : [80,80,80];
        pdf.setFont("helvetica", "bold"); pdf.setFontSize(7); pdf.setTextColor(...ec);
        pdf.text(String(est), X + DNR + DER / 2, ry + 4.5, { align: "center" });
      }
    };

    const getEst = (item) => (form.estatusItems || {})[item] || "";

    // Sección EVAPORADOR izquierda + CONDENSADOR derecha (etiqueta vertical)
    // Construir filas lado izquierdo (evaporador)
    const vHds = esMono ? ["L1-L2"] : ["L1-L2","L2-L3","L3-L1"];
    const vVals = esMono ? [form.vL1L2||""] : [form.vL1L2||"",form.vL2L3||"",form.vL3L1||""];
    const vPlaca = esMono ? [equipo?.voltaje||""] : [equipo?.voltaje||"",equipo?.voltaje||"",equipo?.voltaje||""];
    const aHds = esMono ? ["L1","L2"] : ["L1","L2","L3"];
    const aVals = esMono ? [form.aL1||"",form.aL2||""] : [form.aL1||"",form.aL2||"",form.aL3||""];
    const aPlaca = esMono ? [equipo?.amperaje||"",equipo?.amperaje||""] : [equipo?.amperaje||"",equipo?.amperaje||"",equipo?.amperaje||""];
    const condVPlaca = esMono ? [equipo?.condVoltaje||equipo?.voltaje||""] : [equipo?.condVoltaje||equipo?.voltaje||"",equipo?.condVoltaje||equipo?.voltaje||"",equipo?.condVoltaje||equipo?.voltaje||""];
    const condAPlaca = esMono ? [equipo?.condAmperaje||equipo?.amperaje||"",equipo?.condAmperaje||equipo?.amperaje||""] : [equipo?.condAmperaje||equipo?.amperaje||"",equipo?.condAmperaje||equipo?.amperaje||"",equipo?.condAmperaje||equipo?.amperaje||""];
    const condVVals = esMono ? [form.condVL1L2||""] : [form.condVL1L2||"",form.condVL2L3||"",form.condVL3L1||""];
    const condAVals = esMono ? [form.condAL1||"",form.condAL2||""] : [form.condAL1||"",form.condAL2||"",form.condAL3||""];

    const rowsIzq = [
      { type: "estL", nm: "Limpieza de filtros de aire" },
      { type: "estL", nm: "Limpieza de bandeja de drenaje" },
      { type: "estL", nm: "Limpieza de serpentín evaporador" },
      { type: "elec", nm: "Voltaje en marcha", un: "V", vals: vVals, hds: vHds, placa: false },
      { type: "elec", nm: "Voltaje en placa", un: "V", vals: vPlaca, hds: vHds, placa: true },
      { type: "simple", nm: "Desbalance de voltaje", un: "%", val: cv("desbV") },
      { type: "elec", nm: "Amperaje en marcha", un: "A", vals: aVals, hds: aHds, placa: false },
      { type: "elec", nm: "Amperaje en placa", un: "A", vals: aPlaca, hds: aHds, placa: true },
      { type: "simple", nm: "Desbalance de voltaje", un: "%", val: cv("desbA") },
      { type: "simple", nm: "MEGADO", sub: "L1-T", un: "\u03A9", val: form.megL1T||"" },
      { type: "simple", nm: "", sub: "L2-T", un: "\u03A9", val: form.megL2T||"" },
      { type: "simple", nm: "", sub: "L3-T", un: "\u03A9", val: form.megL3T||"" },
      { type: "simple", nm: "", sub: "L1-L2", un: "\u03A9", val: form.megL1L2||"" },
      { type: "simple", nm: "", sub: "L2-L3", un: "\u03A9", val: form.megL2L3||"" },
      { type: "simple", nm: "", sub: "L3-L1", un: "\u03A9", val: form.megL3L1||"" },
    ];

    const rowsDer = [
      { type: "estR", nm: "Descarte visual de fugas de refrigerante" },
      { type: "estR", nm: "Limpieza de serpentín condensador" },
      { type: "estR", nm: "Limpieza externa condensador" },
      { type: "elecR", nm: "Voltaje en marcha", un: "V", vals: condVVals, hds: vHds, placa: false },
      { type: "elecR", nm: "Voltaje en placa", un: "V", vals: condVPlaca, hds: vHds, placa: true },
      { type: "simpleR", nm: "Desbalance de voltaje", un: "%", val: calcDesbalance(form.condVL1L2,form.condVL2L3,form.condVL3L1)||"" },
      { type: "elecR", nm: "Amperaje en marcha", un: "A", vals: condAVals, hds: aHds, placa: false },
      { type: "elecR", nm: "Amperaje en placa", un: "A", vals: condAPlaca, hds: aHds, placa: true },
      { type: "simpleR", nm: "Desbalance de amperaje", un: "%", val: calcDesbalance(form.condAL1,form.condAL2,form.condAL3)||"" },
      { type: "simpleR", nm: "MEGADO", sub: "L1-T", un: "\u03A9", val: form.condMegL1T||"" },
      { type: "simpleR", nm: "", sub: "L2-T", un: "\u03A9", val: form.condMegL2T||"" },
      { type: "simpleR", nm: "", sub: "L3-T", un: "\u03A9", val: form.condMegL3T||"" },
      { type: "simpleR", nm: "", sub: "L1-L2", un: "\u03A9", val: form.condMegL1L2||"" },
      { type: "simpleR", nm: "", sub: "L2-L3", un: "\u03A9", val: form.condMegL2L3||"" },
      { type: "simpleR", nm: "", sub: "L3-L1", un: "\u03A9", val: form.condMegL3L1||"" },
    ];

    // Segunda sección: filas izquierda con parámetros refrigeración + estatus actividades der
    const rowsIzq2 = [
      { type: "simple", nm: "Temperatura de motor", un: "\xB0C", val: form.tTrabajoMotor||"" },
      { type: "estatus", nm: "Calentador de aceite", item: "Calentador de aceite" },
    ];

    const rowsDer2 = [
      { nm: "Presion de succion", un: "PSI", val: form.presSuccion||"" },
      { nm: "Presion de liquido", un: "PSI", val: form.presLiquido||"" },
      { nm: "T\xB0 saturaci\xF3n succi\xF3n (medida)", un: "\xB0C", val: form.tSatMedida||"" },
      { nm: "T\xB0 saturaci\xF3n succi\xF3n (tabla)", un: "\xB0C", val: form.tSatTabla||"" },
      { nm: "Superheat", un: "\xB0C", val: calcDelta(form.tSatMedida, form.tSatTabla)||"" },
      { nm: "T\xB0 suministro aire evaporador", un: "\xB0C", val: form.tSuministroEvap||"" },
      { nm: "T\xB0 retorno aire evaporador", un: "\xB0C", val: form.tRetornoEvap||"" },
      { nm: "T\xB0 ambiente condensador", un: "\xB0C", val: form.tAmbCondensador||"" },
      ...EXPANSION_ITEMS_DER.map(item => ({ nm: item, isEst: true, item })),
    ];

    const yT = y;
    const nR1 = Math.max(rowsIzq.length, rowsDer.length);

    // Etiquetas verticales EVAPORADOR / CONDENSADOR
    const evapH = rowsIzq.length * RH2;
    const condH = rowsDer.length * RH2;
    const labelW = 5;

    // Dibujar sección 1
    for (let i = 0; i < nR1; i++) {
      const ry = yT + i * RH2;
      const rL = rowsIzq[i];
      const rR = rowsDer[i];

      // Izquierda
      if (rL) {
        if (rL.type === "estL") {
          drawEstatus(ry, rL.nm, getEst(rL.nm), false);
        } else if (rL.type === "elec") {
          drawElecRow(ry, rL.nm, rL.un, rL.vals, rL.hds, rL.placa);
        } else if (rL.type === "simple") {
          drawSimpleRow(ry, rL.nm, rL.sub, rL.un, rL.val, false);
        }
      } else { pdf.setDrawColor(0); pdf.rect(LX, ry, LW, RH2); }

      // Derecha
      if (rR) {
        if (rR.type === "estR") {
          drawEstatus(ry, rR.nm, getEst(rR.nm), true);
        } else if (rR.type === "elecR") {
          // misma funcion pero en RX
          const X = RX, W2 = RW;
          if (rR.placa) { pdf.setFillColor(240, 244, 248); pdf.rect(X, ry, W2, RH2, "F"); }
          pdf.setDrawColor(0); pdf.rect(X, ry, W2, RH2);
          const nameW = NW + SW;
          const valX2 = X + nameW + UW;
          const cw2 = VTW / rR.vals.length;
          pdf.line(X + nameW, ry, X + nameW, ry + RH2);
          pdf.line(valX2, ry, valX2, ry + RH2);
          for (let k = 1; k < rR.vals.length; k++) pdf.line(valX2 + k * cw2, ry, valX2 + k * cw2, ry + RH2);
          pdf.setFont("helvetica", "normal"); pdf.setFontSize(6.5);
          pdf.setTextColor(rR.placa ? 90 : 0, rR.placa ? 90 : 0, rR.placa ? 90 : 0);
          pdf.splitTextToSize(rR.nm, nameW - 1.5).forEach((l, li) => pdf.text(l, X + 1, ry + 3.2 + li * 2.5));
          pdf.setFontSize(6.5); pdf.setTextColor(20);
          pdf.text(rR.un, X + nameW + UW / 2, ry + 3.5, { align: "center" });
          rR.hds.forEach((h, hi) => {
            pdf.setFont("helvetica", "normal"); pdf.setFontSize(5); pdf.setTextColor(100);
            pdf.text(h, valX2 + hi * cw2 + cw2 / 2, ry + 1.8, { align: "center" });
          });
          rR.vals.forEach((v, vi) => {
            pdf.setFont("helvetica", "bold"); pdf.setFontSize(7);
            pdf.setTextColor(rR.placa ? 80 : 0, rR.placa ? 80 : 0, rR.placa ? 80 : 0);
            pdf.text(String(v || ""), valX2 + vi * cw2 + cw2 / 2, ry + 4.2, { align: "center" });
          });
        } else if (rR.type === "simpleR") {
          // fila simple en lado derecho
          const X = RX;
          pdf.setDrawColor(0); pdf.rect(X, ry, RW, RH2);
          if (rR.sub) pdf.line(X + NW, ry, X + NW, ry + RH2);
          pdf.line(X + NW + SW, ry, X + NW + SW, ry + RH2);
          pdf.line(X + NW + SW + UW, ry, X + NW + SW + UW, ry + RH2);
          pdf.setFont("helvetica", "normal"); pdf.setFontSize(6.5); pdf.setTextColor(0);
          pdf.splitTextToSize(rR.nm, (rR.sub ? NW : NW + SW) - 1.5).forEach((l, li) => pdf.text(l, X + 1, ry + 3.2 + li * 2.5));
          if (rR.sub) { pdf.setFontSize(5.5); pdf.setTextColor(60); rR.sub.split("\n").forEach((sl, si) => pdf.text(sl, X + NW + 0.5, ry + 2.5 + si * 2.2)); }
          pdf.setFontSize(6.5); pdf.setTextColor(20);
          pdf.text(rR.un, X + NW + SW + UW / 2, ry + 3.5, { align: "center" });
          if (rR.val !== undefined && rR.val !== "") {
            pdf.setFont("helvetica", "bold"); pdf.setFontSize(7); pdf.setTextColor(0);
            pdf.text(String(rR.val), X + RW - 1, ry + 3.5, { align: "right" });
          }
        }
      } else { pdf.setDrawColor(0); pdf.rect(RX, ry, RW, RH2); }
    }

    y = yT + nR1 * RH2;

    // Sección 2: izq2 + der2
    const nR2 = Math.max(rowsIzq2.length, rowsDer2.length);
    const yT2 = y;

    for (let i = 0; i < nR2; i++) {
      const ry = yT2 + i * RH2;
      const rL = rowsIzq2[i];
      const rR2 = rowsDer2[i];

      if (rL) {
        if (rL.type === "elec") {
          drawElecRow(ry, rL.nm, rL.un, rL.vals, rL.hds, rL.placa);
        } else if (rL.type === "simple") {
          drawSimpleRow(ry, rL.nm, rL.sub, rL.un, rL.val, false);
        } else if (rL.type === "estatus") {
          drawEstatus(ry, rL.nm, getEst(rL.item), false);
        }
      } else { pdf.setDrawColor(0); pdf.rect(LX, ry, LW, RH2); }

      if (rR2) {
        const X = RX;
        const NWR = RW * 0.7, UWR = RW * 0.15, VWR = RW * 0.15;
        pdf.setDrawColor(0); pdf.rect(X, ry, RW, RH2);
        pdf.line(X + NWR, ry, X + NWR, ry + RH2);
        pdf.line(X + NWR + UWR, ry, X + NWR + UWR, ry + RH2);
        pdf.setFont("helvetica", "normal"); pdf.setFontSize(6.5); pdf.setTextColor(0);
        pdf.splitTextToSize(rR2.nm, NWR - 1.5).forEach((l, li) => pdf.text(l, X + 1, ry + 3.2 + li * 2.5));
        if (rR2.isEst) {
          pdf.setFontSize(6); pdf.setTextColor(80);
          pdf.text("Estatus", X + NWR + UWR / 2, ry + 2, { align: "center" });
          const est = getEst(rR2.item);
          if (est) {
            const ec = est === "OK" ? [46,125,50] : est === "Falla" ? [198,40,40] : est === "Observado" ? [230,81,0] : [80,80,80];
            pdf.setFont("helvetica", "bold"); pdf.setFontSize(7); pdf.setTextColor(...ec);
            pdf.text(String(est), X + NWR + UWR + VWR / 2, ry + 3.5, { align: "center" });
          }
        } else {
          pdf.setFontSize(6.5); pdf.setTextColor(20);
          pdf.text(rR2.un, X + NWR + UWR / 2, ry + 3.5, { align: "center" });
          pdf.setFont("helvetica", "bold"); pdf.setFontSize(7); pdf.setTextColor(0);
          pdf.text(String(rR2.val || ""), X + RW - 1, ry + 3.5, { align: "right" });
        }
      } else { pdf.setDrawColor(0); pdf.rect(RX, ry, RW, RH2); }
    }

    y = yT2 + nR2 * RH2 + 4;

    // Tabla OCR
    const obsValidas = form.observaciones.filter(o => o.obs?.trim());
    const numObs = Math.max(obsValidas.length, 9);
    const oH = 10, col0 = 10, col1 = 60, col2 = 60, col3 = C - col0 - col1 - col2;
    // Encabezado OCR - reset completo de colores
    pdf.setDrawColor(0); pdf.setTextColor(0, 0, 0);
    ["ITEM","OBSERVACION","CAUSA","RECOMENDACI\xD3N"].forEach((t, ti) => {
      const xc = [M, M+col0, M+col0+col1, M+col0+col1+col2][ti];
      const wc = [col0,col1,col2,col3][ti];
      pdf.setFillColor(220, 220, 220);
      pdf.setDrawColor(0);
      pdf.rect(xc, y, wc, oH*0.7, "FD");
      pdf.setFont("helvetica","bold"); pdf.setFontSize(7); pdf.setTextColor(0,0,0);
      pdf.text(t, xc + wc/2, y + oH*0.5, { align: "center" });
    });
    y += oH * 0.7;
    for (let i = 0; i < numObs; i++) {
      const o = obsValidas[i];
      pdf.setDrawColor(0); pdf.setTextColor(0,0,0);
      pdf.rect(M, y, col0, oH); pdf.setFont("helvetica","normal"); pdf.setFontSize(7);
      pdf.text(String(i+1), M+col0/2, y+6, { align: "center" });
      pdf.rect(M+col0, y, col1, oH);
      if (o?.obs) { const t = pdf.splitTextToSize(o.obs, col1-2); pdf.text(t.slice(0,3), M+col0+1, y+4); }
      pdf.rect(M+col0+col1, y, col2, oH);
      if (o?.causa) { const t = pdf.splitTextToSize(o.causa, col2-2); pdf.text(t.slice(0,3), M+col0+col1+1, y+4); }
      pdf.rect(M+col0+col1+col2, y, col3, oH);
      if (o?.rec) { const t = pdf.splitTextToSize(o.rec, col3-2); pdf.text(t.slice(0,3), M+col0+col1+col2+1, y+4); }
      y += oH;
    }

    const nombre = `reporte-expansion-${equipo.cliente?.replace(/\s+/g,"-")}-${form.fecha}.pdf`;
    if (modo === "ver") { const blob = pdf.output("blob"); const url = URL.createObjectURL(blob); window.open(url,"_blank") || (window.location.href = url); }
    else pdf.save(nombre);
  };

  // ===== REPORTE VENTILACIÓN =====
  const exportarPDFVentilacion = async (modo = "descargar") => {
    if (!equipo || !form) return;
    const pdf = new jsPDF("p", "mm", "a4");
    const W = 210, M = 10, C = W - M * 2;
    let y = 10;
    const RH = 5.5, half = C / 2;

    const cv = (calc) => {
      if (calc === "desbV") return calcDesbalance(form.vL1L2, form.vL2L3, form.vL3L1) || "";
      if (calc === "desbA") return calcDesbalance(form.aL1, form.aL2, form.aL3) || "";
      return "";
    };

    const cell = (x, y2, w, h, txt, opts = {}) => {
      pdf.setDrawColor(0); pdf.rect(x, y2, w, h);
      if (txt !== undefined && txt !== null && txt !== "") {
        pdf.setFont("helvetica", opts.bold ? "bold" : "normal");
        pdf.setFontSize(opts.sz || 7); pdf.setTextColor(0);
        const lines = pdf.splitTextToSize(String(txt), w - 1.5);
        const ty = y2 + h / 2 + (opts.sz || 7) * 0.18;
        if (opts.center) lines.forEach((l, i) => pdf.text(l, x + w/2, ty + i*(opts.sz||7)*0.4, {align:"center"}));
        else lines.forEach((l, i) => pdf.text(l, x + 1, ty + i*(opts.sz||7)*0.4));
      }
    };

    // Encabezado
    pdf.setFont("helvetica","bold"); pdf.setFontSize(8); pdf.setTextColor(0);
    pdf.text(equipo.cliente || "", W-M, y+2, {align:"right"});
    pdf.setFont("helvetica","normal"); pdf.setFontSize(6.5);
    pdf.text(equipo.sede || "", W-M, y+6, {align:"right"});
    y += 14;

    // Título
    pdf.rect(M, y, C, 7);
    pdf.setFont("helvetica","bold"); pdf.setFontSize(9); pdf.setTextColor(0);
    pdf.text("REPORTE DE MANTENIMIENTO DE INYECTORES/EXTRACTORES DE AIRE", W/2, y+5, {align:"center"});
    y += 7;

    // Filas encabezado 8 filas x 2 columnas
    const lw = C * 0.22, vw = half - lw;
    const infoRows = [
      ["CLIENTE", equipo.cliente||"", "MARCA DE VENTILADOR", equipo.marca||""],
      ["CONTRATO", equipo.contrato||form.contrato||"", "MODELO DE VENTILADOR", equipo.modelo||""],
      ["VENTILADOR N\xB0", equipo.codigo||equipo.fancoilNum||"", "N\xB0 DE SERIE DE VENTILADOR", equipo.serie||""],
      ["TIPO DE VENTILADOR", equipo.tipoEquipo||"", "MARCA DE MOTOR", equipo.marcaMotor||form.marcaMotor||""],
      ["MODELO DE FAJA", equipo.modeloFaja||form.modeloFaja||"", "MODELO DE MOTOR", equipo.modeloMotor||form.modeloMotor||""],
      ["NUMERO DE FAJAS", equipo.numFajas||form.numFajas||"", "N\xB0 DE SERIE DE MOTOR", equipo.serieMotor||form.serieMotor||""],
      ["TECNICO RESPONSABLE", form.tecnico||"", "FECHA", form.fecha||""],
    ];
    infoRows.forEach(([l1,v1,l2,v2]) => {
      cell(M, y, lw, RH, l1, {sz:6.5}); cell(M+lw, y, vw, RH, v1, {sz:6.5});
      cell(M+half, y, lw, RH, l2, {sz:6.5}); cell(M+half+lw, y, vw, RH, v2, {sz:6.5});
      y += RH;
    });

    // Header PARAMETROS
    const pH = 5;
    pdf.setFillColor(220,220,220);
    pdf.rect(M, y, half, pH, "FD"); pdf.rect(M+half, y, half, pH, "FD");
    pdf.setFont("helvetica","bold"); pdf.setFontSize(8); pdf.setTextColor(0);
    pdf.text("PARAMETROS — COMPRESOR / ELÉCTRICO", M+half/2, y+3.5, {align:"center"});
    pdf.text("PARAMETROS — REFRIGERACIÓN / ACTIVIDADES", M+half+half/2, y+3.5, {align:"center"});
    y += pH;

    const LW = half, RW = half, LX = M, RX = M+half;
    const NW = LW*0.44, SW = LW*0.16, UW = LW*0.09, VTW = LW*0.31;
    const RH2 = 5.5;
    const esMono = equipo?.fases === "Monof\u00e1sico";

    const vHds = esMono ? ["L1-L2"] : ["L1-L2","L2-L3","L3-L1"];
    const vVals = esMono ? [form.vL1L2||""] : [form.vL1L2||"",form.vL2L3||"",form.vL3L1||""];
    const vPlaca = esMono ? [equipo?.voltaje||""] : [equipo?.voltaje||"",equipo?.voltaje||"",equipo?.voltaje||""];
    const aHds = esMono ? ["L1","L2"] : ["L1","L2","L3"];
    const aVals = esMono ? [form.aL1||"",form.aL2||""] : [form.aL1||"",form.aL2||"",form.aL3||""];
    const aPlaca = esMono ? [equipo?.amperaje||"",equipo?.amperaje||""] : [equipo?.amperaje||"",equipo?.amperaje||"",equipo?.amperaje||""];

    const drawE = (ry, nm, un, vals, hds, placa) => {
      if (placa) { pdf.setFillColor(240,244,248); pdf.rect(LX,ry,LW,RH2,"F"); }
      pdf.setDrawColor(0); pdf.rect(LX,ry,LW,RH2);
      const nw2 = NW+SW, valX = LX+nw2+UW, cw = VTW/vals.length;
      pdf.line(LX+nw2,ry,LX+nw2,ry+RH2); pdf.line(valX,ry,valX,ry+RH2);
      for (let k=1;k<vals.length;k++) pdf.line(valX+k*cw,ry,valX+k*cw,ry+RH2);
      pdf.setFont("helvetica","normal"); pdf.setFontSize(6.5); pdf.setTextColor(placa?90:0,placa?90:0,placa?90:0);
      pdf.splitTextToSize(nm,nw2-1.5).forEach((l,li) => pdf.text(l,LX+1,ry+3.2+li*2.5));
      pdf.setFontSize(6.5); pdf.setTextColor(20); pdf.text(un,LX+nw2+UW/2,ry+3.5,{align:"center"});
      hds.forEach((h,hi) => { pdf.setFont("helvetica","normal"); pdf.setFontSize(5); pdf.setTextColor(100); pdf.text(h,valX+hi*cw+cw/2,ry+1.8,{align:"center"}); });
      vals.forEach((v,vi) => { pdf.setFont("helvetica","bold"); pdf.setFontSize(7); pdf.setTextColor(placa?80:0,placa?80:0,placa?80:0); pdf.text(String(v||""),valX+vi*cw+cw/2,ry+4.2,{align:"center"}); });
    };
    const drawS = (ry, nm, sub, un, val) => {
      pdf.setDrawColor(0); pdf.rect(LX,ry,LW,RH2);
      if (sub) pdf.line(LX+NW,ry,LX+NW,ry+RH2);
      pdf.line(LX+NW+SW,ry,LX+NW+SW,ry+RH2); pdf.line(LX+NW+SW+UW,ry,LX+NW+SW+UW,ry+RH2);
      pdf.setFont("helvetica","normal"); pdf.setFontSize(6.5); pdf.setTextColor(0);
      pdf.splitTextToSize(nm,(sub?NW:NW+SW)-1.5).forEach((l,li) => pdf.text(l,LX+1,ry+3.2+li*2.5));
      if (sub) { pdf.setFontSize(5.5); pdf.setTextColor(60); sub.split("\n").forEach((sl,si) => pdf.text(sl,LX+NW+0.5,ry+2.5+si*2.2)); }
      pdf.setFontSize(6.5); pdf.setTextColor(20); pdf.text(un,LX+NW+SW+UW/2,ry+3.5,{align:"center"});
      pdf.setFont("helvetica","bold"); pdf.setFontSize(7); pdf.setTextColor(0);
      pdf.text(String(val||""),LX+LW-1,ry+3.5,{align:"right"});
    };

    const rowsL = [
      { type:"elec", nm:"Voltaje en marcha", un:"V", vals:vVals, hds:vHds, placa:false },
      { type:"elec", nm:"Voltaje en placa", un:"V", vals:vPlaca, hds:vHds, placa:true },
      { type:"simple", nm:"Desbalance de voltaje", un:"%", val:cv("desbV") },
      { type:"elec", nm:"Amperaje en marcha", un:"A", vals:aVals, hds:aHds, placa:false },
      { type:"elec", nm:"Amperaje en placa", un:"A", vals:aPlaca, hds:aHds, placa:true },
      { type:"simple", nm:"Desbalance de voltaje", un:"%", val:cv("desbA") },
      { type:"simple", nm:"MEGADO", sub:"L1-T", un:"\u03A9", val:form.megL1T||"" },
      { type:"simple", nm:"", sub:"L2-T", un:"\u03A9", val:form.megL2T||"" },
      { type:"simple", nm:"", sub:"L3-T", un:"\u03A9", val:form.megL3T||"" },
      { type:"simple", nm:"", sub:"L1-L2", un:"\u03A9", val:form.megL1L2||"" },
      { type:"simple", nm:"", sub:"L2-L3", un:"\u03A9", val:form.megL2L3||"" },
      { type:"simple", nm:"", sub:"L3-L1", un:"\u03A9", val:form.megL3L1||"" },
      { type:"simple", nm:"Temperatura de trabajo de motor", un:"\xB0C", val:form.tTrabajoMotor||"" },
      { type:"simple", nm:"Caudal de aire", un:"CFM", val:form.caudalAire||"" },
    ];

    const nR = Math.max(rowsL.length, VENTILACION_ITEMS_DER.length);
    const yT = y;

    for (let i=0; i<nR; i++) {
      const ry = yT + i*RH2;
      const rL = rowsL[i];
      const item = VENTILACION_ITEMS_DER[i];
      const getEst = (nm) => (form.estatusItems||{})[nm]||"";

      if (rL) {
        if (rL.type==="elec") drawE(ry, rL.nm, rL.un, rL.vals, rL.hds, rL.placa);
        else drawS(ry, rL.nm, rL.sub, rL.un, rL.val);
      } else { pdf.setDrawColor(0); pdf.rect(LX,ry,LW,RH2); }

      // Lado derecho estatus
      const DNR = RW*0.72, DER = RW*0.28;
      pdf.setDrawColor(0); pdf.rect(RX,ry,RW,RH2);
      pdf.line(RX+DNR,ry,RX+DNR,ry+RH2);
      if (item) {
        pdf.setFont("helvetica","normal"); pdf.setFontSize(6.5); pdf.setTextColor(0);
        const t = pdf.splitTextToSize(item,DNR-1.5)[0];
        pdf.text(t,RX+1,ry+3.5);
        pdf.setFontSize(6); pdf.setTextColor(80);
        pdf.text("Estatus",RX+DNR+DER/2,ry+2,{align:"center"});
        const est = getEst(item);
        if (est) {
          const ec = est==="OK"?[46,125,50]:est==="Falla"?[198,40,40]:est==="Observado"?[230,81,0]:[80,80,80];
          pdf.setFont("helvetica","bold"); pdf.setFontSize(7); pdf.setTextColor(...ec);
          pdf.text(String(est),RX+DNR+DER/2,ry+4.5,{align:"center"});
        }
      }
    }

    y = yT + nR*RH2 + 4;

    // Tabla OCR (10 filas)
    const obsValidas = form.observaciones.filter(o => o.obs?.trim());
    const numObs = Math.max(obsValidas.length, 10);
    const oH = 10, col0=10, col1=60, col2=60, col3=C-col0-col1-col2;
    pdf.setFillColor(240,240,240);
    ["ITEM","OBSERVACION","CAUSA","RECOMENDACI\xD3N"].forEach((t,ti) => {
      const xc=[M,M+col0,M+col0+col1,M+col0+col1+col2][ti], wc=[col0,col1,col2,col3][ti];
      pdf.rect(xc,y,wc,oH*0.7,"FD");
      pdf.setFont("helvetica","bold"); pdf.setFontSize(7); pdf.setTextColor(0);
      pdf.text(t,xc+wc/2,y+oH*0.5,{align:"center"});
    });
    y += oH*0.7;
    for (let i=0; i<numObs; i++) {
      const o = obsValidas[i];
      pdf.rect(M,y,col0,oH); pdf.setFont("helvetica","normal"); pdf.setFontSize(7); pdf.setTextColor(0);
      pdf.text(String(i+1),M+col0/2,y+6,{align:"center"});
      pdf.rect(M+col0,y,col1,oH); if(o?.obs){const t=pdf.splitTextToSize(o.obs,col1-2);pdf.text(t.slice(0,3),M+col0+1,y+4);}
      pdf.rect(M+col0+col1,y,col2,oH); if(o?.causa){const t=pdf.splitTextToSize(o.causa,col2-2);pdf.text(t.slice(0,3),M+col0+col1+1,y+4);}
      pdf.rect(M+col0+col1+col2,y,col3,oH); if(o?.rec){const t=pdf.splitTextToSize(o.rec,col3-2);pdf.text(t.slice(0,3),M+col0+col1+col2+1,y+4);}
      y += oH;
    }

    const nombre = `reporte-ventilacion-${equipo.cliente?.replace(/\s+/g,"-")}-${form.fecha}.pdf`;
    if (modo==="ver") { const blob=pdf.output("blob"); const url=URL.createObjectURL(blob); window.open(url,"_blank")||(window.location.href=url); }
    else pdf.save(nombre);
  };

  // ===== REPORTE CARRIER FAN COIL =====
  // v2.1 - fancoil rowspan voltaje/amperaje placa+marcha
  const exportarPDFCarrierFancoil = async (modo = "descargar") => {
    if (!equipo || !form) return;
    const pdf = new jsPDF("p", "mm", "a4");
    const W = 210, M = 10, C = W - M * 2;
    let y = 10;

    const cv = (calc) => {
      if (calc === "desbV") return calcDesbalance(form.vL1L2, form.vL2L3, form.vL3L1) || "";
      if (calc === "desbA") return calcDesbalance(form.aL1, form.aL2, form.aL3) || "";
      if (calc === "dTagua") return calcDelta(form.tEntradaAgua, form.tSalidaAgua) || "";
      if (calc === "dPagua") return calcDelta(form.presEntradaAgua, form.presSalidaAgua) || "";
      if (calc === "dTaire") return calcDelta(form.tRetornoAire, form.tSuministroAire) || "";
      return "";
    };

    const cell = (x, y2, w, h, txt, opts = {}) => {
      pdf.setDrawColor(0);
      pdf.rect(x, y2, w, h);
      if (txt) {
        pdf.setFont("helvetica", opts.bold ? "bold" : "normal");
        pdf.setFontSize(opts.sz || 7);
        pdf.setTextColor(0);
        const lines = pdf.splitTextToSize(String(txt), w - 1.5);
        const ty = y2 + h / 2 + (opts.sz || 7) * 0.18;
        if (opts.center) {
          lines.forEach((l, i) => pdf.text(l, x + w / 2, ty + i * (opts.sz || 7) * 0.4, { align: "center" }));
        } else {
          lines.forEach((l, i) => pdf.text(l, x + 1, ty + i * (opts.sz || 7) * 0.4));
        }
      }
    };

    // === ENCABEZADO: Logo Carrier + datos empresa ===
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(8); pdf.setTextColor(0);
    pdf.text("ASCENSORES S.A.", W - M, y + 2, { align: "right" });
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(6.5);
    pdf.text(`${equipo.cliente || ""}`, W - M, y + 6, { align: "right" });
    y += 14;

    // === TÍTULO ===
    pdf.setFillColor(255, 255, 255);
    pdf.rect(M, y, C, 7);
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(9); pdf.setTextColor(0);
    pdf.text("REPORTE DE MANTENIMIENTO DE MANEJADORA DE AIRE Y FAN COIL", W / 2, y + 5, { align: "center" });
    y += 7;

    // === FILAS DE DATOS DEL EQUIPO ===
    const rH = 5.5;
    const half = C / 2;
    const infoRows = [
      ["CLIENTE", equipo.cliente || "", "MARCA DE UMA / FAN COIL", equipo.marca || ""],
      ["CONTRATO", equipo.contrato || form.contrato || "", "MODELO DE UMA / FAN COIL", equipo.modelo || ""],
      ["UMA / FAN COIL N\xB0", equipo.fancoilNum || form.fancoilNum || equipo.codigo || "", "N\xB0 DE SERIE DE UMA / FAN COIL", equipo.serie || ""],
      ["UBICACI\xD3N", (equipo.sede || "") + (equipo.piso ? " / Piso " + equipo.piso : "") + (equipo.ambiente ? " / " + equipo.ambiente : ""), "MARCA DE MOTOR", equipo.marcaMotor || form.marcaMotor || ""],
      ["MODELO DE FAJA", equipo.modeloFaja || form.modeloFaja || "", "MODELO DE MOTOR", equipo.modeloMotor || form.modeloMotor || ""],
      ["NUMERO DE FAJAS", equipo.numFajas || form.numFajas || "", "N\xB0 DE SERIE DE MOTOR", equipo.serieMotor || form.serieMotor || ""],
      ["TECNICO RESPONSABLE", form.tecnico || "", "FECHA", form.fecha || ""],
    ];
    const lw = C * 0.22; // ancho etiqueta
    const vw = half - lw;  // ancho valor

    infoRows.forEach(([l1, v1, l2, v2]) => {
      cell(M, y, lw, rH, l1, { sz: 6.5 });
      cell(M + lw, y, vw, rH, v1, { sz: 6.5 });
      cell(M + half, y, lw, rH, l2, { sz: 6.5 });
      cell(M + half + lw, y, vw, rH, v2, { sz: 6.5 });
      y += rH;
    });

    // === ENCABEZADO PARAMETROS ===
    const pH = 5;
    pdf.setFillColor(220, 220, 220);
    pdf.rect(M, y, half, pH, "FD");
    pdf.rect(M + half, y, half, pH, "FD");
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(8); pdf.setTextColor(0);
    pdf.text("PARAMETROS", M + half / 2, y + 3.5, { align: "center" });
    pdf.text("PARAMETROS", M + half + half / 2, y + 3.5, { align: "center" });
    y += pH;

    // === TABLA PRINCIPAL ===
    // Proporciones columna izquierda (exactas del Carrier):
    // Nombre(44%) | Voltaje en marcha(15%) | Unidad(9%) | val1 | val2 | val3 (32% en 3)
    const LW2 = half;
    const RW2 = half;
    const LX = M;
    const RX = M + half;
    const N1 = LW2 * 0.44;
    const S1 = LW2 * 0.15;
    const U1 = LW2 * 0.09;
    const V3 = LW2 * 0.32 / 3; // cada sub-columna de valor
    const RH2 = 5.5;

    // Columna derecha: Nombre(65%) | Estatus(17%) | Valor(18%)
    const DN = RW2 * 0.65;
    const DE = RW2 * 0.17;
    const DV = RW2 * 0.18;

    const esMono = equipo?.fases === "Monofásico";
    const rowsL = [
      { nm: "Voltaje en marcha", un: "V",
        v3: esMono ? [form.vL1L2||""] : [form.vL1L2||"", form.vL2L3||"", form.vL3L1||""],
        hds: esMono ? ["L1-L2"] : ["L1-L2","L2-L3","L3-L1"] },
      { nm: "Voltaje en placa", placa: true, un: "V",
        v3: esMono ? [equipo?.voltaje||""] : [equipo?.voltaje||"", equipo?.voltaje||"", equipo?.voltaje||""],
        hds: esMono ? ["L1-L2"] : ["L1-L2","L2-L3","L3-L1"] },
      { nm: "Desbalance de voltaje", un: "%", v1: cv("desbV") },
      { nm: "Amperaje en marcha", un: "A",
        v3: esMono ? [form.aL1||"", form.aL2||""] : [form.aL1||"", form.aL2||"", form.aL3||""],
        hds: esMono ? ["L1","L2"] : ["L1","L2","L3"] },
      { nm: "Amperaje en placa", placa: true, un: "A",
        v3: esMono ? [equipo?.amperaje||"", equipo?.amperaje||""] : [equipo?.amperaje||"", equipo?.amperaje||"", equipo?.amperaje||""],
        hds: esMono ? ["L1","L2"] : ["L1","L2","L3"] },
      { nm: "Desbalance de amperaje", un: "%", v1: cv("desbA") },
      { nm: "MEGADO", sub: "L1-T", un: "\u03A9", v1: form.megL1T || "" },
      { nm: "", sub: "L2-T", un: "\u03A9", v1: form.megL2T || "" },
      { nm: "", sub: "L3-T", un: "\u03A9", v1: form.megL3T || "" },
      { nm: "", sub: "L1-L2", un: "\u03A9", v1: form.megL1L2 || "" },
      { nm: "", sub: "L2-L3", un: "\u03A9", v1: form.megL2L3 || "" },
      { nm: "", sub: "L3-L1", un: "\u03A9", v1: form.megL3L1 || "" },
      { nm: "Temperatura de trabajo de motor", un: "\xB0C", v1: form.tTrabajoMotor || "" },
      { nm: "Temperatura de entrada de agua", un: "\xB0C", v1: form.tEntradaAgua || "" },
      { nm: "Temperatura de salida de agua", un: "\xB0C", v1: form.tSalidaAgua || "" },
      { nm: "\u0394 Temperatura de agua", un: "\xB0C", v1: cv("dTagua") },
      { nm: "Presion de entrada de agua", un: "PSI", v1: form.presEntradaAgua || "" },
      { nm: "Presion de salida de agua", un: "PSI", v1: form.presSalidaAgua || "" },
      { nm: "\u0394 Presion de agua", un: "PSI", v1: cv("dPagua") },
      { nm: "Temperatura de retorno de aire", un: "\xB0C", v1: form.tRetornoAire || "" },
      { nm: "Temperatura de suministro de aire", un: "\xB0C", v1: form.tSuministroAire || "" },
      { nm: "\u0394 Temperatura de aire", un: "\xB0C", v1: cv("dTaire") },
    ];

    const nR = Math.max(rowsL.length, FANCOIL_ITEMS_DER.length);
    const yT = y;

    for (let i = 0; i < nR; i++) {
      const ry = yT + i * RH2;

      // -- Lado izquierdo --
      if (i < rowsL.length) {
        const r = rowsL[i];
        // Fondo gris claro para filas "en placa"
        if (r.placa) { pdf.setFillColor(240, 244, 248); pdf.rect(LX, ry, LW2, RH2, "F"); }
        pdf.setDrawColor(0); pdf.rect(LX, ry, LW2, RH2);

        // Geometria: si la fila tiene valores pero no sub, el nombre ocupa N1+S1
        const nameW = (r.sub === undefined && r.v3) ? (N1 + S1) : N1;
        const valX = LX + N1 + S1 + U1;       // inicio del area de valores
        const valTotW = V3 * 3;                // ancho total del area de valores
        const cw = r.v3 ? valTotW / r.v3.length : valTotW; // ancho por columna (dinamico)

        // Separadores verticales
        pdf.line(LX + nameW, ry, LX + nameW, ry + RH2);
        pdf.line(valX, ry, valX, ry + RH2);
        if (r.v3) {
          for (let k = 1; k < r.v3.length; k++) {
            pdf.line(valX + k * cw, ry, valX + k * cw, ry + RH2);
          }
        }

        // Nombre
        pdf.setFont("helvetica", "normal"); pdf.setFontSize(6.5);
        if (r.placa) { pdf.setTextColor(90, 90, 90); } else { pdf.setTextColor(0, 0, 0); }
        const nmLines = pdf.splitTextToSize(r.nm, nameW - 1.5);
        nmLines.forEach((l, li) => pdf.text(l, LX + 1, ry + 3.2 + li * 2.5));

        // Sub (solo filas con sub explicito, ej. MEGADO)
        if (r.sub) {
          pdf.setFontSize(5.5); pdf.setTextColor(0);
          r.sub.split("\n").forEach((sl, si) => pdf.text(sl, LX + N1 + 0.5, ry + 2.5 + si * 2.2));
        }

        // Unidad
        pdf.setFontSize(6.5); pdf.setTextColor(20, 20, 20);
        pdf.text(r.un, LX + N1 + S1 + U1 / 2, ry + 3.5, { align: "center" });

        // Valores
        if (r.v3) {
          r.hds && r.hds.forEach((h, hi) => {
            pdf.setFont("helvetica", "normal"); pdf.setFontSize(5); pdf.setTextColor(100, 100, 100);
            pdf.text(h, valX + hi * cw + cw / 2, ry + 1.8, { align: "center" });
          });
          r.v3.forEach((v, vi) => {
            pdf.setFont("helvetica", "bold"); pdf.setFontSize(7);
            if (r.placa) { pdf.setTextColor(80, 80, 80); } else { pdf.setTextColor(0, 0, 0); }
            pdf.text(String(v || ""), valX + vi * cw + cw / 2, ry + 4.2, { align: "center" });
          });
        } else if (r.v1 !== undefined) {
          pdf.setFont("helvetica", "bold"); pdf.setFontSize(7); pdf.setTextColor(0);
          pdf.text(String(r.v1), LX + LW2 - 1, ry + 3.5, { align: "right" });
        }
      } else {
        pdf.setDrawColor(0); pdf.rect(LX, ry, LW2, RH2);
      }

      // -- Lado derecho --
      if (i < FANCOIL_ITEMS_DER.length) {
        const item = FANCOIL_ITEMS_DER[i];
        const est = (form.estatusItems || {})[item] || "";
        pdf.setDrawColor(0); pdf.rect(RX, ry, RW2, RH2);
        pdf.line(RX + DN, ry, RX + DN, ry + RH2);
        pdf.line(RX + DN + DE, ry, RX + DN + DE, ry + RH2);

        pdf.setFont("helvetica", "normal"); pdf.setFontSize(6.5); pdf.setTextColor(0);
        const itTxt = pdf.splitTextToSize(item, DN - 1.5)[0];
        pdf.text(itTxt, RX + 1, ry + 3.5);

        pdf.setFontSize(6); pdf.setTextColor(80, 80, 80);
        pdf.text("Estatus", RX + DN + DE / 2, ry + 3.5, { align: "center" });

        if (est) {
          const ec = est === "OK" ? [46, 125, 50] : est === "Falla" ? [198, 40, 40] : est === "Observado" ? [230, 81, 0] : [0, 0, 0];
          pdf.setFont("helvetica", "bold"); pdf.setFontSize(7); pdf.setTextColor(...ec);
          pdf.text(String(est), RX + DN + DE + DV / 2, ry + 3.5, { align: "center" });
        }
      } else {
        pdf.setDrawColor(0); pdf.rect(RX, ry, RW2, RH2);
      }
    }

    y = yT + nR * RH2 + 6;

    // === TABLA OCR (ITEM | OBSERVACION | CAUSA | RECOMENDACIÓN) ===
    const obsValidas = form.observaciones.filter(o => o.obs?.trim());
    const numObs = Math.max(obsValidas.length, 9);
    const oH = 10;
    const col0 = 10, col1 = 60, col2 = 60, col3 = C - col0 - col1 - col2;

    // Encabezado OCR
    pdf.setFillColor(240, 240, 240);
    pdf.rect(M, y, col0, oH * 0.7, "FD");
    pdf.rect(M + col0, y, col1, oH * 0.7, "FD");
    pdf.rect(M + col0 + col1, y, col2, oH * 0.7, "FD");
    pdf.rect(M + col0 + col1 + col2, y, col3, oH * 0.7, "FD");
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(7); pdf.setTextColor(0);
    const hY = y + oH * 0.5;
    pdf.text("ITEM", M + col0 / 2, hY, { align: "center" });
    pdf.text("OBSERVACION", M + col0 + col1 / 2, hY, { align: "center" });
    pdf.text("CAUSA", M + col0 + col1 + col2 / 2, hY, { align: "center" });
    pdf.text("RECOMENDACI\xD3N", M + col0 + col1 + col2 + col3 / 2, hY, { align: "center" });
    y += oH * 0.7;

    for (let i = 0; i < numObs; i++) {
      const o = obsValidas[i];
      pdf.rect(M, y, col0, oH); pdf.setFont("helvetica", "normal"); pdf.setFontSize(7); pdf.setTextColor(0);
      pdf.text(String(i + 1), M + col0 / 2, y + 6, { align: "center" });
      pdf.rect(M + col0, y, col1, oH);
      if (o?.obs) { const t = pdf.splitTextToSize(o.obs, col1 - 2); pdf.text(t.slice(0, 3), M + col0 + 1, y + 4); }
      pdf.rect(M + col0 + col1, y, col2, oH);
      if (o?.causa) { const t = pdf.splitTextToSize(o.causa, col2 - 2); pdf.text(t.slice(0, 3), M + col0 + col1 + 1, y + 4); }
      pdf.rect(M + col0 + col1 + col2, y, col3, oH);
      if (o?.rec) { const t = pdf.splitTextToSize(o.rec, col3 - 2); pdf.text(t.slice(0, 3), M + col0 + col1 + col2 + 1, y + 4); }
      y += oH;
    }

    // === GUARDAR / VER ===
    const nombre = `reporte-fancoil-${equipo.cliente?.replace(/\s+/g, "-")}-${form.fecha}.pdf`;
    if (modo === "ver") {
      const blob = pdf.output("blob");
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank") || (window.location.href = url);
    } else {
      pdf.save(nombre);
    }
  };

  const exportarPDF = async (modo = "descargar") => {
    if (!equipo || !form) return;
    if (form.grupo === "fancoil") return exportarPDFCarrierFancoil(modo);
    if (form.grupo === "expansion") return exportarPDFExpansion(modo);
    if (form.grupo === "ventilacion") return exportarPDFVentilacion(modo);
    const grupo = GRUPOS[form.grupo];
    const pdf = new jsPDF("p", "mm", "a4");
    const W = 210, M = 14, C = W - M * 2;
    let y = 0;
    const check = (h = 10) => { if (y + h > 280) { pdf.addPage(); y = 14; } };

    // Header igual que la ficha
    pdf.setFillColor(26, 95, 168); pdf.rect(0, 0, W, 22, "F");
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(14); pdf.setTextColor(255, 255, 255);
    pdf.text("HVAC", M, 14);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(9); pdf.setTextColor(200, 220, 255);
    pdf.text("SISTEMA DE MANTENIMIENTO", M + 22, 14);
    const ec = form.estadoFinal === "Operativo" ? [46, 125, 50] : form.estadoFinal === "Operativo con observaciones" ? [230, 81, 0] : [198, 40, 40];
    pdf.setFillColor(255, 248, 225); pdf.roundedRect(W - M - 52, 7, 52, 8, 2, 2, "F");
    pdf.setFontSize(7.5); pdf.setTextColor(...ec);
    pdf.text(form.estadoFinal === "Operativo con observaciones" ? "Con observaciones" : (form.estadoFinal || "Operativo"), W - M - 26, 12.5, { align: "center" });
    y = 30;

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

    // Franja título centrado (tipo de protocolo)
    pdf.setFillColor(248, 249, 250); pdf.rect(M, y, C, 16, "F");
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(11); pdf.setTextColor(26, 95, 168);
    pdf.text(`PROTOCOLO DE MANTENIMIENTO — ${grupo.label.toUpperCase()}`, W / 2, y + 6.5, { align: "center" });
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(8.5); pdf.setTextColor(150, 150, 150);
    pdf.text(`${equipo.marca || "-"} / ${equipo.modelo || "-"} — ${equipo.tipoEquipo || "-"}`, W / 2, y + 12.5, { align: "center" });
    y += 20;

    // Datos del equipo (en celdas, como el formulario)
    secTit("Datos del equipo", 26, 95, 168);
    gridCards([
      ["Cliente", equipo.cliente], ["Sede", equipo.sede], ["Piso", equipo.piso], ["Ambiente", equipo.ambiente],
    ], 4, 248, 249, 250);
    gridCards([
      ["Marca", equipo.marca], ["Modelo", equipo.modelo], ["N° Serie", equipo.serie], ["Capacidad", equipo.capacidad ? equipo.capacidad + " BTU" : null],
    ], 4, 248, 249, 250);

    // Datos de placa del equipo (de la ficha técnica registrada)
    secTit("Datos de placa del equipo", 26, 95, 168);
    gridCards([
      ["Tipo refrigerante", equipo.tipoRefrigerante], ["Voltaje de placa", equipo.voltaje ? equipo.voltaje + "V" : null], ["Amperaje nominal", equipo.amperaje ? equipo.amperaje + "A" : null], ["Fases", equipo.fases],
    ], 4, 248, 249, 250);

    // Datos del servicio
    secTit("Datos del servicio", 26, 95, 168);
    gridCards([
      ["Fecha", form.fecha], ["Técnico", form.tecnico], ["Tipo de servicio", form.tipoServicio], ["N° de orden", form.ordenTrabajo],
    ], 4, 248, 249, 250);

    // Parámetros eléctricos (solo para grupos que no usan formato Carrier propio)
    if (form.grupo !== "fancoil") {
      secTit("Par\u00e1metros el\u00e9ctricos", 230, 81, 0);
      gridCards([
        ["Voltaje L1-L2", form.vL1L2 ? form.vL1L2 + "V" : null], ["Voltaje L2-L3", form.vL2L3 ? form.vL2L3 + "V" : null], ["Voltaje L3-L1", form.vL3L1 ? form.vL3L1 + "V" : null], ["Desbalance V", calcDesbalance(form.vL1L2, form.vL2L3, form.vL3L1) ? calcDesbalance(form.vL1L2, form.vL2L3, form.vL3L1) + "%" : null],
        ["Amperaje L1", form.aL1 ? form.aL1 + "A" : null], ["Amperaje L2", form.aL2 ? form.aL2 + "A" : null], ["Amperaje L3", form.aL3 ? form.aL3 + "A" : null], ["Desbalance A", calcDesbalance(form.aL1, form.aL2, form.aL3) ? calcDesbalance(form.aL1, form.aL2, form.aL3) + "%" : null],
        ["Megado L1-T", form.megL1T ? form.megL1T + " M\u03A9" : null], ["Megado L2-T", form.megL2T ? form.megL2T + " M\u03A9" : null], ["Megado L3-T", form.megL3T ? form.megL3T + " M\u03A9" : null],
      ], 4, 255, 248, 240);
    }

    // Parámetros específicos por grupo
    if (form.grupo === "expansion") {
      secTit("Parámetros de refrigeración", 26, 95, 168);
      gridCards([
        ["Presión succión", form.presSuccion ? form.presSuccion + " PSI" : null], ["Presión líquido", form.presLiquido ? form.presLiquido + " PSI" : null], ["Superheat", calcDelta(form.tSatMedida, form.tSatTabla) ? calcDelta(form.tSatMedida, form.tSatTabla) + " °C" : null],
        ["T° retorno aire", form.tRetornoEvap ? form.tRetornoEvap + " °C" : null], ["T° suministro", form.tSuministroEvap ? form.tSuministroEvap + " °C" : null], ["T° amb. condensador", form.tAmbCondensador ? form.tAmbCondensador + " °C" : null],
      ], 3, 248, 249, 250);
    } else if (form.grupo === "ventilacion") {
      secTit("Parámetros de operación", 26, 95, 168);
      gridCards([
        ["Temp. trabajo motor", form.tTrabajoMotor ? form.tTrabajoMotor + " °C" : null], ["Caudal de aire", form.caudalAire ? form.caudalAire + " CFM" : null],
      ], 3, 248, 249, 250);
    } else if (form.grupo === "fancoil") {
      // ===== REPORTE CARRIER FAN COIL: replica exacta =====
      const cv = (calc) => {
        if (calc === "desbV") return calcDesbalance(form.vL1L2, form.vL2L3, form.vL3L1) || "";
        if (calc === "desbA") return calcDesbalance(form.aL1, form.aL2, form.aL3) || "";
        if (calc === "dTagua") return calcDelta(form.tEntradaAgua, form.tSalidaAgua) || "";
        if (calc === "dPagua") return calcDelta(form.presEntradaAgua, form.presSalidaAgua) || "";
        if (calc === "dTaire") return calcDelta(form.tRetornoAire, form.tSuministroAire) || "";
        return "";
      };
      check(120);
      const TW = C;
      const LW = TW * 0.5;
      const RW = TW * 0.5;
      const LX = M;
      const RX = M + LW;
      const RH = 5.2;
      const NW = LW * 0.44;
      const SW = LW * 0.16;
      const UW = LW * 0.09;
      const VW = LW * 0.31;
      const DNW = RW * 0.63;
      const DEW = RW * 0.18;
      const DVW = RW * 0.19;
      const hH = 5.5;
      check(hH);
      pdf.setFillColor(220, 228, 240);
      pdf.rect(LX, y, TW, hH, "F");
      pdf.setDrawColor(100, 100, 100); pdf.rect(LX, y, TW, hH);
      pdf.line(LX + LW, y, LX + LW, y + hH);
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(8); pdf.setTextColor(0, 0, 0);
      pdf.text("PARAMETROS", LX + LW / 2, y + hH - 1.5, { align: "center" });
      pdf.text("PARAMETROS", RX + RW / 2, y + hH - 1.5, { align: "center" });
      y += hH;

      // Filas electricas (marcha/placa) como filas simples separadas
      const RH1 = 5.2; // altura de fila
      const rowsL = [
        { nm: "Voltaje en marcha", tipo: "elec", un: "V",
          hds: equipo?.fases === "Monofásico" ? ["L1-L2"] : ["L1-L2","L2-L3","L3-L1"],
          v3: equipo?.fases === "Monofásico" ? [form.vL1L2] : [form.vL1L2, form.vL2L3, form.vL3L1] },
        { nm: "Voltaje en placa", tipo: "elec", placa: true, un: "V",
          hds: equipo?.fases === "Monofásico" ? ["L1-L2"] : ["L1-L2","L2-L3","L3-L1"],
          v3: equipo?.fases === "Monofásico" ? [equipo?.voltaje||""] : [equipo?.voltaje||"", equipo?.voltaje||"", equipo?.voltaje||""] },
        { nm: "Desbalance de voltaje", un: "%", v1: cv("desbV") },
        { nm: "Amperaje en marcha", tipo: "elec", un: "A",
          hds: equipo?.fases === "Monofásico" ? ["L1","L2"] : ["L1","L2","L3"],
          v3: equipo?.fases === "Monofásico" ? [form.aL1, form.aL2] : [form.aL1, form.aL2, form.aL3] },
        { nm: "Amperaje en placa", tipo: "elec", placa: true, un: "A",
          hds: equipo?.fases === "Monofásico" ? ["L1","L2"] : ["L1","L2","L3"],
          v3: equipo?.fases === "Monofásico" ? [equipo?.amperaje||"", equipo?.amperaje||""] : [equipo?.amperaje||"", equipo?.amperaje||"", equipo?.amperaje||""] },
        { nm: "Desbalance de amperaje", un: "%", v1: cv("desbA") },
        { nm: "MEGADO", sub: "L1-T", un: "\u03A9", v1: form.megL1T || "" },
        { nm: "", sub: "L2-T", un: "\u03A9", v1: form.megL2T || "" },
        { nm: "", sub: "L3-T", un: "\u03A9", v1: form.megL3T || "" },
        { nm: "", sub: "L1-L2", un: "\u03A9", v1: form.megL1L2 || "" },
        { nm: "", sub: "L2-L3", un: "\u03A9", v1: form.megL2L3 || "" },
        { nm: "", sub: "L3-L1", un: "\u03A9", v1: form.megL3L1 || "" },
        { nm: "Temperatura de trabajo de motor", un: "\xB0C", v1: form.tTrabajoMotor || "" },
        { nm: "Temperatura de entrada de agua", un: "\xB0C", v1: form.tEntradaAgua || "" },
        { nm: "Temperatura de salida de agua", un: "\xB0C", v1: form.tSalidaAgua || "" },
        { nm: "\u0394 Temperatura de agua", un: "\xB0C", v1: cv("dTagua") },
        { nm: "Presion de entrada de agua", un: "PSI", v1: form.presEntradaAgua || "" },
        { nm: "Presion de salida de agua", un: "PSI", v1: form.presSalidaAgua || "" },
        { nm: "\u0394 Presion de agua", un: "PSI", v1: cv("dPagua") },
        { nm: "Temperatura de retorno de aire", un: "\xB0C", v1: form.tRetornoAire || "" },
        { nm: "Temperatura de suministro de aire", un: "\xB0C", v1: form.tSuministroAire || "" },
        { nm: "\u0394 Temperatura de aire", un: "\xB0C", v1: cv("dTaire") },
      ];

      // Calcular posiciones Y de cada fila (dobles ocupan 2x altura)
      const rowPositions = [];
      let curY = y;
      rowsL.forEach(r => {
        const h = RH1;
        rowPositions.push({ ry: curY, h });
        curY += h;
      });
      const totalLH = curY - y;

      // Lado derecho: altura fija RH1 para cada ítem
      const nItemsR = FANCOIL_ITEMS_DER.length;
      const totalRH = nItemsR * RH1;
      const totalH = Math.max(totalLH, totalRH);
      check(totalH + 4);

      // Dibujar lado izquierdo
      rowsL.forEach((r, i) => {
        const { ry, h } = rowPositions[i];
        pdf.setDrawColor(0);

        if (r.tipo === "elec") {
          // Fila simple electrica: nombre | unidad | N columnas con headers
          // Fondo gris si es "en placa"
          if (r.placa) {
            pdf.setFillColor(240, 244, 248);
            pdf.rect(LX, ry, LW, RH1, "F");
          }
          pdf.setDrawColor(0);
          pdf.rect(LX, ry, LW, RH1);
          pdf.line(LX + NW + SW, ry, LX + NW + SW, ry + RH1);
          pdf.line(LX + NW + SW + UW, ry, LX + NW + SW + UW, ry + RH1);
          pdf.setFont("helvetica", "normal"); pdf.setFontSize(6.5);
          if (r.placa) { pdf.setTextColor(90, 90, 90); } else { pdf.setTextColor(0, 0, 0); }
          const nmL = pdf.splitTextToSize(r.nm, NW + SW - 1.5);
          nmL.forEach((l, li) => pdf.text(l, LX + 1, ry + 3.2 + li * 2.2));
          pdf.setFontSize(6.5); pdf.setTextColor(20, 20, 20);
          pdf.text(r.un, LX + NW + SW + UW / 2, ry + 3.2, { align: "center" });
          const cw = VW / r.v3.length;
          r.v3.forEach((v, vi) => {
            const cx = LX + NW + SW + UW + vi * cw;
            pdf.setFont("helvetica", "normal"); pdf.setFontSize(5); pdf.setTextColor(110, 110, 110);
            pdf.text(r.hds[vi] || "", cx + cw / 2, ry + 1.8, { align: "center" });
            pdf.setFont("helvetica", "bold"); pdf.setFontSize(7);
            if (r.placa) { pdf.setTextColor(80, 80, 80); } else { pdf.setTextColor(0, 0, 0); }
            pdf.text(String(v || ""), cx + cw / 2, ry + 4.2, { align: "center" });
            if (vi > 0) { pdf.setDrawColor(0); pdf.line(cx, ry, cx, ry + RH1); }
          });

        } else {
          // Fila simple
          pdf.rect(LX, ry, LW, RH1);
          if (r.sub !== undefined) {
            pdf.line(LX + NW, ry, LX + NW, ry + RH1);
            pdf.line(LX + NW + SW, ry, LX + NW + SW, ry + RH1);
            pdf.line(LX + NW + SW + UW, ry, LX + NW + SW + UW, ry + RH1);
          } else {
            pdf.line(LX + NW + SW, ry, LX + NW + SW, ry + RH1);
            pdf.line(LX + NW + SW + UW, ry, LX + NW + SW + UW, ry + RH1);
          }
          pdf.setFont("helvetica", "normal"); pdf.setFontSize(6.5); pdf.setTextColor(0);
          const nmL = pdf.splitTextToSize(r.nm, NW - 1.5);
          nmL.forEach((l, li) => pdf.text(l, LX + 1, ry + 3.2 + li * 2.2));
          if (r.sub) {
            pdf.setFontSize(5.5); pdf.setTextColor(60, 60, 60);
            r.sub.split("\n").forEach((sl, si) => pdf.text(sl, LX + NW + 1, ry + 2.2 + si * 2));
          }
          pdf.setFontSize(6.5); pdf.setTextColor(20, 20, 20);
          pdf.text(r.un, LX + NW + SW + UW / 2, ry + 3.2, { align: "center" });
          if (r.v1 !== undefined) {
            pdf.setFont("helvetica", "bold"); pdf.setFontSize(7); pdf.setTextColor(0);
            pdf.text(String(r.v1 || ""), LX + LW - 1.5, ry + 3.2, { align: "right" });
          }
        }
      });

      // Dibujar lado derecho (filas fijas RH1)
      FANCOIL_ITEMS_DER.forEach((item, i) => {
        const ry = y + i * RH1;
        const est = (form.estatusItems || {})[item] || "";
        pdf.setDrawColor(0); pdf.rect(RX, ry, RW, RH1);
        pdf.line(RX + DNW, ry, RX + DNW, ry + RH1);
        pdf.line(RX + DNW + DEW, ry, RX + DNW + DEW, ry + RH1);
        pdf.setFont("helvetica", "normal"); pdf.setFontSize(6.5); pdf.setTextColor(0);
        const itTxt = pdf.splitTextToSize(item, DNW - 1.5)[0];
        pdf.text(itTxt, RX + 1, ry + 3.2);
        pdf.setFontSize(6); pdf.setTextColor(100, 100, 100);
        pdf.text("Estatus", RX + DNW + DEW / 2, ry + 3.2, { align: "center" });
        if (est) {
          const ec = est === "OK" ? [46, 125, 50] : est === "Falla" ? [198, 40, 40] : est === "Observado" ? [230, 81, 0] : [80, 80, 80];
          pdf.setFont("helvetica", "bold"); pdf.setFontSize(6.5); pdf.setTextColor(...ec);
          pdf.text(String(est), RX + DNW + DEW + DVW / 2, ry + 3.2, { align: "center" });
        }
      });

      y += totalH + 4;
    }

    // Actividades realizadas (checklist completo - solo para grupos que no usan formato Carrier)
    const cl = CHECKLISTS[form.grupo] || {};
    const categorias = Object.entries(cl);
    if (categorias.length > 0 && form.grupo !== "fancoil") {
      secTit("Actividades realizadas", 46, 125, 50);
      const cols = categorias.length;
      const colW = (C - (cols - 1) * 4) / cols;
      const maxItems = Math.max(...categorias.map(([, items]) => items.length));
      const rowH = 5;
      check(8 + maxItems * rowH + 4);
      const yStart = y;

      categorias.forEach(([cat, items], ci) => {
        const x = M + ci * (colW + 4);
        // Título de categoría
        pdf.setFont("helvetica", "normal"); pdf.setFontSize(7); pdf.setTextColor(150, 150, 150);
        pdf.text(cat.toUpperCase(), x + colW / 2, yStart, { align: "center" });
        pdf.setDrawColor(230, 230, 230); pdf.line(x, yStart + 1.5, x + colW, yStart + 1.5);

        items.forEach((item, ii) => {
          const iy = yStart + 6 + ii * rowH;
          const marcado = !!form.actividades[item];
          // Checkbox
          if (marcado) {
            pdf.setFillColor(232, 245, 233); pdf.setDrawColor(46, 125, 50);
            pdf.rect(x, iy - 2.5, 3, 3, "FD");
            pdf.setFont("helvetica", "bold"); pdf.setFontSize(6); pdf.setTextColor(46, 125, 50);
            pdf.text("X", x + 0.6, iy - 0.3);
          } else {
            pdf.setDrawColor(200, 200, 200); pdf.setFillColor(255, 255, 255);
            pdf.rect(x, iy - 2.5, 3, 3, "FD");
          }
          // Texto del item
          pdf.setFont("helvetica", marcado ? "bold" : "normal"); pdf.setFontSize(7.5);
          pdf.setTextColor(marcado ? 30 : 180, marcado ? 30 : 180, marcado ? 30 : 180);
          const txt = pdf.splitTextToSize(item, colW - 5)[0];
          pdf.text(txt, x + 4.5, iy);
        });
      });

      y = yStart + 6 + maxItems * rowH + 4;
    }

    // Observaciones · Causa · Recomendación (mismo estilo que la ficha)
    const obsValidas = form.observaciones.filter(o => o.obs?.trim());
    if (obsValidas.length > 0) {
      secTit("Observación · Causa · Recomendación", 230, 81, 0);
      const colW = (C - 4) / 3;
      check(6);
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(6.5); pdf.setTextColor(140, 140, 140);
      pdf.text("OBSERVACIÓN", M + 2, y);
      pdf.text("CAUSA", M + colW + 4, y);
      pdf.text("RECOMENDACIÓN", M + (colW + 2) * 2 + 2, y);
      y += 4;
      obsValidas.forEach((o) => {
        const linObs = pdf.splitTextToSize(o.obs || "—", colW - 4);
        const linCausa = pdf.splitTextToSize(o.causa || "—", colW - 4);
        const linRec = pdf.splitTextToSize(o.rec || "—", colW - 4);
        const maxLines = Math.max(linObs.length, linCausa.length, linRec.length, 1);
        const h = maxLines * 4 + 3;
        check(h + 2);
        pdf.setFillColor(255, 248, 225); pdf.rect(M, y, colW, h, "F");
        pdf.setFillColor(254, 240, 240); pdf.rect(M + colW + 2, y, colW, h, "F");
        pdf.setFillColor(232, 245, 233); pdf.rect(M + (colW + 2) * 2, y, colW, h, "F");
        pdf.setFont("helvetica", "normal"); pdf.setFontSize(7.5);
        pdf.setTextColor(230, 81, 0); pdf.text(linObs, M + 2, y + 5);
        pdf.setTextColor(198, 40, 40); pdf.text(linCausa, M + colW + 4, y + 5);
        pdf.setTextColor(46, 125, 50); pdf.text(linRec, M + (colW + 2) * 2 + 2, y + 5);
        y += h + 2;
      });
      y += 2;
    }

    // Estado final + firma
    check(20);
    secTit("Resultado del servicio", 26, 95, 168);
    pdf.setFillColor(248, 249, 250); pdf.rect(M, y, C, 14, "F");
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(7); pdf.setTextColor(150, 150, 150);
    pdf.text("ESTADO FINAL DEL EQUIPO", M + 3, y + 4);
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(9); pdf.setTextColor(...ec);
    pdf.text(form.estadoFinal === "Operativo con observaciones" ? "Operativo con observaciones" : (form.estadoFinal || "Operativo"), M + 3, y + 10);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(7); pdf.setTextColor(150, 150, 150);
    pdf.text("TÉCNICO RESPONSABLE", M + 100, y + 4);
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(9); pdf.setTextColor(30, 30, 30);
    pdf.text(form.tecnico || "-", M + 100, y + 10);
    y += 20;

    // QR + pie (igual que la ficha)
    check(25);
    const urlE = `${window.location.origin}/protocolo?equipo=${equipoId}`;
    const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(urlE)}`;
    const qrImg = await new Promise(res => {
      const img = new Image(); img.crossOrigin = "anonymous";
      img.onload = () => { const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; c.getContext("2d").drawImage(img, 0, 0); res(c.toDataURL("image/png")); };
      img.onerror = () => res(null); img.src = qrSrc;
    });
    if (qrImg) pdf.addImage(qrImg, "PNG", M, y, 22, 22);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(7); pdf.setTextColor(150, 150, 150);
    pdf.text("Escanea para ver el", M + 26, y + 9);
    pdf.text("protocolo más reciente", M + 26, y + 13);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(7.5); pdf.setTextColor(150, 150, 150);
    pdf.text("HVAC Sistema de Mantenimiento", W - M, y + 5, { align: "right" });
    pdf.text(`Generado: ${new Date().toLocaleDateString("es-PE")}`, W - M, y + 10, { align: "right" });
    pdf.setDrawColor(220, 220, 220); pdf.line(M, 287, W - M, 287);
    pdf.setFontSize(7); pdf.setTextColor(180, 180, 180);
    pdf.text(`Protocolo · ${equipo.cliente || ""} · ${equipo.codigo || equipoId.slice(0, 6).toUpperCase()}`, M, 291);

    if (modo === "ver") {
      const blob = pdf.output("blob");
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank") || (window.location.href = url);
    } else {
      pdf.save(`protocolo-${equipo.cliente?.replace(/\s+/g, "-")}-${form.fecha}.pdf`);
    }
  };

  if (cargando) return <div style={s.centro}>Cargando protocolo...</div>;
  if (!equipo) return <div style={s.centro}>Equipo no encontrado.</div>;

  // Acceso público (QR escaneado): preparar y abrir el PDF automáticamente
  if (esPub) {
    if (!form && protocolos.length === 0) {
      return (
        <div style={s.centro}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>📋</div>
          <div style={{ fontSize: "16px", color: "#333", fontWeight: 500, marginBottom: "8px" }}>Aún no hay protocolos de mantenimiento</div>
          <div style={{ fontSize: "13px", color: "#888" }}>{equipo.marca} {equipo.modelo} · {equipo.cliente}</div>
          <div style={{ fontSize: "12px", color: "#aaa", marginTop: "12px" }}>El protocolo aparecerá aquí cuando el equipo técnico registre el primer mantenimiento.</div>
        </div>
      );
    }
    return (
      <div style={s.centro}>
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>📄</div>
        <div style={{ fontSize: "16px", color: "#333", fontWeight: 500, marginBottom: "8px" }}>Preparando protocolo en PDF...</div>
        <div style={{ fontSize: "13px", color: "#888" }}>{equipo.marca} {equipo.modelo} · {equipo.cliente}</div>
        {pdfGenerado && (
          <button style={{ marginTop: "16px", padding: "10px 20px", background: "#1a5fa8", color: "white", border: "none", borderRadius: "8px", fontSize: "13px", cursor: "pointer" }} onClick={() => exportarPDF("ver")}>
            Si no se abrió, toca aquí para ver el PDF
          </button>
        )}
      </div>
    );
  }

  // Equipos sin protocolo definido aún
  const grupoPendiente = GRUPO_POR_TIPO[equipo.tipoEquipo] === "pendiente" || (!GRUPO_POR_TIPO[equipo.tipoEquipo]);
  if (grupoPendiente) {
    return (
      <div style={s.page}>
        <div style={{ ...s.navbar, background: "#607d8b" }}>
          <div>
            <div style={s.navTitle}>🔧 Protocolo — {equipo.tipoEquipo}</div>
            <div style={s.navSub}>{equipo.cliente} · {equipo.sede || "Sin sede"} · Piso {equipo.piso} · {equipo.ambiente}</div>
          </div>
          <div style={s.navBtns}>
            <button style={s.btnBack} onClick={handleVolver}>← Volver</button>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>🔧</div>
            <div style={{ fontSize: "16px", color: "#333", fontWeight: 500, marginBottom: "8px" }}>Protocolo en preparación</div>
            <div style={{ fontSize: "13px", color: "#888", maxWidth: "380px", margin: "0 auto" }}>
              El protocolo de mantenimiento para <strong>{equipo.tipoEquipo}</strong> está siendo desarrollado. Estará disponible próximamente.
            </div>
            <div style={{ marginTop: "20px", fontSize: "11px", color: "#aaa" }}>Equipo: {equipo.marca} {equipo.modelo} · {equipo.cliente}</div>
          </div>
        </div>
      </div>
    );
  }

  // Cliente sin protocolos guardados
  if (soloLectura && !form) {
    return (
      <div style={s.page}>
        <div style={{ ...s.navbar, background: "#1a5fa8" }}>
          <div>
            <div style={s.navTitle}>📋 Protocolos de mantenimiento</div>
            <div style={s.navSub}>{equipo.cliente} · {equipo.sede || "Sin sede"} · {equipo.ambiente} · {equipo.marca} {equipo.modelo}</div>
          </div>
          <div style={s.navBtns}>
            <button style={s.btnBack} onClick={handleVolver}>← Volver</button>
          </div>
        </div>
        <div style={s.content}>
          <div style={{ background: "white", border: "0.5px solid #e0e0e0", borderRadius: "12px", padding: "48px", textAlign: "center" }}>
            <div style={{ fontSize: "40px", marginBottom: "12px" }}>📋</div>
            <div style={{ fontSize: "15px", color: "#555", fontWeight: 500 }}>Aún no hay protocolos de mantenimiento</div>
            <div style={{ fontSize: "13px", color: "#888", marginTop: "6px" }}>Los protocolos aparecerán aquí cuando el equipo técnico registre un mantenimiento.</div>
          </div>
        </div>
      </div>
    );
  }

  if (!form) return <div style={s.centro}>Equipo no encontrado.</div>;

  const grupoInfo = GRUPOS[form.grupo];
  const checklist = CHECKLISTS[form.grupo] || {};

  return (
    <div style={s.page}>
      {/* Navbar */}
      <div style={{ ...s.navbar, background: grupoInfo.color }}>
        <div>
          <div style={s.navTitle}>📋 Protocolo de mantenimiento — {grupoInfo.label}</div>
          <div style={s.navSub}>{equipo.cliente} · {equipo.sede || "Sin sede"} · Piso {equipo.piso} · {equipo.ambiente} · {equipo.marca} {equipo.modelo}</div>
        </div>
        <div style={s.navBtns}>
          <button style={s.btnBack} onClick={handleVolver}>← Volver</button>
          {!soloLectura && <button style={s.btnSave} onClick={guardar} disabled={guardando}>{guardando ? "Guardando..." : "💾 Guardar"}</button>}
          <button style={s.btnPdf} onClick={exportarPDF}>📄 PDF</button>
        </div>
      </div>

      <div style={s.content}>
        {/* Historial */}
        <div style={s.histBar}>
          <span style={s.histLabel}>{soloLectura ? "Mantenimientos:" : "Registros:"}</span>
          {!soloLectura && <button style={s.chipNew} onClick={nuevoProtocolo}>+ Nuevo</button>}
          {protocolos.map((p, i) => (
            <button key={i} style={{ ...s.chip, ...(indexActual === i ? s.chipActive : {}) }} onClick={() => seleccionarProtocolo(i)}>
              {p.fecha}
              {!soloLectura && indexActual === i && <span style={s.chipDel} onClick={(e) => { e.stopPropagation(); eliminarProtocolo(i); }}>✕</span>}
            </button>
          ))}
          {!soloLectura && indexActual === -1 && <span style={{ ...s.chip, ...s.chipActive }}>Nuevo (sin guardar)</span>}
          <span style={s.histCount}>{protocolos.length}{soloLectura ? "" : " de 10 máx."}</span>
        </div>

        {/* Datos del equipo (solo lectura) */}
        <div style={s.sec}>
          <div style={s.secT}>📋 Datos del equipo <span style={s.tag}>copiado de Info</span></div>
          <div style={s.secB}>
            <div style={s.g4}>
              <Campo label="Cliente" auto val={equipo.cliente} />
              <Campo label="Sede" auto val={equipo.sede} />
              <Campo label="Piso" auto val={equipo.piso} />
              <Campo label="Ambiente" auto val={equipo.ambiente} />
              <Campo label="Marca" auto val={equipo.marca} />
              <Campo label="Modelo" auto val={equipo.modelo} />
              <Campo label="N° Serie" auto val={equipo.serie} />
              <Campo label="Capacidad" auto val={equipo.capacidad ? equipo.capacidad + (form.grupo === "ventilacion" ? " CFM" : " BTU") : ""} />
            </div>
            <div style={{ ...s.g4, marginTop: "10px" }}>
              {form.grupo !== "ventilacion" && <Campo label="Tipo refrigerante" auto val={equipo.tipoRefrigerante} />}
              <Campo label="Voltaje de placa" auto val={equipo.voltaje ? equipo.voltaje + "V" : ""} />
              <Campo label="Amperaje nominal" auto val={equipo.amperaje ? equipo.amperaje + "A" : ""} />
              <Campo label="Fases" auto val={equipo.fases} />
              {equipo.condAmperaje && <Campo label="Amperaje nominal (cond.)" auto val={equipo.condAmperaje + "A"} />}
              {equipo.condVoltaje && <Campo label="Voltaje nominal (cond.)" auto val={equipo.condVoltaje + "V"} />}
              {equipo.modeloCompresor && <Campo label="Modelo de compresor" auto val={equipo.modeloCompresor} />}
              {form.grupo === "ventilacion" && equipo.codigo && <Campo label="Ventilador N°" auto val={equipo.codigo} />}
            </div>
            {/* Campos específicos Fan Coil / UMA - solo si existen en la ficha */}
            {(equipo.fancoilNum || equipo.contrato || equipo.modeloFaja || equipo.marcaMotor) && (
              <div style={{ ...s.g4, marginTop: "10px" }}>
                {equipo.fancoilNum && <Campo label="UMA / Fan Coil N°" auto val={equipo.fancoilNum} />}
                {equipo.contrato && <Campo label="Contrato" auto val={equipo.contrato} />}
                {equipo.modeloFaja && <Campo label="Modelo de faja" auto val={equipo.modeloFaja} />}
                {equipo.numFajas && <Campo label="N° de fajas" auto val={equipo.numFajas} />}
                {equipo.marcaMotor && <Campo label="Marca de motor" auto val={equipo.marcaMotor} />}
                {equipo.modeloMotor && <Campo label="Modelo de motor" auto val={equipo.modeloMotor} />}
                {equipo.serieMotor && <Campo label="N° serie motor" auto val={equipo.serieMotor} />}
              </div>
            )}
          </div>
        </div>

        {/* Datos del servicio */}
        <fieldset disabled={soloLectura} style={{ border: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "12px" }}>
        <div style={s.sec}>
          <div style={s.secT}>📝 Datos del servicio</div>
          <div style={s.secB}>
            <div style={s.g4}>
              <CampoInput label="Fecha" type="date" val={form.fecha} onChange={v => set("fecha", v)} />
              <CampoInput label="Técnico" val={form.tecnico} onChange={v => set("tecnico", v)} placeholder="Nombre" />
              <CampoSelect label="Tipo servicio" val={form.tipoServicio} onChange={v => set("tipoServicio", v)} opciones={["Preventivo", "Correctivo"]} />
              <CampoInput label="N° Orden trabajo" val={form.ordenTrabajo} onChange={v => set("ordenTrabajo", v)} placeholder="OT-001" />
            </div>
          </div>
        </div>

        {/* Parámetros eléctricos (comunes - solo ventilacion) */}
        {form.grupo !== "fancoil" && form.grupo !== "expansion" && <div style={s.sec}>
          <div style={s.secT}>⚡ Parámetros eléctricos</div>
          <div style={s.secB}>
            <div style={s.g3}>
              {/* Voltaje en marcha */}
              <div>
                <label style={s.lblRow}>Voltaje en marcha (V)</label>
                <div style={s.row3}>
                  <input style={s.mini} placeholder="L1-L2" value={form.vL1L2} onChange={e => set("vL1L2", e.target.value)} />
                  {equipo?.fases !== "Monofásico" && <input style={s.mini} placeholder="L2-L3" value={form.vL2L3} onChange={e => set("vL2L3", e.target.value)} />}
                  {equipo?.fases !== "Monofásico" && <input style={s.mini} placeholder="L3-L1" value={form.vL3L1} onChange={e => set("vL3L1", e.target.value)} />}
                </div>
              </div>
              {/* Voltaje en placa */}
              <div>
                <label style={s.lblRow}>Voltaje en placa (V) <span style={{fontSize:"9px",color:"#888",fontWeight:"normal"}}>(ficha equipo)</span></label>
                <div style={s.row3}>
                  <input style={{...s.mini, background:"#f0f4f8", color:"#555", cursor:"not-allowed"}} placeholder="L1-L2" value={equipo?.voltaje || ""} readOnly />
                  {equipo?.fases !== "Monofásico" && <input style={{...s.mini, background:"#f0f4f8", color:"#555", cursor:"not-allowed"}} placeholder="L2-L3" value={equipo?.voltaje || ""} readOnly />}
                  {equipo?.fases !== "Monofásico" && <input style={{...s.mini, background:"#f0f4f8", color:"#555", cursor:"not-allowed"}} placeholder="L3-L1" value={equipo?.voltaje || ""} readOnly />}
                </div>
              </div>
              {/* Amperaje en marcha */}
              <div>
                <label style={s.lblRow}>Amperaje en marcha (A)</label>
                <div style={s.row3}>
                  <input style={s.mini} placeholder="L1" value={form.aL1} onChange={e => set("aL1", e.target.value)} />
                  <input style={s.mini} placeholder="L2" value={form.aL2} onChange={e => set("aL2", e.target.value)} />
                  {equipo?.fases !== "Monofásico" && <input style={s.mini} placeholder="L3" value={form.aL3} onChange={e => set("aL3", e.target.value)} />}
                </div>
              </div>
              {/* Amperaje en placa */}
              <div>
                <label style={s.lblRow}>Amperaje en placa (A) <span style={{fontSize:"9px",color:"#888",fontWeight:"normal"}}>(ficha equipo)</span></label>
                <div style={s.row3}>
                  <input style={{...s.mini, background:"#f0f4f8", color:"#555", cursor:"not-allowed"}} placeholder="L1" value={equipo?.amperaje || ""} readOnly />
                  <input style={{...s.mini, background:"#f0f4f8", color:"#555", cursor:"not-allowed"}} placeholder="L2" value={equipo?.amperaje || ""} readOnly />
                  {equipo?.fases !== "Monofásico" && <input style={{...s.mini, background:"#f0f4f8", color:"#555", cursor:"not-allowed"}} placeholder="L3" value={equipo?.amperaje || ""} readOnly />}
                </div>
              </div>
              <div>
                <label style={s.lblRow}>Desbalance (auto)</label>
                <div style={s.row2}>
                  <div style={s.calc}>V: {calcDesbalance(form.vL1L2, form.vL2L3, form.vL3L1) || "—"}%</div>
                  <div style={s.calc}>A: {calcDesbalance(form.aL1, form.aL2, form.aL3) || "—"}%</div>
                </div>
              </div>
            </div>
            <div style={{ marginTop: "10px" }}>
              <label style={s.lblRow}>Megado — resistencia de aislamiento (MΩ)</label>
              <div style={s.row3}>
                <input style={s.mini} placeholder="L1-T" value={form.megL1T} onChange={e => set("megL1T", e.target.value)} />
                <input style={s.mini} placeholder="L2-T" value={form.megL2T} onChange={e => set("megL2T", e.target.value)} />
                <input style={s.mini} placeholder="L3-T" value={form.megL3T} onChange={e => set("megL3T", e.target.value)} />
              </div>
            </div>
          </div>
        </div>}

        {/* Parámetros específicos por grupo */}
        {form.grupo === "expansion" && (
          <div style={s.sec}>
            <div style={s.secT}>❄️ Parámetros de Expansión Directa</div>
            <div style={s.secB}>
              <div style={{fontSize:"12px",fontWeight:500,color:"#0c447c",background:"#e6f1fb",padding:"6px 10px",borderRadius:"6px",marginBottom:"10px"}}>Evaporador</div>
              <div style={s.g4}>
                <div><label style={s.lblRow}>Voltaje en marcha (V)</label><div style={s.row3}><input style={s.mini} placeholder="L1-L2" value={form.vL1L2} onChange={e=>set("vL1L2",e.target.value)}/>{equipo?.fases!=="Monofásico"&&<input style={s.mini} placeholder="L2-L3" value={form.vL2L3} onChange={e=>set("vL2L3",e.target.value)}/>}{equipo?.fases!=="Monofásico"&&<input style={s.mini} placeholder="L3-L1" value={form.vL3L1} onChange={e=>set("vL3L1",e.target.value)}/>}</div></div>
                <div><label style={s.lblRow}>Voltaje en placa (V) <span style={{fontSize:"9px",color:"#888",fontWeight:"normal"}}>(ficha equipo)</span></label><div style={s.row3}><input style={{...s.mini,background:"#f0f4f8",color:"#555",cursor:"not-allowed"}} value={equipo?.voltaje||""} readOnly/>{equipo?.fases!=="Monofásico"&&<input style={{...s.mini,background:"#f0f4f8",color:"#555",cursor:"not-allowed"}} value={equipo?.voltaje||""} readOnly/>}{equipo?.fases!=="Monofásico"&&<input style={{...s.mini,background:"#f0f4f8",color:"#555",cursor:"not-allowed"}} value={equipo?.voltaje||""} readOnly/>}</div></div>
                <div><label style={s.lblRow}>Amperaje en marcha (A)</label><div style={s.row3}><input style={s.mini} placeholder="L1" value={form.aL1} onChange={e=>set("aL1",e.target.value)}/><input style={s.mini} placeholder="L2" value={form.aL2} onChange={e=>set("aL2",e.target.value)}/>{equipo?.fases!=="Monofásico"&&<input style={s.mini} placeholder="L3" value={form.aL3} onChange={e=>set("aL3",e.target.value)}/>}</div></div>
                <div><label style={s.lblRow}>Amperaje en placa (A) <span style={{fontSize:"9px",color:"#888",fontWeight:"normal"}}>(ficha equipo)</span></label><div style={s.row3}><input style={{...s.mini,background:"#f0f4f8",color:"#555",cursor:"not-allowed"}} value={equipo?.amperaje||""} readOnly/><input style={{...s.mini,background:"#f0f4f8",color:"#555",cursor:"not-allowed"}} value={equipo?.amperaje||""} readOnly/>{equipo?.fases!=="Monofásico"&&<input style={{...s.mini,background:"#f0f4f8",color:"#555",cursor:"not-allowed"}} value={equipo?.amperaje||""} readOnly/>}</div></div>
                <div><label style={s.lblRow}>Desbalance de voltaje (auto)</label><div style={s.calc}>{calcDesbalance(form.vL1L2, form.vL2L3, form.vL3L1) || "—"}%</div></div>
                <div><label style={s.lblRow}>Desbalance de amperaje (auto)</label><div style={s.calc}>{calcDesbalance(form.aL1, form.aL2, form.aL3) || "—"}%</div></div>
              </div>
              <div style={{marginTop:"8px"}}><label style={s.lblRow}>Megado evaporador (Ω)</label><div style={s.row3}><input style={s.mini} placeholder="L1-T" value={form.megL1T} onChange={e=>set("megL1T",e.target.value)}/><input style={s.mini} placeholder="L2-T" value={form.megL2T} onChange={e=>set("megL2T",e.target.value)}/><input style={s.mini} placeholder="L3-T" value={form.megL3T} onChange={e=>set("megL3T",e.target.value)}/></div><div style={{...s.row3,marginTop:"4px"}}><input style={s.mini} placeholder="L1-L2" value={form.megL1L2} onChange={e=>set("megL1L2",e.target.value)}/><input style={s.mini} placeholder="L2-L3" value={form.megL2L3} onChange={e=>set("megL2L3",e.target.value)}/><input style={s.mini} placeholder="L3-L1" value={form.megL3L1} onChange={e=>set("megL3L1",e.target.value)}/></div></div>
              <div style={{height:"0.5px",background:"#e0e0e0",margin:"12px 0"}}></div>
              <div style={{fontSize:"12px",fontWeight:500,color:"#085041",background:"#e1f5ee",padding:"6px 10px",borderRadius:"6px",marginBottom:"10px"}}>Condensador</div>
              <div style={s.g4}>
                <div><label style={s.lblRow}>Voltaje en marcha (V)</label><div style={s.row3}><input style={s.mini} placeholder="L1-L2" value={form.condVL1L2} onChange={e=>set("condVL1L2",e.target.value)}/>{equipo?.fases!=="Monofásico"&&<input style={s.mini} placeholder="L2-L3" value={form.condVL2L3} onChange={e=>set("condVL2L3",e.target.value)}/>}{equipo?.fases!=="Monofásico"&&<input style={s.mini} placeholder="L3-L1" value={form.condVL3L1} onChange={e=>set("condVL3L1",e.target.value)}/>}</div></div>
                <div><label style={s.lblRow}>Voltaje en placa (V) <span style={{fontSize:"9px",color:"#888",fontWeight:"normal"}}>(ficha equipo)</span></label><div style={s.row3}><input style={{...s.mini,background:"#f0f4f8",color:"#555",cursor:"not-allowed"}} value={equipo?.condVoltaje||equipo?.voltaje||""} readOnly/>{equipo?.fases!=="Monofásico"&&<input style={{...s.mini,background:"#f0f4f8",color:"#555",cursor:"not-allowed"}} value={equipo?.condVoltaje||equipo?.voltaje||""} readOnly/>}{equipo?.fases!=="Monofásico"&&<input style={{...s.mini,background:"#f0f4f8",color:"#555",cursor:"not-allowed"}} value={equipo?.condVoltaje||equipo?.voltaje||""} readOnly/>}</div></div>
                <div><label style={s.lblRow}>Amperaje en marcha (A)</label><div style={s.row3}><input style={s.mini} placeholder="L1" value={form.condAL1} onChange={e=>set("condAL1",e.target.value)}/><input style={s.mini} placeholder="L2" value={form.condAL2} onChange={e=>set("condAL2",e.target.value)}/>{equipo?.fases!=="Monofásico"&&<input style={s.mini} placeholder="L3" value={form.condAL3} onChange={e=>set("condAL3",e.target.value)}/>}</div></div>
                <div><label style={s.lblRow}>Amperaje en placa (A) <span style={{fontSize:"9px",color:"#888",fontWeight:"normal"}}>(ficha equipo)</span></label><div style={s.row3}><input style={{...s.mini,background:"#f0f4f8",color:"#555",cursor:"not-allowed"}} value={equipo?.condAmperaje||equipo?.amperaje||""} readOnly/><input style={{...s.mini,background:"#f0f4f8",color:"#555",cursor:"not-allowed"}} value={equipo?.condAmperaje||equipo?.amperaje||""} readOnly/>{equipo?.fases!=="Monofásico"&&<input style={{...s.mini,background:"#f0f4f8",color:"#555",cursor:"not-allowed"}} value={equipo?.condAmperaje||equipo?.amperaje||""} readOnly/>}</div></div>
                <div><label style={s.lblRow}>Desbalance de voltaje (auto)</label><div style={s.calc}>{calcDesbalance(form.condVL1L2, form.condVL2L3, form.condVL3L1) || "—"}%</div></div>
                <div><label style={s.lblRow}>Desbalance de amperaje (auto)</label><div style={s.calc}>{calcDesbalance(form.condAL1, form.condAL2, form.condAL3) || "—"}%</div></div>
              </div>
              <div style={{marginTop:"8px"}}><label style={s.lblRow}>Megado condensador (Ω)</label><div style={s.row3}><input style={s.mini} placeholder="L1-T" value={form.condMegL1T} onChange={e=>set("condMegL1T",e.target.value)}/><input style={s.mini} placeholder="L2-T" value={form.condMegL2T} onChange={e=>set("condMegL2T",e.target.value)}/><input style={s.mini} placeholder="L3-T" value={form.condMegL3T} onChange={e=>set("condMegL3T",e.target.value)}/></div><div style={{...s.row3,marginTop:"4px"}}><input style={s.mini} placeholder="L1-L2" value={form.condMegL1L2} onChange={e=>set("condMegL1L2",e.target.value)}/><input style={s.mini} placeholder="L2-L3" value={form.condMegL2L3} onChange={e=>set("condMegL2L3",e.target.value)}/><input style={s.mini} placeholder="L3-L1" value={form.condMegL3L1} onChange={e=>set("condMegL3L1",e.target.value)}/></div></div>
              <div style={{height:"0.5px",background:"#e0e0e0",margin:"12px 0"}}></div>
              <div style={{fontSize:"12px",fontWeight:500,color:"#791f1f",background:"#fcebeb",padding:"6px 10px",borderRadius:"6px",marginBottom:"10px"}}>Refrigeración</div>
              <div style={s.g4}>
                <CampoInput label="Presión succión (PSI)" val={form.presSuccion} onChange={v=>set("presSuccion",v)}/>
                <CampoInput label="Presión líquido (PSI)" val={form.presLiquido} onChange={v=>set("presLiquido",v)}/>
                <CampoInput label="T° sat. succión medida (°C)" val={form.tSatMedida} onChange={v=>set("tSatMedida",v)}/>
                <CampoInput label="T° sat. succión tabla (°C)" val={form.tSatTabla} onChange={v=>set("tSatTabla",v)}/>
                <Campo label="Superheat (auto)" calc val={calcDelta(form.tSatMedida,form.tSatTabla)?calcDelta(form.tSatMedida,form.tSatTabla)+" °C":""}/>
                <CampoInput label="T° retorno aire (°C)" val={form.tRetornoEvap} onChange={v=>set("tRetornoEvap",v)}/>
                <CampoInput label="T° suministro aire (°C)" val={form.tSuministroEvap} onChange={v=>set("tSuministroEvap",v)}/>
                <CampoInput label="T° amb. condensador (°C)" val={form.tAmbCondensador} onChange={v=>set("tAmbCondensador",v)}/>
                <CampoInput label="Temp. trabajo motor (°C)" val={form.tTrabajoMotor} onChange={v=>set("tTrabajoMotor",v)}/>
              </div>
              <div style={{height:"0.5px",background:"#e0e0e0",margin:"12px 0"}}></div>
              <div style={{fontSize:"12px",fontWeight:500,color:"var(--color-text-secondary)",marginBottom:"8px"}}>Estatus de actividades</div>
              {["Limpieza de filtros de aire","Limpieza de bandeja de drenaje","Limpieza de serpentín evaporador",...EXPANSION_ITEMS_DER].map(item=>(
                <div key={item} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"4px 0",borderBottom:"0.5px solid #f0f0f0"}}>
                  <span style={{fontSize:"11px",color:"#333",flex:1}}>{item}</span>
                  <select value={(form.estatusItems||{})[item]||""} onChange={e=>setEstatus(item,e.target.value)} disabled={soloLectura} style={{fontSize:"11px",padding:"2px 4px",borderRadius:"4px",border:"0.5px solid #ccc",width:"100px"}}>
                    <option value="">—</option><option value="OK">OK</option><option value="Observado">Observado</option><option value="Falla">Falla</option><option value="N/A">N/A</option>
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        {form.grupo === "ventilacion" && (
          <div style={s.sec}>
            <div style={s.secT}>🌀 Parámetros de operación</div>
            <div style={s.secB}>
              <div style={s.g4}>
                <CampoInput label="Temp. trabajo motor (°C)" val={form.tTrabajoMotor} onChange={v => set("tTrabajoMotor", v)} />
                <CampoInput label="Caudal de aire (CFM)" val={form.caudalAire} onChange={v => set("caudalAire", v)} />
              </div>
              <div style={{ ...s.g4, marginTop: "10px" }}>
                <div style={{ fontSize: "11px", fontWeight: 600, color: "#0f6e56", gridColumn: "1/-1", paddingBottom: "4px", borderBottom: "0.5px solid #eee" }}>Estatus de actividades</div>
                {VENTILACION_ITEMS_DER.map(item => (
                  <div key={item} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px", padding: "3px 0", borderBottom: "0.5px solid #f0f0f0", gridColumn: "1/-1" }}>
                    <span style={{ fontSize: "11px", color: "#333", flex: 1 }}>{item}</span>
                    <select value={(form.estatusItems||{})[item]||""} onChange={e => setEstatus(item, e.target.value)} disabled={soloLectura} style={{ fontSize: "11px", padding: "2px 4px", borderRadius: "4px", border: "0.5px solid #ccc", width: "100px" }}>
                      <option value="">—</option>
                      <option value="OK">OK</option>
                      <option value="Observado">Observado</option>
                      <option value="Falla">Falla</option>
                      <option value="N/A">N/A</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {form.grupo === "fancoil" && (
          <div style={s.sec}>
            <div style={s.secT}>💧 Parámetros — Fan Coil / UMA (formato Carrier)</div>
            <div style={s.secB}>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>

                {/* Columna izquierda: parámetros numéricos */}
                <div>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#1a5fa8", textAlign: "center", padding: "4px", background: "#f0f4f8", borderRadius: "4px", marginBottom: "8px" }}>PARÁMETROS</div>

                  {/* Voltaje en marcha */}
                  <div style={{ fontSize: "10px", color: "#888", marginBottom: "2px" }}>Voltaje en marcha (V)</div>
                  <div style={{ display: "grid", gridTemplateColumns: equipo?.fases === "Monofásico" ? "1fr" : "repeat(3,1fr)", gap: "4px", marginBottom: "6px" }}>
                    <CampoInput label="L1-L2" val={form.vL1L2} onChange={v => set("vL1L2", v)} />
                    {equipo?.fases !== "Monofásico" && <CampoInput label="L2-L3" val={form.vL2L3} onChange={v => set("vL2L3", v)} />}
                    {equipo?.fases !== "Monofásico" && <CampoInput label="L3-L1" val={form.vL3L1} onChange={v => set("vL3L1", v)} />}
                  </div>

                  {/* Voltaje en placa */}
                  <div style={{ fontSize: "10px", color: "#888", marginBottom: "2px" }}>Voltaje en placa (V) <span style={{fontSize:"9px",color:"#aaa"}}>(ficha equipo)</span></div>
                  <div style={{ display: "grid", gridTemplateColumns: equipo?.fases === "Monofásico" ? "1fr" : "repeat(3,1fr)", gap: "4px", marginBottom: "6px" }}>
                    <CampoInput label="L1-L2" val={equipo?.voltaje || ""} readOnly />
                    {equipo?.fases !== "Monofásico" && <CampoInput label="L2-L3" val={equipo?.voltaje || ""} readOnly />}
                    {equipo?.fases !== "Monofásico" && <CampoInput label="L3-L1" val={equipo?.voltaje || ""} readOnly />}
                  </div>
                  <Campo label="Desbalance V (auto) %" calc val={calcDesbalance(form.vL1L2, form.vL2L3, form.vL3L1)} />

                  {/* Amperaje en marcha */}
                  <div style={{ fontSize: "10px", color: "#888", margin: "8px 0 2px" }}>Amperaje en marcha (A)</div>
                  <div style={{ display: "grid", gridTemplateColumns: equipo?.fases === "Monofásico" ? "repeat(2,1fr)" : "repeat(3,1fr)", gap: "4px", marginBottom: "6px" }}>
                    <CampoInput label="L1" val={form.aL1} onChange={v => set("aL1", v)} />
                    <CampoInput label="L2" val={form.aL2} onChange={v => set("aL2", v)} />
                    {equipo?.fases !== "Monofásico" && <CampoInput label="L3" val={form.aL3} onChange={v => set("aL3", v)} />}
                  </div>

                  {/* Amperaje en placa */}
                  <div style={{ fontSize: "10px", color: "#888", marginBottom: "2px" }}>Amperaje en placa (A) <span style={{fontSize:"9px",color:"#aaa"}}>(ficha equipo)</span></div>
                  <div style={{ display: "grid", gridTemplateColumns: equipo?.fases === "Monofásico" ? "repeat(2,1fr)" : "repeat(3,1fr)", gap: "4px", marginBottom: "6px" }}>
                    <CampoInput label="L1" val={equipo?.amperaje || ""} readOnly />
                    <CampoInput label="L2" val={equipo?.amperaje || ""} readOnly />
                    {equipo?.fases !== "Monofásico" && <CampoInput label="L3" val={equipo?.amperaje || ""} readOnly />}
                  </div>
                  <Campo label="Desbalance A (auto) %" calc val={calcDesbalance(form.aL1, form.aL2, form.aL3)} />

                  <div style={{ fontSize: "10px", color: "#888", margin: "8px 0 2px" }}>Megado (Ω)</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "4px", marginBottom: "6px" }}>
                    <CampoInput label="L1-T" val={form.megL1T} onChange={v => set("megL1T", v)} />
                    <CampoInput label="L2-T" val={form.megL2T} onChange={v => set("megL2T", v)} />
                    <CampoInput label="L3-T" val={form.megL3T} onChange={v => set("megL3T", v)} />
                    <CampoInput label="L1-L2" val={form.megL1L2} onChange={v => set("megL1L2", v)} />
                    <CampoInput label="L2-L3" val={form.megL2L3} onChange={v => set("megL2L3", v)} />
                    <CampoInput label="L3-L1" val={form.megL3L1} onChange={v => set("megL3L1", v)} />
                  </div>

                  <div style={{ fontSize: "10px", color: "#888", margin: "8px 0 2px" }}>Temperaturas y presiones</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "4px" }}>
                    <CampoInput label="T° trabajo motor (°C)" val={form.tTrabajoMotor} onChange={v => set("tTrabajoMotor", v)} />
                    <CampoInput label="T° entrada agua (°C)" val={form.tEntradaAgua} onChange={v => set("tEntradaAgua", v)} />
                    <CampoInput label="T° salida agua (°C)" val={form.tSalidaAgua} onChange={v => set("tSalidaAgua", v)} />
                    <Campo label="∆ Temp. agua (°C)" calc val={calcDelta(form.tEntradaAgua, form.tSalidaAgua)} />
                    <CampoInput label="Presión entrada (PSI)" val={form.presEntradaAgua} onChange={v => set("presEntradaAgua", v)} />
                    <CampoInput label="Presión salida (PSI)" val={form.presSalidaAgua} onChange={v => set("presSalidaAgua", v)} />
                    <Campo label="∆ Presión agua (PSI)" calc val={calcDelta(form.presEntradaAgua, form.presSalidaAgua)} />
                    <CampoInput label="T° retorno aire (°C)" val={form.tRetornoAire} onChange={v => set("tRetornoAire", v)} />
                    <CampoInput label="T° suministro aire (°C)" val={form.tSuministroAire} onChange={v => set("tSuministroAire", v)} />
                    <Campo label="∆ Temp. aire (°C)" calc val={calcDelta(form.tRetornoAire, form.tSuministroAire)} />
                  </div>
                </div>

                {/* Columna derecha: ítems con Estatus */}
                <div>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#1a5fa8", textAlign: "center", padding: "4px", background: "#f0f4f8", borderRadius: "4px", marginBottom: "8px" }}>PARÁMETROS (ESTATUS)</div>
                  {FANCOIL_ITEMS_DER.map(item => (
                    <div key={item} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", padding: "3px 0", borderBottom: "0.5px solid #eee" }}>
                      <span style={{ fontSize: "11px", color: "#333", flex: 1 }}>{item}</span>
                      <select value={(form.estatusItems || {})[item] || ""} onChange={e => setEstatus(item, e.target.value)} disabled={soloLectura} style={{ fontSize: "11px", padding: "2px 4px", borderRadius: "4px", border: "0.5px solid #ccc", width: "100px" }}>
                        <option value="">—</option>
                        <option value="OK">OK</option>
                        <option value="Observado">Observado</option>
                        <option value="Falla">Falla</option>
                        <option value="N/A">N/A</option>
                      </select>
                    </div>
                  ))}
                </div>

              </div>
            </div>
          </div>
        )}

        {/* Actividades (solo para grupos que NO usan formato Carrier de estatus) */}
        {form.grupo !== "fancoil" && form.grupo !== "expansion" && form.grupo !== "ventilacion" && (
        <div style={s.sec}>
          <div style={s.secT}>✅ Actividades realizadas</div>
          <div style={s.secB}>
            <div style={s.gActividades}>
              {Object.entries(checklist).map(([cat, items]) => (
                <div key={cat}>
                  <div style={s.colH}>{cat}</div>
                  {items.map(item => (
                    <label key={item} style={s.ckRow}>
                      <input type="checkbox" checked={!!form.actividades[item]} onChange={e => setActividad(item, e.target.checked)} />
                      {item}
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
        )}

        {/* Observaciones dinámicas */}
        <div style={s.sec}>
          <div style={s.secT}>📋 Observación · Causa · Recomendación <span style={s.tag}>{form.observaciones.length} registro{form.observaciones.length !== 1 ? "s" : ""}</span></div>
          <div style={s.secB}>
            <div style={s.obsHead}>
              <span></span><span style={s.obsHeadLbl}>Observación</span><span style={s.obsHeadLbl}>Causa</span><span style={s.obsHeadLbl}>Recomendación</span><span></span>
            </div>
            {form.observaciones.map((o, i) => (
              <div key={i} style={s.obsFila}>
                <div style={s.obsNum}>{i + 1}</div>
                <textarea style={{ ...s.obsInp, background: "#fff8e1", borderColor: "#ffe082" }} placeholder="Observación..." value={o.obs} onChange={e => updateObs(i, "obs", e.target.value)} />
                <textarea style={{ ...s.obsInp, background: "#fef0f0", borderColor: "#f5c4c4" }} placeholder="Causa..." value={o.causa} onChange={e => updateObs(i, "causa", e.target.value)} />
                <textarea style={{ ...s.obsInp, background: "#e8f5e9", borderColor: "#a5d6a7" }} placeholder="Recomendación..." value={o.rec} onChange={e => updateObs(i, "rec", e.target.value)} />
                {!soloLectura && form.observaciones.length > 1 && <button style={s.obsDel} onClick={() => removeObs(i)}>🗑</button>}
              </div>
            ))}
            {!soloLectura && <button style={s.addBtn} onClick={addObs}>+ Agregar observación</button>}
          </div>
        </div>

        {/* Estado final */}
        <div style={s.sec}>
          <div style={s.secT}>🏁 Resultado del servicio</div>
          <div style={s.secB}>
            <div style={s.g2}>
              <CampoSelect label="Estado final del equipo" val={form.estadoFinal} onChange={v => set("estadoFinal", v)} opciones={["Operativo", "Operativo con observaciones", "Fuera de servicio"]} />
              <Campo label="Técnico responsable" auto val={form.tecnico} />
            </div>
          </div>
        </div>
        </fieldset>

        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "8px" }}>
          {!soloLectura && <button style={s.btnSaveBig} onClick={guardar} disabled={guardando}>{guardando ? "Guardando..." : "💾 Guardar protocolo"}</button>}
          <button style={s.btnPdfBig} onClick={exportarPDF}>📄 Descargar PDF</button>
        </div>
      </div>
    </div>
  );
}

// ============ COMPONENTES AUXILIARES ============
const Campo = ({ label, val, auto, calc }) => (
  <div style={s.f}>
    <label style={s.fLabel}>{label}</label>
    <div style={auto ? s.fAuto : calc ? s.fCalc : s.fPh}>{val || "—"}</div>
  </div>
);
const CampoInput = ({ label, val, onChange, placeholder, type, readOnly }) => (
  <div style={s.f}>
    <label style={s.fLabel}>{label}</label>
    <input style={{...s.fInp, ...(readOnly ? {background:"#f0f4f8", color:"#555", cursor:"not-allowed"} : {})}} type={type || "text"} value={val} placeholder={placeholder || ""} readOnly={readOnly} onChange={readOnly ? undefined : e => onChange(e.target.value)} />
  </div>
);
const CampoSelect = ({ label, val, onChange, opciones }) => (
  <div style={s.f}>
    <label style={s.fLabel}>{label}</label>
    <select style={s.fInp} value={val} onChange={e => onChange(e.target.value)}>
      {opciones.map(o => <option key={o}>{o}</option>)}
    </select>
  </div>
);

const s = {
  page: { minHeight: "100vh", background: "#f0f4f8", fontFamily: "Inter, Arial, sans-serif" },
  navbar: { padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10 },
  navTitle: { color: "white", fontSize: "14px", fontWeight: 500 },
  navSub: { color: "rgba(255,255,255,0.75)", fontSize: "11px", marginTop: "2px" },
  navBtns: { display: "flex", gap: "8px" },
  btnBack: { background: "rgba(255,255,255,0.2)", color: "white", border: "none", borderRadius: "8px", padding: "7px 12px", cursor: "pointer", fontSize: "12px", fontWeight: 500 },
  btnSave: { background: "#1e7e34", color: "white", border: "none", borderRadius: "8px", padding: "7px 12px", cursor: "pointer", fontSize: "12px", fontWeight: 500 },
  btnPdf: { background: "#c62828", color: "white", border: "none", borderRadius: "8px", padding: "7px 12px", cursor: "pointer", fontSize: "12px", fontWeight: 500 },
  content: { maxWidth: "1100px", margin: "0 auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: "12px" },
  histBar: { display: "flex", gap: "6px", alignItems: "center", padding: "10px 14px", background: "white", borderRadius: "10px", border: "0.5px solid #e0e0e0", flexWrap: "wrap" },
  histLabel: { fontSize: "11px", color: "#888", fontWeight: 500 },
  histCount: { marginLeft: "auto", fontSize: "10px", color: "#aaa" },
  chip: { fontSize: "11px", padding: "4px 10px", borderRadius: "20px", background: "#e8f0fe", color: "#1a5fa8", border: "0.5px solid #c5d5e8", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "5px" },
  chipActive: { background: "#1a5fa8", color: "white", borderColor: "#1a5fa8" },
  chipNew: { fontSize: "11px", padding: "4px 10px", borderRadius: "20px", background: "#e8f5e9", color: "#2e7d32", border: "0.5px solid #a5d6a7", cursor: "pointer" },
  chipDel: { fontSize: "10px", opacity: 0.8 },
  sec: { background: "white", border: "0.5px solid #e0e0e0", borderRadius: "10px", overflow: "hidden" },
  secT: { fontSize: "10px", color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 500, padding: "9px 14px", background: "#f8f9fa", borderBottom: "0.5px solid #e0e0e0", display: "flex", alignItems: "center", gap: "8px" },
  secB: { padding: "12px 14px" },
  tag: { fontSize: "8px", padding: "1px 7px", borderRadius: "20px", background: "#e8f0fe", color: "#1a5fa8", border: "0.5px solid #c5d5e8" },
  g4: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "8px" },
  g3: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "8px" },
  g2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" },
  gActividades: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "12px" },
  f: { display: "flex", flexDirection: "column", gap: "3px" },
  fLabel: { fontSize: "9px", color: "#888", textTransform: "uppercase", letterSpacing: "0.03em" },
  fPh: { fontSize: "11px", color: "#aaa", background: "#fafafa", padding: "7px 9px", borderRadius: "6px", border: "0.5px solid #ddd" },
  fAuto: { fontSize: "11px", fontWeight: 500, color: "#222", background: "#f0f4f8", padding: "7px 9px", borderRadius: "6px" },
  fCalc: { fontSize: "11px", fontWeight: 500, color: "#185fa5", background: "#e6f1fb", padding: "7px 9px", borderRadius: "6px", border: "0.5px solid #b5d4f4" },
  fInp: { fontSize: "11px", padding: "7px 9px", borderRadius: "6px", border: "0.5px solid #ddd", background: "#fafafa", color: "#222", width: "100%", boxSizing: "border-box" },
  lblRow: { fontSize: "9px", color: "#888", textTransform: "uppercase", marginBottom: "4px", display: "block" },
  row3: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "5px" },
  row2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px" },
  mini: { fontSize: "10px", padding: "6px 6px", borderRadius: "5px", border: "0.5px solid #ddd", background: "#fafafa", color: "#222", width: "100%", boxSizing: "border-box", textAlign: "center" },
  calc: { fontSize: "10px", padding: "6px", borderRadius: "5px", background: "#e6f1fb", color: "#185fa5", border: "0.5px solid #b5d4f4", textAlign: "center", fontWeight: 500 },
  colH: { fontSize: "9px", color: "#888", textTransform: "uppercase", fontWeight: 500, marginBottom: "6px" },
  ckRow: { display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "#222", padding: "3px 0", cursor: "pointer" },
  obsHead: { display: "grid", gridTemplateColumns: "24px 1fr 1fr 1fr 30px", gap: "8px", padding: "0 0 4px" },
  obsHeadLbl: { fontSize: "8px", color: "#aaa", textTransform: "uppercase", letterSpacing: "0.05em" },
  obsFila: { display: "grid", gridTemplateColumns: "24px 1fr 1fr 1fr 30px", gap: "8px", alignItems: "start", marginBottom: "8px" },
  obsNum: { fontSize: "11px", color: "#aaa", fontWeight: 700, paddingTop: "8px", textAlign: "center" },
  obsInp: { fontSize: "11px", color: "#222", padding: "7px 9px", borderRadius: "6px", border: "0.5px solid #ddd", width: "100%", minHeight: "38px", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" },
  obsDel: { background: "#ffebee", color: "#c62828", border: "0.5px solid #ef9a9a", borderRadius: "6px", cursor: "pointer", fontSize: "12px", padding: "7px 0", marginTop: "1px" },
  addBtn: { fontSize: "12px", padding: "8px 14px", borderRadius: "8px", cursor: "pointer", fontWeight: 500, border: "0.5px dashed #ffa726", background: "#fff8e1", color: "#e65100", marginTop: "4px" },
  btnSaveBig: { background: "#1e7e34", color: "white", border: "none", borderRadius: "8px", padding: "10px 18px", cursor: "pointer", fontSize: "13px", fontWeight: 500 },
  btnPdfBig: { background: "#c62828", color: "white", border: "none", borderRadius: "8px", padding: "10px 18px", cursor: "pointer", fontSize: "13px", fontWeight: 500 },
  centro: { textAlign: "center", padding: "3rem", fontSize: "15px", color: "#888", fontFamily: "Inter, Arial, sans-serif" },
};
