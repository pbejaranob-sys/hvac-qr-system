import React, { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";

export default function PanelAdminNormal() {
  const [equipos, setEquipos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [nombreAdmin, setNombreAdmin] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        // Cargar datos del admin
        const { doc, getDoc } = await import("firebase/firestore");
        const docSnap = await getDoc(doc(db, "usuarios", user.uid));
        if (docSnap.exists()) setNombreAdmin(docSnap.data().nombre || "");
        cargarEquipos(user.uid);
      }
    });
    return () => unsubscribe();
  }, []);

  const cargarEquipos = async (uid) => {
    const q = query(collection(db, "equipos"), where("adminid", "==", uid));
    const snapshot = await getDocs(q);
    const lista = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    setEquipos(lista);
    const clientesUnicos = [...new Set(lista.map(e => e.cliente || "Sin cliente"))];
    setClientes(clientesUnicos);
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/");
  };

  const agrupados = {};
  equipos.forEach(e => {
    const cliente = e.cliente || "Sin cliente";
    if (!agrupados[cliente]) agrupados[cliente] = [];
    agrupados[cliente].push(e);
  });

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
          <div style={s.navDivider}></div>
          <span style={s.navTitle}>Panel Admin {nombreAdmin ? `· ${nombreAdmin}` : ""}</span>
        </div>
        <div style={s.navBtns}>
          <button style={s.btnDefault} onClick={() => navigate("/registrar")}>+ Nuevo equipo</button>
          <button style={s.btnDanger} onClick={handleLogout}>Salir</button>
        </div>
      </div>

      <div style={s.content}>
        <div style={s.statsGrid}>
          <div style={s.statCard}><div style={{ ...s.statNum, color: "#1a5fa8" }}>{clientes.length}</div><div style={s.statLabel}>Clientes</div></div>
          <div style={s.statCard}><div style={s.statNum}>{equipos.length}</div><div style={s.statLabel}>Equipos</div></div>
          <div style={s.statCard}><div style={{ ...s.statNum, color: "#2e7d32" }}>{equipos.filter(e => e.estado === "Operativo").length}</div><div style={s.statLabel}>Operativos</div></div>
          <div style={s.statCard}><div style={{ ...s.statNum, color: "#e65100" }}>{equipos.filter(e => e.estado === "Operativo con observaciones").length}</div><div style={s.statLabel}>Con obs.</div></div>
          <div style={s.statCard}><div style={{ ...s.statNum, color: "#c62828" }}>{equipos.filter(e => e.estado === "Fuera de servicio").length}</div><div style={s.statLabel}>Fuera serv.</div></div>
        </div>

        {equipos.length === 0 ? (
          <div style={s.empty}>
            <div style={{ fontSize: "40px", marginBottom: "12px" }}>📋</div>
            <div style={{ fontSize: "16px", color: "#555", marginBottom: "8px" }}>No tienes equipos registrados aún</div>
            <button style={s.btnPrimary} onClick={() => navigate("/registrar")}>+ Registrar primer equipo</button>
          </div>
        ) : (
          <div style={s.cardsGrid}>
            {Object.entries(agrupados).map(([cliente, equiposCliente]) => {
              const op = equiposCliente.filter(e => e.estado === "Operativo").length;
              const obs = equiposCliente.filter(e => e.estado === "Operativo con observaciones").length;
              const fs = equiposCliente.filter(e => e.estado === "Fuera de servicio").length;
              const total = equiposCliente.length;
              return (
                <div key={cliente} style={s.card}>
                  <div style={s.cardHeader}>
                    <div style={s.cardNombre}>{cliente}</div>
                    <div style={s.cardSub}>{total} equipo{total !== 1 ? "s" : ""}</div>
                  </div>
                  <div style={s.miniStats}>
                    <div style={{ ...s.miniStat, background: "#e8f5e9" }}>
                      <div style={{ ...s.miniNum, color: "#2e7d32" }}>{op}</div>
                      <div style={s.miniLabel}>Operativo</div>
                    </div>
                    <div style={{ ...s.miniStat, background: "#fff8e1" }}>
                      <div style={{ ...s.miniNum, color: "#e65100" }}>{obs}</div>
                      <div style={s.miniLabel}>Con obs.</div>
                    </div>
                    <div style={{ ...s.miniStat, background: "#ffebee" }}>
                      <div style={{ ...s.miniNum, color: "#c62828" }}>{fs}</div>
                      <div style={s.miniLabel}>Fuera serv.</div>
                    </div>
                  </div>
                  <button style={s.btnVerLista} onClick={() => navigate(`/admin/cliente/${encodeURIComponent(cliente)}`)}>
                    Ver lista de equipos
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const s = {
  page: { minHeight: "100vh", background: "#f0f4f8", fontFamily: "Inter, Arial, sans-serif" },
  navbar: { background: "white", borderBottom: "0.5px solid #e0e0e0", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10 },
  navLeft: { display: "flex", alignItems: "center", gap: "12px" },
  logo: { fontFamily: "'Arial Black', sans-serif", fontWeight: 900, fontSize: "20px", display: "flex", alignItems: "baseline" },
  navDivider: { width: "1px", height: "18px", background: "#e0e0e0" },
  navTitle: { fontSize: "13px", color: "#888" },
  navBtns: { display: "flex", gap: "8px" },
  btnDefault: { background: "white", color: "#333", border: "0.5px solid #ddd", borderRadius: "8px", padding: "7px 14px", cursor: "pointer", fontSize: "12px", fontWeight: 500 },
  btnDanger: { background: "#ffebee", color: "#c62828", border: "0.5px solid #ef9a9a", borderRadius: "8px", padding: "7px 14px", cursor: "pointer", fontSize: "12px", fontWeight: 500 },
  btnPrimary: { background: "#1a5fa8", color: "white", border: "none", borderRadius: "8px", padding: "10px 20px", cursor: "pointer", fontSize: "13px", fontWeight: 500 },
  content: { maxWidth: "1200px", margin: "0 auto", padding: "20px 24px" },
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "12px", marginBottom: "20px" },
  statCard: { background: "white", border: "0.5px solid #e0e0e0", borderRadius: "12px", padding: "14px", textAlign: "center" },
  statNum: { fontSize: "28px", fontWeight: 500, color: "#333" },
  statLabel: { fontSize: "10px", color: "#888", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: "2px" },
  cardsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" },
  card: { background: "white", border: "0.5px solid #e0e0e0", borderRadius: "12px", overflow: "hidden" },
  cardHeader: { padding: "14px 16px", borderBottom: "0.5px solid #f0f0f0" },
  cardNombre: { fontSize: "14px", fontWeight: 500, color: "#222" },
  cardSub: { fontSize: "11px", color: "#888", marginTop: "2px" },
  miniStats: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px", padding: "12px 16px" },
  miniStat: { textAlign: "center", padding: "8px", borderRadius: "8px" },
  miniNum: { fontSize: "20px", fontWeight: 500 },
  miniLabel: { fontSize: "10px", marginTop: "2px", color: "#666" },
  empty: { background: "white", border: "0.5px solid #e0e0e0", borderRadius: "12px", padding: "40px", textAlign: "center" },
  btnVerLista: { width: "100%", padding: "10px", border: "none", borderTop: "0.5px solid #f0f0f0", cursor: "pointer", fontSize: "13px", fontWeight: 500, background: "white", color: "#1a5fa8" },
};