import { useState } from "react";
import { db } from "../firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

// Flujo público al escanear el QR de un equipo: elegir Cliente o Técnico,
// validar código de acceso, y mostrar el menú correspondiente.
export default function AccesoEquipo({ equipo, onVerInforme }) {
  const [pantalla, setPantalla] = useState("landing"); // landing | codigo | menu | averia | enviado
  const [tipo, setTipo] = useState(null); // "cliente" | "tecnico"
  const [codigo, setCodigo] = useState("");
  const [nombreTecnico, setNombreTecnico] = useState("");
  const [error, setError] = useState("");
  const [validando, setValidando] = useState(false);
  const [mensajeAveria, setMensajeAveria] = useState("");
  const [enviandoAveria, setEnviandoAveria] = useState(false);

  const elegirTipo = (t) => {
    setTipo(t);
    setError("");
    setCodigo("");
    setPantalla("codigo");
  };

  // Códigos de acceso universales: 0001 para clientes, 1001 para técnicos.
  const CODIGO_CLIENTE = "0001";
  const CODIGO_TECNICO = "1001";

  const validarCodigo = async () => {
    setError("");
    if (!codigo.trim()) { setError("Ingresa un código."); return; }
    setValidando(true);
    const esperado = tipo === "cliente" ? CODIGO_CLIENTE : CODIGO_TECNICO;
    if (codigo.trim() === esperado) {
      if (tipo === "tecnico") setNombreTecnico("Técnico");
      setPantalla("menu");
    } else {
      setError("Código incorrecto.");
    }
    setValidando(false);
  };

  const enviarAveria = async () => {
    if (!mensajeAveria.trim()) return;
    setEnviandoAveria(true);
    try {
      await addDoc(collection(db, "averias"), {
        equipoId: equipo.id,
        equipoCodigo: equipo.codigo || "",
        cliente: equipo.cliente || "",
        sede: equipo.sede || "",
        ambiente: equipo.ambiente || "",
        piso: equipo.piso || "",
        tipoReportante: tipo === "tecnico" ? "Técnico" : "Cliente",
        nombreReportante: tipo === "tecnico" ? nombreTecnico : (equipo.cliente || "Cliente"),
        mensaje: mensajeAveria.trim(),
        fecha: serverTimestamp(),
        atendida: false,
      });
      setPantalla("enviado");
    } catch (e) {
      setError("No se pudo enviar el reporte. Intenta de nuevo.");
    }
    setEnviandoAveria(false);
  };

  const s = {
    page: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f0f4f8", fontFamily: "-apple-system, 'SF Pro Text', Inter, Arial, sans-serif", padding: "20px" },
    card: { width: "100%", maxWidth: "380px", background: "white", borderRadius: "18px", padding: "28px 22px", boxShadow: "0 2px 16px rgba(0,0,0,0.08)", border: "0.5px solid #eee" },
    logo: { fontSize: "20px", fontWeight: 600, textAlign: "center", marginBottom: "10px", letterSpacing: "0.02em" },
    headerMeta: { display: "flex", alignItems: "center", justifyContent: "center", flexWrap: "wrap", gap: "6px", marginBottom: "3px" },
    codBadge: { fontFamily: "monospace", fontSize: "11px", fontWeight: 600, padding: "3px 8px", borderRadius: "6px", background: "#f3e5f5", color: "#6a1b9a" },
    modeloTxt: { fontSize: "13px", color: "#222", fontWeight: 500 },
    dot: { fontSize: "13px", color: "#bbb" },
    serieTxt: { fontFamily: "monospace", fontSize: "12px", color: "#666" },
    ambienteTxt: { textAlign: "center", fontSize: "13px", color: "#888", marginBottom: "22px" },
    optCard: { border: "0.5px solid #e0e0e0", borderRadius: "14px", padding: "16px", display: "flex", alignItems: "center", gap: "14px", cursor: "pointer", marginBottom: "10px", background: "white" },
    optCardAccent: { border: "1.5px solid #1a5fa8", background: "#f3f8fe" },
    optChip: { width: "44px", height: "44px", borderRadius: "11px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "20px" },
    optTitulo: { fontSize: "15px", fontWeight: 600, color: "#1a1a1a" },
    optSub: { fontSize: "12.5px", color: "#888", marginTop: "2px" },
    chevron: { fontSize: "18px", color: "#bbb", flexShrink: 0 },
    back: { fontSize: "13px", color: "#1a5fa8", cursor: "pointer", marginBottom: "16px", display: "block", textAlign: "center" },
    field: { width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #ddd", fontSize: "18px", textAlign: "center", letterSpacing: "3px", marginBottom: "10px", boxSizing: "border-box" },
    actBtn: { width: "100%", height: "46px", borderRadius: "10px", border: "none", background: "#1a5fa8", color: "white", fontSize: "14px", fontWeight: 600, cursor: "pointer", marginBottom: "8px" },
    errTxt: { fontSize: "12px", color: "#c62828", marginBottom: "10px", textAlign: "center" },
    menuItem: { border: "0.5px solid #e0e0e0", borderRadius: "12px", padding: "13px 14px", display: "flex", alignItems: "center", gap: "12px", cursor: "pointer", marginBottom: "8px", background: "white" },
    menuItemAveria: { border: "0.5px solid #f0997b", background: "#fef0f0" },
    menuChip: { width: "36px", height: "36px", borderRadius: "9px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "16px" },
    menuT: { fontSize: "14px", fontWeight: 600, color: "#1a1a1a" },
    menuS: { fontSize: "11.5px", color: "#888", marginTop: "1px" },
    textarea: { width: "100%", minHeight: "90px", padding: "10px", borderRadius: "10px", border: "1px solid #ddd", fontSize: "13px", marginBottom: "12px", boxSizing: "border-box", fontFamily: "inherit" },
    footer: { textAlign: "center", fontSize: "10.5px", color: "#bbb", marginTop: "18px" },
  };

  const equipoLabel = `${equipo.marca || ""} ${equipo.modelo || ""}`.trim() || equipo.tipoEquipo || "Equipo HVAC";

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.logo}><span style={{ color: "#1a5fa8" }}>HVAC</span></div>

        <div style={s.headerMeta}>
          {equipo.codigo && <span style={s.codBadge}>{equipo.codigo}</span>}
          <span style={s.modeloTxt}>{equipoLabel}</span>
          {equipo.serie && (
            <>
              <span style={s.dot}>·</span>
              <span style={s.serieTxt}>S/N {equipo.serie}</span>
            </>
          )}
        </div>
        <div style={s.ambienteTxt}>{equipo.ambiente || ""}</div>

        {pantalla === "landing" && (
          <>
            <div style={{ ...s.optCard, ...s.optCardAccent }} onClick={() => elegirTipo("cliente")}>
              <div style={{ ...s.optChip, background: "#e6f1fb" }}>👤</div>
              <div style={{ flex: 1 }}>
                <div style={s.optTitulo}>Cliente</div>
                <div style={s.optSub}>Ver informe o reportar avería</div>
              </div>
              <span style={{ ...s.chevron, color: "#1a5fa8" }}>›</span>
            </div>
            <div style={s.optCard} onClick={() => elegirTipo("tecnico")}>
              <div style={{ ...s.optChip, background: "#f0f4f8" }}>🔧</div>
              <div style={{ flex: 1 }}>
                <div style={s.optTitulo}>Técnico</div>
                <div style={s.optSub}>Ver informe, Registrar mantenimiento, Reportar avería</div>
              </div>
              <span style={s.chevron}>›</span>
            </div>
          </>
        )}

        {pantalla === "codigo" && (
          <>
            <span style={s.back} onClick={() => setPantalla("landing")}>← Volver</span>
            <div style={{ fontSize: "13px", color: "#555", marginBottom: "10px", textAlign: "center" }}>
              Ingresa el código de {tipo === "tecnico" ? "técnico" : "acceso del cliente"}
            </div>
            <input
              style={s.field}
              placeholder="Código"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && validarCodigo()}
            />
            {error && <div style={s.errTxt}>{error}</div>}
            <button style={s.actBtn} onClick={validarCodigo} disabled={validando}>
              {validando ? "Validando..." : "Ingresar"}
            </button>
          </>
        )}

        {pantalla === "menu" && tipo === "cliente" && (
          <>
            <span style={s.back} onClick={() => setPantalla("landing")}>← Salir</span>
            <div style={s.menuItem} onClick={onVerInforme}>
              <div style={{ ...s.menuChip, background: "#e6f1fb" }}>📄</div>
              <div style={{ flex: 1 }}>
                <div style={s.menuT}>Ver informe</div>
                <div style={s.menuS}>PDF con datos del equipo</div>
              </div>
              <span style={s.chevron}>›</span>
            </div>
            <div style={{ ...s.menuItem, ...s.menuItemAveria }} onClick={() => setPantalla("averia")}>
              <div style={{ ...s.menuChip, background: "white" }}>⚠️</div>
              <div style={{ flex: 1 }}>
                <div style={{ ...s.menuT, color: "#c62828" }}>Reportar avería</div>
                <div style={{ ...s.menuS, color: "#a32d2d" }}>Describir el problema</div>
              </div>
              <span style={{ ...s.chevron, color: "#c62828" }}>›</span>
            </div>
          </>
        )}

        {pantalla === "menu" && tipo === "tecnico" && (
          <>
            <span style={s.back} onClick={() => setPantalla("landing")}>← Salir</span>
            <div style={s.menuItem} onClick={onVerInforme}>
              <div style={{ ...s.menuChip, background: "#e6f1fb" }}>📋</div>
              <div style={{ flex: 1 }}>
                <div style={s.menuT}>Ver ficha técnica</div>
                <div style={s.menuS}>Datos del equipo</div>
              </div>
              <span style={s.chevron}>›</span>
            </div>
            <div style={s.menuItem} onClick={() => window.location.href = `/protocolo?equipo=${equipo.id}&tecnico=1`}>
              <div style={{ ...s.menuChip, background: "#e8f5e9" }}>✅</div>
              <div style={{ flex: 1 }}>
                <div style={s.menuT}>Registrar mantenimiento</div>
                <div style={s.menuS}>Checklist, parámetros y observaciones</div>
              </div>
              <span style={s.chevron}>›</span>
            </div>
            <div style={{ ...s.menuItem, ...s.menuItemAveria }} onClick={() => setPantalla("averia")}>
              <div style={{ ...s.menuChip, background: "white" }}>⚠️</div>
              <div style={{ flex: 1 }}>
                <div style={{ ...s.menuT, color: "#c62828" }}>Reportar avería</div>
                <div style={{ ...s.menuS, color: "#a32d2d" }}>Describir el problema</div>
              </div>
              <span style={{ ...s.chevron, color: "#c62828" }}>›</span>
            </div>
          </>
        )}

        {pantalla === "averia" && (
          <>
            <span style={s.back} onClick={() => setPantalla("menu")}>← Volver</span>
            <div style={{ fontSize: "13px", color: "#555", marginBottom: "8px" }}>
              Describe el problema que presenta el equipo
            </div>
            <textarea
              style={s.textarea}
              placeholder="El equipo hace un ruido extraño y no enfría bien..."
              value={mensajeAveria}
              onChange={(e) => setMensajeAveria(e.target.value)}
            />
            {error && <div style={s.errTxt}>{error}</div>}
            <button style={s.actBtn} onClick={enviarAveria} disabled={enviandoAveria}>
              {enviandoAveria ? "Enviando..." : "Enviar reporte"}
            </button>
          </>
        )}

        {pantalla === "enviado" && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: "36px", marginBottom: "10px" }}>✅</div>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "#2e7d32", marginBottom: "6px" }}>Reporte enviado</div>
            <div style={{ fontSize: "12px", color: "#888" }}>El equipo de mantenimiento fue notificado.</div>
          </div>
        )}

        <div style={s.footer}>HVAC Sistema de Mantenimiento</div>
      </div>
    </div>
  );
}
