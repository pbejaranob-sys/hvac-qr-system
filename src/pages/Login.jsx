import { useState } from "react";
import { auth, db } from "../firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [verPass, setVerPass] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setCargando(true);
    setError("");
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;

      const docRef = doc(db, "usuarios", uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const userData = docSnap.data();
        if (userData.superadmin === true) {
          navigate("/admin");
        } else if (userData.rol === "admin") {
          navigate("/panel-admin");
        } else {
          navigate("/cliente");
        }
      } else {
        navigate("/cliente");
      }
    } catch (err) {
      console.error("Error login:", err.code, err.message);
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
  
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.logoWrap}>
          <div style={styles.logoLetras}>
            <span style={styles.letraAzul}>H</span>
            <span style={{ ...styles.letraAzul, marginRight: "-10px" }}>V</span>
            <span style={styles.letraDorada}>A</span>
            <span style={{ ...styles.letraAzul, marginLeft: "-2px" }}>C</span>
          </div>
          <div style={styles.lineaDivisor}></div>
          <div style={styles.subLogo}>Sistema de Mantenimiento</div>
        </div>

        {error && <p style={styles.error}>{error}</p>}

        <form onSubmit={handleLogin}>
          <div style={styles.inputWrap}>
            <span style={styles.inputIcon}>✉</span>
            <input
              style={styles.input}
              type="email"
              placeholder="Correo electrónico"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div style={styles.inputWrap}>
            <span style={styles.inputIcon}>🔒</span>
            <input
              style={styles.input}
              type={verPass ? "text" : "password"}
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <span style={styles.inputIconRight} onClick={() => setVerPass(!verPass)}>
              {verPass ? "🙈" : "👁"}
            </span>
          </div>
          <button style={styles.button} type="submit" disabled={cargando}>
            {cargando ? "Ingresando..." : "Ingresar al sistema"}
          </button>
        </form>

        <div style={styles.footer}>HVAC &copy; 2025</div>
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#dce8f5" },
  card: { background: "white", padding: "2.5rem 2rem", borderRadius: "14px", width: "100%", maxWidth: "380px", border: "0.5px solid #d0dce8" },
  logoWrap: { textAlign: "center", marginBottom: "1.8rem" },
  logoLetras: { display: "inline-flex", alignItems: "baseline", fontFamily: "'Arial Black', 'Helvetica Neue', sans-serif", fontWeight: 900, fontSize: "48px", lineHeight: 1, marginBottom: "8px" },
  letraAzul: { color: "#1a5fa8" },
  letraDorada: { color: "#f0c040" },
  lineaDivisor: { width: "100%", height: "1px", background: "#c8d8ea", margin: "6px 0 5px" },
  subLogo: { fontFamily: "Arial, sans-serif", fontSize: "10px", letterSpacing: "3px", color: "#6b8cae", textTransform: "uppercase" },
  error: { color: "#c62828", textAlign: "center", marginBottom: "1rem", fontSize: "13px", background: "#ffebee", padding: "8px", borderRadius: "6px" },
  inputWrap: { display: "flex", alignItems: "center", gap: "8px", border: "0.5px solid #c5d5e8", borderRadius: "8px", padding: "10px 12px", background: "#f7fafd", marginBottom: "10px" },
  inputIcon: { fontSize: "15px", color: "#6b8cae" },
  inputIconRight: { fontSize: "15px", color: "#6b8cae", marginLeft: "auto", cursor: "pointer" },
  input: { flex: 1, border: "none", background: "transparent", fontSize: "14px", color: "#333", outline: "none" },
  button: { width: "100%", padding: "12px", background: "#1a5fa8", color: "white", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 500, cursor: "pointer", marginTop: "6px" },
  footer: { textAlign: "center", marginTop: "1.2rem", fontSize: "11px", color: "#a0b4c8" },
};