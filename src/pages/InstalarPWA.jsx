import { useState, useEffect } from "react";

// Componente que muestra el banner "Instalar app" cuando el navegador
// lo soporta (Android Chrome, Edge, Samsung Browser).
// En iOS muestra instrucciones manuales (Safari no tiene prompt automático).
export default function InstalarPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [mostrar, setMostrar] = useState(false);
  const [esIOS, setEsIOS] = useState(false);
  const [mostrarIOS, setMostrarIOS] = useState(false);

  useEffect(() => {
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches
      || window.navigator.standalone === true;

    if (isIOS && !isStandalone) {
      setEsIOS(true);
      // Mostrar instrucciones iOS solo si no fue descartado antes
      const descartado = localStorage.getItem("pwa-ios-descartado");
      if (!descartado) setMostrarIOS(true);
      return;
    }

    if (isStandalone) return; // Ya está instalada

    const handler = e => {
      e.preventDefault();
      setDeferredPrompt(e);
      const descartado = localStorage.getItem("pwa-descartado");
      if (!descartado) setMostrar(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const instalar = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setMostrar(false);
    setDeferredPrompt(null);
  };

  const descartar = () => {
    setMostrar(false);
    localStorage.setItem("pwa-descartado", "1");
  };

  const descartarIOS = () => {
    setMostrarIOS(false);
    localStorage.setItem("pwa-ios-descartado", "1");
  };

  // Banner Android / Chrome
  if (mostrar && !esIOS) return (
    <div style={s.banner}>
      <div style={s.icono}>⚡</div>
      <div style={{ flex: 1 }}>
        <div style={s.titulo}>Instalar app</div>
        <div style={s.sub}>Accede sin abrir el navegador</div>
      </div>
      <button style={s.btnInstalar} onClick={instalar}>Instalar</button>
      <button style={s.btnX} onClick={descartar}>✕</button>
    </div>
  );

  // Banner iOS / Safari
  if (mostrarIOS && esIOS) return (
    <div style={{ ...s.banner, flexDirection: "column", alignItems: "flex-start", gap: "10px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%" }}>
        <div style={s.icono}>📲</div>
        <div style={{ flex: 1 }}>
          <div style={s.titulo}>Instalar en iPhone / iPad</div>
          <div style={s.sub}>Agrega esta app a tu pantalla de inicio</div>
        </div>
        <button style={s.btnX} onClick={descartarIOS}>✕</button>
      </div>
      <div style={s.iosSteps}>
        <span>1. Toca <strong>Compartir</strong> <span style={{ fontSize: "15px" }}>⎋</span></span>
        <span>2. Selecciona <strong>"Agregar a pantalla de inicio"</strong></span>
        <span>3. Toca <strong>Agregar</strong></span>
      </div>
    </div>
  );

  return null;
}

const s = {
  banner: {
    position: "fixed", bottom: "16px", left: "50%", transform: "translateX(-50%)",
    width: "calc(100% - 32px)", maxWidth: "460px",
    background: "#ffffff", borderRadius: "16px",
    boxShadow: "0 8px 32px rgba(0,20,80,0.18), 0 2px 8px rgba(0,20,80,0.08)",
    padding: "14px 16px", display: "flex", alignItems: "center", gap: "12px",
    zIndex: 9999, fontFamily: "'Manrope', -apple-system, sans-serif",
    border: "1px solid #e7ebf3",
  },
  icono: { fontSize: "26px", lineHeight: 1 },
  titulo: { fontWeight: 800, fontSize: "14px", color: "#0f1b3d" },
  sub: { fontWeight: 500, fontSize: "12px", color: "#6b7488", marginTop: "2px" },
  btnInstalar: {
    background: "#1a4fc0", color: "#fff", border: "none", borderRadius: "10px",
    padding: "9px 16px", fontFamily: "'Manrope', sans-serif", fontWeight: 700,
    fontSize: "13px", cursor: "pointer", whiteSpace: "nowrap",
  },
  btnX: {
    background: "none", border: "none", color: "#9aa2b3", cursor: "pointer",
    fontSize: "16px", padding: "4px", lineHeight: 1,
  },
  iosSteps: {
    display: "flex", flexDirection: "column", gap: "4px",
    fontSize: "13px", color: "#26314d", paddingLeft: "4px",
  },
};
