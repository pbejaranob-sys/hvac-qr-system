import { useState } from "react";
import { db, auth } from "../firebase";
import { collection, addDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

const FIREBASE_API_KEY = "AIzaSyCkdDUDpl-rTNLjABO_o6gLTqHa92yUbIs";

export default function CrearCliente() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    nombre: "", empresa: "", ruc: "", direccion: "", email: "", password: ""
  });
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
      // Crear usuario en Firebase Auth sin cerrar sesión
      const res = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: form.email, password: form.password, returnSecureToken: true })
        }
      );
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);

      const nuevoUID = data.localId;
      const adminUid = auth.currentUser?.uid || "";

      // Crear documento en usuarios
      await addDoc(collection(db, "usuarios"), {
        uid: nuevoUID,
        nombre: form.nombre,
        empresa: form.empresa,
        ruc: form.ruc,
        direccion: form.direccion,
        email: form.email,
        rol: "cliente",
        adminid: adminUid,
        fechaCreacion: new Date().toLocaleDateString("es-PE")
      });

      // Crear documento en clientes
      await addDoc(collection(db, "clientes"), {
        nombre: form.nombre,
        empresa: form.empresa,
        ruc: form.ruc,
        direccion: form.direccion,
        email: form.email,
        uid: nuevoUID,
        adminid: adminUid,
        fechaCreacion: new Date().toLocaleDateString("es-PE")
      });

      setMensaje(`✅ Cliente creado: ${form.empresa}`);
      setForm({ nombre: "", empresa: "", ruc: "", direccion: "", email: "", password: "" });
    } catch (err) {
      setError("Error: " + err.message);
    }
    setCargando(false);
  };

  return (
    <div style={s.page}>
      <div style={s.navbar}>
        <div style={s.navLeft}>
          <div style={s.logo}>
            <span style={{ color: "#1a5fa8" }}>H</span>
            <span style={{ color: "#1a5fa8", marginRight: "-8px" }}>V</span>
            <span style={{ color: "#f0c040" }}>A</span>
            <span style={{ color: "#1a5fa8", marginLeft: "-2px" }}>C</span>
          </div>
          <div style={s.divider}></div>
          <button style={s.btnBack} onClick={() => navigate(-1)}>← Volver</button>
          <div style={s.divider}></div>
          <span style={s.navTitle}>Crear nuevo cliente</span>
        </div>
      </div>

      <div style={s.content}>
        <div style={s.card}>
          {mensaje && <div style={s.exito}>{mensaje}</div>}
          {error && <div style={s.errorBox}>{error}</div>}

          <form onSubmit={handleSubmit}>
            <div style={s.grid2}>
              <div style={s.formRow}>
                <label style={s.label}>Nombre completo</label>
                <input style={s.input} name="nombre" placeholder="Carlos Gómez" value={form.nombre} onChange={handleChange} required />
              </div>
              <div style={s.formRow}>
                <label style={s.label}>Empresa</label>
                <input style={s.input} name="empresa" placeholder="La Positiva SAC" value={form.empresa} onChange={handleChange} required />
              </div>
              <div style={s.formRow}>
                <label style={s.label}>RUC</label>
                <input style={s.input} name="ruc" placeholder="20512345678" value={form.ruc} onChange={handleChange} />
              </div>
              <div style={s.formRow}>
                <label style={s.label}>Dirección</label>
                <input style={s.input} name="direccion" placeholder="Av. Javier Prado 123" value={form.direccion} onChange={handleChange} />
              </div>
              <div style={s.formRow}>
                <label style={s.label}>Correo electrónico</label>
                <input style={s.input} type="email" name="email" placeholder="contacto@empresa.com" value={form.email} onChange={handleChange} required />
              </div>
              <div style={s.formRow}>
                <label style={s.label}>Contraseña temporal</label>
                <input style={s.input} type="password" name="password" placeholder="Mínimo 6 caracteres" value={form.password} onChange={handleChange} required minLength={6} />
              </div>
            </div>

            <div style={s.infoBox}>
              <p style={s.infoTexto}>💡 El cliente ingresará con este correo y contraseña a:</p>
              <p style={s.infoUrl}>https://hvac-qr-system-1odv.vercel.app</p>
            </div>

            <button style={s.btnGuardar} type="submit" disabled={cargando}>
              {cargando ? "Creando cliente..." : "✅ Crear cliente"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

const s = {
  page: { minHeight: "100vh", background: "#f0f4f8", fontFamily: "Inter, Arial, sans-serif" },
  navbar: { background: "white", borderBottom: "0.5px solid #e0e0e0", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10 },
  navLeft: { display: "flex", alignItems: "center", gap: "12px" },
  logo: { fontFamily: "'Arial Black', sans-serif", fontWeight: 900, fontSize: "20px", display: "flex", alignItems: "baseline" },
  divider: { width: "1px", height: "18px", background: "#e0e0e0" },
  btnBack: { background: "none", border: "none", color: "#1a5fa8", cursor: "pointer", fontSize: "13px", fontWeight: 500, padding: 0 },
  navTitle: { fontSize: "13px", color: "#555", fontWeight: 500 },
  content: { maxWidth: "700px", margin: "0 auto", padding: "24px" },
  card: { background: "white", border: "0.5px solid #e0e0e0", borderRadius: "12px", padding: "24px" },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" },
  formRow: { display: "flex", flexDirection: "column" },
  label: { fontSize: "12px", color: "#555", marginBottom: "5px", fontWeight: 500 },
  input: { padding: "9px 12px", borderRadius: "8px", border: "0.5px solid #ddd", fontSize: "13px", background: "#fafafa", outline: "none" },
  btnGuardar: { width: "100%", padding: "12px", background: "#1a5fa8", color: "white", border: "none", borderRadius: "8px", fontSize: "14px", cursor: "pointer", fontWeight: 500, marginTop: "8px" },
  exito: { background: "#e8f5e9", color: "#2e7d32", padding: "12px", borderRadius: "8px", marginBottom: "16px", fontSize: "14px" },
  errorBox: { background: "#ffebee", color: "#c62828", padding: "12px", borderRadius: "8px", marginBottom: "16px", fontSize: "14px" },
  infoBox: { background: "#e3f2fd", borderRadius: "8px", padding: "12px", marginBottom: "16px" },
  infoTexto: { color: "#1565c0", fontSize: "13px", margin: "4px 0" },
  infoUrl: { color: "#1565c0", fontSize: "13px", fontWeight: 600, margin: "4px 0" },
};