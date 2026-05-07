import { useEffect, useState } from "react";
import { db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import { useParams, useNavigate } from "react-router-dom";

const getBadgeStyle = (estado) => {
  if (estado === "Operativo") return { background: "#e8f5e9", color: "#2e7d32" };
  if (estado === "Operativo con observaciones") return { background: "#fff8e1", color: "#f57f17" };
  return { background: "#ffebee", color: "#c62828" };
};

export default function VistaEquipo() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [equipo, setEquipo] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => { cargarEquipo(); }, []);

  const cargarEquipo = async () => {
    try {
      const ref = doc(db, "equipos", id);
      const snap = await getDoc(ref);
      if (snap.exists()) setEquipo({ id: snap.id, ...snap.data() });
    } catch (e) { console.error(e); }
    setCargando(false);
  };

  if (cargando) return <div style={styles.centro}>Cargando equipo...</div>;
  if (!equipo) return <div style={styles.centro}>Equipo no encontrado</div>;

  const urlEquipo = window.location.href;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(urlEquipo)}`;

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <button style={styles.btnVolver} onClick={() => navigate("/dashboard")}>← Volver al panel</button>

        <div style={styles.encabezado}>
          <div>
            <div style={styles.tipoTag}>{equipo.tipoEquipo || "Equipo"}</div>
            <p style={styles.idTag}>EQUIPO #{id.slice(0,6).toUpperCase()}</p>
            <h1 style={styles.titulo}>{equipo.marca} — {equipo.modelo}</h1>
            <p style={styles.cliente}>👤 {equipo.cliente || "Sin cliente"}</p>
            <p style={styles.ubicacion}>📍 {equipo.ubicacion}</p>
          </div>
          <span style={{...styles.badge, ...getBadgeStyle(equipo.estado)}}>
            {equipo.estado || "Operativo"}
          </span>
        </div>

        <div style={styles.seccion}>
          <p style={styles.seccionTitulo}>📋 Ficha técnica</p>
          <div style={styles.grid2}>
            <div style={styles.dato}><span style={styles.datoLabel}>Marca</span><span>{equipo.marca}</span></div>
            <div style={styles.dato}><span style={styles.datoLabel}>Modelo</span><span>{equipo.modelo}</span></div>
            <div style={styles.dato}><span style={styles.datoLabel}>N° Serie</span><span>{equipo.serie || "—"}</span></div>
            <div style={styles.dato}><span style={styles.datoLabel}>Capacidad</span><span>{equipo.capacidad} BTU</span></div>
            <div style={styles.dato}><span style={styles.datoLabel}>Refrigerante</span><span>{equipo.tipoRefrigerante || "—"}</span></div>
            <div style={styles.dato}><span style={styles.datoLabel}>Tipo</span><span>{equipo.tipoEquipo || "—"}</span></div>
          </div>
        </div>

        <div style={styles.seccion}>
          <p style={styles.seccionTitulo}>⚡ Datos eléctricos</p>
          <div style={styles.grid3}>
            <div style={styles.dato}><span style={styles.datoLabel}>Voltaje</span><span>{equipo.voltaje || "—"} V</span></div>
            <div style={styles.dato}><span style={styles.datoLabel}>Amperaje</span><span>{equipo.amperaje || "—"} A</span></div>
            <div style={styles.dato}><span style={styles.datoLabel}>Fases</span><span>{equipo.fases || "—"}</span></div>
          </div>
        </div>

        <div style={styles.seccion}>
          <p style={styles.seccionTitulo}>🔧 Último mantenimiento</p>
          <p style={styles.fecha}>{equipo.ultimoMantenimiento || "Sin registro"}</p>
          <p style={styles.texto}>{equipo.observaciones || "Sin observaciones registradas"}</p>
        </div>

        {equipo.correctivos && (
          <div style={styles.seccion}>
            <p style={styles.seccionTitulo}>⚠️ Correctivos realizados</p>
            <p style={styles.texto}>{equipo.correctivos}</p>
          </div>
        )}

        {equipo.recomendaciones && (
          <div style={styles.seccion}>
            <p style={styles.seccionTitulo}>💡 Recomendaciones</p>
            <p style={styles.texto}>{equipo.recomendaciones}</p>
          </div>
        )}

        {equipo.fotos && equipo.fotos.length > 0 && (
          <div style={styles.seccion}>
            <p style={styles.seccionTitulo}>📸 Galería de mantenimiento</p>
            <div style={styles.galeriaGrid}>
              {equipo.fotos.map((url, i) => (
                <img key={i} src={url} alt={`foto ${i+1}`}
                  style={styles.fotoThumb}
                  onClick={() => window.open(url, "_blank")}
                />
              ))}
            </div>
          </div>
        )}

        <div style={styles.qrSeccion}>
          <p style={styles.seccionTitulo}>📱 Código QR del equipo</p>
          <p style={styles.qrDesc}>Escanea este QR para ver la información del equipo</p>
          <div style={styles.qrBox}>
            <img src={qrUrl} alt="Código QR" style={{width: 200, height: 200}} />
          </div>
          <p style={styles.qrUrl}>{urlEquipo}</p>
          <button style={styles.btnImprimir} onClick={() => window.print()}>🖨️ Imprimir QR</button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: "100vh", background: "#f0f4f8", padding: "1.5rem" },
  card: { background: "white", borderRadius: "12px", padding: "2rem", maxWidth: "680px", margin: "0 auto", boxShadow: "0 2px 10px rgba(0,0,0,0.08)" },
  centro: { textAlign: "center", padding: "3rem", fontSize: "18px" },
  btnVolver: { background: "none", border: "1px solid #ddd", borderRadius: "8px", padding: "8px 14px", cursor: "pointer", color: "#555", marginBottom: "1.5rem" },
  encabezado: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" },
  tipoTag: { fontSize: "11px", background: "#e3f2fd", color: "#1565c0", padding: "2px 10px", borderRadius: "20px", display: "inline-block", marginBottom: "6px", fontWeight: "600" },
  idTag: { fontSize: "12px", color: "#999", margin: "0 0 4px" },
  titulo: { color: "#1a73e8", margin: "0 0 4px", fontSize: "20px" },
  cliente: { color: "#333", fontWeight: "600", fontSize: "14px", margin: "2px 0" },
  ubicacion: { color: "#555", margin: 0, fontSize: "13px" },
  badge: { padding: "6px 14px", borderRadius: "20px", fontSize: "12px", fontWeight: "600", whiteSpace: "nowrap" },
  seccion: { borderTop: "1px solid #f0f0f0", paddingTop: "1rem", marginTop: "1rem" },
  seccionTitulo: { fontWeight: "600", color: "#333", marginBottom: "0.75rem" },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" },
  grid3: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" },
  dato: { display: "flex", flexDirection: "column", background: "#f8f9fa", borderRadius: "8px", padding: "10px 14px" },
  datoLabel: { fontSize: "11px", color: "#999", marginBottom: "2px", textTransform: "uppercase" },
  fecha: { fontWeight: "600", color: "#333", marginBottom: "0.5rem" },
  texto: { color: "#555", fontSize: "14px", lineHeight: "1.6" },
  galeriaGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" },
  fotoThumb: { width: "100%", height: "100px", objectFit: "cover", borderRadius: "8px", cursor: "pointer", border: "1px solid #eee" },
  qrSeccion: { borderTop: "1px solid #f0f0f0", paddingTop: "1.5rem", marginTop: "1rem", textAlign: "center" },
  qrDesc: { color: "#666", fontSize: "14px", marginBottom: "1.25rem" },
  qrBox: { display: "inline-block", padding: "1rem", background: "white", border: "1px solid #eee", borderRadius: "12px", marginBottom: "1rem" },
  qrUrl: { fontSize: "11px", color: "#999", marginBottom: "1rem", wordBreak: "break-all" },
  btnImprimir: { background: "#1a73e8", color: "white", border: "none", borderRadius: "8px", padding: "10px 24px", cursor: "pointer", fontSize: "14px" }
};