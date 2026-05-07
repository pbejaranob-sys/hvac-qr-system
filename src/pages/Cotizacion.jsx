import { useEffect, useState } from "react";
import { db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import { useParams, useNavigate } from "react-router-dom";
import jsPDF from "jspdf";

export default function Cotizacion() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [equipo, setEquipo] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [pdfSubido, setPdfSubido] = useState(null);
  const [nombrePdf, setNombrePdf] = useState("");

  useEffect(() => { cargarEquipo(); }, []);

  const cargarEquipo = async () => {
    try {
      const ref = doc(db, "equipos", id);
      const snap = await getDoc(ref);
      if (snap.exists()) setEquipo({ id: snap.id, ...snap.data() });
    } catch (e) { console.error(e); }
    setCargando(false);
  };

  const handlePdfUpload = (e) => {
    const file = e.target.files[0];
    if (file && file.type === "application/pdf") {
      setPdfSubido(URL.createObjectURL(file));
      setNombrePdf(file.name);
    } else {
      alert("Por favor selecciona un archivo PDF");
    }
  };

  const generarCotizacionPDF = () => {
    const pdf = new jsPDF("p", "mm", "a4");
    const margen = 15;
    let y = 20;

    pdf.setFillColor(26, 115, 232);
    pdf.rect(0, 0, 210, 18, "F");
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(255, 255, 255);
    pdf.text("COTIZACIÓN DE CORRECTIVOS - HVAC QR SYSTEM", margen, 12);
    y = 28;

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(100, 100, 100);
    pdf.text(`Fecha: ${new Date().toLocaleDateString("es-PE")}`, margen, y);
    pdf.text(`Equipo ID: ${id.slice(0,6).toUpperCase()}`, 140, y);
    y += 10;

    const seccion = (texto) => {
      pdf.setFontSize(13);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(26, 115, 232);
      pdf.text(texto, margen, y);
      y += 7;
      pdf.setDrawColor(220, 220, 220);
      pdf.line(margen, y, margen + 180, y);
      y += 6;
    };

    const campo = (label, valor) => {
      if (!valor) return;
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(100, 100, 100);
      pdf.text(label + ":", margen, y);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(30, 30, 30);
      const lines = pdf.splitTextToSize(String(valor), 130);
      pdf.text(lines, margen + 45, y);
      y += lines.length * 6;
    };

    seccion("DATOS DEL EQUIPO");
    campo("Cliente", equipo.cliente);
    campo("Piso", equipo.piso);
    campo("Ambiente", equipo.ambiente);
    campo("Tipo equipo", equipo.tipoEquipo);
    campo("Marca / Modelo", `${equipo.marca} ${equipo.modelo}`);
    campo("N° Serie", equipo.serie);
    y += 4;

    seccion("CORRECTIVOS A REALIZAR");
    if (equipo.correctivos) {
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(30, 30, 30);
      const lines = pdf.splitTextToSize(equipo.correctivos, 180);
      pdf.text(lines, margen, y);
      y += lines.length * 6 + 4;
    } else {
      pdf.setFontSize(10);
      pdf.setTextColor(150, 150, 150);
      pdf.text("Sin correctivos registrados", margen, y);
      y += 10;
    }

    seccion("DETALLE DE COTIZACIÓN");
    pdf.setFillColor(240, 244, 248);
    pdf.rect(margen, y - 4, 180, 8, "F");
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(60, 60, 60);
    pdf.text("Descripción", margen + 2, y + 1);
    pdf.text("Cant.", 130, y + 1);
    pdf.text("P. Unit.", 150, y + 1);
    pdf.text("Total", 172, y + 1);
    y += 8;

    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(30, 30, 30);
    for (let i = 0; i < 8; i++) {
      pdf.setDrawColor(220, 220, 220);
      pdf.line(margen, y, margen + 180, y);
      y += 8;
    }

    pdf.line(margen, y, margen + 180, y);
    y += 6;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.text("TOTAL S/.", 150, y);
    pdf.text("__________", 165, y);
    y += 10;

    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(150, 150, 150);
    pdf.text("* Cotización válida por 15 días calendario.", margen, y);
    y += 5;
    pdf.text("* Precios incluyen IGV.", margen, y);
    pdf.text(`Generado el ${new Date().toLocaleDateString("es-PE")} · HVAC QR System`, margen, 290);

    pdf.save(`cotizacion-${equipo.cliente}-${id.slice(0,6)}.pdf`);
  };

  if (cargando) return <div style={styles.centro}>Cargando...</div>;
  if (!equipo) return <div style={styles.centro}>Equipo no encontrado</div>;

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <button style={styles.btnVolver} onClick={() => navigate(-1)}>← Volver</button>
        <h2 style={styles.titulo}>📋 Cotización del equipo</h2>

        <div style={styles.infoEquipo}>
          <div style={styles.infoGrid}>
            <div style={styles.dato}><span style={styles.datoLabel}>Cliente</span><span>{equipo.cliente}</span></div>
            <div style={styles.dato}><span style={styles.datoLabel}>Piso</span><span>{equipo.piso || "—"}</span></div>
            <div style={styles.dato}><span style={styles.datoLabel}>Ambiente</span><span>{equipo.ambiente || "—"}</span></div>
            <div style={styles.dato}><span style={styles.datoLabel}>Equipo</span><span>{equipo.marca} {equipo.modelo}</span></div>
          </div>
        </div>

        {equipo.correctivos && (
          <div style={styles.seccion}>
            <p style={styles.seccionTitulo}>⚠️ Correctivos registrados</p>
            <p style={styles.texto}>{equipo.correctivos}</p>
          </div>
        )}

        <div style={styles.seccion}>
          <p style={styles.seccionTitulo}>📄 Opciones de cotización</p>
          <div style={styles.opcionesGrid}>
            <div style={styles.opcionCard}>
              <p style={styles.opcionTitulo}>🖨️ Generar cotización PDF</p>
              <p style={styles.opcionDesc}>Genera una plantilla PDF con los datos del equipo y correctivos.</p>
              <button style={styles.btnGenerar} onClick={generarCotizacionPDF}>📄 Descargar plantilla PDF</button>
            </div>
            <div style={styles.opcionCard}>
              <p style={styles.opcionTitulo}>📁 Cargar cotización existente</p>
              <p style={styles.opcionDesc}>Sube un PDF de cotización que hayas creado previamente.</p>
              <label style={styles.btnCargar}>
                📂 Seleccionar PDF
                <input type="file" accept=".pdf" onChange={handlePdfUpload} style={{display:"none"}} />
              </label>
              {nombrePdf && <p style={styles.nombrePdf}>✅ {nombrePdf}</p>}
            </div>
          </div>
        </div>

        {pdfSubido && (
          <div style={styles.seccion}>
            <p style={styles.seccionTitulo}>👁️ Vista previa</p>
            <iframe src={pdfSubido} style={styles.pdfViewer} title="Cotización PDF" />
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: "100vh", background: "#f0f4f8", padding: "1.5rem" },
  card: { background: "white", borderRadius: "12px", padding: "2rem", maxWidth: "750px", margin: "0 auto", boxShadow: "0 2px 10px rgba(0,0,0,0.08)" },
  centro: { textAlign: "center", padding: "3rem", fontSize: "18px" },
  btnVolver: { background: "none", border: "1px solid #ddd", borderRadius: "8px", padding: "8px 14px", cursor: "pointer", color: "#555", marginBottom: "1.5rem" },
  titulo: { color: "#1a73e8", marginBottom: "1.5rem" },
  infoEquipo: { background: "#f8f9fa", borderRadius: "10px", padding: "1rem", marginBottom: "1rem" },
  infoGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" },
  dato: { display: "flex", flexDirection: "column" },
  datoLabel: { fontSize: "11px", color: "#999", textTransform: "uppercase", marginBottom: "2px" },
  seccion: { borderTop: "1px solid #f0f0f0", paddingTop: "1rem", marginTop: "1rem" },
  seccionTitulo: { fontWeight: "600", color: "#333", marginBottom: "0.75rem" },
  texto: { color: "#555", fontSize: "14px", lineHeight: "1.6" },
  opcionesGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" },
  opcionCard: { background: "#f8f9fa", borderRadius: "10px", padding: "1.25rem", border: "1px solid #eee" },
  opcionTitulo: { fontWeight: "600", color: "#333", marginBottom: "0.5rem" },
  opcionDesc: { fontSize: "13px", color: "#666", marginBottom: "1rem", lineHeight: "1.5" },
  btnGenerar: { width: "100%", padding: "10px", background: "#1a73e8", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "13px", fontWeight: "500" },
  btnCargar: { display: "block", width: "100%", padding: "10px", background: "#9c27b0", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "13px", fontWeight: "500", textAlign: "center", boxSizing: "border-box" },
  nombrePdf: { fontSize: "12px", color: "#2e7d32", marginTop: "8px" },
  pdfViewer: { width: "100%", height: "500px", border: "1px solid #ddd", borderRadius: "8px" }
};