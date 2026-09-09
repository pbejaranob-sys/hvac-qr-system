import React, { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { useNavigate, useSearchParams } from "react-router-dom";
import jsPDF from "jspdf";

const FONT = "'Manrope', -apple-system, sans-serif";

const TIPOS_CON_GAS = [
  "Split Piso Techo", "Split Pared", "Split Ducto", "Split Fancoil", "Split Cassete",
  "Ventana", "Autocontenido", "Precisión", "VRV Evaporador", "VRV Condensador", "Chiller",
];

const initiales = (nombre) => {
  const words = (nombre || "").trim().split(" ");
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return (nombre || "?").substring(0, 2).toUpperCase();
};

const colorAvatar = (nombre) => {
  const colores = [
    { bg: "#e5f0ff", color: "#1a4fc0" }, { bg: "#e6f7ec", color: "#1c7a44" },
    { bg: "#f1e9fb", color: "#7c3fd8" }, { bg: "#fff3d6", color: "#a8720b" },
    { bg: "#fdeeee", color: "#a52b2b" }, { bg: "#e0f4f2", color: "#0d7a6c" },
  ];
  let sum = 0;
  for (let i = 0; i < (nombre || "").length; i++) sum += nombre.charCodeAt(i);
  return colores[sum % colores.length];
};

const parsePiso = (p) => {
  if (!p) return [99, 0, 0];
  const s = String(p).toLowerCase().trim();
  const m = s.match(/s[oó]tano\s*(\d*)/);
  if (m) return [-1, -(parseInt(m[1]) || 1), 0];
  const match = s.match(/^(\d+)\s*([a-z]?)/);
  if (match) {
    const num = parseInt(match[1]);
    const letra = match[2] ? match[2].charCodeAt(0) - 96 : 0;
    return [0, num, letra];
  }
  return [1, 0, 0];
};

const sortPiso = (a, b) => {
  const [ta, na, la] = parsePiso(a.piso);
  const [tb, nb, lb] = parsePiso(b.piso);
  if (ta !== tb) return ta - tb;
  if (na !== nb) return na - nb;
  return la - lb;
};

const ordenarPisos = (a, b) => {
  const [ta, na, la] = parsePiso(a);
  const [tb, nb, lb] = parsePiso(b);
  if (ta !== tb) return ta - tb;
  if (na !== nb) return na - nb;
  return la - lb;
};

const getObsPDF = (e) => {
  const arr = e.observacionesArray || [];
  const norm = arr.map(o => typeof o === "string"
    ? { texto: o, fecha: "", tecnico: "", causa: "" }
    : { texto: o.texto || "", fecha: o.fecha || "", tecnico: o.tecnico || "", causa: o.causa || "" });
  const filtradas = norm.filter(o => o?.texto?.trim());
  if (filtradas.length > 0) return filtradas;
  return e.observaciones?.split(/\n|;/).map(o => ({ texto: o.trim(), fecha: "", tecnico: "", causa: "" })).filter(o => o.texto) || [];
};

const getRecPDF = (e) => e.recomendacionesArray?.filter(Boolean) ||
  e.recomendaciones?.split(/\n|;/).map(r => r.trim()).filter(Boolean) || [];

const exportarExcel = (cliente, equipos) => {
  const porPiso = {};
  equipos.forEach(e => { const p = e.piso || "Sin piso"; if (!porPiso[p]) porPiso[p] = []; porPiso[p].push(e); });
  const pisos = Object.keys(porPiso).sort(ordenarPisos);
  let html = `<table border="1"><tr style="background:#1a4fc0;color:white"><th>#</th><th>Código</th><th>Piso</th><th>Ambiente</th><th>Tipo</th><th>Marca</th><th>Modelo</th><th>Serie</th><th>Estado</th><th>Últ. Mant.</th></tr>`;
  let n = 1;
  pisos.forEach(piso => {
    html += `<tr style="background:#f4f6fb"><td colspan="10" style="font-weight:bold">Piso ${piso}</td></tr>`;
    porPiso[piso].forEach(e => {
      const col = e.estado === "Operativo" ? "#e6f7ec" : e.estado === "Operativo con observaciones" ? "#fff8e6" : "#fdeeee";
      html += `<tr style="background:${col}"><td>${n++}</td><td>${e.codigo || ""}</td><td>${e.piso || ""}</td><td>${e.ambiente || ""}</td><td>${e.tipoEquipo || ""}</td><td>${e.marca || ""}</td><td>${e.modelo || ""}</td><td>${e.serie || ""}</td><td>${e.estado || ""}</td><td>${e.ultimoMantenimiento || ""}</td></tr>`;
    });
  });
  html += `</table>`;
  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url;
  a.download = `equipos-${cliente}.xls`; a.click(); URL.revokeObjectURL(url);
};

const exportarPDF = (cliente, sede, equipos) => {
  const pdf = new jsPDF("l", "mm", "a4");
  const M = 10, PW = 297, CW = PW - M * 2;
  pdf.setFillColor(26, 79, 192); pdf.rect(0, 0, PW, 18, "F");
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(13); pdf.setTextColor(255, 255, 255);
  pdf.text(`${cliente}${sede ? " · " + sede : ""}`, M, 12);
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(8); pdf.setTextColor(210, 222, 250);
  pdf.text(`HVAC Sistema de Mantenimiento · ${new Date().toLocaleDateString("es-PE")}`, PW - M, 12, { align: "right" });
  pdf.save(`equipos-${cliente}.pdf`);
};

function useManropeAndBodyReset() {
  useEffect(() => {
    if (!document.getElementById("font-manrope")) {
      const link = document.createElement("link");
      link.id = "font-manrope"; link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap";
      document.head.appendChild(link);
    }
    const prevBg = document.body.style.background;
    document.body.style.margin = "0"; document.body.style.background = "#eef1f6";
    return () => { document.body.style.background = prevBg; };
  }, []);
}

const getBadge = (estado) => {
  const map = {
    "Operativo": { bg: "#e6f7ec", color: "#1c7a44", label: "Operativo" },
    "Operativo con observaciones": { bg: "#fff3d6", color: "#a8720b", label: "Con obs." },
    "Fuera de servicio": { bg: "#fdeeee", color: "#a52b2b", label: "Fuera serv." },
  };
  const st = map[estado] || map["Operativo"];
  return <span style={{ background: st.bg, color: st.color, fontWeight: 700, fontSize: "11px", padding: "3px 9px", borderRadius: "20px", whiteSpace: "nowrap" }}>{st.label}</span>;
};

// ---- SVG Icons ----
const SvgBack = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M15 18l-6-6 6-6" stroke="#1a4fc0" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const SvgInfo = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="1.8" />
    <path d="M12 8v4M12 16h.01" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);
const SvgCal = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <rect x="4" y="5" width="16" height="15" rx="2" stroke="#1a4fc0" strokeWidth="1.7" />
    <path d="M4 10h16M8 3v4M16 3v4" stroke="#1a4fc0" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);
const SvgPin = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
    <path d="M12 21s7-6.5 7-11.5A7 7 0 0 0 5 9.5C5 14.5 12 21 12 21z" stroke="#8a92a6" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="12" cy="9.5" r="2.3" stroke="#8a92a6" strokeWidth="1.7" />
  </svg>
);

export default function PanelCliente() {
  useManropeAndBodyReset();

  const [equipos, setEquipos] = useState([]);
  const [sedes, setSedes] = useState([]);
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState("Todos");
  const [pisosSeleccionados, setPisosSeleccionados] = useState([]);
  const [filtroTipoEquipo, setFiltroTipoEquipo] = useState("Todos");
  const [filtroMes, setFiltroMes] = useState("Todos");
  const [obsAbierto, setObsAbierto] = useState(null);
  const [subVista, setSubVista] = useState("equipos");
  const [movimientos, setMovimientos] = useState(null);
  const [kgRecuperadosHistorico, setKgRecuperadosHistorico] = useState(null);
  const [cargandoMovimientos, setCargandoMovimientos] = useState(false);
  const [vistaActual, setVistaActual] = useState("sedes");
  const [sedeActual, setSedeActual] = useState(null);
  const [equipoInfo, setEquipoInfo] = useState(null);
  const [averias, setAverias] = useState([]);
  const [detalleAveria, setDetalleAveria] = useState(null);
  const [listaEmergenciaSede, setListaEmergenciaSede] = useState(null);
  const [historialAverias, setHistorialAverias] = useState(null);
  const [historialAbierto, setHistorialAbierto] = useState(false);
  const [historialSedeFiltro, setHistorialSedeFiltro] = useState(null);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { navigate("/"); return; }
      try {
        const { doc, getDoc } = await import("firebase/firestore");
        let data = null;
        const snapUID = await getDoc(doc(db, "usuarios", user.uid));
        if (snapUID.exists()) { data = snapUID.data(); }
        else {
          const q = query(collection(db, "usuarios"), where("email", "==", user.email));
          const snap = await getDocs(q);
          if (!snap.empty) data = snap.docs[0].data();
        }
        if (data) {
          setUsuario(data);
          const empresa = data.empresa || data.nombre || "";
          const eSnap = await getDocs(query(collection(db, "equipos"), where("cliente", "==", empresa)));
          setEquipos(eSnap.docs.map(d => ({ id: d.id, ...d.data() })));
          try {
            const aSnap = await getDocs(query(collection(db, "averias"), where("cliente", "==", empresa), where("atendida", "==", false)));
            setAverias(aSnap.docs.map(d => ({ id: d.id, ...d.data() })));
          } catch { setAverias([]); }
          try {
            const sSnap = await getDocs(query(collection(db, "sedes"), where("cliente", "==", empresa)));
            const listaSedes = sSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            setSedes(listaSedes);
            const sedeParam = searchParams.get("sede");
            if (sedeParam && listaSedes.length > 0) {
              const sedeRestaurada = listaSedes.find(s => s.id === sedeParam);
              if (sedeRestaurada) { setSedeActual(sedeRestaurada); setVistaActual("equipos"); }
            } else if (listaSedes.length === 0) { setVistaActual("equipos"); }
          } catch { setSedes([]); setVistaActual("equipos"); }
        }
      } catch (err) { console.error("Error cargando datos cliente:", err); }
      setCargando(false);
    });
    return () => unsub();
  }, []);

  const handleLogout = async () => { await signOut(auth); navigate("/"); };

  const abrirDetalleAveria = (averia) => { setDetalleAveria(averia); setListaEmergenciaSede(null); setHistorialAbierto(false); };
  const cerrarDetalleAveria = () => setDetalleAveria(null);
  const abrirEmergencias = (lista) => { if (lista.length === 0) return; if (lista.length === 1) abrirDetalleAveria(lista[0]); else setListaEmergenciaSede(lista); };
  const abrirEmergenciasSede = (sede) => abrirEmergencias(averias.filter(a => a.sede === sede.nombre));

  const marcarAveriaAtendida = async (averiaId) => {
    try {
      const { doc, updateDoc, serverTimestamp } = await import("firebase/firestore");
      await updateDoc(doc(db, "averias", averiaId), { atendida: true, atendidaEn: serverTimestamp() });
      const averiaAtendida = averias.find(a => a.id === averiaId);
      setAverias(prev => prev.filter(a => a.id !== averiaId));
      if (averiaAtendida && historialAverias !== null) setHistorialAverias(prev => [{ ...averiaAtendida, atendida: true, atendidaEn: { toDate: () => new Date() } }, ...prev]);
      cerrarDetalleAveria();
    } catch (e) { console.error(e); }
  };

  const abrirHistorial = async (sede) => {
    setHistorialSedeFiltro(sede || null); setHistorialAbierto(true); setListaEmergenciaSede(null);
    if (historialAverias !== null) return;
    setCargandoHistorial(true);
    try {
      const empresa = usuario?.empresa || usuario?.nombre || "";
      const hSnap = await getDocs(query(collection(db, "averias"), where("cliente", "==", empresa), where("atendida", "==", true)));
      setHistorialAverias(hSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { setHistorialAverias([]); }
    setCargandoHistorial(false);
  };

  const getObs = (e) => {
    const arr = e.observacionesArray || [];
    const norm = arr.map(o => typeof o === "string" ? { texto: o, fecha: "", tecnico: "", causa: "" } : { texto: o.texto || "", fecha: o.fecha || "", tecnico: o.tecnico || "", causa: o.causa || "" });
    const filtradas = norm.filter(o => o?.texto?.trim());
    if (filtradas.length > 0) return filtradas;
    return e.observaciones?.split(/\n|;/).map(o => ({ texto: o.trim(), fecha: "", tecnico: "", causa: "" })).filter(o => o.texto) || [];
  };
  const getRec = (e) => e.recomendacionesArray?.filter(Boolean) || e.recomendaciones?.split(/\n|;/).map(r => r.trim()).filter(Boolean) || [];

  const equiposMostrados = sedeActual ? equipos.filter(e => e.sede === sedeActual.nombre) : equipos;
  const averiasSedeActual = sedeActual ? averias.filter(a => a.sede === sedeActual.nombre) : averias;
  const equiposConGas = equiposMostrados.filter(e => TIPOS_CON_GAS.includes(e.tipoEquipo));

  const cargarMovimientos = async () => {
    if (movimientos !== null || equiposConGas.length === 0) return;
    setCargandoMovimientos(true);
    try {
      const ids = equiposConGas.map(e => e.id);
      const chunks = [];
      for (let i = 0; i < ids.length; i += 10) chunks.push(ids.slice(i, i + 10));
      const resultados = await Promise.all(chunks.map(chunk => getDocs(query(collection(db, "movimientosRefrigerante"), where("equipoId", "in", chunk)))));
      setMovimientos(resultados.flatMap(snap => snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    } catch (e) { setMovimientos([]); }
    setCargandoMovimientos(false);
  };

  const cargarRecuperacionHistorica = async () => {
    if (kgRecuperadosHistorico !== null) return;
    try {
      const filtros = [where("cliente", "==", usuario?.empresa), where("tipo", "==", "recuperacion_baja")];
      if (sedeActual) filtros.push(where("sede", "==", sedeActual.nombre));
      const snap = await getDocs(query(collection(db, "movimientosRefrigerante"), ...filtros));
      setKgRecuperadosHistorico(snap.docs.reduce((acc, d) => acc + (Number(d.data().kg) || 0), 0));
    } catch { setKgRecuperadosHistorico(0); }
  };

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

  const mesesDisponibles = ["Todos", ...new Set(equiposMostrados.map(e => fechaAMesAnio(e.ultimoMantenimiento)).filter(Boolean))];
  const pisos = ["Todos", ...[...new Set(equiposMostrados.map(e => e.piso).filter(Boolean))].sort(ordenarPisos)];
  const tiposEquipo = ["Todos", ...[...new Set(equiposMostrados.map(e => e.tipoEquipo).filter(Boolean))].sort()];

  const equiposFiltrados = equiposMostrados
    .filter(e => {
      const okE = filtroEstado === "Todos" || e.estado === filtroEstado;
      const okP = pisosSeleccionados.length === 0 || pisosSeleccionados.includes(e.piso || "Sin piso");
      const okT = filtroTipoEquipo === "Todos" || (e.tipoEquipo || "Sin tipo") === filtroTipoEquipo;
      const okM = filtroMes === "Todos" || (filtroMes === "Sin fecha" && !e.ultimoMantenimiento) || fechaAMesAnio(e.ultimoMantenimiento) === filtroMes;
      return okE && okP && okT && okM;
    })
    .sort((a, b) => {
      const todosFiltrosVacios = pisosSeleccionados.length === 0 && filtroTipoEquipo === "Todos" && filtroMes === "Todos";
      if (todosFiltrosVacios) return sortPiso(a, b);
      const fa = fechaATimestamp(a.ultimoMantenimiento), fb = fechaATimestamp(b.ultimoMantenimiento);
      if (fb !== fa) return fb - fa;
      return sortPiso(a, b);
    });

  const tot = equiposMostrados.length;
  const op = equiposMostrados.filter(e => e.estado === "Operativo").length;
  const obs = equiposMostrados.filter(e => e.estado === "Operativo con observaciones").length;
  const fs = equiposMostrados.filter(e => e.estado === "Fuera de servicio").length;

  const historialFiltrado = historialAverias
    ? historialAverias.filter(a => !historialSedeFiltro || a.sede === historialSedeFiltro.nombre)
    : [];

  if (cargando) return <div style={s.centro}>Cargando...</div>;

  // ============================================================
  // VISTA: SEDES
  // ============================================================
  if (vistaActual === "sedes") return (
    <div style={s.page}>
      {/* Navbar */}
      <div style={s.navbar}>
        <div style={s.navLogoBox}>
          <img src="/assets/hvac-isotipo-filled.png" alt="HVAC" style={s.navLogoImg} />
        </div>
        <div style={s.navTitle}>{usuario?.empresa}</div>
        <button style={s.btnSalir} onClick={handleLogout}>Salir</button>
      </div>

      {/* Lista de sedes */}
      <div style={s.listaPad}>
        {sedes.length === 0 ? (
          <div style={s.vacioCentro}>No hay sedes registradas</div>
        ) : sedes.map(sede => {
          const eqSede = equipos.filter(e => e.sede === sede.nombre);
          const opS = eqSede.filter(e => e.estado === "Operativo").length;
          const obsS = eqSede.filter(e => e.estado === "Operativo con observaciones").length;
          const fsS = eqSede.filter(e => e.estado === "Fuera de servicio").length;
          const averiasSede = averias.filter(a => a.sede === sede.nombre);
          const av = colorAvatar(sede.nombre);
          return (
            <div key={sede.id} style={s.sedeCard}>
              {/* Header sede */}
              <div style={s.sedeHeaderRow}>
                <div style={{ ...s.sedeAvatar, background: av.bg, color: av.color }}>{initiales(sede.nombre)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={s.sedeNombre}>{sede.nombre}</div>
                  {sede.direccion && <div style={s.sedeDireccion}>{sede.direccion}</div>}
                </div>
              </div>
              {/* Stats grid */}
              <div style={s.miniGrid}>
                <div style={{ ...s.mini, background: "#e6f7ec" }}>
                  <div style={{ ...s.miniNum, color: "#1c7a44" }}>{opS}</div>
                  <div style={{ ...s.miniLbl, color: "#4c8f68" }}>Operativo</div>
                </div>
                <div style={{ ...s.mini, background: "#fff3d6" }}>
                  <div style={{ ...s.miniNum, color: "#a8720b" }}>{obsS}</div>
                  <div style={{ ...s.miniLbl, color: "#a8720b" }}>Con obs.</div>
                </div>
                <div style={{ ...s.mini, background: fsS > 0 ? "#fdeeee" : "#f4f6fb" }}>
                  <div style={{ ...s.miniNum, color: fsS > 0 ? "#a52b2b" : "#9aa2b3" }}>{fsS}</div>
                  <div style={{ ...s.miniLbl, color: fsS > 0 ? "#a52b2b" : "#9aa2b3" }}>Fuera serv.</div>
                </div>
                <div style={{ ...s.mini, background: averiasSede.length > 0 ? "#fdeeee" : "#f4f6fb", cursor: averiasSede.length > 0 ? "pointer" : "default" }}
                  onClick={() => averiasSede.length > 0 && abrirEmergenciasSede(sede)}>
                  <div style={{ ...s.miniNum, color: averiasSede.length > 0 ? "#a52b2b" : "#9aa2b3" }}>{averiasSede.length}</div>
                  <div style={{ ...s.miniLbl, color: averiasSede.length > 0 ? "#a52b2b" : "#9aa2b3" }}>Emergencia</div>
                </div>
              </div>
              <button style={s.btnVerSede} onClick={() => { setSedeActual(sede); setVistaActual("equipos"); setFiltroEstado("Todos"); setPisosSeleccionados([]); }}>
                Ver equipos →
              </button>
            </div>
          );
        })}
      </div>

      {/* Modales */}
      {listaEmergenciaSede && (
        <div style={s.modalOverlay} onClick={() => setListaEmergenciaSede(null)}>
          <div style={s.modalCard} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <span style={s.modalTitulo}>Emergencias</span>
              <button style={s.btnX} onClick={() => setListaEmergenciaSede(null)}>✕</button>
            </div>
            {listaEmergenciaSede.map(a => {
              const eq = equipos.find(e => e.id === a.equipoId);
              return (
                <div key={a.id} style={s.listaItem} onClick={() => abrirDetalleAveria(a)}>
                  <div style={{ flex: 1 }}>
                    <div style={s.listaItemNombre}>{eq?.tipoEquipo || "Equipo"} – {a.ambiente || eq?.ambiente || "-"}</div>
                    <div style={s.listaItemMeta}>Piso {a.piso || eq?.piso || "-"}</div>
                  </div>
                  <span style={{ color: "#8a92a6", fontSize: "16px" }}>›</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {detalleAveria && <ModalAveria averia={detalleAveria} equipos={equipos} onCerrar={cerrarDetalleAveria} onAtender={marcarAveriaAtendida} navigate={navigate} />}
    </div>
  );

  // ============================================================
  // VISTA: EQUIPOS
  // ============================================================
  if (vistaActual === "equipos") return (
    <div style={s.page}>
      {/* Navbar con volver */}
      <div style={s.navbar}>
        <button style={s.btnNavBack} onClick={() => { if (sedes.length > 0) { setSedeActual(null); setVistaActual("sedes"); } else { handleLogout(); } }}>
          <SvgBack />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={s.navTitleSm}>{sedeActual?.nombre || usuario?.empresa}</div>
          <div style={s.navSubtitle}>{usuario?.empresa}</div>
        </div>
        <button style={s.btnSalir} onClick={handleLogout}>Salir</button>
      </div>

      {/* Botones Excel/PDF */}
      <div style={s.actionRow}>
        <button style={s.btnExcel} onClick={() => exportarExcel(usuario?.empresa, equiposFiltrados)}>Excel</button>
        <button style={s.btnPdf} onClick={() => exportarPDF(usuario?.empresa, sedeActual?.nombre, equiposFiltrados)}>PDF</button>
      </div>

      <div style={s.listaPad}>
        {/* Stat cards */}
        <div style={s.statGrid}>
          {[
            { label: "TOTAL EQUIPOS", value: tot, color: "#1a4fc0", bg: "#e5f0ff", border: "#c3d6fb", filtro: "Todos" },
            { label: "OPERATIVOS", value: op, color: "#1c7a44", bg: "#e6f7ec", border: "#c3ecd2", filtro: "Operativo" },
            { label: "CON OBS.", value: obs, color: "#a8720b", bg: "#fff8e6", border: "#f3dfa3", filtro: "Operativo con observaciones" },
            { label: "FUERA SERV.", value: fs, color: "#a52b2b", bg: "#fdeeee", border: "#f6d3d3", filtro: "Fuera de servicio" },
          ].map(st => (
            <div key={st.filtro} onClick={() => setFiltroEstado(filtroEstado === st.filtro ? "Todos" : st.filtro)}
              style={{ background: st.bg, border: `1.5px solid ${filtroEstado === st.filtro ? st.color : st.border}`, borderRadius: "14px", padding: "16px 10px", display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", textAlign: "center", cursor: "pointer" }}>
              <div style={{ fontWeight: 800, fontSize: "26px", color: st.color }}>{st.value}</div>
              <div style={{ fontWeight: 700, fontSize: "10.5px", color: "#6b7488", letterSpacing: "0.05em" }}>{st.label}</div>
            </div>
          ))}
        </div>

        {/* Título lista */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ fontWeight: 800, fontSize: "15px", color: "#12245e" }}>Lista de equipos</div>
          <span style={s.countChip}>{equiposFiltrados.length} equipos</span>
        </div>

        {/* Filtros */}
        <div style={s.filtrosRow}>
          <select style={s.filterSel} value={filtroTipoEquipo} onChange={e => setFiltroTipoEquipo(e.target.value)}>
            {tiposEquipo.map(t => <option key={t} value={t}>{t === "Todos" ? "Todos los tipos" : t}</option>)}
          </select>
          <select style={s.filterSel} value={filtroMes} onChange={e => setFiltroMes(e.target.value)}>
            {mesesDisponibles.map(m => <option key={m}>{m}</option>)}
          </select>
        </div>

        {/* Lista de equipos */}
        {equiposFiltrados.map((equipo, i) => {
          const obsArr = getObs(equipo);
          const recArr = getRec(equipo);
          const abierto = obsAbierto === equipo.id;
          return (
            <div key={equipo.id} style={s.equipoCard}>
              {/* Row top */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700, color: "#8a92a6", fontSize: "12.5px" }}>#{i + 1}</span>
                  {equipo.codigo && <span style={s.codigoChip}>{equipo.codigo}</span>}
                  <span style={{ color: "#9aa2b3", fontWeight: 600, fontSize: "12px" }}>Piso {equipo.piso || "—"}</span>
                </div>
                {getBadge(equipo.estado)}
              </div>
              {/* Ambiente */}
              <div style={{ fontWeight: 700, fontSize: "14.5px", color: "#0f1b3d" }}>{equipo.ambiente || "—"}</div>
              {/* Tipo · Marca */}
              <div style={{ fontWeight: 600, fontSize: "12.5px", color: "#26314d" }}>{equipo.tipoEquipo} · {equipo.marca} {equipo.modelo}</div>
              {/* Último mantenimiento */}
              {equipo.ultimoMantenimiento && (
                <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                  <SvgCal />
                  <span style={{ fontSize: "12px", color: "#6b7488", fontWeight: 600 }}>{equipo.ultimoMantenimiento}</span>
                </div>
              )}
              {/* Botones */}
              <div style={{ display: "flex", gap: "8px" }}>
                <button style={s.btnInfo} onClick={() => { setEquipoInfo(equipo); setVistaActual("info"); }}>Info</button>
                <button style={s.btnProtocolo} onClick={() => navigate(`/protocolo?equipo=${equipo.id}`)}>Protocolo</button>
                {obsArr.length > 0 && (
                  <button style={s.btnObs} onClick={() => setObsAbierto(abierto ? null : equipo.id)}>
                    Obs {obsArr.length}
                  </button>
                )}
              </div>
              {/* Panel observaciones expandible */}
              {abierto && (
                <div style={s.obsPanel}>
                  <div style={{ fontWeight: 700, fontSize: "11px", color: "#1a4fc0", marginBottom: "8px", letterSpacing: "0.05em" }}>OBSERVACIÓN · CAUSA · RECOMENDACIÓN</div>
                  {obsArr.map((o, idx) => (
                    <div key={idx} style={s.obsItem}>
                      <div style={s.obsCol1}><div style={s.obsLabel}>Observación</div><div style={s.obsObs}>{o.texto}</div></div>
                      <div style={s.obsCol2}><div style={s.obsLabel}>Causa</div><div style={s.obsCausa}>{o.causa || "—"}</div></div>
                      <div style={s.obsCol3}><div style={s.obsLabel}>Recomendación</div><div style={s.obsRec}>{recArr[idx] ? (typeof recArr[idx] === "string" ? recArr[idx] : recArr[idx]?.texto || "—") : "—"}</div></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modales */}
      {detalleAveria && <ModalAveria averia={detalleAveria} equipos={equipos} onCerrar={cerrarDetalleAveria} onAtender={marcarAveriaAtendida} navigate={navigate} />}
    </div>
  );

  // ============================================================
  // VISTA: INFO EQUIPO
  // ============================================================
  if (vistaActual === "info" && equipoInfo) {
    const obsArr = getObs(equipoInfo);
    const recArr = getRec(equipoInfo);
    const datosGrid = [
      ["Marca", equipoInfo.marca], ["Modelo", equipoInfo.modelo],
      ["Código", equipoInfo.codigo || "—"], ["N° Serie", equipoInfo.serie || "—"],
      ["Capacidad", equipoInfo.capacidad ? `${equipoInfo.capacidad} BTU` : "—"],
      ["Tipo refrigerante", equipoInfo.tipoRefrigerante || "—"],
      ["Voltaje", equipoInfo.voltaje ? `${equipoInfo.voltaje}V` : "—"],
      ["Amperaje", equipoInfo.amperaje ? `${equipoInfo.amperaje}A` : "—"],
      ["Fases", equipoInfo.fases || "—"], ["Tipo equipo", equipoInfo.tipoEquipo || "—"],
    ];
    return (
      <div style={s.page}>
        <div style={s.navbar}>
          <button style={s.btnNavBack} onClick={() => setVistaActual("equipos")}><SvgBack /></button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={s.navTitleSm}>Info del equipo</div>
            <div style={s.navSubtitle}>{sedeActual?.nombre || usuario?.empresa}</div>
          </div>
        </div>

        <div style={s.listaPad}>
          {/* Card equipo */}
          <div style={s.infoCard}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={s.infoIconBox}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="6" width="18" height="8" rx="2" stroke="#1a4fc0" strokeWidth="1.7" />
                  <path d="M6 9.5h.01M9 9.5h.01M12 9.5h.01M15 9.5h.01M18 9.5h.01" stroke="#1a4fc0" strokeWidth="1.7" strokeLinecap="round" />
                  <path d="M7 17v2M17 17v2" stroke="#1a4fc0" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: "15px", color: "#12245e" }}>{equipoInfo.marca} {equipoInfo.modelo}</div>
                {getBadge(equipoInfo.estado)}
              </div>
            </div>
            <div style={{ borderTop: "1px solid #eef1f6", paddingTop: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
              <SvgPin />
              <span style={{ fontWeight: 600, fontSize: "13px", color: "#26314d" }}>Piso {equipoInfo.piso} · {equipoInfo.ambiente}</span>
            </div>
          </div>

          {/* Datos técnicos */}
          <div style={s.infoCard}>
            <div style={s.infoSecTitulo}>DATOS DEL EQUIPO</div>
            <div style={s.datosGrid}>
              {datosGrid.map(([label, value]) => (
                <div key={label}>
                  <div style={s.datoLabel}>{label}</div>
                  <div style={s.datoValor}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Último mantenimiento */}
          <div style={s.infoCard}>
            <div style={s.infoSecTitulo}>ÚLTIMO MANTENIMIENTO</div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <SvgCal />
              <span style={{ fontWeight: 700, fontSize: "14px", color: "#12245e" }}>{equipoInfo.ultimoMantenimiento || "Sin registro"}</span>
            </div>
          </div>

          {/* Observaciones */}
          {obsArr.length > 0 && (
            <div style={s.infoCard}>
              <div style={s.infoSecTitulo}>OBSERVACIÓN · CAUSA · RECOMENDACIÓN</div>
              {obsArr.map((o, idx) => (
                <div key={idx} style={s.obsItem}>
                  <div style={s.obsCol1}><div style={s.obsLabel}>Observación</div><div style={s.obsObs}>{o.texto}</div></div>
                  <div style={s.obsCol2}><div style={s.obsLabel}>Causa</div><div style={s.obsCausa}>{o.causa || "—"}</div></div>
                  <div style={s.obsCol3}><div style={s.obsLabel}>Recomendación</div><div style={s.obsRec}>{recArr[idx] ? (typeof recArr[idx] === "string" ? recArr[idx] : recArr[idx]?.texto || "—") : "—"}</div></div>
                </div>
              ))}
            </div>
          )}

          <button style={s.btnVolver} onClick={() => setVistaActual("equipos")}>Volver a la lista</button>
        </div>
      </div>
    );
  }

  return <div style={s.centro}>Cargando...</div>;
}

// ---- Modal Avería ----
function ModalAveria({ averia, equipos, onCerrar, onAtender, navigate }) {
  const eq = equipos.find(e => e.id === averia.equipoId);
  const atendida = !!averia.atendida;
  return (
    <div style={s.modalOverlay} onClick={onCerrar}>
      <div style={{ ...s.modalCard, border: `1px solid ${atendida ? "#c3ecd2" : "#f6d3d3"}` }} onClick={e => e.stopPropagation()}>
        <div style={s.modalHeader}>
          <div>
            <div style={{ fontWeight: 800, fontSize: "14px", color: "#0f1b3d" }}>{eq?.tipoEquipo || "Equipo"} – {(averia.ambiente || eq?.ambiente || "").toLowerCase()}</div>
            <div style={{ fontWeight: 600, fontSize: "12px", color: "#8a92a6", marginTop: "2px" }}>Piso {averia.piso || eq?.piso || "-"} · {eq?.marca || "-"}</div>
          </div>
          <span style={{ background: atendida ? "#e6f7ec" : "#fdeeee", color: atendida ? "#1c7a44" : "#a52b2b", fontWeight: 700, fontSize: "11px", padding: "4px 10px", borderRadius: "20px" }}>
            {atendida ? "Atendida" : "Emergencia"}
          </span>
        </div>
        <div style={{ background: atendida ? "#e6f7ec" : "#fdeeee", border: `1px solid ${atendida ? "#c3ecd2" : "#f6d3d3"}`, borderRadius: "12px", padding: "12px", marginTop: "12px" }}>
          <div style={{ fontWeight: 600, fontSize: "13px", color: atendida ? "#1c7a44" : "#a52b2b" }}>{averia.mensaje}</div>
          <div style={{ fontSize: "11px", color: "#8a92a6", marginTop: "4px" }}>{averia.fecha?.toDate ? averia.fecha.toDate().toLocaleString("es-PE") : ""}</div>
        </div>
        {!atendida && (
          <div style={{ display: "flex", gap: "8px", marginTop: "14px" }}>
            {eq && <button style={s.btnInfo} onClick={() => navigate(`/protocolo?equipo=${eq.id}`)}>Ver protocolo</button>}
            <button style={{ ...s.btnInfo, background: "#1c9a53" }} onClick={() => onAtender(averia.id)}>Marcar atendida</button>
          </div>
        )}
        <button style={{ ...s.btnVolver, marginTop: "12px" }} onClick={onCerrar}>Cerrar</button>
      </div>
    </div>
  );
}

const s = {
  page: { width: "100%", minHeight: "100vh", background: "#eef1f6", fontFamily: FONT, boxSizing: "border-box" },
  centro: { textAlign: "center", padding: "3rem", fontSize: "15px", color: "#8a92a6", fontFamily: FONT },
  // Navbar
  navbar: { background: "#ffffff", borderBottom: "1px solid #e7ebf3", padding: "14px 16px", display: "flex", alignItems: "center", gap: "10px", position: "sticky", top: 0, zIndex: 10 },
  navLogoBox: { width: "38px", height: "38px", minWidth: "38px", borderRadius: "10px", background: "#1a4fc0", display: "flex", alignItems: "center", justifyContent: "center" },
  navLogoImg: { width: "22px", height: "22px", objectFit: "contain", filter: "brightness(0) invert(1)" },
  navTitle: { flex: 1, fontWeight: 800, fontSize: "14.5px", color: "#12245e" },
  navTitleSm: { fontWeight: 800, fontSize: "13.5px", color: "#12245e" },
  navSubtitle: { fontWeight: 600, fontSize: "11px", color: "#9aa2b3" },
  btnNavBack: { background: "#f4f6fb", border: "1px solid #e7ebf3", borderRadius: "9px", width: "36px", height: "36px", minWidth: "36px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
  btnSalir: { background: "#f4f6fb", color: "#6b7488", border: "1px solid #e7ebf3", borderRadius: "9px", padding: "8px 14px", fontFamily: FONT, fontWeight: 700, fontSize: "12.5px", cursor: "pointer" },
  // Action row
  actionRow: { padding: "10px 14px", display: "flex", gap: "8px", background: "#ffffff", borderBottom: "1px solid #e7ebf3" },
  btnExcel: { flex: 1, background: "#e6f7ec", color: "#1c7a44", border: "none", borderRadius: "10px", padding: "9px 12px", fontFamily: FONT, fontWeight: 700, fontSize: "12.5px", cursor: "pointer" },
  btnPdf: { flex: 1, background: "#fdeeee", color: "#a52b2b", border: "none", borderRadius: "10px", padding: "9px 12px", fontFamily: FONT, fontWeight: 700, fontSize: "12.5px", cursor: "pointer" },
  // Lista
  listaPad: { padding: "16px 14px", display: "flex", flexDirection: "column", gap: "14px" },
  vacioCentro: { textAlign: "center", color: "#aab1c2", fontStyle: "italic", padding: "40px 0" },
  // Sede card
  sedeCard: { background: "#ffffff", border: "1px solid #e7ebf3", borderRadius: "18px", padding: "18px", display: "flex", flexDirection: "column", gap: "14px" },
  sedeHeaderRow: { display: "flex", alignItems: "flex-start", gap: "12px" },
  sedeAvatar: { width: "44px", height: "44px", minWidth: "44px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "14px" },
  sedeNombre: { fontWeight: 800, fontSize: "15px", color: "#12245e" },
  sedeDireccion: { fontWeight: 600, fontSize: "12px", color: "#9aa2b3", marginTop: "2px" },
  miniGrid: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "8px" },
  mini: { borderRadius: "12px", padding: "10px 4px", textAlign: "center" },
  miniNum: { fontWeight: 800, fontSize: "17px" },
  miniLbl: { fontWeight: 700, fontSize: "9.5px", marginTop: "2px" },
  btnVerSede: { color: "#1a4fc0", fontWeight: 700, fontSize: "13.5px", background: "none", border: "none", textAlign: "left", cursor: "pointer", padding: 0, fontFamily: FONT },
  // Stat grid
  statGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" },
  countChip: { background: "#e5f0ff", color: "#1a4fc0", fontWeight: 700, fontSize: "11.5px", padding: "3px 9px", borderRadius: "20px" },
  filtrosRow: { display: "flex", gap: "8px", flexWrap: "wrap" },
  filterSel: { flex: 1, minWidth: "120px", border: "1px solid #dfe6f5", borderRadius: "10px", padding: "9px 10px", fontFamily: FONT, fontSize: "12.5px", color: "#26314d", background: "#ffffff" },
  // Equipo card
  equipoCard: { background: "#ffffff", border: "1px solid #e7ebf3", borderRadius: "16px", padding: "14px", display: "flex", flexDirection: "column", gap: "8px" },
  codigoChip: { background: "#e5f0ff", color: "#1a4fc0", fontWeight: 700, fontSize: "11.5px", padding: "3px 8px", borderRadius: "7px" },
  btnInfo: { flex: 1, background: "#1a4fc0", color: "#ffffff", border: "none", borderRadius: "9px", padding: "10px 8px", fontFamily: FONT, fontWeight: 700, fontSize: "12.5px", cursor: "pointer" },
  btnProtocolo: { flex: 1, background: "#a52b2b", color: "#ffffff", border: "none", borderRadius: "9px", padding: "10px 8px", fontFamily: FONT, fontWeight: 700, fontSize: "12.5px", cursor: "pointer" },
  btnObs: { background: "#fff8e6", color: "#a8720b", border: "1px solid #f3dfa3", borderRadius: "9px", padding: "10px 12px", fontFamily: FONT, fontWeight: 700, fontSize: "12.5px", cursor: "pointer" },
  // Obs panel
  obsPanel: { background: "#f9fafc", border: "1px solid #eef1f6", borderRadius: "12px", padding: "12px", display: "flex", flexDirection: "column", gap: "10px" },
  obsItem: { display: "flex", gap: "6px" },
  obsCol1: { flex: 2, background: "#fff8e6", borderRadius: "8px", padding: "8px 10px" },
  obsCol2: { flex: 1.5, background: "#fdeeee", borderRadius: "8px", padding: "8px 10px" },
  obsCol3: { flex: 2, background: "#e6f7ec", borderRadius: "8px", padding: "8px 10px" },
  obsLabel: { fontWeight: 700, fontSize: "10px", color: "#8a92a6", marginBottom: "3px", letterSpacing: "0.04em" },
  obsObs: { fontWeight: 600, fontSize: "12px", color: "#8a5b0a", lineHeight: 1.4 },
  obsCausa: { fontWeight: 600, fontSize: "12px", color: "#a52b2b", lineHeight: 1.4 },
  obsRec: { fontWeight: 600, fontSize: "12px", color: "#1c7a44", lineHeight: 1.4 },
  // Info equipo
  infoCard: { background: "#ffffff", border: "1px solid #e7ebf3", borderRadius: "18px", padding: "18px", display: "flex", flexDirection: "column", gap: "12px" },
  infoIconBox: { width: "48px", height: "48px", minWidth: "48px", borderRadius: "14px", background: "#e5f0ff", display: "flex", alignItems: "center", justifyContent: "center" },
  infoSecTitulo: { fontWeight: 800, fontSize: "13px", color: "#1a4fc0", letterSpacing: "0.04em" },
  datosGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" },
  datoLabel: { fontWeight: 600, fontSize: "10.5px", color: "#8a92a6", textTransform: "uppercase" },
  datoValor: { fontWeight: 700, fontSize: "13.5px", color: "#12245e", marginTop: "3px" },
  btnVolver: { width: "100%", boxSizing: "border-box", background: "#f4f6fb", color: "#6b7488", border: "1px solid #e7ebf3", borderRadius: "12px", padding: "13px 16px", fontFamily: FONT, fontWeight: 700, fontSize: "13.5px", cursor: "pointer" },
  // Modal
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 999, display: "flex", alignItems: "flex-end", justifyContent: "center" },
  modalCard: { width: "100%", maxWidth: "480px", background: "#ffffff", borderRadius: "20px 20px 0 0", padding: "20px", maxHeight: "85vh", overflowY: "auto", fontFamily: FONT },
  modalHeader: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "10px" },
  modalTitulo: { fontWeight: 800, fontSize: "15px", color: "#0f1b3d" },
  btnX: { background: "none", border: "none", fontSize: "16px", color: "#6b7488", cursor: "pointer", padding: "2px 6px" },
  listaItem: { display: "flex", alignItems: "center", gap: "10px", padding: "12px 0", borderBottom: "1px solid #eef1f6", cursor: "pointer" },
  listaItemNombre: { fontWeight: 700, fontSize: "13px", color: "#0f1b3d" },
  listaItemMeta: { fontWeight: 600, fontSize: "11.5px", color: "#8a92a6", marginTop: "2px" },
};
