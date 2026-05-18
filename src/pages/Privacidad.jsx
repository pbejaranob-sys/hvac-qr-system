import React from "react";

export default function Privacidad() {
  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <h1 style={styles.title}>Política de Privacidad</h1>
        <p style={styles.lastUpdate}>Última actualización: {new Date().toLocaleDateString("es-PE", { year: "numeric", month: "long", day: "numeric" })}</p>

        <section style={styles.section}>
          <h2 style={styles.h2}>1. Identificación del Titular</h2>
          <p style={styles.p}>
            <strong>HVAC CONTROL PERÚ S.A.C.</strong> (en adelante, "HVAC Control" o "nosotros"),
            con RUC N° 20610033360, domicilio fiscal en Av. Mariscal Cáceres Mz. 23 Lt. 09,
            distrito de Santiago de Surco, provincia y departamento de Lima, Perú, es la
            empresa responsable del tratamiento de los datos personales recogidos a través
            de la plataforma <strong>HVAC QR</strong>, disponible en el dominio{" "}
            <a href="https://www.hvac-control.com.pe" style={styles.link}>www.hvac-control.com.pe</a>.
          </p>
          <p style={styles.p}>
            Para cualquier consulta relacionada a esta Política o al tratamiento de sus datos,
            puede comunicarse al correo:{" "}
            <a href="mailto:soporte@hvac-control.com.pe" style={styles.link}>soporte@hvac-control.com.pe</a>.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>2. Marco Legal</h2>
          <p style={styles.p}>
            Esta Política se elabora en cumplimiento de la <strong>Ley N° 29733 – Ley de
            Protección de Datos Personales</strong>, su Reglamento aprobado por Decreto
            Supremo N° 003-2013-JUS, así como demás normas concordantes vigentes en la
            República del Perú.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>3. Datos que recopilamos</h2>
          <p style={styles.p}>
            HVAC QR es una plataforma técnica para gestión de equipos de climatización
            mediante códigos QR. Los datos que recopilamos son los estrictamente necesarios
            para la prestación del servicio:
          </p>
          <h3 style={styles.h3}>3.1 Datos de la cuenta (usuarios administradores y técnicos)</h3>
          <ul style={styles.ul}>
            <li style={styles.li}>Nombres y apellidos</li>
            <li style={styles.li}>Correo electrónico</li>
            <li style={styles.li}>Contraseña cifrada</li>
            <li style={styles.li}>Rol asignado (administrador, supervisor, técnico)</li>
            <li style={styles.li}>Fecha y hora del último ingreso</li>
          </ul>
          <h3 style={styles.h3}>3.2 Datos técnicos de los equipos</h3>
          <ul style={styles.ul}>
            <li style={styles.li}>Marca, modelo, número de serie</li>
            <li style={styles.li}>Ubicación (ambiente, piso, cliente)</li>
            <li style={styles.li}>Capacidad, amperaje, fases</li>
            <li style={styles.li}>Historial de mantenimientos y observaciones técnicas</li>
            <li style={styles.li}>Estado operativo</li>
          </ul>
          <h3 style={styles.h3}>3.3 Datos de uso</h3>
          <ul style={styles.ul}>
            <li style={styles.li}>Dirección IP, tipo de navegador y dispositivo</li>
            <li style={styles.li}>Registros de actividad (auditoría de acciones realizadas en la plataforma)</li>
          </ul>
          <p style={styles.p}>
            <strong>Importante:</strong> No recopilamos datos sensibles tales como información
            de salud, ideología, religión, datos biométricos ni información financiera.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>4. Finalidad del tratamiento</h2>
          <p style={styles.p}>Los datos recopilados serán utilizados exclusivamente para:</p>
          <ul style={styles.ul}>
            <li style={styles.li}>Permitir el acceso y uso de la plataforma HVAC QR</li>
            <li style={styles.li}>Gestionar el inventario y mantenimiento de equipos HVAC del cliente</li>
            <li style={styles.li}>Generar reportes técnicos y auditoría de acciones</li>
            <li style={styles.li}>Brindar soporte técnico y atender consultas</li>
            <li style={styles.li}>Cumplir obligaciones legales y contractuales</li>
            <li style={styles.li}>Mejorar el servicio (de forma agregada y anonimizada)</li>
          </ul>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>5. Base legal del tratamiento</h2>
          <p style={styles.p}>
            Tratamos sus datos personales con base en: (a) el consentimiento que usted otorga
            al registrarse, (b) la ejecución del contrato de prestación de servicios, y (c) el
            cumplimiento de obligaciones legales aplicables.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>6. Almacenamiento y transferencia internacional</h2>
          <p style={styles.p}>
            Los datos se almacenan en servidores de <strong>Google Firebase</strong> (Google
            Cloud Platform) ubicados en Estados Unidos, y la plataforma se sirve a través de{" "}
            <strong>Vercel Inc.</strong> Ambos proveedores cumplen estándares internacionales
            de seguridad de la información (ISO 27001, SOC 2). Al aceptar esta Política, usted
            consiente expresamente la transferencia internacional de sus datos a dichos
            proveedores.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>7. Plazo de conservación</h2>
          <p style={styles.p}>
            Los datos se conservarán mientras el cliente mantenga una cuenta activa en la
            plataforma. Tras la terminación del servicio, los datos se eliminarán de forma
            definitiva en un plazo máximo de noventa (90) días calendario, salvo obligación
            legal de conservación.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>8. Derechos del titular (Derechos ARCO)</h2>
          <p style={styles.p}>
            Conforme a la Ley N° 29733, usted tiene derecho a:
          </p>
          <ul style={styles.ul}>
            <li style={styles.li}><strong>Acceso:</strong> conocer qué datos suyos tratamos.</li>
            <li style={styles.li}><strong>Rectificación:</strong> corregir datos inexactos o incompletos.</li>
            <li style={styles.li}><strong>Cancelación:</strong> solicitar la eliminación de sus datos.</li>
            <li style={styles.li}><strong>Oposición:</strong> oponerse al tratamiento por motivos legítimos.</li>
            <li style={styles.li}><strong>Revocación del consentimiento</strong> en cualquier momento.</li>
            <li style={styles.li}><strong>Portabilidad:</strong> obtener una copia exportable de sus datos.</li>
          </ul>
          <p style={styles.p}>
            Para ejercer cualquiera de estos derechos, envíe una solicitud al correo{" "}
            <a href="mailto:soporte@hvac-control.com.pe" style={styles.link}>soporte@hvac-control.com.pe</a>,
            adjuntando copia de su documento de identidad. Le responderemos dentro del plazo
            legal de veinte (20) días hábiles. De considerar vulnerados sus derechos, podrá
            presentar una denuncia ante la <strong>Autoridad Nacional de Protección de Datos
            Personales (ANPDP)</strong> del Ministerio de Justicia y Derechos Humanos.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>9. Medidas de seguridad</h2>
          <p style={styles.p}>
            Aplicamos medidas técnicas y organizativas razonables para proteger los datos:
          </p>
          <ul style={styles.ul}>
            <li style={styles.li}>Cifrado de comunicaciones mediante HTTPS / TLS 1.3</li>
            <li style={styles.li}>Cifrado en reposo en la base de datos (AES-256)</li>
            <li style={styles.li}>Contraseñas almacenadas con algoritmos de hashing seguros (bcrypt)</li>
            <li style={styles.li}>Control de acceso por roles y permisos</li>
            <li style={styles.li}>Registro de auditoría de acciones</li>
            <li style={styles.li}>Respaldos automáticos diarios</li>
            <li style={styles.li}>Reglas de seguridad de base de datos (Firestore Security Rules)</li>
            <li style={styles.li}>Cabeceras de seguridad HTTP (XSS, Frame Options, etc.)</li>
          </ul>
          <p style={styles.p}>
            Ninguna medida técnica es infalible. Ante un incidente de seguridad que afecte
            sus datos, le notificaremos en el plazo más breve posible.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>10. Cookies</h2>
          <p style={styles.p}>
            La plataforma utiliza cookies estrictamente necesarias para el funcionamiento
            (mantenimiento de sesión y autenticación). No empleamos cookies publicitarias ni
            de seguimiento de terceros.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>11. Menores de edad</h2>
          <p style={styles.p}>
            HVAC QR es una herramienta profesional dirigida a personas mayores de edad. No
            recopilamos información de menores de 18 años de manera intencional.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>12. Modificaciones a esta Política</h2>
          <p style={styles.p}>
            HVAC CONTROL PERÚ S.A.C. se reserva el derecho de modificar esta Política. Los
            cambios serán publicados en esta misma página con la fecha de actualización. Si
            los cambios son sustanciales, notificaremos a los usuarios registrados por correo
            electrónico.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>13. Contacto</h2>
          <p style={styles.p}>
            <strong>HVAC CONTROL PERÚ S.A.C.</strong><br />
            RUC: 20610033360<br />
            Dirección: Av. Mariscal Cáceres Mz. 23 Lt. 09, Santiago de Surco, Lima, Perú<br />
            Correo: <a href="mailto:soporte@hvac-control.com.pe" style={styles.link}>soporte@hvac-control.com.pe</a><br />
            Web: <a href="https://www.hvac-control.com.pe" style={styles.link}>www.hvac-control.com.pe</a>
          </p>
        </section>

        <div style={styles.footer}>
          <a href="/" style={styles.backLink}>← Volver al inicio</a>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    background: "#f7fafd",
    padding: "2rem 1rem",
    fontFamily: "Arial, Helvetica, sans-serif",
    color: "#1f2937",
  },
  content: {
    maxWidth: "820px",
    margin: "0 auto",
    background: "white",
    padding: "2.5rem 2.5rem",
    borderRadius: "12px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
    border: "0.5px solid #d0dce8",
  },
  title: {
    color: "#0B5394",
    fontSize: "28px",
    marginBottom: "0.3rem",
    fontWeight: 700,
  },
  lastUpdate: {
    color: "#6B7280",
    fontSize: "13px",
    marginBottom: "2rem",
    fontStyle: "italic",
  },
  section: { marginBottom: "1.8rem" },
  h2: {
    color: "#0B5394",
    fontSize: "18px",
    marginBottom: "0.6rem",
    marginTop: "1.5rem",
    fontWeight: 700,
  },
  h3: {
    color: "#1F2937",
    fontSize: "14px",
    marginBottom: "0.4rem",
    marginTop: "0.8rem",
    fontWeight: 700,
  },
  p: {
    fontSize: "14px",
    lineHeight: 1.7,
    marginBottom: "0.8rem",
    textAlign: "justify",
  },
  ul: {
    fontSize: "14px",
    lineHeight: 1.7,
    paddingLeft: "1.3rem",
    marginBottom: "0.8rem",
  },
  li: { marginBottom: "0.3rem" },
  link: {
    color: "#1A73E8",
    textDecoration: "none",
  },
  footer: {
    marginTop: "2.5rem",
    paddingTop: "1.2rem",
    borderTop: "1px solid #e5e7eb",
    textAlign: "center",
  },
  backLink: {
    color: "#0B5394",
    textDecoration: "none",
    fontSize: "14px",
    fontWeight: 500,
  },
};
