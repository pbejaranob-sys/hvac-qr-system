import { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { collection, addDoc, doc, getDoc, updateDoc } from "firebase/firestore";
import { useNavigate, useSearchParams } from "react-router-dom";

const FONT = "'Manrope', -apple-system, sans-serif";

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

const getEstadoStyle = (estado) => {
  if (estado === "Operativo") return { background: "#e6f7ec", color: "#1c7a44" };
  if (estado === "Operativo con observaciones") return { background: "#fff3d6", color: "#a8720b" };
  return { background: "#fdeeee", color: "#a52b2b" };
};

const FRECUENCIAS = {
  mensual: { label: "Mensual (12/año)", labels: ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"] },
  bimensual: { label: "Bimensual (6/año)", labels: ["Ene-Feb", "Mar-Abr", "May-Jun", "Jul-Ago", "Sep-Oct", "Nov-Dic"] },
  trimestral: { label: "Trimestral (4/año)", labels: ["1er Trimestre", "2do Trimestre", "3er Trimestre", "4to Trimestre"] },
  cuatrimestral: { label: "Cuatrimestral (3/año)", labels: ["1er Cuatrimestre", "2do Cuatrimestre", "3er Cuatrimestre"] },
  semestral: { label: "Semestral (2/año)", labels: ["1er Semestre", "2do Semestre"] },
  anual: { label: "Anual (1/año)", labels: ["Anual"] },
};

const generarCronograma = (frecuencia) =>
  FRECUENCIAS[frecuencia].labels.map(label => ({ label, fecha: "", estado: "programado" }));

// ---- Iconos SVG inline (evitan problemas de codificación de emoji) ----
const SvgFlecha = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ display: "inline", verticalAlign: "-2px" }}>
    <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const SvgGuardar = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ verticalAlign: "-3px", marginRight: "6px" }}>
    <path d="M5 12l4 4 10-10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const SvgSede = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ marginTop: "2px", flexShrink: 0 }}>
    <path d="M4 21V7l8-4 8 4v14M9 21v-6h6v6" stroke="#1a4fc0" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const SvgPin = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ marginTop: "2px", flexShrink: 0 }}>
    <path d="M12 21s7-6.5 7-11.5A7 7 0 0 0 5 9.5C5 14.5 12 21 12 21z" stroke="#8a92a6" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="12" cy="9.5" r="2.3" stroke="#8a92a6" strokeWidth="1.7" />
  </svg>
);
const SvgFicha = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
    <rect x="4" y="4" width="16" height="16" rx="2" stroke="#1a4fc0" strokeWidth="1.7" />
    <path d="M8 9h8M8 13h5" stroke="#1a4fc0" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);
const SvgTecnica = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
    <rect x="4.5" y="4" width="15" height="17" rx="1.6" stroke="#1a4fc0" strokeWidth="1.7" />
    <path d="M9.2 4.6a2.8 2.8 0 0 1 5.6 0" stroke="#1a4fc0" strokeWidth="1.7" />
  </svg>
);
const SvgRayo = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
    <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" stroke="#d99a1c" strokeWidth="1.7" strokeLinejoin="round" />
  </svg>
);
const SvgGota = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
    <path d="M12 2c3 4 6 7.5 6 11.5A6 6 0 0 1 6 13.5C6 9.5 9 6 12 2z" stroke="#1a4fc0" strokeWidth="1.7" strokeLinejoin="round" />
  </svg>
);
const SvgLlave = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
    <path d="M14.7 6.3a3 3 0 0 1-3.9 3.9L5 16v3h3l5.8-5.8a3 3 0 0 1 3.9-3.9l-2.2 2.2-1.4-1.4 2.2-2.2z" stroke="#1a4fc0" strokeWidth="1.7" strokeLinejoin="round" />
  </svg>
);
const SvgCalendario = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
    <rect x="4" y="5" width="16" height="15" rx="2" stroke="#1a4fc0" strokeWidth="1.7" />
    <path d="M4 10h16M8 3v4M16 3v4" stroke="#1a4fc0" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);
const SvgAlerta = ({ color = "#d99a1c" }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
    <path d="M12 3l9 16H3l9-16z" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 10v4M12 17h.01" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);
const SvgEliminar = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const SvgMas = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ verticalAlign: "-2px", marginRight: "4px" }}>
    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export default function RegistrarEquipo() {
  useManropeAndBodyReset();

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const equipoId = searchParams.get("id");
  const clienteParam = searchParams.get("cliente") || "";
  const sedeParam = searchParams.get("sede") || "";
  const [guardando, setGuardando] = useState(false);
  const [frecuencia, setFrecuencia] = useState("trimestral");

  const [form, setForm] = useState({
    cliente: clienteParam, sede: sedeParam, codigo: "", piso: "", ambiente: "", tipoEquipo: "",
    marca: "", modelo: "", serie: "", capacidad: "", tipoRefrigerante: "", cargaNominal: "",
    voltaje: "", amperaje: "", fases: "Monofásico", ubicacion: "",
    condVoltaje: "", condAmperaje: "", modeloCompresor: "",
    fancoilNum: "", contrato: "", modeloFaja: "", numFajas: "", marcaMotor: "", modeloMotor: "", serieMotor: "",
    estado: "Operativo", ultimoMantenimiento: "",
  });

  const [observaciones, setObservaciones] = useState([{ texto: "", fecha: "", tecnico: "" }]);
  const [correctivos, setCorrectivos] = useState([{ descripcion: "", fecha: "" }]);
  const [recomendaciones, setRecomendaciones] = useState([""]);
  const [cronograma, setCronograma] = useState(generarCronograma("trimestral"));

  useEffect(() => { if (equipoId) cargarEquipo(); }, [equipoId]);

  const handleFrecuencia = (f) => {
    setFrecuencia(f);
    setCronograma(generarCronograma(f));
  };

  const cargarEquipo = async () => {
    const ref = doc(db, "equipos", equipoId);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data();
      setForm({
        cliente: data.cliente || "", codigo: data.codigo || "",
        piso: data.piso || "", ambiente: data.ambiente || "",
        tipoEquipo: data.tipoEquipo || "", marca: data.marca || "",
        modelo: data.modelo || "", serie: data.serie || "",
        capacidad: data.capacidad || "", tipoRefrigerante: data.tipoRefrigerante || "", cargaNominal: data.cargaNominal || "",
        voltaje: data.voltaje || "", amperaje: data.amperaje || "",
        condVoltaje: data.condVoltaje || "", condAmperaje: data.condAmperaje || "",
        modeloCompresor: data.modeloCompresor || "",
        fases: data.fases || "Monofásico", ubicacion: data.ubicacion || "",
        fancoilNum: data.fancoilNum || "", contrato: data.contrato || "",
        modeloFaja: data.modeloFaja || "", numFajas: data.numFajas || "",
        marcaMotor: data.marcaMotor || "", modeloMotor: data.modeloMotor || "",
        serieMotor: data.serieMotor || "",
        estado: data.estado || "Operativo",
        ultimoMantenimiento: data.ultimoMantenimiento || "",
      });
      if (data.observacionesArray && data.observacionesArray.length > 0) {
        const migradas = data.observacionesArray.map(o =>
          typeof o === "string" ? { texto: o, fecha: "", tecnico: "" } : o
        );
        setObservaciones(migradas);
      } else if (data.observaciones) {
        setObservaciones(data.observaciones.split(/\n|;/).map(o => ({ texto: o.trim(), fecha: "", tecnico: "" })).filter(o => o.texto));
      }
      if (data.correctivosArray && data.correctivosArray.length > 0) {
        setCorrectivos(data.correctivosArray);
      } else if (data.correctivos) {
        const corList = data.correctivos.split(/\n|;/).map(c => c.trim()).filter(Boolean);
        setCorrectivos(corList.map(c => ({ descripcion: c, fecha: "" })));
      }
      if (data.recomendacionesArray && data.recomendacionesArray.length > 0) {
        setRecomendaciones(data.recomendacionesArray);
      } else if (data.recomendaciones) {
        setRecomendaciones(data.recomendaciones.split(/\n|;/).map(r => r.trim()).filter(Boolean));
      }
      if (data.cronograma && data.cronograma.length > 0) {
        setCronograma(data.cronograma);
        if (data.frecuencia) setFrecuencia(data.frecuencia);
      }
    }
  };

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const addObs = () => setObservaciones([...observaciones, { texto: "", fecha: "", tecnico: "" }]);
  const removeObs = (i) => setObservaciones(observaciones.filter((_, idx) => idx !== i));
  const updateObs = (i, field, val) => { const n = [...observaciones]; n[i] = { ...n[i], [field]: val }; setObservaciones(n); };

  const addCor = () => setCorrectivos([...correctivos, { descripcion: "", fecha: "" }]);
  const removeCor = (i) => setCorrectivos(correctivos.filter((_, idx) => idx !== i));
  const updateCor = (i, field, val) => { const n = [...correctivos]; n[i] = { ...n[i], [field]: val }; setCorrectivos(n); };

  const addRec = () => setRecomendaciones([...recomendaciones, ""]);
  const removeRec = (i) => setRecomendaciones(recomendaciones.filter((_, idx) => idx !== i));
  const updateRec = (i, val) => { const n = [...recomendaciones]; n[i] = val; setRecomendaciones(n); };

  const updateCron = (i, field, val) => { const n = [...cronograma]; n[i] = { ...n[i], [field]: val }; setCronograma(n); };

  const cronColor = (estado) => ({
    realizado: { bg: "#e6f7ec", border: "#c3ecd2", color: "#1c7a44" },
    pendiente: { bg: "#fff3d6", border: "#f3dfa3", color: "#a8720b" },
    programado: { bg: "#f4f6fb", border: "#e7ebf3", color: "#8a92a6" },
  }[estado] || { bg: "#f4f6fb", border: "#e7ebf3", color: "#8a92a6" });

  const irAtras = () => {
    if (sedeParam && clienteParam) navigate(`/cliente/${encodeURIComponent(clienteParam)}/sede/${encodeURIComponent(sedeParam)}`);
    else if (clienteParam) navigate(`/cliente/${encodeURIComponent(clienteParam)}`);
    else navigate(-1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      const obsFiltered = observaciones.filter(o => o.texto?.trim());
      const corFiltered = correctivos.filter(c => c.descripcion.trim());
      const recFiltered = recomendaciones.filter(r => r.trim());
      const data = {
        ...form,
        observacionesArray: obsFiltered,
        observaciones: obsFiltered.map(o => o.texto).join("\n"),
        correctivosArray: corFiltered,
        correctivos: corFiltered.map(c => c.descripcion).join("\n"),
        recomendacionesArray: recFiltered,
        recomendaciones: recFiltered.join("\n"),
        cronograma,
        frecuencia,
      };
      if (equipoId) {
        await updateDoc(doc(db, "equipos", equipoId), data);
        alert("Equipo actualizado correctamente");
      } else {
        await addDoc(collection(db, "equipos"), {
          ...data,
          sede: form.sede || sedeParam,
          adminid: auth.currentUser?.uid || "",
          fechaRegistro: new Date().toLocaleDateString("es-PE")
        });
        alert("Equipo registrado correctamente");
      }
      irAtras();
    } catch (error) {
      alert("Error al guardar: " + error.message);
    }
    setGuardando(false);
  };

  const gridCols = cronograma.length <= 2 ? "1fr 1fr" : cronograma.length <= 4 ? `repeat(${cronograma.length}, 1fr)` : "repeat(4, 1fr)";

  const esVentilacion = ["Ventilación", "Extractor", "Inyector", "Cortina de aire", "Jetfan", "Presurizador"].includes(form.tipoEquipo);
  const esFancoilOMotor = ["Fan Coil", "UMA", "Manejadora de Aire", "Fancoil AH", "UMA AH"].some(t => (form.tipoEquipo || "").toLowerCase().includes(t.toLowerCase().split(" ")[0])) || esVentilacion;
  // Split/VRV/Chiller usan refrigerante; Fan Coil/UMA usan agua helada (no aplica).
  const esConRefrigerante = [
    "Split Piso Techo", "Split Pared", "Split Ducto", "Split Fancoil", "Split Cassete",
    "Ventana", "Autocontenido", "Precisión", "VRV Evaporador", "VRV Condensador", "Chiller",
  ].includes(form.tipoEquipo);

  return (
    <div style={s.page}>
      <form onSubmit={handleSubmit}>
        <div style={s.navbar}>
          <div style={s.navLeft}>
            <div style={s.logoBox}><img src="/assets/hvac-isotipo-blue.png" alt="HVAC" style={s.logoImg} /></div>
            <span style={s.navBrand}>{form.cliente || clienteParam || "HVAC"}{(form.sede || sedeParam) ? ` / ${form.sede || sedeParam}` : ""}</span>
            <button type="button" style={s.btnBack} onClick={irAtras}><SvgFlecha /> Volver</button>
            <div style={s.navDivider}></div>
            <span style={s.navTitle}>{equipoId ? "Editar equipo" : "Registrar equipo"}</span>
          </div>
          <span style={s.navSub}>
            {equipoId ? `Editando: ${form.codigo || equipoId.slice(0, 6).toUpperCase()}` : "Nuevo equipo"}
          </span>
        </div>

        <div style={s.content}>
          <div style={s.layout}>

            {/* SIDEBAR */}
            <div style={s.sidebar}>
              <div style={s.sideCardCenter}>
                <div style={s.sideIconBox}><SvgTecnica /></div>
                <div style={{ fontSize: "12px", color: "#8a92a6", fontWeight: 700 }}>
                  {equipoId ? "Editando equipo" : "Nuevo equipo"}
                </div>
                {form.codigo && <span style={s.codigoTag}>{form.codigo}</span>}
              </div>

              <div style={s.sideCard}>
                <div style={s.sideLabel}>Estado actual</div>
                <span style={{ ...s.badgeEstado, ...getEstadoStyle(form.estado) }}>{form.estado || "Operativo"}</span>
              </div>

              {form.cliente && (
                <div style={s.sideCard}>
                  <div style={s.sideLabel}>Cliente</div>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", marginTop: "8px" }}>
                    <SvgSede />
                    <div style={s.sideVal}>{form.cliente}</div>
                  </div>
                  {form.piso && (
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", marginTop: "8px" }}>
                      <SvgPin />
                      <div style={{ ...s.sideVal, color: "#8a92a6", fontWeight: 600 }}>Piso {form.piso} · {form.ambiente}</div>
                    </div>
                  )}
                </div>
              )}

              <button type="submit" style={s.btnGuardar} disabled={guardando}>
                {guardando ? "Guardando..." : <><SvgGuardar />{equipoId ? "Actualizar" : "Guardar"}</>}
              </button>
              <button type="button" style={s.btnCancelar} onClick={irAtras}>Cancelar</button>
            </div>

            {/* MAIN */}
            <div style={s.main}>

              {/* Datos generales */}
              <div style={s.seccion}>
                <div style={s.secTitulo}><SvgFicha /> Datos generales</div>
                {(clienteParam || sedeParam) && (
                  <div style={s.bannerCliente}>
                    <SvgSede />
                    <div>
                      <div style={{ fontSize: "13.5px", fontWeight: 700, color: "#1a4fc0" }}>{clienteParam}</div>
                      {sedeParam && <div style={{ fontSize: "11.5px", color: "#6b8cae", marginTop: "2px", fontWeight: 600 }}>Sede: {sedeParam}</div>}
                    </div>
                  </div>
                )}
                <div style={s.grid2}>
                  {!clienteParam && (
                    <div><label style={s.label}>Cliente / Empresa</label><input style={s.input} name="cliente" placeholder="La Positiva..." value={form.cliente} onChange={handleChange} required /></div>
                  )}
                  <div><label style={s.label}>Código del equipo</label><input style={s.input} name="codigo" placeholder="SP-01..." value={form.codigo} onChange={handleChange} /></div>
                  <div><label style={s.label}>Piso</label><input style={s.input} name="piso" placeholder="1, 2, Sótano..." value={form.piso} onChange={handleChange} /></div>
                  <div><label style={s.label}>Ambiente</label><input style={s.input} name="ambiente" placeholder="Oficina, Comedor..." value={form.ambiente} onChange={handleChange} /></div>
                  <div><label style={s.label}>Contrato</label><input style={s.input} name="contrato" placeholder="N° de contrato" value={form.contrato} onChange={handleChange} /></div>
                </div>
              </div>

              {/* Ficha técnica */}
              <div style={s.seccion}>
                <div style={s.secTitulo}><SvgTecnica /> {esVentilacion ? "Datos del ventilador" : "Ficha técnica"}</div>
                <div style={s.grid2}>
                  <div>
                    <label style={s.label}>Tipo de equipo</label>
                    <select style={s.input} name="tipoEquipo" value={form.tipoEquipo} onChange={handleChange}>
                      <option value="">Seleccionar...</option>
                      <optgroup label="Split">
                        <option>Split Piso Techo</option>
                        <option>Split Pared</option>
                        <option>Split Ducto</option>
                        <option>Split Fancoil</option>
                        <option>Split Cassete</option>
                        <option>Ventana</option>
                        <option>Autocontenido</option>
                        <option>Precisión</option>
                      </optgroup>
                      <optgroup label="VRV">
                        <option>VRV Evaporador</option>
                        <option>VRV Condensador</option>
                      </optgroup>
                      <optgroup label="Agua Helada">
                        <option>Fancoil AH</option>
                        <option>Pared AH</option>
                        <option>UMA AH</option>
                      </optgroup>
                      <optgroup label="Ventilación">
                        <option>Ventilación</option>
                        <option>Extractor</option>
                        <option>Inyector</option>
                        <option>Cortina de aire</option>
                        <option>Jetfan</option>
                        <option>Presurizador</option>
                      </optgroup>
                      <optgroup label="Otros">
                        <option>Chiller</option>
                        <option>Torre de Enfriamiento</option>
                        <option>Bombas de agua</option>
                        <option>Otro</option>
                      </optgroup>
                    </select>
                  </div>
                  <div><label style={s.label}>Marca</label><input style={s.input} name="marca" placeholder="Daikin, LG, Midea..." value={form.marca} onChange={handleChange} required /></div>
                  <div><label style={s.label}>Modelo</label><input style={s.input} name="modelo" placeholder="FTXS35KVMA" value={form.modelo} onChange={handleChange} /></div>
                  <div><label style={s.label}>N° de Serie</label><input style={s.input} name="serie" placeholder="D4Y0041045" value={form.serie} onChange={handleChange} /></div>
                  <div><label style={s.label}>Capacidad ({esVentilacion ? "CFM" : "BTU"})</label><input style={s.input} name="capacidad" placeholder={esVentilacion ? "500, 1000..." : "12000, 18000..."} value={form.capacidad} onChange={handleChange} /></div>
                  {!esVentilacion && <div><label style={s.label}>Modelo de compresor</label><input style={s.input} name="modeloCompresor" placeholder="Modelo compresor..." value={form.modeloCompresor} onChange={handleChange} /></div>}
                  {!esVentilacion && (
                    <div>
                      <label style={s.label}>Tipo de refrigerante</label>
                      <select style={s.input} name="tipoRefrigerante" value={form.tipoRefrigerante} onChange={handleChange}>
                        <option value="">Seleccionar...</option>
                        {["R-22", "R-410A", "R-32", "R-407C", "R-134A", "Otro"].map(r => <option key={r}>{r}</option>)}
                      </select>
                    </div>
                  )}
                  {esConRefrigerante && (
                    <div>
                      <label style={s.label}>Carga nominal de refrigerante (kg)</label>
                      <input style={s.input} name="cargaNominal" type="number" step="0.1" placeholder="1.8, 6.5, 18.0..." value={form.cargaNominal} onChange={handleChange} />
                    </div>
                  )}
                </div>
              </div>

              {/* Datos eléctricos */}
              <div style={s.seccion}>
                <div style={s.secTitulo}><SvgRayo /> Datos eléctricos</div>
                <div style={s.grid3}>
                  <div>
                    <label style={s.label}>Fases</label>
                    <select style={s.input} name="fases" value={form.fases} onChange={handleChange}>
                      <option>Monofásico</option><option>Trifásico</option>
                    </select>
                  </div>
                  <div><label style={s.label}>Voltaje nominal (V)</label><input style={s.input} name="voltaje" placeholder="220" value={form.voltaje} onChange={handleChange} /></div>
                  <div><label style={s.label}>Amperaje nominal (A)</label><input style={s.input} name="amperaje" placeholder="15" value={form.amperaje} onChange={handleChange} /></div>
                  {!esVentilacion && <div><label style={s.label}>Voltaje condensador (V)</label><input style={s.input} name="condVoltaje" placeholder="220" value={form.condVoltaje} onChange={handleChange} /></div>}
                  {!esVentilacion && <div><label style={s.label}>Amperaje condensador (A)</label><input style={s.input} name="condAmperaje" placeholder="15" value={form.condAmperaje} onChange={handleChange} /></div>}
                </div>
              </div>

              {/* Datos contrato + faja + motor - Fan Coil/UMA y Ventilación */}
              {esFancoilOMotor && (
                <div style={s.seccion}>
                  <div style={s.secTitulo}><SvgGota /> {esVentilacion ? "Datos de motor" : "Datos Fan Coil / UMA"}</div>
                  <div style={s.grid3}>
                    {!esVentilacion && <div><label style={s.label}>Contrato</label><input style={s.input} name="contrato" placeholder="N° de contrato" value={form.contrato} onChange={handleChange} /></div>}
                    {!esVentilacion && <div><label style={s.label}>UMA / Fan Coil N°</label><input style={s.input} name="fancoilNum" placeholder="FC-01..." value={form.fancoilNum} onChange={handleChange} /></div>}
                    <div><label style={s.label}>Modelo de faja</label><input style={s.input} name="modeloFaja" placeholder="A65, B78..." value={form.modeloFaja} onChange={handleChange} /></div>
                    <div><label style={s.label}>Número de fajas</label><input style={s.input} name="numFajas" placeholder="1, 2..." value={form.numFajas} onChange={handleChange} /></div>
                    <div><label style={s.label}>Marca de motor</label><input style={s.input} name="marcaMotor" placeholder="WEG, Siemens..." value={form.marcaMotor} onChange={handleChange} /></div>
                    <div><label style={s.label}>Modelo de motor</label><input style={s.input} name="modeloMotor" placeholder="Modelo motor..." value={form.modeloMotor} onChange={handleChange} /></div>
                    <div><label style={s.label}>N° serie de motor</label><input style={s.input} name="serieMotor" placeholder="Serie motor..." value={form.serieMotor} onChange={handleChange} /></div>
                  </div>
                </div>
              )}

              {/* Mantenimiento */}
              <div style={s.seccion}>
                <div style={s.secTitulo}><SvgLlave /> Mantenimiento</div>
                <div style={s.grid2}>
                  <div>
                    <label style={s.label}>Estado del equipo</label>
                    <select style={s.input} name="estado" value={form.estado} onChange={handleChange}>
                      <option>Operativo</option>
                      <option>Operativo con observaciones</option>
                      <option>Fuera de servicio</option>
                    </select>
                  </div>
                  <div><label style={s.label}>Fecha último mantenimiento</label><input style={s.input} type="date" name="ultimoMantenimiento" value={form.ultimoMantenimiento} onChange={handleChange} /></div>
                </div>
              </div>

              {/* Cronograma dinámico */}
              <div style={s.seccion}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
                  <div style={s.secTitulo}><SvgCalendario /> Cronograma de mantenimiento</div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "12.5px", color: "#6b7488", fontWeight: 600 }}>Frecuencia:</span>
                    <select style={s.selectFrecuencia} value={frecuencia} onChange={e => handleFrecuencia(e.target.value)}>
                      {Object.entries(FRECUENCIAS).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </select>
                    <span style={s.chipVisitas}>
                      {cronograma.length} visita{cronograma.length !== 1 ? "s" : ""} al año
                    </span>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: "12px", marginTop: "16px" }}>
                  {cronograma.map((trim, i) => {
                    const col = cronColor(trim.estado);
                    return (
                      <div key={i} style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "14px", background: col.bg, borderRadius: "14px", border: `1px solid ${col.border}` }}>
                        <div style={{ fontSize: "13px", color: "#12245e", fontWeight: 700, textAlign: "center" }}>{trim.label}</div>
                        <input
                          type="date"
                          style={{ padding: "8px 10px", border: "1px solid #dfe6f5", borderRadius: "9px", fontSize: "12.5px", background: "white", fontFamily: "inherit" }}
                          value={trim.fecha}
                          onChange={e => updateCron(i, "fecha", e.target.value)}
                        />
                        <select
                          style={{ padding: "8px 10px", border: "1px solid #dfe6f5", borderRadius: "9px", fontSize: "12.5px", background: "white", fontFamily: "inherit", fontWeight: 600, color: col.color }}
                          value={trim.estado}
                          onChange={e => updateCron(i, "estado", e.target.value)}
                        >
                          <option value="realizado">Realizado</option>
                          <option value="pendiente">Pendiente</option>
                          <option value="programado">Programado</option>
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", flexWrap: "wrap" }}>
                <button type="button" style={{ ...s.btnCancelar, width: "auto", flex: "1 1 140px" }} onClick={irAtras}>Cancelar</button>
                <button type="submit" style={{ ...s.btnGuardar, width: "auto", flex: "2 1 200px" }} disabled={guardando}>
                  {guardando ? "Guardando..." : <><SvgGuardar />{equipoId ? "Actualizar equipo" : "Guardar equipo"}</>}
                </button>
              </div>

            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

const s = {
  page: { minHeight: "100vh", width: "100%", background: "#eef1f6", fontFamily: FONT, boxSizing: "border-box" },
  navbar: { background: "white", borderBottom: "1px solid #e7ebf3", padding: "14px clamp(16px,4vw,32px)", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10, flexWrap: "wrap", gap: "12px" },
  navLeft: { display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" },
  logoBox: { width: "34px", height: "34px", display: "flex", alignItems: "center", justifyContent: "center" },
  logoImg: { width: "30px", height: "30px", objectFit: "contain" },
  navBrand: { fontWeight: 800, fontSize: "15px", color: "#12245e", letterSpacing: "0.02em" },
  navDivider: { width: "1px", height: "18px", background: "#e7ebf3" },
  btnBack: { background: "none", border: "none", color: "#1a4fc0", cursor: "pointer", fontSize: "13.5px", fontWeight: 700, padding: 0, fontFamily: "inherit", display: "flex", alignItems: "center", gap: "6px" },
  navTitle: { fontSize: "13.5px", color: "#26314d", fontWeight: 700 },
  navSub: { color: "#8a92a6", fontWeight: 700, fontSize: "12.5px" },
  content: { maxWidth: "1400px", margin: "0 auto", padding: "clamp(16px,4vw,28px)" },
  layout: { display: "flex", gap: "20px", alignItems: "flex-start", flexWrap: "wrap" },
  sidebar: { width: "230px", flexShrink: 0, display: "flex", flexDirection: "column", gap: "16px" },
  sideCardCenter: { background: "white", border: "1px solid #e7ebf3", borderRadius: "16px", padding: "24px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", textAlign: "center" },
  sideIconBox: { width: "64px", height: "64px", borderRadius: "16px", background: "#e5f0ff", display: "flex", alignItems: "center", justifyContent: "center" },
  sideCard: { background: "white", border: "1px solid #e7ebf3", borderRadius: "16px", padding: "18px 20px" },
  sideLabel: { fontWeight: 700, fontSize: "11.5px", color: "#8a92a6", letterSpacing: "0.06em" },
  sideVal: { fontSize: "13.5px", color: "#12245e", fontWeight: 700, textAlign: "left" },
  codigoTag: { background: "#f3e8ff", color: "#7c3fd8", fontWeight: 800, fontSize: "13px", padding: "4px 14px", borderRadius: "8px" },
  badgeEstado: { fontSize: "12.5px", padding: "8px 14px", borderRadius: "10px", fontWeight: 700, display: "inline-block", textAlign: "center", lineHeight: 1.4, marginTop: "8px" },
  btnGuardar: { width: "100%", boxSizing: "border-box", background: "#1a4fc0", color: "white", border: "none", borderRadius: "12px", padding: "13px 16px", fontFamily: "inherit", fontWeight: 700, fontSize: "14px", cursor: "pointer", boxShadow: "0 8px 20px rgba(26,79,192,0.25)", display: "flex", alignItems: "center", justifyContent: "center" },
  btnCancelar: { width: "100%", boxSizing: "border-box", background: "white", color: "#6b7488", border: "1px solid #e7ebf3", borderRadius: "12px", padding: "13px 16px", fontFamily: "inherit", fontWeight: 700, fontSize: "14px", cursor: "pointer" },
  main: { flex: 1, minWidth: "340px", display: "flex", flexDirection: "column", gap: "18px" },
  seccion: { background: "white", border: "1px solid #e7ebf3", borderRadius: "18px", padding: "clamp(18px,3vw,26px)", display: "flex", flexDirection: "column", gap: "16px" },
  secTitulo: { display: "flex", alignItems: "center", gap: "8px", fontWeight: 800, fontSize: "13.5px", color: "#1a4fc0", letterSpacing: "0.06em" },
  bannerCliente: { background: "#e5f0ff", border: "1px solid #c3d6fb", borderRadius: "12px", padding: "12px 16px", display: "flex", alignItems: "flex-start", gap: "10px" },
  grid2: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: "14px" },
  grid3: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: "14px" },
  label: { display: "block", fontWeight: 700, fontSize: "12.5px", color: "#26314d", marginBottom: "6px" },
  input: { width: "100%", boxSizing: "border-box", border: "1px solid #dfe6f5", borderRadius: "11px", padding: "11px 12px", fontFamily: "inherit", fontSize: "14px", color: "#0f1b3d", background: "#f9fafc", marginBottom: "4px" },
  selectFrecuencia: { border: "1px solid #dfe6f5", borderRadius: "9px", padding: "8px 12px", fontFamily: "inherit", fontSize: "12.5px", fontWeight: 600, color: "#26314d", background: "#f9fafc" },
  chipVisitas: { background: "#e5f0ff", color: "#1a4fc0", fontWeight: 700, fontSize: "11.5px", padding: "4px 12px", borderRadius: "20px", whiteSpace: "nowrap" },
  filaDinamica: { position: "relative", border: "1px solid #eef1f6", borderRadius: "14px", padding: "14px", background: "#fafbfd" },
  btnEliminar: { position: "absolute", top: "10px", right: "10px", background: "#fdeeee", color: "#a52b2b", border: "none", borderRadius: "8px", padding: "6px 8px", cursor: "pointer" },
  btnAgregar: { fontSize: "13px", padding: "10px 16px", borderRadius: "10px", border: "none", cursor: "pointer", fontWeight: 700, fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center" },
};
