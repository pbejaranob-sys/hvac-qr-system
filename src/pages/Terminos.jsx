import React from "react";

export default function Terminos() {
  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <h1 style={styles.title}>Términos y Condiciones de Servicio</h1>
        <p style={styles.lastUpdate}>Última actualización: {new Date().toLocaleDateString("es-PE", { year: "numeric", month: "long", day: "numeric" })}</p>

        <section style={styles.section}>
          <h2 style={styles.h2}>1. Aceptación de los Términos</h2>
          <p style={styles.p}>
            Los presentes Términos y Condiciones (en adelante, "Términos") regulan el acceso
            y uso de la plataforma <strong>HVAC QR</strong>, propiedad de{" "}
            <strong>HVAC CONTROL PERÚ S.A.C.</strong>, con RUC N° 20610033360, domicilio
            fiscal en Av. Mariscal Cáceres Mz. 23 Lt. 09, Santiago de Surco, Lima, Perú
            (en adelante, "HVAC Control" o "el Proveedor").
          </p>
          <p style={styles.p}>
            Al registrarse y utilizar la plataforma, el usuario (en adelante, "el Cliente"
            o "el Usuario") declara haber leído, comprendido y aceptado en su totalidad
            estos Términos, así como la Política de Privacidad asociada. Si no está de
            acuerdo, deberá abstenerse de usar el servicio.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>2. Descripción del Servicio</h2>
          <p style={styles.p}>
            HVAC QR es una plataforma digital tipo SaaS (Software como Servicio) que permite
            la gestión de inventario, mantenimiento y trazabilidad de equipos de
            climatización (HVAC) mediante el uso de códigos QR únicos asignados a cada
            equipo. Incluye funcionalidades como:
          </p>
          <ul style={styles.ul}>
            <li style={styles.li}>Registro y consulta de equipos</li>
            <li style={styles.li}>Historial de mantenimientos preventivos y correctivos</li>
            <li style={styles.li}>Generación de códigos QR</li>
            <li style={styles.li}>Panel administrativo con control de usuarios y permisos</li>
            <li style={styles.li}>Reportes técnicos</li>
            <li style={styles.li}>Auditoría de acciones realizadas en la plataforma</li>
          </ul>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>3. Registro y cuenta de usuario</h2>
          <p style={styles.p}>
            Para usar la plataforma, el Usuario debe registrarse proporcionando información
            veraz, completa y actualizada. El Usuario es responsable de:
          </p>
          <ul style={styles.ul}>
            <li style={styles.li}>Mantener la confidencialidad de su contraseña</li>
            <li style={styles.li}>Notificar de inmediato cualquier uso no autorizado de su cuenta</li>
            <li style={styles.li}>La totalidad de las acciones realizadas desde su cuenta</li>
          </ul>
          <p style={styles.p}>
            HVAC Control se reserva el derecho de suspender o cancelar cuentas que incumplan
            estos Términos.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>4. Planes, tarifas y pagos</h2>
          <p style={styles.p}>
            HVAC Control ofrece distintos planes de servicio cuyas tarifas vigentes están
            publicadas en la plataforma o son comunicadas mediante propuesta comercial
            específica. Los pagos se realizan según la modalidad acordada (mensual o anual)
            y deben efectuarse en los plazos pactados.
          </p>
          <p style={styles.p}>
            El incumplimiento de pago por más de quince (15) días calendario podrá dar lugar
            a la suspensión temporal del servicio. La reactivación quedará condicionada a la
            regularización del adeudo.
          </p>
          <p style={styles.p}>
            HVAC Control podrá modificar sus tarifas con un preaviso mínimo de treinta (30)
            días calendario al Cliente. Los precios incluyen o excluyen impuestos según se
            indique expresamente en la propuesta comercial o factura.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>5. Obligaciones del Cliente</h2>
          <ul style={styles.ul}>
            <li style={styles.li}>Utilizar la plataforma únicamente para fines lícitos y conforme a estos Términos.</li>
            <li style={styles.li}>No realizar ingeniería inversa, descompilación o intento de acceso no autorizado al sistema.</li>
            <li style={styles.li}>No utilizar la plataforma para almacenar información ilegal, ofensiva o que infrinja derechos de terceros.</li>
            <li style={styles.li}>Mantener actualizados sus datos de contacto y de facturación.</li>
            <li style={styles.li}>Asegurarse de que su personal autorizado cumpla con estos Términos.</li>
          </ul>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>6. Obligaciones de HVAC Control</h2>
          <ul style={styles.ul}>
            <li style={styles.li}>Brindar acceso al servicio conforme al plan contratado.</li>
            <li style={styles.li}>Aplicar medidas razonables de seguridad y respaldo de la información.</li>
            <li style={styles.li}>Atender consultas y solicitudes de soporte en los horarios y plazos definidos.</li>
            <li style={styles.li}>Notificar oportunamente sobre mantenimientos programados o cambios sustanciales.</li>
          </ul>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>7. Propiedad intelectual</h2>
          <p style={styles.p}>
            Todos los derechos de propiedad intelectual sobre la plataforma HVAC QR
            —incluyendo software, diseño, marca, logotipos, textos y contenidos—
            pertenecen a HVAC CONTROL PERÚ S.A.C. El uso del servicio no transfiere al
            Cliente ningún derecho de propiedad intelectual sobre la plataforma.
          </p>
          <p style={styles.p}>
            Los datos cargados por el Cliente (información de equipos, clientes,
            mantenimientos, etc.) son de su exclusiva propiedad. HVAC Control solo actúa
            como custodio técnico de dicha información.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>8. Disponibilidad del servicio</h2>
          <p style={styles.p}>
            HVAC Control hará sus mejores esfuerzos para mantener la plataforma disponible
            las 24 horas del día, los 7 días de la semana, con una disponibilidad objetivo
            del 99.5% mensual. Sin embargo, el servicio puede sufrir interrupciones por:
          </p>
          <ul style={styles.ul}>
            <li style={styles.li}>Mantenimientos programados (preavisados con razonable anticipación)</li>
            <li style={styles.li}>Fallos de proveedores externos (Google Cloud, Vercel, proveedores de internet)</li>
            <li style={styles.li}>Eventos de fuerza mayor o caso fortuito</li>
          </ul>
          <p style={styles.p}>
            HVAC Control no garantiza un servicio absolutamente libre de errores o
            interrupciones.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>9. Limitación de responsabilidad</h2>
          <p style={styles.p}>
            En la máxima medida permitida por la ley aplicable, HVAC CONTROL PERÚ S.A.C. no
            será responsable por:
          </p>
          <ul style={styles.ul}>
            <li style={styles.li}>Daños indirectos, lucro cesante o pérdida de oportunidades comerciales.</li>
            <li style={styles.li}>Pérdida o daño de datos derivados de uso indebido por parte del Cliente.</li>
            <li style={styles.li}>Interrupciones causadas por terceros (proveedores de hosting, internet, etc.).</li>
            <li style={styles.li}>Decisiones técnicas u operativas tomadas por el Cliente con base en la información de la plataforma.</li>
          </ul>
          <p style={styles.p}>
            La responsabilidad máxima de HVAC Control frente al Cliente, por cualquier
            concepto, no excederá el monto total efectivamente pagado por el Cliente durante
            los doce (12) meses anteriores al evento que dio origen al reclamo.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>10. Soporte técnico</h2>
          <p style={styles.p}>
            HVAC Control brinda soporte técnico al correo{" "}
            <a href="mailto:soporte@hvac-control.com.pe" style={styles.link}>soporte@hvac-control.com.pe</a>,
            en horario laboral de lunes a sábado de 8:00 a.m. a 8:00 p.m. (hora de Perú).
            Los tiempos de respuesta y resolución dependen de la criticidad del incidente
            y del plan contratado.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>11. Suspensión y terminación</h2>
          <p style={styles.p}>
            HVAC Control podrá suspender o terminar el servicio en caso de:
          </p>
          <ul style={styles.ul}>
            <li style={styles.li}>Incumplimiento de pago.</li>
            <li style={styles.li}>Uso fraudulento, ilícito o contrario a estos Términos.</li>
            <li style={styles.li}>Solicitud expresa del Cliente.</li>
          </ul>
          <p style={styles.p}>
            Tras la terminación, el Cliente podrá solicitar la exportación de sus datos
            dentro de los noventa (90) días siguientes. Vencido dicho plazo, la información
            será eliminada definitivamente.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>12. Confidencialidad</h2>
          <p style={styles.p}>
            Ambas partes se obligan a mantener confidencialidad sobre la información
            comercial, técnica y operativa intercambiada en el marco del servicio. Esta
            obligación se mantiene vigente durante la prestación y por dos (2) años
            posteriores a su terminación.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>13. Modificación de los Términos</h2>
          <p style={styles.p}>
            HVAC Control podrá modificar estos Términos en cualquier momento. Las
            modificaciones se publicarán en esta página y se notificarán a los usuarios
            registrados por correo electrónico con una antelación mínima de quince (15)
            días calendario. El uso continuado del servicio luego de la entrada en vigor
            implica la aceptación de los Términos modificados.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>14. Legislación aplicable y jurisdicción</h2>
          <p style={styles.p}>
            Estos Términos se rigen por las leyes de la <strong>República del Perú</strong>.
            Cualquier controversia derivada de la interpretación o cumplimiento será
            sometida a los <strong>Jueces y Tribunales de la ciudad de Lima – Cercado</strong>,
            con renuncia expresa a cualquier otro fuero o jurisdicción.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>15. Contacto</h2>
          <p style={styles.p}>
            Para cualquier consulta, queja o sugerencia relacionada con estos Términos:
          </p>
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
