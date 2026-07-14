import { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

// Fuente Manrope (usada en el diseño de Claude Design) — se inyecta una sola vez.
function useManropeFont() {
  useEffect(() => {
    if (document.getElementById("font-manrope")) return;
    const link = document.createElement("link");
    link.id = "font-manrope";
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&display=swap";
    document.head.appendChild(link);
  }, []);
}

// ---- Iconos inline (SVG), tal como en el handoff ----
const IconPersona = ({ color = "#1a4fc0" }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="8" r="3.5" stroke={color} strokeWidth="1.6" />
    <path d="M5 20c1.2-4 4-6 7-6s5.8 2 7 6" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);
const IconLlave = ({ color = "#ffffff" }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M14.7 6.3a3 3 0 0 1-3.9 3.9L5 16v3h3l5.8-5.8a3 3 0 0 1 3.9-3.9l-2.2 2.2-1.4-1.4 2.2-2.2z" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
);
const IconCandado = () => (
  <svg width="52%" height="52%" viewBox="0 0 24 24" fill="none">
    <rect x="5" y="10" width="14" height="10" rx="2" stroke="white" strokeWidth="1.6" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="white" strokeWidth="1.6" />
  </svg>
);
const IconChevron = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M9 6l6 6-6 6" stroke="#9aa2b3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconFicha = ({ color }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <rect x="4.5" y="4" width="15" height="17" rx="1.6" stroke={color} strokeWidth="1.7" />
    <path d="M9.2 4.6a2.8 2.8 0 0 1 5.6 0" stroke={color} strokeWidth="1.7" />
    <rect x="8.6" y="3.2" width="6.8" height="3.2" rx="0.8" stroke={color} strokeWidth="1.7" fill="#e5f0ff" />
    <circle cx="8" cy="10.4" r="0.9" fill={color} />
    <line x1="10.4" y1="10.4" x2="16" y2="10.4" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    <circle cx="8" cy="13.2" r="0.9" fill={color} />
    <line x1="10.4" y1="13.2" x2="16" y2="13.2" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    <circle cx="8" cy="16" r="0.9" fill={color} />
    <line x1="10.4" y1="16" x2="16" y2="16" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    <rect x="7.6" y="18" width="8.4" height="2.6" rx="0.5" stroke={color} strokeWidth="1.6" />
  </svg>
);
const IconCheck = ({ color }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M5 13l4 4 10-10" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconAlerta = ({ color }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M12 3l9 16H3l9-16z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 10v4M12 17h.01" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);
const IconFlechaAtras = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path d="M15 18l-6-6 6-6" stroke="#1a4fc0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// Flujo público al escanear el QR de un equipo: elegir Cliente o Técnico,
// validar contraseña de 4 dígitos, y llegar al menú de acciones por rol.
export default function AccesoEquipo({ equipo, onVerInforme }) {
  useManropeFont();

  const [vista, setVista] = useState("home"); // home | password | menu | averia | enviado
  const [rol, setRol] = useState(null); // "cliente" | "tecnico"
  const [codigo, setCodigo] = useState("");
  const [hasError, setHasError] = useState(false);
  const [mensajeAveria, setMensajeAveria] = useState("");
  const [enviandoAveria, setEnviandoAveria] = useState(false);
  const [errorAveria, setErrorAveria] = useState("");

  // Contraseñas de acceso: Cliente = 0001, Técnico = 1001.
  const CODIGOS = { cliente: "0001", tecnico: "1001" };
  const LABELS = { cliente: "Cliente", tecnico: "Técnico" };

  const elegirRol = (r) => {
    setRol(r);
    setCodigo("");
    setHasError(false);
    setVista("password");
  };

  const onCodeChange = (e) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 4);
    setCodigo(digits);
    setHasError(false);
  };

  const enviarCodigo = () => {
    if (codigo === CODIGOS[rol]) {
      setHasError(false);
      setVista("menu");
    } else {
      setHasError(true);
      setCodigo("");
    }
  };

  const volverAHome = () => {
    setVista("home");
    setRol(null);
    setCodigo("");
    setHasError(false);
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
        tipoReportante: rol === "tecnico" ? "Técnico" : "Cliente",
        nombreReportante: rol === "tecnico" ? "Técnico" : (equipo.cliente || "Cliente"),
        mensaje: mensajeAveria.trim(),
        fecha: serverTimestamp(),
        atendida: false,
      });
      setVista("enviado");
    } catch (e) {
      setErrorAveria("No se pudo enviar el reporte. Intenta de nuevo.");
    }
    setEnviandoAveria(false);
  };

  // ---- Items del menú, según rol ----
  const menuItems = [
    {
      key: "ficha",
      title: "Ver ficha técnica",
      subtitle: "Datos del equipo",
      bg: "#ffffff", border: "#c3d6fb", iconBg: "#e5f0ff", titleColor: "#0f1b3d",
      icon: <IconFicha color="#1a4fc0" />,
      onClick: onVerInforme,
    },
    ...(rol === "tecnico" ? [{
      key: "mantenimiento",
      title: "Registrar mantenimiento",
      subtitle: "Checklist, parámetros y observaciones",
      bg: "#ffffff", border: "#c3d6fb", iconBg: "#e6f7ec", titleColor: "#0f1b3d",
      icon: <IconCheck color="#1c9a53" />,
      onClick: () => { window.location.href = `/protocolo?equipo=${equipo.id}&tecnico=1`; },
    }] : []),
    {
      key: "averia",
      title: "Reportar avería",
      subtitle: "Describir el problema",
      bg: "#fdeeee", border: "#f6d3d3", iconBg: "#fbdada", titleColor: "#a52b2b",
      icon: <IconAlerta color="#c23b3b" />,
      onClick: () => setVista("averia"),
    },
  ];

  // ============ HOME ============
  if (vista === "home") {
    return (
      <div style={st.homeBg}>
        <div style={st.homeCol}>
          <div style={st.homeLogoWrap}>
            <div style={st.homeLogoBox}>
              <img src="/assets/hvac-isotipo-filled.png" alt="HVAC Control" style={st.homeLogoImg} />
            </div>
          </div>
          <div style={st.homeBtnsWrap}>
            <button style={st.btnCliente} onClick={() => elegirRol("cliente")}>
              <IconPersona color="#1a4fc0" /> Cliente
            </button>
            <button style={st.btnTecnico} onClick={() => elegirRol("tecnico")}>
              <IconLlave color="#ffffff" /> Técnico
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============ PASSWORD ============
  if (vista === "password") {
    return (
      <div style={st.homeBg}>
        <div style={st.pwCol}>
          <div style={st.pwBadge}><IconCandado /></div>
          <div style={{ textAlign: "center" }}>
            <div style={st.pwTitulo}>Acceso {LABELS[rol]}</div>
            <div style={st.pwSub}>Ingresa tu contraseña de 4 dígitos</div>
          </div>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            autoFocus
            value={codigo}
            onChange={onCodeChange}
            onKeyDown={(e) => e.key === "Enter" && enviarCodigo()}
            placeholder="••••"
            style={st.pwInput}
          />
          {hasError && <div style={st.pwError}>Contraseña incorrecta, intenta de nuevo.</div>}
          <button style={st.pwBtnIngresar} onClick={enviarCodigo}>Ingresar</button>
          <button style={st.pwBtnVolver} onClick={volverAHome}>← Volver</button>
        </div>
      </div>
    );
  }

  // ============ MENU ============
  if (vista === "menu") {
    return (
      <div style={st.menuBg}>
        <div style={st.menuCol}>
          <div style={st.menuLogoWrap}>
            <img src="/assets/hvac-isotipo-blue.png" alt="HVAC Control" style={st.menuLogoImg} />
          </div>

          <div style={st.menuChipRow}>
            <span style={st.rolChip}>{LABELS[rol]}</span>
            <span style={st.dotMuted}>·</span>
            <span style={st.sesionTxt}>Sesión activa</span>
          </div>

          <div style={st.menuLista}>
            {menuItems.map(item => (
              <button
                key={item.key}
                onClick={item.onClick}
                style={{ ...st.menuItem, background: item.bg, border: `1px solid ${item.border}` }}
              >
                <div style={{ ...st.menuIconTile, background: item.iconBg }}>{item.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ ...st.menuItemTitulo, color: item.titleColor }}>{item.title}</div>
                  <div style={st.menuItemSub}>{item.subtitle}</div>
                </div>
                <IconChevron />
              </button>
            ))}
          </div>

          <button style={st.btnSalir} onClick={volverAHome}>
            <IconFlechaAtras /> Salir
          </button>

          <div style={st.footerTxt}>HVAC Sistema de Mantenimiento</div>
        </div>
      </div>
    );
  }

  // ============ REPORTAR AVERÍA ============
  if (vista === "averia") {
    return (
      <div style={st.menuBg}>
        <div style={st.pwCol}>
          <div style={{ width: "100%", background: "white", borderRadius: "20px", padding: "clamp(20px,5vw,28px)", boxShadow: "0 8px 24px rgba(15,27,61,0.08)", boxSizing: "border-box" }}>
            <div style={{ fontWeight: 800, fontSize: "clamp(16px,4.5vw,18px)", color: "#0f1b3d", marginBottom: "6px" }}>Reportar avería</div>
            <div style={{ color: "#6b7488", fontSize: "clamp(12px,3.2vw,13px)", marginBottom: "14px" }}>Describe el problema que presenta el equipo</div>
            <textarea
              value={mensajeAveria}
              onChange={(e) => setMensajeAveria(e.target.value)}
              placeholder="El equipo hace un ruido extraño y no enfría bien..."
              style={st.textarea}
            />
            {errorAveria && <div style={{ color: "#c23b3b", fontSize: "12px", marginBottom: "10px" }}>{errorAveria}</div>}
            <button
              onClick={enviarAveria}
              disabled={enviandoAveria}
              style={{ width: "100%", boxSizing: "border-box", background: "#1a4fc0", color: "#fff", border: "none", borderRadius: "14px", padding: "clamp(13px,3.4vh,16px) 20px", fontFamily: "inherit", fontWeight: 700, fontSize: "clamp(15px,4vw,16px)", cursor: "pointer", marginBottom: "8px" }}
            >
              {enviandoAveria ? "Enviando..." : "Enviar reporte"}
            </button>
            <button style={{ ...st.pwBtnVolver, color: "#1a4fc0", display: "block", margin: "0 auto" }} onClick={() => setVista("menu")}>← Volver</button>
          </div>
        </div>
      </div>
    );
  }

  // ============ ENVIADO ============
  return (
    <div style={st.menuBg}>
      <div style={st.pwCol}>
        <div style={{ width: "100%", background: "white", borderRadius: "20px", padding: "clamp(28px,7vw,36px) clamp(20px,5vw,28px)", boxShadow: "0 8px 24px rgba(15,27,61,0.08)", boxSizing: "border-box", textAlign: "center" }}>
          <div style={{ width: "52px", height: "52px", borderRadius: "50%", background: "#e6f7ec", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <IconCheck color="#1c9a53" />
          </div>
          <div style={{ fontWeight: 800, fontSize: "clamp(16px,4.5vw,18px)", color: "#0f1b3d" }}>Reporte enviado</div>
          <div style={{ color: "#5b6478", fontSize: "clamp(13px,3.6vw,14px)", marginTop: "8px", lineHeight: 1.5 }}>El equipo de mantenimiento fue notificado.</div>
        </div>
      </div>
    </div>
  );
}

// ============ ESTILOS (tokens exactos del handoff de Claude Design) ============
const FONT = "'Manrope', -apple-system, sans-serif";

const st = {
  // Home & Password comparten el fondo azul
  homeBg: {
    position: "relative", width: "100%", minHeight: "100vh", background: "#3d4feb",
    fontFamily: FONT, display: "flex", alignItems: "center", justifyContent: "center",
    boxSizing: "border-box", padding: "clamp(16px,5vw,32px)", overflow: "hidden",
  },
  homeCol: {
    position: "relative", zIndex: 1, width: "100%", maxWidth: "420px",
    minHeight: "min(88vh,780px)", display: "flex", flexDirection: "column", boxSizing: "border-box",
  },
  homeLogoWrap: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 0" },
  homeLogoBox: { width: "clamp(126px,33vw,168px)", height: "clamp(126px,33vw,168px)", display: "flex", alignItems: "center", justifyContent: "center" },
  homeLogoImg: {
    width: "100%", height: "100%", objectFit: "contain",
    filter: "drop-shadow(0.5px 0 0 #123a8f) drop-shadow(-0.5px 0 0 #123a8f) drop-shadow(0 0.5px 0 #123a8f) drop-shadow(0 -0.5px 0 #123a8f) drop-shadow(0 6px 14px rgba(0,20,80,0.25))",
  },
  homeBtnsWrap: { display: "flex", flexDirection: "column", alignItems: "center", gap: "clamp(10px,2.2vh,14px)", padding: "0 4px clamp(120px,22vh,170px)" },
  btnCliente: {
    width: "100%", boxSizing: "border-box", background: "#ffffff", color: "#1a4fc0", border: "none",
    borderRadius: "14px", padding: "clamp(14px,3.6vh,17px) 20px", fontFamily: "inherit", fontWeight: 700,
    fontSize: "clamp(15px,4vw,17px)", cursor: "pointer", boxShadow: "0 8px 20px rgba(0,20,80,0.18)",
    display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", transition: "transform 0.12s ease",
  },
  btnTecnico: {
    width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.14)", color: "#ffffff",
    border: "1.5px solid rgba(255,255,255,0.55)", borderRadius: "14px", padding: "clamp(14px,3.6vh,17px) 20px",
    fontFamily: "inherit", fontWeight: 700, fontSize: "clamp(15px,4vw,17px)", cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", transition: "transform 0.12s ease",
  },

  pwCol: {
    position: "relative", zIndex: 1, width: "100%", maxWidth: "380px",
    display: "flex", flexDirection: "column", alignItems: "center", gap: "clamp(18px,4vh,26px)",
  },
  pwBadge: {
    width: "clamp(68px,18vw,88px)", height: "clamp(68px,18vw,88px)", borderRadius: "26%",
    background: "rgba(255,255,255,0.12)", border: "1.5px solid rgba(255,255,255,0.28)",
    display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 10px 30px rgba(0,20,80,0.25)",
  },
  pwTitulo: { color: "#ffffff", fontWeight: 800, fontSize: "clamp(18px,5vw,22px)" },
  pwSub: { color: "rgba(255,255,255,0.7)", fontWeight: 500, fontSize: "clamp(12px,3.2vw,14px)", marginTop: "6px" },
  pwInput: {
    width: "100%", boxSizing: "border-box", textAlign: "center", letterSpacing: "0.6em",
    fontSize: "clamp(22px,7vw,28px)", fontWeight: 700, color: "#ffffff", background: "rgba(255,255,255,0.12)",
    border: "1.5px solid rgba(255,255,255,0.4)", borderRadius: "14px", padding: "clamp(12px,3vh,16px) 12px", fontFamily: "inherit",
  },
  pwError: { color: "#ffd7d7", fontWeight: 600, fontSize: "13px", marginTop: "-10px" },
  pwBtnIngresar: {
    width: "100%", boxSizing: "border-box", background: "#ffffff", color: "#1a4fc0", border: "none",
    borderRadius: "14px", padding: "clamp(13px,3.4vh,16px) 20px", fontFamily: "inherit", fontWeight: 700,
    fontSize: "clamp(15px,4vw,16px)", cursor: "pointer", boxShadow: "0 8px 20px rgba(0,20,80,0.18)",
  },
  pwBtnVolver: {
    background: "none", border: "none", color: "rgba(255,255,255,0.75)", fontFamily: "inherit",
    fontWeight: 600, fontSize: "clamp(12px,3.2vw,13px)", cursor: "pointer", padding: "6px",
  },

  // Menu (fondo claro)
  menuBg: {
    width: "100%", minHeight: "100vh", background: "#f4f6fb", fontFamily: FONT,
    display: "flex", alignItems: "flex-start", justifyContent: "center", boxSizing: "border-box",
    padding: "clamp(20px,6vw,40px) clamp(16px,5vw,24px)",
  },
  menuCol: {
    width: "100%", maxWidth: "480px", display: "flex", flexDirection: "column",
    alignItems: "center", gap: "clamp(16px,3vh,20px)",
  },
  menuLogoWrap: { display: "flex", alignItems: "center", justifyContent: "center", marginTop: "8px" },
  menuLogoImg: { width: "clamp(100px,26vw,132px)", height: "clamp(100px,26vw,132px)", objectFit: "contain" },
  menuChipRow: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", justifyContent: "center" },
  rolChip: { background: "#e7e4fb", color: "#5b4fd8", fontWeight: 700, fontSize: "12px", padding: "4px 10px", borderRadius: "7px" },
  dotMuted: { color: "#8a92a6", fontSize: "12px" },
  sesionTxt: { color: "#26314d", fontWeight: 600, fontSize: "13px" },
  menuLista: { width: "100%", display: "flex", flexDirection: "column", gap: "12px", marginTop: "8px" },
  menuItem: {
    width: "100%", boxSizing: "border-box", borderRadius: "16px",
    padding: "clamp(14px,3.4vh,18px) clamp(14px,3.4vw,18px)", display: "flex", alignItems: "center",
    gap: "14px", cursor: "pointer", textAlign: "left", fontFamily: "inherit", transition: "transform 0.12s ease",
  },
  menuIconTile: { width: "42px", height: "42px", minWidth: "42px", borderRadius: "11px", display: "flex", alignItems: "center", justifyContent: "center" },
  menuItemTitulo: { fontWeight: 700, fontSize: "clamp(14px,3.8vw,16px)" },
  menuItemSub: { fontWeight: 500, fontSize: "clamp(12px,3.2vw,13px)", color: "#6b7488", marginTop: "2px" },
  btnSalir: { background: "none", border: "none", color: "#1a4fc0", fontFamily: "inherit", fontWeight: 700, fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", padding: "4px" },
  footerTxt: { color: "#8a92a6", fontWeight: 600, fontSize: "12px", marginTop: "16px" },

  textarea: {
    width: "100%", minHeight: "100px", padding: "12px", borderRadius: "12px", border: "1px solid #dfe4ee",
    fontSize: "13px", marginBottom: "12px", boxSizing: "border-box", fontFamily: "inherit", resize: "vertical",
  },
};
