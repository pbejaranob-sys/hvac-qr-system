import React, { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs, query, where, deleteDoc, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { useNavigate, useParams } from "react-router-dom";

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

const parsePiso = (p) => {
  if (!p) return [99, 0];
  const s = String(p).toLowerCase().trim();
  const sotanoMatch = s.match(/s[oó]tano\s*(\d*)/);
  if (sotanoMatch) return [-1, -(parseInt(sotanoMatch[1]) || 1)];
  const num = parseFloat(s);
  if (!isNaN(num)) return [0, num];
  return [1, 0];
};

const sortPiso = (a, b) => {
  const [ta, na] = parsePiso(a.piso);
  const [tb, nb] = parsePiso(b.piso);
  return ta !== tb ? ta - tb : na - nb;
};

const SvgFlecha = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ display: "inline", verticalAlign: "-2px" }}>
    <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const SvgEliminar = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const SvgAlerta = ({ color = "currentColor" }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M12 3l9 16H3l9-16z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 10v4M12 17h.01" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);
const SvgChevron = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M9 6l6 6-6 6" stroke="#c3cad9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function VistaSede() {
  useManropeAndBodyReset();

  const { clienteNombre, sedeNombre } = useParams();
  const cliente = decodeURIComponent(clienteNombre);
  const sede = decodeURIComponent(sedeNombre);
  const [equipos, setEquipos] = useState([]);
  const [pisoFiltro, setPisoFiltro] = useState("Todos");
  const [estadoFiltro, setEstadoFiltro] = useState("Todos");
  const [mesFiltro, setMesFiltro] = useState("Todos");

  const [averias, setAverias] = useState([]);
  const [detalleAveria, setDetalleAveria] = useState(null);
  const [listaEmergencia, setListaEmergencia] = useState(null);
  const [historialAverias, setHistorialAverias] = useState(null);
  const [historialAbierto, setHistorialAbierto] = useState(false);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);

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

    try {
      const qA = query(collection(db, "averias"),
        where("cliente", "==", cliente),
        where("sede", "==", sede),
        where("atendida", "==", false)
      );
      const snapA = await getDocs(qA);
      setAverias(snapA.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch {
      setAverias([]);
    }
  };

  const handleEliminar = async (equipoId) => {
    if (!window.confirm("¿Eliminar este equipo? Esta acción no se puede deshacer.")) return;
    await deleteDoc(doc(db, "equipos", equipoId));
    setEquipos(prev => prev.filter(e => e.id !== equipoId));
  };

  // ---- Averías / emergencias ----
  const abrirDetalleAveria = (averia) => {
    setDetalleAveria(averia);
    setListaEmergencia(null);
    setHistorialAbierto(false);
  };
  const cerrarDetalleAveria = () => setDetalleAveria(null);

  const abrirEmergencias = () => {
    if (averias.length === 0) return;
    if (averias.length === 1) abrirDetalleAveria(averias[0]);
    else setListaEmergencia(averias);
  };

  const marcarAveriaAtendida = async (averiaId) => {
    try {
      await updateDoc(doc(db, "averias", averiaId), { atendida: true, atendidaEn: serverTimestamp() });
      const averiaAtendida = averias.find(a => a.id === averiaId);
      setAverias(prev => prev.filter(a => a.id !== averiaId));
      if (averiaAtendida && historialAverias !== null) {
        setHistorialAverias(prev => [{ ...averiaAtendida, atendida: true, atendidaEn: { toDate: () => new Date() } }, ...prev]);
      }
      cerrarDetalleAveria();
    } catch (e) {
      console.error("Error marcando avería como atendida:", e);
    }
  };

  const abrirHistorial = async () => {
    setHistorialAbierto(true);
    setListaEmergencia(null);
    if (historialAverias !== null) return;
    setCargandoHistorial(true);
    try {
      const hSnap = await getDocs(query(collection(db, "averias"),
        where("cliente", "==", cliente),
        where("sede", "==", sede),
        where("atendida", "==", true)
      ));
      setHistorialAverias(hSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error("Error cargando historial:", e);
      setHistorialAverias([]);
    }
    setCargandoHistorial(false);
  };

  const getObsCount = (e) => {
    const arr = e.observacionesArray || [];
    const norm = arr.map(o => typeof o === "string" ? { texto: o } : o);
    return norm.filter(o => o?.texto?.trim()).length;
  };

  const total = equipos.length;
  const op = equipos.filter(e => e.estado === "Operativo").length;
  const obs = equipos.filter(e => e.estado === "Operativo con observaciones").length;
  const fs = equipos.filter(e => e.estado === "Fuera de servicio").length;
  const pOp = total ? Math.round((op / total) * 100) : 0;
  const pObs = total ? Math.round((obs / total) * 100) : 0;
  const pFs = total ? Math.round((fs / total) * 100) : 0;

  const fechaAMesAnio = (fecha) => {
    if (!fecha) return null;
    const d = new Date(fecha.includes("/") ? fecha.split("/").reverse().join("-") : fecha);
    if (isNaN(d)) return null;
    return d.toLocaleDateString("es-PE", { month: "short", year: "numeric" });
  };
  const fechaATimestamp = (fecha) => {
    if (!fecha) return 0;
    const d = new Date(fecha.includes("/") ? fecha.split("/").reverse().join("-") : fecha);
    return isNaN(d) ? 0 : d.getTime();
  };
  const fechaColor = (fecha) => {
    if (!fecha) return { bg: "#f4f6fb", color: "#8a92a6", border: "#e7ebf3" };
    const meses = (Date.now() - fechaATimestamp(fecha)) / (1000 * 60 * 60 * 24 * 30);
    if (meses <= 3) return { bg: "#e6f7ec", color: "#1c7a44", border: "#c3ecd2" };
    if (meses <= 6) return { bg: "#e5f0ff", color: "#1a4fc0", border: "#c3d6fb" };
    return { bg: "#fdeeee", color: "#a52b2b", border: "#f6d3d3" };
  };

  const mesesDisponibles = ["Todos", ...new Set(
    equipos.map(e => fechaAMesAnio(e.ultimoMantenimiento)).filter(Boolean)
  )];

  const pisos = ["Todos", ...[...new Set(equipos.map(e => e.piso).filter(Boolean))].sort((a, b) => {
    const [ta, na] = parsePiso({ piso: a });
    const [tb, nb] = parsePiso({ piso: b });
    return ta !== tb ? ta - tb : na - nb;
  })];

  const equiposFiltrados = equipos
    .filter(e => {
      const pasaPiso = pisoFiltro === "Todos" || e.piso === pisoFiltro;
      const pasaEstado = estadoFiltro === "Todos" ||
        (estadoFiltro === "Operativo" && e.estado === "Operativo") ||
        (estadoFiltro === "Con obs." && e.estado === "Operativo con observaciones") ||
        (estadoFiltro === "Fuera serv." && e.estado === "Fuera de servicio");
      const pasaMes = mesFiltro === "Todos" ||
        (mesFiltro === "Sin fecha" && !e.ultimoMantenimiento) ||
        fechaAMesAnio(e.ultimoMantenimiento) === mesFiltro;
      return pasaPiso && pasaEstado && pasaMes;
    })
    .sort((a, b) => {
      const fa = fechaATimestamp(a.ultimoMantenimiento);
      const fb = fechaATimestamp(b.ultimoMantenimiento);
      if (fb !== fa) return fb - fa;
      return sortPiso(a, b);
    });

  return (
    <div style={s.page}>
      <div style={s.navbar}>
        <div style={s.navLeft}>
          <div style={s.logoBox}><img src="/assets/hvac-isotipo-filled.png" alt="HVAC" style={s.logoImg} /></div>
          <div style={s.divider}></div>
          <button style={s.btnBack} onClick={() => navigate(`/cliente/${clienteNombre}`)}><SvgFlecha /> {cliente}</button>
          <div style={s.divider}></div>
          <span style={s.navTitle}>{sede}</span>
        </div>
        <div style={s.navBtns}>
          <button style={s.btnPrimary} onClick={() => navigate(`/registrar?cliente=${encodeURIComponent(cliente)}&sede=${encodeURIComponent(sede)}`)}>
            + Nuevo equipo
          </button>
        </div>
      </div>

      <div style={s.content}>
        <div style={s.statsGrid}>
          <div style={{ ...s.statCard, border: `1.5px solid ${estadoFiltro === "Todos" ? "#1a4fc0" : "#e7ebf3"}`, cursor: "pointer" }}
            onClick={() => setEstadoFiltro("Todos")}>
            <div style={{ ...s.statNum, color: "#1a4fc0" }}>{total}</div>
            <div style={s.statLabel}>Total equipos</div>
          </div>
          <div style={{ ...s.statCard, background: "#e6f7ec", cursor: "pointer", border: `1.5px solid ${estadoFiltro === "Operativo" ? "#1c7a44" : "#c3ecd2"}` }}
            onClick={() => setEstadoFiltro(estadoFiltro === "Operativo" ? "Todos" : "Operativo")}>
            <div style={{ ...s.statNum, color: "#1c7a44" }}>{op}</div>
            <div style={s.statLabel}>Operativos</div>
          </div>
          <div style={{ ...s.statCard, background: "#fff3d6", cursor: "pointer", border: `1.5px solid ${estadoFiltro === "Con obs." ? "#a8720b" : "#f3dfa3"}` }}
            onClick={() => setEstadoFiltro(estadoFiltro === "Con obs." ? "Todos" : "Con obs.")}>
            <div style={{ ...s.statNum, color: "#a8720b" }}>{obs}</div>
            <div style={s.statLabel}>Con obs.</div>
          </div>
          <div style={{ ...s.statCard, background: "#fdeeee", cursor: "pointer", border: `1.5px solid ${estadoFiltro === "Fuera serv." ? "#a52b2b" : "#f6d3d3"}` }}
            onClick={() => setEstadoFiltro(estadoFiltro === "Fuera serv." ? "Todos" : "Fuera serv.")}>
            <div style={{ ...s.statNum, color: "#a52b2b" }}>{fs}</div>
            <div style={s.statLabel}>Fuera serv.</div>
          </div>
          <div style={{ background: averias.length > 0 ? "#fdeeee" : "#f4f6fb", border: `1.5px solid ${averias.length > 0 ? "#f6d3d3" : "#e7ebf3"}`, borderRadius: "16px", padding: "20px", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", textAlign: "center" }}>
            <div style={{ cursor: averias.length > 0 ? "pointer" : "default" }} onClick={abrirEmergencias}>
              <div style={{ ...s.statNum, color: averias.length > 0 ? "#a52b2b" : "#9aa2b3" }}>{averias.length}</div>
              <div style={s.statLabel}>Emergencia</div>
            </div>
            <a href="#" onClick={(e) => { e.preventDefault(); abrirHistorial(); }} style={{ fontSize: "11.5px", fontWeight: 700, color: "#1a4fc0", textDecoration: "underline", marginTop: "2px" }}>Historial</a>
          </div>
        </div>

        {total > 0 && (
          <div style={s.barrasCard}>
            <div style={s.barraRow}>
              <span style={s.barraLabel}>Operativo</span>
              <div style={s.barraTrack}><div style={{ width: `${pOp}%`, background: "#1c9a53", height: "100%", borderRadius: "4px" }}></div></div>
              <span style={{ ...s.barraNum, color: "#1c7a44" }}>{op} und</span>
            </div>
            <div style={s.barraRow}>
              <span style={s.barraLabel}>Con observaciones</span>
              <div style={s.barraTrack}><div style={{ width: `${pObs}%`, background: "#e8a020", height: "100%", borderRadius: "4px" }}></div></div>
              <span style={{ ...s.barraNum, color: "#a8720b" }}>{obs} und</span>
            </div>
            <div style={{ ...s.barraRow, borderBottom: "none" }}>
              <span style={s.barraLabel}>Fuera de servicio</span>
              <div style={s.barraTrack}><div style={{ width: `${pFs}%`, background: "#c23b3b", height: "100%", borderRadius: "4px" }}></div></div>
              <span style={{ ...s.barraNum, color: "#a52b2b" }}>{fs} und</span>
            </div>
          </div>
        )}

        {total === 0 ? (
          <div style={s.empty}>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "#c3cad9", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Sin equipos</div>
            <div style={{ fontSize: "14px", color: "#6b7488", marginBottom: "14px", fontWeight: 600 }}>No hay equipos en esta sede</div>
            <button style={s.btnPrimary} onClick={() => navigate(`/registrar?cliente=${encodeURIComponent(cliente)}&sede=${encodeURIComponent(sede)}`)}>
              + Registrar primer equipo
            </button>
          </div>
        ) : (
          <div style={s.tablaWrap}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid #f2f4f8", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
              <span style={{ fontSize: "14.5px", fontWeight: 800, color: "#12245e" }}>
                Lista de equipos <span style={{ fontSize: "11.5px", fontWeight: 700, background: "#e5f0ff", color: "#1a4fc0", padding: "3px 10px", borderRadius: "20px", marginLeft: "8px" }}>{equiposFiltrados.length} equipos</span>
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <span style={s.filterLabel}>Piso:</span>
                <select style={s.selectFiltro} value={pisoFiltro} onChange={e => setPisoFiltro(e.target.value)}>
                  {pisos.map(p => <option key={p}>{p}</option>)}
                </select>
                <span style={s.filterLabel}>Mant.:</span>
                <select style={s.selectFiltro} value={mesFiltro} onChange={e => setMesFiltro(e.target.value)}>
                  {mesesDisponibles.map(m => <option key={m}>{m}</option>)}
                  <option value="Sin fecha">Sin fecha</option>
                </select>
                {mesFiltro !== "Todos" && (
                  <button onClick={() => setMesFiltro("Todos")} style={{ fontSize: "10.5px", padding: "4px 9px", borderRadius: "20px", background: "#1a4fc0", color: "white", border: "none", cursor: "pointer", fontWeight: 700 }}>
                    {mesFiltro} X
                  </button>
                )}
              </div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <div style={{ minWidth: "900px" }}>
                <div style={s.tablaHeader}>
                  {["#", "Código", "Piso", "Ambiente", "Tipo", "Marca/Modelo", "Estado", "Últ. mant.", "Acciones"].map(h => (
                    <span key={h} style={s.thCell}>{h}</span>
                  ))}
                </div>
                {equiposFiltrados.map((eq, i) => {
                  const fc = fechaColor(eq.ultimoMantenimiento);
                  const mesAnio = fechaAMesAnio(eq.ultimoMantenimiento);
                  return (
                    <div key={eq.id} style={{ ...s.tablaRow, background: i % 2 === 0 ? "white" : "#fafbfd" }}>
                      <span style={s.tdCell}>{i + 1}</span>
                      <span style={s.tdCell}>{eq.codigo ? <span style={s.codigo}>{eq.codigo}</span> : <span style={{ color: "#c3cad9" }}>-</span>}</span>
                      <span style={s.tdCell}>{eq.piso || "-"}</span>
                      <span style={{ ...s.tdCell, fontWeight: 700, color: "#0f1b3d" }}>{eq.ambiente || "-"}</span>
                      <span style={s.tdCell}>{eq.tipoEquipo || "-"}</span>
                      <span style={s.tdCell}>
                        <div style={{ fontWeight: 700, fontSize: "12px", color: "#0f1b3d" }}>{eq.marca}</div>
                        <div style={{ fontSize: "10.5px", color: "#9aa2b3" }}>{eq.modelo}</div>
                      </span>
                      <span style={s.tdCell}>
                        <span style={eq.estado === "Operativo" ? s.badgeOp : eq.estado === "Operativo con observaciones" ? s.badgeObs : s.badgeFs}>
                          {eq.estado === "Operativo" ? "Operativo" : eq.estado === "Operativo con observaciones" ? "Con obs." : "Fuera serv."}
                        </span>
                      </span>
                      <span style={s.tdCell}>
                        {mesAnio
                          ? <span style={{ fontSize: "11px", padding: "3px 9px", borderRadius: "20px", background: fc.bg, color: fc.color, border: `1px solid ${fc.border}`, whiteSpace: "nowrap", fontWeight: 700 }}>{mesAnio}</span>
                          : <span style={{ fontSize: "11px", color: "#c3cad9" }}>—</span>}
                      </span>
                      <span style={s.tdCell}>
                        <div style={{ display: "flex", gap: "5px" }}>
                          <button style={s.btnInfo} onClick={() => navigate(`/equipo/${eq.id}`)}>Info</button>
                          <button style={s.btnEditar} onClick={() => navigate(`/registrar?id=${eq.id}`)}>Editar</button>
                          <button style={s.btnProto} onClick={() => navigate(`/protocolo?equipo=${eq.id}`)}>Protocolo</button>
                          <button style={s.btnEliminar} onClick={() => handleEliminar(eq.id)}><SvgEliminar /></button>
                        </div>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal lista de emergencias activas */}
      {listaEmergencia && (
        <div style={s.modalOverlay} onClick={() => setListaEmergencia(null)}>
          <div style={s.listaCard} onClick={e => e.stopPropagation()}>
            <div style={s.listaHeader}>
              <SvgAlerta color="#a52b2b" />
              <span style={s.listaTitulo}>Equipos con emergencia</span>
              <span style={s.listaBadgeCount}>{listaEmergencia.length}</span>
              <button style={s.btnCerrarX} onClick={() => setListaEmergencia(null)}>X</button>
            </div>
            <div style={s.listaBody}>
              {listaEmergencia.map(a => {
                const eq = equipos.find(e => e.id === a.equipoId);
                return (
                  <div key={a.id} onClick={() => abrirDetalleAveria(a)} style={s.listaItem}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={s.listaItemNombre}>{eq?.tipoEquipo || "Equipo"} — {a.ambiente || eq?.ambiente || "-"}</div>
                      <div style={s.listaItemMeta}>{a.piso ? `Piso ${a.piso}` : ""}{eq?.serie ? ` · Serie ${eq.serie}` : ""}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                      <span style={s.listaItemFecha}>{a.fecha?.toDate ? a.fecha.toDate().toLocaleDateString("es-PE") + ", " + a.fecha.toDate().toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }) : ""}</span>
                      <SvgChevron />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal historial */}
      {historialAbierto && (
        <div style={s.modalOverlay} onClick={() => setHistorialAbierto(false)}>
          <div style={s.listaCard} onClick={e => e.stopPropagation()}>
            <div style={s.listaHeader}>
              <span style={s.listaTitulo}>Historial de averías — {sede}</span>
              <button style={s.btnCerrarX} onClick={() => setHistorialAbierto(false)}>X</button>
            </div>
            <div style={s.listaBody}>
              {cargandoHistorial ? (
                <div style={{ fontSize: "12.5px", color: "#8a92a6", textAlign: "center", padding: "20px 0" }}>Cargando historial...</div>
              ) : !historialAverias || historialAverias.length === 0 ? (
                <div style={{ fontSize: "12.5px", color: "#aab1c2", fontStyle: "italic", textAlign: "center", padding: "20px 0" }}>Sin averías atendidas registradas</div>
              ) : historialAverias
                  .slice()
                  .sort((a, b) => (b.atendidaEn?.toDate ? b.atendidaEn.toDate().getTime() : 0) - (a.atendidaEn?.toDate ? a.atendidaEn.toDate().getTime() : 0))
                  .map(a => {
                    const eq = equipos.find(e => e.id === a.equipoId);
                    return (
                      <div key={a.id} onClick={() => abrirDetalleAveria(a)} style={s.listaItem}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={s.listaItemNombre}>{eq?.tipoEquipo || "Equipo"} — {a.ambiente || eq?.ambiente || "-"}</div>
                          <div style={s.listaItemMeta}>{a.piso ? `Piso ${a.piso}` : ""}</div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                          <span style={s.atendidaChip}>Atendida</span>
                          <SvgChevron />
                        </div>
                      </div>
                    );
                  })}
            </div>
          </div>
        </div>
      )}

      {/* Modal detalle de avería */}
      {detalleAveria && (() => {
        const eq = equipos.find(e => e.id === detalleAveria.equipoId);
        const atendida = !!detalleAveria.atendida;
        return (
          <div style={s.modalOverlay} onClick={cerrarDetalleAveria}>
            <div style={{ ...s.averiaCard, border: `1px solid ${atendida ? "#c3ecd2" : "#f6d3d3"}` }} onClick={e => e.stopPropagation()}>
              <div style={s.averiaHeaderRow}>
                <div>
                  <div style={s.averiaTitulo}>{eq?.tipoEquipo || "Equipo"} — {(detalleAveria.ambiente || eq?.ambiente || "").toString().toLowerCase()}</div>
                  <div style={s.averiaSub}>Piso {detalleAveria.piso || eq?.piso || "-"} · {eq?.marca || "-"} · {eq?.modelo || detalleAveria.equipoCodigo || "-"}</div>
                </div>
                <span style={atendida ? s.badgeAtendida : s.badgeEmergencia}>{atendida ? "Atendida" : "Con emergencia"}</span>
              </div>
              <div style={s.averiaTabla}>
                <div style={s.averiaFila}><span style={s.averiaLabel}>N° de serie</span><span style={s.averiaValor}>{eq?.serie || "-"}</span></div>
                <div style={s.averiaFila}><span style={s.averiaLabel}>Estado</span><span style={s.averiaValor}>{eq?.estado || "-"}</span></div>
                <div style={s.averiaFila}><span style={s.averiaLabel}>Últ. mantenimiento</span><span style={s.averiaValor}>{eq?.ultimoMantenimiento || "Sin registro"}</span></div>
                <div style={s.averiaFila}><span style={s.averiaLabel}>Observaciones abiertas</span><span style={s.averiaValor}>{eq ? getObsCount(eq) : 0}</span></div>
              </div>
              <div style={s.averiaDivider}></div>
              <div style={{ ...s.averiaMsgLabel, color: atendida ? "#1c7a44" : "#a52b2b" }}>{atendida ? "Avería atendida" : "Mensaje de emergencia"}</div>
              <div style={{ ...s.averiaMsgBox, background: atendida ? "#e6f7ec" : "#fdeeee", border: `1px solid ${atendida ? "#c3ecd2" : "#f6d3d3"}` }}>
                <div style={s.averiaMsgTxt}>{detalleAveria.mensaje}</div>
                <div style={{ fontSize: "11px", color: "#8a92a6" }}>{detalleAveria.fecha?.toDate ? detalleAveria.fecha.toDate().toLocaleString("es-PE") : ""}</div>
              </div>
              {atendida ? (
                <div style={s.averiaAtendidaTxt}>Atendida: {detalleAveria.atendidaEn?.toDate ? detalleAveria.atendidaEn.toDate().toLocaleString("es-PE") : "-"}</div>
              ) : (
                <>
                  <div style={{ display: "flex", gap: "8px", marginTop: "14px" }}>
                    {eq && <button style={s.btnVerProtocolo} onClick={() => navigate(`/protocolo?equipo=${eq.id}`)}>Ver protocolo</button>}
                    <button style={s.btnMarcarAtendida} onClick={() => marcarAveriaAtendida(detalleAveria.id)}>Marcar como atendida</button>
                  </div>
                  <div style={s.averiaCaption}>No se elimina: pasa a historial de averías atendidas y deja de contar en el badge de emergencia.</div>
                </>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

const s = {
  page: { minHeight: "100vh", width: "100%", background: "#eef1f6", fontFamily: FONT, boxSizing: "border-box" },
  navbar: { background: "white", borderBottom: "1px solid #e7ebf3", padding: "14px clamp(16px,4vw,32px)", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10, flexWrap: "wrap", gap: "12px" },
  navLeft: { display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" },
  logoBox: { width: "40px", height: "40px", minWidth: "40px", borderRadius: "10px", background: "#1a4fc0", display: "flex", alignItems: "center", justifyContent: "center" },
  logoImg: { width: "25px", height: "25px", objectFit: "contain", filter: "brightness(0) invert(1)" },
  divider: { width: "1px", height: "18px", background: "#e7ebf3" },
  btnBack: { background: "none", border: "none", color: "#1a4fc0", cursor: "pointer", fontSize: "13.5px", fontWeight: 700, padding: 0, fontFamily: "inherit" },
  navTitle: { fontSize: "14.5px", color: "#26314d", fontWeight: 700 },
  navBtns: { display: "flex", gap: "8px" },
  btnPrimary: { background: "#1a4fc0", color: "white", border: "none", borderRadius: "10px", padding: "9px 16px", cursor: "pointer", fontSize: "13px", fontWeight: 700, fontFamily: "inherit" },
  content: { maxWidth: "1300px", margin: "0 auto", padding: "clamp(16px,4vw,32px)" },
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: "14px", marginBottom: "20px" },
  statCard: { background: "white", border: "1px solid #e7ebf3", borderRadius: "16px", padding: "20px", textAlign: "center" },
  statNum: { fontSize: "clamp(26px,3.5vw,32px)", fontWeight: 800 },
  statLabel: { fontSize: "11px", color: "#8a92a6", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: "4px", fontWeight: 700 },
  barrasCard: { background: "white", border: "1px solid #e7ebf3", borderRadius: "16px", padding: "18px 20px", marginBottom: "20px" },
  barraRow: { display: "flex", alignItems: "center", gap: "14px", padding: "8px 0", borderBottom: "1px solid #f2f4f8" },
  barraLabel: { fontSize: "13px", color: "#26314d", width: "150px", flexShrink: 0, fontWeight: 700 },
  barraTrack: { flex: 1, height: "8px", background: "#eef1f6", borderRadius: "4px", overflow: "hidden" },
  barraNum: { fontSize: "13px", fontWeight: 700, width: "60px", textAlign: "right" },
  tablaWrap: { background: "white", border: "1px solid #e7ebf3", borderRadius: "16px", overflow: "hidden" },
  tablaHeader: { display: "grid", gridTemplateColumns: "36px 80px 60px 120px 90px 130px 90px 90px 220px", gap: "8px", padding: "12px 18px", background: "#fafbfd", borderBottom: "1px solid #eef1f6" },
  tablaRow: { display: "grid", gridTemplateColumns: "36px 80px 60px 120px 90px 130px 90px 90px 220px", gap: "8px", padding: "12px 18px", borderBottom: "1px solid #f2f4f8", alignItems: "center" },
  thCell: { fontSize: "10.5px", color: "#8a92a6", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700, whiteSpace: "nowrap" },
  tdCell: { fontSize: "12.5px", color: "#26314d" },
  codigo: { fontSize: "11px", padding: "3px 8px", borderRadius: "7px", background: "#e5f0ff", color: "#1a4fc0", fontFamily: "monospace", fontWeight: 700 },
  badgeOp: { fontSize: "11px", padding: "4px 10px", borderRadius: "20px", background: "#e6f7ec", color: "#1c7a44", fontWeight: 700, whiteSpace: "nowrap" },
  badgeObs: { fontSize: "11px", padding: "4px 10px", borderRadius: "20px", background: "#fff3d6", color: "#a8720b", fontWeight: 700, whiteSpace: "nowrap" },
  badgeFs: { fontSize: "11px", padding: "4px 10px", borderRadius: "20px", background: "#fdeeee", color: "#a52b2b", fontWeight: 700, whiteSpace: "nowrap" },
  btnInfo: { fontSize: "10.5px", padding: "5px 9px", background: "#1a4fc0", color: "white", border: "none", borderRadius: "7px", cursor: "pointer", fontWeight: 700, fontFamily: "inherit" },
  btnEditar: { fontSize: "10.5px", padding: "5px 9px", background: "#a8720b", color: "white", border: "none", borderRadius: "7px", cursor: "pointer", fontWeight: 700, fontFamily: "inherit" },
  btnProto: { fontSize: "10.5px", padding: "5px 9px", background: "#a52b2b", color: "white", border: "none", borderRadius: "7px", cursor: "pointer", fontWeight: 700, fontFamily: "inherit" },
  btnEliminar: { fontSize: "10.5px", padding: "5px 8px", background: "#fdeeee", color: "#a52b2b", border: "none", borderRadius: "7px", cursor: "pointer" },
  filterLabel: { fontSize: "12.5px", color: "#6b7488", fontWeight: 600 },
  selectFiltro: { fontSize: "12.5px", padding: "6px 10px", border: "1px solid #dfe6f5", borderRadius: "8px", background: "#f9fafc", color: "#26314d", fontFamily: "inherit", fontWeight: 600 },
  empty: { background: "white", border: "1px solid #e7ebf3", borderRadius: "16px", padding: "48px", textAlign: "center" },

  modalOverlay: { position: "fixed", inset: 0, background: "rgba(10,25,70,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "20px", boxSizing: "border-box" },

  listaCard: { background: "white", borderRadius: "18px", width: "100%", maxWidth: "420px", boxShadow: "0 20px 50px rgba(0,10,40,0.3)", overflow: "hidden", fontFamily: FONT },
  listaHeader: { display: "flex", alignItems: "center", gap: "8px", padding: "16px 18px", borderBottom: "1px solid #f2f4f8" },
  listaTitulo: { fontSize: "14px", fontWeight: 700, color: "#12245e", flex: 1 },
  listaBadgeCount: { fontSize: "11px", minWidth: "20px", height: "20px", padding: "0 6px", borderRadius: "10px", background: "#a52b2b", color: "white", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" },
  btnCerrarX: { background: "none", border: "none", fontSize: "15px", cursor: "pointer", color: "#8a92a6", padding: 0, marginLeft: "6px" },
  listaBody: { padding: "12px 14px", display: "flex", flexDirection: "column", gap: "8px", maxHeight: "60vh", overflowY: "auto" },
  listaItem: { background: "white", border: "1px solid #eef1f6", borderRadius: "12px", padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", cursor: "pointer" },
  listaItemNombre: { fontSize: "13.5px", fontWeight: 700, color: "#0f1b3d" },
  listaItemMeta: { fontSize: "11.5px", color: "#8a92a6", marginTop: "3px", fontWeight: 600 },
  listaItemFecha: { fontSize: "11px", color: "#a52b2b", fontWeight: 700, whiteSpace: "nowrap" },
  chevron: { fontSize: "16px", color: "#c3cad9" },
  atendidaChip: { fontSize: "11px", padding: "3px 9px", borderRadius: "20px", background: "#e6f7ec", color: "#1c7a44", fontWeight: 700, whiteSpace: "nowrap" },

  averiaCard: { background: "white", borderRadius: "16px", width: "100%", maxWidth: "420px", padding: "20px", boxShadow: "0 20px 50px rgba(0,10,40,0.3)", boxSizing: "border-box", fontFamily: FONT },
  averiaHeaderRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px", gap: "10px" },
  averiaTitulo: { fontSize: "15px", fontWeight: 700, color: "#12245e", textAlign: "left" },
  averiaSub: { fontSize: "12px", color: "#8a92a6", marginTop: "3px", textAlign: "left", fontWeight: 600 },
  badgeEmergencia: { fontSize: "11px", padding: "3px 9px", background: "#fdeeee", color: "#a52b2b", borderRadius: "20px", fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0 },
  badgeAtendida: { fontSize: "11px", padding: "3px 9px", background: "#e6f7ec", color: "#1c7a44", borderRadius: "20px", fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0 },
  averiaTabla: { display: "flex", flexDirection: "column", gap: "10px", marginBottom: "14px" },
  averiaFila: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  averiaLabel: { fontSize: "12px", color: "#8a92a6", fontWeight: 600 },
  averiaValor: { fontSize: "13px", color: "#12245e", fontWeight: 700 },
  averiaDivider: { height: "1px", background: "#eef1f6", margin: "2px 0 14px" },
  averiaMsgLabel: { fontSize: "12px", fontWeight: 700, marginBottom: "7px" },
  averiaMsgBox: { borderRadius: "12px", padding: "12px" },
  averiaMsgTxt: { fontSize: "12.5px", color: "#0f1b3d", marginBottom: "6px", lineHeight: 1.4, fontWeight: 500 },
  averiaAtendidaTxt: { fontSize: "12px", color: "#1c7a44", fontWeight: 700, marginTop: "10px" },
  btnVerProtocolo: { flex: 1, height: "42px", borderRadius: "10px", border: "1px solid #dfe6f5", background: "white", color: "#12245e", fontSize: "13px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" },
  btnMarcarAtendida: { flex: 1, height: "42px", borderRadius: "10px", border: "none", background: "#a52b2b", color: "white", fontSize: "13px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" },
  averiaCaption: { fontSize: "11px", color: "#8a92a6", textAlign: "center", marginTop: "10px", lineHeight: 1.4, fontWeight: 600 },
};
