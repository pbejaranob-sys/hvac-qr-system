import React from "react";
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

const ordenarPisos = (a, b) => {
  const orden = ["sotano", "sótano", "subsuelo", "ss"];
  const aLow = a.toLowerCase();
  const bLow = b.toLowerCase();
  if (orden.includes(aLow)) return -1;
  if (orden.includes(bLow)) return 1;
  const aNum = parseInt(a);
  const bNum = parseInt(b);
  if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
  return a.localeCompare(b);
};

export default function PanelCliente() {
  const [equipos, setEquipos] = useState([]);
  const [usuario, setUsuario] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState("Todos");
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

  const agruparPorPiso = (equipos) => {
    const porPiso = {};
    equipos.forEach(e => {
      const piso = e.piso || "Sin piso";
      if (!porPiso[piso]) porPiso[piso] = [];
      porPiso[piso].push(e);
    });
    return porPiso;
  };

  const equiposFiltrados = filtroEstado === "Todos" ? equipos : equipos.filter(e => e.estado === filtroEstado);
  const porPiso = agruparPorPiso(equiposFiltrados);
  const pisosOrdenados = Object.keys(porPiso).sort(ordenarPisos);
  let itemNum = 1;

  if (cargando) return <div style={styles.centro}>Cargando...</div>;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.titulo}>🏢 {usuario?.empresa}</h1>
          <p style={styles.bienvenida}>Bienvenido, {usuario?.nombre}</p>
        </div>
        <div style={styles.headerBtns}>
          <button style={styles.btnRojo} onClick={handleLogout}>Cerrar sesión</button>
        </div>
      </div>

      <div style={styles.statsRow}>
        <div style={styles.stat}><div style={styles.statNum}>{equipos.length}</div><div style={styles.statLabel}>Equipos totales</div></div>
        <div style={styles.stat}><div style={{...styles.statNum, color:"#2e7d32"}}>{equipos.filter(e => e.estado === "Operativo").length}</div><div style={styles.statLabel}>Operativos</div></div>
        <div style={styles.stat}><div style={{...styles.statNum, color:"#f57f17"}}>{equipos.filter(e => e.estado === "Operativo con observaciones").length}</div><div style={styles.statLabel}>Con observaciones</div></div>
        <div style={styles.stat}><div style={{...styles.statNum, color:"#c62828"}}>{equipos.filter(e => e.estado === "Fuera de servicio").length}</div><div style={styles.statLabel}>Fuera de servicio</div></div>
      </div>

      <div style={styles.filtroRow}>
        <span style={styles.filtroLabel}>Estado:</span>
        <select style={styles.selectEstado} value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
          <option value="Todos">Todos</option>
          <option value="Operativo">✅ Operativo</option>
          <option value="Operativo con observaciones">⚠️ Con observaciones</option>
          <option value="Fuera de servicio">🔴 Fuera de servicio</option>
        </select>
      </div>

      {equipos.length === 0 && (
        <div style={styles.vacio}>
          <p>No hay equipos registrados aún.</p>
        </div>
      )}

      {equiposFiltrados.length > 0 && (
        <div style={styles.clienteBloque}>
          <div style={styles.tablaWrapper}>
            <table style={styles.tabla}>
              <thead>
                <tr style={styles.thead}>
                  <th style={styles.th}>Item</th>
                  <th style={styles.th}>Piso</th>
                  <th style={styles.th}>Ambiente</th>
                  <th style={styles.th}>Tipo equipo</th>
                  <th style={styles.th}>Marca</th>
                  <th style={styles.th}>Modelo</th>
                  <th style={styles.th}>Serie</th>
                  <th style={styles.th}>Estado</th>
                  <th style={styles.th}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {pisosOrdenados.map(piso => (
                  <React.Fragment key={piso}>
                    <tr>
                      <td colSpan={9} style={styles.pisoHeader}>
                        🏢 {piso === "Sin piso" ? "Sin piso asignado" : `Piso ${piso}`}
                      </td>
                    </tr>
                    {porPiso[piso].map((equipo) => {
                      const item = itemNum++;
                      return (
                        <tr key={equipo.id} style={styles.tr}>
                          <td style={styles.td}>{item}</td>
                          <td style={styles.td}>{equipo.piso || "—"}</td>
                          <td style={styles.td}>{equipo.ambiente || "—"}</td>
                          <td style={styles.td}>{equipo.tipoEquipo || "—"}</td>
                          <td style={styles.td}>{equipo.marca || "—"}</td>
                          <td style={styles.td}>{equipo.modelo || "—"}</td>
                          <td style={styles.td}>{equipo.serie || "—"}</td>
                          <td style={styles.td}>
                            <span style={{...styles.badge, ...getBadgeStyle(equipo.estado)}}>
                              {equipo.estado || "Operativo"}
                            </span>
                          </td>
                          <td style={styles.td}>
                            <div style={styles.acciones}>
                              <button style={styles.btnInfo} onClick={() => navigate(`/equipo/${equipo.id}`)}>Información</button>
                              <button style={styles.btnCotizar} onClick={() => navigate(`/cotizacion/${equipo.id}`)}>Cotización</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
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
  filtroRow: { background: "white", borderRadius: "10px", padding: "1rem", marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "1rem" },
  filtroLabel: { fontSize: "14px", color: "#555", fontWeight: "600" },
  selectEstado: { padding: "6px 14px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "13px", cursor: "pointer", background: "white" },
  clienteBloque: { background: "white", borderRadius: "12px", padding: "1.25rem", boxShadow: "0 2px 10px rgba(0,0,0,0.07)" },
  tablaWrapper: { overflowX: "auto" },
  tabla: { width: "100%", borderCollapse: "collapse", fontSize: "13px" },
  thead: { background: "#f0f4f8" },
  th: { padding: "10px 12px", textAlign: "left", fontWeight: "600", color: "#444", whiteSpace: "nowrap", borderBottom: "2px solid #e0e0e0" },
  pisoHeader: { background: "#e3f2fd", color: "#1565c0", fontWeight: "700", padding: "8px 12px", fontSize: "13px" },
  tr: { borderBottom: "1px solid #f0f0f0" },
  td: { padding: "10px 12px", color: "#444", whiteSpace: "nowrap" },
  badge: { padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: "600", whiteSpace: "nowrap" },
  acciones: { display: "flex", gap: "6px" },
  btnRojo: { background: "#ea4335", color: "white", border: "none", borderRadius: "8px", padding: "8px 14px", cursor: "pointer", fontSize: "13px" },
  btnInfo: { background: "#1a73e8", color: "white", border: "none", borderRadius: "8px", padding: "6px 10px", cursor: "pointer", fontSize: "12px" },
  btnCotizar: { background: "#9c27b0", color: "white", border: "none", borderRadius: "8px", padding: "6px 10px", cursor: "pointer", fontSize: "12px" },
  vacio: { textAlign: "center", padding: "3rem", background: "white", borderRadius: "12px", color: "#666" }
};