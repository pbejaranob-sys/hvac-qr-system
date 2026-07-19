import React, { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs, query, where, addDoc, deleteDoc, doc, updateDoc, writeBatch } from "firebase/firestore";
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
const SvgFlechaDer = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ display: "inline", verticalAlign: "-2px" }}>
    <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const SvgEliminar = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const SvgEditar = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const SvgAlerta = ({ color = "currentColor" }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path d="M12 3l9 16H3l9-16z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 10v4M12 17h.01" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);
const SvgSede = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M4 21V7l8-4 8 4v14M9 21v-6h6v6" stroke="#1a4fc0" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const SvgGuardar = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ verticalAlign: "-2px", marginRight: "4px" }}>
    <path d="M5 4h11l3 3v13H5V4z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    <path d="M8 4v5h7V4M8 14h8v6H8v-6z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
  </svg>
);

export default function VistaCliente() {
  useManropeAndBodyReset();

  const { clienteNombre } = useParams();
  const nombre = decodeURIComponent(clienteNombre);
  const [sedes, setSedes] = useState([]);
  const [equipos, setEquipos] = useState([]);
  const [uid, setUid] = useState("");
  const [mostrarFormSede, setMostrarFormSede] = useState(false);
  const [formSede, setFormSede] = useState({ nombre: "", direccion: "", referencia: "" });
  const [guardando, setGuardando] = useState(false);
  const [pisoFiltro, setPisoFiltro] = useState("Todos");
  const [estadoFiltro, setEstadoFiltro] = useState("Todos");
  const [mesFiltro, setMesFiltro] = useState("Todos");
  const [editandoSede, setEditandoSede] = useState(null);
  const [obsAbiertas, setObsAbiertas] = useState({});
  const toggleObs = (id) => setObsAbiertas(prev => ({ ...prev, [id]: !prev[id] }));
  const [formEditSede, setFormEditSede] = useState({ nombre: "", direccion: "", referencia: "" });
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) { setUid(user.uid); cargarDatos(user.uid); }
    });
    return () => unsubscribe();
  }, [clienteNombre]);

  useEffect(() => {
    if (editandoSede) setFormEditSede({
      nombre: editandoSede.nombre || "",
      direccion: editandoSede.direccion || "",
      referencia: editandoSede.referencia || ""
    });
  }, [editandoSede]);

  const cargarDatos = async (adminUid) => {
    const qEq = query(collection(db, "equipos"),
      where("adminid", "==", adminUid),
      where("cliente", "==", nombre)
    );
    const snapEq = await getDocs(qEq);
    setEquipos(snapEq.docs.map(d => ({ id: d.id, ...d.data() })));

    const qSedes = query(collection(db, "sedes"),
      where("adminid", "==", adminUid),
      where("cliente", "==", nombre)
    );
    const snapSedes = await getDocs(qSedes);
    setSedes(snapSedes.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const handleCrearSede = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      await addDoc(collection(db, "sedes"), {
        nombre: formSede.nombre,
        direccion: formSede.direccion,
        referencia: formSede.referencia,
        cliente: nombre,
        adminid: uid,
        fechaCreacion: new Date().toLocaleDateString("es-PE")
      });

      const batch = writeBatch(db);
      const equiposSinSede = equipos.filter(e => !e.sede || e.sede === "");
      equiposSinSede.forEach(eq => {
        batch.update(doc(db, "equipos", eq.id), { sede: formSede.nombre });
      });
      if (equiposSinSede.length > 0) await batch.commit();

      setFormSede({ nombre: "", direccion: "", referencia: "" });
      setMostrarFormSede(false);
      cargarDatos(uid);
    } catch (err) {
      alert("Error: " + err.message);
    }
    setGuardando(false);
  };

  const handleEditarSede = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      await updateDoc(doc(db, "sedes", editandoSede.id), {
        nombre: formEditSede.nombre,
        direccion: formEditSede.direccion,
        referencia: formEditSede.referencia,
      });

      if (editandoSede.nombre !== formEditSede.nombre) {
        const batch = writeBatch(db);
        const equiposSede = equipos.filter(e => e.sede === editandoSede.nombre);
        equiposSede.forEach(eq => {
          batch.update(doc(db, "equipos", eq.id), { sede: formEditSede.nombre });
        });
        if (equiposSede.length > 0) await batch.commit();
      }

      setEditandoSede(null);
      cargarDatos(uid);
    } catch (err) {
      alert("Error: " + err.message);
    }
    setGuardando(false);
  };

  const handleEliminarSede = async (sedeId, sedeNombre) => {
    if (!window.confirm(`¿Eliminar la sede "${sedeNombre}"? Esta acción no se puede deshacer.`)) return;
    try {
      await deleteDoc(doc(db, "sedes", sedeId));
      setSedes(prev => prev.filter(s => s.id !== sedeId));
    } catch (err) {
      alert("Error al eliminar: " + err.message);
    }
  };

  const handleEliminarEquipo = async (equipoId) => {
    if (!window.confirm("¿Eliminar este equipo? Esta acción no se puede deshacer.")) return;
    try {
      await deleteDoc(doc(db, "equipos", equipoId));
      setEquipos(prev => prev.filter(e => e.id !== equipoId));
    } catch (err) {
      alert("Error al eliminar: " + err.message);
    }
  };

  const statsEquipos = (lista) => ({
    op: lista.filter(e => e.estado === "Operativo").length,
    obs: lista.filter(e => e.estado === "Operativo con observaciones").length,
    fs: lista.filter(e => e.estado === "Fuera de servicio").length,
  });

  const stats = statsEquipos(equipos);
  const total = equipos.length;
  const pOp = total ? Math.round((stats.op / total) * 100) : 0;
  const pObs = total ? Math.round((stats.obs / total) * 100) : 0;
  const pFs = total ? Math.round((stats.fs / total) * 100) : 0;

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
          <button style={s.btnBack} onClick={() => navigate("/panel-admin")}><SvgFlecha /> Panel Admin</button>
          <div style={s.divider}></div>
          <span style={s.navTitle}>{nombre}</span>
        </div>
        <div style={s.navBtns}>
          <button style={s.btnDefault} onClick={() => setMostrarFormSede(!mostrarFormSede)}>+ Crear sede</button>
          <button style={s.btnPrimary} onClick={() => navigate(`/registrar?cliente=${encodeURIComponent(nombre)}`)}>+ Nuevo equipo</button>
        </div>
      </div>

      <div style={s.content}>
        {mostrarFormSede && (
          <div style={s.formCard}>
            <div style={s.formTitle}>Nueva sede — {nombre}</div>
            <form onSubmit={handleCrearSede}>
              <div style={s.grid3}>
                <div>
                  <label style={s.label}>Nombre de la sede</label>
                  <input style={s.input} placeholder="Sede Miraflores" value={formSede.nombre}
                    onChange={e => setFormSede({ ...formSede, nombre: e.target.value })} required />
                </div>
                <div>
                  <label style={s.label}>Dirección</label>
                  <input style={s.input} placeholder="Av. Larco 1234" value={formSede.direccion}
                    onChange={e => setFormSede({ ...formSede, direccion: e.target.value })} />
                </div>
                <div>
                  <label style={s.label}>Referencia (opcional)</label>
                  <input style={s.input} placeholder="Frente al Parque Kennedy" value={formSede.referencia}
                    onChange={e => setFormSede({ ...formSede, referencia: e.target.value })} />
                </div>
              </div>
              <div style={{ display: "flex", gap: "10px", marginTop: "14px" }}>
                <button type="submit" style={s.btnPrimary} disabled={guardando}>{guardando ? "Guardando..." : "Crear sede"}</button>
                <button type="button" style={s.btnDefault} onClick={() => setMostrarFormSede(false)}>Cancelar</button>
              </div>
            </form>
          </div>
        )}

        {sedes.length === 0 ? (
          <div>
            <div style={s.statsGrid}>
              <div style={{ ...s.statCard, border: `1.5px solid ${estadoFiltro === "Todos" ? "#1a4fc0" : "#e7ebf3"}`, cursor: "pointer" }}
                onClick={() => setEstadoFiltro("Todos")}>
                <div style={{ ...s.statNum, color: "#1a4fc0" }}>{total}</div>
                <div style={s.statLabel}>Total equipos</div>
              </div>
              <div style={{ ...s.statCard, background: "#e6f7ec", cursor: "pointer", border: `1.5px solid ${estadoFiltro === "Operativo" ? "#1c7a44" : "#c3ecd2"}` }}
                onClick={() => setEstadoFiltro(estadoFiltro === "Operativo" ? "Todos" : "Operativo")}>
                <div style={{ ...s.statNum, color: "#1c7a44" }}>{stats.op}</div>
                <div style={s.statLabel}>Operativos</div>
              </div>
              <div style={{ ...s.statCard, background: "#fff3d6", cursor: "pointer", border: `1.5px solid ${estadoFiltro === "Con obs." ? "#a8720b" : "#f3dfa3"}` }}
                onClick={() => setEstadoFiltro(estadoFiltro === "Con obs." ? "Todos" : "Con obs.")}>
                <div style={{ ...s.statNum, color: "#a8720b" }}>{stats.obs}</div>
                <div style={s.statLabel}>Con obs.</div>
              </div>
              <div style={{ ...s.statCard, background: "#fdeeee", cursor: "pointer", border: `1.5px solid ${estadoFiltro === "Fuera serv." ? "#a52b2b" : "#f6d3d3"}` }}
                onClick={() => setEstadoFiltro(estadoFiltro === "Fuera serv." ? "Todos" : "Fuera serv.")}>
                <div style={{ ...s.statNum, color: "#a52b2b" }}>{stats.fs}</div>
                <div style={s.statLabel}>Fuera serv.</div>
              </div>
            </div>

            {total > 0 && (
              <div style={s.barrasCard}>
                <div style={s.barraRow}>
                  <span style={s.barraLabel}>Operativo</span>
                  <div style={s.barraTrack}><div style={{ width: `${pOp}%`, background: "#1c9a53", height: "100%", borderRadius: "4px" }}></div></div>
                  <span style={{ ...s.barraNum, color: "#1c7a44" }}>{stats.op} und</span>
                </div>
                <div style={s.barraRow}>
                  <span style={s.barraLabel}>Con observaciones</span>
                  <div style={s.barraTrack}><div style={{ width: `${pObs}%`, background: "#e8a020", height: "100%", borderRadius: "4px" }}></div></div>
                  <span style={{ ...s.barraNum, color: "#a8720b" }}>{stats.obs} und</span>
                </div>
                <div style={{ ...s.barraRow, borderBottom: "none" }}>
                  <span style={s.barraLabel}>Fuera de servicio</span>
                  <div style={s.barraTrack}><div style={{ width: `${pFs}%`, background: "#c23b3b", height: "100%", borderRadius: "4px" }}></div></div>
                  <span style={{ ...s.barraNum, color: "#a52b2b" }}>{stats.fs} und</span>
                </div>
              </div>
            )}

            {equipos.length === 0 ? (
              <div style={s.empty}>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "#c3cad9", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Sin equipos</div>
                <div style={{ fontSize: "14px", color: "#6b7488", marginBottom: "14px", fontWeight: 600 }}>No hay equipos registrados</div>
                <button style={s.btnPrimary} onClick={() => navigate(`/registrar?cliente=${encodeURIComponent(nombre)}`)}>+ Registrar primer equipo</button>
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
                  <div style={{ minWidth: "960px" }}>
                    <div style={s.tablaHeader}>
                      {["#", "Código", "Piso", "Ambiente", "Tipo", "Marca/Modelo", "Estado", "Últ. mant.", "Acciones"].map(h => (
                        <span key={h} style={s.thCell}>{h}</span>
                      ))}
                    </div>
                    {equiposFiltrados.map((eq, i) => {
                      const obsArr = eq.observacionesArray || [];
                      const obsNorm = obsArr.map(o => typeof o === "string" ? { texto: o, fecha: "", tecnico: "" } : o);
                      const numObs = obsNorm.filter(o => o.texto?.trim()).length;
                      const abierta = obsAbiertas[eq.id];
                      const fc = fechaColor(eq.ultimoMantenimiento);
                      const mesAnio = fechaAMesAnio(eq.ultimoMantenimiento);
                      return (
                        <div key={eq.id} style={{ borderBottom: "1px solid #f2f4f8" }}>
                          <div style={{ ...s.tablaRow, background: i % 2 === 0 ? "white" : "#fafbfd" }}>
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
                              <div style={{ display: "flex", gap: "5px", alignItems: "center", flexWrap: "nowrap" }}>
                                <button style={s.btnInfo} onClick={() => navigate(`/equipo/${eq.id}`)}>Info</button>
                                <button
                                  style={{ ...s.btnObs, background: abierta ? "#a8720b" : "#fff3d6", color: abierta ? "white" : "#a8720b", opacity: numObs === 0 ? 0.5 : 1 }}
                                  onClick={() => toggleObs(eq.id)}
                                >
                                  Obs <span style={{ background: abierta ? "white" : "#a8720b", color: abierta ? "#a8720b" : "white", borderRadius: "20px", fontSize: "9px", padding: "1px 5px", fontWeight: 700 }}>{numObs}</span> {abierta ? "▴" : "▾"}
                                </button>
                                <button style={s.btnEditar} onClick={() => navigate(`/registrar?id=${eq.id}`)}>Editar</button>
                                <button style={s.btnProto} onClick={() => navigate(`/protocolo?equipo=${eq.id}`)}>Protocolo</button>
                                <button style={s.btnEliminar} onClick={() => handleEliminarEquipo(eq.id)}><SvgEliminar /></button>
                              </div>
                            </span>
                          </div>
                          {abierta && (
                            <div style={s.obsPanel}>
                              <div style={s.obsTitulo}>{numObs} observación{numObs !== 1 ? "es" : ""} — {eq.codigo || eq.marca}</div>
                              {numObs === 0 ? (
                                <div style={{ fontSize: "12.5px", color: "#c3cad9", textAlign: "center", padding: "8px 0" }}>Sin observaciones registradas</div>
                              ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                                  {obsNorm.filter(o => o.texto?.trim()).map((o, idx) => (
                                    <div key={idx} style={s.obsItem}>
                                      <div style={{ fontSize: "12.5px", color: "#26314d", lineHeight: 1.45 }}>{o.texto}</div>
                                      <div style={{ fontSize: "10.5px", color: "#8a92a6", marginTop: "3px", fontWeight: 600 }}>
                                        {o.fecha && <span>{o.fecha}</span>}
                                        {o.fecha && o.tecnico && <span> · </span>}
                                        {o.tecnico && <span>Técnico: {o.tecnico}</span>}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={s.sedesGrid}>
            {sedes.map(sede => {
              const equiposSede = equipos.filter(e => e.sede === sede.nombre);
              const st = statsEquipos(equiposSede);
              return (
                <div key={sede.id} style={s.sedeCard}>
                  <div style={s.sedeHeader}>
                    <div style={s.sedeIcon}><SvgSede /></div>
                    <div style={{ flex: 1 }}>
                      <div style={s.sedeNombre}>{sede.nombre}</div>
                      <div style={s.sedeDireccion}>{sede.direccion}</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <button style={s.btnEditarSede} onClick={() => setEditandoSede(sede)}><SvgEditar /></button>
                      <button style={s.btnEliminarSede} onClick={() => handleEliminarSede(sede.id, sede.nombre)}><SvgEliminar /></button>
                    </div>
                  </div>
                  <div style={s.miniStats}>
                    <div style={{ ...s.mini, background: "#e6f7ec" }}>
                      <div style={{ ...s.miniNum, color: "#1c7a44" }}>{st.op}</div>
                      <div style={{ ...s.miniLabel, color: "#1c7a44" }}>Operativo</div>
                    </div>
                    <div style={{ ...s.mini, background: "#fff3d6" }}>
                      <div style={{ ...s.miniNum, color: "#a8720b" }}>{st.obs}</div>
                      <div style={{ ...s.miniLabel, color: "#a8720b" }}>Con obs.</div>
                    </div>
                    <div style={{ ...s.mini, background: st.fs > 0 ? "#fdeeee" : "#f4f6fb" }}>
                      <div style={{ ...s.miniNum, color: st.fs > 0 ? "#a52b2b" : "#9aa2b3" }}>{st.fs}</div>
                      <div style={{ ...s.miniLabel, color: st.fs > 0 ? "#a52b2b" : "#9aa2b3" }}>Fuera serv.</div>
                    </div>
                  </div>
                  <button style={s.btnVerSede} onClick={() => navigate(`/cliente/${encodeURIComponent(nombre)}/sede/${encodeURIComponent(sede.nombre)}`)}>
                    Ver equipos <SvgFlechaDer />
                  </button>
                </div>
              );
            })}
            <div style={s.sedeCardAgregar} onClick={() => setMostrarFormSede(true)}>
              <div style={s.plusCircle}>+</div>
              <div style={{ fontSize: "13px", fontWeight: 700 }}>Agregar sede</div>
            </div>
          </div>
        )}
      </div>

      {/* Modal editar sede */}
      {editandoSede && (
        <div style={s.modalOverlay}>
          <div style={s.modalCard}>
            <div style={s.formTitle}><SvgEditar /> Editar sede</div>
            <form onSubmit={handleEditarSede}>
              <div style={{ marginBottom: "14px" }}>
                <label style={s.label}>Nombre de la sede</label>
                <input style={s.input} value={formEditSede.nombre}
                  onChange={e => setFormEditSede({ ...formEditSede, nombre: e.target.value })} required />
              </div>
              <div style={{ marginBottom: "14px" }}>
                <label style={s.label}>Dirección</label>
                <input style={s.input} value={formEditSede.direccion}
                  onChange={e => setFormEditSede({ ...formEditSede, direccion: e.target.value })} />
              </div>
              <div style={{ marginBottom: "18px" }}>
                <label style={s.label}>Referencia (opcional)</label>
                <input style={s.input} value={formEditSede.referencia}
                  onChange={e => setFormEditSede({ ...formEditSede, referencia: e.target.value })} />
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <button type="submit" style={s.btnPrimary} disabled={guardando}>
                  {guardando ? "Guardando..." : <><SvgGuardar />Guardar</>}
                </button>
                <button type="button" style={s.btnDefault} onClick={() => setEditandoSede(null)}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
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
  navBtns: { display: "flex", gap: "10px" },
  btnPrimary: { background: "#1a4fc0", color: "white", border: "none", borderRadius: "10px", padding: "9px 16px", cursor: "pointer", fontSize: "13px", fontWeight: 700, fontFamily: "inherit" },
  btnDefault: { background: "white", color: "#26314d", border: "1px solid #dfe6f5", borderRadius: "10px", padding: "9px 16px", cursor: "pointer", fontSize: "13px", fontWeight: 700, fontFamily: "inherit" },
  content: { maxWidth: "1300px", margin: "0 auto", padding: "clamp(16px,4vw,32px)" },
  formCard: { background: "white", border: "1px solid #e7ebf3", borderRadius: "16px", padding: "22px", marginBottom: "20px" },
  formTitle: { fontSize: "14.5px", fontWeight: 800, color: "#12245e", marginBottom: "16px" },
  grid3: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px" },
  label: { display: "block", fontSize: "12.5px", color: "#6b7488", marginBottom: "6px", fontWeight: 700 },
  input: { width: "100%", padding: "10px 13px", borderRadius: "10px", border: "1px solid #dfe6f5", fontSize: "13.5px", boxSizing: "border-box", background: "#f9fafc", fontFamily: "inherit" },
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
  tablaHeader: { display: "grid", gridTemplateColumns: "36px 80px 60px 120px 90px 130px 90px 90px 250px", gap: "8px", padding: "12px 18px", background: "#fafbfd", borderBottom: "1px solid #eef1f6" },
  tablaRow: { display: "grid", gridTemplateColumns: "36px 80px 60px 120px 90px 130px 90px 90px 250px", gap: "8px", padding: "12px 18px", alignItems: "center" },
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
  btnEditarSede: { fontSize: "13px", padding: "5px 9px", background: "#fff3d6", border: "none", borderRadius: "8px", cursor: "pointer", flexShrink: 0 },
  btnEliminarSede: { fontSize: "13px", padding: "5px 9px", background: "#fdeeee", border: "none", borderRadius: "8px", cursor: "pointer", flexShrink: 0 },
  filterLabel: { fontSize: "12.5px", color: "#6b7488", fontWeight: 600 },
  selectFiltro: { fontSize: "12.5px", padding: "6px 10px", border: "1px solid #dfe6f5", borderRadius: "8px", background: "#f9fafc", color: "#26314d", fontFamily: "inherit", fontWeight: 600 },
  empty: { background: "white", border: "1px solid #e7ebf3", borderRadius: "16px", padding: "48px", textAlign: "center" },
  sedesGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" },
  sedeCard: { background: "white", border: "1px solid #e7ebf3", borderRadius: "16px", overflow: "hidden" },
  sedeCardAgregar: { background: "white", border: "1.5px dashed #c3d6fb", borderRadius: "16px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "180px", cursor: "pointer", color: "#1a4fc0", gap: "10px" },
  plusCircle: { width: "40px", height: "40px", borderRadius: "50%", background: "#e5f0ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", color: "#1a4fc0", fontWeight: 700 },
  sedeHeader: { padding: "14px 16px", borderBottom: "1px solid #f2f4f8", display: "flex", alignItems: "center", gap: "10px" },
  sedeIcon: { width: "36px", height: "36px", borderRadius: "10px", background: "#e5f0ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "17px" },
  sedeNombre: { fontSize: "13.5px", fontWeight: 800, color: "#12245e" },
  sedeDireccion: { fontSize: "11.5px", color: "#8a92a6", marginTop: "2px", fontWeight: 600 },
  miniStats: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px", padding: "14px 16px" },
  mini: { textAlign: "center", padding: "9px", borderRadius: "10px" },
  miniNum: { fontSize: "17px", fontWeight: 800 },
  miniLabel: { fontSize: "10px", marginTop: "2px", fontWeight: 700 },
  btnVerSede: { width: "100%", padding: "12px", border: "none", borderTop: "1px solid #f2f4f8", cursor: "pointer", fontSize: "13.5px", fontWeight: 700, background: "white", color: "#1a4fc0", fontFamily: "inherit" },
  modalOverlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(10,25,70,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "20px", boxSizing: "border-box" },
  modalCard: { background: "white", borderRadius: "18px", padding: "26px", width: "100%", maxWidth: "440px", boxShadow: "0 20px 50px rgba(0,10,40,0.3)", boxSizing: "border-box" },
  btnObs: { fontSize: "10.5px", padding: "5px 8px", border: "none", borderRadius: "7px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px", fontWeight: 700, fontFamily: "inherit" },
  obsPanel: { background: "#fafbfd", borderTop: "2px solid #f3dfa3", padding: "14px 18px" },
  obsTitulo: { fontSize: "11.5px", fontWeight: 700, color: "#a8720b", marginBottom: "10px" },
  obsItem: { background: "white", border: "1px solid #f3dfa3", borderLeft: "3px solid #e8a020", borderRadius: "10px", padding: "9px 13px" },
};
