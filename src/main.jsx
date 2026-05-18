import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import './index.css'
import App from './App.jsx'

Sentry.init({
  dsn: "https://9cf1dce4b2f85662cb893e8f8ab5d08f@o4511408711270400.ingest.us.sentry.io/4511408756359168",
  environment: import.meta.env.MODE,
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,
  integrations: [
    Sentry.browserTracingIntegration(),
  ],
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "Arial, sans-serif", background: "#f0f4f8" }}>
        <div style={{ fontSize: "32px", marginBottom: "12px" }}>⚠️</div>
        <div style={{ fontSize: "16px", fontWeight: 600, color: "#c62828", marginBottom: "8px" }}>Ocurrió un error inesperado</div>
        <div style={{ fontSize: "13px", color: "#888", marginBottom: "20px" }}>El equipo técnico ha sido notificado automáticamente.</div>
        <button onClick={() => window.location.href = "/"} style={{ padding: "10px 24px", background: "#1a5fa8", color: "white", border: "none", borderRadius: "8px", fontSize: "14px", cursor: "pointer" }}>
          Volver al inicio
        </button>
      </div>
    }>
      <App />
    </Sentry.ErrorBoundary>
  </StrictMode>,
)
