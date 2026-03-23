import { useState, useEffect, useRef, useCallback } from "react";
import { useGamepad } from "./hooks/useGamepad";

/* ============================================================
   ARCVAULT GAME LAUNCHER
   Stack  : React 18 (single-file artifact)
   Backend: SQLite (via Electron IPC)
   AI     : Anthropic Claude API (auto-metadata + rekomendasi)
   ============================================================ */

const FontStyle = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=Syne:wght@400;500;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg0: #07070d; --bg1: #0d0d17; --bg2: #13131f; --bg3: #1a1a28; --bg4: #222234;
      --accent: #5b8ef0; --accent2: #7c6af5;
      --accent-glow: rgba(91,142,240,0.22); --accent-border: rgba(91,142,240,0.45);
      --txt0: #f0f0f8; --txt1: rgba(240,240,248,0.7); --txt2: rgba(240,240,248,0.38); --txt3: rgba(240,240,248,0.16);
      --border: rgba(255,255,255,0.06); --border2: rgba(255,255,255,0.12);
      --red: #f06060; --green: #50d890; --amber: #f0b840; --purple: #b08cf0; --teal: #40d8d0;
      --font-display: 'Rajdhani', sans-serif; --font-ui: 'Syne', sans-serif; --font-mono: 'JetBrains Mono', monospace;
    }
    html, body, #root { height: 100%; background: var(--bg0); }
    body { overflow: hidden; }
    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: var(--bg4); border-radius: 2px; }
    input, textarea, select, button { font-family: var(--font-ui); }
    input:focus, textarea:focus, select:focus { outline: none; }
    button { cursor: pointer; border: none; background: none; }
    @keyframes fadeInUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
    @keyframes fadeIn { from{opacity:0} to{opacity:1} }
    @keyframes scaleIn { from{opacity:0;transform:scale(0.94)} to{opacity:1;transform:scale(1)} }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
    @keyframes toastIn { from{opacity:0;transform:translateX(24px)} to{opacity:1;transform:translateX(0)} }
    @keyframes spin { to{transform:rotate(360deg)} }
  `}</style>
);

const GENRES = ["Action RPG","RPG","Metroidvania","Roguelike","Strategy","Adventure","Simulation","Sports","FPS","Fighting","Horror","Puzzle","Other"];
const GENRE_COLORS = {
  "Action RPG":"#f06060","RPG":"#b08cf0","Metroidvania":"#5b8ef0","Roguelike":"#f0b840",
  "Strategy":"#40d8d0","Adventure":"#50d890","FPS":"#f07850","Horror":"#c060f0",
  "Puzzle":"#60d0f0","Simulation":"#80e890","Sports":"#f0d060","Fighting":"#f08060","Other":"#8090b0"
};

// ── UTILS ──────────────────────────────────────────────────
const fmtTime=m=>{if(!m)return"0j";const h=Math.floor(m/60);return h>=1000?`${(h/1000).toFixed(1)}k j`:`${h}j ${m%60}m`;};
const fmtRel=iso=>{if(!iso)return"Belum pernah";const d=Date.now()-new Date(iso).getTime(),m=Math.floor(d/60000);if(m<1)return"Baru saja";if(m<60)return`${m}m lalu`;const h=Math.floor(m/60);if(h<24)return`${h}j lalu`;const dy=Math.floor(h/24);if(dy<7)return`${dy} hari lalu`;return`${Math.floor(dy/7)} minggu lalu`;};

// ── WEB AUDIO ─────────────────────────────────────────────
let _ctx=null;
const ac=()=>{if(!_ctx)_ctx=new(window.AudioContext||window.webkitAudioContext)();return _ctx;};
const Snd={
  tick(){try{const c=ac(),o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.frequency.setValueAtTime(1100,c.currentTime);o.frequency.exponentialRampToValueAtTime(850,c.currentTime+0.05);g.gain.setValueAtTime(0.07,c.currentTime);g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+0.07);o.start();o.stop(c.currentTime+0.07);}catch{}},
  launch(){try{const c=ac(),o=c.createOscillator(),g=c.createGain();o.type="sine";o.connect(g);g.connect(c.destination);o.frequency.setValueAtTime(280,c.currentTime);o.frequency.exponentialRampToValueAtTime(1100,c.currentTime+0.35);g.gain.setValueAtTime(0.14,c.currentTime);g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+0.45);o.start();o.stop(c.currentTime+0.45);}catch{}},
  open(){try{const c=ac(),o=c.createOscillator(),g=c.createGain();o.type="sine";o.connect(g);g.connect(c.destination);o.frequency.setValueAtTime(700,c.currentTime);o.frequency.exponentialRampToValueAtTime(950,c.currentTime+0.15);g.gain.setValueAtTime(0.07,c.currentTime);g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+0.18);o.start();o.stop(c.currentTime+0.18);}catch{}},
};

// ── CLAUDE API ─────────────────────────────────────────────
const callAI=async(system,user)=>{
  const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,system,messages:[{role:"user",content:user}]})});
  if(!r.ok)throw new Error(r.status);
  const d=await r.json();return d.content.map(b=>b.text||"").join("");
};
const AI={
  async meta(name){
    const t=await callAI(`Balas HANYA JSON valid tanpa markdown: {"developer":"...","genre":"...","year":2024,"description":"..."}. Genre harus salah satu dari: ${GENRES.join(", ")}. Description max 200 karakter bahasa Indonesia.`,`Metadata game: "${name}"`);
    return JSON.parse(t.replace(/```json|```/g,"").trim());
  },
  async rec(games){
    const s=games.slice(0,8).map(g=>`${g.name} (${g.genre}, ${fmtTime(g.totalMinutes)}, ${fmtRel(g.lastPlayed)})`).join("\n");
    return callAI(`Kamu AI asisten Game Launcher ArcVault. Beri rekomendasi game singkat, kasual, personal dalam 2-3 kalimat Bahasa Indonesia.`,`Library:\n${s}\n\nGame apa yang direkomendasikan sekarang dan mengapa?`);
  },
};

// ════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ════════════════════════════════════════════════════════════

const GenreTag=({genre,sm})=>{const c=GENRE_COLORS[genre]||"#8090b0";return(
  <span style={{display:"inline-flex",alignItems:"center",padding:sm?"2px 7px":"3px 11px",borderRadius:4,fontSize:sm?9:11,fontWeight:600,letterSpacing:"0.5px",background:c+"18",color:c,border:`0.5px solid ${c}40`}}>{genre}</span>
);};

// Dynamic crossfade background
const DynBg=({url})=>{
  const [layers,setLayers]=useState([{url,active:true,id:0},{url:null,active:false,id:1}]);
  const activeIdx=useRef(0);
  useEffect(()=>{
    const next=activeIdx.current===0?1:0,curr=activeIdx.current;
    setLayers(p=>{const n=[...p];n[next]={...n[next],url};return n;});
    const t=setTimeout(()=>{
      setLayers(p=>{const n=[...p];n[next]={...n[next],active:true};n[curr]={...n[curr],active:false};return n;});
      activeIdx.current=next;
    },30);
    return()=>clearTimeout(t);
  },[url]);
  return(
    <div style={{position:"absolute",inset:0,overflow:"hidden"}}>
      {layers.map(l=>(
        <div key={l.id} style={{position:"absolute",inset:0,backgroundImage:l.url?`url(${l.url})`:"none",backgroundSize:"cover",backgroundPosition:"center 20%",opacity:l.active?1:0,transition:"opacity 750ms cubic-bezier(0.4,0,0.2,1)",filter:"blur(2px) saturate(0.55) brightness(0.28)",transform:"scale(1.05)"}}/>
      ))}
      <div style={{position:"absolute",inset:0,background:"linear-gradient(108deg,rgba(7,7,13,0.97) 0%,rgba(7,7,13,0.84) 35%,rgba(7,7,13,0.45) 62%,rgba(7,7,13,0.15) 100%)"}}/>
      <div style={{position:"absolute",inset:0,background:"linear-gradient(to top,rgba(7,7,13,0.92) 0%,transparent 38%)"}}/>
    </div>
  );
};

// Game Card in grid
const GameCard=({game,focused,onFocus,onLaunch,idx})=>{
  const c=GENRE_COLORS[game.genre]||"#8090b0";
  const isNew=game.lastPlayed&&(Date.now()-new Date(game.lastPlayed).getTime())<172800000;
  return(
    <div onClick={()=>onFocus(game)} onDoubleClick={()=>onLaunch(game)} style={{aspectRatio:"2/3",borderRadius:10,overflow:"hidden",cursor:"pointer",position:"relative",border:focused?`1.5px solid ${c}`:"1.5px solid transparent",boxShadow:focused?`0 0 28px ${c}30,0 0 0 1px ${c}35`:"none",transform:focused?"scale(1.055)":"scale(1)",transition:"all 0.22s cubic-bezier(0.16,1,0.3,1)",animation:`fadeInUp 0.4s ease ${idx*0.045}s both`,background:"var(--bg3)",zIndex:focused?2:1}}>
      <img src={game.coverUrl} alt={game.name} style={{width:"100%",height:"100%",objectFit:"cover",display:"block",filter:focused?"brightness(1.05)":"brightness(0.7) saturate(0.8)",transition:"filter 0.22s"}} onError={e=>e.target.style.display="none"}/>
      <div style={{position:"absolute",inset:0,background:"linear-gradient(to top,rgba(0,0,0,0.88) 0%,transparent 55%)",opacity:focused?1:0,transition:"opacity 0.22s"}}/>
      <div style={{position:"absolute",bottom:0,left:0,right:0,padding:"7px",opacity:focused?1:0,transition:"opacity 0.2s"}}>
        <div style={{fontSize:10,fontWeight:600,color:"#fff",lineHeight:1.3,fontFamily:"var(--font-ui)",textAlign:"center"}}>{game.name}</div>
      </div>
      {game.isFavorite&&<div style={{position:"absolute",top:5,right:5,fontSize:10,color:"var(--amber)",textShadow:"0 0 8px rgba(240,184,64,0.7)"}}>★</div>}
      {isNew&&<div style={{position:"absolute",top:5,left:5,background:"rgba(91,142,240,0.88)",backdropFilter:"blur(4px)",borderRadius:3,padding:"2px 5px",fontSize:8,fontWeight:700,color:"#fff",letterSpacing:"0.8px",fontFamily:"var(--font-mono)",textTransform:"uppercase"}}>NEW</div>}
    </div>
  );
};

// Toast
const Toast=({toasts})=>(
  <div style={{position:"fixed",top:20,right:20,zIndex:9999,display:"flex",flexDirection:"column",gap:8,pointerEvents:"none"}}>
    {toasts.map(t=>(
      <div key={t.id} style={{background:t.type==="error"?"rgba(240,96,96,0.1)":"rgba(80,216,144,0.1)",border:`0.5px solid ${t.type==="error"?"rgba(240,96,96,0.3)":"rgba(80,216,144,0.3)"}`,borderRadius:10,padding:"10px 16px",fontSize:13,color:t.type==="error"?"var(--red)":"var(--green)",fontFamily:"var(--font-ui)",backdropFilter:"blur(12px)",animation:"toastIn 0.3s ease",display:"flex",alignItems:"center",gap:8,maxWidth:300}}>
        <span>{t.type==="error"?"✕":"✓"}</span>{t.message}
      </div>
    ))}
  </div>
);

// Launch overlay
const LaunchOverlay=({game})=>(
  <div style={{position:"fixed",inset:0,zIndex:800,background:"rgba(7,7,13,0.95)",backdropFilter:"blur(20px)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",animation:"fadeIn 0.3s ease"}}>
    {game.coverUrl&&<img src={game.coverUrl} alt={game.name} style={{height:160,borderRadius:14,marginBottom:28,border:`1.5px solid ${GENRE_COLORS[game.genre]||"var(--accent)"}60`,boxShadow:`0 0 50px ${GENRE_COLORS[game.genre]||"var(--accent)"}35`,animation:"scaleIn 0.35s ease"}}/>}
    <div style={{fontFamily:"var(--font-display)",fontSize:40,fontWeight:700,color:"var(--txt0)",marginBottom:8,letterSpacing:"-0.3px"}}>{game.name}</div>
    <div style={{fontSize:11,color:"var(--txt2)",fontFamily:"var(--font-mono)",letterSpacing:"2px",textTransform:"uppercase",marginBottom:32}}>Meluncurkan game...</div>
    <div style={{display:"flex",gap:7}}>{[0,1,2,3].map(i=><div key={i} style={{width:7,height:7,borderRadius:"50%",background:"var(--accent)",animation:`pulse 1.2s ease ${i*0.22}s infinite`}}/>)}</div>
    <div style={{marginTop:20,fontSize:11,color:"var(--txt3)",fontFamily:"var(--font-mono)",maxWidth:400,textAlign:"center",wordBreak:"break-all"}}>{game.exePath}</div>
    <div style={{marginTop:8,fontSize:11,color:"var(--txt3)",fontFamily:"var(--font-ui)"}}>Di Electron: child_process.spawn akan dipanggil di sini</div>
  </div>
);

// ── ADD GAME MODAL ─────────────────────────────────────────
const AddModal=({onClose,onAdd,toast})=>{
  const [f,setF]=useState({name:"",exePath:"",developer:"",genre:"Action RPG",year:new Date().getFullYear(),description:"",coverUrl:"",bgUrl:""});
  const [ai,setAi]=useState(false);
  const s=(k,v)=>setF(p=>({...p,[k]:v}));
  const iStyle={width:"100%",background:"var(--bg3)",border:"0.5px solid var(--border2)",borderRadius:8,padding:"9px 12px",fontSize:13,color:"var(--txt0)",fontFamily:"var(--font-ui)",transition:"border-color 0.2s"};
  const lStyle={fontSize:9,letterSpacing:"1.8px",color:"var(--txt2)",fontFamily:"var(--font-mono)",textTransform:"uppercase",marginBottom:6,display:"block"};
  const focus=e=>e.target.style.borderColor="var(--accent-border)";
  const blur=e=>e.target.style.borderColor="var(--border2)";

  const autoFill=async()=>{
    if(!f.name.trim()){toast("Isi nama game dulu!","error");return;}
    setAi(true);
    try{const m=await AI.meta(f.name);setF(p=>({...p,developer:m.developer||p.developer,genre:m.genre||p.genre,year:m.year||p.year,description:m.description||p.description}));toast("Metadata berhasil diisi AI!");}
    catch{toast("Gagal fetch AI. Cek koneksi internet.","error");}
    setAi(false);
  };

  const submit=()=>{
    if(!f.name.trim()){toast("Nama game wajib!","error");return;}
    if(!f.exePath.trim()){toast("Path .exe wajib!","error");return;}
    onAdd({...f,year:parseInt(f.year)||2024});onClose();
  };

  return(
    <div style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(7,7,13,0.88)",backdropFilter:"blur(14px)",display:"flex",alignItems:"center",justifyContent:"center",animation:"fadeIn 0.2s ease"}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:"var(--bg1)",border:"0.5px solid var(--border2)",borderRadius:16,width:"min(700px,96vw)",maxHeight:"92vh",overflow:"hidden",display:"flex",flexDirection:"column",animation:"scaleIn 0.28s cubic-bezier(0.16,1,0.3,1)"}}>
        {/* Header */}
        <div style={{padding:"20px 26px 16px",borderBottom:"0.5px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div>
            <div style={{fontSize:9,letterSpacing:"2px",color:"var(--accent)",fontFamily:"var(--font-mono)",textTransform:"uppercase",marginBottom:4}}>Library · Tambah</div>
            <h2 style={{fontFamily:"var(--font-display)",fontSize:24,fontWeight:700,color:"var(--txt0)"}}>Game Baru</h2>
          </div>
          <button onClick={onClose} style={{width:32,height:32,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",background:"var(--bg3)",border:"0.5px solid var(--border2)",color:"var(--txt2)",fontSize:14,transition:"all 0.2s"}} onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(240,96,96,0.4)";e.currentTarget.style.color="var(--red)";}} onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border2)";e.currentTarget.style.color="var(--txt2)";}}>✕</button>
        </div>

        <div style={{padding:"22px 26px",overflowY:"auto",flex:1}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            {/* Name + AI */}
            <div style={{gridColumn:"1/-1"}}>
              <label style={lStyle}>Nama Game *</label>
              <div style={{display:"flex",gap:8}}>
                <input value={f.name} onChange={e=>s("name",e.target.value)} placeholder="Contoh: Elden Ring" style={{...iStyle,flex:1}} onFocus={focus} onBlur={blur}/>
                <button onClick={autoFill} disabled={ai} style={{padding:"9px 14px",borderRadius:8,fontSize:11,fontWeight:600,fontFamily:"var(--font-ui)",cursor:ai?"default":"pointer",background:ai?"rgba(91,142,240,0.04)":"rgba(91,142,240,0.12)",border:"0.5px solid rgba(91,142,240,0.3)",color:ai?"var(--txt3)":"var(--accent)",whiteSpace:"nowrap",transition:"all 0.2s",display:"flex",alignItems:"center",gap:6}}>
                  {ai?<span style={{display:"inline-block",width:10,height:10,border:"1.5px solid var(--accent)",borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/>:<span>✦</span>}
                  {ai?"Fetching...":"AI Auto-Fill"}
                </button>
              </div>
            </div>

            {/* EXE Path */}
            <div style={{gridColumn:"1/-1"}}>
              <label style={lStyle}>Path .exe / Shortcut *</label>
              <div style={{display:"flex",gap:8}}>
                <input value={f.exePath} onChange={e=>s("exePath",e.target.value)} placeholder="C:\Games\NamaGame\game.exe" style={{...iStyle,flex:1,fontFamily:"var(--font-mono)",fontSize:12}} onFocus={focus} onBlur={blur}/>
                <button onClick={async()=>{const r=await window.api.browsePath();if(!r.canceled&&r.filePaths[0])s('exePath',r.filePaths[0]);}} style={{padding:"9px 14px",borderRadius:8,fontSize:12,background:"var(--bg3)",border:"0.5px solid var(--border2)",color:"var(--txt1)",fontFamily:"var(--font-ui)",cursor:"pointer",whiteSpace:"nowrap"}}>📁 Browse</button>
              </div>
            </div>

            {/* Developer & Year */}
            <div>
              <label style={lStyle}>Developer</label>
              <input value={f.developer} onChange={e=>s("developer",e.target.value)} placeholder="Contoh: FromSoftware" style={iStyle} onFocus={focus} onBlur={blur}/>
            </div>
            <div>
              <label style={lStyle}>Tahun Rilis</label>
              <input type="number" value={f.year} onChange={e=>s("year",e.target.value)} min="1980" max="2030" style={iStyle} onFocus={focus} onBlur={blur}/>
            </div>

            {/* Genre chips */}
            <div style={{gridColumn:"1/-1"}}>
              <label style={lStyle}>Genre</label>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {GENRES.map(g=>{const c=GENRE_COLORS[g]||"#8090b0",a=f.genre===g;return(
                  <button key={g} onClick={()=>s("genre",g)} style={{padding:"5px 11px",borderRadius:5,fontSize:11,fontWeight:600,fontFamily:"var(--font-ui)",cursor:"pointer",transition:"all 0.15s",background:a?c+"20":"var(--bg3)",border:`0.5px solid ${a?c+"60":"var(--border2)"}`,color:a?c:"var(--txt2)"}}>{g}</button>
                );})}
              </div>
            </div>

            {/* Description */}
            <div style={{gridColumn:"1/-1"}}>
              <label style={lStyle}>Deskripsi ({f.description.length}/280)</label>
              <textarea value={f.description} onChange={e=>s("description",e.target.value.slice(0,280))} placeholder="Deskripsi singkat game..." rows={3} style={{...iStyle,resize:"none",lineHeight:1.7}} onFocus={focus} onBlur={blur}/>
            </div>

            {/* Art URLs */}
            <div>
              <label style={lStyle}>Cover Art URL</label>
              <input value={f.coverUrl} onChange={e=>s("coverUrl",e.target.value)} placeholder="https://...cover.jpg" style={iStyle} onFocus={focus} onBlur={blur}/>
              {f.coverUrl&&<img src={f.coverUrl} alt="preview" style={{marginTop:8,height:60,borderRadius:6,border:"0.5px solid var(--border2)"}} onError={e=>e.target.style.display="none"}/>}
            </div>
            <div>
              <label style={lStyle}>Background URL</label>
              <input value={f.bgUrl} onChange={e=>s("bgUrl",e.target.value)} placeholder="https://...bg.jpg" style={iStyle} onFocus={focus} onBlur={blur}/>
              {f.bgUrl&&<img src={f.bgUrl} alt="bg" style={{marginTop:8,height:60,borderRadius:6,border:"0.5px solid var(--border2)",objectFit:"cover",width:"100%"}} onError={e=>e.target.style.display="none"}/>}
            </div>
          </div>
        </div>

        <div style={{padding:"16px 26px",borderTop:"0.5px solid var(--border)",display:"flex",justifyContent:"flex-end",gap:10}}>
          <button onClick={onClose} style={{padding:"10px 20px",borderRadius:8,fontSize:13,background:"var(--bg3)",border:"0.5px solid var(--border2)",color:"var(--txt1)",fontFamily:"var(--font-ui)",cursor:"pointer"}}>Batal</button>
          <button onClick={submit} style={{padding:"10px 26px",borderRadius:8,fontSize:13,fontWeight:700,background:"var(--accent)",border:"none",color:"#fff",fontFamily:"var(--font-ui)",cursor:"pointer",letterSpacing:"0.3px",transition:"background 0.2s"}} onMouseEnter={e=>e.currentTarget.style.background="#6f9ff5"} onMouseLeave={e=>e.currentTarget.style.background="var(--accent)"}>+ Tambah Game</button>
        </div>
      </div>
    </div>
  );
};

// ── SEARCH OVERLAY ─────────────────────────────────────────
const SearchOverlay=({games,onClose,onSelect})=>{
  const [q,setQ]=useState("");
  const [genre,setGenre]=useState("All");
  const ref=useRef();
  useEffect(()=>{ref.current?.focus();},[]);
  const allG=["All",...new Set(games.map(g=>g.genre))];
  const filtered=games.filter(g=>{
    const mq=!q||g.name.toLowerCase().includes(q.toLowerCase())||g.developer?.toLowerCase().includes(q.toLowerCase());
    const mg=genre==="All"||g.genre===genre;
    return mq&&mg;
  });
  return(
    <div style={{position:"fixed",inset:0,zIndex:900,background:"rgba(7,7,13,0.94)",backdropFilter:"blur(18px)",display:"flex",flexDirection:"column",animation:"fadeIn 0.18s ease"}}>
      <div style={{padding:"32px 40px 0"}}>
        <div style={{maxWidth:620,margin:"0 auto"}}>
          <div style={{position:"relative"}}>
            <span style={{position:"absolute",left:16,top:"50%",transform:"translateY(-50%)",fontSize:18,color:"var(--txt2)",pointerEvents:"none"}}>⌕</span>
            <input ref={ref} value={q} onChange={e=>setQ(e.target.value)} placeholder="Cari game..." style={{width:"100%",background:"var(--bg2)",border:"0.5px solid var(--accent-border)",borderRadius:12,padding:"14px 16px 14px 46px",fontSize:18,color:"var(--txt0)",fontFamily:"var(--font-display)",letterSpacing:"0.3px"}}/>
            <button onClick={onClose} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",fontSize:11,color:"var(--txt2)",background:"var(--bg3)",border:"0.5px solid var(--border2)",borderRadius:6,padding:"4px 8px",fontFamily:"var(--font-mono)",cursor:"pointer"}}>ESC</button>
          </div>
          <div style={{display:"flex",gap:7,marginTop:14,flexWrap:"wrap"}}>
            {allG.map(g=>(
              <button key={g} onClick={()=>setGenre(g)} style={{padding:"5px 12px",borderRadius:6,fontSize:11,fontWeight:600,fontFamily:"var(--font-ui)",cursor:"pointer",transition:"all 0.15s",background:genre===g?"rgba(91,142,240,0.15)":"var(--bg3)",border:`0.5px solid ${genre===g?"var(--accent-border)":"var(--border2)"}`,color:genre===g?"var(--accent)":"var(--txt2)"}}>{g}</button>
            ))}
          </div>
        </div>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"22px 40px"}}>
        <div style={{maxWidth:620,margin:"0 auto"}}>
          {filtered.length===0?
            <div style={{textAlign:"center",padding:"40px 0",color:"var(--txt2)",fontFamily:"var(--font-ui)",fontSize:14}}>Tidak ada game ditemukan.</div>:
            <div style={{display:"flex",flexDirection:"column",gap:3}}>
              {filtered.map((g,i)=>(
                <button key={g.id} onClick={()=>{onSelect(g);onClose();}} style={{display:"flex",alignItems:"center",gap:14,padding:"12px 14px",borderRadius:10,background:"transparent",border:"0.5px solid transparent",cursor:"pointer",textAlign:"left",width:"100%",transition:"all 0.15s",animation:`fadeInUp 0.25s ease ${i*0.028}s both`}} onMouseEnter={e=>{e.currentTarget.style.background="var(--bg2)";e.currentTarget.style.borderColor="var(--border2)";}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.borderColor="transparent";}}>
                  <img src={g.coverUrl} alt={g.name} style={{width:36,height:48,borderRadius:6,objectFit:"cover",border:"0.5px solid var(--border2)",flexShrink:0}} onError={e=>e.target.style.display="none"}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:15,fontWeight:600,color:"var(--txt0)",fontFamily:"var(--font-display)",marginBottom:2}}>{g.name}</div>
                    <div style={{fontSize:11,color:"var(--txt2)",fontFamily:"var(--font-ui)"}}>{g.developer} · {g.year}</div>
                  </div>
                  <GenreTag genre={g.genre} sm/>
                  <div style={{fontSize:11,color:"var(--txt2)",fontFamily:"var(--font-mono)",whiteSpace:"nowrap"}}>{fmtTime(g.totalMinutes)}</div>
                </button>
              ))}
            </div>
          }
        </div>
      </div>
    </div>
  );
};

// ── HERO PANEL ─────────────────────────────────────────────
const HeroPanel=({game,onLaunch,onFav,onDelete,aiRec,loadingRec,onRec,isLaunching})=>{
  const [delConfirm,setDelConfirm]=useState(false);
  if(!game)return null;
  return(
    <div style={{flex:1,minWidth:0,paddingRight:12,animation:"fadeInUp 0.35s ease both",display:"flex",flexDirection:"column",justifyContent:"center"}}>
      {/* Label */}
      <div style={{fontSize:9,letterSpacing:"2.5px",color:"var(--txt3)",marginBottom:16,fontFamily:"var(--font-mono)",textTransform:"uppercase",display:"flex",alignItems:"center",gap:8}}>
        <span style={{display:"inline-block",width:20,height:1,background:"var(--accent)",opacity:0.5}}/>
        Sedang Dipilih
      </div>

      {/* Title */}
      <h1 key={game.id+"t"} style={{fontFamily:"var(--font-display)",fontSize:"clamp(34px,3.8vw,58px)",fontWeight:700,color:"var(--txt0)",lineHeight:0.93,marginBottom:14,letterSpacing:"-0.5px",animation:"fadeInUp 0.3s ease both"}}>
        {game.name}
      </h1>

      {/* Meta */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,flexWrap:"wrap"}}>
        <GenreTag genre={game.genre}/>
        <span style={{fontSize:12,color:"var(--txt2)",fontFamily:"var(--font-mono)"}}>{game.developer}</span>
        <span style={{width:3,height:3,borderRadius:"50%",background:"var(--txt3)",flexShrink:0}}/>
        <span style={{fontSize:12,color:"var(--txt2)",fontFamily:"var(--font-mono)"}}>{game.year}</span>
        {game.isFavorite&&<span style={{fontSize:12,color:"var(--amber)"}}>★ Favorit</span>}
      </div>

      {/* Description */}
      <p key={game.id+"d"} style={{fontSize:13,color:"var(--txt1)",lineHeight:1.75,maxWidth:380,marginBottom:22,fontFamily:"var(--font-ui)",animation:"fadeInUp 0.35s ease both"}}>{game.description}</p>

      {/* Stats */}
      <div style={{display:"flex",gap:26,marginBottom:26}}>
        {[{l:"Terakhir Main",v:fmtRel(game.lastPlayed)},{l:"Total Waktu",v:fmtTime(game.totalMinutes)},{l:"Ditambahkan",v:fmtRel(game.addedAt)}].map(s=>(
          <div key={s.l}>
            <div style={{fontSize:9,letterSpacing:"1.8px",color:"var(--txt3)",textTransform:"uppercase",fontFamily:"var(--font-mono)",marginBottom:4}}>{s.l}</div>
            <div style={{fontSize:14,fontWeight:600,color:"var(--txt0)",fontFamily:"var(--font-display)",letterSpacing:"0.3px"}}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Buttons */}
      <div style={{display:"flex",gap:9,flexWrap:"wrap",alignItems:"center"}}>
        <button onClick={()=>onLaunch(game)} disabled={isLaunching} style={{display:"flex",alignItems:"center",gap:10,background:isLaunching?"var(--bg3)":"var(--accent)",color:isLaunching?"var(--txt3)":"#fff",border:"none",borderRadius:9,padding:"11px 22px",fontSize:13,fontWeight:700,letterSpacing:"0.5px",fontFamily:"var(--font-ui)",transition:"all 0.2s",cursor:isLaunching?"default":"pointer"}} onMouseEnter={e=>!isLaunching&&(e.currentTarget.style.background="#6f9ff5")} onMouseLeave={e=>!isLaunching&&(e.currentTarget.style.background="var(--accent)")} onMouseDown={e=>!isLaunching&&(e.currentTarget.style.transform="scale(0.96)")} onMouseUp={e=>!isLaunching&&(e.currentTarget.style.transform="scale(1)")}>
          <svg width="9" height="11" viewBox="0 0 9 11" fill="white"><path d="M0 0L9 5.5L0 11V0Z"/></svg>
          Launch Game
        </button>
        <button onClick={()=>onFav(game.id)} style={{padding:"11px 15px",borderRadius:9,background:game.isFavorite?"rgba(240,184,64,0.12)":"rgba(255,255,255,0.05)",border:`0.5px solid ${game.isFavorite?"rgba(240,184,64,0.35)":"var(--border2)"}`,color:game.isFavorite?"var(--amber)":"var(--txt2)",fontSize:16,transition:"all 0.2s",cursor:"pointer"}}>
          {game.isFavorite?"★":"☆"}
        </button>
        {!delConfirm?
          <button onClick={()=>setDelConfirm(true)} style={{padding:"11px 15px",borderRadius:9,background:"rgba(255,255,255,0.04)",border:"0.5px solid var(--border2)",color:"var(--txt2)",fontSize:12,fontFamily:"var(--font-ui)",transition:"all 0.2s",cursor:"pointer"}} onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(240,96,96,0.3)";e.currentTarget.style.color="var(--red)";}} onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border2)";e.currentTarget.style.color="var(--txt2)";}}>✕ Hapus</button>:
          <div style={{display:"flex",gap:6}}>
            <button onClick={()=>{onDelete(game.id);setDelConfirm(false);}} style={{padding:"11px 13px",borderRadius:9,background:"rgba(240,96,96,0.14)",border:"0.5px solid rgba(240,96,96,0.4)",color:"var(--red)",fontSize:12,fontFamily:"var(--font-ui)",cursor:"pointer"}}>Ya, hapus</button>
            <button onClick={()=>setDelConfirm(false)} style={{padding:"11px 13px",borderRadius:9,background:"rgba(255,255,255,0.05)",border:"0.5px solid var(--border2)",color:"var(--txt2)",fontSize:12,fontFamily:"var(--font-ui)",cursor:"pointer"}}>Batal</button>
          </div>
        }
      </div>

      {/* AI Rec */}
      <div style={{marginTop:22,maxWidth:430}}>
        {aiRec?(
          <div style={{background:"rgba(91,142,240,0.07)",border:"0.5px solid rgba(91,142,240,0.2)",borderRadius:10,padding:"13px 15px",fontSize:12,color:"var(--txt1)",lineHeight:1.75,fontFamily:"var(--font-ui)",animation:"fadeIn 0.4s ease"}}>
            <div style={{fontSize:9,letterSpacing:"1.5px",color:"var(--accent)",marginBottom:6,fontFamily:"var(--font-mono)",textTransform:"uppercase"}}>✦ AI · ArcVault Recs</div>
            {aiRec}
          </div>
        ):(
          <button onClick={onRec} disabled={loadingRec} style={{display:"flex",alignItems:"center",gap:7,background:"rgba(91,142,240,0.06)",border:"0.5px solid rgba(91,142,240,0.18)",borderRadius:8,padding:"8px 14px",fontSize:11,color:loadingRec?"var(--txt3)":"var(--accent)",fontFamily:"var(--font-ui)",cursor:loadingRec?"default":"pointer",transition:"all 0.2s",letterSpacing:"0.3px"}}>
            <span style={{animation:loadingRec?"pulse 1s infinite":"none",fontSize:12}}>✦</span>
            {loadingRec?"AI sedang berpikir...":"Tanya AI: Game apa yang harus kumainkan?"}
          </button>
        )}
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════
// MAIN APP
// ════════════════════════════════════════════════════════════
export default function ArcVault(){
  const [games,setGames]=useState([]);
  const [focused,setFocused]=useState(null);

  // ── Load games from SQLite on mount ──
  useEffect(()=>{
    window.api.getGames().then(data=>{
      setGames(data);
      const sorted=[...data].sort((a,b)=>new Date(b.lastPlayed||0)-new Date(a.lastPlayed||0));
      setFocused(sorted[0]||null);
    });
  },[]);
  const [showAdd,setShowAdd]=useState(false);
  const [showSearch,setShowSearch]=useState(false);
  const [launching,setLaunching]=useState(null);
  const [isLaunching,setIsLaunching]=useState(false);
  const [toasts,setToasts]=useState([]);
  const [aiRec,setAiRec]=useState(null);
  const [loadRec,setLoadRec]=useState(false);
  const [clock,setClock]=useState("");
  const [filterFav,setFilterFav]=useState(false);
  const [isMaximized,setIsMaximized]=useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(null);
  const [updateReady, setUpdateReady] = useState(null);

  const { isConnected } = useGamepad({
    onNavigate: (dir) => {
      const fl = getFiltered();
      const idx = fl.findIndex(g => g.id === focused?.id);
      if (idx === -1) return;

      const COLS = 3;
      let nextIdx = idx;

      if (dir === 'right') nextIdx = idx + 1;
      if (dir === 'left')  nextIdx = idx - 1;
      if (dir === 'down')  nextIdx = idx + COLS;
      if (dir === 'up')    nextIdx = idx - COLS;

      nextIdx = Math.max(0, Math.min(nextIdx, fl.length - 1));

      const sameRow = Math.floor(nextIdx / COLS) === Math.floor(idx / COLS);
      if ((dir === 'right' || dir === 'left') && !sameRow) return;

      if (fl[nextIdx] && nextIdx !== idx) {
        Snd.tick();
        handleFocus(fl[nextIdx]);
      }
    },
    onLaunch: () => !isLaunching && focused && handleLaunch(focused),
    onBack: () => { setShowSearch(false); setShowAdd(false); },
    onSearch: () => { Snd.open(); setShowSearch(true); },
    onFavorite: () => focused && handleFav(focused.id),
  }, !showAdd && !showSearch && !launching);

  useEffect(()=>{
    const unsubClosed = window.api.onGameClosed((_, data) => {
      setLaunching(null);
      window.api.getGames().then(setGames);
      addToast(`Sesi selesai: +${data.durationMin} menit`);
    });
    const unsubLaunched = window.api.onGameLaunched((_, gameId) => {
      console.log('Game launched:', gameId);
    });
    const unsubMax = window.api.onMaximizeChange?.((_, maximized) => {
      setIsMaximized(maximized);
    });
    const unsubUpdateAvail = window.api.onUpdateAvailable?.((_, info) => {
      setUpdateAvailable(info);
    });
    const unsubUpdateReady = window.api.onUpdateDownloaded?.((_, info) => {
      setUpdateReady(info);
    });
    return () => {
      unsubClosed?.();
      unsubLaunched?.();
      unsubMax?.();
      unsubUpdateAvail?.();
      unsubUpdateReady?.();
    };
  }, []);

  useEffect(()=>{
    const t=()=>{const d=new Date();setClock(`${d.getHours().toString().padStart(2,"0")}:${d.getMinutes().toString().padStart(2,"0")}`);};
    t();const iv=setInterval(t,10000);return()=>clearInterval(iv);
  },[]);

  const getFiltered=useCallback(()=>{
    let g=[...games];
    if(filterFav)g=g.filter(x=>x.isFavorite);
    return g.sort((a,b)=>new Date(b.lastPlayed||0)-new Date(a.lastPlayed||0));
  },[games,filterFav]);

  const addToast=(msg,type="success")=>{
    const id=Date.now();
    setToasts(p=>[...p,{id,message:msg,type}]);
    setTimeout(()=>setToasts(p=>p.filter(t=>t.id!==id)),3200);
  };

  // Keyboard navigation
  useEffect(()=>{
    const h=e=>{
      if(e.ctrlKey&&e.key==="f"){e.preventDefault();Snd.open();setShowSearch(true);}
      if(e.key==="Escape"){setShowSearch(false);setShowAdd(false);}
      if(e.key==="Enter"&&focused&&!showAdd&&!showSearch)handleLaunch(focused);
      if((e.key==="ArrowRight"||e.key==="ArrowLeft")&&!showSearch&&!showAdd){
        const fl=getFiltered();
        const idx=fl.findIndex(g=>g.id===focused?.id);
        const next=e.key==="ArrowRight"?Math.min(idx+1,fl.length-1):Math.max(idx-1,0);
        if(fl[next]){Snd.tick();setFocused(fl[next]);setAiRec(null);}
      }
    };
    window.addEventListener("keydown",h);return()=>window.removeEventListener("keydown",h);
  },[focused,showAdd,showSearch,filterFav,games]);

  const handleFocus=g=>{Snd.tick();setFocused(g);setAiRec(null);};

  const handleLaunch=async(game)=>{
    if (isLaunching) return;
    setIsLaunching(true);
    Snd.launch();setLaunching(game);
    try{
      await window.api.launchGame(game.id);
    }catch(err){
      setLaunching(null);addToast('Gagal launch: '+err.message,'error');
    }finally{
      setIsLaunching(false);
    }
  };

  const handleAdd=async(data)=>{
    try{
      const newGame=await window.api.addGame(data);
      setGames(p=>[...p,newGame]);setFocused(newGame);
      addToast(`${data.name} ditambahkan ke library!`);Snd.open();
    }catch(err){addToast('Gagal menambah game: '+err.message,'error');}
  };

  const handleDelete=async(id)=>{
    const game=games.find(g=>g.id===id);
    try{
      await window.api.deleteGame(id);
      setGames(p=>{const n=p.filter(g=>g.id!==id);setFocused(n[0]||null);return n;});
      addToast(`${game?.name} dihapus.`);
    }catch(err){addToast('Gagal menghapus: '+err.message,'error');}
  };

  const handleFav=async(id)=>{
    const game=games.find(g=>g.id===id);
    try{
      const updated=await window.api.updateGame(id,{isFavorite:!game.isFavorite});
      setGames(p=>p.map(g=>g.id===id?updated:g));setFocused(updated);
      addToast(game.isFavorite?"Dihapus dari favorit.":"Ditambahkan ke favorit! ★");
    }catch(err){addToast('Gagal update favorit: '+err.message,'error');}
  };

  const handleRec=async()=>{
    setLoadRec(true);
    try{const r=await AI.rec(games);setAiRec(r);}
    catch{addToast("Gagal mendapat rekomendasi AI.","error");}
    setLoadRec(false);
  };

  const filtered=getFiltered();

  return(
    <>
      <FontStyle/>
      <div style={{width:"100%",height:"100vh",position:"relative",background:"var(--bg0)",overflow:"hidden",fontFamily:"var(--font-ui)"}}>
        <DynBg url={focused?.bgUrl||""}/>

        <div style={{position:"relative",zIndex:10,height:"100%",display:"flex",flexDirection:"column",padding:"0 36px"}}>
          {/* TOP BAR */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"20px 0 0",flexShrink:0, WebkitAppRegion:"drag"}}>
            <div style={{fontFamily:"var(--font-display)",fontSize:22,fontWeight:700,letterSpacing:"4px",color:"var(--txt0)",textTransform:"uppercase", WebkitAppRegion:"no-drag"}}>
              ARC<span style={{color:"var(--accent)"}}>VAULT</span>
              <span style={{fontSize:9,letterSpacing:"2px",color:"var(--txt3)",fontFamily:"var(--font-mono)",marginLeft:12,verticalAlign:"middle"}}>v0.1.0-alpha</span>
            </div>

            <div style={{display:"flex",gap:4,background:"rgba(255,255,255,0.04)",border:"0.5px solid var(--border)",borderRadius:10,padding:3, WebkitAppRegion:"no-drag"}}>
              {[["Semua",false],["★ Favorit",true]].map(([lbl,val])=>(
                <button key={lbl} onClick={()=>setFilterFav(val)} style={{padding:"6px 16px",borderRadius:7,fontSize:12,fontWeight:600,fontFamily:"var(--font-ui)",cursor:"pointer",transition:"all 0.2s",background:filterFav===val?"rgba(91,142,240,0.18)":"transparent",border:`0.5px solid ${filterFav===val?"var(--accent-border)":"transparent"}`,color:filterFav===val?"var(--accent)":"var(--txt2)"}}>{lbl}</button>
              ))}
            </div>

            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <button onClick={()=>{Snd.open();setShowSearch(true);}} style={{WebkitAppRegion:"no-drag",display:"flex",alignItems:"center",gap:8,background:"rgba(255,255,255,0.05)",border:"0.5px solid var(--border2)",borderRadius:9,padding:"7px 14px",fontSize:12,color:"var(--txt2)",fontFamily:"var(--font-ui)",cursor:"pointer",transition:"all 0.2s"}} onMouseEnter={e=>e.currentTarget.style.borderColor="var(--accent-border)"} onMouseLeave={e=>e.currentTarget.style.borderColor="var(--border2)"}>
                <span style={{fontSize:14}}>⌕</span> Cari
                <span style={{fontSize:10,color:"var(--txt3)",fontFamily:"var(--font-mono)"}}>Ctrl+F</span>
              </button>
              <button onClick={()=>{Snd.open();setShowAdd(true);}} style={{WebkitAppRegion:"no-drag",display:"flex",alignItems:"center",gap:6,background:"rgba(91,142,240,0.12)",border:"0.5px solid var(--accent-border)",borderRadius:9,padding:"7px 14px",fontSize:12,fontWeight:600,color:"var(--accent)",fontFamily:"var(--font-ui)",cursor:"pointer",transition:"all 0.2s"}} onMouseEnter={e=>e.currentTarget.style.background="rgba(91,142,240,0.22)"} onMouseLeave={e=>e.currentTarget.style.background="rgba(91,142,240,0.12)"}> + Tambah Game</button>
              <div style={{fontSize:13,color:"var(--txt2)",fontFamily:"var(--font-mono)",padding:"0 4px", WebkitAppRegion:"no-drag"}}>{clock}</div>
              {/* WINDOW CONTROLS */}
              <div style={{display:"flex",gap:6,alignItems:"center",marginLeft:8,WebkitAppRegion:"no-drag"}}>
                <button title="Minimize" onClick={()=>window.api.minimizeWindow()} style={{width:12,height:12,borderRadius:"50%",background:"#f0b840",border:"none",cursor:"pointer"}} onMouseEnter={e=>e.target.style.opacity="0.7"} onMouseLeave={e=>e.target.style.opacity="1"}/>
                <button title={isMaximized?"Restore":"Maximize"} onClick={()=>window.api.maximizeWindow()} style={{width:12,height:12,borderRadius:"50%",background:isMaximized?"#a8e890":"#50d890",border:"none",cursor:"pointer"}} onMouseEnter={e=>e.target.style.opacity="0.7"} onMouseLeave={e=>e.target.style.opacity="1"}/>
                <button title="Close" onClick={()=>window.api.closeWindow()} style={{width:12,height:12,borderRadius:"50%",background:"#f06060",border:"none",cursor:"pointer"}} onMouseEnter={e=>e.target.style.opacity="0.7"} onMouseLeave={e=>e.target.style.opacity="1"}/>
              </div>
            </div>
          </div>

          {/* UPDATE BANNER */}
          {updateReady ? (
            <div style={{ background:'rgba(80,216,144,0.1)', borderBottom:'0.5px solid rgba(80,216,144,0.3)', padding: '8px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: 'var(--green)', fontFamily: 'var(--font-ui)', marginTop: 12 }}>
              <span style={{fontWeight:600}}>✦ Update v{updateReady.version} siap diinstall</span>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={() => window.api.installUpdate()} style={{ padding:'4px 12px', borderRadius:6, fontSize:11, background:'rgba(80,216,144,0.2)', border:'0.5px solid rgba(80,216,144,0.4)', color:'var(--green)', cursor:'pointer', fontWeight:600 }}>Restart & Update</button>
                <button onClick={() => setUpdateReady(null)} style={{ padding:'4px 8px', borderRadius:6, fontSize:11, background:'transparent', border:'none', color:'var(--txt3)', cursor:'pointer' }}>✕</button>
              </div>
            </div>
          ) : updateAvailable ? (
            <div style={{ background:'rgba(91,142,240,0.1)', borderBottom:'0.5px solid rgba(91,142,240,0.3)', padding: '8px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: 'var(--accent)', fontFamily: 'var(--font-ui)', marginTop: 12 }}>
              <span>⟳ Mendownload update v{updateAvailable.version}...</span>
              <button onClick={() => setUpdateAvailable(null)} style={{ padding:'4px 8px', borderRadius:6, fontSize:11, background:'transparent', border:'none', color:'var(--txt3)', cursor:'pointer' }}>✕</button>
            </div>
          ) : null}

          {/* MAIN AREA */}
          <div style={{flex:1,display:"flex",gap:32,alignItems:"center",minHeight:0,padding:"24px 0"}}>
            {focused&&(
              <HeroPanel game={focused} onLaunch={handleLaunch} onFav={handleFav} onDelete={handleDelete} aiRec={aiRec} loadingRec={loadRec} onRec={handleRec} isLaunching={isLaunching}/>
            )}

            {/* Grid */}
            <div style={{width:340,flexShrink:0,height:"100%",display:"flex",flexDirection:"column",gap:10}}>
              <div style={{fontSize:9,letterSpacing:"2px",color:"var(--txt3)",fontFamily:"var(--font-mono)",textTransform:"uppercase",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <span>Library · {filtered.length} game{filtered.length!==1?"s":""}</span>
                <span style={{color:"var(--txt3)"}}>← → navigasi · Enter launch</span>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3, 1fr)",gap:8,overflowY:"auto",paddingRight:2,flex:1}}>
                {filtered.map((g,i)=>(
                  <GameCard key={g.id} game={g} idx={i} focused={focused?.id===g.id} onFocus={handleFocus} onLaunch={handleLaunch}/>
                ))}
                <div onClick={()=>{Snd.open();setShowAdd(true);}} style={{aspectRatio:"2/3",borderRadius:10,border:"1px dashed rgba(91,142,240,0.2)",background:"rgba(91,142,240,0.03)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8,cursor:"pointer",transition:"all 0.2s"}} onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(91,142,240,0.45)";e.currentTarget.style.background="rgba(91,142,240,0.08)";}} onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(91,142,240,0.2)";e.currentTarget.style.background="rgba(91,142,240,0.03)";}}>
                  <span style={{fontSize:22,color:"rgba(91,142,240,0.3)",lineHeight:1}}>+</span>
                  <span style={{fontSize:9,color:"rgba(91,142,240,0.3)",letterSpacing:"1px",textTransform:"uppercase",fontFamily:"var(--font-mono)"}}>Add</span>
                </div>
              </div>
            </div>
          </div>

          {/* BOTTOM BAR */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 0 18px",borderTop:"0.5px solid var(--border)",flexShrink:0}}>
            <div style={{display:"flex",gap:18}}>
              {[{b:"✕",c:"var(--accent)",l:"Launch"},{b:"○",c:"var(--red)",l:"Kembali"},{b:"□",c:"var(--txt2)",l:"Detail"},{b:"△",c:"var(--green)",l:"Favorit"}].map(h=>(
                <div key={h.b} style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:"var(--txt2)",fontFamily:"var(--font-ui)"}}>
                  <div style={{width:18,height:18,borderRadius:"50%",border:`1px solid ${h.c}50`,background:h.c+"14",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:h.c}}>{h.b}</div>
                  {h.l}
                </div>
              ))}
            </div>
            <div style={{display:"flex",gap:12,alignItems:"center"}}>
              {isConnected && (
                <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:'var(--green)', fontFamily:'var(--font-mono)' }}>
                  <div style={{ width:6, height:6, borderRadius:'50%', background:'var(--green)', animation:'pulse 2s infinite' }}/>
                  Controller
                </div>
              )}
              <div style={{display:"flex",gap:6,alignItems:"center"}}>
                <div style={{width:6,height:6,borderRadius:"50%",background:"var(--green)",boxShadow:"0 0 7px var(--green)",animation:"pulse 2.5s infinite"}}/>
                <span style={{fontSize:11,color:"var(--txt3)",fontFamily:"var(--font-mono)"}}>{games.length} games · SQLite backend</span>
              </div>
            </div>
          </div>
        </div>

        {launching&&<LaunchOverlay game={launching}/>}
        {showSearch&&<SearchOverlay games={games} onClose={()=>setShowSearch(false)} onSelect={g=>{handleFocus(g);}}/>}
        {showAdd&&<AddModal onClose={()=>setShowAdd(false)} onAdd={handleAdd} toast={addToast}/>}
        <Toast toasts={toasts}/>
      </div>
    </>
  );
}
