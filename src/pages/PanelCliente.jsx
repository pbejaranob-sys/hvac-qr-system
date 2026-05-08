import React, { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf";

const ordenarPisos = (a, b) => {
  const orden = ["sotano", "sótano", "subsuelo", "ss"];
  const aLow = a.toLowerCase(); const bLow = b.toLowerCase();
  if (orden.includes(aLow)) return -1; if (orden.includes(bLow)) return 1;
  const aNum = parseInt(a); const bNum = parseInt(b);
  if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
  return a.localeCompare(b);
};

const agruparPorPiso = (equipos) => {
  const porPiso = {};
  equipos.forEach(e => { const p = e.piso||"Sin piso"; if(!porPiso[p]) porPiso[p]=[]; porPiso[p].push(e); });
  return porPiso;
};

const getBadge = (estado) => {
  const map = {
    "Operativo": {bg:"#e8f5e9",color:"#2e7d32"},
    "Operativo con observaciones": {bg:"#fff8e1",color:"#e65100"},
    "Fuera de servicio": {bg:"#ffebee",color:"#c62828"},
  };
  const st = map[estado]||map["Operativo"];
  return <span style={{fontSize:"11px",padding:"3px 10px",background:st.bg,color:st.color,borderRadius:"20px",fontWeight:500,whiteSpace:"nowrap",display:"inline-block"}}>
    {estado==="Operativo con observaciones"?"Con obs.":estado||"Operativo"}
  </span>;
};

const exportarExcel = (cliente, equipos) => {
  const porPiso = agruparPorPiso(equipos);
  const pisos = Object.keys(porPiso).sort(ordenarPisos);
  let item=1, html=`<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
  <head><meta charset="UTF-8"><style>
    body{font-family:Arial;font-size:9pt;}.titulo{background:#1A73E8;color:white;font-size:14pt;font-weight:bold;}
    .subtitulo{background:#F0F4F8;color:#555;font-size:9pt;}.header{background:#1565C0;color:white;font-weight:bold;font-size:9pt;text-align:center;}
    .piso{background:#BBDEFB;color:#0D47A1;font-weight:bold;font-size:9pt;}.fila{font-size:9pt;}.fila-alt{background:#F8F9FA;font-size:9pt;}
    .op{background:#C8E6C9;color:#1B5E20;font-weight:bold;text-align:center;}.obs{background:#FFF9C4;color:#E65100;font-weight:bold;text-align:center;}
    .fs{background:#FFCDD2;color:#B71C1C;font-weight:bold;text-align:center;}.cod{background:#F3E5F5;color:#6A1B9A;font-weight:bold;text-align:center;font-family:monospace;}
    td{border:1px solid #E0E0E0;padding:4px 6px;}
  </style></head><body><table>
  <tr><td colspan="13" class="titulo">HVAC - Sistema de Mantenimiento</td></tr>
  <tr><td colspan="3" class="subtitulo">Cliente: ${cliente}</td><td colspan="3" class="subtitulo">Generado: ${new Date().toLocaleDateString("es-PE")}</td><td colspan="3" class="subtitulo">Total: ${equipos.length} equipos</td><td colspan="4" class="subtitulo"></td></tr>
  <tr><td colspan="13"></td></tr>
  <tr><td class="header">#</td><td class="header">Codigo</td><td class="header">Piso</td><td class="header">Ambiente</td><td class="header">Tipo</td><td class="header">Marca</td><td class="header">Modelo</td><td class="header">Serie</td><td class="header">Capacidad</td><td class="header">Refrigerante</td><td class="header">Voltaje</td><td class="header">Estado</td><td class="header">Observaciones</td></tr>`;
  pisos.forEach(p => {
    html+=`<tr><td colspan="13" class="piso">PISO: ${p.toUpperCase()}</td></tr>`;
    porPiso[p].forEach((e,idx)=>{
      const ec=e.estado==="Operativo"?"op":e.estado==="Operativo con observaciones"?"obs":"fs";
      html+=`<tr class="${idx%2===0?"fila":"fila-alt"}"><td>${item++}</td><td class="cod">${e.codigo||"-"}</td><td>${e.piso||"-"}</td><td>${e.ambiente||"-"}</td><td>${e.tipoEquipo||"-"}</td><td>${e.marca||"-"}</td><td>${e.modelo||"-"}</td><td>${e.serie||"-"}</td><td>${e.capacidad||"-"}</td><td>${e.tipoRefrigerante||"-"}</td><td>${e.voltaje?e.voltaje+"V":"-"}</td><td class="${ec}">${e.estado||"Operativo"}</td><td>${e.observaciones||"-"}</td></tr>`;
    });
  });
  html+=`</table></body></html>`;
  const blob=new Blob([html],{type:"application/vnd.ms-excel;charset=utf-8;"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a"); a.href=url;
  a.download=`equipos-${cliente.replace(/\s+/g,"-")}-${new Date().getFullYear()}.xls`;
  a.click(); URL.revokeObjectURL(url);
};

const exportarPDF = (cliente, equipos) => {
  const pdf=new jsPDF("l","mm","a4"); const M=10; let y=15;
  pdf.setFillColor(26,115,232); pdf.rect(0,0,297,20,"F");
  pdf.setFontSize(13); pdf.setFont("helvetica","bold"); pdf.setTextColor(255,255,255);
  pdf.text("HVAC - Sistema de Mantenimiento",M,13);
  pdf.setFontSize(10); pdf.setFont("helvetica","normal");
  pdf.text(`Cliente: ${cliente}   Generado: ${new Date().toLocaleDateString("es-PE")}   Total: ${equipos.length} equipos`,M,19);
  y=28;
  const cols=[8,14,14,20,16,14,16,16,13,11,11,22,42];
  const headers=["#","Codigo","Piso","Ambiente","Tipo","Marca","Modelo","Serie","Cap.","Refrig.","Volt.","Estado","Obs."];
  const drawH=()=>{
    pdf.setFillColor(21,101,192); pdf.rect(M,y-4,277,8,"F");
    pdf.setFontSize(7.5); pdf.setFont("helvetica","bold"); pdf.setTextColor(255,255,255);
    let x=M; headers.forEach((h,i)=>{pdf.text(h,x+1,y+1);x+=cols[i];}); y+=7;
  };
  drawH();
  const porPiso=agruparPorPiso(equipos); let item=1;
  Object.keys(porPiso).sort(ordenarPisos).forEach(p=>{
    if(y>185){pdf.addPage();y=15;drawH();}
    pdf.setFillColor(187,222,251); pdf.rect(M,y-3,277,7,"F");
    pdf.setFontSize(8); pdf.setFont("helvetica","bold"); pdf.setTextColor(13,71,161);
    pdf.text(`PISO: ${p.toUpperCase()}`,M+2,y+2); y+=7;
    porPiso[p].forEach((e,idx)=>{
      if(y>185){pdf.addPage();y=15;drawH();}
      if(idx%2===0){pdf.setFillColor(248,249,250);pdf.rect(M,y-3,277,7,"F");}
      const fila=[String(item++),e.codigo||"-",e.piso||"-",e.ambiente||"-",e.tipoEquipo||"-",e.marca||"-",e.modelo||"-",e.serie||"-",e.capacidad||"-",e.tipoRefrigerante||"-",e.voltaje?`${e.voltaje}V`:"-",e.estado||"Operativo",e.observaciones||"-"];
      pdf.setFont("helvetica","normal"); pdf.setFontSize(7); let x=M;
      fila.forEach((val,i)=>{
        if(i===11){if(val==="Operativo")pdf.setTextColor(27,94,32);else if(val==="Operativo con observaciones")pdf.setTextColor(230,81,0);else pdf.setTextColor(183,28,28);}
        else if(i===1)pdf.setTextColor(106,27,154); else pdf.setTextColor(50,50,50);
        pdf.text(pdf.splitTextToSize(val,cols[i]-2)[0],x+1,y+2); x+=cols[i];
      });
      pdf.setDrawColor(220,220,220); pdf.line(M,y+4,M+277,y+4); y+=7;
    });
  });
  pdf.setFontSize(8); pdf.setTextColor(150,150,150);
  pdf.text(`HVAC Sistema de Mantenimiento`,M,205);
  pdf.save(`equipos-${cliente.replace(/\s+/g,"-")}-${new Date().getFullYear()}.pdf`);
};

export default function PanelCliente() {
  const [equipos, setEquipos] = useState([]);
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState("Todos");
  const [filtroPiso, setFiltroPiso] = useState("Todos");
  const [obsAbierto, setObsAbierto] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { navigate("/"); return; }
      const q = query(collection(db, "usuarios"), where("email", "==", user.email));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const data = snap.docs[0].data();
        setUsuario(data);
        const eq = query(collection(db, "equipos"), where("cliente", "==", data.empresa));
        const eSnap = await getDocs(eq);
        setEquipos(eSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
      setCargando(false);
    });
    return () => unsub();
  }, []);

  const handleLogout = async () => { await signOut(auth); navigate("/"); };

  const op = equipos.filter(e => e.estado === "Operativo").length;
  const obs = equipos.filter(e => e.estado === "Operativo con observaciones").length;
  const fs = equipos.filter(e => e.estado === "Fuera de servicio").length;
  const tot = equipos.length;
  const pOp = tot ? Math.round(op/tot*100) : 0;
  const pObs = tot ? Math.round(obs/tot*100) : 0;
  const pFs = tot ? Math.round(fs/tot*100) : 0;

  const pisos = ["Todos", ...new Set(equipos.map(e => e.piso || "Sin piso").sort(ordenarPisos))];

  const equiposFiltrados = equipos.filter(e => {
    const okE = filtroEstado === "Todos" || e.estado === filtroEstado;
    const okP = filtroPiso === "Todos" || (e.piso || "Sin piso") === filtroPiso;
    return okE && okP;
  });

  const statsData = [
    {label:"Total equipos",val:tot,color:"#1a5fa8",bg:"white",border:"#e0e0e0",filtro:"Todos"},
    {label:"Operativos",val:op,color:"#2e7d32",bg:"#e8f5e9",border:"#a5d6a7",filtro:"Operativo"},
    {label:"Con obs.",val:obs,color:"#e65100",bg:"#fff8e1",border:"#ffe082",filtro:"Operativo con observaciones"},
    {label:"Fuera serv.",val:fs,color:"#c62828",bg:"#ffebee",border:"#ef9a9a",filtro:"Fuera de servicio"},
  ];

  const getObs = (e) => e.observacionesArray?.filter(Boolean) || e.observaciones?.split(/\n|;/).map(o=>o.trim()).filter(Boolean) || [];

  if (cargando) return <div style={s.centro}>Cargando...</div>;

  return (
    <div style={s.page}>
      <div style={s.navbar}>
        <div style={s.navLeft}>
          <div style={s.logo}>
            <span style={{color:"#1a5fa8"}}>H</span>
            <span style={{color:"#1a5fa8",marginRight:"-6px"}}>V</span>
            <span style={{color:"#f0c040",marginLeft:"2px"}}>A</span>
            <span style={{color:"#1a5fa8",marginLeft:"2px"}}>C</span>
          </div>
          <div style={s.div}></div>
          <span style={s.navEmpresa}>{usuario?.empresa}</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
          <div style={s.avatar}>{usuario?.nombre?.substring(0,2).toUpperCase()||"U"}</div>
          <span style={{fontSize:"13px",color:"#555",textAlign:"left"}}>{usuario?.nombre}</span>
          <button style={s.btnSalir} onClick={handleLogout}>Salir</button>
        </div>
      </div>

      <div style={s.content}>

        {/* Stats */}
        <div style={s.statsGrid}>
          {statsData.map(st => (
            <div key={st.filtro} onClick={() => { setFiltroEstado(filtroEstado===st.filtro?"Todos":st.filtro); setObsAbierto(null); }}
              style={{background:st.bg,border:filtroEstado===st.filtro?`2px solid ${st.color}`:`0.5px solid ${st.border}`,borderRadius:"12px",padding:"14px",textAlign:"center",cursor:"pointer",transform:filtroEstado===st.filtro?"scale(1.02)":"scale(1)",transition:"all 0.15s",boxShadow:filtroEstado===st.filtro?"0 2px 8px rgba(0,0,0,0.1)":"none"}}>
              <div style={{fontSize:"28px",fontWeight:500,color:st.color,lineHeight:1.2}}>{st.val}</div>
              <div style={{fontSize:"11px",color:st.color,textTransform:"uppercase",letterSpacing:"0.05em",marginTop:"4px",fontWeight:500}}>{st.label}</div>
            </div>
          ))}
        </div>

        {/* Barras */}
        <div style={s.barrasCard}>
          {[["Operativo",op,"#43a047","#2e7d32"],["Con observaciones",obs,"#ffa726","#e65100"],["Fuera de servicio",fs,"#ef5350","#c62828"]].map(([label,val,bg,color])=>(
            <div key={label} style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"8px"}}>
              <span style={{fontSize:"12px",fontWeight:700,color:"#444",minWidth:"120px",textAlign:"left"}}>{label}</span>
              <div style={{flex:1,height:"8px",background:"#f0f0f0",borderRadius:"4px",overflow:"hidden"}}>
                <div style={{width:`${tot?Math.round(val/tot*100):0}%`,height:"100%",background:bg}}></div>
              </div>
              <span style={{fontSize:"12px",fontWeight:500,color,minWidth:"40px",textAlign:"right"}}>{val} und</span>
            </div>
          ))}
        </div>

        {/* Tabla */}
        {tot === 0 ? (
          <div style={s.vacio}>No hay equipos registrados aún.</div>
        ) : (
          <div style={s.tablaCard}>
            <div style={s.tablaHeader}>
              <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
                <span style={{fontSize:"14px",fontWeight:500,color:"#222"}}>Lista de equipos</span>
                <span style={{fontSize:"11px",padding:"2px 8px",background:"#e8f0fe",color:"#1a5fa8",borderRadius:"20px"}}>{equiposFiltrados.length} equipo{equiposFiltrados.length!==1?"s":""}</span>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:"8px",flexWrap:"wrap"}}>
                <span style={{fontSize:"12px",color:"#888"}}>Piso:</span>
                <select style={{fontSize:"12px",padding:"5px 10px",borderRadius:"6px",border:"0.5px solid #ddd"}} value={filtroPiso} onChange={e=>{setFiltroPiso(e.target.value);setObsAbierto(null);}}>
                  {pisos.map(p=><option key={p} value={p}>{p==="Todos"?"Todos los pisos":`Piso ${p}`}</option>)}
                </select>
                <button style={s.btnExcel} onClick={()=>exportarExcel(usuario?.empresa,equipos)}>Excel</button>
                <button style={s.btnPdf} onClick={()=>exportarPDF(usuario?.empresa,equipos)}>PDF</button>
              </div>
            </div>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:"13px"}}>
                <thead>
                  <tr style={{background:"#f8f9fa"}}>
                    {["#","Código","Piso","Ambiente","Tipo equipo","Marca / Modelo","Serie","Estado","Acciones"].map(h=>(
                      <th key={h} style={{padding:"10px 14px",textAlign:"left",fontWeight:700,color:"#444",borderBottom:"0.5px solid #e0e0e0",fontSize:"11px",textTransform:"uppercase",whiteSpace:"nowrap"}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {equiposFiltrados.map((equipo, i) => {
                    const abierto = obsAbierto === equipo.id;
                    const obsArr = getObs(equipo);
                    return (
                      <React.Fragment key={equipo.id}>
                        <tr style={{borderBottom:abierto?"none":"0.5px solid #f5f5f5"}}>
                          <td style={{padding:"10px 14px",color:"#888",fontSize:"12px"}}>{i+1}</td>
                          <td style={{padding:"10px 14px"}}>
                            {equipo.codigo ? <span style={{fontSize:"11px",padding:"2px 7px",background:"#f3e5f5",color:"#6a1b9a",borderRadius:"4px",fontFamily:"monospace",fontWeight:700}}>{equipo.codigo}</span> : "-"}
                          </td>
                          <td style={{padding:"10px 14px",fontSize:"13px",fontWeight:500,color:"#222",textAlign:"left"}}>{equipo.piso||"-"}</td>
                          <td style={{padding:"10px 14px",fontSize:"13px",fontWeight:500,color:"#222",textAlign:"left"}}>{equipo.ambiente||"-"}</td>
                          <td style={{padding:"10px 14px",fontSize:"13px",color:"#555",textAlign:"left"}}>{equipo.tipoEquipo||"-"}</td>
                          <td style={{padding:"10px 14px",fontSize:"13px",color:"#555",textAlign:"left"}}>{equipo.marca||"-"}{equipo.modelo?` / ${equipo.modelo}`:""}</td>
                          <td style={{padding:"10px 14px",fontSize:"13px",color:"#555",textAlign:"left"}}>{equipo.serie||"-"}</td>
                          <td style={{padding:"10px 14px",textAlign:"left"}}>{getBadge(equipo.estado)}</td>
                          <td style={{padding:"10px 14px"}}>
                            <div style={{display:"flex",gap:"5px",alignItems:"center"}}>
                              <button style={s.btnInfo} onClick={()=>navigate(`/equipo/${equipo.id}`)}>Info</button>
                              <button onClick={()=>setObsAbierto(abierto?null:equipo.id)}
                                style={{fontSize:"11px",padding:"4px 10px",borderRadius:"5px",cursor:"pointer",fontWeight:500,whiteSpace:"nowrap",border:`0.5px solid ${abierto?"#ffa726":"#ddd"}`,background:abierto?"#fff8e1":"white",color:abierto?"#e65100":"#555"}}>
                                {abierto?"▲ Ocultar":"Observaciones"}
                                {obsArr.length>0&&<span style={{display:"inline-block",minWidth:"16px",height:"16px",background:abierto?"#ffa726":"#e0e0e0",color:abierto?"white":"#666",borderRadius:"50%",fontSize:"10px",lineHeight:"16px",textAlign:"center",marginLeft:"4px"}}>{obsArr.length}</span>}
                              </button>
                            </div>
                          </td>
                        </tr>
                        {abierto && (
                          <tr style={{borderBottom:"0.5px solid #f5f5f5"}}>
                            <td colSpan={9} style={{padding:"0 14px 12px",background:"#fafafa"}}>
                              <div style={{background:"white",border:"0.5px solid #ffe082",borderRadius:"8px",padding:"12px 14px",marginTop:"4px"}}>
                                <div style={{fontSize:"11px",color:"#e65100",textTransform:"uppercase",letterSpacing:"0.05em",fontWeight:500,marginBottom:"10px"}}>
                                  ⚠️ Observaciones — {equipo.codigo||equipo.ambiente}
                                </div>
                                {obsArr.length>0 ? obsArr.map((o,idx)=>(
                                  <div key={idx} style={{padding:"8px 12px",background:"#fff8e1",borderRadius:"6px",borderLeft:"3px solid #ffa726",fontSize:"12px",color:"#e65100",marginBottom:"6px"}}>{o}</div>
                                )) : (
                                  <div style={{fontSize:"12px",color:"#aaa",fontStyle:"italic"}}>Sin observaciones registradas</div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const s = {
  page:{minHeight:"100vh",background:"#f0f4f8",fontFamily:"Inter, Arial, sans-serif"},
  navbar:{background:"white",borderBottom:"0.5px solid #e0e0e0",padding:"12px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:10},
  navLeft:{display:"flex",alignItems:"center",gap:"12px"},
  logo:{fontFamily:"'Arial Black', sans-serif",fontWeight:900,fontSize:"20px",display:"flex",alignItems:"baseline",letterSpacing:"1px"},
  div:{width:"1px",height:"18px",background:"#e0e0e0"},
  navEmpresa:{fontSize:"14px",fontWeight:500,color:"#222"},
  avatar:{width:"30px",height:"30px",borderRadius:"50%",background:"#e8f0fe",color:"#1a5fa8",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"11px",fontWeight:500},
  btnSalir:{background:"#c62828",color:"white",border:"none",borderRadius:"8px",padding:"6px 14px",cursor:"pointer",fontSize:"12px",fontWeight:500},
  content:{maxWidth:"1200px",margin:"0 auto",padding:"20px 24px"},
  statsGrid:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"12px",marginBottom:"16px"},
  barrasCard:{background:"white",border:"0.5px solid #e0e0e0",borderRadius:"12px",padding:"14px 16px",marginBottom:"16px"},
  tablaCard:{background:"white",border:"0.5px solid #e0e0e0",borderRadius:"12px",overflow:"hidden"},
  tablaHeader:{padding:"12px 16px",borderBottom:"0.5px solid #f0f0f0",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:"10px"},
  btnExcel:{fontSize:"12px",padding:"5px 12px",background:"#1e7e34",color:"white",border:"none",borderRadius:"6px",cursor:"pointer",fontWeight:500},
  btnPdf:{fontSize:"12px",padding:"5px 12px",background:"#c62828",color:"white",border:"none",borderRadius:"6px",cursor:"pointer",fontWeight:500},
  btnInfo:{fontSize:"11px",padding:"4px 10px",background:"#1a5fa8",color:"white",border:"none",borderRadius:"5px",cursor:"pointer",fontWeight:500},
  vacio:{textAlign:"center",padding:"3rem",background:"white",borderRadius:"12px",color:"#888",border:"0.5px solid #e0e0e0"},
  centro:{textAlign:"center",padding:"3rem",fontSize:"16px",color:"#888"},
};