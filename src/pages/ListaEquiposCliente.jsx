import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";
import { useNavigate, useParams } from "react-router-dom";
import jsPDF from "jspdf";

const ordenarPisos = (a, b) => {
  const aNum = parseInt(a), bNum = parseInt(b);
  if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
  return a.localeCompare(b);
};

const agruparPorPiso = (equipos) => {
  const p = {};
  equipos.forEach(e => { const k = e.piso||"Sin piso"; if(!p[k]) p[k]=[]; p[k].push(e); });
  return p;
};

const getBadge = (estado) => {
  const map = {"Operativo":{bg:"#e8f5e9",color:"#2e7d32"},"Operativo con observaciones":{bg:"#fff8e1",color:"#e65100"},"Fuera de servicio":{bg:"#ffebee",color:"#c62828"}};
  const st = map[estado]||map["Operativo"];
  return <span style={{fontSize:"11px",padding:"3px 10px",background:st.bg,color:st.color,borderRadius:"20px",fontWeight:500,whiteSpace:"nowrap",display:"inline-block"}}>{estado==="Operativo con observaciones"?"Con obs.":estado||"Operativo"}</span>;
};

const exportarExcel = (cliente, equipos) => {
  const porPiso = agruparPorPiso(equipos);
  const pisos = Object.keys(porPiso).sort(ordenarPisos);
  let item=1, html=`<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"><style>body{font-family:Arial;font-size:9pt;}.titulo{background:#1A73E8;color:white;font-size:14pt;font-weight:bold;}.header{background:#1565C0;color:white;font-weight:bold;font-size:9pt;text-align:center;}.piso{background:#BBDEFB;color:#0D47A1;font-weight:bold;}.fila{font-size:9pt;}.fila-alt{background:#F8F9FA;font-size:9pt;}.op{background:#C8E6C9;color:#1B5E20;font-weight:bold;text-align:center;}.obs{background:#FFF9C4;color:#E65100;font-weight:bold;text-align:center;}.fs{background:#FFCDD2;color:#B71C1C;font-weight:bold;text-align:center;}.cod{background:#F3E5F5;color:#6A1B9A;font-weight:bold;text-align:center;font-family:monospace;}td{border:1px solid #E0E0E0;padding:4px 6px;}</style></head><body><table><tr><td colspan="13" class="titulo">HVAC - Sistema de Mantenimiento</td></tr><tr><td colspan="4">Cliente: ${cliente}</td><td colspan="4">Generado: ${new Date().toLocaleDateString("es-PE")}</td><td colspan="5">Total: ${equipos.length} equipos</td></tr><tr><td colspan="13"></td></tr><tr><td class="header">#</td><td class="header">Codigo</td><td class="header">Piso</td><td class="header">Ambiente</td><td class="header">Tipo</td><td class="header">Marca</td><td class="header">Modelo</td><td class="header">Serie</td><td class="header">Capacidad</td><td class="header">Refrigerante</td><td class="header">Voltaje</td><td class="header">Estado</td><td class="header">Observaciones</td></tr>`;
  pisos.forEach(p=>{
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

export default function ListaEquiposCliente() {
  const { clienteNombre } = useParams();
  const navigate = useNavigate();
  const cliente = decodeURIComponent(clienteNombre);
  const [equipos, setEquipos] = useState([]);
  const [filtroEstado, setFiltroEstado] = useState("Todos");
  const [filtroPiso, setFiltroPiso] = useState("Todos");
  const [obsAbierto, setObsAbierto] = useState(null);

  useEffect(() => {
    const cargar = async () => {
      const snap = await getDocs(collection(db, "equipos"));
      const lista = snap.docs.map(d=>({id:d.id,...d.data()})).filter(e=>(e.cliente||"Sin cliente")===cliente);
      setEquipos(lista);
    };
    cargar();
  }, [cliente]);

  const op = equipos.filter(e=>e.estado==="Operativo").length;
  const obs = equipos.filter(e=>e.estado==="Operativo con observaciones").length;
  const fs = equipos.filter(e=>e.estado==="Fuera de servicio").length;
  const tot = equipos.length;

  const pisos = ["Todos",...new Set(equipos.map(e=>e.piso||"Sin piso").sort(ordenarPisos))];

  const filtrados = equipos.filter(e=>{
    const okE = filtroEstado==="Todos"||e.estado===filtroEstado;
    const okP = filtroPiso==="Todos"||(e.piso||"Sin piso")===filtroPiso;
    return okE&&okP;
  });

  const statsData = [
    {label:"Total equipos",val:tot,color:"#1a5fa8",bg:"white",border:"#e0e0e0",filtro:"Todos"},
    {label:"Operativos",val:op,color:"#2e7d32",bg:"#e8f5e9",border:"#a5d6a7",filtro:"Operativo"},
    {label:"Con obs.",val:obs,color:"#e65100",bg:"#fff8e1",border:"#ffe082",filtro:"Operativo con observaciones"},
    {label:"Fuera serv.",val:fs,color:"#c62828",bg:"#ffebee",border:"#ef9a9a",filtro:"Fuera de servicio"},
  ];

  const getObs = (e) => {
  const arr = e.observacionesArray?.filter(Boolean) || e.observaciones?.split(/\n|;/).map(o=>o.trim()).filter(Boolean) || [];
  return arr.map(o => typeof o === "string" ? { texto: o, fecha: "", tecnico: "" } : o);
};

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
          <button style={s.btnBack} onClick={()=>navigate("/admin")}>← Panel Maestro</button>
          <div style={s.div}></div>
          <span style={{fontSize:"14px",fontWeight:500,color:"#222"}}>{cliente}</span>
        </div>
        <div style={{display:"flex",gap:"8px"}}>
          <button style={s.btnExcel} onClick={()=>exportarExcel(cliente,equipos)}>Excel</button>
          <button style={s.btnPdf}>PDF</button>
        </div>
      </div>

      <div style={s.content}>

        {/* Stats clickeables */}
        <div style={s.statsGrid}>
          {statsData.map(st=>(
            <div key={st.filtro} onClick={()=>{setFiltroEstado(filtroEstado===st.filtro?"Todos":st.filtro);setObsAbierto(null);}}
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
              <span style={{fontSize:"12px",color:"#666",minWidth:"120px",textAlign:"left"}}>{label}</span>
              <div style={{flex:1,height:"8px",background:"#f0f0f0",borderRadius:"4px",overflow:"hidden"}}>
                <div style={{width:`${tot?Math.round(val/tot*100):0}%`,height:"100%",background:bg}}></div>
              </div>
              <span style={{fontSize:"12px",fontWeight:500,color,minWidth:"40px",textAlign:"right"}}>{val} und</span>
            </div>
          ))}
        </div>

        {/* Tabla */}
        <div style={s.tablaCard}>
          <div style={s.tablaHeader}>
            <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
              <span style={{fontSize:"14px",fontWeight:500,color:"#222"}}>Lista de equipos</span>
              <span style={{fontSize:"11px",padding:"2px 8px",background:"#e8f0fe",color:"#1a5fa8",borderRadius:"20px"}}>{filtrados.length} equipo{filtrados.length!==1?"s":""}</span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:"8px",flexWrap:"wrap"}}>
              <span style={{fontSize:"12px",color:"#888"}}>Piso:</span>
              <select style={{fontSize:"12px",padding:"5px 10px",borderRadius:"6px",border:"0.5px solid #ddd"}} value={filtroPiso} onChange={e=>{setFiltroPiso(e.target.value);setObsAbierto(null);}}>
                {pisos.map(p=><option key={p} value={p}>{p==="Todos"?"Todos los pisos":`Piso ${p}`}</option>)}
              </select>
            </div>
          </div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:"13px",tableLayout:"auto"}}>
              <thead>
                <tr style={{background:"#f8f9fa"}}>
                  {["#","Código","Piso","Ambiente","Tipo equipo","Marca / Modelo","Serie","Estado","Acciones"].map(h=>(
                    <th key={h} style={{padding:"10px 14px",textAlign:"left",fontWeight:500,color:"#666",borderBottom:"0.5px solid #e0e0e0",fontSize:"11px",textTransform:"uppercase",whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrados.map((equipo,i)=>{
                  const abierto = obsAbierto===equipo.id;
                  const obsArr = getObs(equipo);
                  return (
                    <React.Fragment key={equipo.id}>
                      <tr style={{borderBottom:abierto?"none":"0.5px solid #f5f5f5"}}>
                        <td style={{padding:"10px 14px",color:"#888",fontSize:"12px"}}>{i+1}</td>
                        <td style={{padding:"10px 14px"}}>{equipo.codigo?<span style={{fontSize:"11px",padding:"2px 7px",background:"#f3e5f5",color:"#6a1b9a",borderRadius:"4px",fontFamily:"monospace",fontWeight:700}}>{equipo.codigo}</span>:"-"}</td>
                        <td style={{padding:"10px 14px",fontSize:"13px",fontWeight:500,whiteSpace:"nowrap",color:"#222",textAlign:"left"}}>{equipo.piso||"-"}</td>
                        <td style={{padding:"10px 14px",fontSize:"13px",fontWeight:500,whiteSpace:"nowrap",color:"#222",textAlign:"left"}}>{equipo.ambiente||"-"}</td>
                        <td style={{padding:"10px 14px",fontSize:"13px",whiteSpace:"nowrap",color:"#555",textAlign:"left"}}>{equipo.tipoEquipo||"-"}</td>
                        <td style={{padding:"10px 14px",fontSize:"13px",whiteSpace:"nowrap",color:"#555",textAlign:"left"}}><div>{equipo.marca||"-"}</div><div style={{fontSize:"11px",color:"#888"}}>{equipo.modelo||""}</div></td>
                        <td style={{padding:"10px 14px",fontSize:"13px",whiteSpace:"nowrap",color:"#555",textAlign:"left"}}>{equipo.serie||"-"}</td>
                        <td style={{padding:"10px 14px",textAlign:"left"}}>{getBadge(equipo.estado)}</td>
                        <td style={{padding:"10px 14px"}}>
                          <div style={{display:"flex",gap:"5px",alignItems:"center"}}>
                            <button style={s.btnInfo} onClick={()=>navigate(`/equipo/${equipo.id}`)}>Info</button>
                            <button style={s.btnEditar} onClick={()=>navigate(`/registrar?id=${equipo.id}`)}>Editar</button>
                            <button onClick={()=>setObsAbierto(abierto?null:equipo.id)}
                              style={{fontSize:"11px",padding:"4px 10px",borderRadius:"5px",cursor:"pointer",fontWeight:500,whiteSpace:"nowrap",border:`0.5px solid ${abierto?"#ffa726":"#ddd"}`,background:abierto?"#fff8e1":"white",color:abierto?"#e65100":"#555"}}>
                              {abierto?"▲ Ocultar":"Observaciones"}
                              {obsArr.length>0&&<span style={{display:"inline-block",minWidth:"16px",height:"16px",background:abierto?"#ffa726":"#e0e0e0",color:abierto?"white":"#666",borderRadius:"50%",fontSize:"10px",lineHeight:"16px",textAlign:"center",marginLeft:"4px"}}>{obsArr.length}</span>}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {abierto&&(
                        <tr style={{borderBottom:"0.5px solid #f5f5f5"}}>
                          <td colSpan={9} style={{padding:"0 14px 12px",background:"#fafafa"}}>
                            <div style={{background:"white",border:"0.5px solid #ffe082",borderRadius:"8px",padding:"12px 14px",marginTop:"4px"}}>
                              <div style={{fontSize:"11px",color:"#e65100",textTransform:"uppercase",letterSpacing:"0.05em",fontWeight:500,marginBottom:"10px"}}>⚠️ Observaciones — {equipo.codigo||equipo.ambiente}</div>
                              {obsArr.length>0?obsArr.map((o,idx)=>(
  <div key={idx} style={{padding:"8px 12px",background:"#fff8e1",borderRadius:"6px",borderLeft:"3px solid #ffa726",marginBottom:"6px"}}>
    <div style={{fontSize:"12px",color:"#333",lineHeight:1.5}}>{o.texto}</div>
    <div style={{fontSize:"10px",color:"#888",marginTop:"3px"}}>
      {o.fecha&&<span>{o.fecha}</span>}
      {o.fecha&&o.tecnico&&<span> · </span>}
      {o.tecnico&&<span>Técnico: {o.tecnico}</span>}
    </div>
  </div>
)):<div style={{fontSize:"12px",color:"#aaa",fontStyle:"italic"}}>Sin observaciones registradas</div>}
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
  btnBack:{background:"none",border:"none",color:"#1a5fa8",cursor:"pointer",fontSize:"13px",fontWeight:500,padding:0},
  btnExcel:{fontSize:"12px",padding:"6px 14px",background:"#1e7e34",color:"white",border:"none",borderRadius:"8px",cursor:"pointer",fontWeight:500},
  btnPdf:{fontSize:"12px",padding:"6px 14px",background:"#c62828",color:"white",border:"none",borderRadius:"8px",cursor:"pointer",fontWeight:500},
  content:{maxWidth:"1200px",margin:"0 auto",padding:"20px 24px"},
  statsGrid:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"12px",marginBottom:"16px"},
  barrasCard:{background:"white",border:"0.5px solid #e0e0e0",borderRadius:"12px",padding:"14px 16px",marginBottom:"16px"},
  tablaCard:{background:"white",border:"0.5px solid #e0e0e0",borderRadius:"12px",overflow:"hidden"},
  tablaHeader:{padding:"12px 16px",borderBottom:"0.5px solid #f0f0f0",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:"10px"},
  btnInfo:{fontSize:"11px",padding:"4px 10px",background:"#1a5fa8",color:"white",border:"none",borderRadius:"5px",cursor:"pointer",fontWeight:500},
  btnEditar:{fontSize:"11px",padding:"4px 10px",background:"#f57c00",color:"white",border:"none",borderRadius:"5px",cursor:"pointer",fontWeight:500},
};