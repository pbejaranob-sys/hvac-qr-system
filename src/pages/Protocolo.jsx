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
  "VRV Evaporador": "expansion",
  "VRV Condensador": "expansion",
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
  aL1: "", aL2: "", aL3: "",
  megL1T: "", megL2T: "", megL3T: "",
  megL1L2: "", megL2L3: "", megL3L1: "",
  // Refrigeración (expansion)
  presSuccion: "", presLiquido: "", tSatMedida: "", tSatTabla: "",
  tRetornoEvap: "", tSuministroEvap: "", tAmbCondensador: "",
  calentadorAceite: false,
  // Ventilación
  tTrabajoMotor: "", caudalAire: "",
  // Fancoil agua
  tEntradaAgua: "", tSalidaAgua: "", presEntradaAgua: "", presSalidaAgua: "",
  tRetornoAire: "", tSuministroAire: "", velocidadVent: "",
  estadoValvula: "OK", funcionamientoDampers: "OK",
  sensorArranque: "OK", sensorTempAmb: "OK", sensorSuministro: "OK",
  sensorDifPresion: "OK", estadoContactores: "OK", estadoImpulsor: "OK",
  llaveTermo: "OK", balanceCaudal: "OK",
  // Actividades (checklist) - objeto dinámico
  actividades: {},
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
    "Limpieza": ["Limpieza filtros de aire", "Lavado de coil", "Limpieza bandeja condensado", "Limpieza de contactos"],
    "Mecánica": ["Lubricación chumaceras", "Templado de fajas", "Alineamiento de poleas", "Aislamiento térmico"],
    "Eléctrico": ["Lubricación de motores", "Verificación funcionamiento"],
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
        setSoloLectura(esLectura);
        cargarEquipo(esLectura);
      }
    });
    return () => unsub();
  }, [equipoId]);

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
        setForm(historial[0]);
        setIndexActual(0);
      } else {
        setProtocolos([]);
        if (!esLectura) {
          const nuevo = protocoloVacio(grupo);
          nuevo.observaciones = obsDesFicha(data);
          nuevo.estadoFinal = data.estado || "Operativo";
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

  const exportarPDF = () => {
    if (!equipo || !form) return;
    const grupo = GRUPOS[form.grupo];
    const pdf = new jsPDF("p", "mm", "a4");
    const M = 12; let y = 14;
    const W = 186;

    // Encabezado
    pdf.setFillColor(26, 95, 168); pdf.rect(0, 0, 210, 22, "F");
    pdf.setTextColor(255, 255, 255); pdf.setFont("helvetica", "bold"); pdf.setFontSize(13);
    pdf.text("PROTOCOLO DE MANTENIMIENTO", M, 10);
    pdf.setFontSize(9); pdf.setFont("helvetica", "normal");
    pdf.text(grupo.label, M, 17);
    y = 30;

    const linea = (label, valor, x, ancho) => {
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(7); pdf.setTextColor(110, 110, 110);
      pdf.text(label.toUpperCase(), x, y);
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(9); pdf.setTextColor(30, 30, 30);
      pdf.text(String(valor || "—"), x, y + 4.5);
    };

    const titulo = (txt) => {
      pdf.setFillColor(240, 244, 248); pdf.rect(M, y - 4, W, 6, "F");
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(8); pdf.setTextColor(26, 95, 168);
      pdf.text(txt.toUpperCase(), M + 2, y);
      y += 8;
    };

    // Datos del equipo
    titulo("Datos del equipo");
    linea("Cliente", equipo.cliente, M, 60); linea("Sede", equipo.sede, M + 62, 60); linea("Piso", equipo.piso, M + 124, 30); linea("Ambiente", equipo.ambiente, M + 150, 36);
    y += 11;
    linea("Marca", equipo.marca, M, 45); linea("Modelo", equipo.modelo, M + 47, 45); linea("N° Serie", equipo.serie, M + 94, 45); linea("Capacidad", equipo.capacidad ? equipo.capacidad + " BTU" : "—", M + 141, 45);
    y += 13;

    // Datos del servicio
    titulo("Datos del servicio");
    linea("Fecha", form.fecha, M, 45); linea("Técnico", form.tecnico, M + 47, 50); linea("Tipo servicio", form.tipoServicio, M + 99, 45); linea("N° Orden", form.ordenTrabajo, M + 146, 40);
    y += 13;

    // Parámetros eléctricos
    titulo("Parámetros eléctricos");
    pdf.setFontSize(8); pdf.setTextColor(60, 60, 60); pdf.setFont("helvetica", "normal");
    pdf.text(`Voltaje (V):  L1-L2: ${form.vL1L2 || "—"}   L2-L3: ${form.vL2L3 || "—"}   L3-L1: ${form.vL3L1 || "—"}   |  Desbalance: ${calcDesbalance(form.vL1L2, form.vL2L3, form.vL3L1) || "—"}%`, M, y); y += 5;
    pdf.text(`Amperaje (A):  L1: ${form.aL1 || "—"}   L2: ${form.aL2 || "—"}   L3: ${form.aL3 || "—"}   |  Desbalance: ${calcDesbalance(form.aL1, form.aL2, form.aL3) || "—"}%`, M, y); y += 5;
    pdf.text(`Megado (MΩ):  L1-T: ${form.megL1T || "—"}   L2-T: ${form.megL2T || "—"}   L3-T: ${form.megL3T || "—"}`, M, y); y += 8;

    // Parámetros específicos por grupo
    if (form.grupo === "expansion") {
      titulo("Parámetros de refrigeración");
      pdf.setFontSize(8); pdf.setTextColor(60, 60, 60);
      pdf.text(`Pres. succión: ${form.presSuccion || "—"} PSI   Pres. líquido: ${form.presLiquido || "—"} PSI   Superheat: ${calcDelta(form.tSatMedida, form.tSatTabla) || "—"} °F`, M, y); y += 5;
      pdf.text(`T° retorno aire: ${form.tRetornoEvap || "—"} °F   T° suministro: ${form.tSuministroEvap || "—"} °F   T° amb. condensador: ${form.tAmbCondensador || "—"} °F`, M, y); y += 8;
    } else if (form.grupo === "ventilacion") {
      titulo("Parámetros de operación");
      pdf.setFontSize(8); pdf.setTextColor(60, 60, 60);
      pdf.text(`Temp. trabajo motor: ${form.tTrabajoMotor || "—"} °F   Caudal de aire: ${form.caudalAire || "—"} CFM`, M, y); y += 8;
    } else if (form.grupo === "fancoil") {
      titulo("Parámetros de agua y aire");
      pdf.setFontSize(8); pdf.setTextColor(60, 60, 60);
      pdf.text(`Agua  →  T° ent: ${form.tEntradaAgua || "—"}°F   T° sal: ${form.tSalidaAgua || "—"}°F   ∆T: ${calcDelta(form.tEntradaAgua, form.tSalidaAgua) || "—"}   Pres ent: ${form.presEntradaAgua || "—"}   Pres sal: ${form.presSalidaAgua || "—"}   ∆P: ${calcDelta(form.presEntradaAgua, form.presSalidaAgua) || "—"}`, M, y); y += 5;
      pdf.text(`Aire  →  T° retorno: ${form.tRetornoAire || "—"}°F   T° suministro: ${form.tSuministroAire || "—"}°F   ∆T: ${calcDelta(form.tRetornoAire, form.tSuministroAire) || "—"}`, M, y); y += 8;
    }

    // Actividades
    titulo("Actividades realizadas");
    pdf.setFontSize(8); pdf.setTextColor(60, 60, 60);
    const cl = CHECKLISTS[form.grupo] || {};
    Object.entries(cl).forEach(([cat, items]) => {
      const hechas = items.filter(it => form.actividades[it]);
      if (hechas.length > 0) {
        pdf.setFont("helvetica", "bold"); pdf.text(cat + ":", M, y);
        pdf.setFont("helvetica", "normal");
        const txt = hechas.join(", ");
        const split = pdf.splitTextToSize(txt, W - 25);
        pdf.text(split, M + 22, y);
        y += split.length * 4 + 2;
      }
    });
    y += 4;

    // Observaciones
    const obsValidas = form.observaciones.filter(o => o.obs?.trim());
    if (obsValidas.length > 0) {
      if (y > 250) { pdf.addPage(); y = 20; }
      titulo("Observaciones · Causa · Recomendación");
      obsValidas.forEach((o, i) => {
        if (y > 270) { pdf.addPage(); y = 20; }
        pdf.setFont("helvetica", "bold"); pdf.setFontSize(8); pdf.setTextColor(30, 30, 30);
        pdf.text(`${i + 1}. ${o.obs}`, M, y); y += 4;
        pdf.setFont("helvetica", "normal"); pdf.setTextColor(90, 90, 90);
        if (o.causa) { pdf.text(pdf.splitTextToSize(`Causa: ${o.causa}`, W - 4), M + 4, y); y += 4; }
        if (o.rec) { pdf.text(pdf.splitTextToSize(`Recomendación: ${o.rec}`, W - 4), M + 4, y); y += 4; }
        y += 2;
      });
    }

    // Estado final + firma
    if (y > 250) { pdf.addPage(); y = 20; }
    y += 4;
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(8); pdf.setTextColor(60, 60, 60);
    pdf.text(`Estado final del equipo: ${form.estadoFinal}`, M, y); y += 14;
    pdf.setDrawColor(180, 180, 180); pdf.line(M, y, M + 60, y);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(7); pdf.setTextColor(120, 120, 120);
    pdf.text(`Firma técnico: ${form.tecnico || ""}`, M, y + 4);

    pdf.save(`protocolo-${equipo.cliente?.replace(/\s+/g, "-")}-${form.fecha}.pdf`);
  };

  if (cargando) return <div style={s.centro}>Cargando protocolo...</div>;
  if (!equipo) return <div style={s.centro}>Equipo no encontrado.</div>;

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
              <Campo label="Capacidad" auto val={equipo.capacidad ? equipo.capacidad + " BTU" : ""} />
            </div>
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

        {/* Parámetros eléctricos (comunes) */}
        <div style={s.sec}>
          <div style={s.secT}>⚡ Parámetros eléctricos</div>
          <div style={s.secB}>
            <div style={s.g3}>
              <div>
                <label style={s.lblRow}>Voltaje en marcha (V)</label>
                <div style={s.row3}>
                  <input style={s.mini} placeholder="L1-L2" value={form.vL1L2} onChange={e => set("vL1L2", e.target.value)} />
                  <input style={s.mini} placeholder="L2-L3" value={form.vL2L3} onChange={e => set("vL2L3", e.target.value)} />
                  <input style={s.mini} placeholder="L3-L1" value={form.vL3L1} onChange={e => set("vL3L1", e.target.value)} />
                </div>
              </div>
              <div>
                <label style={s.lblRow}>Amperaje en marcha (A)</label>
                <div style={s.row3}>
                  <input style={s.mini} placeholder="L1" value={form.aL1} onChange={e => set("aL1", e.target.value)} />
                  <input style={s.mini} placeholder="L2" value={form.aL2} onChange={e => set("aL2", e.target.value)} />
                  <input style={s.mini} placeholder="L3" value={form.aL3} onChange={e => set("aL3", e.target.value)} />
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
        </div>

        {/* Parámetros específicos por grupo */}
        {form.grupo === "expansion" && (
          <div style={s.sec}>
            <div style={s.secT}>❄️ Parámetros de refrigeración</div>
            <div style={s.secB}>
              <div style={s.g4}>
                <CampoInput label="Presión succión (PSI)" val={form.presSuccion} onChange={v => set("presSuccion", v)} />
                <CampoInput label="Presión líquido (PSI)" val={form.presLiquido} onChange={v => set("presLiquido", v)} />
                <CampoInput label="T° sat. succión medida (°F)" val={form.tSatMedida} onChange={v => set("tSatMedida", v)} />
                <CampoInput label="T° sat. succión tabla (°F)" val={form.tSatTabla} onChange={v => set("tSatTabla", v)} />
                <Campo label="Superheat (auto)" calc val={calcDelta(form.tSatMedida, form.tSatTabla) ? calcDelta(form.tSatMedida, form.tSatTabla) + " °F" : ""} />
                <CampoInput label="T° retorno aire (°F)" val={form.tRetornoEvap} onChange={v => set("tRetornoEvap", v)} />
                <CampoInput label="T° suministro aire (°F)" val={form.tSuministroEvap} onChange={v => set("tSuministroEvap", v)} />
                <CampoInput label="T° amb. condensador (°F)" val={form.tAmbCondensador} onChange={v => set("tAmbCondensador", v)} />
              </div>
            </div>
          </div>
        )}

        {form.grupo === "ventilacion" && (
          <div style={s.sec}>
            <div style={s.secT}>🌀 Parámetros de operación</div>
            <div style={s.secB}>
              <div style={s.g4}>
                <CampoInput label="Temp. trabajo motor (°F)" val={form.tTrabajoMotor} onChange={v => set("tTrabajoMotor", v)} />
                <CampoInput label="Caudal de aire (CFM)" val={form.caudalAire} onChange={v => set("caudalAire", v)} />
              </div>
            </div>
          </div>
        )}

        {form.grupo === "fancoil" && (
          <>
            <div style={s.sec}>
              <div style={s.secT}>💧 Parámetros de agua helada</div>
              <div style={s.secB}>
                <div style={s.g4}>
                  <CampoInput label="T° entrada agua (°F)" val={form.tEntradaAgua} onChange={v => set("tEntradaAgua", v)} />
                  <CampoInput label="T° salida agua (°F)" val={form.tSalidaAgua} onChange={v => set("tSalidaAgua", v)} />
                  <Campo label="∆ Temp. agua (auto)" calc val={calcDelta(form.tEntradaAgua, form.tSalidaAgua)} />
                  <div></div>
                  <CampoInput label="Presión entrada (PSI)" val={form.presEntradaAgua} onChange={v => set("presEntradaAgua", v)} />
                  <CampoInput label="Presión salida (PSI)" val={form.presSalidaAgua} onChange={v => set("presSalidaAgua", v)} />
                  <Campo label="∆ Presión (auto)" calc val={calcDelta(form.presEntradaAgua, form.presSalidaAgua)} />
                  <CampoSelect label="Estado válvula" val={form.estadoValvula} onChange={v => set("estadoValvula", v)} opciones={["OK", "Observado", "Falla"]} />
                </div>
              </div>
            </div>
            <div style={s.sec}>
              <div style={s.secT}>🌬️ Parámetros de aire</div>
              <div style={s.secB}>
                <div style={s.g4}>
                  <CampoInput label="T° retorno aire (°F)" val={form.tRetornoAire} onChange={v => set("tRetornoAire", v)} />
                  <CampoInput label="T° suministro aire (°F)" val={form.tSuministroAire} onChange={v => set("tSuministroAire", v)} />
                  <Campo label="∆ Temp. aire (auto)" calc val={calcDelta(form.tRetornoAire, form.tSuministroAire)} />
                  <CampoInput label="Velocidad ventiladores (RPM)" val={form.velocidadVent} onChange={v => set("velocidadVent", v)} />
                </div>
              </div>
            </div>
            <div style={s.sec}>
              <div style={s.secT}>🎛️ Sensores y control</div>
              <div style={s.secB}>
                <div style={s.g4}>
                  <CampoSelect label="Sensor arranque/parada" val={form.sensorArranque} onChange={v => set("sensorArranque", v)} opciones={["OK", "Observado", "Falla"]} />
                  <CampoSelect label="Sensor temp. ambiente" val={form.sensorTempAmb} onChange={v => set("sensorTempAmb", v)} opciones={["OK", "Observado", "Falla"]} />
                  <CampoSelect label="Sensor suministro aire" val={form.sensorSuministro} onChange={v => set("sensorSuministro", v)} opciones={["OK", "Observado", "Falla"]} />
                  <CampoSelect label="Sensor dif. presión" val={form.sensorDifPresion} onChange={v => set("sensorDifPresion", v)} opciones={["OK", "Observado", "Falla"]} />
                  <CampoSelect label="Estado contactores" val={form.estadoContactores} onChange={v => set("estadoContactores", v)} opciones={["OK", "Observado", "Falla"]} />
                  <CampoSelect label="Estado impulsor aire" val={form.estadoImpulsor} onChange={v => set("estadoImpulsor", v)} opciones={["OK", "Observado", "Falla"]} />
                  <CampoSelect label="Llave termomagnética" val={form.llaveTermo} onChange={v => set("llaveTermo", v)} opciones={["OK", "Observado", "Falla"]} />
                  <CampoSelect label="Balance caudal aire" val={form.balanceCaudal} onChange={v => set("balanceCaudal", v)} opciones={["OK", "Observado", "Falla"]} />
                </div>
              </div>
            </div>
          </>
        )}

        {/* Actividades */}
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
const CampoInput = ({ label, val, onChange, placeholder, type }) => (
  <div style={s.f}>
    <label style={s.fLabel}>{label}</label>
    <input style={s.fInp} type={type || "text"} value={val} placeholder={placeholder || ""} onChange={e => onChange(e.target.value)} />
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
