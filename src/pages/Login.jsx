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
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M18 6L6 18M6 6l12 12" stroke="white" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

// ---- Escáner QR con video en tiempo real ----
function EscanerQR({ onResult, onCerrar }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const [estado, setEstado] = useState("iniciando"); // iniciando | activo | error
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let activo = true;

    const iniciar = async () => {
      try {
        // Pedir acceso a la cámara trasera
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (!activo) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setEstado("activo");
          escanearLoop();
        }
      } catch (err) {
        if (!activo) return;
        if (err.name === "NotAllowedError") {
          setErrorMsg("Permiso de cámara denegado. Ve a Ajustes → Safari → Cámara → Permitir.");
        } else {
          setErrorMsg("No se pudo acceder a la cámara: " + err.message);
        }
        setEstado("error");
      }
    };

    const escanearLoop = async () => {
      if (!activo) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(escanearLoop);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0);

      try {
        // Intentar BarcodeDetector nativo primero (iOS 17+, Android Chrome)
        if ("BarcodeDetector" in window) {
          const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
          const codes = await detector.detect(canvas);
          if (codes.length > 0 && activo) {
            detener();
            onResult(codes[0].rawValue);
            return;
          }
        } else {
          // Fallback: jsqr
          const jsQR = (await import("jsqr")).default;
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
          });
          if (code && activo) {
            detener();
            onResult(code.data);
            return;
          }
        }
      } catch (_) {}

      if (activo) rafRef.current = requestAnimationFrame(escanearLoop);
    };

    const detener = () => {
      activo = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };

    iniciar();

    return () => {
      activo = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []);

  return (
    <div style={sc.overlay}>
      <div style={sc.panel}>
        {/* Header */}
        <div style={sc.header}>
          <span style={sc.titulo}>Escanear QR del equipo</span>
          <button style={sc.btnClose} onClick={onCerrar}><SvgClose /></button>
        </div>

        {/* Video */}
        <div style={sc.visorWrap}>
          <video
            ref={videoRef}
            style={sc.video}
            playsInline
            muted
            autoPlay
          />
          <canvas ref={canvasRef} style={{ display: "none" }} />

          {/* Marco de encuadre */}
          {estado === "activo" && (
            <div style={sc.marcoOuter}>
              <div style={sc.marco}>
                <div style={{ ...sc.esq, top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 }} />
                <div style={{ ...sc.esq, top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 }} />
                <div style={{ ...sc.esq, bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 }} />
                <div style={{ ...sc.esq, bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 }} />
              </div>
            </div>
          )}

          {/* Iniciando */}
          {estado === "iniciando" && (
            <div style={sc.centrado}>
              <div style={sc.spinner} />
              <div style={sc.txt}>Iniciando cámara...</div>
            </div>
          )}

          {/* Error */}
          {estado === "error" && (
            <div style={sc.centrado}>
              <div style={{ fontSize: "36px", marginBottom: "12px" }}>⚠️</div>
              <div style={{ ...sc.txt, color: "#fca5a5", fontWeight: 700, marginBottom: "8px" }}>Error de cámara</div>
              <div style={{ ...sc.txt, fontSize: "12px", textAlign: "center", padding: "0 20px" }}>{errorMsg}</div>
            </div>
          )}
        </div>

        <div style={sc.instruccion}>
          {estado === "activo" ? "Apunta al código QR del equipo" : estado === "error" ? "" : "Esperando cámara..."}
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
      if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        setError("Correo o contraseña incorrectos");
      } else if (err.code === "auth/too-many-requests") {
        setError("Demasiados intentos. Espera unos minutos.");
      } else {
        setError("Error al ingresar: " + err.code);
      }
    }
    setCargando(false);
  };

  const onQRResult = (texto) => {
    setMostrarEscaner(false);
    try {
      const url = new URL(texto);
      navigate(url.pathname + url.search);
    } catch {
      if (texto.startsWith("/")) navigate(texto);
      else setError("QR no reconocido.");
    }
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
              <input style={s.input} type="email" placeholder="correo@empresa.com"
                value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div style={s.inputWrap}>
              <span style={s.inputIconLeft}><SvgLock /></span>
              <input style={{ ...s.input, paddingRight: "38px" }}
                type={verPass ? "text" : "password"} placeholder="Contraseña"
                value={password} onChange={e => setPassword(e.target.value)} required />
              <button type="button" style={s.inputIconRight} onClick={() => setVerPass(!verPass)}>
                {verPass ? <SvgEyeOff /> : <SvgEye />}
              </button>
            </div>
          </div>

          <button style={s.button} type="submit" disabled={cargando}>
            {cargando ? "Ingresando..." : "Ingresar al sistema"}
          </button>

          {esPWA() && (
            <button type="button" style={s.btnQR} onClick={() => setMostrarEscaner(true)}>
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
  card: { width: "100%", maxWidth: "420px", background: "white", borderRadius: "20px", padding: "clamp(32px,6vw,44px) clamp(28px,6vw,40px)", boxShadow: "0 20px 50px rgba(15,27,61,0.18)", display: "flex", flexDirection: "column", alignItems: "center", gap: "24px", boxSizing: "border-box" },
  logoWrap: { width: "112px", height: "112px", display: "flex", alignItems: "center", justifyContent: "center" },
  logoImg: { width: "100%", height: "100%", objectFit: "contain" },
  divider: { width: "100%", height: "1px", background: "#eef1f6" },
  subLogo: { fontWeight: 700, fontSize: "12px", color: "#6b7488", letterSpacing: "0.24em", textAlign: "center", marginTop: "-8px" },
  error: { color: "#a52b2b", textAlign: "center", fontSize: "12.5px", fontWeight: 600, background: "#fdeeee", padding: "9px 12px", borderRadius: "10px", width: "100%", boxSizing: "border-box" },
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
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.95)", zIndex: 9999, display: "flex", alignItems: "flex-end", justifyContent: "center", fontFamily: FONT },
  panel: { width: "100%", maxWidth: "480px", background: "#0f1b3d", borderRadius: "24px 24px 0 0", paddingBottom: "32px", display: "flex", flexDirection: "column", overflow: "hidden" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 20px 14px" },
  titulo: { fontWeight: 800, fontSize: "17px", color: "white" },
  btnClose: { background: "rgba(255,255,255,0.12)", border: "none", borderRadius: "10px", width: "36px", height: "36px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
  visorWrap: { position: "relative", width: "100%", aspectRatio: "1/1", background: "#000", overflow: "hidden", maxHeight: "65vw" },
  video: { width: "100%", height: "100%", objectFit: "cover" },
  marcoOuter: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" },
  marco: { position: "relative", width: "65%", height: "65%", },
  esq: { position: "absolute", width: "28px", height: "28px", borderColor: "#1a4fc0", borderStyle: "solid", borderWidth: 0, borderRadius: "3px" },
  centrado: { position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.7)" },
  spinner: { width: "36px", height: "36px", border: "3px solid rgba(255,255,255,0.15)", borderTop: "3px solid #1a4fc0", borderRadius: "50%", animation: "spin 0.8s linear infinite", marginBottom: "12px" },
  txt: { color: "rgba(255,255,255,0.7)", fontSize: "13px", fontWeight: 600 },
  instruccion: { color: "rgba(255,255,255,0.5)", fontSize: "13px", fontWeight: 600, textAlign: "center", padding: "14px 24px 0" },
};

if (typeof document !== "undefined" && !document.getElementById("spin-kf")) {
  const st = document.createElement("style");
  st.id = "spin-kf";
  st.textContent = "@keyframes spin { to { transform: rotate(360deg); } }";
  document.head.appendChild(st);
}
