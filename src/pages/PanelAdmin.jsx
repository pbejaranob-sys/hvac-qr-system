import React, { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs, deleteDoc, doc, query, where } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";

const initiales = (nombre) => {
  const words = nombre.trim().split(" ");
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return nombre.substring(0, 2).toUpperCase();
};

const colorAvatar = (nombre) => {
  const colores = [
    { bg: "#e8f0fe", color: "#1a5fa8" },
    { bg: "#e8f5e9", color: "#2e7d32" },
    { bg: "#f3e5f5", color: "#6a1b9a" },
    { bg: "#fff8e1", color: "#e65100" },
    { bg: "#fce4ec", color: "#c62828" },
    { bg: "#e0f2f1", color: "#00695c" },
  ];
  let sum = 0;
  for (let i = 0; i < nombre.length; i++) sum += nombre.charCodeAt(i);
  return colores[sum % colores.length];
};

export default function PanelAdmin() {
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
setTotalEquipos(adminsConDatos.reduce((acc, a) => acc + a.numEquipos, 0));  // ← corregida
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

    // ✅ Actualizar lista y recalcular contadores
    setAdmins(prev => {
      const nuevaLista = prev.filter(a => a.id !== adminId);
      setTotalClientes(nuevaLista.reduce((acc, a) => acc + a.numClientes, 0));
      setTotalEquipos(nuevaLista.reduce((acc, a) => acc + a.numEquipos, 0));
      return nuevaLista;
    });

    // Cerrar modal si estaba viendo ese admin
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
          <div style={s.logo}>
            <span style={{ color: "#1a5fa8" }}>H</span>
            <span style={{ color: "#1a5fa8", marginRight: "-8px" }}>V</span>
            <span style={{ color: "#f0c040" }}>A</span>
            <span style={{ color: "#1a5fa8", marginLeft: "-2px" }}>C</span>
          </div>
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
            <div style={{ ...s.statNum, color: "#1a5fa8" }}>{admins.length}</div>
            <div style={s.statLabel}>Admins</div>
          </div>
          <div style={s.statCard}>
            <div style={s.statNum}>{totalClientes}</div>
            <div style={s.statLabel}>Clientes totales</div>
          </div>
          <div style={s.statCard}>
            <div style={{ ...s.statNum, color: "#2e7d32" }}>{totalEquipos}</div>
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
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <div>
                <div style={{ fontSize: "15px", fontWeight: 500, color: "#222" }}>{viendoAdmin.nombre}</div>
                <div style={{ fontSize: "12px", color: "#888" }}>{viendoAdmin.email}</div>
              </div>
              <button style={s.btnCerrar} onClick={() => setViendoAdmin(null)}>✕</button>
            </div>

            {cargandoVista ? (
              <div style={{ textAlign: "center", color: "#888", padding: "20px" }}>Cargando...</div>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "16px" }}>
                  <div style={s.miniStatCard}>
                    <div style={{ fontSize: "22px", fontWeight: 500, color: "#1a5fa8" }}>{clientesAdmin.length}</div>
                    <div style={{ fontSize: "10px", color: "#888", textTransform: "uppercase" }}>Clientes</div>
                  </div>
                  <div style={s.miniStatCard}>
                    <div style={{ fontSize: "22px", fontWeight: 500, color: "#2e7d32" }}>{equiposAdmin.length}</div>
                    <div style={{ fontSize: "10px", color: "#888", textTransform: "uppercase" }}>Equipos</div>
                  </div>
                </div>

                <div style={s.secTitle}>Clientes</div>
                {clientesAdmin.length === 0 ? (
                  <div style={{ fontSize: "12px", color: "#aaa", marginBottom: "12px" }}>Sin clientes registrados</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "16px" }}>
                    {clientesAdmin.map(c => {
                      const equiposCliente = equiposAdmin.filter(e => e.cliente === c.empresa);
                      return (
                        <div key={c.id} style={s.itemRow}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: "13px", fontWeight: 500, color: "#222" }}>{c.empresa}</div>
                            <div style={{ fontSize: "11px", color: "#888" }}>{c.nombre} · {c.email}</div>
                          </div>
                          <span style={{ fontSize: "11px", color: "#888" }}>{equiposCliente.length} equipos</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div style={s.secTitle}>Equipos recientes</div>
                {equiposAdmin.length === 0 ? (
                  <div style={{ fontSize: "12px", color: "#aaa" }}>Sin equipos registrados</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "200px", overflowY: "auto" }}>
                    {equiposAdmin.slice(0, 10).map(e => (
                      <div key={e.id} style={s.itemRow}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: "12px", fontWeight: 500, color: "#222" }}>{e.marca} {e.modelo}</div>
                          <div style={{ fontSize: "11px", color: "#888" }}>{e.cliente} · {e.tipoEquipo || "-"}</div>
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
  page: { minHeight: "100vh", background: "#f0f4f8", fontFamily: "Inter, Arial, sans-serif" },
  navbar: { background: "white", borderBottom: "0.5px solid #e0e0e0", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10 },
  navLeft: { display: "flex", alignItems: "center", gap: "12px" },
  logo: { fontFamily: "'Arial Black', sans-serif", fontWeight: 900, fontSize: "20px", display: "flex", alignItems: "baseline" },
  navDivider: { width: "1px", height: "18px", background: "#e0e0e0" },
  navTitle: { fontSize: "13px", color: "#888" },
  navBtns: { display: "flex", gap: "8px" },
  btnSuccess: { background: "#e8f5e9", color: "#2e7d32", border: "0.5px solid #a5d6a7", borderRadius: "8px", padding: "7px 14px", cursor: "pointer", fontSize: "12px", fontWeight: 500 },
  btnWarning: { background: "#fff8e1", color: "#e65100", border: "0.5px solid #ffe082", borderRadius: "8px", padding: "7px 14px", cursor: "pointer", fontSize: "12px", fontWeight: 500 },
  btnDanger: { background: "#ffebee", color: "#c62828", border: "0.5px solid #ef9a9a", borderRadius: "8px", padding: "7px 14px", cursor: "pointer", fontSize: "12px", fontWeight: 500 },
  content: { maxWidth: "900px", margin: "0 auto", padding: "20px 24px" },
  statsGrid: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "24px" },
  statCard: { background: "white", border: "0.5px solid #e0e0e0", borderRadius: "12px", padding: "20px", textAlign: "center" },
  statNum: { fontSize: "32px", fontWeight: 500, color: "#333" },
  statLabel: { fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: "4px" },
  secTitle: { fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "12px", fontWeight: 500 },
  adminRow: { background: "white", border: "0.5px solid #e0e0e0", borderRadius: "12px", padding: "12px 16px", display: "flex", alignItems: "center", gap: "12px" },
  avatar: { width: "38px", height: "38px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 500, flexShrink: 0 },
  adminInfo: { flex: 1 },
  adminNombre: { fontSize: "14px", fontWeight: 500, color: "#222" },
  adminSub: { fontSize: "11px", color: "#888", marginTop: "2px" },
  badge: { fontSize: "11px", padding: "3px 10px", borderRadius: "20px", background: "#e8f0fe", color: "#1a5fa8" },
  btnIcon: { background: "white", border: "0.5px solid #ddd", borderRadius: "8px", padding: "6px 10px", cursor: "pointer", fontSize: "13px" },
  btnIconDanger: { background: "#ffebee", border: "0.5px solid #ef9a9a", borderRadius: "8px", padding: "6px 10px", cursor: "pointer", fontSize: "13px" },
  empty: { background: "white", border: "0.5px solid #e0e0e0", borderRadius: "12px", padding: "30px", textAlign: "center", color: "#888", fontSize: "14px" },
  modalOverlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 },
  modalCard: { background: "white", borderRadius: "12px", padding: "24px", width: "100%", maxWidth: "520px", boxShadow: "0 8px 32px rgba(0,0,0,0.15)", maxHeight: "80vh", overflowY: "auto" },
  btnCerrar: { background: "none", border: "none", fontSize: "16px", cursor: "pointer", color: "#888", padding: "4px 8px" },
  miniStatCard: { background: "#f8f9fa", border: "0.5px solid #e0e0e0", borderRadius: "8px", padding: "12px", textAlign: "center" },
  itemRow: { background: "#f8f9fa", border: "0.5px solid #e0e0e0", borderRadius: "8px", padding: "8px 12px", display: "flex", alignItems: "center", gap: "10px" },
  badgeOp: { fontSize: "10px", padding: "2px 6px", borderRadius: "20px", background: "#e8f5e9", color: "#2e7d32", whiteSpace: "nowrap" },
  badgeObs: { fontSize: "10px", padding: "2px 6px", borderRadius: "20px", background: "#fff8e1", color: "#e65100", whiteSpace: "nowrap" },
  badgeFs: { fontSize: "10px", padding: "2px 6px", borderRadius: "20px", background: "#ffebee", color: "#c62828", whiteSpace: "nowrap" },
};