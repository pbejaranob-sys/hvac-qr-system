import { useEffect, useState, useRef } from "react";
import { auth, db } from "../firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

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
    document.body.style.background = "#dce6f7";
    return () => {
      document.body.style.margin = prevMargin;
      document.body.style.background = prevBg;
    };
  }, []);
}

const esPWA = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  window.navigator.standalone === true;

// ---- Iconos ----
const SvgEmail = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="5" width="18" height="14" rx="2" stroke="#1a4fc0" strokeWidth="1.6" />
    <path d="M4 7l8 6 8-6" stroke="#1a4fc0" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const SvgLock = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <rect x="5" y="10" width="14" height="10" rx="2" stroke="#1a4fc0" strokeWidth="1.6" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="#1a4fc0" strokeWidth="1.6" />
  </svg>
);
const SvgEye = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" stroke="#8a92a6" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="12" cy="12" r="3" stroke="#8a92a6" strokeWidth="1.6" />
  </svg>
);
const SvgEyeOff = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" stroke="#8a92a6" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="12" cy="12" r="3" stroke="#8a92a6" strokeWidth="1.6" />
    <path d="M4 4l16 16" stroke="#8a92a6" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);
const SvgQR = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="7" height="7" rx="1" stroke="white" strokeWidth="1.8" />
    <rect x="5" y="5" width="3" height="3" fill="white" />
    <rect x="14" y="3" width="7" height="7" rx="1" stroke="white" strokeWidth="1.8" />
    <rect x="16" y="5" width="3" height="3" fill="white" />
    <rect x="3" y="14" width="7" height="7" rx="1" stroke="white" strokeWidth="1.8" />
    <rect x="5" y="16" width="3" height="3" fill="white" />
    <path d="M14 14h2v2h-2zM16 16h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z" fill="white" />
  </svg>
);
const SvgClose = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <path d="M18 6L6 18M6 6l12 12" stroke="white" strokeWidth="2" strokeLinecap="round" />
  </svg>
);
const SvgCheckCircle = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" stroke="#1c9a53" strokeWidth="1.8" />
    <path d="M7 12l3.5 3.5L17 9" stroke="#1c9a53" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ---- Escáner QR nativo — usa input file capture que funciona en iOS PWA ----
// En vez de acceder a la cámara directamente (que requiere permisos especiales en iOS PWA),
// abrimos el selector de archivos con capture="environment" que iOS redirige a la cámara
// automáticamente, y luego decodificamos la imagen con jsQR.
function EscanerQR({ onResult, onCerrar }) {
  const inputRef = useRef(null);
  const [estado, setEstado] = useState("esperando"); // esperando | procesando | leido | error
  const [errorMsg, setErrorMsg] = useState("");

  // Abrir la cámara automáticamente al montar
  useEffect(() => {
    setTimeout(() => {
      if (inputRef.current) inputRef.current.click();
    }, 300);
  }, []);

  const procesarImagen = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEstado("procesando");

    try {
      // Cargar jsQR dinámicamente
      const jsQR = (await import("jsqr")).default;

      // Leer la imagen como ImageData
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.src = url;
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });

      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);

      // Decodificar QR
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code) {
        // QR encontrado — extraer ruta
        try {
          const parsed = new URL(code.data);
          onResult(parsed.pathname + parsed.search);
        } catch {
          if (code.data.startsWith("/")) onResult(code.data);
          else { setEstado("error"); setErrorMsg("QR no reconocido: " + code.data); }
        }
      } else {
        setEstado("error");
        setErrorMsg("No se encontró un QR en la imagen. Intenta de nuevo con mejor iluminación.");
      }
    } catch (err) {
      setEstado("error");
      setErrorMsg("Error al procesar la imagen: " + err.message);
    }
  };

  return (
    <div style={sc.overlay}>
      <div style={sc.panel}>
        <div style={sc.header}>
          <span style={sc.headerTitulo}>Escanear QR del equipo</span>
          <button style={sc.btnClose} onClick={onCerrar}><SvgClose /></button>
        </div>

        <div style={sc.confirmWrap}>
          {estado === "esperando" && (
            <>
              <div style={{ fontSize: "52px" }}>📷</div>
              <div style={sc.confirmTitulo}>Abrir cámara</div>
              <div style={sc.confirmSub}>
                Toca el botón para abrir la cámara y apunta al código QR del equipo
              </div>
              {/* Input nativo — iOS lo redirige a la cámara automáticamente */}
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={procesarImagen}
                style={{ display: "none" }}
              />
              <button style={sc.btnContinuar} onClick={() => inputRef.current?.click()}>
                📷 Abrir cámara
              </button>
            </>
          )}

          {estado === "procesando" && (
            <>
              <div style={sc.spinner} />
              <div style={sc.confirmTitulo}>Procesando imagen...</div>
              <div style={sc.confirmSub}>Buscando código QR en la foto</div>
            </>
          )}

          {estado === "error" && (
            <>
              <div style={{ fontSize: "40px" }}>⚠️</div>
              <div style={{ ...sc.confirmTitulo, color: "#f87171" }}>No se pudo leer el QR</div>
              <div style={sc.confirmSub}>{errorMsg}</div>
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={procesarImagen}
                style={{ display: "none" }}
              />
              <button style={sc.btnContinuar} onClick={() => { setEstado("esperando"); inputRef.current?.click(); }}>
                Intentar de nuevo
              </button>
              <button style={sc.btnReintentar} onClick={onCerrar}>Cancelar</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Login principal ----
export default function Login() {
  useManropeAndBodyReset();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [verPass, setVerPass] = useState(false);
  const [mostrarEscaner, setMostrarEscaner] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setCargando(true);
    setError("");
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;
      const docSnap = await getDoc(doc(db, "usuarios", uid));

      if (docSnap.exists()) {
        const userData = docSnap.data();
        if (userData.superadmin === true) navigate("/admin");
        else if (userData.rol === "admin") navigate("/panel-admin");
        else navigate("/cliente");
      } else {
        navigate("/cliente");
      }
    } catch (err) {
      if (
        err.code === "auth/user-not-found" ||
        err.code === "auth/wrong-password" ||
        err.code === "auth/invalid-credential"
      ) {
        setError("Correo o contraseña incorrectos");
      } else if (err.code === "auth/too-many-requests") {
        setError("Demasiados intentos. Espera unos minutos.");
      } else {
        setError("Error al ingresar: " + err.code);
      }
    }
    setCargando(false);
  };

  return (
    <>
      {mostrarEscaner && (
        <EscanerQR
          onResult={onQRResult}
          onCerrar={() => setMostrarEscaner(false)}
        />
      )}

      <div style={s.page}>
        <form style={s.card} onSubmit={handleLogin}>
          <div style={s.logoWrap}>
            <img src="/assets/hvac-isotipo-blue.png" alt="HVAC Control" style={s.logoImg} />
          </div>

          <div style={s.divider} />

          <div style={s.subLogo}>SISTEMA DE MANTENIMIENTO</div>

          {error && <div style={s.error}>{error}</div>}

          <div style={s.fieldsWrap}>
            <div style={s.inputWrap}>
              <span style={s.inputIconLeft}><SvgEmail /></span>
              <input
                style={s.input}
                type="email"
                placeholder="correo@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div style={s.inputWrap}>
              <span style={s.inputIconLeft}><SvgLock /></span>
              <input
                style={{ ...s.input, paddingRight: "38px" }}
                type={verPass ? "text" : "password"}
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button type="button" style={s.inputIconRight} onClick={() => setVerPass(!verPass)}>
                {verPass ? <SvgEyeOff /> : <SvgEye />}
              </button>
            </div>
          </div>

          <button style={s.button} type="submit" disabled={cargando}>
            {cargando ? "Ingresando..." : "Ingresar al sistema"}
          </button>

          {/* Botón escanear QR — solo en PWA instalada */}
          {esPWA() && (
            <button
              type="button"
              style={s.btnQR}
              onClick={() => setMostrarEscaner(true)}
            >
              <SvgQR />
              Escanear QR de equipo
            </button>
          )}

          <div style={s.footer}>HVAC &copy; 2026</div>
        </form>
      </div>
    </>
  );
}

const FONT = "'Manrope', -apple-system, sans-serif";

const s = {
  page: { width: "100%", minHeight: "100vh", background: "#dce6f7", display: "flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box", padding: "clamp(16px,5vw,32px)", fontFamily: FONT },
  card: { width: "100%", maxWidth: "420px", background: "white", borderRadius: "20px", padding: "clamp(32px,6vw,44px) clamp(28px,6vw,40px)", boxShadow: "0 20px 50px rgba(15,27,61,0.18)", display: "flex", flexDirection: "column", alignItems: "center", gap: "20px", boxSizing: "border-box" },
  logoWrap: { width: "112px", height: "112px", display: "flex", alignItems: "center", justifyContent: "center" },
  logoImg: { width: "100%", height: "100%", objectFit: "contain" },
  divider: { width: "100%", height: "1px", background: "#eef1f6" },
  subLogo: { fontWeight: 700, fontSize: "12px", color: "#6b7488", letterSpacing: "0.24em", textAlign: "center", marginTop: "-4px" },
  error: { color: "#a52b2b", textAlign: "center", fontSize: "12.5px", fontWeight: 600, background: "#fdeeee", padding: "9px 12px", borderRadius: "10px", width: "100%", boxSizing: "border-box" },
  bannerQR: { width: "100%", boxSizing: "border-box", background: "#e6f7ec", border: "1px solid #c3ecd2", borderRadius: "12px", padding: "12px 14px", display: "flex", alignItems: "center", gap: "10px" },
  bannerQRTitulo: { fontWeight: 800, fontSize: "13px", color: "#1c7a44" },
  bannerQRSub: { fontWeight: 500, fontSize: "11.5px", color: "#2d6a4f", marginTop: "2px" },
  bannerQRX: { background: "none", border: "none", color: "#6b7488", cursor: "pointer", fontSize: "14px", marginLeft: "auto", padding: "2px 4px" },
  fieldsWrap: { width: "100%", display: "flex", flexDirection: "column", gap: "14px" },
  inputWrap: { position: "relative", display: "flex", alignItems: "center" },
  inputIconLeft: { position: "absolute", left: "14px", display: "flex" },
  inputIconRight: { position: "absolute", right: "12px", background: "none", border: "none", cursor: "pointer", padding: "4px", display: "flex" },
  input: { width: "100%", boxSizing: "border-box", border: "1px solid #dfe6f5", borderRadius: "12px", padding: "14px 14px 14px 44px", fontFamily: "inherit", fontSize: "14.5px", color: "#12245e", background: "#f4f6fb" },
  button: { width: "100%", boxSizing: "border-box", background: "#1a4fc0", color: "white", border: "none", borderRadius: "12px", padding: "15px 20px", fontFamily: "inherit", fontWeight: 700, fontSize: "15px", cursor: "pointer", boxShadow: "0 8px 20px rgba(26,79,192,0.28)" },
  btnQR: { width: "100%", boxSizing: "border-box", background: "#12245e", color: "white", border: "none", borderRadius: "12px", padding: "15px 20px", fontFamily: "inherit", fontWeight: 700, fontSize: "15px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", boxShadow: "0 4px 14px rgba(18,36,94,0.22)" },
  footer: { color: "#9aa2b3", fontWeight: 600, fontSize: "12px" },
};

const sc = {
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 9999, display: "flex", alignItems: "flex-end", justifyContent: "center", fontFamily: FONT },
  panel: { width: "100%", maxWidth: "480px", background: "#0f1b3d", borderRadius: "24px 24px 0 0", paddingBottom: "40px", display: "flex", flexDirection: "column", overflow: "hidden", maxHeight: "92vh" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 20px 16px" },
  headerTitulo: { fontWeight: 800, fontSize: "17px", color: "white" },
  btnClose: { background: "rgba(255,255,255,0.12)", border: "none", borderRadius: "10px", width: "36px", height: "36px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
  visorWrap: { position: "relative", width: "100%", aspectRatio: "1", background: "#000", overflow: "hidden", maxHeight: "60vw" },
  visor: { width: "100%", height: "100%" },
  overlayVisor: { position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px", background: "#000" },
  spinner: { width: "36px", height: "36px", border: "3px solid rgba(255,255,255,0.15)", borderTop: "3px solid #1a4fc0", borderRadius: "50%", animation: "spin 0.8s linear infinite" },
  overlayTxt: { color: "rgba(255,255,255,0.6)", fontSize: "13px", fontWeight: 600 },
  marcoWrap: { position: "absolute", inset: 0 },
  esquina: { position: "relative" },
  esq: { position: "absolute", width: "32px", height: "32px", borderColor: "#1a4fc0", borderStyle: "solid", borderWidth: 0, borderRadius: "2px" },
  instruccion: { color: "rgba(255,255,255,0.55)", fontSize: "13px", fontWeight: 600, textAlign: "center", padding: "16px 24px 0" },
  confirmWrap: { display: "flex", flexDirection: "column", alignItems: "center", gap: "14px", padding: "24px 28px 8px" },
  confirmTitulo: { fontWeight: 800, fontSize: "18px", color: "white", textAlign: "center" },
  confirmSub: { fontWeight: 500, fontSize: "13px", color: "rgba(255,255,255,0.65)", textAlign: "center", lineHeight: 1.5 },
  confirmUrl: { background: "rgba(255,255,255,0.07)", borderRadius: "10px", padding: "8px 14px", fontSize: "11px", color: "rgba(255,255,255,0.4)", fontFamily: "monospace", wordBreak: "break-all", textAlign: "center", maxWidth: "100%" },
  btnContinuar: { width: "100%", background: "#1a4fc0", color: "white", border: "none", borderRadius: "12px", padding: "14px 20px", fontFamily: FONT, fontWeight: 700, fontSize: "15px", cursor: "pointer", boxShadow: "0 8px 20px rgba(26,79,192,0.35)" },
  btnReintentar: { background: "none", border: "none", color: "rgba(255,255,255,0.45)", fontFamily: FONT, fontWeight: 600, fontSize: "13px", cursor: "pointer", padding: "4px" },
};

if (typeof document !== "undefined" && !document.getElementById("spin-kf")) {
  const st = document.createElement("style");
  st.id = "spin-kf";
  st.textContent = "@keyframes spin { to { transform: rotate(360deg); } }";
  document.head.appendChild(st);
}
