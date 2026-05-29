import { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { collection, addDoc, doc, getDoc, updateDoc } from "firebase/firestore";
import { useNavigate, useSearchParams } from "react-router-dom";

const getEstadoStyle = (estado) => {
  if (estado === "Operativo") return { background: "#e8f5e9", color: "#2e7d32" };
  if (estado === "Operativo con observaciones") return { background: "#fff8e1", color: "#f57f17" };
  return { background: "#ffebee", color: "#c62828" };
};

export default function RegistrarEquipo() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const equipoId = searchParams.get("id");
  const clienteParam = searchParams.get("cliente") || "";
const sedeParam = searchParams.get("sede") || "";
  const [guardando, setGuardando] = useState(false);

  const [form, setForm] = useState({
    cliente: clienteParam,sede: sedeParam, codigo: "", piso: "", ambiente: "", tipoEquipo: "",
    marca: "", modelo: "", serie: "", capacidad: "", tipoRefrigerante: "",
    voltaje: "", amperaje: "", fases: "Monofásico", ubicacion: "",
    estado: "Operativo", ultimoMantenimiento: "",
  });

  const [observaciones, setObservaciones] = useState([{ texto: "", fecha: "", tecnico: "" }]);
  const [correctivos, setCorrectivos] = useState([{ descripcion: "", fecha: "" }]);
  const [recomendaciones, setRecomendaciones] = useState([""]);
  const [cronograma, setCronograma] = useState([
    { label: "1er Trimestre", fecha: "", estado: "programado" },
    { label: "2do Trimestre", fecha: "", estado: "programado" },
    { label: "3er Trimestre", fecha: "", estado: "programado" },
    { label: "4to Trimestre", fecha: "", estado: "programado" },
  ]);

  useEffect(() => { if (equipoId) cargarEquipo(); }, [equipoId]);

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
        capacidad: data.capacidad || "", tipoRefrigerante: data.tipoRefrigerante || "",
        voltaje: data.voltaje || "", amperaje: data.amperaje || "",
        fases: data.fases || "Monofásico", ubicacion: data.ubicacion || "",
        estado: data.estado || "Operativo",
        ultimoMantenimiento: data.ultimoMantenimiento || "",
      });

      // Cargar observaciones
     if (data.observacionesArray && data.observacionesArray.length > 0) {
  const migradas = data.observacionesArray.map(o =>
    typeof o === "string" ? { texto: o, fecha: "", tecnico: "" } : o
  );
  setObservaciones(migradas);
} else if (data.observaciones) {
  setObservaciones(data.observaciones.split(/\n|;/).map(o => ({ texto: o.trim(), fecha: "", tecnico: "" })).filter(o => o.texto));
} 

      // Cargar correctivos
      if (data.correctivosArray && data.correctivosArray.length > 0) {
        setCorrectivos(data.correctivosArray);
      } else if (data.correctivos) {
        const corList = data.correctivos.split(/\n|;/).map(c => c.trim()).filter(Boolean);
        setCorrectivos(corList.map(c => ({ descripcion: c, fecha: "" })));
      }

      // Cargar recomendaciones
      if (data.recomendacionesArray && data.recomendacionesArray.length > 0) {
        setRecomendaciones(data.recomendacionesArray);
      } else if (data.recomendaciones) {
        setRecomendaciones(data.recomendaciones.split(/\n|;/).map(r => r.trim()).filter(Boolean));
      }

      // Cargar cronograma
      if (data.cronograma && data.cronograma.length > 0) {
        setCronograma(data.cronograma);
      }
    }
  };

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  // Observaciones
  const addObs = () => setObservaciones([...observaciones, { texto: "", fecha: "", tecnico: "" }]);
  const removeObs = (i) => setObservaciones(observaciones.filter((_, idx) => idx !== i));
  const updateObs = (i, field, val) => { const n = [...observaciones]; n[i] = { ...n[i], [field]: val }; setObservaciones(n); };

  // Correctivos
  const addCor = () => setCorrectivos([...correctivos, { descripcion: "", fecha: "" }]);
  const removeCor = (i) => setCorrectivos(correctivos.filter((_, idx) => idx !== i));
  const updateCor = (i, field, val) => { const n = [...correctivos]; n[i] = { ...n[i], [field]: val }; setCorrectivos(n); };

  // Recomendaciones
  const addRec = () => setRecomendaciones([...recomendaciones, ""]);
  const removeRec = (i) => setRecomendaciones(recomendaciones.filter((_, idx) => idx !== i));
  const updateRec = (i, val) => { const n = [...recomendaciones]; n[i] = val; setRecomendaciones(n); };

  // Cronograma
  const updateCron = (i, field, val) => { const n = [...cronograma]; n[i] = { ...n[i], [field]: val }; setCronograma(n); };

  const cronColor = (estado) => ({
    realizado: { bg: "#e8f5e9", border: "#a5d6a7", color: "#2e7d32" },
    pendiente: { bg: "#fff8e1", border: "#ffe082", color: "#e65100" },
    programado: { bg: "#f5f5f5", border: "#e0e0e0", color: "#888" },
  }[estado] || { bg: "#f5f5f5", border: "#e0e0e0", color: "#888" });

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
     if (sedeParam && clienteParam) {
  navigate(`/cliente/${encodeURIComponent(clienteParam)}/sede/${encodeURIComponent(sedeParam)}`);
} else if (clienteParam) {
  navigate(`/cliente/${encodeURIComponent(clienteParam)}`);
} else {
  navigate(-1);
}
    } catch (error) {
      alert("Error al guardar: " + error.message);
    }
    setGuardando(false);
  };

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
          <div style={s.divider}></div>
          <button style={s.btnBack} onClick={() => {
  if (sedeParam && clienteParam) {
    navigate(`/cliente/${encodeURIComponent(clienteParam)}/sede/${encodeURIComponent(sedeParam)}`);
  } else if (clienteParam) {
    navigate(`/cliente/${encodeURIComponent(clienteParam)}`);
  } else {
    navigate(-1);
  }
}}>← Volver</button>
          <div style={s.divider}></div>
          <span style={s.navTitle}>{equipoId ? "Editar equipo" : "Registrar equipo"}</span>
        </div>
        <span style={{ fontSize: "12px", color: "#888" }}>
          {equipoId ? `Editando: ${form.codigo || equipoId.slice(0, 6).toUpperCase()}` : "Nuevo equipo"}
        </span>
      </div>

      <div style={s.content}>
        <form onSubmit={handleSubmit}>
          <div style={s.layout}>

            {/* SIDEBAR */}
            <div style={s.sidebar}>
              <div style={s.sideCard}>
                <div style={s.sideIconWrap}><span style={{ fontSize: "28px" }}>❄️</span></div>
                <div style={{ fontSize: "12px", color: "#888", textAlign: "center", marginBottom: "8px" }}>
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
                  <div style={s.sideVal}>🏢 {form.cliente}</div>
                  {form.piso && <div style={{ ...s.sideVal, color: "#888", marginTop: "4px" }}>📍 Piso {form.piso} · {form.ambiente}</div>}
                </div>
              )}
              <button type="submit" style={s.btnGuardar} disabled={guardando}>
                {guardando ? "Guardando..." : equipoId ? "💾 Actualizar" : "💾 Guardar"}
              </button>
              <button type="button" style={s.btnCancelar} onClick={() => {
  if (sedeParam && clienteParam) {
    navigate(`/cliente/${encodeURIComponent(clienteParam)}/sede/${encodeURIComponent(sedeParam)}`);
  } else if (clienteParam) {
    navigate(`/cliente/${encodeURIComponent(clienteParam)}`);
  } else {
    navigate(-1);
  }
}}>Cancelar</button>
            </div>

            {/* MAIN */}
            <div style={s.main}>

              {/* Datos generales */}
              <div style={s.seccion}>
  <div style={s.secTitulo}>🏢 Datos generales</div>

  {(clienteParam || sedeParam) && (
    <div style={{ background: "#e8f0fe", border: "0.5px solid #c5d5e8", borderRadius: "8px", padding: "10px 14px", marginBottom: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
      <span style={{ fontSize: "16px" }}>🏢</span>
      <div>
        <div style={{ fontSize: "13px", fontWeight: 500, color: "#1a5fa8" }}>{clienteParam}</div>
        {sedeParam && <div style={{ fontSize: "11px", color: "#6b8cae", marginTop: "2px" }}>📍 Sede: {sedeParam}</div>}
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
  </div>
</div>

              {/* Ficha técnica */}
              <div style={s.seccion}>
                <div style={s.secTitulo}>📋 Ficha técnica</div>
                <div style={s.grid2}>
                  <div>
                    <label style={s.label}>Tipo de equipo</label>
                    <select style={s.input} name="tipoEquipo" value={form.tipoEquipo} onChange={handleChange}>
                      <option value="">Seleccionar...</option>
                      {["Split Muro","Split Piso Techo","Split Pared","Split Ducto","Cassette","Casete","Chiller","Fan Coil","Ventilación","Extractor","Torre de Enfriamiento","Ventana","Autocontenido","Precisión","Otro"].map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div><label style={s.label}>Marca</label><input style={s.input} name="marca" placeholder="Daikin, LG, Midea..." value={form.marca} onChange={handleChange} required /></div>
                  <div><label style={s.label}>Modelo</label><input style={s.input} name="modelo" placeholder="FTXS35KVMA" value={form.modelo} onChange={handleChange} /></div>
                  <div><label style={s.label}>N° de Serie</label><input style={s.input} name="serie" placeholder="D4Y0041045" value={form.serie} onChange={handleChange} /></div>
                  <div><label style={s.label}>Capacidad (BTU)</label><input style={s.input} name="capacidad" placeholder="12000, 18000..." value={form.capacidad} onChange={handleChange} /></div>
                  <div>
                    <label style={s.label}>Tipo de refrigerante</label>
                    <select style={s.input} name="tipoRefrigerante" value={form.tipoRefrigerante} onChange={handleChange}>
                      <option value="">Seleccionar...</option>
                      {["R-22","R-410A","R-32","R-407C","R-134A","Otro"].map(r => <option key={r}>{r}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Datos eléctricos */}
              <div style={s.seccion}>
                <div style={s.secTitulo}>⚡ Datos eléctricos</div>
                <div style={s.grid3}>
                  <div><label style={s.label}>Voltaje (V)</label><input style={s.input} name="voltaje" placeholder="220" value={form.voltaje} onChange={handleChange} /></div>
                  <div><label style={s.label}>Amperaje (A)</label><input style={s.input} name="amperaje" placeholder="15" value={form.amperaje} onChange={handleChange} /></div>
                  <div>
                    <label style={s.label}>Fases</label>
                    <select style={s.input} name="fases" value={form.fases} onChange={handleChange}>
                      <option>Monofásico</option><option>Trifásico</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Mantenimiento */}
              <div style={s.seccion}>
                <div style={s.secTitulo}>🔧 Mantenimiento</div>
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

              {/* Observaciones dinámicas */}
              <div style={s.seccion}>
                <div style={s.secTitulo}>⚠️ Observaciones</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "10px" }}>
                {observaciones.map((obs, i) => (
  <div key={i} style={{ display: "flex", gap: "8px", alignItems: "flex-start", flexWrap: "wrap" }}>
    <input
      style={{ ...s.input, flex: 2, minWidth: "180px", background: "#fff8e1", marginBottom: 0 }}
      placeholder="Observación..."
      value={obs.texto}
      onChange={e => updateObs(i, "texto", e.target.value)}
    />
    <input
      type="date"
      style={{ ...s.input, width: "150px", background: "#fff8e1", marginBottom: 0 }}
      value={obs.fecha}
      onChange={e => updateObs(i, "fecha", e.target.value)}
    />
    <input
      style={{ ...s.input, flex: 1, minWidth: "120px", background: "#fff8e1", marginBottom: 0 }}
      placeholder="Técnico..."
      value={obs.tecnico}
      onChange={e => updateObs(i, "tecnico", e.target.value)}
    />
    {observaciones.length > 1 && (
      <button type="button" style={s.btnEliminar} onClick={() => removeObs(i)}>✕</button>
    )}
  </div>
))}  
                </div>
                <button type="button" style={{ ...s.btnAgregar, borderColor: "#ffa726", background: "#fff8e1", color: "#e65100" }} onClick={addObs}>
                  + Agregar observación
                </button>
              </div>

              {/* Correctivos dinámicos */}
              <div style={s.seccion}>
                <div style={s.secTitulo}>🔧 Correctivos realizados</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "10px" }}>
                  {correctivos.map((cor, i) => (
                    <div key={i} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <input
                        style={{ ...s.input, flex: 1, background: "#f0f4f8", marginBottom: 0 }}
                        placeholder="Correctivo realizado..."
                        value={cor.descripcion}
                        onChange={e => updateCor(i, "descripcion", e.target.value)}
                      />
                      <input
                        type="date"
                        style={{ ...s.input, width: "150px", background: "#f0f4f8", marginBottom: 0 }}
                        value={cor.fecha}
                        onChange={e => updateCor(i, "fecha", e.target.value)}
                      />
                      {correctivos.length > 1 && (
                        <button type="button" style={s.btnEliminar} onClick={() => removeCor(i)}>✕</button>
                      )}
                    </div>
                  ))}
                </div>
                <button type="button" style={{ ...s.btnAgregar, borderColor: "#1a5fa8", background: "#e8f0fe", color: "#1a5fa8" }} onClick={addCor}>
                  + Agregar correctivo
                </button>
              </div>

              {/* Recomendaciones dinámicas */}
              <div style={s.seccion}>
                <div style={s.secTitulo}>💡 Recomendaciones</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "10px" }}>
                  {recomendaciones.map((rec, i) => (
                    <div key={i} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <input
                        style={{ ...s.input, flex: 1, background: "#e8f5e9", marginBottom: 0 }}
                        placeholder="Recomendación..."
                        value={rec}
                        onChange={e => updateRec(i, e.target.value)}
                      />
                      {recomendaciones.length > 1 && (
                        <button type="button" style={s.btnEliminar} onClick={() => removeRec(i)}>✕</button>
                      )}
                    </div>
                  ))}
                </div>
                <button type="button" style={{ ...s.btnAgregar, borderColor: "#43a047", background: "#e8f5e9", color: "#2e7d32" }} onClick={addRec}>
                  + Agregar recomendación
                </button>
              </div>

              {/* Cronograma editable */}
              <div style={s.seccion}>
                <div style={s.secTitulo}>📅 Cronograma de mantenimiento</div>
                <div style={s.grid2}>
                  {cronograma.map((trim, i) => {
                    const col = cronColor(trim.estado);
                    return (
                      <div key={i} style={{ display: "flex", flexDirection: "column", gap: "6px", padding: "10px", background: col.bg, borderRadius: "8px", border: `0.5px solid ${col.border}` }}>
                        <div style={{ fontSize: "11px", color: col.color, fontWeight: 500 }}>{trim.label}</div>
                        <input
                          type="date"
                          style={{ padding: "6px 8px", border: `0.5px solid ${col.border}`, borderRadius: "6px", fontSize: "12px", background: "white" }}
                          value={trim.fecha}
                          onChange={e => updateCron(i, "fecha", e.target.value)}
                        />
                        <select
                          style={{ padding: "6px 8px", border: `0.5px solid ${col.border}`, borderRadius: "6px", fontSize: "12px", background: "white" }}
                          value={trim.estado}
                          onChange={e => updateCron(i, "estado", e.target.value)}
                        >
                          <option value="realizado">✅ Realizado</option>
                          <option value="pendiente">⏳ Pendiente</option>
                          <option value="programado">📆 Programado</option>
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button type="button" style={s.btnCancelar} onClick={() => {
  if (sedeParam && clienteParam) {
    navigate(`/cliente/${encodeURIComponent(clienteParam)}/sede/${encodeURIComponent(sedeParam)}`);
  } else if (clienteParam) {
    navigate(`/cliente/${encodeURIComponent(clienteParam)}`);
  } else {
    navigate(-1);
  }
}}>Cancelar</button>
                <button type="submit" style={s.btnGuardar} disabled={guardando}>
                  {guardando ? "Guardando..." : equipoId ? "💾 Actualizar equipo" : "💾 Guardar equipo"}
                </button>
              </div>

            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

const s = {
  page: { minHeight: "100vh", background: "#f0f4f8", fontFamily: "Inter, Arial, sans-serif" },
  navbar: { background: "white", borderBottom: "0.5px solid #e0e0e0", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10 },
  navLeft: { display: "flex", alignItems: "center", gap: "12px" },
  logo: { fontFamily: "'Arial Black', sans-serif", fontWeight: 900, fontSize: "20px", display: "flex", alignItems: "baseline", letterSpacing: "1px" },
  divider: { width: "1px", height: "18px", background: "#e0e0e0" },
  btnBack: { background: "none", border: "none", color: "#1a5fa8", cursor: "pointer", fontSize: "13px", fontWeight: 500, padding: 0 },
  navTitle: { fontSize: "13px", color: "#555", fontWeight: 500 },
  content: { maxWidth: "1200px", margin: "0 auto", padding: "20px 24px" },
  layout: { display: "flex", gap: "16px", alignItems: "flex-start" },
  sidebar: { width: "185px", flexShrink: 0, display: "flex", flexDirection: "column", gap: "10px" },
  sideCard: { background: "white", border: "0.5px solid #e0e0e0", borderRadius: "12px", padding: "12px 14px" },
  sideIconWrap: { width: "50px", height: "50px", borderRadius: "12px", background: "#e8f0fe", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px" },
  sideLabel: { fontSize: "10px", color: "#888", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" },
  sideVal: { fontSize: "12px", color: "#222" },
  codigoTag: { fontSize: "13px", padding: "3px 8px", background: "#f3e5f5", color: "#6a1b9a", borderRadius: "5px", fontFamily: "monospace", fontWeight: 700, display: "inline-block" },
  badgeEstado: { fontSize: "11px", padding: "3px 10px", borderRadius: "20px", fontWeight: 500, display: "inline-block" },
  btnGuardar: { width: "100%", padding: "10px", background: "#1a5fa8", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "13px", fontWeight: 500 },
  btnCancelar: { width: "100%", padding: "10px", background: "white", color: "#555", border: "0.5px solid #ddd", borderRadius: "8px", cursor: "pointer", fontSize: "13px" },
  main: { flex: 1, display: "flex", flexDirection: "column", gap: "12px", minWidth: 0 },
  seccion: { background: "white", border: "0.5px solid #e0e0e0", borderRadius: "12px", padding: "16px" },
  secTitulo: { fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "14px", fontWeight: 500 },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" },
  grid3: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" },
  label: { display: "block", fontSize: "12px", color: "#555", marginBottom: "5px", fontWeight: 500 },
  input: { width: "100%", padding: "9px 12px", borderRadius: "8px", border: "0.5px solid #ddd", fontSize: "13px", boxSizing: "border-box", background: "#fafafa", outline: "none", marginBottom: "4px" },
  btnEliminar: { padding: "8px 10px", borderRadius: "8px", background: "#ffebee", color: "#c62828", border: "0.5px solid #ef9a9a", cursor: "pointer", fontSize: "12px", flexShrink: 0 },
  btnAgregar: { fontSize: "12px", padding: "7px 14px", borderRadius: "8px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "5px", fontWeight: 500 },
};