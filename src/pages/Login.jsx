import { useState } from "react";
import { auth } from "../firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/dashboard");
    } catch (err) {
      setError("Correo o contraseña incorrectos");
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>🌬️ HVAC QR System</h1>
        <p style={styles.subtitle}>Panel técnico — Iniciar sesión</p>
        {error && <p style={styles.error}>{error}</p>}
        <form onSubmit={handleLogin}>
          <input style={styles.input} type="email" placeholder="Correo electrónico"
            value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input style={styles.input} type="password" placeholder="Contraseña"
            value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button style={styles.button} type="submit">Ingresar</button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f0f4f8" },
  card: { background: "white", padding: "2rem", borderRadius: "12px", width: "100%", maxWidth: "400px", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" },
  title: { textAlign: "center", color: "#1a73e8", marginBottom: "0.25rem" },
  subtitle: { textAlign: "center", color: "#666", marginBottom: "1.5rem" },
  input: { width: "100%", padding: "12px", marginBottom: "1rem", borderRadius: "8px", border: "1px solid #ddd", fontSize: "16px", boxSizing: "border-box" },
  button: { width: "100%", padding: "12px", background: "#1a73e8", color: "white", border: "none", borderRadius: "8px", fontSize: "16px", cursor: "pointer" },
  error: { color: "red", textAlign: "center", marginBottom: "1rem" }
};