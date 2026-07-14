import { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import jsPDF from "jspdf";
import AccesoEquipo from "./AccesoEquipo";

const GRUPO_POR_TIPO = {
  "Fan Coil": "fancoil", "UMA": "fancoil", "Manejadora de Aire": "fancoil",
  "Split Piso Techo": "expansion", "Split Pared": "expansion", "Split Ducto": "expansion",
  "Split Fancoil": "expansion", "Split Cassete": "expansion", "Ventana": "expansion",
  "Autocontenido": "expansion", "Precisión": "expansion",
  "VRV Evaporador": "vrv", "VRV Condensador": "vrv",
  "Fancoil AH": "fancoil", "Pared AH": "fancoil", "UMA AH": "fancoil",
  "Ventilación": "ventilacion", "Extractor": "ventilacion", "Inyector": "ventilacion",
  "Cortina de aire": "ventilacion", "Jetfan": "ventilacion", "Presurizador": "ventilacion",
  "Chiller": "pendiente", "Torre de Enfriamiento": "pendiente", "Bombas de agua": "pendiente",
};

const getBadgeStyle = (estado) => {
  if (estado === "Operativo") return { background: "#e6f7ec", color: "#1c7a44" };
  if (estado === "Operativo con observaciones") return { background: "#fff8e6", color: "#8a5b0a" };
  return { background: "#fdeeee", color: "#a52b2b" };
};

const cronBadge = (estado) => ({
  realizado: { bg: "#e6f7ec", color: "#1c7a44", label: "Realizado" },
  pendiente: { bg: "#fff8e6", color: "#8a5b0a", label: "Pendiente" },
  programado: { bg: "#e5f0ff", color: "#1a4fc0", label: "Programado" },
}[estado] || { bg: "#e5f0ff", color: "#1a4fc0", label: "Programado" });

export default function VistaEquipo() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sinQR = searchParams.get("noqr") === "1";
  const [equipo, setEquipo] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [tamanoQR, setTamanoQR] = useState("2x2");
  const [escala, setEscala] = useState(3);
  const [imprimiendo, setImprimiendo] = useState(false);
  const [esPub, setEsPub] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [pdfGenerado, setPdfGenerado] = useState(false);

  useEffect(() => { cargarEquipo(); }, []);
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => {
      setEsPub(!user);
      setAuthChecked(true);
    });
    return () => unsub();
  }, []);

  const cargarEquipo = async () => {
    try {
      const snap = await getDoc(doc(db, "equipos", id));
      if (snap.exists()) setEquipo({ id: snap.id, ...snap.data() });
    } catch (e) { console.error(e); }
    setCargando(false);
  };

  const getQRpx = () => {
    if (tamanoQR === "2x2") return 76;
    if (tamanoQR === "3x3") return 113;
    if (tamanoQR === "5x5") return 189;
    return escala * 37.8;
  };

  const getObs = () => {
    const arr = equipo.observacionesArray || [];
    const norm = arr.map(o => typeof o === "string"
      ? { texto: o, fecha: "", tecnico: "", causa: "" }
      : { texto: o.texto || "", fecha: o.fecha || "", tecnico: o.tecnico || "", causa: o.causa || "" }
    );
    const filtradas = norm.filter(o => o?.texto?.trim());
    if (filtradas.length > 0) return filtradas;
    return equipo.observaciones?.split(/\n|;/).map(o => ({ texto: o.trim(), fecha: "", tecnico: "", causa: "" })).filter(o => o.texto) || [];
  };

  const getRec = () => equipo.recomendacionesArray?.filter(Boolean) ||
    equipo.recomendaciones?.split(/\n|;/).map(r => r.trim()).filter(Boolean) || [];

  const getCor = () => {
    if (equipo.correctivosArray?.length > 0) return equipo.correctivosArray.filter(c => c.descripcion);
    if (equipo.correctivos) return equipo.correctivos.split(/\n|;/).map(c => ({ descripcion: c.trim(), fecha: "" })).filter(c => c.descripcion);
    return [];
  };

  const getCron = () => equipo.cronograma?.length > 0 ? equipo.cronograma : [
    { label: "1er Trimestre", fecha: "", estado: "programado" },
    { label: "2do Trimestre", fecha: "", estado: "programado" },
    { label: "3er Trimestre", fecha: "", estado: "programado" },
    { label: "4to Trimestre", fecha: "", estado: "programado" },
  ];

  const imprimirQR = () => {
    const url = window.location.href;
    const px = Math.round(getQRpx());
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${px * 2}x${px * 2}&data=${encodeURIComponent(url)}`;
    const win = window.open("", "_blank");
    win.document.write(`<html><head><title>QR ${equipo.codigo || ""}</title>
    <style>body{margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:Arial;background:white;}
    .info{text-align:center;margin-top:10px;font-size:12px;color:#555;}</style></head><body>
    <img src="${qrUrl}" width="${px}" height="${px}"/>
    <div class="info"><b>${equipo.codigo || ""}</b><br/>${equipo.cliente || ""} · Piso ${equipo.piso || ""} · ${equipo.ambiente || ""}</div>
    <script>window.onload=()=>window.print();</script></body></html>`);
    win.document.close();
  };

  const generarPDF = async (modo = "descargar") => {
    setImprimiendo(true);
    try {
      const pdf = new jsPDF("p", "mm", "a4");
      const W = 210, M = 14, C = W - M * 2;
      let y = 0;
      const check = (h = 10) => { if (y + h > 280) { pdf.addPage(); y = 14; } };

      pdf.setFillColor(26, 79, 192); pdf.rect(0, 0, W, 22, "F");
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(14); pdf.setTextColor(255, 255, 255);
      pdf.text("HVAC", M, 14);
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(9); pdf.setTextColor(210, 222, 250);
      pdf.text("SISTEMA DE MANTENIMIENTO", M + 22, 14);
      const ec = equipo.estado === "Operativo" ? [28, 122, 68] : equipo.estado === "Operativo con observaciones" ? [138, 91, 10] : [165, 43, 43];
      pdf.setFillColor(255, 255, 255); pdf.roundedRect(W - M - 52, 7, 52, 8, 2, 2, "F");
      pdf.setFontSize(7.5); pdf.setTextColor(...ec);
      pdf.text(equipo.estado === "Operativo con observaciones" ? "Con observaciones" : (equipo.estado || "Operativo"), W - M - 26, 12.5, { align: "center" });
      y = 30;

      pdf.setFillColor(248, 249, 250); pdf.rect(M, y, C, 14, "F");
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(11); pdf.setTextColor(26, 79, 192);
      pdf.text(`${equipo.marca || "-"} / ${equipo.modelo || "-"} — ${equipo.tipoEquipo || "-"}`, M + 3, y + 6);
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(8.5); pdf.setTextColor(100, 100, 100);
      pdf.text(`Cliente: ${equipo.cliente || "-"}   Piso: ${equipo.piso || "-"}   Ambiente: ${equipo.ambiente || "-"}   Cod: ${equipo.codigo || "-"}`, M + 3, y + 11.5);
      y += 18;

      const secTit = (txt, r, g, b) => {
        check(8); pdf.setFillColor(r, g, b); pdf.rect(M, y, 3, 5, "F");
        pdf.setFont("helvetica", "bold"); pdf.setFontSize(8.5); pdf.setTextColor(r, g, b);
        pdf.text(txt.toUpperCase(), M + 5, y + 4); y += 8;
      };

      const gridCards = (items, cols, br, bg, bb) => {
        const cW = (C - (cols - 1) * 3) / cols, cH = 12;
        const rows = Math.ceil(items.length / cols);
        check(rows * (cH + 2) + 2);
        items.forEach((item, i) => {
          const col = i % cols, row = Math.floor(i / cols);
          const x = M + col * (cW + 3), cy = y + row * (cH + 2);
          pdf.setFillColor(br, bg, bb); pdf.rect(x, cy, cW, cH, "F");
          pdf.setFont("helvetica", "normal"); pdf.setFontSize(7); pdf.setTextColor(150, 150, 150);
          pdf.text(item[0], x + 3, cy + 4);
          pdf.setFont("helvetica", "bold"); pdf.setFontSize(8.5); pdf.setTextColor(30, 30, 30);
          pdf.text(String(item[1] || "-"), x + 3, cy + 9);
        });
        y += rows * (cH + 2) + 2;
      };

      secTit("Datos del equipo", 26, 79, 192);
      gridCards([
        ["Cliente", equipo.cliente], ["Sede", equipo.sede], ["Piso", equipo.piso], ["Ambiente", equipo.ambiente],
        ["Marca", equipo.marca], ["Modelo", equipo.modelo], ["N° Serie", equipo.serie],
        ["Capacidad", equipo.capacidad ? equipo.capacidad + (GRUPO_POR_TIPO[equipo.tipoEquipo] === "ventilacion" ? " CFM" : " BTU") : null],
      ], 4, 248, 249, 250);
      gridCards([
        GRUPO_POR_TIPO[equipo.tipoEquipo] !== "ventilacion" && ["Refrigerante", equipo.tipoRefrigerante],
        ["Voltaje de placa", equipo.voltaje ? equipo.voltaje + "V" : null],
        ["Amperaje nominal", equipo.amperaje ? equipo.amperaje + "A" : null],
        ["Fases", equipo.fases],
        equipo.condVoltaje && ["Voltaje cond.", equipo.condVoltaje + "V"],
        equipo.condAmperaje && ["Amperaje cond.", equipo.condAmperaje + "A"],
        equipo.modeloCompresor && ["Modelo compresor", equipo.modeloCompresor],
      ].filter(Boolean), 4, 248, 249, 250);

      const obs = getObs();
      if (obs.length > 0) {
        const rec = getRec();
        secTit("Observación · Causa · Recomendación", 217, 154, 28);
        const colW = (C - 4) / 3;
        obs.forEach((o, i) => {
          const h = 12; check(h + 2);
          pdf.setFillColor(255, 248, 230); pdf.rect(M, y, colW, h, "F");
          pdf.setFillColor(253, 238, 238); pdf.rect(M + colW + 2, y, colW, h, "F");
          pdf.setFillColor(230, 247, 236); pdf.rect(M + (colW + 2) * 2, y, colW, h, "F");
          pdf.setFont("helvetica", "normal"); pdf.setFontSize(7.5);
          pdf.setTextColor(138, 91, 10); pdf.text(pdf.splitTextToSize(o.texto, colW - 4)[0], M + 2, y + 5);
          pdf.setTextColor(165, 43, 43); pdf.text(pdf.splitTextToSize(o.causa || "—", colW - 4)[0], M + colW + 4, y + 5);
          pdf.setTextColor(28, 122, 68); pdf.text(pdf.splitTextToSize(rec[i] ? (typeof rec[i] === "string" ? rec[i] : rec[i].texto || "—") : "—", colW - 4)[0], M + (colW + 2) * 2 + 2, y + 5);
          if (o.fecha) { pdf.setFontSize(6.5); pdf.setTextColor(150, 150, 150); pdf.text(o.fecha, M + 2, y + 10); }
          y += h + 2;
        });
        y += 2;
      }

      const cron = getCron();
      secTit("Cronograma de mantenimiento", 26, 79, 192);
      const tW = (C - (cron.length - 1) * 3) / cron.length, tH = 14;
      check(tH + 2);
      cron.forEach((t, i) => {
        const x = M + i * (tW + 3);
        const col = { realizado: [230, 247, 236], pendiente: [255, 248, 230], programado: [229, 240, 255] }[t.estado] || [229, 240, 255];
        pdf.setFillColor(...col); pdf.rect(x, y, tW, tH, "F");
        pdf.setFont("helvetica", "bold"); pdf.setFontSize(7); pdf.setTextColor(18, 36, 94);
        pdf.text(t.label, x + tW / 2, y + 4, { align: "center" });
        pdf.setFont("helvetica", "normal"); pdf.setFontSize(6.5); pdf.setTextColor(100, 100, 100);
        pdf.text(t.fecha || "Sin fecha", x + tW / 2, y + 8.5, { align: "center" });
        pdf.text(t.estado || "programado", x + tW / 2, y + 12.5, { align: "center" });
      });
      y += tH + 6;

      check(25);
      const urlE = `${window.location.origin}/equipo/${id}`;
      const px = Math.round(getQRpx());
      const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=${px * 2}x${px * 2}&data=${encodeURIComponent(urlE)}`;
      const qrImg = await new Promise(res => {
        const img = new Image(); img.crossOrigin = "anonymous";
        img.onload = () => { const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; c.getContext("2d").drawImage(img, 0, 0); res(c.toDataURL("image/png")); };
        img.onerror = () => res(null); img.src = qrSrc;
      });
      if (qrImg) pdf.addImage(qrImg, "PNG", M, y, 22, 22);
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(7.5); pdf.setTextColor(150, 150, 150);
      pdf.text("HVAC Sistema de Mantenimiento", W - M, y + 5, { align: "right" });
      pdf.text(`Generado: ${new Date().toLocaleDateString("es-PE")}`, W - M, y + 10, { align: "right" });
      pdf.setDrawColor(220, 220, 220); pdf.line(M, 287, W - M, 287);
      pdf.setFontSize(7); pdf.setTextColor(180, 180, 180);
      pdf.text(`Reporte · ${equipo.cliente || ""} · ${equipo.codigo || id.slice(0, 6).toUpperCase()}`, M, 291);

      if (modo === "ver") {
        const blob = pdf.output("blob");
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank") || (window.location.href = url);
      } else {
        pdf.save(`reporte-${equipo.codigo || id.slice(0, 6)}.pdf`);
      }
    } catch (e) { console.error(e); alert("Error PDF: " + e.message); }
    setImprimiendo(false);
  };

  if (cargando || !authChecked) return <div style={s.centro}>Cargando...</div>;
  if (!equipo) return <div style={s.centro}>Equipo no encontrado</div>;
  if (esPub) return <AccesoEquipo equipo={equipo} onVerInforme={() => generarPDF("ver")} />;

  const px = Math.round(getQRpx());
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${px * 2}x${px * 2}&data=${encodeURIComponent(window.location.href)}`;
  const obs = getObs(), rec = getRec(), cron = getCron();
  const esVent = GRUPO_POR_TIPO[equipo.tipoEquipo] === "ventilacion";

  const datosGrid = [
    ["Cliente", equipo.cliente], ["Sede", equipo.sede], ["Piso", equipo.piso], ["Ambiente", equipo.ambiente],
    ["Marca", equipo.marca], ["Modelo", equipo.modelo], ["N° Serie", equipo.serie],
    ["Capacidad", equipo.capacidad ? `${equipo.capacidad} ${esVent ? "CFM" : "BTU"}` : "—"],
    !esVent && ["Refrigerante", equipo.tipoRefrigerante || "—"],
    ["Voltaje de placa", equipo.voltaje ? `${equipo.voltaje}V` : "—"],
    ["Amperaje nominal", equipo.amperaje ? `${equipo.amperaje}A` : "—"],
    ["Fases", equipo.fases || "Monofásico"],
  ].filter(Boolean);

  const fechaReporte = equipo.ultimoMantenimiento || new Date().toLocaleDateString("es-PE");
  const badge = getBadgeStyle(equipo.estado);

  return (
    <div style={s.page}>
      {/* Navbar */}
      <div style={s.navbar}>
        <div style={s.navLeft}>
          <img src="/assets/hvac-isotipo-blue.png" alt="HVAC" style={s.navLogo} />
          <div style={s.div}></div>
          <button style={s.btnBack} onClick={() => navigate(-1)}>← Volver</button>
        </div>
        <span style={{ ...s.badge, ...badge }}>{equipo.estado === "Operativo con observaciones" ? "Con observaciones" : (equipo.estado || "Operativo")}</span>
      </div>

      <div style={s.content}>
        <div style={s.headerRow}>
          <img src="/assets/hvac-isotipo-blue.png" alt="HVAC" style={{ width: 22, height: 22, objectFit: "contain" }} />
          <div style={s.headerTitulo}>Ficha técnica de equipo</div>
          <span style={s.headerFecha}>Reporte generado · {fechaReporte}</span>
        </div>

        <div style={s.layout}>
          {/* SIDEBAR */}
          <div style={s.sidebar}>
            <div style={s.sCardCenter}>
              <div style={s.sLogoBox}>
                <img src="/assets/hvac-isotipo-filled.png" alt="" style={s.sLogoImg} />
              </div>
              <div style={s.sNombre}>{equipo.marca || "-"} / {equipo.modelo || "-"}</div>
              <span style={s.sTipo}>{equipo.tipoEquipo || "-"}</span>
            </div>

            <div style={s.sCard}>
              <div style={s.sLbl}>Ubicación</div>
              <div style={s.sRow}>
                <SvgUbicacion />
                <div style={s.sVal}>{equipo.cliente || "-"}</div>
              </div>
              <div style={s.sRow}>
                <SvgPin />
                <div style={s.sValMuted}>Piso {equipo.piso || "-"} · {equipo.ambiente || "-"}</div>
              </div>
            </div>

            <div style={s.sCard}>
              <div style={s.sLbl}>Código</div>
              <div style={s.sCodigo}>{equipo.codigo || "—"}</div>
            </div>

            <div style={s.sCard}>
              <div style={s.sLbl}>Último mantenimiento</div>
              <div style={s.sRow}>
                <SvgCalendario />
                <div style={s.sValStrong}>{equipo.ultimoMantenimiento || "Sin registro"}</div>
              </div>
            </div>

            {!sinQR && (
              <button style={s.btnOutline} onClick={imprimirQR}>
                <SvgPrint /> Imprimir QR
              </button>
            )}
            <button style={s.btnOutline} onClick={() => generarPDF("descargar")} disabled={imprimiendo}>
              <SvgDownload /> {imprimiendo ? "Generando..." : "Descargar PDF"}
            </button>
          </div>

          {/* MAIN */}
          <div style={s.main}>
            <div style={s.card}>
              <div style={s.cardHeaderCenter}>
                <SvgFicha />
                <div style={s.cardTitulo}>DATOS DEL EQUIPO</div>
              </div>
              <div style={s.datosGrid}>
                {datosGrid.map(([label, value]) => (
                  <div key={label} style={{ textAlign: "center" }}>
                    <div style={s.datoLabel}>{label}</div>
                    <div style={s.datoValor}>{value || "—"}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={s.card}>
              <div style={s.cardHeaderCenter}>
                <SvgAlerta />
                <div style={s.cardTitulo}>OBSERVACIÓN · CAUSA · RECOMENDACIÓN</div>
              </div>
              {obs.length > 0 ? (
                <>
                  <div style={s.ocrHead}>
                    <div></div><div>OBSERVACIÓN</div><div>CAUSA</div><div>RECOMENDACIÓN</div>
                  </div>
                  {obs.map((o, i) => (
                    <div key={i} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <div style={s.ocrRow}>
                        <div style={s.ocrNum}>{i + 1}</div>
                        <div style={s.ocrObs}>{o.texto}</div>
                        <div style={s.ocrCausa}>{o.causa || "—"}</div>
                        <div style={s.ocrRec}>{rec[i] ? (typeof rec[i] === "string" ? rec[i] : rec[i]?.texto || "—") : "—"}</div>
                      </div>
                      {(o.fecha || o.tecnico) && (
                        <div style={s.ocrFecha}>{o.fecha}{o.fecha && o.tecnico ? " · " : ""}{o.tecnico ? "Téc: " + o.tecnico : ""}</div>
                      )}
                    </div>
                  ))}
                </>
              ) : (
                <div style={s.vacio}>Sin observaciones registradas</div>
              )}
            </div>

            {getCor().length > 0 && (
              <div style={s.card}>
                <div style={s.cardHeaderCenter}>
                  <SvgLlave />
                  <div style={s.cardTitulo}>CORRECTIVOS REALIZADOS</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {getCor().map((c, i) => (
                    <div key={i} style={s.corItem}>
                      <span style={{ fontSize: "13.5px", fontWeight: 600, color: "#26314d" }}>{typeof c === "object" ? c.descripcion : c}</span>
                      {typeof c === "object" && c.fecha && <span style={{ fontSize: "12px", color: "#8a92a6", fontWeight: 600 }}>{c.fecha}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={s.card}>
              <div style={s.cardHeaderCenter}>
                <SvgCalendario color="#1a4fc0" />
                <div style={s.cardTitulo}>CRONOGRAMA DE MANTENIMIENTO</div>
                {equipo.frecuencia && <span style={s.freqBadge}>{equipo.frecuencia.toUpperCase()}</span>}
              </div>
              <div style={s.cronGrid}>
                {cron.map((t, i) => {
                  const b = cronBadge(t.estado);
                  return (
                    <div key={i} style={s.cronCard}>
                      <div style={s.cronLabel}>{t.label}</div>
                      <div style={s.cronFecha}>{t.fecha || "Sin fecha"}</div>
                      <span style={{ ...s.cronStatus, background: b.bg, color: b.color }}>{b.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {!sinQR && (
              <div style={s.card}>
                <div style={s.cardHeaderCenter}>
                  <SvgQR />
                  <div style={s.cardTitulo}>CÓDIGO QR</div>
                </div>
                <div style={{ display: "flex", gap: "24px", alignItems: "flex-start", flexWrap: "wrap", justifyContent: "center" }}>
                  <div style={{ textAlign: "center" }}>
                    <img src={qrUrl} alt="QR" style={{ width: px, height: px, border: "1px solid #eef1f6", borderRadius: "12px" }} />
                    <div style={{ fontSize: "11px", color: "#8a92a6", marginTop: "6px", fontWeight: 600 }}>Vista previa</div>
                  </div>
                  <div style={{ flex: 1, minWidth: "220px" }}>
                    <div style={{ fontSize: "12px", color: "#8a92a6", fontWeight: 700, marginBottom: "10px" }}>Tamaño de impresión</div>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "14px" }}>
                      {["2x2", "3x3", "5x5", "personalizado"].map(t => (
                        <div key={t} onClick={() => setTamanoQR(t)} style={{ ...s.tamañoOpt, ...(tamanoQR === t ? s.tamañoOptActivo : {}) }}>
                          {t === "personalizado" ? "Personalizado" : `${t} cm`}
                        </div>
                      ))}
                    </div>
                    {tamanoQR === "personalizado" && (
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", background: "#f9fafc", borderRadius: "10px", border: "1px solid #dfe6f5", marginBottom: "14px" }}>
                        <span style={{ fontSize: "12px", color: "#8a92a6", whiteSpace: "nowrap" }}>Escala:</span>
                        <input type="range" min="1" max="10" value={escala} onChange={e => setEscala(Number(e.target.value))} style={{ flex: 1 }} />
                        <span style={{ fontSize: "13px", fontWeight: 700, minWidth: "36px", color: "#12245e" }}>{escala} cm</span>
                      </div>
                    )}
                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                      <button style={s.btnOutlineSm} onClick={imprimirQR}><SvgPrint /> Imprimir QR</button>
                      <button style={{ ...s.btnOutlineSm, background: "#1a4fc0", color: "white", borderColor: "#1a4fc0" }} onClick={() => generarPDF("descargar")} disabled={imprimiendo}>
                        <SvgDownload color="white" /> {imprimiendo ? "Generando..." : "Descargar PDF"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Iconos inline (mismo trazo que el handoff de Claude Design) ----
const SvgUbicacion = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ marginTop: "2px", flexShrink: 0 }}>
    <path d="M4 21V7l8-4 8 4v14M9 21v-6h6v6" stroke="#1a4fc0" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const SvgPin = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ marginTop: "2px", flexShrink: 0 }}>
    <path d="M12 21s7-6.5 7-11.5A7 7 0 0 0 5 9.5C5 14.5 12 21 12 21z" stroke="#1a4fc0" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="12" cy="9.5" r="2.3" stroke="#1a4fc0" strokeWidth="1.7" />
  </svg>
);
const SvgCalendario = ({ color = "#1a4fc0" }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <rect x="4" y="5" width="16" height="15" rx="2" stroke={color} strokeWidth="1.7" />
    <path d="M4 10h16M8 3v4M16 3v4" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);
const SvgPrint = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <rect x="4" y="9" width="16" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
    <path d="M7 9V4h10v5M7 20h10v-4H7v4z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
  </svg>
);
const SvgDownload = ({ color = "currentColor" }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const SvgFicha = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <rect x="4.5" y="4" width="15" height="17" rx="1.6" stroke="#c23b1c" strokeWidth="1.7" />
    <path d="M9.2 4.6a2.8 2.8 0 0 1 5.6 0" stroke="#c23b1c" strokeWidth="1.7" />
  </svg>
);
const SvgAlerta = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M12 3l9 16H3l9-16z" stroke="#d99a1c" strokeWidth="1.7" strokeLinejoin="round" />
    <path d="M12 10v3.5M12 16.5h.01" stroke="#d99a1c" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);
const SvgLlave = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M14.7 6.3a3 3 0 0 1-3.9 3.9L5 16v3h3l5.8-5.8a3 3 0 0 1 3.9-3.9l-2.2 2.2-1.4-1.4 2.2-2.2z" stroke="#1a4fc0" strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
);
const SvgQR = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="7" height="7" rx="1" stroke="#1a4fc0" strokeWidth="1.7" />
    <rect x="14" y="3" width="7" height="7" rx="1" stroke="#1a4fc0" strokeWidth="1.7" />
    <rect x="3" y="14" width="7" height="7" rx="1" stroke="#1a4fc0" strokeWidth="1.7" />
    <path d="M14 14h3v3h-3zM19 14h2M14 19h2M19 19h2" stroke="#1a4fc0" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

const FONT = "'Manrope', -apple-system, sans-serif";

const s = {
  page: { minHeight: "100vh", background: "#eef1f6", fontFamily: FONT },
  navbar: { background: "white", borderBottom: "1px solid #e7ebf3", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10 },
  navLeft: { display: "flex", alignItems: "center", gap: "12px" },
  navLogo: { width: "26px", height: "26px", objectFit: "contain" },
  div: { width: "1px", height: "18px", background: "#e7ebf3" },
  btnBack: { background: "none", border: "none", color: "#1a4fc0", cursor: "pointer", fontSize: "13px", fontWeight: 700, padding: 0, fontFamily: "inherit" },
  badge: { padding: "4px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: 700, whiteSpace: "nowrap" },
  content: { maxWidth: "1200px", margin: "0 auto", padding: "24px 24px 60px" },
  headerRow: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" },
  headerTitulo: { fontWeight: 800, fontSize: "17px", color: "#12245e" },
  headerFecha: { marginLeft: "auto", color: "#8a92a6", fontWeight: 600, fontSize: "12.5px" },
  layout: { display: "flex", gap: "20px", alignItems: "flex-start", flexWrap: "wrap" },
  sidebar: { width: "260px", flexShrink: 0, display: "flex", flexDirection: "column", gap: "14px" },
  sCardCenter: { background: "white", borderRadius: "16px", padding: "22px 18px", boxShadow: "0 2px 10px rgba(20,40,90,0.06)", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", textAlign: "center" },
  sLogoBox: { width: "60px", height: "60px", borderRadius: "14px", background: "#1a4fc0", display: "flex", alignItems: "center", justifyContent: "center" },
  sLogoImg: { width: "46px", height: "46px", objectFit: "contain", filter: "brightness(0) invert(1)" },
  sNombre: { fontWeight: 800, fontSize: "15px", color: "#12245e", lineHeight: 1.3 },
  sTipo: { background: "#e5f0ff", color: "#1a4fc0", fontWeight: 700, fontSize: "11.5px", padding: "3px 11px", borderRadius: "20px" },
  sCard: { background: "white", borderRadius: "16px", padding: "16px 18px", boxShadow: "0 2px 10px rgba(20,40,90,0.06)", display: "flex", flexDirection: "column", gap: "8px" },
  sLbl: { fontWeight: 700, fontSize: "11px", color: "#8a92a6", letterSpacing: "0.05em" },
  sRow: { display: "flex", alignItems: "flex-start", gap: "8px" },
  sVal: { fontSize: "13.5px", fontWeight: 700, color: "#26314d" },
  sValMuted: { fontSize: "12.5px", fontWeight: 600, color: "#6b7488", lineHeight: 1.4 },
  sValStrong: { fontWeight: 700, fontSize: "13.5px", color: "#12245e" },
  sCodigo: { fontWeight: 700, fontSize: "14px", color: "#12245e" },
  btnOutline: { width: "100%", boxSizing: "border-box", background: "white", color: "#1a4fc0", border: "1.5px solid #a9c8fb", borderRadius: "12px", padding: "11px 14px", fontFamily: "inherit", fontWeight: 700, fontSize: "12.5px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "7px" },
  main: { flex: 1, minWidth: "320px", display: "flex", flexDirection: "column", gap: "18px" },
  card: { background: "white", borderRadius: "16px", padding: "24px 26px", boxShadow: "0 2px 10px rgba(20,40,90,0.06)", display: "flex", flexDirection: "column", gap: "16px" },
  cardHeaderCenter: { display: "flex", alignItems: "center", gap: "8px", justifyContent: "center" },
  cardTitulo: { fontWeight: 800, fontSize: "13px", color: "#26314d", letterSpacing: "0.07em" },
  freqBadge: { background: "#e5f0ff", color: "#1a4fc0", fontWeight: 700, fontSize: "10.5px", padding: "3px 9px", borderRadius: "20px", letterSpacing: "0.04em" },
  datosGrid: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "20px 14px" },
  datoLabel: { fontWeight: 600, fontSize: "11.5px", color: "#8a92a6" },
  datoValor: { fontWeight: 700, fontSize: "14px", color: "#0f1b3d", marginTop: "5px" },
  ocrHead: { display: "grid", gridTemplateColumns: "28px 2fr 1fr 1fr", gap: "10px", fontWeight: 700, fontSize: "10.5px", color: "#8a92a6", letterSpacing: "0.05em", textAlign: "center" },
  ocrRow: { display: "grid", gridTemplateColumns: "28px 2fr 1fr 1fr", gap: "10px", alignItems: "stretch" },
  ocrNum: { display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "#8a92a6", fontSize: "12.5px" },
  ocrObs: { background: "#fff8e6", border: "1px solid #f3dfa3", borderRadius: "10px", padding: "10px 13px", fontSize: "12.5px", fontWeight: 600, color: "#8a5b0a", textAlign: "center", lineHeight: 1.4 },
  ocrCausa: { background: "#fdeeee", border: "1px solid #f6d3d3", borderRadius: "10px", padding: "10px 13px", fontSize: "12.5px", fontWeight: 700, color: "#a52b2b", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center" },
  ocrRec: { background: "#e6f7ec", border: "1px solid #c3ecd2", borderRadius: "10px", padding: "10px 13px", fontSize: "12.5px", fontWeight: 700, color: "#1c7a44", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center" },
  ocrFecha: { textAlign: "center", fontSize: "11px", fontWeight: 600, color: "#8a92a6" },
  corItem: { padding: "11px 14px", background: "#f9fafc", borderRadius: "10px", borderLeft: "3px solid #1a4fc0", display: "flex", justifyContent: "space-between", alignItems: "center" },
  cronGrid: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "14px" },
  cronCard: { border: "1px solid #eef1f6", borderRadius: "12px", padding: "14px", textAlign: "center", display: "flex", flexDirection: "column", gap: "7px", background: "#fafbfd" },
  cronLabel: { fontWeight: 700, fontSize: "13px", color: "#12245e" },
  cronFecha: { fontSize: "12px", color: "#8a92a6", fontWeight: 600 },
  cronStatus: { fontWeight: 700, fontSize: "10.5px", padding: "3px 9px", borderRadius: "20px", alignSelf: "center" },
  tamañoOpt: { padding: "7px 12px", border: "1px solid #dfe6f5", borderRadius: "9px", fontSize: "12px", fontWeight: 600, color: "#26314d", cursor: "pointer", background: "#f9fafc" },
  tamañoOptActivo: { background: "#1a4fc0", color: "white", borderColor: "#1a4fc0" },
  btnOutlineSm: { fontSize: "12.5px", padding: "9px 16px", borderRadius: "10px", border: "1.5px solid #a9c8fb", background: "white", color: "#1a4fc0", cursor: "pointer", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px", fontFamily: "inherit" },
  vacio: { fontSize: "12.5px", color: "#aab1c2", fontStyle: "italic", textAlign: "center", padding: "6px 0" },
  centro: { textAlign: "center", padding: "3rem", fontSize: "15px", color: "#8a92a6", fontFamily: FONT },
};
