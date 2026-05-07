import { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";

const getBadgeStyle = (estado) => {
  if (estado === "Operativo") return { background: "#e8f5e9", color: "#2e7d32" };
  if (estado === "Operativo con observaciones") return { background: "#fff8e1", color: "#f57f17" };
  return { background: "#ffebee", color: "#c62828" };
};

export default function PanelCliente() {
  const [equipos, setEquipos] = useState([]);
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { navigate("/"); return; }
      const q = query(collection(db, "usuarios"), where("email", "==", user.email));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const userData = snap.docs[0].data();
        setUsuario(userData);
        cargarEquipos(userData.empresa);
      }
    });
    return () => unsub();
  }, []);

  const cargarEquipos = async (empresa) => {
    const q = query(collection(db, "equipos"), where("cliente", "==", empresa));
    const snapshot = await getDocs(q);
    const lista = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    setEquipos(lista);
    setCargando(false);
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/");
  };

  if (cargando) return <div style={styles.centro}>Cargando...</div>;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.titulo}>🏢 {usuario?.empresa}</h1>
          <p style={styles.bienvenida}>Bienvenido, {usuario?.nombre}</p>
        </div>
        <div style={styles.headerBtns}>
          <button style={styles.btnVerde} onClick={() => navigate("/registrar")}>+ Nuevo equipo</button>
          <button style={styles.btnRojo} onClick={handleLogout}>Cerrar sesión</button>
        </div>
      </div>

      <div style={styles.statsRow}>
        <div style={styles.stat}><div style={styles.statNum}>{equipos.length}</div><div style={styles.statLabel}>Equipos totales</div></div>
        <div style={styles.stat}><div style={{...styles.statNum, color:"#2e7d32"}}>{equipos.filter(e => e.estado === "Operativo").length}</div><div style={styles.statLabel}>Operativos</div></div>
        <div style={styles.stat}><div style={{...styles.statNum, color:"#f57f17"}}>{equipos.filter(e => e.estado === "Operativo con observaciones").length}</div><div style={styles.statLabel}>Con observaciones</div></div>
        <div style={styles.stat}><div style={{...styles.statNum, color:"#c62828"}}>{equipos.filter(e => e.estado === "Fuera de servicio").length}</div><div style={styles.statLabel}>Fuera de servicio</div></div>
      </div>

      {equipos.length === 0 && (
        <div style={styles.vacio}>
          <p>No hay equipos registrados aún.</p>
          <button style={styles.btnVerde} onClick={() => navigate("/registrar")}>Registrar primer equipo</button>
        </div>
      )}

      <div style={styles.grid}>
        {equipos.map((equipo) => (
          <div key={equipo.id} style={styles.card}>
            <div style={styles.cardHeader}>
              <div>
                <div style={styles.tipoEquipo}>{equipo.tipoEquipo || "Equipo"}</div>
                <div style={styles.marca}>{equipo.marca} — {equipo.modelo}</div>
              </div>
              <span style={{...styles.badge, ...getBadgeStyle(equipo.estado)}}>{equipo.estado || "Operativo"}</span>
            </div>
            <p style={styles.info}>📍 {equipo.ubicacion}</p>
            <p style={styles.info}>🔧 Últ. mant: {equipo.ultimoMantenimiento || "Sin registro"}</p>
            <p style={styles.info}>❄️ {equipo.capacidad} BTU · {equipo.tipoRefrigerante || ""}</p>
            {equipo.voltaje && <p style={styles.info}>⚡ {equipo.voltaje}V · {equipo.amperaje}A · {equipo.fases}</p>}
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
  centro: { textAlign: "center", padding: "3rem", fontSize: "18px" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "1rem" },
  titulo: { color: "#1a73e8", margin: 0 },
  bienvenida: { color: "#666", margin: "4px 0 0", fontSize: "14px" },
  headerBtns: { display: "flex", gap: "0.5rem" },
  statsRow: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px", marginBottom: "1.5rem" },
  stat: { background: "white", borderRadius: "10px", padding: "0.75rem", textAlign: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" },
  statNum: { fontSize: "24px", fontWeight: "700", color: "#1a73e8" },
  statLabel: { fontSize: "11px", color: "#888", marginTop: "4px" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem" },
  card: { background: "white", borderRadius: "10px", padding: "1rem", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" },
  tipoEquipo: { fontSize: "11px", color: "#888", textTransform: "uppercase", marginBottom: "2px" },
  marca: { fontWeight: "600", color: "#222", fontSize: "14px" },
  badge: { padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: "600", whiteSpace: "nowrap" },
  info: { color: "#555", fontSize: "13px", margin: "3px 0" },
  cardBtns: { display: "flex", gap: "0.5rem", marginTop: "0.75rem" },
  btnVerde: { background: "#34a853", color: "white", border: "none", borderRadius: "8px", padding: "8px 14px", cursor: "pointer", fontSize: "13px" },
  btnRojo: { background: "#ea4335", color: "white", border: "none", borderRadius: "8px", padding: "8px 14px", cursor: "pointer", fontSize: "13px" },
  btnAzul: { background: "#1a73e8", color: "white", border: "none", borderRadius: "8px", padding: "8px 12px", cursor: "pointer", fontSize: "12px", flex: 1 },
  btnEditar: { background: "#f9ab00", color: "white", border: "none", borderRadius: "8px", padding: "8px 12px", cursor: "pointer", fontSize: "12px" },
  vacio: { textAlign: "center", padding: "3rem", background: "white", borderRadius: "12px", color: "#666" }
};