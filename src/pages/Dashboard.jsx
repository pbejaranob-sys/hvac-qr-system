import { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const [equipos, setEquipos] = useState([]);
  const navigate = useNavigate();

  useEffect(() => { cargarEquipos(); }, []);

  const cargarEquipos = async () => {
    const snapshot = await getDocs(collection(db, "equipos"));
    const lista = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    setEquipos(lista);
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/");
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.titulo}>🌬️ HVAC QR System</h1>
        <div style={styles.headerBtns}>
          <button style={styles.btnVerde} onClick={() => navigate("/registrar")}>+ Nuevo Equipo</button>
          <button style={styles.btnRojo} onClick={handleLogout}>Cerrar sesión</button>
        </div>
      </div>
      <h2 style={styles.subtitulo}>Mis equipos registrados</h2>
      {equipos.length === 0 && (
        <div style={styles.vacio}>
          <p>No tienes equipos registrados aún.</p>
          <button style={styles.btnVerde} onClick={() => navigate("/registrar")}>Registrar primer equipo</button>
        </div>
      )}
      <div style={styles.grid}>
        {equipos.map((equipo) => (
          <div key={equipo.id} style={styles.card}>
            <div style={styles.cardHeader}>
              <span style={styles.marca}>{equipo.marca} — {equipo.modelo}</span>
              <span style={styles.badge}>{equipo.estado || "Operativo"}</span>
            </div>
            <p style={styles.info}>📍 {equipo.ubicacion}</p>
            <p style={styles.info}>🔧 Último mant: {equipo.ultimoMantenimiento || "Sin registro"}</p>
            <p style={styles.info}>❄️ {equipo.capacidad} BTU · Serie: {equipo.serie}</p>
            <div style={styles.cardBtns}>
              <button style={styles.btnAzul} onClick={() => navigate(`/equipo/${equipo.id}`)}>Ver QR / Detalle</button>
              <button style={styles.btnEditar} onClick={() => navigate(`/registrar?id=${equipo.id}`)}>Editar</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: "100vh", background: "#f0f4f8", padding: "1.5rem" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" },
  titulo: { color: "#1a73e8", margin: 0 },
  headerBtns: { display: "flex", gap: "0.75rem" },
  subtitulo: { color: "#333", marginBottom: "1rem" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1rem" },
  card: { background: "white", borderRadius: "12px", padding: "1.25rem", boxShadow: "0 2px 10px rgba(0,0,0,0.08)" },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" },
  marca: { fontWeight: "600", color: "#222", fontSize: "15px" },
  badge: { background: "#e8f5e9", color: "#2e7d32", padding: "3px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: "500" },
  info: { color: "#555", fontSize: "14px", margin: "4px 0" },
  cardBtns: { display: "flex", gap: "0.5rem", marginTop: "1rem" },
  btnVerde: { background: "#34a853", color: "white", border: "none", borderRadius: "8px", padding: "10px 16px", cursor: "pointer", fontWeight: "500" },
  btnRojo: { background: "#ea4335", color: "white", border: "none", borderRadius: "8px", padding: "10px 16px", cursor: "pointer", fontWeight: "500" },
  btnAzul: { background: "#1a73e8", color: "white", border: "none", borderRadius: "8px", padding: "8px 14px", cursor: "pointer", fontSize: "13px", flex: 1 },
  btnEditar: { background: "#f9ab00", color: "white", border: "none", borderRadius: "8px", padding: "8px 14px", cursor: "pointer", fontSize: "13px" },
  vacio: { textAlign: "center", padding: "3rem", background: "white", borderRadius: "12px", color: "#666" }
};