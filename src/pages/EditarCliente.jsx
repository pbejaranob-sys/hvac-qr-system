import { useState, useEffect } from "react";
import { db } from "../firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useNavigate, useParams } from "react-router-dom";

const FIREBASE_API_KEY = "AIzaSyCkdDUDpl-rTNLjABO_o6gLTqHa92yUbIs";

export default function EditarCliente() {
  const { clienteId } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({ nombre: "", empresa: "", ruc: "", direccion: "", email: "" });
  const [nuevaPassword, setNuevaPassword] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [cambiandoPass, setCambiandoPass] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [mensajePass, setMensajePass] = useState("");
  const [clienteUid, setClienteUid] = useState("");

  useEffect(() => {
    const cargar = async () => {
      const snap = await getDoc(doc(db, "clientes", clienteId));
      if (snap.exists()) {
        const data = snap.data();
        setForm(data);
        setClienteUid(data.uid || "");
      }
    };
    cargar();
  }, [clienteId]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

 const handleSubmit = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setMensaje("");
    try {
      const snapAnterior = await getDoc(doc(db, "clientes", clienteId));
      const empresaAnterior = snapAnterior.data().empresa;

      await updateDoc(doc(db, "clientes", clienteId), {
        nombre: form.nombre,
        empresa: form.empresa,
        ruc: form.ruc,
        direccion: form.direccion,
        email: form.email,
      });

      // Si cambió el nombre de la empresa, actualizar equipos y sedes
      if (empresaAnterior !== form.empresa) {
        const { collection, getDocs, query, where, writeBatch } = await import("firebase/firestore");
        const batch = writeBatch(db);

        const qEq = query(collection(db, "equipos"), where("cliente", "==", empresaAnterior));
        const snapEq = await getDocs(qEq);
        snapEq.docs.forEach(d => batch.update(d.ref, { cliente: form.empresa }));

        const qSedes = query(collection(db, "sedes"), where("cliente", "==", empresaAnterior));
        const snapSedes = await getDocs(qSedes);
        snapSedes.docs.forEach(d => batch.update(d.ref, { cliente: form.empresa }));

        await batch.commit();
      }

      setMensaje("✅ Cliente actualizado correctamente");
      setTimeout(() => navigate("/panel-admin"), 1500);
    } catch (err) {
      setMensaje("Error: " + err.message);
    }
    setGuardando(false);
  };

  const handleCambiarPassword = async () => {
    if (!nuevaPassword || nuevaPassword.length < 6) {
      setMensajePass("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (!clienteUid) {
      setMensajePass("No se encontró el UID del cliente.");
      return;
    }
    setCambiandoPass(true);
    setMensajePass("");
    try {
      const res = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${FIREBASE_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            localId: clienteUid,
            password: nuevaPassword,
            returnSecureToken: false
          })
        }
      );
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      setMensajePass("✅ Contraseña actualizada correctamente");
      setNuevaPassword("");
    } catch (err) {
      setMensajePass("Error: " + err.message);
    }
    setCambiandoPass(false);
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
          <button style={s.btnBack} onClick={() => navigate("/panel-admin")}>← Panel Admin</button>
          <div style={s.divider}></div>
          <span style={s.navTitle}>Editar cliente</span>
        </div>
      </div>

      <div style={s.content}>
        {/* Datos del cliente */}
        <div style={s.card}>
          <div style={s.secTitulo}>📋 Datos del cliente</div>
          {mensaje && <div style={mensaje.includes("Error") ? s.errorBox : s.exito}>{mensaje}</div>}
          <form onSubmit={handleSubmit}>
            <div style={s.grid2}>
              <div style={s.formRow}>
                <label style={s.label}>Nombre completo</label>
                <input style={s.input} name="nombre" value={form.nombre || ""} onChange={handleChange} required />
              </div>
              <div style={s.formRow}>
                <label style={s.label}>Empresa</label>
                <input style={s.input} name="empresa" value={form.empresa || ""} onChange={handleChange} required />
              </div>
              <div style={s.formRow}>
                <label style={s.label}>RUC</label>
                <input style={s.input} name="ruc" value={form.ruc || ""} onChange={handleChange} />
              </div>
              <div style={s.formRow}>
                <label style={s.label}>Dirección</label>
                <input style={s.input} name="direccion" value={form.direccion || ""} onChange={handleChange} />
              </div>
              <div style={s.formRow}>
                <label style={s.label}>Correo electrónico</label>
                <input style={s.input} name="email" value={form.email || ""} onChange={handleChange} />
              </div>
            </div>
            <button style={s.btnGuardar} type="submit" disabled={guardando}>
              {guardando ? "Guardando..." : "💾 Guardar cambios"}
            </button>
          </form>
        </div>

        {/* Cambiar contraseña */}
        <div style={{ ...s.card, marginTop: "16px" }}>
          <div style={s.secTitulo}>🔐 Cambiar contraseña</div>
          {mensajePass && <div style={mensajePass.includes("Error") || mensajePass.includes("debe") ? s.errorBox : s.exito}>{mensajePass}</div>}
          <div style={{ display: "flex", gap: "10px", alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <label style={s.label}>Nueva contraseña</label>
              <input
                style={s.input}
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={nuevaPassword}
                onChange={e => setNuevaPassword(e.target.value)}
                minLength={6}
              />
            </div>
            <button style={s.btnCambiarPass} onClick={handleCambiarPassword} disabled={cambiandoPass}>
              {cambiandoPass ? "Cambiando..." : "Cambiar contraseña"}
            </button>
          </div>
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
  secTitulo: { fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 500, marginBottom: "16px" },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" },
  formRow: { display: "flex", flexDirection: "column" },
  label: { fontSize: "12px", color: "#555", marginBottom: "5px", fontWeight: 500 },
  input: { padding: "9px 12px", borderRadius: "8px", border: "0.5px solid #ddd", fontSize: "13px", background: "#fafafa", outline: "none", width: "100%", boxSizing: "border-box" },
  btnGuardar: { width: "100%", padding: "12px", background: "#1a5fa8", color: "white", border: "none", borderRadius: "8px", fontSize: "14px", cursor: "pointer", fontWeight: 500 },
  btnCambiarPass: { padding: "10px 16px", background: "#1a5fa8", color: "white", border: "none", borderRadius: "8px", fontSize: "13px", cursor: "pointer", fontWeight: 500, whiteSpace: "nowrap" },
  exito: { background: "#e8f5e9", color: "#2e7d32", padding: "12px", borderRadius: "8px", marginBottom: "16px", fontSize: "14px" },
  errorBox: { background: "#ffebee", color: "#c62828", padding: "12px", borderRadius: "8px", marginBottom: "16px", fontSize: "14px" },
};