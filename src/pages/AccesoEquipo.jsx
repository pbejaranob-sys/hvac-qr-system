import { useState } from "react";
import { db } from "../firebase";
import { collection, addDoc, query, where, getDocs, serverTimestamp } from "firebase/firestore";

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

  const validarCodigo = async () => {
    setError("");
    if (!codigo.trim()) { setError("Ingresa un código."); return; }
    setValidando(true);
    try {
      if (tipo === "cliente") {
        // El código de acceso del cliente es el N° de contrato del equipo.
        const esperado = (equipo.contrato || "").trim();
        if (!esperado) {
          // Sin contrato configurado: no bloquear, dejar pasar.
          setPantalla("menu");
        } else if (codigo.trim() === esperado) {
          setPantalla("menu");
        } else {
          setError("Código incorrecto.");
        }
      } else {
        // Técnico: se valida contra la colección "tecnicos" (campo "codigo").
        const q = query(collection(db, "tecnicos"), where("codigo", "==", codigo.trim()));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const t = snap.docs[0].data();
          setNombreTecnico(t.nombre || "Técnico");
          setPantalla("menu");
        } else {
          setError("Código de técnico no válido.");
        }
      }
    } catch (e) {
      setError("Error al validar. Intenta de nuevo.");
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
    page: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f0f4f8", fontFamily: "Arial,sans-serif", padding: "20px" },
    card: { width: "100%", maxWidth: "360px", background: "white", borderRadius: "16px", padding: "24px", boxShadow: "0 2px 12px rgba(0,0,0,0.08)" },
    logo: { fontSize: "18px", fontWeight: 700, textAlign: "center", marginBottom: "4px" },
    eqInfo: { fontSize: "12px", color: "#888", textAlign: "center", marginBottom: "20px" },
    bigBtn: { width: "100%", padding: "18px", borderRadius: "12px", border: "1px solid #e0e0e0", background: "#fafbfc", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", cursor: "pointer", marginBottom: "12px" },
    bigIcon: { fontSize: "26px" },
    bigLbl: { fontSize: "15px", fontWeight: 700, color: "#222" },
    bigSub: { fontSize: "11px", color: "#888" },
    back: { fontSize: "13px", color: "#1a5fa8", cursor: "pointer", marginBottom: "12px", display: "inline-block" },
    field: { width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "18px", textAlign: "center", letterSpacing: "3px", marginBottom: "10px", boxSizing: "border-box" },
    actBtn: { width: "100%", padding: "13px", borderRadius: "8px", border: "none", background: "#1a5fa8", color: "white", fontSize: "14px", fontWeight: 700, cursor: "pointer", marginBottom: "8px" },
    errTxt: { fontSize: "12px", color: "#c62828", marginBottom: "10px", textAlign: "center" },
    menuItem: { display: "flex", alignItems: "center", gap: "12px", padding: "14px", borderRadius: "10px", background: "#fafbfc", border: "1px solid #eee", marginBottom: "10px", cursor: "pointer" },
    menuIcon: { fontSize: "20px" },
    menuT: { fontSize: "14px", fontWeight: 700, color: "#222" },
    menuS: { fontSize: "11px", color: "#888" },
    textarea: { width: "100%", minHeight: "90px", padding: "10px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "13px", marginBottom: "12px", boxSizing: "border-box", fontFamily: "Arial,sans-serif" },
  };

  const equipoLabel = `${equipo.marca || ""} ${equipo.modelo || ""}`.trim() || equipo.tipoEquipo || "Equipo HVAC";

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.logo}><span style={{ color: "#1a5fa8" }}>HVAC</span></div>
        <div style={s.eqInfo}>
          {equipo.codigo && <span style={{ fontFamily: "monospace", background: "#f3e5f5", color: "#6a1b9a", padding: "2px 6px", borderRadius: "4px", marginRight: "6px" }}>{equipo.codigo}</span>}
          {equipoLabel} · {equipo.ambiente || ""}
        </div>

        {pantalla === "landing" && (
          <>
            <div style={s.bigBtn} onClick={() => elegirTipo("cliente")}>
              <div style={s.bigIcon}>👤</div>
              <div style={s.bigLbl}>Cliente</div>
              <div style={s.bigSub}>Ver informe o reportar avería</div>
            </div>
            <div style={s.bigBtn} onClick={() => elegirTipo("tecnico")}>
              <div style={s.bigIcon}>🔧</div>
              <div style={s.bigLbl}>Técnico</div>
              <div style={s.bigSub}>Ficha técnica, mantenimiento y avería</div>
            </div>
          </>
        )}

        {pantalla === "codigo" && (
          <>
            <span style={s.back} onClick={() => setPantalla("landing")}>← Volver</span>
            <div style={{ fontSize: "13px", color: "#555", marginBottom: "10px" }}>
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
              <div style={s.menuIcon}>📄</div>
              <div>
                <div style={s.menuT}>Ver informe</div>
                <div style={s.menuS}>PDF con datos del equipo</div>
              </div>
            </div>
            <div style={s.menuItem} onClick={() => setPantalla("averia")}>
              <div style={s.menuIcon}>⚠️</div>
              <div>
                <div style={s.menuT}>Reportar avería</div>
                <div style={s.menuS}>Describir el problema</div>
              </div>
            </div>
          </>
        )}

        {pantalla === "menu" && tipo === "tecnico" && (
          <>
            <span style={s.back} onClick={() => setPantalla("landing")}>← Salir</span>
            <div style={s.menuItem} onClick={onVerInforme}>
              <div style={s.menuIcon}>📋</div>
              <div>
                <div style={s.menuT}>Ver ficha técnica</div>
                <div style={s.menuS}>Datos del equipo</div>
              </div>
            </div>
            <div style={s.menuItem} onClick={() => window.location.href = `/protocolo?equipo=${equipo.id}`}>
              <div style={s.menuIcon}>✅</div>
              <div>
                <div style={s.menuT}>Registrar mantenimiento</div>
                <div style={s.menuS}>Checklist, parámetros y observaciones</div>
              </div>
            </div>
            <div style={s.menuItem} onClick={() => setPantalla("averia")}>
              <div style={s.menuIcon}>⚠️</div>
              <div>
                <div style={s.menuT}>Reportar avería</div>
                <div style={s.menuS}>Describir el problema</div>
              </div>
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

        <div style={{ fontSize: "10px", color: "#bbb", textAlign: "center", marginTop: "16px" }}>
          HVAC Sistema de Mantenimiento
        </div>
      </div>
    </div>
  );
}
