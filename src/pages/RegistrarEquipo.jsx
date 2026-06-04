import { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, addDoc, doc, getDoc, updateDoc } from "firebase/firestore";
import { useNavigate, useSearchParams } from "react-router-dom";

export default function RegistrarEquipo() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const equipoId = searchParams.get("id");
  const [guardando, setGuardando] = useState(false);

  const [form, setForm] = useState({
    cliente: "", codigo: "", piso: "", ambiente: "", tipoEquipo: "",
    marca: "", modelo: "", serie: "", capacidad: "", tipoRefrigerante: "",
    voltaje: "", amperaje: "", fases: "Monofásico", ubicacion: "",
    estado: "Operativo", ultimoMantenimiento: "",
    observaciones: "", correctivos: "", recomendaciones: ""
  });

  useEffect(() => { if (equipoId) cargarEquipo(); }, [equipoId]);

  const cargarEquipo = async () => {
    const ref = doc(db, "equipos", equipoId);
    const snap = await getDoc(ref);
    if (snap.exists()) setForm(snap.data());
  };

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      if (equipoId) {
        await updateDoc(doc(db, "equipos", equipoId), form);
        alert("Equipo actualizado correctamente");
      } else {
        await addDoc(collection(db, "equipos"), {
          ...form, fechaRegistro: new Date().toLocaleDateString("es-PE")
        });
        alert("Equipo registrado correctamente");
      }
      navigate(-1);
    } catch (error) {
      alert("Error al guardar: " + error.message);
    }
    setGuardando(false);
  };

  return (
    <div style={s.page}>
      {/* NAVBAR */}
      <div style={s.navbar}>
        <div style={s.navLeft}>
          <div style={s.logo}>
            <span style={{ color: "#1a5fa8" }}>H</span>
            <span style={{ color: "#1a5fa8", marginRight: "-6px" }}>V</span>
            <span style={{ color: "#f0c040", marginLeft: "2px" }}>A</span>
            <span style={{ color: "#1a5fa8", marginLeft: "2px" }}>C</span>
          </div>
          <div style={s.divider}></div>
          <button style={s.btnBack} onClick={() => navigate(-1)}>← Volver</button>
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
                <div style={s.sideIconWrap}>
                  <span style={{ fontSize: "28px" }}>❄️</span>
                </div>
                <div style={{ fontSize: "12px", color: "#888", textAlign: "center", marginBottom: "8px" }}>
                  {equipoId ? "Editando equipo" : "Nuevo equipo"}
                </div>
                {form.codigo && <span style={s.codigoTag}>{form.codigo}</span>}
              </div>

              <div style={s.sideCard}>
                <div style={s.sideLabel}>Estado actual</div>
                <span style={{ ...s.badgeEstado, ...getEstadoStyle(form.estado) }}>
                  {form.estado || "Operativo"}
                </span>
              </div>

              {form.cliente && (
                <div style={s.sideCard}>
                  <div style={s.sideLabel}>Cliente</div>
                  <div style={s.sideVal}>🏢 {form.cliente}</div>
                  {form.piso && <div style={{ ...s.sideVal, color: "#888", marginTop: "4px" }}>📍 Piso {form.piso} · {form.ambiente}</div>}
                </div>
              )}

              <button type="submit" style={s.btnGuardar} disabled={guardando}>
                {guardando ? "Guardando..." : equipoId ? "💾 Actualizar equipo" : "💾 Guardar equipo"}
              </button>
              <button type="button" style={s.btnCancelar} onClick={() => navigate(-1)}>
                Cancelar
              </button>
            </div>

            {/* CONTENIDO PRINCIPAL */}
            <div style={s.main}>

              {/* Datos generales */}
              <div style={s.seccion}>
                <div style={s.secTitulo}>🏢 Datos generales</div>
                <div style={s.grid2}>
                  <div>
                    <label style={s.label}>Cliente / Empresa</label>
                    <input style={s.input} name="cliente" placeholder="La Positiva, Club Nacional..." value={form.cliente} onChange={handleChange} required />
                  </div>
                  <div>
                    <label style={s.label}>Código del equipo</label>
                    <input style={s.input} name="codigo" placeholder="SP-01, CC-03..." value={form.codigo} onChange={handleChange} />
                  </div>
                  <div>
                    <label style={s.label}>Piso</label>
                    <input style={s.input} name="piso" placeholder="1, 2, Sótano..." value={form.piso} onChange={handleChange} />
                  </div>
                  <div>
                    <label style={s.label}>Ambiente</label>
                    <input style={s.input} name="ambiente" placeholder="Oficina, Comedor, Sala..." value={form.ambiente} onChange={handleChange} />
                  </div>
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
                      <option>Split Muro</option>
                      <option>Split Piso Techo</option>
                      <option>Cassette</option>
                      <option>Casete</option>
                      <option>Chiller</option>
                      <option>Fan Coil</option>
                      <option>Ventilación</option>
                      <option>Extractor</option>
                      <option>Torre de Enfriamiento</option>
                      <option>Otro</option>
                    </select>
                  </div>
                  <div>
                    <label style={s.label}>Marca</label>
                    <input style={s.input} name="marca" placeholder="Daikin, Carrier, LG, Midea..." value={form.marca} onChange={handleChange} required />
                  </div>
                  <div>
                    <label style={s.label}>Modelo</label>
                    <input style={s.input} name="modelo" placeholder="FTXS35KVMA" value={form.modelo} onChange={handleChange} />
                  </div>
                  <div>
                    <label style={s.label}>N° de Serie</label>
                    <input style={s.input} name="serie" placeholder="D4Y0041045" value={form.serie} onChange={handleChange} />
                  </div>
                  <div>
                    <label style={s.label}>Capacidad (BTU)</label>
                    <input style={s.input} name="capacidad" placeholder="12000, 18000, 24000..." value={form.capacidad} onChange={handleChange} />
                  </div>
                  <div>
                    <label style={s.label}>Tipo de refrigerante</label>
                    <select style={s.input} name="tipoRefrigerante" value={form.tipoRefrigerante} onChange={handleChange}>
                      <option value="">Seleccionar...</option>
                      <option>R-22</option>
                      <option>R-410A</option>
                      <option>R-32</option>
                      <option>R-407C</option>
                      <option>R-134A</option>
                      <option>Otro</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Datos eléctricos */}
              <div style={s.seccion}>
                <div style={s.secTitulo}>⚡ Datos eléctricos</div>
                <div style={s.grid3}>
                  <div>
                    <label style={s.label}>Voltaje (V)</label>
                    <input style={s.input} name="voltaje" placeholder="220" value={form.voltaje} onChange={handleChange} />
                  </div>
                  <div>
                    <label style={s.label}>Amperaje (A)</label>
                    <input style={s.input} name="amperaje" placeholder="15" value={form.amperaje} onChange={handleChange} />
                  </div>
                  <div>
                    <label style={s.label}>Fases</label>
                    <select style={s.input} name="fases" value={form.fases} onChange={handleChange}>
                      <option>Monofásico</option>
                      <option>Trifásico</option>
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
                  <div>
                    <label style={s.label}>Fecha último mantenimiento</label>
                    <input style={s.input} type="date" name="ultimoMantenimiento" value={form.ultimoMantenimiento} onChange={handleChange} />
                  </div>
                </div>

                <div style={{ marginBottom: "12px" }}>
                  <label style={s.label}>Observaciones</label>
                  <div style={s.textareaHint}>Una observación por línea o separadas por punto y coma (;)</div>
                  <textarea style={s.textarea} name="observaciones"
                    placeholder={"Contactor averiado\nFuga de refrigerante en línea de retorno"}
                    value={form.observaciones} onChange={handleChange} />
                </div>

                <div style={{ marginBottom: "12px" }}>
                  <label style={s.label}>Correctivos realizados</label>
                  <div style={s.textareaHint}>Un correctivo por línea o separados por punto y coma (;)</div>
                  <textarea style={s.textarea} name="correctivos"
                    placeholder={"Reemplazo de capacitor\nRecarga de gas R-22"}
                    value={form.correctivos} onChange={handleChange} />
                </div>

                <div style={{ marginBottom: "12px" }}>
                  <label style={s.label}>Recomendaciones</label>
                  <div style={s.textareaHint}>Una recomendación por línea o separadas por punto y coma (;)</div>
                  <textarea style={s.textarea} name="recomendaciones"
                    placeholder={"Limpiar filtros cada 2 años\nRevisar presiones de gas periódicamente"}
                    value={form.recomendaciones} onChange={handleChange} />
                </div>
              </div>

              {/* Botones inferiores */}
              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button type="button" style={s.btnCancelar} onClick={() => navigate(-1)}>Cancelar</button>
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

const getEstadoStyle = (estado) => {
  if (estado === "Operativo") return { background: "#e8f5e9", color: "#2e7d32" };
  if (estado === "Operativo con observaciones") return { background: "#fff8e1", color: "#f57f17" };
  return { background: "#ffebee", color: "#c62828" };
};

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
  textareaHint: { fontSize: "11px", color: "#aaa", marginBottom: "5px" },
  input: { width: "100%", padding: "9px 12px", borderRadius: "8px", border: "0.5px solid #ddd", fontSize: "13px", boxSizing: "border-box", background: "#fafafa", outline: "none" },
  textarea: { width: "100%", padding: "10px 12px", borderRadius: "8px", border: "0.5px solid #ddd", fontSize: "13px", boxSizing: "border-box", minHeight: "90px", resize: "vertical", background: "#fafafa", outline: "none", fontFamily: "Inter, Arial, sans-serif" },
};
