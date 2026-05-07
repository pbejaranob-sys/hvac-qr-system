import { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";

const getBadgeStyle = (estado) => {
  if (estado === "Operativo") return { background: "#e8f5e9", color: "#2e7d32" };
  if (estado === "Operativo con observaciones") return { background: "#fff8e1", color: "#f57f17" };
  return { background: "#ffebee", color: "#c62828" };
};

export default function Dashboard() {
  const [equiposPorCliente, setEquiposPorCliente] = useState({});
  const navigate = useNavigate();

  useEffect(() => { cargarEquipos(); }, []);

  const cargarEquipos = async () => {
    const snapshot = await getDocs(collection(db, "equipos"));
    const lista = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    const agrupados = {};
    lista.forEach((equipo) => {
      const cliente = equipo.cliente || "Sin cliente";
      if (!agrupados[cliente]) agrupados[cliente] = [];
      agrupados[cliente].push(equipo);
    });
    setEquiposPorCliente(agrupados);
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/");
  };

  const totalEquipos = Object.values(equiposPorCliente).flat().length;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.titulo}>🌬️ HVAC QR System</h1>
        <div style={styles.headerBtns}>
          <button style={styles.btnVerde} onClick={() => navigate("/registrar")}>+ Nuevo Equipo</button>
          <button style={styles.btnRojo} onClick={handleLogout}>Cerrar sesión</button>
        </div>
      </div>

      <div style={styles.statsRow}>
        <div style={styles.stat}>
          <div style={styles.statNum}>{Object.keys(equiposPorCliente).length}</div>
          <div style={styles.statLabel}>Clientes</div>
        </div>
        <div style={styles.stat}>
          <div style={styles.statNum}>{totalEquipos}</div>
          <div style={styles.statLabel}>Equipos totales</div>
        </div>
        <div style={styles.stat}>
          <div style={styles.statNum} style={{color:"#2e7d32"}}>
            {Object.values(equiposPorCliente).flat().filter(e => e.estado === "Operativo").length}
          </div>
          <div style={styles.statLabel}>Operativos</div>
        </div>
        <div style={styles.stat}>
          <div style={styles.statNum} style={{color:"#c62828"}}>
            {Object.values(equiposPorCliente).flat().filter(e => e.estado === "Fuera de servicio").length}
          </div>
          <div style={styles.statLabel}>Fuera de servicio</div>
        </div>
      </div>

      {Object.keys(equiposPorCliente).length === 0 && (
        <div style={styles.vacio}>
          <p>No tienes equipos registrados aún.</p>
          <button style={styles.btnVerde} onClick={() => navigate("/registrar")}>Registrar primer equipo</button>
        </div>
      )}

      {Object.entries(equiposPorCliente).map(([cliente, equipos]) => (
        <div key={cliente} style={styles.clienteBloque}>
          <div style={styles.clienteHeader}>
            <span style={styles.clienteNombre}>👤 {cliente}</span>
            <span style={styles.clienteCount}>{equipos.length} equipo{equipos.length !== 1 ? "s" : ""}</span>
          </div>
          <div style={styles.grid}>
            {equipos.map((equipo) => (
              <div key={equipo.id} style={styles.card}>
                <div style={styles.cardHeader}>
                  <div>
                    <div style={styles.tipoEquipo}>{equipo.tipoEquipo || "Equipo"}</div>
                    <div style={styles.marca}>{equipo.marca} — {equipo.modelo}</div>
                  </div>
                  <span style={{...styles.badge, ...getBadgeStyle(equipo.estado)}}>
                    {equipo.estado || "Operativo"}
                  </span>
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
      ))}
    </div>
  );
}

const styles = {
  container: { minHeight: "100vh", background: "#f0f4f8", padding: "1.5rem" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "1rem" },
  titulo: { color: "#1a73e8", margin: 0 },
  headerBtns: { display: "flex", gap: "0.75rem" },
  statsRow: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "1.5rem" },
  stat: { background: "white", borderRadius: "10px", padding: "1rem", textAlign: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" },
  statNum: { fontSize: "28px", fontWeight: "700", color: "#1a73e8" },
  statLabel: { fontSize: "12px", color: "#888", marginTop: "4px" },
  clienteBloque: { background: "white", borderRadius: "12px", padding: "1.25rem", marginBottom: "1.5rem", boxShadow: "0 2px 10px rgba(0,0,0,0.07)" },
  clienteHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", paddingBottom: "0.75rem", borderBottom: "2px solid #f0f4f8" },
  clienteNombre: { fontSize: "17px", fontWeight: "700", color: "#1a73e8" },
  clienteCount: { fontSize: "13px", color: "#888", background: "#f0f4f8", padding: "3px 10px", borderRadius: "20px" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem" },
  card: { background: "#f8f9fa", borderRadius: "10px", padding: "1rem", border: "1px solid #eee" },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" },
  tipoEquipo: { fontSize: "11px", color: "#888", textTransform: "uppercase", marginBottom: "2px" },
  marca: { fontWeight: "600", color: "#222", fontSize: "14px" },
  badge: { padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: "600", whiteSpace: "nowrap" },
  info: { color: "#555", fontSize: "13px", margin: "3px 0" },
  cardBtns: { display: "flex", gap: "0.5rem", marginTop: "0.75rem" },
  btnVerde: { background: "#34a853", color: "white", border: "none", borderRadius: "8px", padding: "10px 16px", cursor: "pointer", fontWeight: "500" },
  btnRojo: { background: "#ea4335", color: "white", border: "none", borderRadius: "8px", padding: "10px 16px", cursor: "pointer", fontWeight: "500" },
  btnAzul: { background: "#1a73e8", color: "white", border: "none", borderRadius: "8px", padding: "8px 12px", cursor: "pointer", fontSize: "12px", flex: 1 },
  btnEditar: { background: "#f9ab00", color: "white", border: "none", borderRadius: "8px", padding: "8px 12px", cursor: "pointer", fontSize: "12px" },
  vacio: { textAlign: "center", padding: "3rem", background: "white", borderRadius: "12px", color: "#666" }
};