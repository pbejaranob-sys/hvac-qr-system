import React, { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs, query, where, deleteDoc, doc } from "firebase/firestore";
import { useNavigate, useParams } from "react-router-dom";

export default function VistaSede() {
  const { clienteNombre, sedeNombre } = useParams();
  const cliente = decodeURIComponent(clienteNombre);
  const sede = decodeURIComponent(sedeNombre);
  const [equipos, setEquipos] = useState([]);
  const [pisoFiltro, setPisoFiltro] = useState("Todos");
  const [estadoFiltro, setEstadoFiltro] = useState("Todos");
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) cargarEquipos(user.uid);
    });
    return () => unsubscribe();
  }, [clienteNombre, sedeNombre]);

  const cargarEquipos = async (uid) => {
    const q = query(collection(db, "equipos"),
      where("adminid", "==", uid),
      where("cliente", "==", cliente),
      where("sede", "==", sede)
    );
    const snap = await getDocs(q);
    setEquipos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const handleEliminar = async (equipoId) => {
    if (!window.confirm("¿Eliminar este equipo? Esta acción no se puede deshacer.")) return;
    await deleteDoc(doc(db, "equipos", equipoId));
    setEquipos(prev => prev.filter(e => e.id !== equipoId));
  };

  const total = equipos.length;
  const op = equipos.filter(e => e.estado === "Operativo").length;
  const obs = equipos.filter(e => e.estado === "Operativo con observaciones").length;
  const fs = equipos.filter(e => e.estado === "Fuera de servicio").length;
  const pOp = total ? Math.round((op / total) * 100) : 0;
  const pObs = total ? Math.round((obs / total) * 100) : 0;
  const pFs = total ? Math.round((fs / total) * 100) : 0;

  const pisos = ["Todos", ...new Set(equipos.map(e => e.piso).filter(Boolean))];

  const equiposFiltrados = equipos.filter(e => {
    const pasaPiso = pisoFiltro === "Todos" || e.piso === pisoFiltro;
    const pasaEstado = estadoFiltro === "Todos" ||
      (estadoFiltro === "Operativo" && e.estado === "Operativo") ||
      (estadoFiltro === "Con obs." && e.estado === "Operativo con observaciones") ||
      (estadoFiltro === "Fuera serv." && e.estado === "Fuera de servicio");
    return pasaPiso && pasaEstado;
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
          <div style={s.divider}></div>
          <button style={s.btnBack} onClick={() => navigate(`/cliente/${clienteNombre}`)}>← {cliente}</button>
          <div style={s.divider}></div>
          <span style={s.navTitle}>🏢 {sede}</span>
        </div>
        <div style={s.navBtns}>
          <button style={s.btnPrimary} onClick={() => navigate(`/registrar?cliente=${encodeURIComponent(cliente)}&sede=${encodeURIComponent(sede)}`)}>
            + Nuevo equipo
          </button>
        </div>
      </div>

      <div style={s.content}>
        {/* Stats */}
        <div style={s.statsGrid}>
          <div style={{ ...s.statCard, border: "1.5px solid #1a5fa8", cursor: "pointer", opacity: estadoFiltro === "Todos" ? 1 : 0.6 }}
            onClick={() => setEstadoFiltro("Todos")}>
            <div style={{ ...s.statNum, color: "#1a5fa8" }}>{total}</div>
            <div style={s.statLabel}>Total equipos</div>
          </div>
          <div style={{ ...s.statCard, background: estadoFiltro === "Operativo" ? "#b9f6ca" : "#e8f5e9", cursor: "pointer", border: estadoFiltro === "Operativo" ? "1.5px solid #2e7d32" : "0.5px solid #e0e0e0" }}
            onClick={() => setEstadoFiltro(estadoFiltro === "Operativo" ? "Todos" : "Operativo")}>
            <div style={{ ...s.statNum, color: "#2e7d32" }}>{op}</div>
            <div style={s.statLabel}>Operativos</div>
          </div>
          <div style={{ ...s.statCard, background: estadoFiltro === "Con obs." ? "#ffe57f" : "#fff8e1", cursor: "pointer", border: estadoFiltro === "Con obs." ? "1.5px solid #e65100" : "0.5px solid #e0e0e0" }}
            onClick={() => setEstadoFiltro(estadoFiltro === "Con obs." ? "Todos" : "Con obs.")}>
            <div style={{ ...s.statNum, color: "#e65100" }}>{obs}</div>
            <div style={s.statLabel}>Con obs.</div>
          </div>
          <div style={{ ...s.statCard, background: estadoFiltro === "Fuera serv." ? "#ff8a80" : "#ffebee", cursor: "pointer", border: estadoFiltro === "Fuera serv." ? "1.5px solid #c62828" : "0.5px solid #e0e0e0" }}
            onClick={() => setEstadoFiltro(estadoFiltro === "Fuera serv." ? "Todos" : "Fuera serv.")}>
            <div style={{ ...s.statNum, color: "#c62828" }}>{fs}</div>
            <div style={s.statLabel}>Fuera serv.</div>
          </div>
        </div>

        {/* Barras */}
        {total > 0 && (
          <div style={s.barrasCard}>
            <div style={s.barraRow}>
              <span style={s.barraLabel}>Operativo</span>
              <div style={s.barraTrack}><div style={{ width: `${pOp}%`, background: "#43a047", height: "100%", borderRadius: "4px" }}></div></div>
              <span style={{ ...s.barraNum, color: "#2e7d32" }}>{op} und</span>
            </div>
            <div style={s.barraRow}>
              <span style={s.barraLabel}>Con observaciones</span>
              <div style={s.barraTrack}><div style={{ width: `${pObs}%`, background: "#ffa726", height: "100%", borderRadius: "4px" }}></div></div>
              <span style={{ ...s.barraNum, color: "#e65100" }}>{obs} und</span>
            </div>
            <div style={{ ...s.barraRow, borderBottom: "none" }}>
              <span style={s.barraLabel}>Fuera de servicio</span>
              <div style={s.barraTrack}><div style={{ width: `${pFs}%`, background: "#ef5350", height: "100%", borderRadius: "4px" }}></div></div>
              <span style={{ ...s.barraNum, color: "#c62828" }}>{fs} und</span>
            </div>
          </div>
        )}

        {/* Tabla */}
        {total === 0 ? (
          <div style={s.empty}>
            <div style={{ fontSize: "36px", marginBottom: "10px" }}>📋</div>
            <div style={{ fontSize: "14px", color: "#555", marginBottom: "12px" }}>No hay equipos en esta sede</div>
            <button style={s.btnPrimary} onClick={() => navigate(`/registrar?cliente=${encodeURIComponent(cliente)}&sede=${encodeURIComponent(sede)}`)}>
              + Registrar primer equipo
            </button>
          </div>
        ) : (
          <div style={s.tablaWrap}>
            <div style={{ padding: "12px 16px", borderBottom: "0.5px solid #e0e0e0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", fontWeight: 500, color: "#222" }}>
                Lista de equipos <span style={{ fontSize: "11px", fontWeight: 400, background: "#e8f0fe", color: "#1a5fa8", padding: "2px 8px", borderRadius: "20px", marginLeft: "6px" }}>{equiposFiltrados.length} equipos</span>
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "12px", color: "#888" }}>Piso:</span>
                <select style={s.selectFiltro} value={pisoFiltro} onChange={e => setPisoFiltro(e.target.value)}>
                  {pisos.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div style={s.tablaHeader}>
              <span style={s.thCell}>#</span>
              <span style={s.thCell}>Código</span>
              <span style={s.thCell}>Piso</span>
              <span style={s.thCell}>Ambiente</span>
              <span style={s.thCell}>Tipo</span>
              <span style={s.thCell}>Marca/Modelo</span>
              <span style={s.thCell}>Estado</span>
              <span style={s.thCell}>Acciones</span>
            </div>
            {equiposFiltrados.map((eq, i) => (
              <div key={eq.id} style={{ ...s.tablaRow, background: i % 2 === 0 ? "white" : "#f8f9fa" }}>
                <span style={s.tdCell}>{i + 1}</span>
                <span style={s.tdCell}>
                  {eq.codigo ? <span style={s.codigo}>{eq.codigo}</span> : <span style={{ color: "#aaa" }}>-</span>}
                </span>
                <span style={s.tdCell}>{eq.piso || "-"}</span>
                <span style={s.tdCell}>{eq.ambiente || "-"}</span>
                <span style={s.tdCell}>{eq.tipoEquipo || "-"}</span>
                <span style={s.tdCell}>
                  <div style={{ fontWeight: 500, fontSize: "12px" }}>{eq.marca}</div>
                  <div style={{ fontSize: "10px", color: "#888" }}>{eq.modelo}</div>
                </span>
                <span style={s.tdCell}>
                  <span style={eq.estado === "Operativo" ? s.badgeOp : eq.estado === "Operativo con observaciones" ? s.badgeObs : s.badgeFs}>
                    {eq.estado === "Operativo" ? "Operativo" : eq.estado === "Operativo con observaciones" ? "Con obs." : "Fuera serv."}
                  </span>
                </span>
                <span style={s.tdCell}>
                  <div style={{ display: "flex", gap: "4px" }}>
                    <button style={s.btnInfo} onClick={() => navigate(`/equipo/${eq.id}`)}>Info</button>
                    <button style={s.btnEditar} onClick={() => navigate(`/registrar?id=${eq.id}`)}>Editar</button>
                    <button style={s.btnEliminar} onClick={() => handleEliminar(eq.id)}>🗑</button>
                  </div>
                </span>
              </div>
            ))}
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
  divider: { width: "1px", height: "18px", background: "#e0e0e0" },
  btnBack: { background: "none", border: "none", color: "#1a5fa8", cursor: "pointer", fontSize: "13px", fontWeight: 500, padding: 0 },
  navTitle: { fontSize: "13px", color: "#555", fontWeight: 500 },
  navBtns: { display: "flex", gap: "8px" },
  btnPrimary: { background: "#1a5fa8", color: "white", border: "none", borderRadius: "8px", padding: "7px 14px", cursor: "pointer", fontSize: "12px", fontWeight: 500 },
  content: { maxWidth: "1200px", margin: "0 auto", padding: "20px 24px" },
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "16px" },
  statCard: { background: "white", border: "0.5px solid #e0e0e0", borderRadius: "12px", padding: "14px", textAlign: "center", transition: "all 0.15s" },
  statNum: { fontSize: "28px", fontWeight: 500 },
  statLabel: { fontSize: "10px", color: "#888", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: "2px" },
  barrasCard: { background: "white", border: "0.5px solid #e0e0e0", borderRadius: "12px", padding: "14px 16px", marginBottom: "16px" },
  barraRow: { display: "flex", alignItems: "center", gap: "12px", padding: "6px 0", borderBottom: "0.5px solid #f0f0f0" },
  barraLabel: { fontSize: "12px", color: "#555", width: "140px", flexShrink: 0 },
  barraTrack: { flex: 1, height: "8px", background: "#f0f0f0", borderRadius: "4px", overflow: "hidden" },
  barraNum: { fontSize: "12px", fontWeight: 500, width: "50px", textAlign: "right" },
  tablaWrap: { background: "white", border: "0.5px solid #e0e0e0", borderRadius: "12px", overflow: "hidden" },
  tablaHeader: { display: "grid", gridTemplateColumns: "40px 80px 70px 100px 110px 130px 100px 1fr", gap: "8px", padding: "10px 16px", background: "#f8f9fa", borderBottom: "0.5px solid #e0e0e0" },
  tablaRow: { display: "grid", gridTemplateColumns: "40px 80px 70px 100px 110px 130px 100px 1fr", gap: "8px", padding: "10px 16px", borderBottom: "0.5px solid #f0f0f0", alignItems: "center" },
  thCell: { fontSize: "10px", color: "#888", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500 },
  tdCell: { fontSize: "12px", color: "#333" },
  codigo: { fontSize: "11px", padding: "2px 6px", borderRadius: "4px", background: "#f3e5f5", color: "#6a1b9a", fontFamily: "monospace", fontWeight: 700 },
  badgeOp: { fontSize: "11px", padding: "3px 8px", borderRadius: "20px", background: "#e8f5e9", color: "#2e7d32" },
  badgeObs: { fontSize: "11px", padding: "3px 8px", borderRadius: "20px", background: "#fff8e1", color: "#e65100" },
  badgeFs: { fontSize: "11px", padding: "3px 8px", borderRadius: "20px", background: "#ffebee", color: "#c62828" },
  btnInfo: { fontSize: "11px", padding: "3px 8px", background: "#1a5fa8", color: "white", border: "none", borderRadius: "6px", cursor: "pointer" },
  btnEditar: { fontSize: "11px", padding: "3px 8px", background: "#e65100", color: "white", border: "none", borderRadius: "6px", cursor: "pointer" },
  btnEliminar: { fontSize: "11px", padding: "3px 8px", background: "#ffebee", color: "#c62828", border: "0.5px solid #ef9a9a", borderRadius: "6px", cursor: "pointer" },
  selectFiltro: { fontSize: "12px", padding: "4px 8px", border: "0.5px solid #ddd", borderRadius: "6px", background: "white", color: "#333" },
  empty: { background: "white", border: "0.5px solid #e0e0e0", borderRadius: "12px", padding: "40px", textAlign: "center" },
};