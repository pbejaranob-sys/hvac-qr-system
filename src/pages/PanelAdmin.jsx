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

export default function PanelAdmin() {
  const [equipos, setEquipos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [filtro, setFiltro] = useState("Todos");
  const navigate = useNavigate();

  useEffect(() => { cargarEquipos(); }, []);

  const cargarEquipos = async () => {
    const snapshot = await getDocs(collection(db, "equipos"));
    const lista = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    setEquipos(lista);
    const clientesUnicos = ["Todos", ...new Set(lista.map(e => e.cliente || "Sin cliente"))];
    setClientes(clientesUnicos);
  };

  const equiposFiltrados = filtro === "Todos" ? equipos : equipos.filter(e => (e.cliente || "Sin cliente") === filtro);
  const agrupados = {};
  equiposFiltrados.forEach((equipo) => {
    const cliente = equipo.cliente || "Sin cliente";
    if (!agrupados[cliente]) agrupados[cliente] = [];
    agrupados[cliente].push(equipo);
  });

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/");
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.titulo}>👑 Panel Maestro</h1>
        <div style={styles.headerBtns}>
          <button style={styles.btnVerde} onClick={() => navigate("/crear-usuario")}>+ Crear usuario</button>
          <button style={styles.btnAzul} onClick={() => navigate("/registrar")}>+ Nuevo equipo</button>
          <button style={styles.btnRojo} onClick={handleLogout}>Cerrar sesión</button>
        </div>
      </div>

      <div style={styles.statsRow}>
        <div style={styles.stat}><div style={styles.statNum}>{clientes.length - 1}</div><div style={styles.statLabel}>Clientes</div></div>
        <div style={styles.stat}><div style={styles.statNum}>{equipos.length}</div><div style={styles.statLabel}>Equipos totales</div></div>
        <div style={styles.stat}><div style={{...styles.statNum, color:"#2e7d32"}}>{equipos.filter(e => e.estado === "Operativo").length}</div><div style={styles.statLabel}>Operativos</div></div>
        <div style={styles.stat}><div style={{...styles.statNum, color:"#f57f17"}}>{equipos.filter(e => e.estado === "Operativo con observaciones").length}</div><div style={styles.statLabel}>Con observaciones</div></div>
        <div style={styles.stat}><div style={{...styles.statNum, color:"#c62828"}}>{equipos.filter(e => e.estado === "Fuera de servicio").length}</div><div style={styles.statLabel}>Fuera de servicio</div></div>
      </div>

      <div style={styles.filtroRow}>
        <span style={styles.filtroLabel}>Filtrar por cliente:</span>
        <div style={styles.filtrosBtns}>
          {clientes.map(c => (
            <button key={c} style={{...styles.filtroBtn, ...(filtro === c ? styles.filtroActivo : {})}} onClick={() => setFiltro(c)}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {Object.entries(agrupados).map(([cliente, equiposCliente]) => (
        <div key={cliente} style={styles.clienteBloque}>
          <div style={styles.clienteHeader}>
            <span style={styles.clienteNombre}>👤 {cliente}</span>
            <span style={styles.clienteCount}>{equiposCliente.length} equipo{equiposCliente.length !== 1 ? "s" : ""}</span>
          </div>
          <div style={styles.grid}>
            {equiposCliente.map((equipo) => (
              <div key={equipo.id} style={styles.card}>
                <div style={styles.cardHeader}>
                  <div>
                    <div style={styles.tipoEquipo}>{equipo.tipoEquipo || "Equipo"}</div>
                    <div style={styles.marca}>{equipo.marca} — {equipo.modelo}</div>
                  </div>
                  <span style={{...styles.badge, ...getBadgeStyle(equipo.estado)}}>{equipo.estado || "Operativo"}</span>
                </div>
                <p style={styles.info}>📍 {equipo.ubicacion}</p>
                <p style={styles.info}>🔧 {equipo.ultimoMantenimiento || "Sin registro"}</p>
                <p style={styles.info}>❄️ {equipo.capacidad} BTU · {equipo.tipoRefrigerante || ""}</p>
                <div style={styles.cardBtns}>
                  <button style={styles.btnVerQR} onClick={() => navigate(`/equipo/${equipo.id}`)}>Ver QR</button>
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
  headerBtns: { display: "flex", gap: "0.5rem", flexWrap: "wrap" },
  statsRow: { display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "10px", marginBottom: "1.5rem" },
  stat: { background: "white", borderRadius: "10px", padding: "0.75rem", textAlign: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" },
  statNum: { fontSize: "24px", fontWeight: "700", color: "#1a73e8" },
  statLabel: { fontSize: "11px", color: "#888", marginTop: "4px" },
  filtroRow: { background: "white", borderRadius: "10px", padding: "1rem", marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" },
  filtroLabel: { fontSize: "14px", color: "#555", fontWeight: "500" },
  filtrosBtns: { display: "flex", gap: "8px", flexWrap: "wrap" },
  filtroBtn: { padding: "6px 14px", borderRadius: "20px", border: "1px solid #ddd", background: "white", cursor: "pointer", fontSize: "13px", color: "#555" },
  filtroActivo: { background: "#1a73e8", color: "white", border: "1px solid #1a73e8" },
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
  btnVerde: { background: "#34a853", color: "white", border: "none", borderRadius: "8px", padding: "8px 14px", cursor: "pointer", fontSize: "13px" },
  btnAzul: { background: "#1a73e8", color: "white", border: "none", borderRadius: "8px", padding: "8px 14px", cursor: "pointer", fontSize: "13px" },
  btnRojo: { background: "#ea4335", color: "white", border: "none", borderRadius: "8px", padding: "8px 14px", cursor: "pointer", fontSize: "13px" },
  btnVerQR: { background: "#1a73e8", color: "white", border: "none", borderRadius: "8px", padding: "7px 12px", cursor: "pointer", fontSize: "12px", flex: 1 },
  btnEditar: { background: "#f9ab00", color: "white", border: "none", borderRadius: "8px", padding: "7px 12px", cursor: "pointer", fontSize: "12px" }
};