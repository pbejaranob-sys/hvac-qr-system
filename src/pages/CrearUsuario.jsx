import { useState } from "react";
import { auth, db } from "../firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { collection, addDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export default function CrearUsuario() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    nombre: "",
    empresa: "",
    email: "",
    password: ""
  });
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setCargando(true);
    setError("");
    setMensaje("");
    try {
      await createUserWithEmailAndPassword(auth, form.email, form.password);
      await addDoc(collection(db, "usuarios"), {
        nombre: form.nombre,
        empresa: form.empresa,
        email: form.email,
        rol: "cliente",
        fechaCreacion: new Date().toLocaleDateString("es-PE")
      });
      setMensaje(`✅ Usuario creado exitosamente para ${form.empresa}`);
      setForm({ nombre: "", empresa: "", email: "", password: "" });
    } catch (err) {
      setError("Error: " + err.message);
    }
    setCargando(false);
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <button style={styles.btnVolver} onClick={() => navigate("/admin")}>← Volver</button>
          <h2 style={styles.titulo}>➕ Crear nuevo usuario cliente</h2>
        </div>

        <p style={styles.descripcion}>
          Crea una cuenta para que tu cliente pueda acceder a su panel y ver/editar solo sus equipos.
        </p>

        {mensaje && <div style={styles.exito}>{mensaje}</div>}
        {error && <div style={styles.errorBox}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={styles.formRow}>
            <label style={styles.label}>Nombre del contacto</label>
            <input style={styles.input} name="nombre" placeholder="Carlos Gómez" value={form.nombre} onChange={handleChange} required />
          </div>
          <div style={styles.formRow}>
            <label style={styles.label}>Nombre de la empresa</label>
            <input style={styles.input} name="empresa" placeholder="Clínica San Marcos" value={form.empresa} onChange={handleChange} required />
          </div>
          <div style={styles.formRow}>
            <label style={styles.label}>Correo electrónico</label>
            <input style={styles.input} type="email" name="email" placeholder="contacto@empresa.com" value={form.email} onChange={handleChange} required />
          </div>
          <div style={styles.formRow}>
            <label style={styles.label}>Contraseña temporal</label>
            <input style={styles.input} type="password" name="password" placeholder="Mínimo 6 caracteres" value={form.password} onChange={handleChange} required />
          </div>

          <div style={styles.infoBox}>
            <p style={styles.infoTexto}>💡 El cliente ingresará con este correo y contraseña a:</p>
            <p style={styles.infoUrl}>https://hvac-qr-system-1odv.vercel.app</p>
            <p style={styles.infoTexto}>Solo verá los equipos registrados con el nombre exacto de su empresa.</p>
          </div>

          <button style={styles.btnGuardar} type="submit" disabled={cargando}>
            {cargando ? "Creando usuario..." : "✅ Crear usuario cliente"}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: "100vh", background: "#f0f4f8", padding: "1.5rem" },
  card: { background: "white", borderRadius: "12px", padding: "2rem", maxWidth: "550px", margin: "0 auto", boxShadow: "0 2px 10px rgba(0,0,0,0.08)" },
  header: { display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" },
  titulo: { color: "#1a73e8", margin: 0, fontSize: "20px" },
  descripcion: { color: "#666", fontSize: "14px", marginBottom: "1.5rem", lineHeight: "1.6" },
  formRow: { marginBottom: "1rem" },
  label: { display: "block", fontSize: "13px", color: "#555", marginBottom: "4px", fontWeight: "500" },
  input: { width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "14px", boxSizing: "border-box" },
  btnGuardar: { width: "100%", padding: "14px", background: "#1a73e8", color: "white", border: "none", borderRadius: "8px", fontSize: "16px", cursor: "pointer", fontWeight: "600", marginTop: "1rem" },
  btnVolver: { background: "none", border: "1px solid #ddd", borderRadius: "8px", padding: "8px 14px", cursor: "pointer", color: "#555" },
  exito: { background: "#e8f5e9", color: "#2e7d32", padding: "12px", borderRadius: "8px", marginBottom: "1rem", fontSize: "14px" },
  errorBox: { background: "#ffebee", color: "#c62828", padding: "12px", borderRadius: "8px", marginBottom: "1rem", fontSize: "14px" },
  infoBox: { background: "#e3f2fd", borderRadius: "8px", padding: "12px", marginTop: "1rem" },
  infoTexto: { color: "#1565c0", fontSize: "13px", margin: "4px 0" },
  infoUrl: { color: "#1565c0", fontSize: "13px", fontWeight: "600", margin: "4px 0" }
};