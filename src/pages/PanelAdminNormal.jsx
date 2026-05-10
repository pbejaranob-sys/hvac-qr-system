import React, { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs, query, where, doc, getDoc, deleteDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";

const initiales = (nombre) => {
  const words = nombre.trim().split(" ");
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return nombre.substring(0, 2).toUpperCase();
};

const colorAvatar = (nombre) => {
  const colores = [
    { bg: "#e8f0fe", color: "#1a5fa8" },
    { bg: "#e8f5e9", color: "#2e7d32" },
    { bg: "#f3e5f5", color: "#6a1b9a" },
    { bg: "#fff8e1", color: "#e65100" },
    { bg: "#fce4ec", color: "#c62828" },
    { bg: "#e0f2f1", color: "#00695c" },
  ];
  let sum = 0;
  for (let i = 0; i < nombre.length; i++) sum += nombre.charCodeAt(i);
  return colores[sum % colores.length];
};

export default function PanelAdminNormal() {
  const [equipos, setEquipos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [nombreAdmin, setNombreAdmin] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        const docSnap = await getDoc(doc(db, "usuarios", user.uid));
        if (docSnap.exists()) setNombreAdmin(docSnap.data().nombre || "");
        cargarDatos(user.uid);
      }
    });
    return () => unsubscribe();
  }, []);

const cargarDatos = async (adminUid) => {
    const qClientes = query(collection(db, "clientes"), where("adminid", "==", adminUid));
    const snapClientes = await getDocs(qClientes);
    const listaClientes = snapClientes.docs.map(d => ({ id: d.id, ...d.data() }));
    setClientes(listaClientes);

    const nombresEmpresas = listaClientes.map(c => c.empresa).filter(Boolean);
    if (nombresEmpresas.length === 0) {
      setEquipos([]);
      return;
    }

    const q = query(collection(db, "equipos"), where("adminid", "==", adminUid));
    const snapshot = await getDocs(q);
    const todos = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    setEquipos(todos.filter(e => nombresEmpresas.includes(e.cliente)));
  };

  const handleEliminarCliente = async (clienteId, empresa) => {
    if (!window.confirm(`¿Eliminar al cliente "${empresa}"? Esta acción no se puede deshacer.`)) return;
    try {
      await deleteDoc(doc(db, "clientes", clienteId));
      setClientes(prev => prev.filter(c => c.id !== clienteId));
    } catch (err) {
      alert("Error al eliminar: " + err.message);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/");
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
          <div style={s.navDivider}></div>
          <span style={s.navTitle}>Panel Admin {nombreAdmin ? `· ${nombreAdmin}` : ""}</span>
        </div>
        <div style={s.navBtns}>
          <button style={s.btnPrimary} onClick={() => navigate("/crear-cliente")}>+ Crear cliente</button>
          <button style={s.btnDanger} onClick={handleLogout}>Salir</button>
        </div>
      </div>

      <div style={s.content}>
        <div style={s.statsGrid}>
          <div style={s.statCard}><div style={{ ...s.statNum, color: "#1a5fa8" }}>{clientes.length}</div><div style={s.statLabel}>Clientes</div></div>
          <div style={s.statCard}><div style={s.statNum}>{equipos.length}</div><div style={s.statLabel}>Equipos</div></div>
          <div style={s.statCard}><div style={{ ...s.statNum, color: "#e65100" }}>{equipos.filter(e => e.estado === "Operativo con observaciones").length}</div><div style={s.statLabel}>Con obs.</div></div>
          <div style={s.statCard}><div style={{ ...s.statNum, color: "#c62828" }}>{equipos.filter(e => e.estado === "Fuera de servicio").length}</div><div style={s.statLabel}>Fuera serv.</div></div>
        </div>

        <div style={s.cardsGrid}>
          {clientes.map(cliente => {
            const equiposCliente = equipos.filter(e => e.cliente === cliente.empresa);
            const op = equiposCliente.filter(e => e.estado === "Operativo").length;
            const obs = equiposCliente.filter(e => e.estado === "Operativo con observaciones").length;
            const fs = equiposCliente.filter(e => e.estado === "Fuera de servicio").length;
            const total = equiposCliente.length;
            const pOp = total ? Math.round((op / total) * 100) : 0;
            const pObs = total ? Math.round((obs / total) * 100) : 0;
            const pFs = total ? Math.round((fs / total) * 100) : 0;
            const av = colorAvatar(cliente.empresa || cliente.nombre);
            return (
              <div key={cliente.id} style={s.card}>
                <div style={s.cardHeader}>
                  <div style={{ ...s.avatar, background: av.bg, color: av.color }}>
                    {initiales(cliente.empresa || cliente.nombre)}
                  </div>
                  <div style={s.cardInfo}>
                    <div style={s.cardNombre}>{cliente.empresa}</div>
                    <div style={s.cardContacto}>{cliente.nombre}</div>
                    <div style={s.cardEmail}>{cliente.email}</div>
                    <div style={s.cardSub}>{total} equipo{total !== 1 ? "s" : ""}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <button style={s.btnEditarCard} onClick={() => navigate(`/editar-cliente/${cliente.id}`)}>✏️</button>
                    <button style={s.btnEliminarCard} onClick={() => handleEliminarCliente(cliente.id, cliente.empresa)}>🗑</button>
                  </div>
                </div>
                <div style={s.miniStats}>
                  <div style={{ ...s.miniStat, background: op > 0 ? "#e8f5e9" : "#f5f5f5" }}>
                    <div style={{ ...s.miniNum, color: op > 0 ? "#2e7d32" : "#aaa" }}>{op}</div>
                    <div style={{ ...s.miniLabel, color: op > 0 ? "#2e7d32" : "#aaa" }}>Operativo</div>
                  </div>
                  <div style={{ ...s.miniStat, background: obs > 0 ? "#fff8e1" : "#f5f5f5" }}>
                    <div style={{ ...s.miniNum, color: obs > 0 ? "#e65100" : "#aaa" }}>{obs}</div>
                    <div style={{ ...s.miniLabel, color: obs > 0 ? "#e65100" : "#aaa" }}>Con obs.</div>
                  </div>
                  <div style={{ ...s.miniStat, background: fs > 0 ? "#ffebee" : "#f5f5f5" }}>
                    <div style={{ ...s.miniNum, color: fs > 0 ? "#c62828" : "#aaa" }}>{fs}</div>
                    <div style={{ ...s.miniLabel, color: fs > 0 ? "#c62828" : "#aaa" }}>Fuera serv.</div>
                  </div>
                </div>
                <div style={s.barraWrap}>
                  <div style={s.barra}>
                    {pOp > 0 && <div style={{ width: `${pOp}%`, background: "#43a047", height: "100%" }}></div>}
                    {pObs > 0 && <div style={{ width: `${pObs}%`, background: "#ffa726", height: "100%" }}></div>}
                    {pFs > 0 && <div style={{ width: `${pFs}%`, background: "#ef5350", height: "100%" }}></div>}
                  </div>
                </div>
                <button style={s.btnVerLista} onClick={() => navigate(`/cliente/${encodeURIComponent(cliente.empresa)}`)}>
                  Ver sedes y equipos →
                </button>
              </div>
            );
          })}

          <div style={s.cardAgregar} onClick={() => navigate("/crear-cliente")}>
            <div style={{ fontSize: "28px", marginBottom: "8px" }}>+</div>
            <div style={{ fontSize: "13px" }}>Crear cliente</div>
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
  navDivider: { width: "1px", height: "18px", background: "#e0e0e0" },
  navTitle: { fontSize: "13px", color: "#888" },
  navBtns: { display: "flex", gap: "8px" },
  btnPrimary: { background: "#1a5fa8", color: "white", border: "none", borderRadius: "8px", padding: "7px 14px", cursor: "pointer", fontSize: "12px", fontWeight: 500 },
  btnDanger: { background: "#ffebee", color: "#c62828", border: "0.5px solid #ef9a9a", borderRadius: "8px", padding: "7px 14px", cursor: "pointer", fontSize: "12px", fontWeight: 500 },
  content: { maxWidth: "1200px", margin: "0 auto", padding: "20px 24px" },
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "20px" },
  statCard: { background: "white", border: "0.5px solid #e0e0e0", borderRadius: "12px", padding: "14px", textAlign: "center" },
  statNum: { fontSize: "28px", fontWeight: 500, color: "#333" },
  statLabel: { fontSize: "10px", color: "#888", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: "2px" },
  cardsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" },
  card: { background: "white", border: "0.5px solid #e0e0e0", borderRadius: "12px", overflow: "hidden" },
  cardAgregar: { background: "white", border: "1.5px dashed #c5d5e8", borderRadius: "12px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "160px", cursor: "pointer", color: "#aaa" },
  cardHeader: { padding: "14px 16px", borderBottom: "0.5px solid #f0f0f0", display: "flex", alignItems: "flex-start", gap: "10px" },
  avatar: { width: "38px", height: "38px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 500, flexShrink: 0 },
  cardInfo: { flex: 1 },
  cardNombre: { fontSize: "14px", fontWeight: 500, color: "#222" },
  cardContacto: { fontSize: "11px", color: "#555", marginTop: "2px" },
  cardEmail: { fontSize: "11px", color: "#888", marginTop: "1px" },
  cardSub: { fontSize: "11px", color: "#aaa", marginTop: "4px" },
  btnEditarCard: { fontSize: "13px", padding: "4px 8px", background: "#e8f0fe", color: "#1a5fa8", border: "0.5px solid #c5d5e8", borderRadius: "6px", cursor: "pointer" },
  btnEliminarCard: { fontSize: "13px", padding: "4px 8px", background: "#ffebee", color: "#c62828", border: "0.5px solid #ef9a9a", borderRadius: "6px", cursor: "pointer" },
  miniStats: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px", padding: "12px 16px" },
  miniStat: { textAlign: "center", padding: "8px", borderRadius: "8px" },
  miniNum: { fontSize: "20px", fontWeight: 500 },
  miniLabel: { fontSize: "10px", marginTop: "2px" },
  barraWrap: { padding: "0 16px 12px" },
  barra: { display: "flex", height: "6px", borderRadius: "3px", overflow: "hidden", background: "#f0f0f0" },
  btnVerLista: { width: "100%", padding: "10px", border: "none", borderTop: "0.5px solid #f0f0f0", cursor: "pointer", fontSize: "13px", fontWeight: 500, background: "white", color: "#1a5fa8" },
};