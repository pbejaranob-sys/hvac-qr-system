import { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, addDoc, doc, getDoc, updateDoc } from "firebase/firestore";
import { useNavigate, useSearchParams } from "react-router-dom";

export default function RegistrarEquipo() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const equipoId = searchParams.get("id");

  const [form, setForm] = useState({
    cliente: "",
    codigo: "",
    piso: "",
    ambiente: "",
    tipoEquipo: "",
    marca: "",
    modelo: "",
    serie: "",
    capacidad: "",
    tipoRefrigerante: "",
    voltaje: "",
    amperaje: "",
    fases: "Monofásico",
    ubicacion: "",
    estado: "Operativo",
    ultimoMantenimiento: "",
    observaciones: "",
    correctivos: "",
    recomendaciones: ""
  });

  useEffect(() => {
    if (equipoId) cargarEquipo();
  }, [equipoId]);

  const cargarEquipo = async () => {
    const ref = doc(db, "equipos", equipoId);
    const snap = await getDoc(ref);
    if (snap.exists()) setForm(snap.data());
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (equipoId) {
        await updateDoc(doc(db, "equipos", equipoId), form);
        alert("Equipo actualizado correctamente");
      } else {
        await addDoc(collection(db, "equipos"), {
          ...form,
          fechaRegistro: new Date().toLocaleDateString("es-PE")
        });
        alert("Equipo registrado correctamente");
      }
      navigate(-1);
    } catch (error) {
      alert("Error al guardar: " + error.message);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <button style={styles.btnVolver} onClick={() => navigate(-1)}>← Volver</button>
          <h2 style={styles.titulo}>{equipoId ? "Editar Equipo" : "Registrar Nuevo Equipo"}</h2>
        </div>

        <form onSubmit={handleSubmit}>

          <p style={styles.seccion}>👤 Datos del cliente</p>
          <div style={styles.grid2}>
            <div>
              <label style={styles.label}>Nombre del cliente / empresa</label>
              <input style={styles.input} name="cliente" placeholder="Clínica San Marcos..." value={form.cliente} onChange={handleChange} required />
            </div>
            <div>
              <label style={styles.label}>Código del equipo</label>
              <input style={styles.input} name="codigo" placeholder="AC-001, VE-002, FC-003..." value={form.codigo || ""} onChange={handleChange} />
            </div>
            <div>
              <label style={styles.label}>Piso</label>
              <input style={styles.input} name="piso" placeholder="1, 2, Sótano, Azotea..." value={form.piso} onChange={handleChange} required />
            </div>
            <div>
              <label style={styles.label}>Ambiente</label>
              <input style={styles.input} name="ambiente" placeholder="Sala principal, Oficina..." value={form.ambiente} onChange={handleChange} required />
            </div>
            <div>
              <label style={styles.label}>Ubicación adicional</label>
              <input style={styles.input} name="ubicacion" placeholder="Referencia adicional..." value={form.ubicacion} onChange={handleChange} />
            </div>
          </div>

          <p style={styles.seccion}>❄️ Datos del equipo</p>
          <div style={styles.grid2}>
            <div>
              <label style={styles.label}>Tipo de equipo</label>
              <select style={styles.input} name="tipoEquipo" value={form.tipoEquipo} onChange={handleChange}>
                <option value="">Seleccionar...</option>
                <option>Split Muro</option>
                <option>Split Piso Techo</option>
                <option>Cassette</option>
                <option>Chiller</option>
                <option>Fan Coil</option>
                <option>Ventilación</option>
                <option>Extractor</option>
                <option>Torre de Enfriamiento</option>
                <option>Otro</option>
              </select>
            </div>
            <div>
              <label style={styles.label}>Marca</label>
              <input style={styles.input} name="marca" placeholder="Daikin, Carrier, LG..." value={form.marca} onChange={handleChange} required />
            </div>
            <div>
              <label style={styles.label}>Modelo</label>
              <input style={styles.input} name="modelo" placeholder="FTXS35KVMA" value={form.modelo} onChange={handleChange} />
            </div>
            <div>
              <label style={styles.label}>N° de Serie</label>
              <input style={styles.input} name="serie" placeholder="D4Y0041045" value={form.serie} onChange={handleChange} />
            </div>
            <div>
              <label style={styles.label}>Capacidad (BTU)</label>
              <input style={styles.input} name="capacidad" placeholder="12000" value={form.capacidad} onChange={handleChange} />
            </div>
            <div>
              <label style={styles.label}>Tipo de refrigerante</label>
              <select style={styles.input} name="tipoRefrigerante" value={form.tipoRefrigerante} onChange={handleChange}>
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

          <p style={styles.seccion}>⚡ Datos eléctricos</p>
          <div style={styles.grid3}>
            <div>
              <label style={styles.label}>Voltaje (V)</label>
              <input style={styles.input} name="voltaje" placeholder="220" value={form.voltaje} onChange={handleChange} />
            </div>
            <div>
              <label style={styles.label}>Amperaje (A)</label>
              <input style={styles.input} name="amperaje" placeholder="15" value={form.amperaje} onChange={handleChange} />
            </div>
            <div>
              <label style={styles.label}>Fases</label>
              <select style={styles.input} name="fases" value={form.fases} onChange={handleChange}>
                <option>Monofásico</option>
                <option>Trifásico</option>
              </select>
            </div>
          </div>

          <p style={styles.seccion}>🔧 Mantenimiento</p>
          <div>
            <label style={styles.label}>Estado del equipo</label>
            <select style={styles.input} name="estado" value={form.estado} onChange={handleChange}>
              <option>Operativo</option>
              <option>Operativo con observaciones</option>
              <option>Fuera de servicio</option>
            </select>
          </div>
          <div>
            <label style={styles.label}>Fecha último mantenimiento</label>
            <input style={styles.input} type="date" name="ultimoMantenimiento" value={form.ultimoMantenimiento} onChange={handleChange} />
          </div>
          <div>
            <label style={styles.label}>Observaciones del mantenimiento</label>
            <textarea style={styles.textarea} name="observaciones" placeholder="Descripción del mantenimiento..." value={form.observaciones} onChange={handleChange} />
          </div>
          <div>
            <label style={styles.label}>Correctivos realizados</label>
            <textarea style={styles.textarea} name="correctivos" placeholder="Reemplazo de capacitor, recarga de gas..." value={form.correctivos} onChange={handleChange} />
          </div>
          <div>
            <label style={styles.label}>Recomendaciones</label>
            <textarea style={styles.textarea} name="recomendaciones" placeholder="Limpiar filtros cada 30 días..." value={form.recomendaciones} onChange={handleChange} />
          </div>

          <button style={styles.btnGuardar} type="submit">
            {equipoId ? "💾 Actualizar equipo" : "💾 Guardar equipo"}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: "100vh", background: "#f0f4f8", padding: "1.5rem" },
  card: { background: "white", borderRadius: "12px", padding: "2rem", maxWidth: "750px", margin: "0 auto", boxShadow: "0 2px 10px rgba(0,0,0,0.08)" },
  header: { display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" },
  titulo: { color: "#1a73e8", margin: 0 },
  seccion: { fontWeight: "600", color: "#444", borderBottom: "1px solid #eee", paddingBottom: "0.5rem", marginTop: "1.5rem" },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "0.5rem" },
  grid3: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem", marginBottom: "0.5rem" },
  label: { display: "block", fontSize: "13px", color: "#555", marginBottom: "4px", fontWeight: "500" },
  input: { width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "14px", boxSizing: "border-box", marginBottom: "1rem" },
  textarea: { width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "14px", boxSizing: "border-box", marginBottom: "1rem", minHeight: "80px", resize: "vertical" },
  btnGuardar: { width: "100%", padding: "14px", background: "#1a73e8", color: "white", border: "none", borderRadius: "8px", fontSize: "16px", cursor: "pointer", fontWeight: "600", marginTop: "1rem" },
  btnVolver: { background: "none", border: "1px solid #ddd", borderRadius: "8px", padding: "8px 14px", cursor: "pointer", color: "#555" }
};