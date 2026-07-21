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
    { bg: "#e5f0ff", color: "#1a4fc0" },
    { bg: "#e6f7ec", color: "#1c7a44" },
    { bg: "#f1e9fb", color: "#7c3fd8" },
    { bg: "#fff3d6", color: "#a8720b" },
    { bg: "#fdeeee", color: "#a52b2b" },
    { bg: "#e0f4f2", color: "#0d7a6c" },
  ];
  let sum = 0;
  for (let i = 0; i < (nombre || "").length; i++) sum += nombre.charCodeAt(i);
  return colores[sum % colores.length];
};

const SvgHistorial = ({ color = "currentColor" }) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
    <path d="M3 12a9 9 0 1 0 3-6.7" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <path d="M3 4v5h5" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 8v4l3 2" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

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

const agruparPorPiso = (equipos) => {
  const porPiso = {};
  equipos.forEach(e => { const p = e.piso || "Sin piso"; if (!porPiso[p]) porPiso[p] = []; porPiso[p].push(e); });
  return porPiso;
};

const exportarExcel = (cliente, equipos) => {
  const porPiso = agruparPorPiso(equipos);
  const pisos = Object.keys(porPiso).sort(ordenarPisos);
  let item = 1;
  let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
  <head><meta charset="UTF-8"><style>
    body{font-family:Arial;font-size:9pt;}.titulo{background:#1A4FC0;color:white;font-size:14pt;font-weight:bold;}
    .header{background:#1a4fc0;color:white;font-weight:bold;font-size:9pt;text-align:center;}
    .piso{background:#e5f0ff;color:#1a4fc0;font-weight:bold;font-size:9pt;}
    .fila{font-size:9pt;}.fila-alt{background:#F8F9FA;font-size:9pt;}
    .op{background:#e6f7ec;color:#1c7a44;font-weight:bold;text-align:center;}
    .obs{background:#fff8e6;color:#8a5b0a;font-weight:bold;text-align:center;}
    .fs{background:#fdeeee;color:#a52b2b;font-weight:bold;text-align:center;}
    .cod{background:#e5f0ff;color:#1a4fc0;font-weight:bold;text-align:center;font-family:monospace;}
    td{border:1px solid #E0E0E0;padding:4px 6px;}
  </style></head><body><table>
  <tr><td colspan="13" class="titulo">HVAC - Sistema de Mantenimiento</td></tr>
  <tr><td colspan="3">Cliente: ${cliente}</td><td colspan="3">Generado: ${new Date().toLocaleDateString("es-PE")}</td><td colspan="3">Total: ${equipos.length} equipos</td><td colspan="4"></td></tr>
  <tr><td colspan="13"></td></tr>
  <tr><td class="header">#</td><td class="header">Codigo</td><td class="header">Piso</td><td class="header">Ambiente</td><td class="header">Tipo</td><td class="header">Marca</td><td class="header">Modelo</td><td class="header">Serie</td><td class="header">Capacidad</td><td class="header">Refrigerante</td><td class="header">Voltaje</td><td class="header">Estado</td><td class="header">Observaciones</td></tr>`;
  pisos.forEach(p => {
    html += `<tr><td colspan="13" class="piso">PISO: ${p.toUpperCase()}</td></tr>`;
    porPiso[p].forEach((e, idx) => {
      const ec = e.estado === "Operativo" ? "op" : e.estado === "Operativo con observaciones" ? "obs" : "fs";
      html += `<tr class="${idx % 2 === 0 ? "fila" : "fila-alt"}"><td>${item++}</td><td class="cod">${e.codigo || "-"}</td><td>${e.piso || "-"}</td><td>${e.ambiente || "-"}</td><td>${e.tipoEquipo || "-"}</td><td>${e.marca || "-"}</td><td>${e.modelo || "-"}</td><td>${e.serie || "-"}</td><td>${e.capacidad || "-"}</td><td>${e.tipoRefrigerante || "-"}</td><td>${e.voltaje ? e.voltaje + "V" : "-"}</td><td class="${ec}">${e.estado || "Operativo"}</td><td>${e.observaciones || "-"}</td></tr>`;
    });
  });
  html += `</table></body></html>`;
  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url;
  a.download = `equipos-${cliente.replace(/\s+/g, "-")}-${new Date().getFullYear()}.xls`;
  a.click(); URL.revokeObjectURL(url);
};

const getObsPDF = (e) => {
  const arr = e.observacionesArray || [];
  const norm = arr.map(o => typeof o === "string"
    ? { texto: o, fecha: "", tecnico: "", causa: "" }
    : { texto: o.texto || "", fecha: o.fecha || "", tecnico: o.tecnico || "", causa: o.causa || "" }
  );
  const filtradas = norm.filter(o => o?.texto?.trim());
  if (filtradas.length > 0) return filtradas;
  return e.observaciones?.split(/\n|;/).map(o => ({ texto: o.trim(), fecha: "", tecnico: "", causa: "" })).filter(o => o.texto) || [];
};

const getRecPDF = (e) => e.recomendacionesArray?.filter(Boolean) ||
  e.recomendaciones?.split(/\n|;/).map(r => r.trim()).filter(Boolean) || [];

const exportarPDF = (cliente, sede, equipos) => {
  const pdf = new jsPDF("l", "mm", "a4");
  const M = 10, PW = 297, CW = PW - M * 2;
  let y = 15;
  pdf.setFillColor(26, 79, 192); pdf.rect(0, 0, PW, 20, "F");
  pdf.setFontSize(13); pdf.setFont("helvetica", "bold"); pdf.setTextColor(255, 255, 255);
  pdf.text("HVAC - Sistema de Mantenimiento", M, 13);
  pdf.setFontSize(10); pdf.setFont("helvetica", "normal");
  const sedeTxt = sede ? `   Sede: (${sede.toUpperCase()})` : "";
  pdf.text(`Cliente: ${cliente}${sedeTxt}   Generado: ${new Date().toLocaleDateString("es-PE")}   Total: ${equipos.length} equipos`, M, 19);
  y = 28;

  const check = (h) => { if (y + h > 195) { pdf.addPage(); y = 15; } };

  const badge = (estado) => {
    if (estado === "Operativo") return { bg: [230, 247, 236], color: [28, 122, 68], txt: "Operativo" };
    if (estado === "Operativo con observaciones") return { bg: [255, 248, 230], color: [138, 91, 10], txt: "Con obs." };
    return { bg: [253, 238, 238], color: [165, 43, 43], txt: estado || "Operativo" };
  };

  const porPiso = agruparPorPiso(equipos); let item = 1;
  Object.keys(porPiso).sort(ordenarPisos).forEach(p => {
    check(10);
    pdf.setFillColor(229, 240, 255); pdf.rect(M, y, CW, 6, "F");
    pdf.setFontSize(8.5); pdf.setFont("helvetica", "bold"); pdf.setTextColor(18, 36, 94);
    pdf.text(`PISO: ${p.toUpperCase()}`, M + 3, y + 4.2);
    y += 9;

    porPiso[p].forEach((e) => {
      const obs = getObsPDF(e); const rec = getRecPDF(e);
      const alturaFicha = 9;
      const alturaObs = obs.length === 0 ? 6 : 4 + obs.length * 8;
      const alturaTotal = 6 + alturaFicha + alturaObs + 4;
      check(alturaTotal + 4);

      const yTop = y;
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(8); pdf.setTextColor(30, 30, 30);
      pdf.text(String(item++) + ".", M, y + 3);
      pdf.text(`${e.ambiente || "-"}`, M + 8, y + 3);
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(7.5); pdf.setTextColor(90, 90, 90);
      pdf.text(`${e.tipoEquipo || "-"} \u00b7 ${e.marca || "-"}`, M + 8 + pdf.getTextWidth(`${e.ambiente || "-"}`) + 4, y + 3);
      const bd = badge(e.estado);
      pdf.setFillColor(...bd.bg); pdf.roundedRect(M + CW - 32, y - 1, 32, 5, 1.5, 1.5, "F");
      pdf.setFontSize(7); pdf.setTextColor(...bd.color);
      pdf.text(bd.txt, M + CW - 16, y + 2.5, { align: "center" });
      y += 6;

      pdf.setFillColor(248, 249, 250); pdf.rect(M, y, CW, alturaFicha, "F");
      const campos = [
        ["Modelo", e.modelo || "-"], ["Serie", e.serie || "-"], ["Capacidad", e.capacidad ? `${e.capacidad} BTU` : "-"],
        ["Refrig.", e.tipoRefrigerante || "-"], ["Voltaje", e.voltaje ? `${e.voltaje}V` : "-"], ["Amperaje", e.amperaje ? `${e.amperaje}A` : "-"],
      ];
      const fcw = CW / 6;
      campos.forEach(([l, v], i) => {
        const cx = M + i * fcw + 3;
        pdf.setFont("helvetica", "normal"); pdf.setFontSize(6); pdf.setTextColor(140, 140, 140);
        pdf.text(l, cx, y + 3.5);
        pdf.setFont("helvetica", "bold"); pdf.setFontSize(7); pdf.setTextColor(30, 30, 30);
        pdf.text(String(v), cx, y + 6.8);
      });
      y += alturaFicha + 3;

      if (obs.length === 0) {
        pdf.setFont("helvetica", "italic"); pdf.setFontSize(7.5); pdf.setTextColor(160, 160, 160);
        pdf.text("Sin observaciones registradas", M, y + 2);
        y += 6;
      } else {
        const col0 = 8, colW = (CW - col0) / 3;
        pdf.setFont("helvetica", "normal"); pdf.setFontSize(6); pdf.setTextColor(150, 150, 150);
        pdf.text("Observaci\u00f3n", M + col0 + 2, y);
        pdf.text("Causa", M + col0 + colW + 2, y);
        pdf.text("Recomendaci\u00f3n", M + col0 + colW * 2 + 2, y);
        y += 2.5;
        obs.forEach((o, i) => {
          const rowH = 7.5;
          pdf.setFontSize(6.5); pdf.setTextColor(130, 130, 130);
          pdf.text(String(i + 1), M, y + 4);
          pdf.setFillColor(255, 248, 230); pdf.rect(M + col0, y, colW - 2, rowH, "F");
          pdf.setFillColor(253, 238, 238); pdf.rect(M + col0 + colW, y, colW - 2, rowH, "F");
          pdf.setFillColor(230, 247, 236); pdf.rect(M + col0 + colW * 2, y, colW - 2, rowH, "F");
          pdf.setFont("helvetica", "normal"); pdf.setFontSize(6.8);
          pdf.setTextColor(138, 91, 10); pdf.text(pdf.splitTextToSize(o.texto, colW - 6).slice(0, 2), M + col0 + 2, y + 3);
          pdf.setTextColor(165, 43, 43); pdf.text(pdf.splitTextToSize(o.causa || "\u2014", colW - 6).slice(0, 2), M + col0 + colW + 2, y + 3);
          const recTxt = rec[i] ? (typeof rec[i] === "string" ? rec[i] : rec[i].texto || "\u2014") : "\u2014";
          pdf.setTextColor(28, 122, 68); pdf.text(pdf.splitTextToSize(recTxt, colW - 6).slice(0, 2), M + col0 + colW * 2 + 2, y + 3);
          y += rowH + 1;
        });
      }

      y = yTop + alturaTotal;
      pdf.setDrawColor(230, 230, 230); pdf.line(M, y - 2, M + CW, y - 2);
    });
  });

  pdf.setFontSize(8); pdf.setTextColor(150, 150, 150);
  pdf.text(`HVAC Sistema de Mantenimiento`, M, 205);
  pdf.save(`equipos-${cliente.replace(/\s+/g, "-")}-${new Date().getFullYear()}.pdf`);
};

export default function PanelCliente() {
  useManropeAndBodyReset();

  const [equipos, setEquipos] = useState([]);
  const [sedes, setSedes] = useState([]);
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState("Todos");
  const [pisosSeleccionados, setPisosSeleccionados] = useState([]);
  const [pisoDropdownAbierto, setPisoDropdownAbierto] = useState(false);
  const [filtroTipoEquipo, setFiltroTipoEquipo] = useState("Todos");
  const [filtroMes, setFiltroMes] = useState("Todos");
  const [obsAbierto, setObsAbierto] = useState(null);
  const [subVista, setSubVista] = useState("equipos");
  const [movimientos, setMovimientos] = useState(null);
  const [kgRecuperadosHistorico, setKgRecuperadosHistorico] = useState(null);
  const [cargandoMovimientos, setCargandoMovimientos] = useState(false);
  const [historialesEquipo, setHistorialesEquipo] = useState({});
  const [historialEquipoAbierto, setHistorialEquipoAbierto] = useState({});
  const [cargandoHistorialEquipo, setCargandoHistorialEquipo] = useState({});
  const [vistaActual, setVistaActual] = useState("sedes");
  const [sedeActual, setSedeActual] = useState(null);
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
        if (snapUID.exists()) {
          data = snapUID.data();
        } else {
          const q = query(collection(db, "usuarios"), where("email", "==", user.email));
          const snap = await getDocs(q);
          if (!snap.empty) data = snap.docs[0].data();
        }

        if (data) {
          setUsuario(data);
          const empresa = data.empresa || data.nombre || "";

          const eSnap = await getDocs(query(collection(db, "equipos"), where("cliente", "==", empresa)));
          const lista = eSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          setEquipos(lista);

          try {
            const aSnap = await getDocs(query(collection(db, "averias"), where("cliente", "==", empresa), where("atendida", "==", false)));
            setAverias(aSnap.docs.map(d => ({ id: d.id, ...d.data() })));
          } catch {
            setAverias([]);
          }

          try {
            const sSnap = await getDocs(query(collection(db, "sedes"), where("cliente", "==", empresa)));
            const listaSedes = sSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            setSedes(listaSedes);

            const sedeParam = searchParams.get("sede");
            if (sedeParam && listaSedes.length > 0) {
              const sedeRestaurada = listaSedes.find(s => s.id === sedeParam);
              if (sedeRestaurada) {
                setSedeActual(sedeRestaurada);
                setVistaActual("equipos");
              } else {
                if (listaSedes.length === 0) setVistaActual("equipos");
              }
            } else {
              if (listaSedes.length === 0) setVistaActual("equipos");
            }
          } catch {
            setSedes([]);
            setVistaActual("equipos");
          }
        }
      } catch (err) {
        console.error("Error cargando datos cliente:", err);
      }
      setCargando(false);
    });
    return () => unsub();
  }, []);

  const handleLogout = async () => { await signOut(auth); navigate("/"); };

  const abrirDetalleAveria = (averia) => {
    setDetalleAveria(averia);
    setListaEmergenciaSede(null);
    setHistorialAbierto(false);
  };
  const cerrarDetalleAveria = () => setDetalleAveria(null);

  const abrirEmergencias = (lista) => {
    if (lista.length === 0) return;
    if (lista.length === 1) abrirDetalleAveria(lista[0]);
    else setListaEmergenciaSede(lista);
  };
  const abrirEmergenciasSede = (sede) => abrirEmergencias(averias.filter(a => a.sede === sede.nombre));

  const marcarAveriaAtendida = async (averiaId) => {
    try {
      const { doc, updateDoc, serverTimestamp } = await import("firebase/firestore");
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

  const abrirHistorial = async (sede) => {
    setHistorialSedeFiltro(sede || null);
    setHistorialAbierto(true);
    setListaEmergenciaSede(null);
    if (historialAverias !== null) return;
    setCargandoHistorial(true);
    try {
      const empresa = usuario?.empresa || usuario?.nombre || "";
      const hSnap = await getDocs(query(collection(db, "averias"), where("cliente", "==", empresa), where("atendida", "==", true)));
      setHistorialAverias(hSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error("Error cargando historial de averías:", e);
      setHistorialAverias([]);
    }
    setCargandoHistorial(false);
  };

  const getObs = (e) => {
    const arr = e.observacionesArray || [];
    const norm = arr.map(o => typeof o === "string"
      ? { texto: o, fecha: "", tecnico: "", causa: "" }
      : { texto: o.texto || "", fecha: o.fecha || "", tecnico: o.tecnico || "", causa: o.causa || "" }
    );
    const filtradas = norm.filter(o => o?.texto?.trim());
    if (filtradas.length > 0) return filtradas;
    return e.observaciones?.split(/\n|;/).map(o => ({ texto: o.trim(), fecha: "", tecnico: "", causa: "" })).filter(o => o.texto) || [];
  };

  const getRec = (e) => e.recomendacionesArray?.filter(Boolean) ||
    e.recomendaciones?.split(/\n|;/).map(r => r.trim()).filter(Boolean) || [];

  const equiposMostrados = sedeActual
    ? equipos.filter(e => e.sede === sedeActual.nombre)
    : equipos;

  const averiasSedeActual = sedeActual
    ? averias.filter(a => a.sede === sedeActual.nombre)
    : averias;

  const equiposConGas = equiposMostrados.filter(e => TIPOS_CON_GAS.includes(e.tipoEquipo));

  const cargarMovimientos = async () => {
    if (movimientos !== null || equiposConGas.length === 0) return;
    setCargandoMovimientos(true);
    try {
      const ids = equiposConGas.map(e => e.id);
      const chunks = [];
      for (let i = 0; i < ids.length; i += 10) chunks.push(ids.slice(i, i + 10));
      const resultados = await Promise.all(
        chunks.map(chunk => getDocs(query(collection(db, "movimientosRefrigerante"), where("equipoId", "in", chunk))))
      );
      setMovimientos(resultados.flatMap(snap => snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    } catch (e) {
      console.error("Error cargando movimientos de refrigerante:", e);
      setMovimientos([]);
    }
    setCargandoMovimientos(false);
  };

  const irARefrigerantes = () => {
    setSubVista("refrigerantes");
    cargarMovimientos();
    cargarRecuperacionHistorica();
  };

  const cargarRecuperacionHistorica = async (force = false) => {
    if (kgRecuperadosHistorico !== null && !force) return;
    try {
      const filtros = [where("cliente", "==", usuario?.empresa), where("tipo", "==", "recuperacion_baja")];
      if (sedeActual) filtros.push(where("sede", "==", sedeActual.nombre));
      const snap = await getDocs(query(collection(db, "movimientosRefrigerante"), ...filtros));
      setKgRecuperadosHistorico(snap.docs.reduce((acc, d) => acc + (Number(d.data().kg) || 0), 0));
    } catch (e) {
      console.error("Error cargando recuperación histórica:", e);
      setKgRecuperadosHistorico(0);
    }
  };

  const hace12Meses = () => { const d = new Date(); d.setMonth(d.getMonth() - 12); return d; };

  const kgAnadidos12m = (equipoId) => {
    if (!movimientos) return 0;
    const corte = hace12Meses();
    return movimientos
      .filter(m => m.equipoId === equipoId && m.tipo === "carga" && new Date(m.fecha) >= corte)
      .reduce((acc, m) => acc + (Number(m.kg) || 0), 0);
  };

  const estadoFuga = (pct) => {
    if (pct === null) return { label: "Sin datos", bg: "#f4f6fb", color: "#8a92a6" };
    if (pct >= 20) return { label: "Crítico", bg: "#fdeeee", color: "#a52b2b" };
    if (pct >= 10) return { label: "Alerta", bg: "#fff3d6", color: "#a8720b" };
    return { label: "OK", bg: "#e6f7ec", color: "#1c7a44" };
  };

  const refrigerantesData = equiposConGas.map(eq => {
    const nominal = Number(eq.cargaNominal) || 0;
    const anadido = kgAnadidos12m(eq.id);
    const pct = nominal > 0 ? (anadido / nominal) * 100 : null;
    return { equipo: eq, nominal, anadido, pct, estado: estadoFuga(pct) };
  });
  const kgInstalados = refrigerantesData.reduce((acc, r) => acc + r.nominal, 0);
  const kgAnadidosTotal = refrigerantesData.reduce((acc, r) => acc + r.anadido, 0);
  const tasaFugaPromedio = kgInstalados > 0 ? (kgAnadidosTotal / kgInstalados) * 100 : 0;
  const enAlertaRef = refrigerantesData.filter(r => r.pct !== null && r.pct >= 10).length;

  const mesesChart = (() => {
    const meses = [];
    const hoy = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      meses.push({ label: d.toLocaleDateString("es-PE", { month: "short" }), year: d.getFullYear(), month: d.getMonth() });
    }
    return meses.map(m => {
      const kg = (movimientos || [])
        .filter(mv => mv.tipo === "carga" && (() => { const fd = new Date(mv.fecha); return fd.getFullYear() === m.year && fd.getMonth() === m.month; })())
        .reduce((acc, mv) => acc + (Number(mv.kg) || 0), 0);
      return { ...m, kg };
    });
  })();
  const maxKgMes = Math.max(0.1, ...mesesChart.map(m => m.kg));

  const toggleHistorialEquipo = async (eq) => {
    const abierto = historialEquipoAbierto[eq.id];
    setHistorialEquipoAbierto(prev => ({ ...prev, [eq.id]: !abierto }));
    if (abierto || historialesEquipo[eq.id] || !eq.equipoAnteriorId) return;
    setCargandoHistorialEquipo(prev => ({ ...prev, [eq.id]: true }));
    try {
      const { getDoc, doc } = await import("firebase/firestore");
      const cadena = [];
      let cursorId = eq.equipoAnteriorId;
      while (cursorId) {
        const snap = await getDoc(doc(db, "equipos", cursorId));
        if (!snap.exists()) break;
        const data = { id: snap.id, ...snap.data() };
        cadena.push(data);
        cursorId = data.equipoAnteriorId || null;
      }
      await Promise.all(cadena.map(async (h) => {
        try {
          const movSnap = await getDocs(query(
            collection(db, "movimientosRefrigerante"),
            where("equipoId", "==", h.id),
            where("tipo", "==", "recuperacion_baja")
          ));
          h.kgRecuperados = movSnap.docs.reduce((acc, d) => acc + (Number(d.data().kg) || 0), 0);
        } catch {
          h.kgRecuperados = null;
        }
      }));
      setHistorialesEquipo(prev => ({ ...prev, [eq.id]: cadena }));
    } catch (e) {
      console.error("Error cargando historial del equipo:", e);
      setHistorialesEquipo(prev => ({ ...prev, [eq.id]: [] }));
    }
    setCargandoHistorialEquipo(prev => ({ ...prev, [eq.id]: false }));
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

  const mesesDisponibles = ["Todos", ...new Set(
    equiposMostrados.map(e => fechaAMesAnio(e.ultimoMantenimiento)).filter(Boolean)
  )];

  const equiposFiltrados = equiposMostrados
    .filter(e => {
      const okE = filtroEstado === "Todos" || e.estado === filtroEstado;
      const okP = pisosSeleccionados.length === 0 || pisosSeleccionados.includes(e.piso || "Sin piso");
      const okT = filtroTipoEquipo === "Todos" || (e.tipoEquipo || "Sin tipo") === filtroTipoEquipo;
      const okM = filtroMes === "Todos" ||
        (filtroMes === "Sin fecha" && !e.ultimoMantenimiento) ||
        fechaAMesAnio(e.ultimoMantenimiento) === filtroMes;
      return okE && okP && okT && okM;
    })
    .sort((a, b) => {
      const todosFiltrosVacios = pisosSeleccionados.length === 0 && filtroTipoEquipo === "Todos" && filtroMes === "Todos";
      if (todosFiltrosVacios) return sortPiso(a, b);
      const fa = fechaATimestamp(a.ultimoMantenimiento);
      const fb = fechaATimestamp(b.ultimoMantenimiento);
      if (fb !== fa) return fb - fa;
      return sortPiso(a, b);
    });

  const tot = equiposMostrados.length;
  const op = equiposMostrados.filter(e => e.estado === "Operativo").length;
  const obs = equiposMostrados.filter(e => e.estado === "Operativo con observaciones").length;
  const fs = equiposMostrados.filter(e => e.estado === "Fuera de servicio").length;

  const pisos = ["Todos", ...[...new Set(equiposMostrados.map(e => e.piso).filter(Boolean))].sort(ordenarPisos)];
  const tiposEquipo = ["Todos", ...[...new Set(equiposMostrados.map(e => e.tipoEquipo).filter(Boolean))].sort()];

  const getBadge = (estado) => {
    const map = {
      "Operativo": { bg: "#e6f7ec", color: "#1c7a44" },
      "Operativo con observaciones": { bg: "#fff3d6", color: "#a8720b" },
      "Fuera de servicio": { bg: "#fdeeee", color: "#a52b2b" },
    };
    const st = map[estado] || map["Operativo"];
    return <span style={{ background: st.bg, color: st.color, fontWeight: 700, fontSize: "11px", padding: "3px 9px", borderRadius: "20px", whiteSpace: "nowrap", display: "inline-block" }}>{estado === "Operativo con observaciones" ? "Con obs." : estado || "Operativo"}</span>;
  };

  const historialFiltrado = historialAverias
    ? historialAverias.filter(a => !historialSedeFiltro || a.sede === historialSedeFiltro.nombre)
    : [];

  if (cargando) return <div style={s.centro}>Cargando...</div>;

  return (
    <div style={s.page}>
      {/* Top bar */}
      <div style={s.topbar}>
        <div style={s.logoBox}>
          <img src="/assets/hvac-isotipo-filled.png" alt="HVAC" style={s.logoImg} />
        </div>
        <div style={s.breadcrumb}>
          {sedeActual ? (
            <>
              <a href="#" onClick={(e) => { e.preventDefault(); setSedeActual(null); setVistaActual("sedes"); setFiltroEstado("Todos"); }} style={s.breadcrumbLink}>
                ← {usuario?.empresa}
              </a>
              <span style={{ color: "#c3cad9" }}>/</span>
              <span>{sedeActual.nombre}</span>
            </>
          ) : (
            <span style={{ color: "#12245e", fontWeight: 700, fontSize: "14.5px" }}>{usuario?.empresa}</span>
          )}
        </div>
        <div style={s.topbarBtns}>
          {vistaActual === "equipos" && (
            <>
              <button style={s.btnExcel} onClick={() => exportarExcel(usuario?.empresa, equiposFiltrados)}>Excel</button>
              <button style={s.btnPdf} onClick={() => exportarPDF(usuario?.empresa, sedeActual?.nombre, equiposFiltrados)}>PDF</button>
            </>
          )}
          <button style={s.btnSalir} onClick={handleLogout}>Salir</button>
        </div>
      </div>

      <div style={s.content}>
        {/* Vista sedes */}
        {vistaActual === "sedes" && sedes.length > 0 && (
          <div style={s.sedesGrid}>
            {sedes.map(sede => {
              const eqSede = equipos.filter(e => e.sede === sede.nombre);
              const opS = eqSede.filter(e => e.estado === "Operativo").length;
              const obsS = eqSede.filter(e => e.estado === "Operativo con observaciones").length;
              const fsS = eqSede.filter(e => e.estado === "Fuera de servicio").length;
              const totS = eqSede.length;
              const averiasSede = averias.filter(a => a.sede === sede.nombre);
              const av = colorAvatar(sede.nombre);
              return (
                <div key={sede.id} style={s.sedeCard}>
                  <div style={s.sedeHeader}>
                    <div style={{ ...s.sedeIconBox, background: av.bg, color: av.color }}>{initiales(sede.nombre)}</div>
                    <div>
                      <div style={s.sedeNombre}>{sede.nombre}</div>
                      <div style={s.sedeDireccion}>{sede.direccion}</div>
                    </div>
                  </div>
                  <div style={s.miniStats}>
                    <div style={{ ...s.mini, background: "#e6f7ec" }}><div style={{ ...s.miniNum, color: "#1c7a44" }}>{opS}</div><div style={{ ...s.miniLabel, color: "#1c7a44" }}>Operativo</div></div>
                    <div style={{ ...s.mini, background: "#fff8e6" }}><div style={{ ...s.miniNum, color: "#8a5b0a" }}>{obsS}</div><div style={{ ...s.miniLabel, color: "#8a5b0a" }}>Con obs.</div></div>
                    <div style={{ ...s.mini, background: fsS > 0 ? "#fdeeee" : "#f4f6fb" }}><div style={{ ...s.miniNum, color: fsS > 0 ? "#a52b2b" : "#9aa2b3" }}>{fsS}</div><div style={{ ...s.miniLabel, color: fsS > 0 ? "#a52b2b" : "#9aa2b3" }}>Fuera serv.</div></div>
                    <div style={{ ...s.mini, background: averiasSede.length > 0 ? "#fdeeee" : "#f4f6fb" }}>
                      <div style={{ cursor: averiasSede.length > 0 ? "pointer" : "default" }} onClick={() => averiasSede.length > 0 && abrirEmergenciasSede(sede)}>
                        <div style={{ ...s.miniNum, color: averiasSede.length > 0 ? "#a52b2b" : "#9aa2b3" }}>{averiasSede.length}</div>
                        <div style={{ ...s.miniLabel, color: averiasSede.length > 0 ? "#a52b2b" : "#9aa2b3" }}>Emergencia</div>
                      </div>
                      <div style={{ fontSize: "10px", color: averiasSede.length > 0 ? "#a52b2b" : "#9aa2b3", textAlign: "center", marginTop: "3px", textDecoration: "underline", cursor: "pointer" }} onClick={() => abrirHistorial(sede)}>Historial</div>
                    </div>
                  </div>
                  <button style={s.btnVerSede} onClick={() => { setSedeActual(sede); setVistaActual("equipos"); }}>Ver equipos →</button>
                </div>
              );
            })}
          </div>
        )}

        {/* Vista equipos */}
        {vistaActual === "equipos" && (
          <>
            {equiposConGas.length > 0 && (
              <div style={s.tabsWrap}>
                <button style={{ ...s.tabBtn, ...(subVista === "equipos" ? s.tabBtnActiva : {}) }} onClick={() => setSubVista("equipos")}>
                  Equipos
                </button>
                <button style={{ ...s.tabBtn, ...(subVista === "refrigerantes" ? s.tabBtnActivaRef : {}) }} onClick={irARefrigerantes}>
                  Refrigerantes
                </button>
              </div>
            )}

            {subVista === "equipos" && (
              <>
            {/* Stat cards */}
            <div style={s.statGrid}>
              {[
                { label: "TOTAL EQUIPOS", value: tot, color: "#1a4fc0", bg: "#e5f0ff", border: "#c3d6fb", filtro: "Todos" },
                { label: "OPERATIVOS", value: op, color: "#1c7a44", bg: "#e6f7ec", border: "#c3ecd2", filtro: "Operativo" },
                { label: "CON OBS.", value: obs, color: "#a8720b", bg: "#fff8e6", border: "#f3dfa3", filtro: "Operativo con observaciones" },
                { label: "FUERA SERV.", value: fs, color: "#a52b2b", bg: "#fdeeee", border: "#f6d3d3", filtro: "Fuera de servicio" },
              ].map(st => (
                <div key={st.filtro} onClick={() => setFiltroEstado(filtroEstado === st.filtro ? "Todos" : st.filtro)} style={{ background: st.bg, border: `1.5px solid ${filtroEstado === st.filtro ? st.color : st.border}`, borderRadius: "16px", padding: "20px", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", textAlign: "center", cursor: "pointer" }}>
                  <div style={{ fontWeight: 800, fontSize: "clamp(26px,4vw,34px)", color: st.color }}>{st.value}</div>
                  <div style={{ fontWeight: 700, fontSize: "11.5px", color: "#6b7488", letterSpacing: "0.06em" }}>{st.label}</div>
                </div>
              ))}
              <div style={{ background: averiasSedeActual.length > 0 ? "#fdeeee" : "#f4f6fb", border: `1.5px solid ${averiasSedeActual.length > 0 ? "#f6d3d3" : "#e7ebf3"}`, borderRadius: "16px", padding: "20px", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", textAlign: "center" }}>
                <div style={{ cursor: averiasSedeActual.length > 0 ? "pointer" : "default" }} onClick={() => abrirEmergencias(averiasSedeActual)}>
                  <div style={{ fontWeight: 800, fontSize: "clamp(26px,4vw,34px)", color: averiasSedeActual.length > 0 ? "#a52b2b" : "#9aa2b3" }}>{averiasSedeActual.length}</div>
                  <div style={{ fontWeight: 700, fontSize: "11.5px", color: "#6b7488", letterSpacing: "0.06em" }}>EMERGENCIA</div>
                </div>
                <a href="#" onClick={(e) => { e.preventDefault(); abrirHistorial(sedeActual); }} style={{ fontSize: "11.5px", fontWeight: 700, color: "#1a4fc0", textDecoration: "underline", marginTop: "4px" }}>Historial</a>
              </div>
            </div>

            {/* Progress bars */}
            <div style={s.progressCard}>
              {[["Operativo", op, "#1c9a53"], ["Con observaciones", obs, "#e8a020"], ["Fuera de servicio", fs, "#c23b3b"]].map(([label, val, color]) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  <div style={{ width: "150px", minWidth: "110px", fontWeight: 700, fontSize: "13.5px", color: "#26314d" }}>{label}</div>
                  <div style={{ flex: 1, height: "6px", borderRadius: "4px", background: "#eef1f6", overflow: "hidden" }}>
                    <div style={{ width: `${tot ? Math.round(val / tot * 100) : 0}%`, height: "100%", background: color, borderRadius: "4px" }}></div>
                  </div>
                  <div style={{ width: "70px", textAlign: "right", fontWeight: 700, fontSize: "13px", color }}>{val} und</div>
                </div>
              ))}
            </div>

            {/* Equipment list */}
            <div style={s.tablaCard}>
              <div style={s.tablaHeader}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{ fontWeight: 800, fontSize: "16px", color: "#12245e" }}>Lista de equipos</div>
                  <span style={{ background: "#e5f0ff", color: "#1a4fc0", fontWeight: 700, fontSize: "12px", padding: "4px 10px", borderRadius: "20px" }}>{equiposFiltrados.length} equipos</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <span style={s.filterLabel}>Piso:</span>
                  <div style={{ position: "relative" }}>
                    <button onClick={() => setPisoDropdownAbierto(o => !o)} style={s.filterSelect}>
                      <span>{pisosSeleccionados.length === 0 ? "Todos los pisos" : pisosSeleccionados.length === 1 ? `Piso ${pisosSeleccionados[0]}` : `${pisosSeleccionados.length} pisos`}</span>
                      <span style={{ fontSize: "10px", color: "#8a92a6" }}>{pisoDropdownAbierto ? "▴" : "▾"}</span>
                    </button>
                    {pisoDropdownAbierto && (
                      <>
                        <div style={{ position: "fixed", inset: 0, zIndex: 9 }} onClick={() => setPisoDropdownAbierto(false)}></div>
                        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, background: "white", border: "1px solid #dfe6f5", borderRadius: "10px", boxShadow: "0 4px 16px rgba(20,40,90,0.12)", zIndex: 10, minWidth: "180px", maxHeight: "320px", overflowY: "auto" }}>
                          <div onClick={() => setPisosSeleccionados([])} style={{ padding: "9px 13px", fontSize: "12.5px", fontWeight: 600, cursor: "pointer", background: pisosSeleccionados.length === 0 ? "#e5f0ff" : "white", color: pisosSeleccionados.length === 0 ? "#1a4fc0" : "#26314d", borderBottom: "1px solid #f2f4f8" }}>Todos los pisos</div>
                          {pisos.filter(p => p !== "Todos").map(p => (
                            <label key={p} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 13px", fontSize: "12.5px", cursor: "pointer", color: "#26314d" }}>
                              <input type="checkbox" checked={pisosSeleccionados.includes(p)} onChange={() => setPisosSeleccionados(sel => sel.includes(p) ? sel.filter(x => x !== p) : [...sel, p])} />
                              Piso {p}
                            </label>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                  <span style={s.filterLabel}>Equipo:</span>
                  <select style={s.filterSelectNative} value={filtroTipoEquipo} onChange={e => setFiltroTipoEquipo(e.target.value)}>
                    {tiposEquipo.map(t => <option key={t} value={t}>{t === "Todos" ? "Todos los equipos" : t}</option>)}
                  </select>
                  <span style={s.filterLabel}>Periodo:</span>
                  <select style={s.filterSelectNative} value={filtroMes} onChange={e => setFiltroMes(e.target.value)}>
                    {mesesDisponibles.map(m => <option key={m}>{m}</option>)}
                    <option value="Sin fecha">Sin fecha</option>
                  </select>
                  {filtroMes !== "Todos" && (
                    <button onClick={() => setFiltroMes("Todos")} style={{ fontSize: "10.5px", padding: "3px 9px", borderRadius: "20px", background: "#1a4fc0", color: "white", border: "none", cursor: "pointer", fontWeight: 700 }}>{filtroMes} ✕</button>
                  )}
                </div>
              </div>

              <div style={{ overflowX: "auto", paddingRight: "4px" }}>
                <div style={{ minWidth: "0" }}>
                  <div style={s.tablaColHead}>
                    {["#", "CÓDIGO", "PISO", "AMBIENTE", "TIPO EQUIPO", "MARCA/MODELO", "SERIE", "ESTADO", "ÚLT. MANT.", "ACCIONES"].map(h => (
                      <div key={h} style={{ fontWeight: 700, fontSize: "11.5px", color: "#8a92a6", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{h}</div>
                    ))}
                  </div>
                  {equiposFiltrados.map((equipo, i) => {
                    const abierto = obsAbierto === equipo.id;
                    const obsArr = getObs(equipo);
                    const numObs = obsArr.length;
                    const tieneHistorial = !!equipo.equipoAnteriorId;
                    const historialAbiertoEq = historialEquipoAbierto[equipo.id];
                    return (
                      <React.Fragment key={equipo.id}>
                        <div style={s.tablaFila}>
                          <div style={{ fontWeight: 700, color: "#8a92a6", fontSize: "13.5px" }}>{i + 1}</div>
                          <div>{equipo.codigo ? <span style={s.codigoChip}>{equipo.codigo}</span> : null}</div>
                          <div style={{ fontWeight: 600, color: "#26314d", fontSize: "13.5px" }}>{equipo.piso || "-"}</div>
                          <div style={{ fontWeight: 700, color: "#0f1b3d", fontSize: "12.5px", lineHeight: 1.3, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={equipo.ambiente || ""}>{equipo.ambiente || "-"}</div>
                          <div style={{ fontWeight: 600, color: "#26314d", fontSize: "12px", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={equipo.tipoEquipo || ""}>{equipo.tipoEquipo || "-"}</div>
                          <div style={{ minWidth: 0, overflow: "hidden" }}>
                            <div style={{ fontWeight: 700, fontSize: "12.5px", color: "#0f1b3d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={equipo.marca || ""}>{equipo.marca || "-"}</div>
                            <div style={{ fontWeight: 600, fontSize: "11px", color: "#9aa2b3", marginTop: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={equipo.modelo || ""}>{equipo.modelo || "-"}</div>
                          </div>
                          <div style={{ minWidth: 0, overflow: "hidden" }}>
                            <span style={{ fontWeight: 600, color: "#6b7488", fontSize: "12px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block" }} title={equipo.serie || ""}>{equipo.serie || "—"}</span>
                          </div>
                          <div style={{ minWidth: 0, overflow: "hidden" }}>{getBadge(equipo.estado)}</div>
                          <div style={{ minWidth: 0, overflow: "hidden" }}>{equipo.ultimoMantenimiento ? <span style={s.ultMantChip}>{fechaAMesAnio(equipo.ultimoMantenimiento) || equipo.ultimoMantenimiento}</span> : <span style={{ fontSize: "11px", color: "#c3cad9" }}>—</span>}</div>
                          <div style={{ display: "flex", gap: "8px", flexWrap: "nowrap", justifyContent: "flex-end", alignItems: "center", minWidth: 0, paddingLeft: "10px" }}>
                            <button style={s.btnInfo} onClick={() => window.open(`/equipo/${equipo.id}?noqr=1`, "_blank")}>Info</button>
                            <button style={{ ...s.btnObs, ...(abierto ? { background: "#8a5b0a", color: "white" } : {}), opacity: numObs === 0 ? 0.5 : 1 }} onClick={() => setObsAbierto(abierto ? null : equipo.id)}>
                              Obs <span style={{ background: abierto ? "white" : "#f3dfa3", color: "#8a5b0a", borderRadius: "20px", padding: "1px 5px", fontSize: "10px" }}>{numObs}</span>
                            </button>
                            <button style={s.btnProto} onClick={() => navigate(`/protocolo?equipo=${equipo.id}&origen=cliente${sedeActual ? `&sede=${encodeURIComponent(sedeActual.id)}` : ""}`)}>Protocolo</button>
                            {tieneHistorial && (
                              <button style={s.btnHistorialChico} onClick={() => toggleHistorialEquipo(equipo)} title={`${equipo.historialCount || 1} reemplazo(s) anterior(es)`}>
                                <SvgHistorial /> {equipo.historialCount || 1}
                              </button>
                            )}
                          </div>
                        </div>
                        {tieneHistorial && historialAbiertoEq && (
                          <div style={{ background: "#fafbfd", borderBottom: "1px solid #f2f4f8", padding: "10px 18px 14px 18px" }}>
                            {cargandoHistorialEquipo[equipo.id] ? (
                              <div style={{ fontSize: "12px", color: "#8a92a6" }}>Cargando historial...</div>
                            ) : (
                              <div style={{ display: "flex", flexDirection: "column", gap: "8px", paddingLeft: "14px", borderLeft: "2px dashed #d3d1c7" }}>
                                {(historialesEquipo[equipo.id] || []).map(h => (
                                  <div key={h.id} style={{ border: "1px dashed #d3d1c7", borderRadius: "10px", padding: "9px 12px", opacity: 0.75, background: "white" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
                                      <div>
                                        <div style={{ fontWeight: 700, fontSize: "11.5px", color: "#26314d" }}>{h.marca} {h.modelo} {h.serie ? `· ${h.serie}` : ""}</div>
                                        <div style={{ fontSize: "10.5px", color: "#8a92a6", marginTop: "2px" }}>{h.fechaInstalacion || "?"} – {h.fechaBaja || "?"}</div>
                                      </div>
                                      <span style={{ fontSize: "9.5px", fontWeight: 700, padding: "2px 8px", borderRadius: "20px", background: "#f4f6fb", color: "#8a92a6", whiteSpace: "nowrap" }}>Reemplazado</span>
                                    </div>
                                    {h.kgRecuperados > 0 && (
                                      <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "10.5px", color: "#a8720b", fontWeight: 600, background: "#fff3d6", border: "1px solid #f3dfa3", borderRadius: "9px", padding: "7px 10px", marginTop: "9px" }}>
                                        Recuperación final: {h.kgRecuperados.toFixed(1)} kg {h.tipoRefrigerante || ""} al dar de baja
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        {abierto && (
                          <div style={{ background: "white", borderBottom: "1px solid #f2f4f8", padding: "14px 0 18px", width: "100%", boxSizing: "border-box" }}>
                            <div style={{ fontSize: "11.5px", fontWeight: 700, color: "#8a5b0a", marginBottom: "10px" }}>{numObs} observación{numObs !== 1 ? "es" : ""} — {equipo.codigo || equipo.ambiente}</div>
                            {numObs === 0 ? (
                              <div style={{ fontSize: "12.5px", color: "#aab1c2", fontStyle: "italic" }}>Sin observaciones registradas</div>
                            ) : (
                              <div style={{ display: "flex", flexDirection: "column", gap: "8px", width: "100%", boxSizing: "border-box" }}>
                                {(() => { const recArr = getRec(equipo); return obsArr.filter(o => o.texto?.trim()).map((o, idx) => (
                                  <div key={idx} style={{ display: "grid", gridTemplateColumns: "20px 1fr 1fr 1fr", gap: "5px", alignItems: "start", width: "100%", boxSizing: "border-box" }}>
                                    <div style={{ fontSize: "10px", color: "#8a92a6", paddingTop: "7px", textAlign: "center" }}>{idx + 1}</div>
                                    <div style={{ background: "#fff8e6", border: "1px solid #f3dfa3", borderRadius: "8px", padding: "6px 8px", minWidth: 0, overflow: "hidden" }}>
                                      <div style={{ fontSize: "10.5px", color: "#26314d", lineHeight: 1.3 }}>{o.texto}</div>
                                      {(o.fecha || o.tecnico) && <div style={{ fontSize: "8.5px", color: "#aab1c2", marginTop: "3px" }}>{o.fecha}{o.fecha && o.tecnico ? " · " : ""}{o.tecnico}</div>}
                                    </div>
                                    <div style={{ background: "#fdeeee", border: "1px solid #f6d3d3", borderRadius: "8px", padding: "6px 8px", fontSize: "10.5px", color: "#a52b2b", minWidth: 0, overflow: "hidden" }}>{o.causa || "—"}</div>
                                    <div style={{ background: "#e6f7ec", border: "1px solid #c3ecd2", borderRadius: "8px", padding: "6px 8px", fontSize: "10.5px", color: "#1c7a44", minWidth: 0, overflow: "hidden" }}>{recArr[idx] ? (typeof recArr[idx] === "string" ? recArr[idx] : recArr[idx].texto || "—") : "—"}</div>
                                  </div>
                                )); })()}
                              </div>
                            )}
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            </div>
              </>
            )}

            {subVista === "refrigerantes" && (
              <>
                <div style={s.statGrid}>
                  <div style={s.statCard}>
                    <div style={{ ...s.statNum, color: "#1a4fc0" }}>{kgInstalados.toFixed(1)}</div>
                    <div style={{ fontWeight: 700, fontSize: "11.5px", color: "#6b7488", letterSpacing: "0.06em" }}>KG INSTALADOS</div>
                  </div>
                  <div style={s.statCard}>
                    <div style={{ ...s.statNum, color: "#1c7a44" }}>{kgAnadidosTotal.toFixed(1)}</div>
                    <div style={{ fontWeight: 700, fontSize: "11.5px", color: "#6b7488", letterSpacing: "0.06em" }}>KG AÑADIDOS 12M</div>
                  </div>
                  <div style={{ ...s.statCard, background: tasaFugaPromedio >= 10 ? "#fff3d6" : "white" }}>
                    <div style={{ ...s.statNum, color: tasaFugaPromedio >= 20 ? "#a52b2b" : tasaFugaPromedio >= 10 ? "#a8720b" : "#1c7a44" }}>{tasaFugaPromedio.toFixed(1)}%</div>
                    <div style={{ fontWeight: 700, fontSize: "11.5px", color: "#6b7488", letterSpacing: "0.06em" }}>TASA DE FUGA</div>
                  </div>
                  <div style={{ ...s.statCard, background: enAlertaRef > 0 ? "#fdeeee" : "white" }}>
                    <div style={{ ...s.statNum, color: enAlertaRef > 0 ? "#a52b2b" : "#8a92a6" }}>{enAlertaRef} / {equiposConGas.length}</div>
                    <div style={{ fontWeight: 700, fontSize: "11.5px", color: "#6b7488", letterSpacing: "0.06em" }}>EN ALERTA</div>
                  </div>
                  <div style={s.statCard}>
                    <div style={{ ...s.statNum, color: "#7c3fd8" }}>
                      {kgRecuperadosHistorico === null ? "…" : kgRecuperadosHistorico.toFixed(1)}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: "11.5px", color: "#6b7488", letterSpacing: "0.06em" }}>KG RECUPERADOS (HISTÓRICO)</div>
                  </div>
                </div>

                <div style={s.progressCard}>
                  <div style={{ fontSize: "14px", fontWeight: 800, color: "#12245e", marginBottom: "14px" }}>Refrigerante añadido por mes (kg)</div>
                  {cargandoMovimientos ? (
                    <div style={{ textAlign: "center", color: "#8a92a6", padding: "20px 0" }}>Cargando...</div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "flex-end", gap: "8px", height: "140px", padding: "0 4px" }}>
                      {mesesChart.map((m, i) => (
                        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                          <div style={{ width: "100%", maxWidth: "26px", height: `${Math.max(3, (m.kg / maxKgMes) * 110)}px`, background: m.kg > 0 ? "#1a4fc0" : "#eef1f6", borderRadius: "4px 4px 0 0" }} title={`${m.kg.toFixed(1)} kg`}></div>
                          <span style={{ fontSize: "10px", color: "#8a92a6", fontWeight: 600, textTransform: "capitalize" }}>{m.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={s.tablaCard}>
                  <div style={{ padding: "14px 18px", borderBottom: "1px solid #f2f4f8" }}>
                    <span style={{ fontSize: "14.5px", fontWeight: 800, color: "#12245e" }}>Equipos con carga de gas</span>
                  </div>
                  {refrigerantesData.length === 0 ? (
                    <div style={{ padding: "30px", textAlign: "center", color: "#8a92a6", fontSize: "13px", fontWeight: 600 }}>
                      No hay equipos Split, VRV o Chiller registrados.
                    </div>
                  ) : (
                    <div style={{ overflowX: "auto" }}>
                      <div style={{ minWidth: "860px" }}>
                        <div style={s.tablaHeaderRef}>
                          {["Código", "Piso", "Equipo", "Gas", "Carga nominal", "Añadido 12m", "Fuga", "Estado"].map(h => (
                            <span key={h} style={{ fontWeight: 700, fontSize: "11px", color: "#8a92a6", letterSpacing: "0.05em", textTransform: "uppercase" }}>{h}</span>
                          ))}
                        </div>
                        {refrigerantesData.map((r, i) => (
                          <div key={r.equipo.id} style={{ ...s.tablaRowRef, background: i % 2 === 0 ? "white" : "#fafbfd" }}>
                            <span>{r.equipo.codigo ? <span style={s.codigoChip}>{r.equipo.codigo}</span> : <span style={{ color: "#c3cad9" }}>-</span>}</span>
                            <span style={{ fontSize: "12.5px", color: "#26314d" }}>{r.equipo.piso || "-"}</span>
                            <span style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 700, color: "#0f1b3d", fontSize: "12.5px" }}>{r.equipo.tipoEquipo} — {r.equipo.ambiente || "-"}</div>
                              <div style={{ fontSize: "10.5px", color: "#9aa2b3", marginTop: "2px" }}>{r.equipo.marca || ""} {r.equipo.modelo || ""}{r.equipo.serie ? ` · ${r.equipo.serie}` : ""}</div>
                            </span>
                            <span style={{ fontSize: "12.5px", color: "#26314d" }}>{r.equipo.tipoRefrigerante || "—"}</span>
                            <span style={{ fontSize: "12.5px", color: "#26314d" }}>{r.nominal > 0 ? `${r.nominal.toFixed(1)} kg` : "Sin dato"}</span>
                            <span style={{ fontSize: "12.5px", color: "#26314d" }}>{r.anadido.toFixed(1)} kg</span>
                            <span style={{ fontWeight: 700, fontSize: "12.5px", color: r.estado.color }}>{r.pct === null ? "—" : `${r.pct.toFixed(1)}%`}</span>
                            <span><span style={{ fontSize: "11px", padding: "3px 9px", borderRadius: "20px", background: r.estado.bg, color: r.estado.color, fontWeight: 700 }}>{r.estado.label}</span></span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Modal lista de emergencias activas */}
      {listaEmergenciaSede && (
        <div style={s.modalOverlay} onClick={() => setListaEmergenciaSede(null)}>
          <div style={s.listaCard} onClick={e => e.stopPropagation()}>
            <div style={s.listaHeader}>
              <span style={{ fontSize: "15px" }}>⚠</span>
              <span style={s.listaTitulo}>Equipos con emergencia</span>
              <span style={s.listaBadgeCount}>{listaEmergenciaSede.length}</span>
              <button style={s.btnCerrarX} onClick={() => setListaEmergenciaSede(null)}>✕</button>
            </div>
            <div style={s.listaBody}>
              {listaEmergenciaSede.map(a => {
                const eq = equipos.find(e => e.id === a.equipoId);
                return (
                  <div key={a.id} onClick={() => abrirDetalleAveria(a)} style={s.listaItem}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={s.listaItemNombre}>{eq?.tipoEquipo || "Equipo"} — {a.ambiente || eq?.ambiente || "-"}</div>
                      <div style={s.listaItemMeta}>{a.piso ? `Piso ${a.piso}` : ""}{eq?.serie ? ` · Serie ${eq.serie}` : ""}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0, whiteSpace: "nowrap" }}>
                      <span style={s.listaItemFecha}>{a.fecha?.toDate ? a.fecha.toDate().toLocaleDateString("es-PE") + ", " + a.fecha.toDate().toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }) : ""}</span>
                      <span style={s.chevron}>›</span>
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
              <span style={{ fontSize: "15px", color: "#8a92a6" }}>🕘</span>
              <span style={s.listaTitulo}>Historial de averías{historialSedeFiltro ? ` — ${historialSedeFiltro.nombre}` : ""}</span>
              <button style={s.btnCerrarX} onClick={() => setHistorialAbierto(false)}>✕</button>
            </div>
            <div style={s.listaBody}>
              {cargandoHistorial ? (
                <div style={{ fontSize: "12.5px", color: "#8a92a6", textAlign: "center", padding: "20px 0" }}>Cargando historial...</div>
              ) : historialFiltrado.length === 0 ? (
                <div style={{ fontSize: "12.5px", color: "#aab1c2", fontStyle: "italic", textAlign: "center", padding: "20px 0" }}>Sin averías atendidas registradas</div>
              ) : historialFiltrado
                  .slice()
                  .sort((a, b) => (b.atendidaEn?.toDate ? b.atendidaEn.toDate().getTime() : 0) - (a.atendidaEn?.toDate ? a.atendidaEn.toDate().getTime() : 0))
                  .map(a => {
                    const eq = equipos.find(e => e.id === a.equipoId);
                    return (
                      <div key={a.id} onClick={() => abrirDetalleAveria(a)} style={s.listaItem}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={s.listaItemNombre}>{eq?.tipoEquipo || "Equipo"} — {a.ambiente || eq?.ambiente || "-"}</div>
                          <div style={s.listaItemMeta}>{a.sede ? `${a.sede} · ` : ""}{a.piso ? `Piso ${a.piso}` : ""}</div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                          <span style={s.atendidaChip}>Atendida</span>
                          <span style={s.chevron}>›</span>
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
        const numObsAbiertas = eq ? getObs(eq).length : 0;
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
                <div style={s.averiaFila}><span style={s.averiaLabel}>Observaciones abiertas</span><span style={s.averiaValor}>{numObsAbiertas}</span></div>
              </div>
              <div style={s.averiaDivider}></div>
              <div style={{ ...s.averiaMsgLabel, color: atendida ? "#1c7a44" : "#a52b2b" }}>{atendida ? "✓ Avería atendida" : "⚠ Mensaje de emergencia"}</div>
              <div style={{ ...s.averiaMsgBox, background: atendida ? "#e6f7ec" : "#fdeeee", border: `1px solid ${atendida ? "#c3ecd2" : "#f6d3d3"}` }}>
                <div style={s.averiaMsgTxt}>{detalleAveria.mensaje}</div>
                <div style={{ fontSize: "11px", color: "#8a92a6" }}>🕐 {detalleAveria.fecha?.toDate ? detalleAveria.fecha.toDate().toLocaleString("es-PE") : ""}</div>
              </div>
              {atendida ? (
                <div style={s.averiaAtendidaTxt}>✓ Atendida: {detalleAveria.atendidaEn?.toDate ? detalleAveria.atendidaEn.toDate().toLocaleString("es-PE") : "-"}</div>
              ) : (
                <>
                  <div style={{ display: "flex", gap: "8px", marginTop: "14px" }}>
                    {eq && <button style={s.btnVerProtocolo} onClick={() => navigate(`/protocolo?equipo=${eq.id}&origen=cliente${sedeActual ? `&sede=${encodeURIComponent(sedeActual.id)}` : ""}`)}>Ver protocolo</button>}
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
  topbar: { background: "white", borderBottom: "1px solid #e7ebf3", padding: "14px clamp(16px,4vw,32px)", display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" },
  logoBox: { width: "44px", height: "44px", minWidth: "44px", borderRadius: "10px", background: "#1a4fc0", display: "flex", alignItems: "center", justifyContent: "center" },
  logoImg: { width: "28px", height: "28px", objectFit: "contain", filter: "brightness(0) invert(1)" },
  breadcrumb: { display: "flex", alignItems: "center", gap: "10px", color: "#6b7488", fontWeight: 600, fontSize: "13.5px" },
  breadcrumbLink: { color: "#1a4fc0", textDecoration: "none", fontWeight: 700 },
  topbarBtns: { marginLeft: "auto", display: "flex", gap: "10px", flexWrap: "wrap" },
  btnExcel: { background: "#e6f7ec", color: "#1c7a44", border: "none", borderRadius: "10px", padding: "9px 16px", fontFamily: "inherit", fontWeight: 700, fontSize: "13px", cursor: "pointer" },
  btnPdf: { background: "#fdeeee", color: "#a52b2b", border: "none", borderRadius: "10px", padding: "9px 16px", fontFamily: "inherit", fontWeight: 700, fontSize: "13px", cursor: "pointer" },
  btnSalir: { background: "#f4f6fb", color: "#6b7488", border: "1px solid #e7ebf3", borderRadius: "10px", padding: "9px 16px", fontFamily: "inherit", fontWeight: 700, fontSize: "13px", cursor: "pointer" },
  content: { padding: "clamp(16px,4vw,32px)", display: "flex", flexDirection: "column", gap: "20px", maxWidth: "1400px", margin: "0 auto" },

  sedesGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" },
  sedeCard: { background: "white", border: "1px solid #e7ebf3", borderRadius: "16px", overflow: "hidden" },
  sedeHeader: { padding: "14px 16px", borderBottom: "1px solid #f2f4f8", display: "flex", alignItems: "center", gap: "10px" },
  sedeIconBox: { width: "40px", height: "40px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "14px", fontWeight: 800 },
  sedeNombre: { fontSize: "13.5px", fontWeight: 700, color: "#12245e" },
  sedeDireccion: { fontSize: "11.5px", color: "#8a92a6", marginTop: "2px" },
  miniStats: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "6px", padding: "12px 14px" },
  mini: { textAlign: "center", padding: "7px", borderRadius: "9px" },
  miniNum: { fontSize: "16px", fontWeight: 700 },
  miniLabel: { fontSize: "10px", marginTop: "1px", fontWeight: 600 },
  btnVerSede: { width: "100%", padding: "11px", border: "none", borderTop: "1px solid #f2f4f8", cursor: "pointer", fontSize: "13px", fontWeight: 700, background: "white", color: "#1a4fc0", fontFamily: "inherit" },

  statGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: "14px" },
  statCard: { background: "white", border: "1px solid #e7ebf3", borderRadius: "16px", padding: "20px", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", textAlign: "center" },
  statNum: { fontWeight: 800, fontSize: "clamp(26px,4vw,34px)" },
  progressCard: { background: "white", border: "1px solid #e7ebf3", borderRadius: "18px", padding: "clamp(16px,3vw,24px)", display: "flex", flexDirection: "column", gap: "16px" },

  tablaCard: { background: "white", border: "1px solid #e7ebf3", borderRadius: "18px", padding: "clamp(16px,3vw,24px)", display: "flex", flexDirection: "column", gap: "16px" },
  tablaHeader: { display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", justifyContent: "space-between" },
  filterLabel: { fontSize: "12.5px", fontWeight: 600, color: "#6b7488" },
  filterSelect: { fontSize: "12.5px", fontWeight: 600, padding: "7px 11px", borderRadius: "9px", border: "1px solid #dfe6f5", background: "#f9fafc", color: "#26314d", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", minWidth: "140px", justifyContent: "space-between", fontFamily: "inherit" },
  filterSelectNative: { fontSize: "12.5px", fontWeight: 600, padding: "7px 11px", borderRadius: "9px", border: "1px solid #dfe6f5", background: "#f9fafc", color: "#26314d", fontFamily: "inherit" },
  tablaColHead: { display: "grid", gridTemplateColumns: "22px 62px 36px 1.1fr 0.8fr 1fr 0.85fr 76px 76px 230px", gap: "6px", borderBottom: "2px solid #eef1f6", paddingBottom: "10px" },
  tablaFila: { display: "grid", gridTemplateColumns: "22px 62px 36px 1.1fr 0.8fr 1fr 0.85fr 76px 76px 230px", gap: "6px", alignItems: "center", borderBottom: "1px solid #f2f4f8", padding: "14px 0" },
  codigoChip: { background: "#e5f0ff", color: "#1a4fc0", fontWeight: 700, fontSize: "12px", padding: "3px 9px", borderRadius: "7px" },
  ultMantChip: { background: "#e5f0ff", color: "#1a4fc0", fontWeight: 700, fontSize: "11px", padding: "3px 9px", borderRadius: "20px", whiteSpace: "nowrap", display: "inline-block" },
  btnInfo: { background: "#1a4fc0", color: "white", border: "none", borderRadius: "7px", padding: "4px 7px", fontFamily: "inherit", fontWeight: 700, fontSize: "9.5px", cursor: "pointer" },
  btnObs: { background: "#fff8e6", color: "#8a5b0a", border: "1px solid #f3dfa3", borderRadius: "7px", padding: "4px 6px", fontFamily: "inherit", fontWeight: 700, fontSize: "9.5px", cursor: "pointer", display: "flex", alignItems: "center", gap: "3px", whiteSpace: "nowrap" },
  btnProto: { background: "#a52b2b", color: "white", border: "none", borderRadius: "7px", padding: "4px 7px", fontFamily: "inherit", fontWeight: 700, fontSize: "9.5px", cursor: "pointer", whiteSpace: "nowrap" },

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

  centro: { textAlign: "center", padding: "3rem", fontSize: "15px", color: "#8a92a6", fontFamily: FONT },

  tabsWrap: { display: "flex", gap: "8px", marginBottom: "18px" },
  tabBtn: { background: "white", color: "#6b7488", border: "1px solid #e7ebf3", borderRadius: "11px", padding: "10px 18px", fontFamily: "inherit", fontWeight: 700, fontSize: "13px", cursor: "pointer" },
  tabBtnActiva: { background: "#12245e", color: "white", border: "1px solid #12245e" },
  tabBtnActivaRef: { background: "#1a4fc0", color: "white", border: "1px solid #1a4fc0" },
  tablaHeaderRef: { display: "grid", gridTemplateColumns: "70px 45px 1.6fr 0.7fr 0.9fr 0.9fr 0.7fr 0.9fr", gap: "10px", padding: "10px 18px", background: "#fafbfd", borderBottom: "1px solid #eef1f6" },
  tablaRowRef: { display: "grid", gridTemplateColumns: "70px 45px 1.6fr 0.7fr 0.9fr 0.9fr 0.7fr 0.9fr", gap: "10px", padding: "12px 18px", borderBottom: "1px solid #f2f4f8", alignItems: "center" },
  btnHistorialChico: { fontSize: "10px", padding: "5px 7px", background: "#fff3d6", color: "#a8720b", border: "none", borderRadius: "7px", cursor: "pointer", fontWeight: 700, fontFamily: "inherit", display: "flex", alignItems: "center", gap: "3px", whiteSpace: "nowrap" },
};
