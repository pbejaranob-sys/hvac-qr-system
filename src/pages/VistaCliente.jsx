import React, { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs, query, where, addDoc, deleteDoc, doc, updateDoc, writeBatch } from "firebase/firestore";
import { useNavigate, useParams } from "react-router-dom";

export default function VistaCliente() {
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
          <button style={s.btnBack} onClick={() => navigate("/panel-admin")}>← Panel Admin</button>
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
              <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                <button type="submit" style={s.btnPrimary} disabled={guardando}>{guardando ? "Guardando..." : "Crear sede"}</button>
                <button type="button" style={s.btnDefault} onClick={() => setMostrarFormSede(false)}>Cancelar</button>
              </div>
            </form>
          </div>
        )}

        {sedes.length === 0 ? (
          <div>
            <div style={s.statsGrid}>
              <div style={{ ...s.statCard, border: "1.5px solid #1a5fa8", cursor: "pointer", opacity: estadoFiltro === "Todos" ? 1 : 0.6 }}
                onClick={() => setEstadoFiltro("Todos")}>
                <div style={{ ...s.statNum, color: "#1a5fa8" }}>{total}</div>
                <div style={s.statLabel}>Total equipos</div>
              </div>
              <div style={{ ...s.statCard, background: estadoFiltro === "Operativo" ? "#b9f6ca" : "#e8f5e9", cursor: "pointer", border: estadoFiltro === "Operativo" ? "1.5px solid #2e7d32" : "0.5px solid #e0e0e0" }}
                onClick={() => setEstadoFiltro(estadoFiltro === "Operativo" ? "Todos" : "Operativo")}>
                <div style={{ ...s.statNum, color: "#2e7d32" }}>{stats.op}</div>
                <div style={s.statLabel}>Operativos</div>
              </div>
              <div style={{ ...s.statCard, background: estadoFiltro === "Con obs." ? "#ffe57f" : "#fff8e1", cursor: "pointer", border: estadoFiltro === "Con obs." ? "1.5px solid #e65100" : "0.5px solid #e0e0e0" }}
                onClick={() => setEstadoFiltro(estadoFiltro === "Con obs." ? "Todos" : "Con obs.")}>
                <div style={{ ...s.statNum, color: "#e65100" }}>{stats.obs}</div>
                <div style={s.statLabel}>Con obs.</div>
              </div>
              <div style={{ ...s.statCard, background: estadoFiltro === "Fuera serv." ? "#ff8a80" : "#ffebee", cursor: "pointer", border: estadoFiltro === "Fuera serv." ? "1.5px solid #c62828" : "0.5px solid #e0e0e0" }}
                onClick={() => setEstadoFiltro(estadoFiltro === "Fuera serv." ? "Todos" : "Fuera serv.")}>
                <div style={{ ...s.statNum, color: "#c62828" }}>{stats.fs}</div>
                <div style={s.statLabel}>Fuera serv.</div>
              </div>
            </div>

            {total > 0 && (
              <div style={s.barrasCard}>
                <div style={s.barraRow}>
                  <span style={s.barraLabel}>Operativo</span>
                  <div style={s.barraTrack}><div style={{ width: `${pOp}%`, background: "#43a047", height: "100%", borderRadius: "4px" }}></div></div>
                  <span style={{ ...s.barraNum, color: "#2e7d32" }}>{stats.op} und</span>
                </div>
                <div style={s.barraRow}>
                  <span style={s.barraLabel}>Con observaciones</span>
                  <div style={s.barraTrack}><div style={{ width: `${pObs}%`, background: "#ffa726", height: "100%", borderRadius: "4px" }}></div></div>
                  <span style={{ ...s.barraNum, color: "#e65100" }}>{stats.obs} und</span>
                </div>
                <div style={{ ...s.barraRow, borderBottom: "none" }}>
                  <span style={s.barraLabel}>Fuera de servicio</span>
                  <div style={s.barraTrack}><div style={{ width: `${pFs}%`, background: "#ef5350", height: "100%", borderRadius: "4px" }}></div></div>
                  <span style={{ ...s.barraNum, color: "#c62828" }}>{stats.fs} und</span>
                </div>
              </div>
            )}

            {equipos.length === 0 ? (
              <div style={s.empty}>
                <div style={{ fontSize: "36px", marginBottom: "10px" }}>📋</div>
                <div style={{ fontSize: "14px", color: "#555", marginBottom: "12px" }}>No hay equipos registrados</div>
                <button style={s.btnPrimary} onClick={() => navigate(`/registrar?cliente=${encodeURIComponent(nombre)}`)}>+ Registrar primer equipo</button>
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
                {equiposFiltrados.map((eq, i) => {
                  const obsArr = eq.observacionesArray || [];
                  const obsNorm = obsArr.map(o =>
                    typeof o === "string" ? { texto: o, fecha: "", tecnico: "" } : o
                  );
                  const numObs = obsNorm.filter(o => o.texto?.trim()).length;
                  const abierta = obsAbiertas[eq.id];
                  return (
                    <div key={eq.id} style={{ borderBottom: "0.5px solid #f0f0f0" }}>
                      <div style={{ ...s.tablaRow, background: i % 2 === 0 ? "white" : "#f8f9fa" }}>
                        <span style={s.tdCell}>{i + 1}</span>
                        <span style={s.tdCell}>{eq.codigo ? <span style={s.codigo}>{eq.codigo}</span> : <span style={{ color: "#aaa" }}>-</span>}</span>
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
                          <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                            <button style={s.btnInfo} onClick={() => navigate(`/equipo/${eq.id}`)}>Info</button>
                            <button
                              style={{ ...s.btnObs, background: abierta ? "#e65100" : "#fff8e1", color: abierta ? "white" : "#e65100", opacity: numObs === 0 ? 0.45 : 1 }}
                              onClick={() => toggleObs(eq.id)}
                            >
                              Obs <span style={{ background: abierta ? "white" : "#e65100", color: abierta ? "#e65100" : "white", borderRadius: "20px", fontSize: "9px", padding: "1px 5px", fontWeight: 700 }}>{numObs}</span> {abierta ? "▴" : "▾"}
                            </button>
                            <button style={s.btnEditar} onClick={() => navigate(`/registrar?id=${eq.id}`)}>Editar</button>
                            <button style={s.btnEliminar} onClick={() => handleEliminarEquipo(eq.id)}>🗑</button>
                          </div>
                        </span>
                      </div>
                      {abierta && (
                        <div style={s.obsPanel}>
                          <div style={s.obsTitulo}>⚠️ {numObs} observación{numObs !== 1 ? "es" : ""} — {eq.codigo || eq.marca}</div>
                          {numObs === 0 ? (
                            <div style={{ fontSize: "12px", color: "#aaa", textAlign: "center", padding: "6px 0" }}>Sin observaciones registradas</div>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                              {obsNorm.filter(o => o.texto?.trim()).map((o, idx) => (
                                <div key={idx} style={s.obsItem}>
                                  <div style={{ fontSize: "12px", color: "#333", lineHeight: 1.5 }}>{o.texto}</div>
                                  <div style={{ fontSize: "10px", color: "#888", marginTop: "3px" }}>
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
                    <div style={s.sedeIcon}>🏢</div>
                    <div style={{ flex: 1 }}>
                      <div style={s.sedeNombre}>{sede.nombre}</div>
                      <div style={s.sedeDireccion}>{sede.direccion}</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <button style={s.btnEditarSede} onClick={() => setEditandoSede(sede)}>✏️</button>
                      <button style={s.btnEliminarSede} onClick={() => handleEliminarSede(sede.id, sede.nombre)}>🗑</button>
                    </div>
                  </div>
                  <div style={s.miniStats}>
                    <div style={{ ...s.mini, background: "#e8f5e9" }}>
                      <div style={{ ...s.miniNum, color: "#2e7d32" }}>{st.op}</div>
                      <div style={{ ...s.miniLabel, color: "#2e7d32" }}>Operativo</div>
                    </div>
                    <div style={{ ...s.mini, background: "#fff8e1" }}>
                      <div style={{ ...s.miniNum, color: "#e65100" }}>{st.obs}</div>
                      <div style={{ ...s.miniLabel, color: "#e65100" }}>Con obs.</div>
                    </div>
                    <div style={{ ...s.mini, background: st.fs > 0 ? "#ffebee" : "#f5f5f5" }}>
                      <div style={{ ...s.miniNum, color: st.fs > 0 ? "#c62828" : "#aaa" }}>{st.fs}</div>
                      <div style={{ ...s.miniLabel, color: st.fs > 0 ? "#c62828" : "#aaa" }}>Fuera serv.</div>
                    </div>
                  </div>
                  <button style={s.btnVerSede} onClick={() => navigate(`/cliente/${encodeURIComponent(nombre)}/sede/${encodeURIComponent(sede.nombre)}`)}>
                    Ver equipos →
                  </button>
                </div>
              );
            })}'
            <div style={s.sedeCardAgregar} onClick={() => setMostrarFormSede(true)}>
              <div style={{ fontSize: "24px", marginBottom: "6px" }}>+</div>
              <div style={{ fontSize: "12px" }}>Agregar sede</div>
            </div>
          </div>
        )}
      </div>

      {/* Modal editar sede */}
      {editandoSede && (
        <div style={s.modalOverlay}>
          <div style={s.modalCard}>
            <div style={s.formTitle}>✏️ Editar sede</div>
            <form onSubmit={handleEditarSede}>
              <div style={{ marginBottom: "12px" }}>
                <label style={s.label}>Nombre de la sede</label>
                <input style={s.input} value={formEditSede.nombre}
                  onChange={e => setFormEditSede({ ...formEditSede, nombre: e.target.value })} required />
              </div>
              <div style={{ marginBottom: "12px" }}>
                <label style={s.label}>Dirección</label>
                <input style={s.input} value={formEditSede.direccion}
                  onChange={e => setFormEditSede({ ...formEditSede, direccion: e.target.value })} />
              </div>
              <div style={{ marginBottom: "16px" }}>
                <label style={s.label}>Referencia (opcional)</label>
                <input style={s.input} value={formEditSede.referencia}
                  onChange={e => setFormEditSede({ ...formEditSede, referencia: e.target.value })} />
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button type="submit" style={s.btnPrimary} disabled={guardando}>
                  {guardando ? "Guardando..." : "💾 Guardar"}
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
  page: { minHeight: "100vh", background: "#f0f4f8", fontFamily: "Inter, Arial, sans-serif" },
  navbar: { background: "white", borderBottom: "0.5px solid #e0e0e0", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10 },
  navLeft: { display: "flex", alignItems: "center", gap: "12px" },
  logo: { fontFamily: "'Arial Black', sans-serif", fontWeight: 900, fontSize: "20px", display: "flex", alignItems: "baseline" },
  divider: { width: "1px", height: "18px", background: "#e0e0e0" },
  btnBack: { background: "none", border: "none", color: "#1a5fa8", cursor: "pointer", fontSize: "13px", fontWeight: 500, padding: 0 },
  navTitle: { fontSize: "13px", color: "#555", fontWeight: 500 },
  navBtns: { display: "flex", gap: "8px" },
  btnPrimary: { background: "#1a5fa8", color: "white", border: "none", borderRadius: "8px", padding: "7px 14px", cursor: "pointer", fontSize: "12px", fontWeight: 500 },
  btnDefault: { background: "white", color: "#333", border: "0.5px solid #ddd", borderRadius: "8px", padding: "7px 14px", cursor: "pointer", fontSize: "12px" },
  content: { maxWidth: "1200px", margin: "0 auto", padding: "20px 24px" },
  formCard: { background: "white", border: "0.5px solid #e0e0e0", borderRadius: "12px", padding: "20px", marginBottom: "20px" },
  formTitle: { fontSize: "14px", fontWeight: 500, color: "#222", marginBottom: "14px" },
  grid3: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" },
  label: { display: "block", fontSize: "12px", color: "#555", marginBottom: "5px", fontWeight: 500 },
  input: { width: "100%", padding: "9px 12px", borderRadius: "8px", border: "0.5px solid #ddd", fontSize: "13px", boxSizing: "border-box", background: "#fafafa" },
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
  btnEditarSede: { fontSize: "13px", padding: "4px 8px", background: "#e8f0fe", color: "#1a5fa8", border: "0.5px solid #c5d5e8", borderRadius: "6px", cursor: "pointer", flexShrink: 0 },
  btnEliminarSede: { fontSize: "13px", padding: "4px 8px", background: "#ffebee", color: "#c62828", border: "0.5px solid #ef9a9a", borderRadius: "6px", cursor: "pointer", flexShrink: 0 },
  selectFiltro: { fontSize: "12px", padding: "4px 8px", border: "0.5px solid #ddd", borderRadius: "6px", background: "white", color: "#333" },
  empty: { background: "white", border: "0.5px solid #e0e0e0", borderRadius: "12px", padding: "40px", textAlign: "center" },
  sedesGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" },
  sedeCard: { background: "white", border: "0.5px solid #e0e0e0", borderRadius: "12px", overflow: "hidden" },
  sedeCardAgregar: { background: "white", border: "1.5px dashed #c5d5e8", borderRadius: "12px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "160px", cursor: "pointer", color: "#aaa" },
  sedeHeader: { padding: "12px 14px", borderBottom: "0.5px solid #f0f0f0", display: "flex", alignItems: "center", gap: "10px" },
  sedeIcon: { width: "32px", height: "32px", borderRadius: "8px", background: "#e8f0fe", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" },
  sedeNombre: { fontSize: "13px", fontWeight: 500, color: "#222" },
  sedeDireccion: { fontSize: "11px", color: "#888", marginTop: "2px" },
  miniStats: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px", padding: "10px 14px" },
  mini: { textAlign: "center", padding: "6px", borderRadius: "8px" },
  miniNum: { fontSize: "16px", fontWeight: 500 },
  miniLabel: { fontSize: "10px", marginTop: "1px" },
  btnVerSede: { width: "100%", padding: "10px", border: "none", borderTop: "0.5px solid #f0f0f0", cursor: "pointer", fontSize: "13px", fontWeight: 500, background: "white", color: "#1a5fa8" },
  modalOverlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 },
  modalCard: { background: "white", borderRadius: "12px", padding: "24px", width: "100%", maxWidth: "440px", boxShadow: "0 8px 32px rgba(0,0,0,0.15)" },
  btnObs: { fontSize: "11px", padding: "3px 7px", border: "0.5px solid #ffe082", borderRadius: "6px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "3px" },
  obsPanel: { background: "#fffdf5", borderTop: "2px solid #ffa726", padding: "12px 16px" },
  obsTitulo: { fontSize: "11px", fontWeight: 500, color: "#e65100", marginBottom: "8px" },
  obsItem: { background: "white", border: "0.5px solid #ffe082", borderLeft: "3px solid #ffa726", borderRadius: "8px", padding: "8px 12px" },
};