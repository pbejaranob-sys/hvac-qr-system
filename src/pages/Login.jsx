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

export default function Login() {
  useManropeAndBodyReset();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verPass, setVerPass] = useState(false);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
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
    setScannerOpen(false);
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
      {/* ============ ESCÁNER ============ */}
      {scannerOpen && (
        <EscanerQR
          onResult={onQRResult}
          onCerrar={() => setScannerOpen(false)}
        />
      )}

      {/* ============ LOGIN ============ */}
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
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={s.iconLeft}>
                <rect x="3" y="5" width="18" height="14" rx="2" stroke="#1a4fc0" strokeWidth="1.6" />
                <path d="M4 7l8 6 8-6" stroke="#1a4fc0" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <input
                style={s.input}
                type="email"
                placeholder="correo@empresa.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            <div style={s.inputWrap}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={s.iconLeft}>
                <rect x="5" y="10" width="14" height="10" rx="2" stroke="#1a4fc0" strokeWidth="1.6" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="#1a4fc0" strokeWidth="1.6" />
              </svg>
              <input
                style={{ ...s.input, paddingRight: "44px" }}
                type={verPass ? "text" : "password"}
                placeholder="Contraseña"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
              <button type="button" style={s.iconRight} onClick={() => setVerPass(!verPass)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" stroke="#8a92a6" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="12" cy="12" r="3" stroke="#8a92a6" strokeWidth="1.6" />
                  {verPass && <path d="M4 4l16 16" stroke="#8a92a6" strokeWidth="1.6" strokeLinecap="round" />}
                </svg>
              </button>
            </div>
          </div>

          <button style={s.btnLogin} type="submit" disabled={cargando}>
            {cargando ? "Ingresando..." : "Ingresar al sistema"}
          </button>

          {esPWA() && (
            <button type="button" style={s.btnQR} onClick={() => setScannerOpen(true)}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="3" width="7" height="7" rx="1.2" stroke="#ffffff" strokeWidth="1.7" />
                <rect x="14" y="3" width="7" height="7" rx="1.2" stroke="#ffffff" strokeWidth="1.7" />
                <rect x="3" y="14" width="7" height="7" rx="1.2" stroke="#ffffff" strokeWidth="1.7" />
                <path d="M14 14h3v3h-3v-3zM20 14v3M14 20h3M20 20v.01" stroke="#ffffff" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
              Escanear QR de equipo
            </button>
          )}

          <div style={s.footer}>HVAC &copy; 2026</div>
        </form>
      </div>
    </>
  );
}

// ============ ESCÁNER QR ============
function EscanerQR({ onResult, onCerrar }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const [estado, setEstado] = useState("iniciando");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let activo = true;

    const iniciar = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (!activo) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          if (activo) setEstado("activo");
          escanearLoop();
        }
      } catch (err) {
        if (!activo) return;
        setErrorMsg(err.name === "NotAllowedError"
          ? "Permiso de cámara denegado. Ve a Ajustes → Safari → Cámara → Permitir."
          : "No se pudo acceder a la cámara.");
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
        if ("BarcodeDetector" in window) {
          const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
          const codes = await detector.detect(canvas);
          if (codes.length > 0 && activo) { detener(); onResult(codes[0].rawValue); return; }
        } else {
          const jsQR = (await import("jsqr")).default;
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
          if (code && activo) { detener(); onResult(code.data); return; }
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
    <div style={sc.root}>
      {/* Fondo con glow azul igual que el HTML */}
      <div style={sc.glow} />

      {/* Header */}
      <div style={sc.header}>
        <button style={sc.btnVolver} onClick={onCerrar}>←</button>
        <div style={sc.headerTitulo}>Escanear equipo</div>
        <div style={{ width: 38 }} />
      </div>

      {/* Video */}
      <video ref={videoRef} style={sc.video} playsInline muted autoPlay />
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {/* Marco de esquinas — centrado en pantalla */}
      {estado === "activo" && (
        <div style={sc.marcoWrap}>
          <div style={sc.marco}>
            <div style={{ ...sc.esq, top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderRadius: "16px 0 0 0" }} />
            <div style={{ ...sc.esq, top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderRadius: "0 16px 0 0" }} />
            <div style={{ ...sc.esq, bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderRadius: "0 0 0 16px" }} />
            <div style={{ ...sc.esq, bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderRadius: "0 0 16px 0" }} />
          </div>
        </div>
      )}

      {/* Iniciando */}
      {estado === "iniciando" && (
        <div style={sc.centrado}>
          <div style={sc.spinner} />
          <div style={sc.spinnerTxt}>Iniciando cámara...</div>
        </div>
      )}

      {/* Error */}
      {estado === "error" && (
        <div style={sc.centrado}>
          <div style={{ fontSize: "42px", marginBottom: "16px" }}>⚠️</div>
          <div style={{ ...sc.spinnerTxt, color: "#fca5a5", fontWeight: 700, marginBottom: "10px" }}>Error de cámara</div>
          <div style={{ ...sc.spinnerTxt, fontSize: "13px", textAlign: "center", padding: "0 28px", lineHeight: 1.5 }}>{errorMsg}</div>
          <button style={sc.btnError} onClick={onCerrar}>Cerrar</button>
        </div>
      )}

      {/* Footer con instrucción — igual que el HTML */}
      <div style={sc.footer}>
        <div style={sc.footerTxt}>Apunta al código QR del equipo</div>
        <div style={sc.footerSub}>El escaneo es automático</div>
      </div>
    </div>
  );
}

const FONT = "'Manrope', -apple-system, sans-serif";

const s = {
  page: { width: "100%", minHeight: "100vh", background: "#dce6f7", display: "flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box", padding: "clamp(16px,5vw,32px)", fontFamily: FONT },
  card: { width: "100%", maxWidth: "420px", background: "#ffffff", borderRadius: "20px", padding: "clamp(32px,6vw,44px) clamp(28px,6vw,40px)", boxShadow: "0 20px 50px rgba(15,27,61,0.18)", display: "flex", flexDirection: "column", alignItems: "center", gap: "24px", boxSizing: "border-box" },
  logoWrap: { width: "112px", height: "112px", display: "flex", alignItems: "center", justifyContent: "center" },
  logoImg: { width: "100%", height: "100%", objectFit: "contain" },
  divider: { width: "100%", height: "1px", background: "#eef1f6" },
  subLogo: { fontWeight: 700, fontSize: "12px", color: "#6b7488", letterSpacing: "0.24em", textAlign: "center", marginTop: "-8px" },
  error: { color: "#a52b2b", textAlign: "center", fontSize: "12.5px", fontWeight: 600, background: "#fdeeee", padding: "9px 12px", borderRadius: "10px", width: "100%", boxSizing: "border-box" },
  fieldsWrap: { width: "100%", display: "flex", flexDirection: "column", gap: "14px" },
  inputWrap: { position: "relative", display: "flex", alignItems: "center" },
  iconLeft: { position: "absolute", left: "14px" },
  iconRight: { position: "absolute", right: "12px", background: "none", border: "none", cursor: "pointer", padding: "4px", display: "flex" },
  input: { width: "100%", boxSizing: "border-box", border: "1px solid #dfe6f5", borderRadius: "12px", padding: "14px 14px 14px 44px", fontFamily: "inherit", fontSize: "14.5px", color: "#12245e", background: "#f4f6fb" },
  btnLogin: { width: "100%", boxSizing: "border-box", background: "#1a4fc0", color: "#ffffff", border: "none", borderRadius: "12px", padding: "15px 20px", fontFamily: "inherit", fontWeight: 700, fontSize: "15px", cursor: "pointer", boxShadow: "0 8px 20px rgba(26,79,192,0.28)" },
  btnQR: { width: "100%", boxSizing: "border-box", background: "#12245e", color: "#ffffff", border: "none", borderRadius: "12px", padding: "15px 20px", fontFamily: "inherit", fontWeight: 700, fontSize: "15px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", boxShadow: "0 8px 20px rgba(18,36,94,0.25)" },
  footer: { color: "#9aa2b3", fontWeight: 600, fontSize: "12px" },
};

const sc = {
  root: { position: "fixed", inset: 0, background: "#050914", zIndex: 9999, overflow: "hidden", fontFamily: FONT },
  glow: { position: "absolute", inset: 0, background: "radial-gradient(circle at 50% 35%, rgba(63,160,255,0.28), transparent 60%)", pointerEvents: "none" },
  header: { position: "absolute", top: 0, left: 0, right: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "clamp(16px,4vw,24px) clamp(16px,4vw,24px) 0", zIndex: 10 },
  btnVolver: { background: "rgba(255,255,255,0.12)", border: "none", width: "38px", height: "38px", minWidth: "38px", borderRadius: "12px", color: "#ffffff", fontSize: "18px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit" },
  headerTitulo: { color: "#ffffff", fontWeight: 800, fontSize: "clamp(14px,3.8vw,16px)", fontFamily: FONT },
  video: { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" },
  marcoWrap: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" },
  marco: { width: "min(76%,320px)", aspectRatio: "1/1", position: "relative" },
  esq: { position: "absolute", width: "36px", height: "36px", borderColor: "#3fa0ff", borderStyle: "solid", borderWidth: 0 },
  centrado: { position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" },
  spinner: { width: "40px", height: "40px", border: "3px solid rgba(63,160,255,0.2)", borderTop: "3px solid #3fa0ff", borderRadius: "50%", animation: "spin 0.8s linear infinite", marginBottom: "16px" },
  spinnerTxt: { color: "rgba(255,255,255,0.7)", fontSize: "14px", fontWeight: 600, fontFamily: FONT },
  btnError: { marginTop: "24px", background: "rgba(255,255,255,0.12)", border: "none", borderRadius: "12px", padding: "12px 28px", color: "#ffffff", fontFamily: FONT, fontWeight: 700, fontSize: "14px", cursor: "pointer" },
  footer: { position: "absolute", bottom: 0, left: 0, right: 0, padding: "28px 24px 40px", textAlign: "center", background: "linear-gradient(180deg, transparent, rgba(0,0,0,0.5))" },
  footerTxt: { color: "#ffffff", fontWeight: 700, fontSize: "clamp(13.5px,3.8vw,14.5px)", fontFamily: FONT },
  footerSub: { color: "rgba(255,255,255,0.55)", fontWeight: 600, fontSize: "12px", marginTop: "6px", fontFamily: FONT },
};

if (typeof document !== "undefined" && !document.getElementById("spin-kf")) {
  const st = document.createElement("style");
  st.id = "spin-kf";
  st.textContent = "@keyframes spin { to { transform: rotate(360deg); } }";
  document.head.appendChild(st);
}
