import React, { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs, deleteDoc, doc, query, where } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";

const FONT = "'Manrope', -apple-system, sans-serif";

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
    document.body.style.background = "#eef1f6";
    return () => {
      document.body.style.margin = prevMargin;
      document.body.style.background = prevBg;
    };
  }, []);
}

const initiales = (nombre) => {
  const words = nombre.trim().split(" ");
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return nombre.substring(0, 2).toUpperCase();
};

const colorAvatar = (nombre) => {
  const colores = [
    { bg: "#e5f0ff", color: "#1a4fc0" },
    { bg: "#e6f7ec", color: "#1c7a44" },
    { bg: "#f1e9fb", color: "#7c3fb8" },
    { bg: "#fff3d6", color: "#a8720b" },
    { bg: "#fdeeee", color: "#a52b2b" },
    { bg: "#e0f4f2", color: "#0d7a6c" },
  ];
  let sum = 0;
  for (let i = 0; i < nombre.length; i++) sum += nombre.charCodeAt(i);
  return colores[sum % colores.length];
};

export default function PanelAdmin() {
  useManropeAndBodyReset();

  const [admins, setAdmins] = useState([]);
  const [totalClientes, setTotalClientes] = useState(0);
  const [totalEquipos, setTotalEquipos] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [viendoAdmin, setViendoAdmin] = useState(null);
  const [clientesAdmin, setClientesAdmin] = useState([]);
  const [equiposAdmin, setEquiposAdmin] = useState([]);
  const [cargandoVista, setCargandoVista] = useState(false);
  const navigate = useNavigate();

  useEffect(() => { cargarAdmins(); }, []);

  const cargarAdmins = async () => {
    setCargando(true);
    try {
      const snapUsuarios = await getDocs(collection(db, "usuarios"));
      const listaAdmins = snapUsuarios.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(u => u.rol === "admin" && !u.superadmin);

      const snapEquipos = await getDocs(collection(db, "equipos"));
      const equipos = snapEquipos.docs.map(d => ({ id: d.id, ...d.data() }));

      const snapClientes = await getDocs(collection(db, "clientes"));
      const clientes = snapClientes.docs.map(d => ({ id: d.id, ...d.data() }));

      const adminsConDatos = listaAdmins.map(admin => {
        const adminUid = admin.uid || admin.id;
        const equiposAdminLista = equipos.filter(e => e.adminid === adminUid);
        const clientesAdminLista = clientes.filter(c => c.adminid === adminUid);
        return {
          ...admin,
          adminUid,
          numEquipos: equiposAdminLista.length,
          numClientes: clientesAdminLista.length
        };
      });

      setAdmins(adminsConDatos);
      setTotalClientes(adminsConDatos.reduce((acc, a) => acc + a.numClientes, 0));
      setTotalEquipos(adminsConDatos.reduce((acc, a) => acc + a.numEquipos, 0));
    } catch (err) {
      console.error("Error cargando admins:", err);
    }
    setCargando(false);
  };

  const handleVerAdmin = async (admin) => {
    setViendoAdmin(admin);
    setCargandoVista(true);
    try {
      const adminUid = admin.uid || admin.id;
      const qClientes = query(collection(db, "clientes"), where("adminid", "==", adminUid));
      const snapClientes = await getDocs(qClientes);
      setClientesAdmin(snapClientes.docs.map(d => ({ id: d.id, ...d.data() })));

      const qEquipos = query(collection(db, "equipos"), where("adminid", "==", adminUid));
      const snapEquipos = await getDocs(qEquipos);
      setEquiposAdmin(snapEquipos.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error(err);
    }
    setCargandoVista(false);
  };

  const handleEliminar = async (admin, nombre) => {
    if (!window.confirm(`¿Eliminar al admin ${nombre} y todos sus clientes, equipos y sedes? Esta acción no se puede deshacer.`)) return;
    const adminId = admin.id;
    const adminUid = admin.uid || admin.id;
    try {
      const borrarQuery = async (col) => {
        const snap = await getDocs(query(collection(db, col), where("adminid", "==", adminUid)));
        await Promise.all(snap.docs.map(d => deleteDoc(doc(db, col, d.id))));
        return snap.size;
      };

      await borrarQuery("equipos");
      await borrarQuery("sedes");

      const snapUsuariosCliente = await getDocs(query(collection(db, "usuarios"), where("adminid", "==", adminUid)));
      await Promise.all(snapUsuariosCliente.docs.map(d => deleteDoc(doc(db, "usuarios", d.id))));

      await borrarQuery("clientes");
      await deleteDoc(doc(db, "usuarios", adminId));

      setAdmins(prev => {
        const nuevaLista = prev.filter(a => a.id !== adminId);
        setTotalClientes(nuevaLista.reduce((acc, a) => acc + a.numClientes, 0));
        setTotalEquipos(nuevaLista.reduce((acc, a) => acc + a.numEquipos, 0));
        return nuevaLista;
      });

      if (viendoAdmin?.id === adminId) setViendoAdmin(null);
    } catch (err) {
      alert("Error al eliminar: " + err.message);
    }
  };

  const handleBackup = async () => {
    try {
      const snapEquipos = await getDocs(collection(db, "equipos"));
      const snapUsuarios = await getDocs(collection(db, "usuarios"));
      const snapClientes = await getDocs(collection(db, "clientes"));
      const snapSedes = await getDocs(collection(db, "sedes"));
      const data = {
        fecha: new Date().toISOString(),
        equipos: snapEquipos.docs.map(d => ({ id: d.id, ...d.data() })),
        usuarios: snapUsuarios.docs.map(d => ({ id: d.id, ...d.data() })),
        clientes: snapClientes.docs.map(d => ({ id: d.id, ...d.data() })),
        sedes: snapSedes.docs.map(d => ({ id: d.id, ...d.data() })),
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `hvac-backup-${new Date().toLocaleDateString("es-PE").replace(/\//g, "-")}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("Error al generar backup: " + err.message);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/");
  };

  return (
    <div style={s.page}>
      <div style={s.navbar}>
        <div style={s.navLeft}>
          <div style={s.logoBox}><img src="/assets/hvac-isotipo-filled.png" alt="HVAC" style={s.logoImg} /></div>
          <div style={s.navDivider}></div>
          <span style={s.navTitle}>Panel Maestro</span>
        </div>
        <div style={s.navBtns}>
          <button style={s.btnSuccess} onClick={() => navigate("/crear-usuario")}>+ Crear usuario</button>
          <button style={s.btnWarning} onClick={handleBackup}>⬇ Backup</button>
          <button style={s.btnDanger} onClick={handleLogout}>Salir</button>
        </div>
      </div>

      <div style={s.content}>
        <div style={s.statsGrid}>
          <div style={s.statCard}>
            <div style={{ ...s.statNum, color: "#1a4fc0" }}>{admins.length}</div>
            <div style={s.statLabel}>Admins</div>
          </div>
          <div style={s.statCard}>
            <div style={{ ...s.statNum, color: "#12245e" }}>{totalClientes}</div>
            <div style={s.statLabel}>Clientes totales</div>
          </div>
          <div style={s.statCard}>
            <div style={{ ...s.statNum, color: "#1c7a44" }}>{totalEquipos}</div>
            <div style={s.statLabel}>Equipos totales</div>
          </div>
        </div>

        <div style={s.secTitle}>Usuarios administradores</div>

        {cargando ? (
          <div style={s.empty}>Cargando...</div>
        ) : admins.length === 0 ? (
          <div style={s.empty}>No hay admins creados aún. Usa "Crear usuario" para agregar uno.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {admins.map(admin => {
              const av = colorAvatar(admin.nombre || admin.email);
              return (
                <div key={admin.id} style={s.adminRow}>
                  <div style={{ ...s.avatar, background: av.bg, color: av.color }}>
                    {initiales(admin.nombre || admin.email)}
                  </div>
                  <div style={s.adminInfo}>
                    <div style={s.adminNombre}>{admin.nombre || "Sin nombre"}</div>
                    <div style={s.adminSub}>{admin.email} · {admin.numClientes} cliente{admin.numClientes !== 1 ? "s" : ""} · {admin.numEquipos} equipo{admin.numEquipos !== 1 ? "s" : ""}</div>
                  </div>
                  <span style={s.badge}>Admin</span>
                  <button style={s.btnIcon} onClick={() => handleVerAdmin(admin)}>👁</button>
                  <button style={s.btnIconDanger} onClick={() => handleEliminar(admin, admin.nombre)}>🗑</button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal ver admin */}
      {viendoAdmin && (
        <div style={s.modalOverlay}>
          <div style={s.modalCard}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
              <div>
                <div style={{ fontSize: "15.5px", fontWeight: 800, color: "#12245e" }}>{viendoAdmin.nombre}</div>
                <div style={{ fontSize: "12.5px", color: "#8a92a6", fontWeight: 600 }}>{viendoAdmin.email}</div>
              </div>
              <button style={s.btnCerrar} onClick={() => setViendoAdmin(null)}>✕</button>
            </div>

            {cargandoVista ? (
              <div style={{ textAlign: "center", color: "#8a92a6", padding: "20px" }}>Cargando...</div>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "18px" }}>
                  <div style={s.miniStatCard}>
                    <div style={{ fontSize: "22px", fontWeight: 800, color: "#1a4fc0" }}>{clientesAdmin.length}</div>
                    <div style={{ fontSize: "10.5px", color: "#8a92a6", textTransform: "uppercase", fontWeight: 700 }}>Clientes</div>
                  </div>
                  <div style={s.miniStatCard}>
                    <div style={{ fontSize: "22px", fontWeight: 800, color: "#1c7a44" }}>{equiposAdmin.length}</div>
                    <div style={{ fontSize: "10.5px", color: "#8a92a6", textTransform: "uppercase", fontWeight: 700 }}>Equipos</div>
                  </div>
                </div>

                <div style={s.secTitle}>Clientes</div>
                {clientesAdmin.length === 0 ? (
                  <div style={{ fontSize: "12.5px", color: "#c3cad9", marginBottom: "14px" }}>Sin clientes registrados</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "7px", marginBottom: "18px" }}>
                    {clientesAdmin.map(c => {
                      const equiposCliente = equiposAdmin.filter(e => e.cliente === c.empresa);
                      return (
                        <div key={c.id} style={s.itemRow}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: "13px", fontWeight: 700, color: "#12245e" }}>{c.empresa}</div>
                            <div style={{ fontSize: "11.5px", color: "#8a92a6", fontWeight: 600 }}>{c.nombre} · {c.email}</div>
                          </div>
                          <span style={{ fontSize: "11.5px", color: "#8a92a6", fontWeight: 700 }}>{equiposCliente.length} equipos</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div style={s.secTitle}>Equipos recientes</div>
                {equiposAdmin.length === 0 ? (
                  <div style={{ fontSize: "12.5px", color: "#c3cad9" }}>Sin equipos registrados</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "7px", maxHeight: "200px", overflowY: "auto" }}>
                    {equiposAdmin.slice(0, 10).map(e => (
                      <div key={e.id} style={s.itemRow}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: "12.5px", fontWeight: 700, color: "#12245e" }}>{e.marca} {e.modelo}</div>
                          <div style={{ fontSize: "11.5px", color: "#8a92a6", fontWeight: 600 }}>{e.cliente} · {e.tipoEquipo || "-"}</div>
                        </div>
                        <span style={e.estado === "Operativo" ? s.badgeOp : e.estado === "Operativo con observaciones" ? s.badgeObs : s.badgeFs}>
                          {e.estado === "Operativo" ? "Op." : e.estado === "Operativo con observaciones" ? "Obs." : "F.S."}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  page: { minHeight: "100vh", width: "100%", background: "#eef1f6", fontFamily: FONT, boxSizing: "border-box" },
  navbar: { background: "white", borderBottom: "1px solid #e7ebf3", padding: "14px clamp(16px,4vw,32px)", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10, flexWrap: "wrap", gap: "12px" },
  navLeft: { display: "flex", alignItems: "center", gap: "12px" },
  logoBox: { width: "40px", height: "40px", minWidth: "40px", borderRadius: "10px", background: "#1a4fc0", display: "flex", alignItems: "center", justifyContent: "center" },
  logoImg: { width: "25px", height: "25px", objectFit: "contain", filter: "brightness(0) invert(1)" },
  navDivider: { width: "1px", height: "18px", background: "#e7ebf3" },
  navTitle: { fontSize: "14.5px", color: "#26314d", fontWeight: 700 },
  navBtns: { display: "flex", gap: "10px" },
  btnSuccess: { background: "#e6f7ec", color: "#1c7a44", border: "none", borderRadius: "10px", padding: "9px 16px", cursor: "pointer", fontSize: "13px", fontWeight: 700, fontFamily: "inherit" },
  btnWarning: { background: "#fff3d6", color: "#a8720b", border: "none", borderRadius: "10px", padding: "9px 16px", cursor: "pointer", fontSize: "13px", fontWeight: 700, fontFamily: "inherit" },
  btnDanger: { background: "#fdeeee", color: "#a52b2b", border: "none", borderRadius: "10px", padding: "9px 16px", cursor: "pointer", fontSize: "13px", fontWeight: 700, fontFamily: "inherit" },
  content: { maxWidth: "900px", margin: "0 auto", padding: "clamp(16px,4vw,32px)" },
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: "14px", marginBottom: "26px" },
  statCard: { background: "white", border: "1px solid #e7ebf3", borderRadius: "16px", padding: "22px", textAlign: "center" },
  statNum: { fontSize: "clamp(28px,4vw,34px)", fontWeight: 800, color: "#333" },
  statLabel: { fontSize: "11px", color: "#8a92a6", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: "4px", fontWeight: 700 },
  secTitle: { fontSize: "11px", color: "#8a92a6", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "12px", fontWeight: 700 },
  adminRow: { background: "white", border: "1px solid #e7ebf3", borderRadius: "14px", padding: "13px 16px", display: "flex", alignItems: "center", gap: "12px" },
  avatar: { width: "38px", height: "38px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 800, flexShrink: 0 },
  adminInfo: { flex: 1 },
  adminNombre: { fontSize: "14px", fontWeight: 800, color: "#12245e" },
  adminSub: { fontSize: "11.5px", color: "#8a92a6", marginTop: "2px", fontWeight: 600 },
  badge: { fontSize: "11px", padding: "4px 11px", borderRadius: "20px", background: "#e5f0ff", color: "#1a4fc0", fontWeight: 700 },
  btnIcon: { background: "white", border: "1px solid #dfe6f5", borderRadius: "9px", padding: "7px 11px", cursor: "pointer", fontSize: "13px" },
  btnIconDanger: { background: "#fdeeee", border: "none", borderRadius: "9px", padding: "7px 11px", cursor: "pointer", fontSize: "13px" },
  empty: { background: "white", border: "1px solid #e7ebf3", borderRadius: "16px", padding: "34px", textAlign: "center", color: "#8a92a6", fontSize: "14px", fontWeight: 600 },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(10,25,70,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "20px", boxSizing: "border-box" },
  modalCard: { background: "white", borderRadius: "18px", padding: "26px", width: "100%", maxWidth: "520px", boxShadow: "0 20px 50px rgba(0,10,40,0.3)", maxHeight: "80vh", overflowY: "auto", boxSizing: "border-box" },
  btnCerrar: { background: "none", border: "none", fontSize: "16px", cursor: "pointer", color: "#8a92a6", padding: "4px 8px" },
  miniStatCard: { background: "#f9fafc", border: "1px solid #e7ebf3", borderRadius: "12px", padding: "14px", textAlign: "center" },
  itemRow: { background: "#f9fafc", border: "1px solid #e7ebf3", borderRadius: "10px", padding: "9px 13px", display: "flex", alignItems: "center", gap: "10px" },
  badgeOp: { fontSize: "10px", padding: "3px 8px", borderRadius: "20px", background: "#e6f7ec", color: "#1c7a44", fontWeight: 700, whiteSpace: "nowrap" },
  badgeObs: { fontSize: "10px", padding: "3px 8px", borderRadius: "20px", background: "#fff3d6", color: "#a8720b", fontWeight: 700, whiteSpace: "nowrap" },
  badgeFs: { fontSize: "10px", padding: "3px 8px", borderRadius: "20px", background: "#fdeeee", color: "#a52b2b", fontWeight: 700, whiteSpace: "nowrap" },
};
