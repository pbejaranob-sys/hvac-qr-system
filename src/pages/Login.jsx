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

export default function Login() {
  useManropeAndBodyReset();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [verPass, setVerPass] = useState(false);
  const [escaneando, setEscaneando] = useState(false);
  const inputQRRef = useRef(null);
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

  // Procesar la imagen tomada por la cámara y decodificar el QR
  const procesarFotoQR = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEscaneando(true);
    setError("");

    try {
      let qrData = null;

      // Intentar con BarcodeDetector (nativo en iOS 16+ y Chrome Android)
      if ("BarcodeDetector" in window) {
        try {
          const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
          const bitmap = await createImageBitmap(file);
          const codes = await detector.detect(bitmap);
          if (codes.length > 0) qrData = codes[0].rawValue;
        } catch (_) {}
      }

      // Fallback: jsqr con canvas de alta resolución
      if (!qrData) {
        const jsQR = (await import("jsqr")).default;
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        img.src = objectUrl;
        await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });

        // Usar resolución completa de la imagen para mejor detección
        const canvas = document.createElement("canvas");
        const MAX = 1920;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(objectUrl);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert",
        });
        if (code) qrData = code.data;
      }

      if (qrData) {
        try {
          const url = new URL(qrData);
          navigate(url.pathname + url.search);
        } catch {
          if (qrData.startsWith("/")) navigate(qrData);
          else setError("QR no reconocido. Asegúrate de apuntar al QR del equipo.");
        }
      } else {
        setError("No se detectó el QR. Asegúrate de que el código esté bien iluminado y centrado en la foto.");
      }
    } catch (err) {
      setError("Error al procesar la imagen.");
      console.error(err);
    }

    setEscaneando(false);
    if (inputQRRef.current) inputQRRef.current.value = "";
  };

  return (
    <div style={s.page}>
      {/* Input oculto que abre la cámara en iOS PWA */}
      <input
        ref={inputQRRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={procesarFotoQR}
        style={{ display: "none" }}
      />

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

        {/* En PWA: instrucción para usar la cámara nativa del iPhone */}
        {esPWA() && (
          <div style={s.qrInfo}>
            <div style={s.qrInfoIcono}>📷</div>
            <div>
              <div style={s.qrInfoTitulo}>Para escanear un equipo</div>
              <div style={s.qrInfoSub}>Abre la cámara del iPhone y apunta al QR del equipo. iOS lo detecta automáticamente.</div>
            </div>
          </div>
        )}

        <div style={s.footer}>HVAC &copy; 2026</div>
      </form>
    </div>
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
  qrInfo: { width: "100%", boxSizing: "border-box", background: "#f4f6fb", border: "1px solid #dfe6f5", borderRadius: "14px", padding: "14px 16px", display: "flex", alignItems: "flex-start", gap: "12px" },
  qrInfoIcono: { fontSize: "24px", lineHeight: 1, marginTop: "2px" },
  qrInfoTitulo: { fontWeight: 700, fontSize: "13px", color: "#12245e", marginBottom: "4px" },
  qrInfoSub: { fontWeight: 500, fontSize: "12px", color: "#6b7488", lineHeight: 1.5 },
  footer: { color: "#9aa2b3", fontWeight: 600, fontSize: "12px" },
};
