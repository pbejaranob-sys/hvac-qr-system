import { useState } from "react";
import { db, auth } from "../firebase";
import { doc, setDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

const FIREBASE_API_KEY = "AIzaSyCkdDUDpl-rTNLjABO_o6gLTqHa92yUbIs";

export default function CrearUsuario() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ nombre: "", empresa: "", email: "", password: "", rol: "admin" });
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setCargando(true);
    setError("");
    setMensaje("");
    try {
      // Crear usuario en Firebase Auth sin cerrar sesión actual
      const res = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: form.email,
            password: form.password,
            returnSecureToken: true
          })
        }
      );
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);

      const nuevoUID = data.localId;

      // Crear documento en Firestore con el UID como ID
      await setDoc(doc(db, "usuarios", nuevoUID), {
        nombre: form.nombre,
        empresa: form.empresa,
        email: form.email,
        rol: form.rol,
        adminid: auth.currentUser?.uid || "",
        fechaCreacion: new Date().toLocaleDateString("es-PE")
      });

      setMensaje(`✅ ${form.rol === "admin" ? "Admin" : "Cliente"} creado: ${form.email}`);
      setForm({ nombre: "", empresa: "", email: "", password: "", rol: "admin" });
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
          <h2 style={styles.titulo}>➕ Crear nuevo usuario</h2>
        </div>

        {mensaje && <div style={styles.exito}>{mensaje}</div>}
        {error && <div style={styles.errorBox}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={styles.formRow}>
            <label style={styles.label}>Rol</label>
            <select style={styles.input} name="rol" value={form.rol} onChange={handleChange}>
              <option value="admin">Admin — gestiona sus propios clientes y equipos</option>
              <option value="cliente">Cliente — solo ve sus equipos</option>
            </select>
          </div>
          <div style={styles.formRow}>
            <label style={styles.label}>Nombre completo</label>
            <input style={styles.input} name="nombre" placeholder="Carlos Gómez" value={form.nombre} onChange={handleChange} required />
          </div>
          <div style={styles.formRow}>
            <label style={styles.label}>Empresa</label>
            <input style={styles.input} name="empresa" placeholder="Clínica San Marcos" value={form.empresa} onChange={handleChange} required />
          </div>
          <div style={styles.formRow}>
            <label style={styles.label}>Correo electrónico</label>
            <input style={styles.input} type="email" name="email" placeholder="contacto@empresa.com" value={form.email} onChange={handleChange} required />
          </div>
          <div style={styles.formRow}>
            <label style={styles.label}>Contraseña temporal</label>
            <input style={styles.input} type="password" name="password" placeholder="Mínimo 6 caracteres" value={form.password} onChange={handleChange} required minLength={6} />
          </div>

          <div style={styles.infoBox}>
            <p style={styles.infoTexto}>💡 El usuario ingresará con este correo y contraseña a:</p>
            <p style={styles.infoUrl}>https://hvac-qr-system-1odv.vercel.app</p>
          </div>

          <button style={styles.btnGuardar} type="submit" disabled={cargando}>
            {cargando ? "Creando..." : "✅ Crear usuario"}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: "100vh", background: "#f0f4f8", padding: "1.5rem" },
  card: { background: "white", borderRadius: "12px", padding: "2rem", maxWidth: "550px", margin: "0 auto", boxShadow: "0 2px 10px rgba(0,0,0,0.08)" },
  header: { display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" },
  titulo: { color: "#1a5fa8", margin: 0, fontSize: "20px" },
  formRow: { marginBottom: "1rem" },
  label: { display: "block", fontSize: "13px", color: "#555", marginBottom: "4px", fontWeight: "500" },
  input: { width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "14px", boxSizing: "border-box" },
  btnGuardar: { width: "100%", padding: "14px", background: "#1a5fa8", color: "white", border: "none", borderRadius: "8px", fontSize: "15px", cursor: "pointer", fontWeight: "600", marginTop: "1rem" },
  btnVolver: { background: "none", border: "1px solid #ddd", borderRadius: "8px", padding: "8px 14px", cursor: "pointer", color: "#555" },
  exito: { background: "#e8f5e9", color: "#2e7d32", padding: "12px", borderRadius: "8px", marginBottom: "1rem", fontSize: "14px" },
  errorBox: { background: "#ffebee", color: "#c62828", padding: "12px", borderRadius: "8px", marginBottom: "1rem", fontSize: "14px" },
  infoBox: { background: "#e3f2fd", borderRadius: "8px", padding: "12px", marginTop: "1rem" },
  infoTexto: { color: "#1565c0", fontSize: "13px", margin: "4px 0" },
  infoUrl: { color: "#1565c0", fontSize: "13px", fontWeight: "600", margin: "4px 0" },
};