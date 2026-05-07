import { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { signOut } from "firebase/auth";
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

export default function Dashboard() {
  const [equiposPorCliente, setEquiposPorCliente] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    const verificarRol = async () => {
      const user = auth.currentUser;
      if (!user) { navigate("/"); return; }
      const q = query(collection(db, "usuarios"), where("email", "==", user.email));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const rol = snap.docs[0].data().rol;
        if (rol === "admin") { navigate("/admin"); return; }
        if (rol === "cliente") { navigate("/cliente"); return; }
      }
      cargarEquipos();
    };
    verificarRol();
  }, []);

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

  const agruparPorPiso = (equipos) => {
    const porPiso = {};
    equipos.forEach(e => {
      const piso = e.piso || "Sin piso";
      if (!porPiso[piso]) porPiso[piso] = [];
      porPiso[piso].push(e);
    });
    return porPiso;
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

      <div style={styles.statsRow}>
        <div style={styles.stat}><div style={styles.statNum}>{Object.keys(equiposPorCliente).length}</div><div style={styles.statLabel}>Clientes</div></div>
        <div style={styles.stat}><div style={styles.statNum}>{totalEquipos}</div><div style={styles.statLabel}>Equipos totales</div></div>
        <div style={styles.stat}><div style={{...styles.statNum, color:"#2e7d32"}}>{Object.values(equiposPorCliente).flat().filter(e => e.estado === "Operativo").length}</div><div style={styles.statLabel}>Operativos</div></div>
        <div style={styles.stat}><div style={{...styles.statNum, color:"#c62828"}}>{Object.values(equiposPorCliente).flat().filter(e => e.estado === "Fuera de servicio").length}</div><div style={styles.statLabel}>Fuera de servicio</div></div>
      </div>

      {Object.entries(equiposPorCliente).map(([cliente, equipos]) => {
        const porPiso = agruparPorPiso(equipos);
        const pisosOrdenados = Object.keys(porPiso).sort(ordenarPisos);
        let itemNum = 1;

        return (
          <div key={cliente} style={styles.clienteBloque}>
            <div style={styles.clienteHeader}>
              <span style={styles.clienteNombre}>👤 {cliente}</span>
              <span style={styles.clienteCount}>{equipos.length} equipo{equipos.length !== 1 ? "s" : ""}</span>
            </div>

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
                    <>
                      <tr key={`piso-${piso}`}>
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
                                <button style={styles.btnAzul} onClick={() => navigate(`/equipo/${equipo.id}`)}>Ver QR</button>
                                <button style={styles.btnEditar} onClick={() => navigate(`/registrar?id=${equipo.id}`)}>Editar</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
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
  tablaWrapper: { overflowX: "auto" },
  tabla: { width: "100%", borderCollapse: "collapse", fontSize: "13px" },
  thead: { background: "#f0f4f8" },
  th: { padding: "10px 12px", textAlign: "left", fontWeight: "600", color: "#444", whiteSpace: "nowrap", borderBottom: "2px solid #e0e0e0" },
  pisoHeader: { background: "#e3f2fd", color: "#1565c0", fontWeight: "700", padding: "8px 12px", fontSize: "13px" },
  tr: { borderBottom: "1px solid #f0f0f0" },
  td: { padding: "10px 12px", color: "#444", whiteSpace: "nowrap" },
  badge: { padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: "600", whiteSpace: "nowrap" },
  acciones: { display: "flex", gap: "6px" },
  btnVerde: { background: "#34a853", color: "white", border: "none", borderRadius: "8px", padding: "10px 16px", cursor: "pointer", fontWeight: "500" },
  btnRojo: { background: "#ea4335", color: "white", border: "none", borderRadius: "8px", padding: "10px 16px", cursor: "pointer", fontWeight: "500" },
  btnAzul: { background: "#1a73e8", color: "white", border: "none", borderRadius: "8px", padding: "6px 12px", cursor: "pointer", fontSize: "12px" },
  btnEditar: { background: "#f9ab00", color: "white", border: "none", borderRadius: "8px", padding: "6px 12px", cursor: "pointer", fontSize: "12px" },
  vacio: { textAlign: "center", padding: "3rem", background: "white", borderRadius: "12px", color: "#666" }
};