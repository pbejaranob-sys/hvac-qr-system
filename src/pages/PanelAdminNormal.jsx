import React, { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs, query, where, doc, getDoc, deleteDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";

const FONT = "'Manrope', -apple-system, sans-serif";

function useManropeAndBodyReset() {
  useEffect(() => {
    if (!document.getElementById("font-manrope")) {
      const link = document.createElement("link");
      link.id = "font-manrope";
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap";
      document.head.appendChild(link);
    }
    const prevMargin = document.body.style.margin;
    const prevBg = document.body.style.background;
    document.body.style.margin = "0";
    document.body.style.background = "#eef1f6";
    return () => {
      document.body.style.margin = prevMargin;
      document.body.style.background = prevBg;
    };
  }, []);
}

const initiales = (nombre) => {
  const words = nombre.trim().split(" ");
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return nombre.substring(0, 2).toUpperCase();
};

const colorAvatar = (nombre) => {
  const colores = [
    { bg: "#e5f0ff", color: "#1a4fc0" },
    { bg: "#e6f7ec", color: "#1c7a44" },
    { bg: "#f1e9fb", color: "#7c3fb8" },
    { bg: "#fff3d6", color: "#a8720b" },
    { bg: "#fdeeee", color: "#a52b2b" },
    { bg: "#e0f4f2", color: "#0d7a6c" },
  ];
  let sum = 0;
  for (let i = 0; i < nombre.length; i++) sum += nombre.charCodeAt(i);
  return colores[sum % colores.length];
};

const SvgEditar = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const SvgEliminar = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const SvgFlechaDer = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ display: "inline", verticalAlign: "-2px" }}>
    <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function PanelAdminNormal() {
  useManropeAndBodyReset();

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
          <div style={s.logoBox}>
            <img src="/assets/hvac-isotipo-filled.png" alt="HVAC" style={s.logoImg} />
          </div>
          <div style={s.navDivider}></div>
          <span style={s.navTitle}>Panel Admin{nombreAdmin ? ` · ${nombreAdmin}` : ""}</span>
        </div>
        <div style={s.navBtns}>
          <button style={s.btnPrimary} onClick={() => navigate("/crear-cliente")}>+ Crear cliente</button>
          <button style={s.btnDanger} onClick={handleLogout}>Salir</button>
        </div>
      </div>

      <div style={s.content}>
        <div style={s.statsGrid}>
          <div style={s.statCard}><div style={{ ...s.statNum, color: "#1a4fc0" }}>{clientes.length}</div><div style={s.statLabel}>Clientes</div></div>
          <div style={s.statCard}><div style={{ ...s.statNum, color: "#12245e" }}>{equipos.length}</div><div style={s.statLabel}>Equipos</div></div>
          <div style={s.statCard}><div style={{ ...s.statNum, color: "#a8720b" }}>{equipos.filter(e => e.estado === "Operativo con observaciones").length}</div><div style={s.statLabel}>Con obs.</div></div>
          <div style={s.statCard}><div style={{ ...s.statNum, color: "#a52b2b" }}>{equipos.filter(e => e.estado === "Fuera de servicio").length}</div><div style={s.statLabel}>Fuera serv.</div></div>
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
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <button style={s.btnEditarCard} onClick={() => navigate(`/editar-cliente/${cliente.id}`)}><SvgEditar /></button>
                    <button style={s.btnEliminarCard} onClick={() => handleEliminarCliente(cliente.id, cliente.empresa)}><SvgEliminar /></button>
                  </div>
                </div>
                <div style={s.miniStats}>
                  <div style={{ ...s.miniStat, background: op > 0 ? "#e6f7ec" : "#f4f6fb" }}>
                    <div style={{ ...s.miniNum, color: op > 0 ? "#1c7a44" : "#9aa2b3" }}>{op}</div>
                    <div style={{ ...s.miniLabel, color: op > 0 ? "#1c7a44" : "#9aa2b3" }}>Operativo</div>
                  </div>
                  <div style={{ ...s.miniStat, background: obs > 0 ? "#fff3d6" : "#f4f6fb" }}>
                    <div style={{ ...s.miniNum, color: obs > 0 ? "#a8720b" : "#9aa2b3" }}>{obs}</div>
                    <div style={{ ...s.miniLabel, color: obs > 0 ? "#a8720b" : "#9aa2b3" }}>Con obs.</div>
                  </div>
                  <div style={{ ...s.miniStat, background: fs > 0 ? "#fdeeee" : "#f4f6fb" }}>
                    <div style={{ ...s.miniNum, color: fs > 0 ? "#a52b2b" : "#9aa2b3" }}>{fs}</div>
                    <div style={{ ...s.miniLabel, color: fs > 0 ? "#a52b2b" : "#9aa2b3" }}>Fuera serv.</div>
                  </div>
                </div>
                <div style={s.barraWrap}>
                  <div style={s.barra}>
                    {pOp > 0 && <div style={{ width: `${pOp}%`, background: "#1c9a53", height: "100%" }}></div>}
                    {pObs > 0 && <div style={{ width: `${pObs}%`, background: "#e8a020", height: "100%" }}></div>}
                    {pFs > 0 && <div style={{ width: `${pFs}%`, background: "#c23b3b", height: "100%" }}></div>}
                  </div>
                </div>
                <button style={s.btnVerLista} onClick={() => navigate(`/cliente/${encodeURIComponent(cliente.empresa)}`)}>
                  Ver sedes y equipos <SvgFlechaDer />
                </button>
              </div>
            );
          })}

          <div style={s.cardAgregar} onClick={() => navigate("/crear-cliente")}>
            <div style={s.plusCircle}>+</div>
            <div style={{ fontSize: "13.5px", fontWeight: 700 }}>Crear cliente</div>
          </div>
        </div>
      </div>
    </div>
  );
}

const s = {
  page: { minHeight: "100vh", width: "100%", background: "#eef1f6", fontFamily: FONT, boxSizing: "border-box" },
  navbar: { background: "white", borderBottom: "1px solid #e7ebf3", padding: "14px clamp(16px,4vw,32px)", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10, flexWrap: "wrap", gap: "12px" },
  navLeft: { display: "flex", alignItems: "center", gap: "12px" },
  logoBox: { width: "40px", height: "40px", minWidth: "40px", borderRadius: "10px", background: "#1a4fc0", display: "flex", alignItems: "center", justifyContent: "center" },
  logoImg: { width: "25px", height: "25px", objectFit: "contain", filter: "brightness(0) invert(1)" },
  navDivider: { width: "1px", height: "18px", background: "#e7ebf3" },
  navTitle: { fontSize: "14.5px", color: "#26314d", fontWeight: 700 },
  navBtns: { display: "flex", gap: "10px" },
  btnPrimary: { background: "#1a4fc0", color: "white", border: "none", borderRadius: "10px", padding: "9px 16px", cursor: "pointer", fontSize: "13px", fontWeight: 700, fontFamily: "inherit" },
  btnDanger: { background: "#fdeeee", color: "#a52b2b", border: "none", borderRadius: "10px", padding: "9px 16px", cursor: "pointer", fontSize: "13px", fontWeight: 700, fontFamily: "inherit" },
  content: { maxWidth: "1300px", margin: "0 auto", padding: "clamp(16px,4vw,32px)" },
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: "14px", marginBottom: "20px" },
  statCard: { background: "white", border: "1px solid #e7ebf3", borderRadius: "16px", padding: "20px", textAlign: "center" },
  statNum: { fontSize: "clamp(26px,3.5vw,32px)", fontWeight: 800 },
  statLabel: { fontSize: "11px", color: "#8a92a6", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: "4px", fontWeight: 700 },
  cardsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" },
  card: { background: "white", border: "1px solid #e7ebf3", borderRadius: "16px", overflow: "hidden" },
  cardAgregar: { background: "white", border: "1.5px dashed #c3d6fb", borderRadius: "16px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "180px", cursor: "pointer", color: "#1a4fc0", gap: "10px" },
  plusCircle: { width: "40px", height: "40px", borderRadius: "50%", background: "#e5f0ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", color: "#1a4fc0", fontWeight: 700 },
  cardHeader: { padding: "16px 18px", borderBottom: "1px solid #f2f4f8", display: "flex", alignItems: "flex-start", gap: "10px" },
  avatar: { width: "40px", height: "40px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 800, flexShrink: 0 },
  cardInfo: { flex: 1, minWidth: 0 },
  cardNombre: { fontSize: "14.5px", fontWeight: 800, color: "#12245e" },
  cardContacto: { fontSize: "12px", color: "#6b7488", marginTop: "2px", fontWeight: 600 },
  cardEmail: { fontSize: "11.5px", color: "#9aa2b3", marginTop: "1px", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  cardSub: { fontSize: "11.5px", color: "#c3cad9", marginTop: "4px", fontWeight: 700 },
  btnEditarCard: { fontSize: "13px", padding: "5px 9px", background: "#fff3d6", border: "none", borderRadius: "8px", cursor: "pointer" },
  btnEliminarCard: { fontSize: "13px", padding: "5px 9px", background: "#fdeeee", border: "none", borderRadius: "8px", cursor: "pointer" },
  miniStats: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px", padding: "14px 18px" },
  miniStat: { textAlign: "center", padding: "9px", borderRadius: "10px" },
  miniNum: { fontSize: "19px", fontWeight: 800 },
  miniLabel: { fontSize: "10px", marginTop: "2px", fontWeight: 700 },
  barraWrap: { padding: "0 18px 14px" },
  barra: { display: "flex", height: "7px", borderRadius: "4px", overflow: "hidden", background: "#eef1f6" },
  btnVerLista: { width: "100%", padding: "12px", border: "none", borderTop: "1px solid #f2f4f8", cursor: "pointer", fontSize: "13.5px", fontWeight: 700, background: "white", color: "#1a4fc0", fontFamily: "inherit" },
};
