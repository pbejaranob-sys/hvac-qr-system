import { useEffect, useState } from "react";
import { db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import { useParams, useNavigate } from "react-router-dom";
import jsPDF from "jspdf";

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
  const [tamanoQR, setTamanoQR] = useState("2x2");
  const [escala, setEscala] = useState(3);
  const [imprimiendo, setImprimiendo] = useState(false);

  useEffect(() => { cargarEquipo(); }, []);

  const cargarEquipo = async () => {
    try {
      const snap = await getDoc(doc(db, "equipos", id));
      if (snap.exists()) setEquipo({ id: snap.id, ...snap.data() });
    } catch (e) { console.error(e); }
    setCargando(false);
  };

  const getQRpx = () => {
    if (tamanoQR === "2x2") return 76;
    if (tamanoQR === "3x3") return 113;
    if (tamanoQR === "5x5") return 189;
    return escala * 37.8;
  };

  const getObs = () => equipo.observacionesArray?.filter(Boolean) || equipo.observaciones?.split(/\n|;/).map(o=>o.trim()).filter(Boolean) || [];
  const getRec = () => equipo.recomendacionesArray?.filter(Boolean) || equipo.recomendaciones?.split(/\n|;/).map(r=>r.trim()).filter(Boolean) || [];
  const getCor = () => {
    if (equipo.correctivosArray?.length > 0) return equipo.correctivosArray.filter(c => c.descripcion);
    if (equipo.correctivos) return equipo.correctivos.split(/\n|;/).map(c=>({descripcion:c.trim(),fecha:""})).filter(c=>c.descripcion);
    return [];
  };
  const getCron = () => equipo.cronograma?.length > 0 ? equipo.cronograma : [
    {label:"1er Trimestre",fecha:"",estado:"programado"},
    {label:"2do Trimestre",fecha:"",estado:"programado"},
    {label:"3er Trimestre",fecha:"",estado:"programado"},
    {label:"4to Trimestre",fecha:"",estado:"programado"},
  ];

  const cronColor = (estado) => ({
    realizado: {bg:"#e8f5e9",border:"#a5d6a7",color:"#2e7d32",icon:"✅"},
    pendiente:  {bg:"#fff8e1",border:"#ffe082",color:"#e65100",icon:"⏳"},
    programado: {bg:"#f5f5f5",border:"#e0e0e0",color:"#888",icon:"📆"},
  }[estado] || {bg:"#f5f5f5",border:"#e0e0e0",color:"#888",icon:"📆"});

  const imprimirQR = () => {
    const url = window.location.href;
    const px = Math.round(getQRpx());
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${px*2}x${px*2}&data=${encodeURIComponent(url)}`;
    const win = window.open("","_blank");
    win.document.write(`<html><head><title>QR ${equipo.codigo||""}</title>
    <style>body{margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:Arial;background:white;}
    .info{text-align:center;margin-top:10px;font-size:12px;color:#555;}</style></head><body>
    <img src="${qrUrl}" width="${px}" height="${px}"/>
    <div class="info"><b>${equipo.codigo||""}</b><br/>${equipo.cliente||""} · Piso ${equipo.piso||""} · ${equipo.ambiente||""}</div>
    <script>window.onload=()=>window.print();</script></body></html>`);
    win.document.close();
  };

  const generarPDF = async () => {
    setImprimiendo(true);
    try {
      const pdf = new jsPDF("p","mm","a4");
      const W=210, M=14, C=W-M*2;
      let y=0;
      const check = (h=10) => { if(y+h>280){pdf.addPage();y=14;} };

      // Header
      pdf.setFillColor(26,95,168); pdf.rect(0,0,W,22,"F");
      pdf.setFont("helvetica","bold"); pdf.setFontSize(14); pdf.setTextColor(255,255,255);
      pdf.text("HVAC",M,14);
      pdf.setFont("helvetica","normal"); pdf.setFontSize(9); pdf.setTextColor(200,220,255);
      pdf.text("SISTEMA DE MANTENIMIENTO",M+22,14);
      const ec = equipo.estado==="Operativo"?[46,125,50]:equipo.estado==="Operativo con observaciones"?[230,81,0]:[198,40,40];
      pdf.setFillColor(255,248,225); pdf.roundedRect(W-M-52,7,52,8,2,2,"F");
      pdf.setFontSize(7.5); pdf.setTextColor(...ec);
      pdf.text(equipo.estado==="Operativo con observaciones"?"Con observaciones":(equipo.estado||"Operativo"),W-M-26,12.5,{align:"center"});
      y=30;

      // Info equipo
      pdf.setFillColor(248,249,250); pdf.rect(M,y,C,14,"F");
      pdf.setFont("helvetica","bold"); pdf.setFontSize(11); pdf.setTextColor(26,95,168);
      pdf.text(`${equipo.marca||"-"} / ${equipo.modelo||"-"} — ${equipo.tipoEquipo||"-"}`,M+3,y+6);
      pdf.setFont("helvetica","normal"); pdf.setFontSize(8.5); pdf.setTextColor(100,100,100);
      pdf.text(`Cliente: ${equipo.cliente||"-"}   Piso: ${equipo.piso||"-"}   Ambiente: ${equipo.ambiente||"-"}   Cod: ${equipo.codigo||"-"}`,M+3,y+11.5);
      pdf.setFontSize(7.5); pdf.setTextColor(150,150,150);
      pdf.text(`Generado: ${new Date().toLocaleDateString("es-PE")}`,W-M-2,y+6,{align:"right"});
      y+=18;

      const secTit = (txt,r,g,b) => {
        check(8); pdf.setFillColor(r,g,b); pdf.rect(M,y,3,5,"F");
        pdf.setFont("helvetica","bold"); pdf.setFontSize(8.5); pdf.setTextColor(r,g,b);
        pdf.text(txt.toUpperCase(),M+5,y+4); y+=8;
      };

      const gridCards = (items,cols,br,bg,bb) => {
        const cW=(C-(cols-1)*3)/cols, cH=12;
        const rows=Math.ceil(items.length/cols);
        check(rows*(cH+2)+2);
        items.forEach((item,i)=>{
          const col=i%cols, row=Math.floor(i/cols);
          const x=M+col*(cW+3), cy=y+row*(cH+2);
          pdf.setFillColor(br,bg,bb); pdf.rect(x,cy,cW,cH,"F");
          pdf.setFont("helvetica","normal"); pdf.setFontSize(7); pdf.setTextColor(150,150,150);
          pdf.text(item[0],x+3,cy+4);
          pdf.setFont("helvetica","bold"); pdf.setFontSize(8.5); pdf.setTextColor(30,30,30);
          pdf.text(String(item[1]||"-"),x+3,cy+9);
        });
        y+=rows*(cH+2)+2;
      };

      const listaItems = (lista,br,bg,bb,borR,borG,borB,tR,tG,tB,conFecha=false) => {
        lista.forEach(item=>{
          const txt = typeof item==="object"?(item.descripcion||""):item;
          const fecha = typeof item==="object"?(item.fecha||""):"";
          const lines=pdf.splitTextToSize(String(txt),C-14);
          const h=lines.length*4.5+5;
          check(h);
          pdf.setFillColor(br,bg,bb); pdf.rect(M,y,C,h,"F");
          pdf.setFillColor(borR,borG,borB); pdf.rect(M,y,2.5,h,"F");
          pdf.setFont("helvetica","normal"); pdf.setFontSize(8.5); pdf.setTextColor(tR,tG,tB);
          pdf.text(lines,M+5,y+4);
          if(conFecha&&fecha){
            pdf.setFontSize(7.5); pdf.setTextColor(150,150,150);
            pdf.text(fecha,W-M-2,y+4,{align:"right"});
          }
          y+=h+2;
        });
      };

      // Ficha técnica
      secTit("Ficha técnica",26,95,168);
      gridCards([
        ["Tipo equipo",equipo.tipoEquipo],["Marca",equipo.marca],["Modelo",equipo.modelo],["N° Serie",equipo.serie],
        ["Capacidad",equipo.capacidad?equipo.capacidad+" BTU":null],["Refrigerante",equipo.tipoRefrigerante],["Ambiente",equipo.ambiente],["Piso",equipo.piso],
      ],4,248,249,250);

      // Datos eléctricos
      secTit("Datos eléctricos",230,81,0);
      gridCards([
        ["Voltaje",equipo.voltaje?equipo.voltaje+"V":null],["Amperaje",equipo.amperaje?equipo.amperaje+"A":null],["Fases",equipo.fases],
      ],3,255,248,240);

      // Observaciones
      const obs = getObs();
      if(obs.length>0){ secTit("Observaciones",230,81,0); listaItems(obs,255,248,225,255,167,38,230,81,0); }

      // Recomendaciones
      const rec = getRec();
      if(rec.length>0){ secTit("Recomendaciones",46,125,50); listaItems(rec,232,245,233,67,160,71,46,125,50); }

      // Correctivos
      const cor = getCor();
      if(cor.length>0){ secTit("Correctivos realizados",26,95,168); listaItems(cor,240,244,248,26,95,168,30,30,30,true); }

      // Cronograma
      secTit("Cronograma de mantenimiento",26,95,168);
      const cron = getCron();
      const tW=(C-9)/4, tH=14;
      check(tH+2);
      cron.forEach((t,i)=>{
        const x=M+i*(tW+3);
        const col={realizado:{bg:[232,245,233],text:[46,125,50],icon:"✓"},pendiente:{bg:[255,248,225],text:[230,81,0],icon:"~"},programado:{bg:[245,245,245],text:[130,130,130],icon:"o"}}[t.estado]||{bg:[245,245,245],text:[130,130,130],icon:"o"};
        pdf.setFillColor(...col.bg); pdf.rect(x,y,tW,tH,"F");
        pdf.setFont("helvetica","bold"); pdf.setFontSize(7); pdf.setTextColor(...col.text);
        pdf.text(t.label,x+tW/2,y+4,{align:"center"});
        pdf.setFont("helvetica","normal"); pdf.setFontSize(7);
        pdf.text(t.fecha||"-",x+tW/2,y+8.5,{align:"center"});
        pdf.text(`${col.icon} ${t.estado}`,x+tW/2,y+13,{align:"center"});
      });
      y+=tH+6;

      // QR
      check(25);
      const urlE=`${window.location.origin}/equipo/${id}`;
      const px=Math.round(getQRpx());
      const qrSrc=`https://api.qrserver.com/v1/create-qr-code/?size=${px*2}x${px*2}&data=${encodeURIComponent(urlE)}`;
      const qrImg = await new Promise(res=>{
        const img=new Image(); img.crossOrigin="anonymous";
        img.onload=()=>{const c=document.createElement("canvas");c.width=img.width;c.height=img.height;c.getContext("2d").drawImage(img,0,0);res(c.toDataURL("image/png"));};
        img.onerror=()=>res(null); img.src=qrSrc;
      });
      if(qrImg) pdf.addImage(qrImg,"PNG",M,y,22,22);
      pdf.setFont("helvetica","normal"); pdf.setFontSize(7.5); pdf.setTextColor(150,150,150);
      pdf.text("HVAC Sistema de Mantenimiento",W-M,y+5,{align:"right"});
      pdf.text("hvac-qr-system-1odv.vercel.app",W-M,y+10,{align:"right"});
      pdf.text(`Generado: ${new Date().toLocaleDateString("es-PE")}`,W-M,y+15,{align:"right"});
      pdf.setDrawColor(220,220,220); pdf.line(M,287,W-M,287);
      pdf.setFontSize(7); pdf.setTextColor(180,180,180);
      pdf.text(`Reporte · ${equipo.cliente||""} · ${equipo.codigo||id.slice(0,6).toUpperCase()}`,M,291);

      pdf.save(`reporte-${equipo.codigo||id.slice(0,6)}.pdf`);
    } catch(e){ console.error(e); alert("Error PDF: "+e.message); }
    setImprimiendo(false);
  };

  if(cargando) return <div style={s.centro}>Cargando...</div>;
  if(!equipo) return <div style={s.centro}>Equipo no encontrado</div>;

  const px = Math.round(getQRpx());
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${px*2}x${px*2}&data=${encodeURIComponent(window.location.href)}`;
  const obs = getObs(), rec = getRec(), cor = getCor(), cron = getCron();

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
          <button style={s.btnBack} onClick={()=>navigate(-1)}>← Volver</button>
        </div>
        <span style={{...s.badge,...getBadgeStyle(equipo.estado)}}>{equipo.estado||"Operativo"}</span>
      </div>

      <div style={s.content}>
        <div style={s.layout}>

          {/* SIDEBAR */}
          <div style={s.sidebar}>
            <div style={s.sCard}>
              <div style={s.iconWrap}>❄️</div>
              <div style={s.sNombre}>{equipo.marca||"-"} / {equipo.modelo||"-"}</div>
              <span style={s.sTipo}>{equipo.tipoEquipo||"-"}</span>
            </div>
            <div style={s.sCard}>
              <div style={s.sLbl}>Ubicación</div>
              <div style={s.sVal}>🏢 {equipo.cliente||"-"}</div>
              <div style={{...s.sVal,color:"#888",marginTop:"4px"}}>📍 Piso {equipo.piso||"-"} · {equipo.ambiente||"-"}</div>
            </div>
            <div style={s.sCard}>
              <div style={s.sLbl}>Código</div>
              <span style={s.codTag}>{equipo.codigo||"-"}</span>
            </div>
            <div style={s.sCard}>
              <div style={s.sLbl}>Último mantenimiento</div>
              <div style={s.sVal}>📅 {equipo.ultimoMantenimiento||"Sin registro"}</div>
            </div>
            <button style={s.btnQR} onClick={imprimirQR}>🖨️ Imprimir QR</button>
            <button style={{...s.btnQR,background:"#c62828",color:"white",border:"none"}} onClick={generarPDF} disabled={imprimiendo}>
              {imprimiendo?"Generando...":"📄 Descargar PDF"}
            </button>
          </div>

          {/* MAIN */}
          <div style={s.main}>

            <div style={s.sec}>
              <div style={s.secT}>📋 Ficha técnica</div>
              <div style={s.g4}>
                {[["Tipo equipo",equipo.tipoEquipo],["Marca",equipo.marca],["Modelo",equipo.modelo],["N° Serie",equipo.serie],
                  ["Capacidad",equipo.capacidad?equipo.capacidad+" BTU":null],["Refrigerante",equipo.tipoRefrigerante],["Ambiente",equipo.ambiente],["Piso",equipo.piso]
                ].map(([l,v])=>(
                  <div key={l}><div style={s.fl}>{l}</div><div style={s.fv}>{v||"-"}</div></div>
                ))}
              </div>
            </div>

            <div style={s.sec}>
              <div style={s.secT}>⚡ Datos eléctricos</div>
              <div style={s.g3}>
                {[["Voltaje",equipo.voltaje?equipo.voltaje+"V":null],["Amperaje",equipo.amperaje?equipo.amperaje+"A":null],["Fases",equipo.fases]
                ].map(([l,v])=>(
                  <div key={l}><div style={s.fl}>{l}</div><div style={s.fv}>{v||"-"}</div></div>
                ))}
              </div>
            </div>

            <div style={s.sec}>
              <div style={s.secT}>⚠️ Observaciones</div>
              <div style={s.scroll}>
                {obs.length>0 ? obs.map((o,i)=><div key={i} style={s.iObs}>{o}</div>)
                  : <div style={s.iObs}>Sin observaciones registradas</div>}
              </div>
            </div>

            <div style={s.sec}>
              <div style={s.secT}>💡 Recomendaciones</div>
              <div style={{...s.scroll,scrollbarColor:"#43a047 #e8f5e9"}}>
                {rec.length>0 ? rec.map((r,i)=><div key={i} style={s.iRec}>{r}</div>)
                  : <div style={s.iRec}>Sin recomendaciones registradas</div>}
              </div>
            </div>

            <div style={s.sec}>
              <div style={s.secT}>🔧 Correctivos realizados</div>
              <div style={{...s.scroll,scrollbarColor:"#1a5fa8 #e8f0fe"}}>
                {cor.length>0 ? cor.map((c,i)=>(
                  <div key={i} style={s.iCor}>
                    <div style={{fontSize:"12px",fontWeight:500,color:"#222",marginBottom:"2px"}}>{typeof c==="object"?c.descripcion:c}</div>
                    {typeof c==="object"&&c.fecha&&<div style={{fontSize:"11px",color:"#888"}}>📅 {c.fecha}</div>}
                  </div>
                )) : <div style={s.iCor}><span style={{fontSize:"12px",color:"#888"}}>Sin correctivos registrados</span></div>}
              </div>
            </div>

            <div style={s.sec}>
              <div style={s.secT}>📅 Cronograma de mantenimiento</div>
              <div style={s.cronG}>
                {cron.map(({label,fecha,estado},i)=>{
                  const col = cronColor(estado);
                  return (
                    <div key={i} style={{textAlign:"center",padding:"10px 8px",borderRadius:"8px",background:col.bg,border:`0.5px solid ${col.border}`}}>
                      <div style={{fontSize:"10px",color:col.color,fontWeight:500,marginBottom:"4px"}}>{label}</div>
                      <div style={{fontSize:"11px",color:col.color,marginBottom:"4px"}}>{fecha||"Sin fecha"}</div>
                      <div style={{fontSize:"10px",color:col.color}}>{col.icon} {estado.charAt(0).toUpperCase()+estado.slice(1)}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {equipo.fotos&&equipo.fotos.length>0&&(
              <div style={s.sec}>
                <div style={s.secT}>📸 Galería</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"8px"}}>
                  {equipo.fotos.map((url,i)=>(
                    <img key={i} src={url} alt={`foto ${i+1}`}
                      style={{width:"100%",height:"100px",objectFit:"cover",borderRadius:"8px",cursor:"pointer",border:"0.5px solid #e0e0e0"}}
                      onClick={()=>window.open(url,"_blank")} />
                  ))}
                </div>
              </div>
            )}

            <div style={s.sec}>
              <div style={s.secT}>📱 Código QR</div>
              <div style={{display:"flex",gap:"20px",alignItems:"flex-start",flexWrap:"wrap"}}>
                <div style={{textAlign:"center"}}>
                  <img src={qrUrl} alt="QR" style={{width:px,height:px,border:"0.5px solid #e0e0e0",borderRadius:"8px"}}/>
                  <div style={{fontSize:"10px",color:"#888",marginTop:"4px"}}>Vista previa</div>
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:"11px",color:"#888",marginBottom:"10px"}}>Tamaño de impresión:</div>
                  <div style={{display:"flex",gap:"8px",flexWrap:"wrap",marginBottom:"12px"}}>
                    {["2x2","3x3","5x5","personalizado"].map(t=>(
                      <div key={t} onClick={()=>setTamanoQR(t)}
                        style={{display:"flex",alignItems:"center",gap:"6px",padding:"7px 12px",border:tamanoQR===t?"2px solid #1a5fa8":"0.5px solid #ddd",borderRadius:"8px",background:tamanoQR===t?"#e8f0fe":"white",cursor:"pointer"}}>
                        <div style={{width:"14px",height:"14px",borderRadius:"50%",border:tamanoQR===t?"2px solid #1a5fa8":"1.5px solid #aaa",background:tamanoQR===t?"#1a5fa8":"white",display:"flex",alignItems:"center",justifyContent:"center"}}>
                          {tamanoQR===t&&<div style={{width:"5px",height:"5px",borderRadius:"50%",background:"white"}}></div>}
                        </div>
                        <span style={{fontSize:"12px",fontWeight:tamanoQR===t?500:400,color:tamanoQR===t?"#1a5fa8":"#333"}}>
                          {t==="personalizado"?"Personalizado":`${t} cm`}
                        </span>
                      </div>
                    ))}
                  </div>
                  {tamanoQR==="personalizado"&&(
                    <div style={{display:"flex",alignItems:"center",gap:"10px",padding:"9px 12px",background:"#f5f5f5",borderRadius:"8px",border:"0.5px solid #e0e0e0",marginBottom:"12px"}}>
                      <span style={{fontSize:"11px",color:"#888",whiteSpace:"nowrap"}}>Escala:</span>
                      <input type="range" min="1" max="10" value={escala} onChange={e=>setEscala(Number(e.target.value))} style={{flex:1}}/>
                      <span style={{fontSize:"12px",fontWeight:500,minWidth:"36px"}}>{escala} cm</span>
                    </div>
                  )}
                  <div style={{display:"flex",gap:"8px"}}>
                    <button style={s.btnImp} onClick={imprimirQR}>🖨️ Imprimir QR</button>
                    <button style={s.btnPDF} onClick={generarPDF} disabled={imprimiendo}>
                      {imprimiendo?"Generando...":"📄 Descargar PDF"}
                    </button>
                  </div>
                </div>
              </div>
            </div>

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
  badge:{padding:"3px 12px",borderRadius:"20px",fontSize:"11px",fontWeight:500,whiteSpace:"nowrap"},
  content:{maxWidth:"1200px",margin:"0 auto",padding:"20px 24px"},
  layout:{display:"flex",gap:"16px",alignItems:"flex-start"},
  sidebar:{width:"185px",flexShrink:0,display:"flex",flexDirection:"column",gap:"10px"},
  sCard:{background:"white",border:"0.5px solid #e0e0e0",borderRadius:"12px",padding:"12px 14px"},
  iconWrap:{width:"50px",height:"50px",borderRadius:"12px",background:"#e8f0fe",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 10px",fontSize:"26px"},
  sNombre:{fontSize:"13px",fontWeight:500,color:"#222",textAlign:"center",marginBottom:"5px"},
  sTipo:{fontSize:"10px",padding:"2px 8px",background:"#e8f0fe",color:"#1a5fa8",borderRadius:"20px",display:"inline-block"},
  sLbl:{fontSize:"10px",color:"#888",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"6px"},
  sVal:{fontSize:"12px",color:"#222"},
  codTag:{fontSize:"13px",padding:"3px 8px",background:"#f3e5f5",color:"#6a1b9a",borderRadius:"5px",fontFamily:"monospace",fontWeight:700},
  btnQR:{width:"100%",fontSize:"11px",padding:"8px",borderRadius:"8px",border:"0.5px solid #ddd",background:"white",cursor:"pointer",fontWeight:500},
  main:{flex:1,display:"flex",flexDirection:"column",gap:"10px",minWidth:0},
  sec:{background:"white",border:"0.5px solid #e0e0e0",borderRadius:"12px",padding:"14px"},
  secT:{fontSize:"11px",color:"#888",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"10px"},
  g4:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"10px"},
  g3:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"10px"},
  fl:{fontSize:"10px",color:"#888",marginBottom:"3px"},
  fv:{fontSize:"12px",fontWeight:500,color:"#222"},
  scroll:{height:"110px",overflowY:"scroll",display:"flex",flexDirection:"column",gap:"7px",paddingRight:"6px",scrollbarWidth:"thin",scrollbarColor:"#ffa726 #fff8e1"},
  iObs:{padding:"9px 12px",background:"#fff8e1",borderRadius:"8px",borderLeft:"3px solid #ffa726",flexShrink:0,fontSize:"12px",color:"#e65100"},
  iRec:{padding:"9px 12px",background:"#e8f5e9",borderRadius:"8px",borderLeft:"3px solid #43a047",flexShrink:0,fontSize:"12px",color:"#2e7d32"},
  iCor:{padding:"9px 12px",background:"#f5f5f5",borderRadius:"8px",borderLeft:"3px solid #1a5fa8",flexShrink:0},
  cronG:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"8px"},
  btnImp:{fontSize:"11px",padding:"7px 16px",borderRadius:"8px",border:"0.5px solid #ddd",background:"white",cursor:"pointer",fontWeight:500},
  btnPDF:{fontSize:"11px",padding:"7px 16px",borderRadius:"8px",background:"#c62828",color:"white",border:"none",cursor:"pointer",fontWeight:500},
  centro:{textAlign:"center",padding:"3rem",fontSize:"16px",color:"#888"},
};