/**
 * Dashboard.jsx — v8 Final (Kashur Editor)
 * ✅ Recent filter actually works (last 7 days)
 * ✅ "LIVE" badge removed from stat cards
 * ✅ Chinar leaf SVG decoration in header & empty states
 * ✅ Smooth page-transition animation when switching filters
 * ✅ Export menu opens UPWARD (never clipped)
 * ✅ Storage replaced with rotating Editor Tips
 * ✅ All logic preserved
 */
import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { createPortal } from "react-dom"
import { useAuth } from "./auth-frontend/AuthContext"
import kashmiriData from "../components/kashmiriData"

// Local development works without configuration. For a deployed frontend set:
// VITE_API_URL=https://your-backend.example.com/api
const API_BASE = String(
  import.meta.env.VITE_API_URL || "http://localhost:3001/api"
).replace(/\/+$/, "")

// ─── TEMPLATES ───────────────────────────────────────────────────────────────
const TEMPLATES = [
  {
    id:"blank", emoji:"📄", name:"Blank Document",
    desc:"Start with a clean empty page",
    color:"#6b7280", title:"Untitled Document", html:"<p></p>",
  },
  {
    id:"letter", emoji:"✉️", name:"Formal Letter",
    desc:"Business letter with header & salutation",
    color:"#2b579a", title:"Formal Letter",
    html:`<div style="text-align:right;direction:rtl;font-family:'Noto Nastaliq Urdu',serif;line-height:2.2">
<p><strong>ناو:-</strong></p><p>جناب / محترمہ،</p>
<p>السلام علیکم۔ اُمید چھُ یِتھ تۄہہِ بخیر و عافیت چھِو۔</p>
<p>بہٕ چھُس تۄہہِ خِدمتس منٛز یہِ عرض کران:-</p>
<p>تۄہہِ ہُنٛد مخلص،</p><p>تٲریخ:-</p></div>`,
  },
  {
    id:"essay", emoji:"📝", name:"Essay / Article",
    desc:"Structured essay with intro & conclusion",
    color:"#1a7f4e", title:"Kashmiri Essay",
    html:`<div style="text-align:right;direction:rtl;font-family:'Noto Nastaliq Urdu',serif;line-height:2.2">
<h2 style="text-align:center"><strong>سُرخی:-</strong></h2>
<p><strong>پَہچان:-</strong></p><p>&nbsp;</p>
<p><strong>بنیادی خیال:</strong></p><p>&nbsp;</p>
<p><strong>حاصل:-</strong></p><p>&nbsp;</p></div>`,
  },
]

// ─── EDITOR TIPS ─────────────────────────────────────────────────────────────
const EDITOR_TIPS = [
  { icon:"⌨️", tip:"Use virtual keyboard for Kashmiri Nastaliq characters" },
  { icon:"📖", tip:"Search built-in and admin-added words in the Dictionary panel" },
  { icon:"🔊", tip:"Bolbosh TTS reads your Kashmiri text aloud" },
  { icon:"💾", tip:"Documents auto-save to MongoDB cloud" },
  { icon:"🌐", tip:"Share docs publicly as PDF — no login needed" },
  { icon:"📤", tip:"Export as PDF, DOCX, or TXT anytime" },
]

// ─── CHINAR LEAF SVG ─────────────────────────────────────────────────────────
// Stylised 5-lobe chinar (maple-like) leaf — symbol of Kashmir
function ChinaLeaf({ size = 32, color = "rgba(255,255,255,0.18)", style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" style={style}>
      {/* centre trunk */}
      <line x1="32" y1="58" x2="32" y2="28" stroke={color} strokeWidth="2.5" strokeLinecap="round"/>
      {/* main lobe — top */}
      <path d="M32 6 C26 10 20 18 24 24 C27 28 32 26 32 26 C32 26 37 28 40 24 C44 18 38 10 32 6Z" fill={color}/>
      {/* left lobe */}
      <path d="M14 16 C10 22 12 30 18 32 C22 33 26 28 26 28 C26 28 24 22 20 19 C18 17 14 16 14 16Z" fill={color}/>
      {/* right lobe */}
      <path d="M50 16 C54 22 52 30 46 32 C42 33 38 28 38 28 C38 28 40 22 44 19 C46 17 50 16 50 16Z" fill={color}/>
      {/* lower-left lobe */}
      <path d="M8 34 C6 40 10 46 16 46 C20 46 24 42 24 38 C24 38 20 34 16 34 C13 34 8 34 8 34Z" fill={color}/>
      {/* lower-right lobe */}
      <path d="M56 34 C58 40 54 46 48 46 C44 46 40 42 40 38 C40 38 44 34 48 34 C51 34 56 34 56 34Z" fill={color}/>
    </svg>
  )
}

// ─── PALETTE ─────────────────────────────────────────────────────────────────
const LIGHT = {
  blue:"#2b579a", blueDk:"#1e3a5f", blueLt:"#e8f0fa", blueMd:"#c9dff0",
  green:"#1a7f4e", greenLt:"#e6f5ee", greenBd:"#b8dfc8",
  red:"#b91c1c",  redLt:"#fee2e2",  redBd:"#fca5a5",
  gold:"#d97706", purple:"#7c3aed",
  s0:"#f1f3f6", s1:"#f9fafb", s2:"#ffffff",
  bd:"#e5e7eb", bdStr:"#d1d5db",
  t1:"#111827", t2:"#4b5563", tm:"#9ca3af",
  hdr:"linear-gradient(135deg,#1a2e4a 0%,#2b579a 55%,#3b6dbf 100%)",
}
const DARK = {
  blue:"#4a90d9", blueDk:"#1a2e4a", blueLt:"#1a2e4a", blueMd:"#1e3a5f",
  green:"#34d399", greenLt:"#052e16", greenBd:"#065f46",
  red:"#f87171",  redLt:"#3b1010",  redBd:"#7f1d1d",
  gold:"#fbbf24", purple:"#a78bfa",
  s0:"#0f1117", s1:"#1a1f2e", s2:"#1f2937",
  bd:"#374151", bdStr:"#4b5563",
  t1:"#f3f4f6", t2:"#d1d5db", tm:"#6b7280",
  hdr:"linear-gradient(135deg,#060d1a 0%,#0f1f40 55%,#1e3a5f 100%)",
}
const C = (dark) => dark ? DARK : LIGHT

// ─── ANIMATION CSS ────────────────────────────────────────────────────────────
const CSS = `
*{box-sizing:border-box}body{margin:0}

/* ── entrance animations ── */
@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}
@keyframes fadeLeft{from{opacity:0;transform:translateX(-24px)}to{opacity:1;transform:none}}
@keyframes dictIn{from{opacity:0;transform:translateX(28px)}to{opacity:1;transform:none}}
@keyframes scaleIn{from{opacity:0;transform:scale(.88) translateY(8px)}to{opacity:1;transform:scale(1)}}
@keyframes popIn{0%{opacity:0;transform:scale(.78)}60%{transform:scale(1.06)}100%{opacity:1;transform:scale(1)}}
@keyframes headerIn{from{opacity:0;transform:translateY(-14px)}to{opacity:1;transform:none}}
@keyframes toastIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
@keyframes tipSlide{from{opacity:0;transform:translateX(-12px)}to{opacity:1;transform:none}}

/* ── page switch: content fades up when filter changes ── */
@keyframes pageSwitch{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
.page-enter{animation:pageSwitch .28s cubic-bezier(.22,1,.36,1) both}

/* ── continuous ── */
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes leafSway{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(4deg)}}
@keyframes floatLeaf{0%,100%{transform:translateY(0) rotate(-3deg)}50%{transform:translateY(-8px) rotate(3deg)}}
@keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(43,87,154,.5)}60%{box-shadow:0 0 0 8px rgba(43,87,154,0)}}

/* ── class-based animations ── */
.anim-header{animation:headerIn .4s cubic-bezier(.22,1,.36,1) both}
.anim-sidebar{animation:fadeLeft .42s cubic-bezier(.22,1,.36,1) .06s both}
.anim-main{animation:fadeUp .45s cubic-bezier(.22,1,.36,1) .1s both}
.anim-dict{animation:dictIn .3s cubic-bezier(.22,1,.36,1) both}
.anim-modal{animation:scaleIn .24s cubic-bezier(.22,1,.36,1) both}
.anim-toast{animation:toastIn .22s ease both}
.leaf-sway{animation:leafSway 4s ease-in-out infinite}
.leaf-float{animation:floatLeaf 5s ease-in-out infinite}

/* ── interactive states ── */
.stat-card{transition:box-shadow .22s,transform .22s}
.stat-card:hover{transform:translateY(-4px)!important;box-shadow:0 10px 32px rgba(0,0,0,.14)!important}

.doc-card{transition:border-color .2s,box-shadow .22s,transform .22s}
.doc-card:hover{transform:translateY(-4px)!important;box-shadow:0 10px 32px rgba(43,87,154,.18)!important;border-color:#2b579a!important}
.doc-card:hover .doc-card-top{background:var(--chover)!important}

.list-row{transition:background .12s,padding-left .16s}
.list-row:hover{padding-left:26px!important;background:var(--lhover)!important}

.nav-item,.tmpl-item{transition:background .13s,transform .13s,color .13s;cursor:pointer;border-radius:8px}
.nav-item:hover,.tmpl-item:hover{transform:translateX(5px)}

.new-doc-btn{transition:background .15s,transform .14s,box-shadow .15s}
.new-doc-btn:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(43,87,154,.45)}

.hdr-btn{transition:background .13s,transform .13s}
.hdr-btn:hover{transform:translateY(-1px);background:rgba(255,255,255,.2)!important}

.action-btn{transition:background .12s,color .12s,border-color .12s,transform .12s}
.action-btn:hover:not(:disabled){transform:translateY(-1px)}

.sort-tab{transition:background .12s,color .12s}
.view-btn{transition:background .15s,color .15s}
.refresh-btn{transition:transform .3s ease}
.refresh-btn:hover{transform:rotate(210deg)}

.sidebar-section-body{animation:pageSwitch .2s cubic-bezier(.22,1,.36,1) both}
.section-chevron{transition:transform .2s ease}
.section-chevron.open{transform:rotate(180deg)}
.documents-scroll{scrollbar-gutter:stable;overscroll-behavior:contain}

@media(max-width:1180px){
  .dashboard-stats{grid-template-columns:repeat(2,minmax(0,1fr))!important}
  .dashboard-sidebar{width:196px!important}
  .dictionary-sidebar{width:280px!important}
}
@media(max-width:900px){
  .dashboard-sidebar{width:180px!important}
  .dictionary-sidebar{width:250px!important}
}

.export-item{transition:background .1s,padding-left .1s}
.export-item:hover{padding-left:20px!important;background:var(--ehover)!important}

input:focus,textarea:focus{outline:2px solid #2b579a;outline-offset:-1px}
`

// ─── API ─────────────────────────────────────────────────────────────────────
function apiFetch(path, opts={}, token=null) {
  const headers = { "Content-Type":"application/json", ...(token?{Authorization:`Bearer ${token}`}:{}), ...opts.headers }
  return fetch(`${API_BASE}${path}`,{...opts,headers}).then(async res=>{
    if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(e.error||`HTTP ${res.status}`)}
    return res.json()
  })
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function fmtDate(iso) {
  if(!iso) return ""
  const d=new Date(iso), now=new Date(), diff=(now-d)/1000
  if(diff<60)     return "just now"
  if(diff<3600)   return `${Math.floor(diff/60)}m ago`
  if(diff<86400)  return `${Math.floor(diff/3600)}h ago`
  if(diff<604800) return `${Math.floor(diff/86400)}d ago`
  return d.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})
}
function fmtW(n){ if(!n) return "0"; return n>=1000?`${(n/1000).toFixed(1)}k`:`${n}` }
function sumWords(docs){ return docs.reduce((s,d)=>s+(d.wordCount||0),0) }
const DAY_MS=24*60*60*1000
function validDate(value){const d=new Date(value);return Number.isNaN(d.getTime())?null:d}
function isRecent(doc){const d=validDate(doc.updatedAt);return !!d&&(Date.now()-d.getTime())<=7*DAY_MS}
function normalizeDocument(doc={}){
  const id=doc.id||doc._id
  return {
    ...doc,id,
    title:String(doc.title||"Untitled Document"),
    wordCount:Number(doc.wordCount)||0,
    pageCount:Math.max(1,Number(doc.pageCount)||1),
    isPublic:Boolean(doc.isPublic),
    createdAt:doc.createdAt||doc.updatedAt||new Date().toISOString(),
    updatedAt:doc.updatedAt||doc.createdAt||new Date().toISOString(),
  }
}
function extractDocuments(payload){
  const rows=Array.isArray(payload)?payload:(payload?.documents||payload?.data||payload?.items||[])
  return Array.isArray(rows)?rows.filter(Boolean).map(normalizeDocument):[]
}
function safeFileName(name="Document"){
  return String(name).replace(/[<>:"/\\|?*\u0000-\u001F]/g,"-").replace(/\s+/g," ").trim()||"Document"
}
function downloadNameFromHeaders(res,fallback){
  const disposition=res.headers.get("content-disposition")||""
  const utf8=disposition.match(/filename\*=UTF-8''([^;]+)/i)
  if(utf8){
    try{return safeFileName(decodeURIComponent(utf8[1].trim()))}catch{/* use fallback */}
  }
  const plain=disposition.match(/filename="?([^";]+)"?/i)
  return plain?.[1]?safeFileName(plain[1].trim()):fallback
}
function absoluteShareUrl(value){
  if(!value)return null
  try{return new URL(value,window.location.origin).href}catch{return value}
}
function escapeHtml(value=""){
  return String(value).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[ch]))
}

// ─── TOAST ───────────────────────────────────────────────────────────────────
function Toast({msg, type="success"}) {
  return (
    <div className="anim-toast" style={{
      position:"fixed", bottom:28, right:28, zIndex:99999,
      background:type==="error"?"#b91c1c":"#1a7f4e",
      color:"#fff", padding:"12px 20px", borderRadius:12,
      fontSize:13, fontWeight:500, maxWidth:340,
      display:"flex", alignItems:"center", gap:10,
      boxShadow:"0 6px 28px rgba(0,0,0,.28)",
    }}>
      <span style={{fontSize:17}}>{type==="error"?"⚠️":"✅"}</span>
      {msg}
    </div>
  )
}

// ─── BADGE ───────────────────────────────────────────────────────────────────
function Badge({children, variant="blue", c}) {
  const map={
    blue:{bg:c.blueLt,color:c.blueDk,border:c.blueMd},
    green:{bg:c.greenLt,color:c.green,border:c.greenBd},
    gray:{bg:c.s0,color:c.tm,border:c.bd},
    amber:{bg:"#fffbeb",color:"#92400e",border:"#fde68a"},
  }
  const s=map[variant]||map.gray
  return <span style={{fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:10,background:s.bg,color:s.color,border:`0.5px solid ${s.border}`}}>{children}</span>
}

// ─── ACTION BUTTON ────────────────────────────────────────────────────────────
function Btn({children,onClick,variant="ghost",c,disabled=false,sx={}}) {
  const [hov,setHov]=useState(false)
  const v={
    primary:{bg:hov?c.blueDk:c.blue,col:"#fff",bd:"none"},
    ghost:{bg:hov?c.s1:"transparent",col:c.t2,bd:`0.5px solid ${c.bdStr}`},
    danger:{bg:hov?c.redLt:"transparent",col:c.red,bd:`0.5px solid ${hov?c.redBd:c.bdStr}`},
    green:{bg:c.greenLt,col:c.green,bd:`0.5px solid ${c.greenBd}`},
  }[variant]||{}
  return (
    <button disabled={disabled} onClick={onClick} className="action-btn"
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{padding:"4px 10px",fontSize:11.5,fontWeight:variant==="primary"?600:400,border:v.bd,borderRadius:6,background:v.bg,color:v.col,cursor:disabled?"not-allowed":"pointer",opacity:disabled?.5:1,display:"inline-flex",alignItems:"center",gap:4,fontFamily:"inherit",whiteSpace:"nowrap",...sx}}>
      {children}
    </button>
  )
}

// ─── EXPORT MENU — opens UPWARD ───────────────────────────────────────────────
function ExportMenu({doc,onPrintPdf,token,c,onStatus}) {
  const [open,setOpen]=useState(false)
  const [menuPos,setMenuPos]=useState({left:0,top:0})
  const wrapRef=useRef(null)
  const menuRef=useRef(null)

  useEffect(()=>{
    const fn=e=>{
      if(
        open &&
        !wrapRef.current?.contains(e.target) &&
        !menuRef.current?.contains(e.target)
      ) setOpen(false)
    }
    document.addEventListener("mousedown",fn)
    return()=>document.removeEventListener("mousedown",fn)
  },[open])

  useEffect(()=>{
    if(!open)return
    const close=()=>setOpen(false)
    window.addEventListener("resize",close)
    window.addEventListener("scroll",close,true)
    return()=>{window.removeEventListener("resize",close);window.removeEventListener("scroll",close,true)}
  },[open])

  function toggleMenu(e){
    e.stopPropagation()
    if(open){setOpen(false);return}
    const rect=e.currentTarget.getBoundingClientRect()
    const width=210
    const menuHeight=154
    const gap=7
    const openUp=window.innerHeight-rect.bottom<menuHeight+gap && rect.top>menuHeight+gap
    setMenuPos({
      left:Math.max(10,Math.min(rect.left,window.innerWidth-width-10)),
      top:openUp?Math.max(10,rect.top-menuHeight-gap):Math.min(window.innerHeight-menuHeight-10,rect.bottom+gap),
    })
    setOpen(true)
  }

  async function dlFile(path,filename) {
    setOpen(false)
    try {
      if(!token)throw new Error("Please sign in again before exporting")
      const res=await fetch(`${API_BASE}${path}`,{
        method:"GET",
        headers:{Authorization:`Bearer ${token}`,Accept:"*/*"},
        cache:"no-store",
      })
      const contentType=(res.headers.get("content-type")||"").toLowerCase()
      if(!res.ok){
        let message=`Export failed (HTTP ${res.status})`
        if(contentType.includes("application/json")){
          const data=await res.json().catch(()=>null)
          if(data?.error)message=data.error
        }else{
          const text=await res.text().catch(()=>"")
          if(text.trim())message=text.trim().slice(0,220)
        }
        if(res.status===401||res.status===403)message+=" — please sign in again"
        throw new Error(message)
      }
      if(contentType.includes("text/html")||contentType.includes("application/json")){
        throw new Error("Backend returned a web page instead of an export file. Check VITE_API_URL and restart the frontend.")
      }
      const blob=await res.blob()
      if(!blob.size)throw new Error("The exported file is empty")
      const url=URL.createObjectURL(blob)
      const finalName=downloadNameFromHeaders(res,filename)
      const a=document.createElement("a")
      a.href=url
      a.download=finalName
      a.style.display="none"
      document.body.appendChild(a)
      a.click()
      setTimeout(()=>{a.remove();URL.revokeObjectURL(url)},3000)
      onStatus?.(`${finalName} downloaded`)
    } catch(e){
      if(onStatus)onStatus("Download failed: "+e.message,"error")
      else alert("Download failed: "+e.message)
    }
  }

  const baseName=safeFileName(doc.title)
  const items=[
    {label:"PDF Document",  ext:".pdf",  icon:"📄",fn:()=>{setOpen(false);onPrintPdf(doc)}},
    {label:"Word Document", ext:".docx", icon:"📝",fn:()=>dlFile(`/documents/${doc.id}/export/docx`,`${baseName}.docx`)},
    {label:"Text Document", ext:".txt",  icon:"📃",fn:()=>dlFile(`/documents/${doc.id}/export/txt`,`${baseName}.txt`)},
  ]

  return (
    <div ref={wrapRef} style={{position:"relative",display:"inline-block"}}>
      <button type="button" onClick={toggleMenu} className="action-btn" aria-expanded={open}
        style={{padding:"4px 10px",fontSize:11.5,border:`0.5px solid ${open?c.blue:c.bdStr}`,borderRadius:6,background:open?c.blueLt:"transparent",color:open?c.blue:c.t2,cursor:"pointer",fontFamily:"inherit"}}>
        Export ▾
      </button>
      {open&&createPortal(
        <div ref={menuRef} role="menu" aria-label="Export document" style={{
          position:"fixed",
          left:menuPos.left,top:menuPos.top,width:210,
          background:c.s2, border:`0.5px solid ${c.bd}`,
          borderRadius:10,
          boxShadow:"0 10px 30px rgba(0,0,0,.2)",
          zIndex:100000, padding:"4px 0",
          animation:"scaleIn .18s cubic-bezier(.22,1,.36,1) both",
          transformOrigin:"bottom left",
        }}>
          <style>{`:root{--ehover:${c.s1}}`}</style>
          <div style={{fontSize:10,fontWeight:700,color:c.tm,textTransform:"uppercase",letterSpacing:".5px",padding:"7px 14px 4px"}}>Export document</div>
          {items.map(it=>(
            <button type="button" role="menuitem" key={it.label} onClick={it.fn} className="export-item"
              style={{display:"flex",alignItems:"center",gap:10,width:"100%",textAlign:"left",padding:"9px 14px",border:"none",background:"none",cursor:"pointer",fontSize:13,color:c.t1,fontFamily:"inherit"}}>
              <span style={{fontSize:16}}>{it.icon}</span>
              <span style={{flex:1}}>{it.label}</span>
              <span style={{fontSize:11,color:c.tm}}>{it.ext}</span>
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}

// ─── SHARE MODAL ─────────────────────────────────────────────────────────────
function ShareModal({doc,token,onClose,onUpdated,dark=false}) {
  const c=C(dark)
  const [isPublic,setIsPublic]=useState(doc.isPublic||false)
  const [shareUrl,setShareUrl]=useState(absoluteShareUrl(doc.shareUrl))
  const [loading,setLoading]=useState(false)
  const [copied,setCopied]=useState(false)
  const [error,setError]=useState("")

  async function toggle(val){
    setLoading(true);setError("")
    try{
      const res=await fetch(`${API_BASE}/documents/${doc.id}/share`,{method:"PATCH",headers:{"Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify({isPublic:val})})
      const data=await res.json()
      if(!res.ok)throw new Error(data.error||"Failed")
      const payload=data.document||data
      const nextPublic=payload.isPublic??val
      const nextUrl=nextPublic?absoluteShareUrl(payload.shareUrl||data.shareUrl):null
      setIsPublic(nextPublic);setShareUrl(nextUrl)
      onUpdated?.({...doc,...payload,isPublic:nextPublic,shareUrl:nextUrl})
      if(nextPublic&&!nextUrl)setError("Sharing is enabled, but the server did not return a public link.")
    }catch(e){setError(e.message||"Unable to update sharing")}
    setLoading(false)
  }

  async function copy(){
    if(!shareUrl)return
    setError("")
    try{
      if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(shareUrl)
      else{
        const area=document.createElement("textarea")
        area.value=shareUrl;area.style.position="fixed";area.style.opacity="0"
        document.body.appendChild(area);area.select()
        if(!document.execCommand("copy"))throw new Error("Copy is not supported")
        document.body.removeChild(area)
      }
      setCopied(true);setTimeout(()=>setCopied(false),2500)
    }catch(e){setError("Could not copy automatically. Select the link and copy it manually.")}
  }
  const wa=shareUrl?`https://wa.me/?text=${encodeURIComponent(`📄 ${doc.title} — ${shareUrl}`)}`:"#"
  const tg=shareUrl?`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(doc.title)}`:"#"
  const em=shareUrl?`mailto:?subject=${encodeURIComponent(doc.title)}&body=${encodeURIComponent(`${doc.title}\n${shareUrl}`)}`:"#"

  return (
    <div onClick={e=>{if(e.target===e.currentTarget)onClose()}} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.52)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:99999,padding:16}}>
      <div className="anim-modal" style={{background:c.s2,borderRadius:14,width:"100%",maxWidth:440,border:`1px solid ${c.bd}`,boxShadow:"0 24px 64px rgba(0,0,0,.24)",overflow:"hidden"}}>
        <div style={{background:c.blue,color:"#fff",padding:"16px 20px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div><div style={{fontWeight:700,fontSize:15}}>🔗 Share document</div><div style={{fontSize:11.5,opacity:.75,marginTop:2}}>{doc.title}</div></div>
          <button onClick={onClose} style={{background:"rgba(255,255,255,.18)",border:"none",color:"#fff",borderRadius:6,width:28,height:28,fontSize:17,cursor:"pointer"}}>×</button>
        </div>
        <div style={{padding:20}}>
          <div style={{fontSize:12,fontWeight:600,color:c.t2,marginBottom:10}}>Visibility</div>
          <div style={{display:"flex",gap:10,marginBottom:18}}>
            {[{pub:false,icon:"🔒",label:"Private",sub:"Only you can view"},{pub:true,icon:"🌐",label:"Public link",sub:"Anyone with link"}].map(opt=>(
              <button type="button" key={String(opt.pub)} onClick={()=>opt.pub!==isPublic&&toggle(opt.pub)} disabled={loading}
                style={{flex:1,padding:"12px 8px",borderRadius:10,border:`1.5px solid ${opt.pub===isPublic?c.blue:c.bd}`,background:opt.pub===isPublic?c.blueLt:c.s1,cursor:loading?"wait":"pointer",textAlign:"center",transition:"all .15s"}}>
                <div style={{fontSize:22,marginBottom:4}}>{opt.icon}</div>
                <div style={{fontSize:12.5,fontWeight:600,color:opt.pub===isPublic?c.blue:c.t1}}>{opt.label}</div>
                <div style={{fontSize:11,color:c.tm,marginTop:2}}>{opt.sub}</div>
              </button>
            ))}
          </div>
          {error&&<div style={{marginBottom:14,padding:"9px 11px",background:c.redLt,border:`1px solid ${c.redBd}`,borderRadius:8,color:c.red,fontSize:11.5,lineHeight:1.45}}>⚠️ {error}</div>}
          {isPublic&&shareUrl&&(
            <>
              <div style={{display:"flex",gap:8,marginBottom:14}}>
                <input readOnly value={shareUrl} onFocus={e=>e.target.select()} style={{flex:1,padding:"7px 10px",border:`0.5px solid ${c.bd}`,borderRadius:6,fontSize:11.5,color:c.t2,fontFamily:"monospace",background:c.s1,outline:"none"}}/>
                <button type="button" onClick={copy} style={{padding:"7px 14px",border:"none",borderRadius:7,background:copied?c.green:c.blue,color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer",minWidth:82,transition:"background .2s"}}>{copied?"✅ Copied":"📋 Copy"}</button>
              </div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {[{label:"WhatsApp",href:wa,bg:"#e8f5e9",col:"#1a7f4e",bdr:"#c8e6c9",icon:"💬"},{label:"Telegram",href:tg,bg:"#e3f2fd",col:"#0277bd",bdr:"#bbdefb",icon:"✈️"},{label:"Email",href:em,bg:"#fff3e0",col:"#e65100",bdr:"#ffe0b2",icon:"📧"}].map(s=>(
                  <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" style={{display:"inline-flex",alignItems:"center",gap:5,padding:"6px 12px",borderRadius:7,background:s.bg,color:s.col,border:`1px solid ${s.bdr}`,fontSize:12,fontWeight:500,textDecoration:"none"}}>{s.icon} {s.label}</a>
                ))}
              </div>
              <div style={{marginTop:14,padding:"9px 12px",background:"#fffbe6",border:"1px solid #ffe58f",borderRadius:7,fontSize:11.5,color:"#92400e"}}>ℹ️ Anyone with this link can view as <strong>PDF only</strong>. Make private to revoke.</div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── PROFILE MODAL ────────────────────────────────────────────────────────────
function ProfileModal({user,token,onClose,onUpdated,dark=false}) {
  const c=C(dark)
  const [name,setName]=useState(user?.name||"")
  const [phone,setPhone]=useState(user?.phone||"")
  const [pw,setPw]=useState("");const [pwNew,setPwNew]=useState("");const [pwConf,setPwConf]=useState("")
  const [tab,setTab]=useState("profile")
  const [saving,setSaving]=useState(false)
  const [msg,setMsg]=useState(null)
  const [err,setErr]=useState({})
  const inp={width:"100%",padding:"9px 11px",border:`0.5px solid ${c.bd}`,borderRadius:7,fontSize:13,color:c.t1,background:c.s1,outline:"none",boxSizing:"border-box",fontFamily:"inherit"}

  async function saveProfile(){
    const e={};if(!name.trim()||name.trim().length<2)e.name="Name must be at least 2 characters"
    setErr(e);if(Object.keys(e).length)return
    setSaving(true);setMsg(null)
    try{
      const res=await fetch(`${API_BASE}/auth/me`,{method:"PUT",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({name:name.trim(),phone:phone.trim()})})
      const data=await res.json();if(!res.ok)throw new Error(data.error||"Update failed")
      onUpdated(data.user);setMsg({type:"success",text:"Profile updated!"})
    }catch(e){setMsg({type:"error",text:e.message})}
    setSaving(false)
  }

  async function changePassword(){
    const e={};if(!pw)e.pw="Current password required"
    if(!pwNew||pwNew.length<8)e.pwNew="Min 8 characters"
    else if(!/[A-Z]/.test(pwNew))e.pwNew="Needs an uppercase letter"
    else if(!/[0-9]/.test(pwNew))e.pwNew="Needs a number"
    if(pwNew&&pwConf&&pwNew!==pwConf)e.pwConf="Passwords don't match"
    if(!pwConf)e.pwConf="Confirm your new password"
    setErr(e);if(Object.keys(e).length)return
    setSaving(true);setMsg(null)
    try{
      const res=await fetch(`${API_BASE}/auth/change-password`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({currentPassword:pw,newPassword:pwNew,confirmPassword:pwConf})})
      const data=await res.json();if(!res.ok)throw new Error(data.error||"Failed")
      setMsg({type:"success",text:"Password changed!"});setPw("");setPwNew("");setPwConf("")
    }catch(e){setMsg({type:"error",text:e.message})}
    setSaving(false)
  }

  return (
    <div onClick={e=>{if(e.target===e.currentTarget)onClose()}} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.52)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:99999,padding:16}}>
      <div className="anim-modal" style={{background:c.s2,borderRadius:16,width:"100%",maxWidth:440,border:`1px solid ${c.bd}`,boxShadow:"0 24px 64px rgba(0,0,0,.24)",overflow:"hidden"}}>
        <div style={{background:c.blue,color:"#fff",padding:"16px 20px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:44,height:44,borderRadius:"50%",background:"rgba(255,255,255,.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:19,fontWeight:700}}>{user?.name?.charAt(0)?.toUpperCase()||"U"}</div>
            <div><div style={{fontWeight:700,fontSize:15}}>{user?.name}</div><div style={{fontSize:11.5,opacity:.7}}>{user?.email}</div></div>
          </div>
          <button onClick={onClose} style={{background:"rgba(255,255,255,.18)",border:"none",color:"#fff",borderRadius:6,width:28,height:28,cursor:"pointer",fontSize:17}}>×</button>
        </div>
        <div style={{display:"flex",borderBottom:`0.5px solid ${c.bd}`}}>
          {[["profile","👤 Profile"],["password","🔒 Password"]].map(([t,l])=>(
            <button key={t} onClick={()=>{setTab(t);setMsg(null);setErr({})}} style={{flex:1,padding:"11px",border:"none",borderBottom:`2px solid ${tab===t?c.blue:"transparent"}`,background:"none",fontSize:12.5,fontWeight:tab===t?600:400,color:tab===t?c.blue:c.t2,cursor:"pointer",transition:"all .15s",fontFamily:"inherit"}}>{l}</button>
          ))}
        </div>
        <div style={{padding:"20px 22px"}}>
          {msg&&<div style={{background:msg.type==="success"?c.greenLt:c.redLt,border:`0.5px solid ${msg.type==="success"?c.greenBd:c.redBd}`,borderRadius:7,padding:"9px 13px",marginBottom:14,fontSize:12.5,color:msg.type==="success"?c.green:c.red}}>{msg.type==="success"?"✅":"⚠️"} {msg.text}</div>}
          {tab==="profile"?(
            <>
              {[["Full Name",name,setName,"name","Your full name"],["Phone (optional)",phone,setPhone,"phone","+91 …"]].map(([label,val,setter,k,ph])=>(
                <div key={k} style={{marginBottom:14}}>
                  <label style={{display:"block",fontSize:12,fontWeight:500,color:c.t2,marginBottom:5}}>{label}</label>
                  <input value={val} onChange={e=>setter(e.target.value)} placeholder={ph} style={{...inp,borderColor:err[k]?c.red:c.bd}}/>
                  {err[k]&&<span style={{fontSize:11,color:c.red}}>{err[k]}</span>}
                </div>
              ))}
              <div style={{marginBottom:20}}>
                <label style={{display:"block",fontSize:12,fontWeight:500,color:c.t2,marginBottom:5}}>Email <span style={{fontWeight:400,color:c.tm}}>(cannot be changed)</span></label>
                <input value={user?.email||""} disabled style={{...inp,background:c.s0,color:c.tm,cursor:"not-allowed"}}/>
              </div>
              <button onClick={saveProfile} disabled={saving} className="action-btn" style={{width:"100%",padding:"10px",background:saving?c.tm:c.blue,color:"#fff",border:"none",borderRadius:8,fontSize:13.5,fontWeight:600,cursor:saving?"wait":"pointer",fontFamily:"inherit"}}>{saving?"Saving…":"💾 Save profile"}</button>
            </>
          ):(
            <>
              {[["Current password",pw,setPw,"pw","Current password"],["New password",pwNew,setPwNew,"pwNew","Min 8 chars, 1 uppercase, 1 number"],["Confirm new password",pwConf,setPwConf,"pwConf","Re-enter new password"]].map(([label,val,setter,k,ph])=>(
                <div key={k} style={{marginBottom:14}}>
                  <label style={{display:"block",fontSize:12,fontWeight:500,color:c.t2,marginBottom:5}}>{label}</label>
                  <input type="password" value={val} onChange={e=>setter(e.target.value)} placeholder={ph} style={{...inp,borderColor:err[k]?c.red:c.bd}}/>
                  {err[k]&&<span style={{fontSize:11,color:c.red}}>{err[k]}</span>}
                </div>
              ))}
              <button onClick={changePassword} disabled={saving} className="action-btn" style={{width:"100%",padding:"10px",background:saving?c.tm:c.blue,color:"#fff",border:"none",borderRadius:8,fontSize:13.5,fontWeight:600,cursor:saving?"wait":"pointer",marginTop:4,fontFamily:"inherit"}}>{saving?"Saving…":"🔒 Change password"}</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── FEEDBACK MODAL ───────────────────────────────────────────────────────────
function FeedbackModal({user,token,onClose,dark=false}) {
  const c=C(dark)
  const [form,setForm]=useState({type:"feedback",subject:"",message:""})
  const [status,setStatus]=useState("idle")
  const [errMsg,setErrMsg]=useState("")
  const set=f=>v=>setForm(p=>({...p,[f]:v}))
  const inp={width:"100%",padding:"9px 11px",border:`0.5px solid ${c.bd}`,borderRadius:7,fontSize:13,fontFamily:"inherit",color:c.t1,background:c.s1,outline:"none",boxSizing:"border-box"}

  async function send(){
    if(!form.subject.trim()){setErrMsg("Please enter a subject.");return}
    if(form.message.trim().length<10){setErrMsg("Message must be at least 10 characters.");return}
    setErrMsg("");setStatus("sending")
    try{
      const res=await fetch(`${API_BASE}/contact`,{method:"POST",headers:{"Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify({fromName:user?.name,fromEmail:user?.email,...form})})
      if(res.ok)setStatus("sent")
      else{const d=await res.json().catch(()=>({}));throw new Error(d.error||`Could not send feedback (HTTP ${res.status})`)}
    }catch(e){setStatus("error");setErrMsg(e.message)}
  }

  const types=[{v:"feedback",l:"💬 Feedback",col:c.blue},{v:"bug",l:"🐛 Bug",col:c.red},{v:"feature",l:"💡 Feature",col:c.gold},{v:"other",l:"📧 Other",col:c.tm}]

  return (
    <div onClick={e=>{if(e.target===e.currentTarget)onClose()}} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.52)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:99999,padding:16}}>
      <div className="anim-modal" style={{background:c.s2,borderRadius:14,width:"100%",maxWidth:460,border:`1px solid ${c.bd}`,boxShadow:"0 24px 64px rgba(0,0,0,.24)",overflow:"hidden"}}>
        <div style={{background:c.blue,color:"#fff",padding:"16px 20px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div><div style={{fontWeight:700,fontSize:15}}>📬 Feedback & contact</div><div style={{fontSize:11.5,opacity:.75,marginTop:2}}>Send a message to the developer</div></div>
          <button onClick={onClose} style={{background:"rgba(255,255,255,.18)",border:"none",color:"#fff",borderRadius:6,width:28,height:28,cursor:"pointer",fontSize:17}}>×</button>
        </div>
        <div style={{padding:22}}>
          {status==="sent"?(
            <div style={{textAlign:"center",padding:"26px 0"}}>
              <div style={{fontSize:48,marginBottom:12}}>✅</div>
              <h3 style={{fontSize:18,fontWeight:700,color:c.t1,marginBottom:8}}>Message sent!</h3>
              <p style={{fontSize:13.5,color:c.t2,lineHeight:1.6,marginBottom:20}}>Thank you <strong>{user?.name}</strong>! We'll reply to <strong>{user?.email}</strong> within 48 hours.</p>
              <button onClick={onClose} style={{background:c.blue,color:"#fff",border:"none",padding:"9px 24px",borderRadius:8,fontSize:13,cursor:"pointer",fontWeight:500,fontFamily:"inherit"}}>Close</button>
            </div>
          ):(
            <>
              <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:14}}>
                {types.map(t=><button key={t.v} onClick={()=>set("type")(t.v)} style={{padding:"5px 12px",borderRadius:16,border:`1.5px solid ${form.type===t.v?t.col:c.bd}`,background:form.type===t.v?t.col+"18":c.s1,color:form.type===t.v?t.col:c.t2,fontSize:12,fontWeight:500,cursor:"pointer",transition:"all .15s",fontFamily:"inherit"}}>{t.l}</button>)}
              </div>
              <div style={{marginBottom:13}}>
                <label style={{display:"block",fontSize:12,fontWeight:500,color:c.t2,marginBottom:5}}>Subject</label>
                <input value={form.subject} onChange={e=>set("subject")(e.target.value)} placeholder="Brief summary…" style={inp}/>
              </div>
              <div style={{marginBottom:16}}>
                <label style={{display:"block",fontSize:12,fontWeight:500,color:c.t2,marginBottom:5}}>Message <span style={{fontWeight:400,color:c.tm}}>{form.message.length} chars</span></label>
                <textarea value={form.message} onChange={e=>set("message")(e.target.value)} placeholder="Describe your feedback in detail…" rows={4} style={{...inp,resize:"vertical",minHeight:100}}/>
              </div>
              {errMsg&&<div style={{background:c.redLt,border:`0.5px solid ${c.redBd}`,borderRadius:6,padding:"8px 12px",marginBottom:12,fontSize:12.5,color:c.red}}>⚠️ {errMsg}</div>}
              <button onClick={send} disabled={status==="sending"} className="action-btn" style={{width:"100%",padding:"11px",background:status==="sending"?c.tm:c.blue,color:"#fff",border:"none",borderRadius:8,fontSize:13.5,fontWeight:600,cursor:status==="sending"?"wait":"pointer",fontFamily:"inherit"}}>{status==="sending"?"Sending…":"📤 Send to developer"}</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── TEMPLATE PICKER MODAL ────────────────────────────────────────────────────
function TemplatePickerModal({dark,onSelect,onClose}) {
  const c=C(dark)
  const [hov,setHov]=useState(null)
  // ADMIN PANEL ADDITION — templates added in Template Management now show
  // up here too, alongside the built-in Blank/Letter/Essay cards.
  // (Cover Page category is excluded — those are for inserting a cover page
  // into an existing document via the editor's Insert menu, not for
  // starting a brand-new document from scratch.)
  const [adminTemplates,setAdminTemplates]=useState([])
  useEffect(()=>{
    fetch(`${API_BASE}/public/templates`).then(r=>r.json()).then(d=>{
      const rows=Array.isArray(d)?d:(d.templates||d.data||[])
      const mapped=(Array.isArray(rows)?rows:[])
        .filter(t=>t.category!=="cover-page")
        .map(t=>({
          id:"admin_"+t._id, emoji:"🗂️", name:t.title,
          desc:t.description||"Added from the admin panel",
          color:"#6366f1", title:t.title, html:t.html,
        }))
      setAdminTemplates(mapped)
    }).catch(()=>{})
  },[])
  const allTemplates=[...TEMPLATES,...adminTemplates]
  return (
    <div onClick={e=>{if(e.target===e.currentTarget)onClose()}} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.54)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:99999,padding:16}}>
      <div className="anim-modal" style={{background:c.s2,borderRadius:18,width:"100%",maxWidth:580,maxHeight:"85vh",overflowY:"auto",border:`1px solid ${c.bd}`,boxShadow:"0 32px 80px rgba(0,0,0,.3)"}}>
        <div style={{background:c.hdr,color:"#fff",padding:"20px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:1}}>
          <div><div style={{fontWeight:700,fontSize:17}}>📋 Choose a template</div><div style={{fontSize:12,opacity:.7,marginTop:2}}>Select a starting point for your new Kashmiri document</div></div>
          <button onClick={onClose} style={{background:"rgba(255,255,255,.18)",border:"none",color:"#fff",width:30,height:30,borderRadius:8,cursor:"pointer",fontSize:17}}>×</button>
        </div>
        <div style={{padding:24,display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
          {allTemplates.map((t,i)=>(
            <div key={t.id} onClick={()=>onSelect(t)} onMouseEnter={()=>setHov(t.id)} onMouseLeave={()=>setHov(null)}
              style={{border:`2px solid ${hov===t.id?t.color:c.bd}`,borderRadius:14,padding:22,cursor:"pointer",background:hov===t.id?(dark?"#1a2e4a":"#f0f6ff"):c.s1,transition:"all .18s",textAlign:"center",transform:hov===t.id?"translateY(-4px) scale(1.02)":"none",boxShadow:hov===t.id?`0 8px 28px ${t.color}28`:"none",animation:`popIn .32s ${i*0.08}s both`}}>
              <div style={{fontSize:36,marginBottom:11}}>{t.emoji}</div>
              <div style={{fontWeight:700,fontSize:14,color:hov===t.id?t.color:c.t1,marginBottom:5}}>{t.name}</div>
              <div style={{fontSize:11.5,color:c.tm,lineHeight:1.5}}>{t.desc}</div>
            </div>
          ))}
        </div>
        <div style={{padding:"0 24px 20px",textAlign:"center",fontSize:11.5,color:c.tm}}>You can rename and edit the document after creation.</div>
      </div>
    </div>
  )
}

// ─── SPINNER ─────────────────────────────────────────────────────────────────
function Spinner({c}) {
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:72,gap:16}}>
      <div style={{position:"relative",width:48,height:48}}>
        <div style={{width:48,height:48,border:`3px solid ${c.bd}`,borderTopColor:c.blue,borderRadius:"50%",animation:"spin .7s linear infinite"}}/>
        <div style={{position:"absolute",inset:8,border:`2px solid ${c.bd}`,borderBottomColor:c.gold,borderRadius:"50%",animation:"spin .5s linear infinite reverse"}}/>
      </div>
      <span style={{fontSize:13,color:c.tm,fontStyle:"italic"}}>Loading your documents…</span>
    </div>
  )
}

// ─── STAT CARD — no LIVE badge ────────────────────────────────────────────────
function StatCard({label,value,icon,accent,c,delay=0}) {
  return (
    <div className="stat-card" style={{background:c.s2,borderRadius:14,padding:"18px 18px 16px",border:`0.5px solid ${c.bd}`,borderTop:`3px solid ${accent}`,animation:`popIn .4s ${delay}s both`,overflow:"hidden",position:"relative"}}>
      <div style={{position:"absolute",top:-16,right:-16,width:72,height:72,borderRadius:"50%",background:accent+"0f",pointerEvents:"none"}}/>
      <div style={{width:36,height:36,borderRadius:10,background:accent+"18",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,marginBottom:12}}>{icon}</div>
      <div style={{fontSize:28,fontWeight:700,color:accent,lineHeight:1,marginBottom:5}}>{value}</div>
      <div style={{fontSize:12,color:c.tm}}>{label}</div>
    </div>
  )
}

// ─── DOC CARD (grid) ──────────────────────────────────────────────────────────
function DocCard({doc,onEdit,onDelete,onPrintPdf,token,onShare,onNotify,c,idx=0}) {
  return (
    <div className="doc-card" style={{background:c.s2,border:`0.5px solid ${c.bd}`,borderRadius:14,overflow:"visible",position:"relative",animation:`fadeUp .32s ${idx*0.055}s both`}}>
      <style>{`:root{--chover:${c.blueLt};--lhover:${c.s1}}`}</style>
      <div className="doc-card-top" onClick={()=>onEdit(doc.id)} style={{padding:"16px 16px 12px",cursor:"pointer",borderRadius:"14px 14px 0 0",transition:"background .18s"}}>
        <div style={{display:"flex",alignItems:"flex-start",gap:11,marginBottom:11}}>
          <div style={{width:40,height:48,background:c.blueLt,border:`0.5px solid ${c.blueMd}`,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <svg width="20" height="24" viewBox="0 0 20 24" fill="none">
              <rect x="1" y="1" width="13" height="20" rx="2.5" fill="white" stroke={c.blue} strokeWidth="1.4"/>
              <path d="M4 7h7M4 10.5h7M4 14h4.5" stroke={c.blue} strokeWidth="1.15" strokeLinecap="round"/>
              <path d="M12 1v5h5" fill={c.blueLt} stroke={c.blue} strokeWidth="1.15"/>
            </svg>
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13.5,fontWeight:600,color:c.t1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginBottom:3}}>{doc.title}</div>
            <div style={{fontSize:11.5,color:c.tm}}>Updated {fmtDate(doc.updatedAt)}</div>
          </div>
          {doc.isPublic&&<span style={{fontSize:10,fontWeight:700,background:c.greenLt,color:c.green,border:`0.5px solid ${c.greenBd}`,borderRadius:10,padding:"2px 7px",flexShrink:0}}>🌐 Public</span>}
        </div>
        <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
          <Badge variant="blue" c={c}>{fmtW(doc.wordCount)} words</Badge>
          <Badge variant="gray" c={c}>{doc.pageCount||1} {(doc.pageCount||1)===1?"page":"pages"}</Badge>
          <Badge variant="green" c={c}>.doc</Badge>
        </div>
      </div>
      <div style={{padding:"9px 13px",borderTop:`0.5px solid ${c.bd}`,background:c.s0,borderRadius:"0 0 14px 14px",display:"flex",gap:6,alignItems:"center"}}>
        <Btn variant="primary" onClick={()=>onEdit(doc.id)} c={c}>✏️ Edit</Btn>
        <ExportMenu doc={doc} onPrintPdf={onPrintPdf} token={token} c={c} onStatus={onNotify}/>
        <Btn variant={doc.isPublic?"green":"ghost"} onClick={()=>onShare(doc)} c={c}>🔗 {doc.isPublic?"Shared":"Share"}</Btn>
        <div style={{marginLeft:"auto"}}><Btn variant="danger" onClick={()=>onDelete(doc)} c={c}>🗑</Btn></div>
      </div>
    </div>
  )
}

// ─── DOC ROW (list) ───────────────────────────────────────────────────────────
function DocRow({doc,onEdit,onDelete,onPrintPdf,isLast,token,onShare,onNotify,c,idx=0}) {
  return (
    <div className="list-row" style={{display:"grid",gridTemplateColumns:"1fr 90px 60px 110px 172px",gap:10,padding:"10px 18px",borderBottom:isLast?"none":`0.5px solid ${c.bd}`,alignItems:"center",animation:`fadeUp .3s ${idx*0.04}s both`}}>
      <div style={{display:"flex",alignItems:"center",gap:8,minWidth:0}}>
        <span style={{fontSize:15}}>{doc.isPublic?"🌐":"📄"}</span>
        <span style={{fontSize:13,fontWeight:500,color:c.t1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{doc.title}</span>
      </div>
      <span style={{fontSize:12.5,color:c.t2}}>{fmtW(doc.wordCount)}</span>
      <span style={{fontSize:12.5,color:c.t2}}>{doc.pageCount||1}</span>
      <span style={{fontSize:12,color:c.tm}}>{fmtDate(doc.updatedAt)}</span>
      <div style={{display:"flex",gap:5,justifyContent:"flex-end",alignItems:"center"}}>
        <Btn variant="primary" onClick={()=>onEdit(doc.id)} c={c}>Edit</Btn>
        <ExportMenu doc={doc} onPrintPdf={onPrintPdf} token={token} c={c} onStatus={onNotify}/>
        <Btn variant={doc.isPublic?"green":"ghost"} onClick={()=>onShare(doc)} c={c}>🔗</Btn>
        <Btn variant="danger" onClick={()=>onDelete(doc)} c={c}>🗑</Btn>
      </div>
    </div>
  )
}

// ─── EMPTY STATE — with chinar leaf ──────────────────────────────────────────
function EmptyState({filter,search,onNew,c}) {
  const configs = {
    recent: {
      leaf: true,
      icon: "🕐",
      title: "No recent documents",
      sub: "Documents edited in the last 7 days will appear here.",
      btn: null,
    },
    shared: {
      leaf: false,
      icon: "🔗",
      title: "No shared documents",
      sub: "Make a document public to share it as a PDF link.",
      btn: null,
    },
    search: {
      leaf: false,
      icon: "🔍",
      title: `No results for "${search}"`,
      sub: "Try a different keyword.",
      btn: null,
    },
    all: {
      leaf: true,
      icon: null,
      title: "No documents yet",
      sub: "Create your first Kashmiri document to get started.",
      btn: true,
    },
  }
  const cfg = configs[search ? "search" : filter] || configs.all

  return (
    <div style={{textAlign:"center",padding:"64px 20px",color:c.tm,animation:"fadeUp .4s ease both"}}>
      {cfg.leaf && (
        <div style={{display:"flex",justifyContent:"center",marginBottom:10}}>
          <ChinaLeaf size={72} color={c.blue+"40"} style={{animation:"floatLeaf 5s ease-in-out infinite"}}/>
        </div>
      )}
      {cfg.icon && <div style={{fontSize:52,marginBottom:14}}>{cfg.icon}</div>}
      <h3 style={{color:c.t2,marginBottom:8,fontWeight:500,fontSize:17}}>{cfg.title}</h3>
      <p style={{fontSize:13.5,marginBottom:cfg.btn?24:0,lineHeight:1.6}}>{cfg.sub}</p>
      {cfg.btn && (
        <button onClick={onNew} className="new-doc-btn action-btn"
          style={{background:c.blue,color:"#fff",border:"none",padding:"11px 28px",borderRadius:10,fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
          📄 New document
        </button>
      )}
    </div>
  )
}

// ─── DICTIONARY SIDEBAR ───────────────────────────────────────────────────────
function DictSidebar({c,onClose,showToast}) {
  const [q,setQ]=useState("")
  const [expanded,setExpanded]=useState(true)
  // ADMIN PANEL ADDITION — words added in the admin panel's Dictionary
  // Management now show up here too, merged with the built-in 4,700+ list.
  const [adminWords,setAdminWords]=useState([])

  useEffect(()=>{
    fetch(`${API_BASE}/public/dictionary`).then(r=>r.json()).then(d=>{
      const rows=Array.isArray(d)?d:(d.entries||d.data||[])
      const mapped=(Array.isArray(rows)?rows:[]).map(e=>({
        title: e.englishWord,
        pos: e.partOfSpeech ? `/ ${e.transliteration||""} /, ${e.partOfSpeech}` : "",
        englishMeaning: e.meaningEnglish || e.transliteration || "",
        kashmiriMeaning: e.word,
        englishExample: e.exampleEnglish || "",
        kashmiriExample: e.exampleKashmiri || "",
      }))
      setAdminWords(mapped)
    }).catch(()=>{})
  },[])

  const allWords=useMemo(()=>{
    const unique=new Map()
    for(const entry of [...kashmiriData,...adminWords]){
      const key=`${String(entry.title||"").trim().toLowerCase()}|${String(entry.kashmiriMeaning||"").trim()}`
      if(key!=="|"&&!unique.has(key))unique.set(key,entry)
    }
    return [...unique.values()]
  },[adminWords])

  const results=useMemo(()=>{
    const ql=q.trim().toLowerCase()
    if(!ql)return []
    return allWords.filter(e=>
      e.title?.toLowerCase().includes(ql)||
      e.kashmiriMeaning?.toLowerCase().includes(ql)||
      e.englishMeaning?.toLowerCase().includes(ql)
    ).slice(0,40)
  },[allWords,q])

  function search(val){
    setQ(val)
  }

  return (
    <aside className="anim-dict dictionary-sidebar" style={{
      width:310,flexShrink:0,alignSelf:"stretch",
      height:"100%",minHeight:0,
      background:c.s2,borderLeft:`0.5px solid ${c.bd}`,
      borderBottom:expanded?"none":`0.5px solid ${c.bd}`,
      display:"flex",flexDirection:"column",overflow:"hidden",
      transition:"height .22s ease, box-shadow .22s ease",
      boxShadow:expanded?"none":"0 8px 24px rgba(0,0,0,.12)",
    }}>
      <div style={{background:c.blueDk,color:"#fff",padding:"12px 15px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
        <div><div style={{fontWeight:700,fontSize:13.5}}>📚 Kashmiri dictionary</div><div style={{fontSize:10.5,opacity:.65,marginTop:1}}>قٲمُس — {allWords.length.toLocaleString()} words</div></div>
        <div style={{display:"flex",gap:6}}>
          <button onClick={()=>setExpanded(v=>!v)} title={expanded?"Collapse dictionary":"Expand dictionary"} aria-expanded={expanded}
            style={{background:"rgba(255,255,255,.15)",border:"none",color:"#fff",borderRadius:6,width:26,height:26,cursor:"pointer",fontSize:14}}>
            {expanded?"⌃":"⌄"}
          </button>
          <button onClick={onClose} title="Close dictionary"
            style={{background:"rgba(255,255,255,.15)",border:"none",color:"#fff",borderRadius:6,width:26,height:26,cursor:"pointer",fontSize:15}}>✕</button>
        </div>
      </div>
      {expanded&&(
        <>
          <div className="sidebar-section-body" style={{padding:"10px 11px",borderBottom:`0.5px solid ${c.bd}`,flexShrink:0}}>
            <input type="text" value={q} onChange={e=>search(e.target.value)} placeholder="Search English or Kashmiri…" autoFocus style={{width:"100%",padding:"7px 10px",boxSizing:"border-box",border:`0.5px solid ${c.bdStr}`,borderRadius:8,fontSize:12.5,outline:"none",background:c.s1,color:c.t1,fontFamily:"inherit"}}/>
            {q&&<div style={{fontSize:11,color:c.tm,marginTop:5}}>{results.length===0?"No results":`${results.length} result${results.length!==1?"s":""}`}</div>}
          </div>
          <div className="sidebar-section-body" style={{flex:1,overflowY:"auto",padding:"4px 0",minHeight:0}}>
            {!q&&<div style={{padding:"28px 14px",textAlign:"center",color:c.tm,fontSize:12.5}}><div style={{fontSize:32,marginBottom:10}}>🔍</div>Type a word to search</div>}
            {results.map((entry,i)=>(
              <div key={i} onClick={()=>{navigator.clipboard?.writeText(entry.kashmiriMeaning);showToast("Copied: "+entry.kashmiriMeaning)}}
                title="Click to copy" style={{padding:"9px 13px",borderBottom:`0.5px solid ${c.bd}`,cursor:"pointer",transition:"background .12s",animation:`fadeUp .2s ${i*0.015}s both`}}
                onMouseEnter={e=>e.currentTarget.style.background=c.s1} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <div style={{display:"flex",alignItems:"baseline",gap:6,marginBottom:3}}>
                  <span style={{fontWeight:600,fontSize:13.5,color:c.t1}}>{entry.title}</span>
                  {entry.pos&&<span style={{fontSize:10,color:c.tm,fontStyle:"italic"}}>{entry.pos}</span>}
                </div>
                <div style={{fontSize:17,color:c.blue,direction:"rtl",textAlign:"right",fontFamily:"'Noto Nastaliq Urdu',serif",lineHeight:1.8,marginBottom:2}}>{entry.kashmiriMeaning}</div>
                {entry.englishMeaning&&<div style={{fontSize:11.5,color:c.t2}}><strong>Meaning:</strong> {entry.englishMeaning}</div>}
                {entry.englishExample&&<div style={{fontSize:11,color:c.tm,marginTop:3,fontStyle:"italic",borderLeft:`2px solid ${c.blue}`,paddingLeft:6}}>{entry.englishExample}</div>}
                <div style={{fontSize:10,color:c.blue,marginTop:4,opacity:.65}}>📋 Click to copy</div>
              </div>
            ))}
          </div>
        </>
      )}
    </aside>
  )
}

// ─── APP MODAL ────────────────────────────────────────────────────────────────
function AppModal({type="info",title,message,onClose,onConfirm,inputDefault="",dark=false}) {
  const c=C(dark)
  const [val,setVal]=useState(inputDefault)
  const ref=useRef(null)
  useEffect(()=>{if(type==="prompt")ref.current?.focus()},[type])
  return (
    <div onClick={e=>{if(e.target===e.currentTarget)onClose()}} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.54)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:99999}}>
      <div className="anim-modal" style={{background:c.s2,borderRadius:14,padding:"28px 26px",width:380,border:`1px solid ${c.bd}`,boxShadow:"0 24px 64px rgba(0,0,0,.3)"}}>
        <div style={{fontSize:32,marginBottom:12}}>{type==="danger"?"🗑️":type==="warn"?"⚠️":type==="prompt"?"✏️":"ℹ️"}</div>
        <h3 style={{fontSize:16,fontWeight:600,color:c.t1,marginBottom:8}}>{title}</h3>
        <p style={{fontSize:13,color:c.t2,marginBottom:type==="prompt"?12:22,lineHeight:1.65}} dangerouslySetInnerHTML={{__html:message}}/>
        {type==="prompt"&&<input ref={ref} value={val} onChange={e=>setVal(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")onConfirm?.(val)}} style={{width:"100%",padding:"8px 11px",border:`1px solid ${c.bd}`,borderRadius:7,fontSize:13,marginBottom:16,boxSizing:"border-box",background:c.s1,color:c.t1,fontFamily:"inherit"}}/>}
        <div style={{display:"flex",gap:9,justifyContent:"flex-end"}}>
          {(type==="confirm"||type==="danger"||type==="prompt")&&<button onClick={onClose} className="action-btn" style={{padding:"7px 17px",border:`1px solid ${c.bd}`,borderRadius:7,background:c.s2,color:c.t1,cursor:"pointer",fontSize:13,fontFamily:"inherit"}}>Cancel</button>}
          <button onClick={()=>onConfirm?.(type==="prompt"?val:true)} className="action-btn" style={{padding:"7px 17px",border:"none",borderRadius:7,background:type==="danger"?c.red:c.blue,color:"#fff",cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"inherit"}}>{type==="danger"?"Delete":type==="prompt"?"OK":type==="confirm"?"Yes":"OK"}</button>
        </div>
      </div>
    </div>
  )
}

// ─── EDITOR TIPS WIDGET ───────────────────────────────────────────────────────
function EditorHelp({c}) {
  const [idx,setIdx]=useState(0)
  useEffect(()=>{const t=setInterval(()=>setIdx(i=>(i+1)%EDITOR_TIPS.length),4000);return()=>clearInterval(t)},[])
  const tip=EDITOR_TIPS[idx]
  return (
    <div style={{margin:"auto 12px 0",borderRadius:12,overflow:"hidden",border:`0.5px solid ${c.bd}`}}>
      <div style={{background:c.blueDk,padding:"9px 12px",display:"flex",alignItems:"center",gap:7}}>
        <ChinaLeaf size={16} color="rgba(255,255,255,0.7)"/>
        <span style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,.85)",letterSpacing:".4px",textTransform:"uppercase"}}>Editor Tips</span>
      </div>
      <div key={idx} style={{background:c.s0,padding:"10px 12px",display:"flex",alignItems:"flex-start",gap:8,animation:"tipSlide .35s ease both",minHeight:58}}>
        <span style={{fontSize:18,flexShrink:0,marginTop:1}}>{tip.icon}</span>
        <span style={{fontSize:11.5,color:c.t2,lineHeight:1.55}}>{tip.tip}</span>
      </div>
      <div style={{background:c.s0,borderTop:`0.5px solid ${c.bd}`,padding:"6px 12px",display:"flex",gap:4,justifyContent:"center"}}>
        {EDITOR_TIPS.map((_,i)=>(
          <div key={i} onClick={()=>setIdx(i)} style={{width:i===idx?16:6,height:6,borderRadius:3,background:i===idx?c.blue:c.bd,transition:"all .3s ease",cursor:"pointer"}}/>
        ))}
      </div>
    </div>
  )
}

function SidebarSectionHeader({label,open,onToggle,c}) {
  return (
    <button type="button" onClick={onToggle} aria-expanded={open}
      style={{
        width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",
        padding:"6px 8px",marginBottom:6,border:"none",borderRadius:7,
        background:"transparent",color:c.tm,cursor:"pointer",fontFamily:"inherit",
      }}
      onMouseEnter={e=>e.currentTarget.style.background=c.s0}
      onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
      <span style={{fontSize:9.5,fontWeight:700,letterSpacing:".8px",textTransform:"uppercase"}}>{label}</span>
      <span className={`section-chevron${open?" open":""}`} style={{fontSize:13,lineHeight:1}}>⌄</span>
    </button>
  )
}

// ─── SIDEBAR ─────────────────────────────────────────────────────────────────
function Sidebar({c,onNewDoc,onTemplateClick,docs,activeFilter,onFilter,dictOpen,onToggleDict,onFeedback,onProfile}) {
  const pubCount=docs.filter(d=>d.isPublic).length
  const recentCount=docs.filter(isRecent).length
  const [sections,setSections]=useState({workspace:true,templates:true,tools:true})
  const toggleSection=name=>setSections(prev=>({...prev,[name]:!prev[name]}))

  return (
    <aside className="anim-sidebar dashboard-sidebar" style={{width:216,flexShrink:0,background:c.s2,borderRight:`0.5px solid ${c.bd}`,display:"flex",flexDirection:"column",padding:"16px 0",overflowY:"auto",overflowX:"hidden",minHeight:0}}>

      <div style={{padding:"0 12px 16px"}}>
        <button onClick={onNewDoc} className="new-doc-btn"
          style={{width:"100%",padding:"10px 12px",background:c.blue,color:"#fff",border:"none",borderRadius:10,fontSize:13,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:7,fontFamily:"inherit"}}>
          ＋ New document
        </button>
      </div>

      {/* Workspace nav */}
      <div style={{padding:"0 8px",marginBottom:4}}>
        <SidebarSectionHeader label="Workspace" open={sections.workspace} onToggle={()=>toggleSection("workspace")} c={c}/>
        {sections.workspace&&(
          <div className="sidebar-section-body">
            {[
              {id:"all",    icon:"⊞", label:"All documents", count:docs.length},
              {id:"recent", icon:"🕐", label:"Recent",        count:recentCount},
              {id:"shared", icon:"🔗", label:"Shared",        count:pubCount},
            ].map(item=>(
              <div key={item.id} className="nav-item" onClick={()=>onFilter(item.id)}
                style={{display:"flex",alignItems:"center",gap:9,padding:"7px 9px",fontSize:13,color:activeFilter===item.id?c.blueDk:c.t2,background:activeFilter===item.id?c.blueLt:"transparent",fontWeight:activeFilter===item.id?500:400}}>
                <span style={{fontSize:14}}>{item.icon}</span>
                <span style={{flex:1}}>{item.label}</span>
                <span style={{fontSize:10.5,background:activeFilter===item.id?c.blueMd:c.bd,color:activeFilter===item.id?c.blueDk:c.tm,borderRadius:10,padding:"1px 7px"}}>{item.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{height:0.5,background:c.bd,margin:"10px 12px"}}/>

      {/* Templates — click directly creates */}
      <div style={{padding:"0 8px",marginBottom:4}}>
        <SidebarSectionHeader label="Templates" open={sections.templates} onToggle={()=>toggleSection("templates")} c={c}/>
        {sections.templates&&(
          <div className="sidebar-section-body">
            {[
              {id:"blank",  icon:"📄", label:"Blank document"},
              {id:"letter", icon:"✉️", label:"Formal letter"},
              {id:"essay",  icon:"📝", label:"Essay / Article"},
            ].map(item=>(
              <div key={item.id} className="tmpl-item" onClick={()=>onTemplateClick(item.id)}
                style={{display:"flex",alignItems:"center",gap:9,padding:"7px 9px",fontSize:13,color:c.t2}}
                onMouseEnter={e=>e.currentTarget.style.background=c.s0}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <span style={{fontSize:14}}>{item.icon}</span>{item.label}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{height:0.5,background:c.bd,margin:"10px 12px"}}/>

      {/* Tools */}
      <div style={{padding:"0 8px",marginBottom:4}}>
        <SidebarSectionHeader label="Tools" open={sections.tools} onToggle={()=>toggleSection("tools")} c={c}/>
        {sections.tools&&(
          <div className="sidebar-section-body">
            {[
              {icon:"📚",label:"Dictionary",action:onToggleDict,active:dictOpen},
              {icon:"👤",label:"Profile",action:onProfile,active:false},
              {icon:"📬",label:"Feedback",action:onFeedback,active:false},
            ].map(item=>(
              <div key={item.label} className="nav-item" onClick={item.action}
                style={{display:"flex",alignItems:"center",gap:9,padding:"7px 9px",fontSize:13,color:item.active?c.blue:c.t2,background:item.active?c.blueLt:"transparent",fontWeight:item.active?500:400}}>
                <span style={{fontSize:14}}>{item.icon}</span>{item.label}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Editor tips */}
      <EditorHelp c={c}/>
    </aside>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════
export default function Dashboard({onOpenEditor,onLogout,dark=false,toggleDark}) {
  const {user,token,updateUser}=useAuth()
  const api=useCallback((path,opts)=>apiFetch(path,opts,token),[token])
  const c=C(dark)

  const [docs,          setDocs]          = useState([])
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState(null)
  const [search,        setSearch]        = useState("")
  const [sortBy,        setSortBy]        = useState("updatedAt")
  const [sortDir,       setSortDir]       = useState("desc")
  const [viewMode,      setViewMode]      = useState("grid")
  const [activeFilter,  setActiveFilter]  = useState("all")
  const [creating,      setCreating]      = useState(false)
  const [toast,         setToast]         = useState(null)
  const [modal,         setModal]         = useState(null)
  const [shareDoc,      setShareDoc]      = useState(null)
  // ADMIN PANEL ADDITION — so the "Dictionary words" stat card reflects
  // admin-added words too, not just the static built-in list
  const [adminDictCount, setAdminDictCount] = useState(kashmiriData.length)
  const [showFeedback,  setShowFeedback]  = useState(false)
  const [showProfile,   setShowProfile]   = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [dictOpen,      setDictOpen]      = useState(false)
  const [documentsOpen, setDocumentsOpen] = useState(true)
  // pageKey changes when filter changes → triggers page-enter animation
  const [pageKey,       setPageKey]       = useState(0)

  const toastTimer=useRef(null)
  function showToast(msg,type="success"){
    setToast({msg,type})
    clearTimeout(toastTimer.current)
    toastTimer.current=setTimeout(()=>setToast(null),3200)
  }
  useEffect(()=>()=>clearTimeout(toastTimer.current),[])

  const loadDocs=useCallback(async(silent=false)=>{
    if(!silent)setLoading(true)
    setError(null)
    try{
      const data=await api("/documents")
      setDocs(extractDocuments(data))
    }catch(e){setError(e.message)}
    finally{setLoading(false)}
  },[api])

  useEffect(()=>{loadDocs(false)},[loadDocs])

  // Refresh data in the background without changing the dashboard design.
  useEffect(()=>{
    const refresh=()=>{if(document.visibilityState==="visible")loadDocs(true)}
    const timer=setInterval(refresh,60000)
    window.addEventListener("focus",refresh)
    document.addEventListener("visibilitychange",refresh)
    return()=>{clearInterval(timer);window.removeEventListener("focus",refresh);document.removeEventListener("visibilitychange",refresh)}
  },[loadDocs])

  // ADMIN PANEL ADDITION — real count for the "Dictionary words" stat card
  useEffect(()=>{
    let active=true
    const loadCount=()=>fetch(`${API_BASE}/public/dictionary`).then(r=>{
      if(!r.ok)throw new Error(`HTTP ${r.status}`)
      return r.json()
    }).then(d=>{
      const entries=Array.isArray(d)?d:(d.entries||d.data||[])
      if(active){
        const builtIn=new Set(kashmiriData.map(entry=>String(entry.title||"").trim().toLowerCase()).filter(Boolean))
        for(const entry of Array.isArray(entries)?entries:[]){
          const title=String(entry.englishWord||entry.title||"").trim().toLowerCase()
          if(title)builtIn.add(title)
        }
        setAdminDictCount(builtIn.size)
      }
    }).catch(()=>{})
    loadCount()
    const timer=setInterval(loadCount,120000)
    return()=>{active=false;clearInterval(timer)}
  },[])

  async function createFromTemplate(tmpl){
    setShowTemplates(false);setCreating(true)
    try{
      const base=tmpl.id==="blank"?"Document":(tmpl.title||tmpl.name)
      const existingTitles=new Set(docs.map(d=>d.title))
      let n=1
      let title=tmpl.id==="blank"?`${base} ${n}`:base
      while(existingTitles.has(title)){n++;title=`${base} ${n}`}
      const response=await api("/documents",{method:"POST",body:JSON.stringify({title,html:tmpl.html||""})})
      const doc=normalizeDocument(response?.document||response?.data||response)
      if(!doc.id)throw new Error("The server did not return the new document ID")
      setDocs(prev=>[doc,...prev.filter(item=>item.id!==doc.id)])
      showToast(`"${title}" created`);onOpenEditor?.(doc.id)
    }catch(e){showToast("Failed: "+e.message,"error")}
    setCreating(false)
  }

  function handleSidebarTemplate(id){
    const tmpl=TEMPLATES.find(t=>t.id===id)
    if(tmpl)createFromTemplate(tmpl)
  }

  function handleFilter(id){
    setActiveFilter(id)
    setSearch("")
    setPageKey(k=>k+1) // triggers page-enter animation
  }

  function handleDelete(doc){
    setModal({
      type:"danger",title:"Delete document",
      message:`Are you sure you want to delete <strong>"${doc.title}"</strong>?<br/>This cannot be undone.`,
      onConfirm:async()=>{
        setModal(null)
        try{await api(`/documents/${doc.id}`,{method:"DELETE"});setDocs(p=>p.filter(d=>d.id!==doc.id));showToast(`"${doc.title}" deleted`)}
        catch(e){showToast("Delete failed: "+e.message,"error")}
      },
    })
  }

  async function handlePrintPdf(doc){
    // Open immediately while this function is still inside the user's click.
    // Opening after the API request is commonly blocked by browsers.
    const printWindow=window.open("about:blank","_blank")
    if(!printWindow){
      showToast("PDF preview was blocked. Allow pop-ups for this site and try again.","error")
      return
    }
    printWindow.document.write("<!doctype html><title>Preparing document…</title><p style='font-family:sans-serif;padding:24px'>Preparing print preview…</p>")
    try{
      const full=await api(`/documents/${doc.id}`)
      const printTitle=escapeHtml(full.title||doc.title||"Document")
      const html=`<!DOCTYPE html><html dir="rtl" lang="ur"><head><meta charset="utf-8"><title>${printTitle}</title>
<style>@page{size:A4;margin:0}html,body{margin:0!important;padding:0!important;background:#fff}body{font-family:Arial,sans-serif;font-size:12pt;line-height:1.8;direction:rtl;text-align:right;color:#000}.print-content{box-sizing:border-box;min-height:297mm;padding:18mm 20mm 20mm}table{border-collapse:collapse;width:100%}td,th{border:1px solid #aaa;padding:6px 8px}h1{font-size:22pt}h2{font-size:18pt}h3{font-size:14pt}ul,ol{padding-right:24px}.page-break-marker{break-after:page;page-break-after:always;height:0;border:none!important}.page-break-marker span,.img-resize-handle{display:none!important}#pb{position:fixed;bottom:0;left:0;right:0;background:#2b579a;color:#fff;padding:10px 20px;display:flex;align-items:center;justify-content:space-between;font-family:sans-serif;font-size:13px;z-index:9999}#pb button{background:#fff;color:#2b579a;border:none;padding:7px 20px;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer}@media print{html,body{width:210mm}.print-content{padding:18mm 20mm 20mm}#pb{display:none!important}}</style>
</head><body><div id="pb"><span>📄 ${printTitle}</span><div style="display:flex;gap:8px"><button onclick="window.print()">🖨 Print / Save PDF</button><button onclick="window.close()" style="background:#f44;color:#fff">✕</button></div></div><main class="print-content">${full.html||""}</main></body></html>`
      printWindow.document.open()
      printWindow.document.write(html)
      printWindow.document.close()
      printWindow.focus()
      showToast("Print / PDF preview opened")
    }catch(e){
      printWindow.close()
      showToast("PDF export failed: "+e.message,"error")
    }
  }

  // ── Filter + sort ─────────────────────────────────────────────────────────
  const filtered=docs
    .filter(d=>{
      if(activeFilter==="shared") return d.isPublic
      if(activeFilter==="recent") return isRecent(d)
      return true
    })
    .filter(d=>!search||d.title.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b)=>{
      let va=a[sortBy],vb=b[sortBy]
      if(sortBy==="updatedAt"||sortBy==="createdAt"){va=validDate(va)?.getTime()||0;vb=validDate(vb)?.getTime()||0}
      if(sortBy==="title"){va=String(va||"").toLowerCase();vb=String(vb||"").toLowerCase()}
      va=va??0;vb=vb??0
      return sortDir==="asc"?(va<vb?-1:va>vb?1:0):(va>vb?-1:va<vb?1:0)
    })

  function toggleSort(f){if(sortBy===f)setSortDir(d=>d==="asc"?"desc":"asc");else{setSortBy(f);setSortDir("desc")}}
  const arrow=f=>sortBy===f?(sortDir==="asc"?" ↑":" ↓"):""

  const words=sumWords(docs)
  const fmtWordsTotal=words>=1000?`${(words/1000).toFixed(1)}k`:`${words}`

  const filterLabel={all:"All documents",recent:"Recent documents",shared:"Shared documents"}

  return (
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",background:c.s0,fontFamily:"Segoe UI,system-ui,sans-serif",color:c.t1}}>

      {/* ── HEADER ── */}
      <header className="anim-header" style={{background:c.hdr,color:"#fff",padding:"0 22px",flexShrink:0,boxShadow:"0 2px 16px rgba(0,0,0,.28)",position:"relative",overflow:"hidden"}}>
        {/* Decorative chinar leaves in header */}
        <div style={{position:"absolute",right:180,top:-10,opacity:.12,pointerEvents:"none"}}>
          <ChinaLeaf size={90} color="#fff" style={{animation:"leafSway 6s ease-in-out infinite"}}/>
        </div>
        <div style={{position:"absolute",right:100,top:8,opacity:.07,pointerEvents:"none"}}>
          <ChinaLeaf size={54} color="#fff" style={{animation:"leafSway 8s ease-in-out infinite reverse"}}/>
        </div>

        <div style={{maxWidth:1400,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",height:56,position:"relative",zIndex:1}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:36,height:36,background:"rgba(255,255,255,.14)",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",border:"1px solid rgba(255,255,255,.2)"}}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect x="1" y="1" width="16" height="16" rx="3.5" fill="rgba(255,255,255,.18)"/>
                <path d="M3.5 5.5h11M3.5 9h11M3.5 12.5h6.5" stroke="white" strokeWidth="1.55" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <div style={{fontFamily:"serif",fontWeight:700,fontSize:16,lineHeight:1.1,letterSpacing:".2px"}}>کٲشُر وٲرڈ ایڈیٹَر</div>
              <div style={{fontSize:10.5,opacity:.5,letterSpacing:".35px"}}>Kashur Word Editor · University of Kashmir</div>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <button onClick={()=>setShowProfile(true)} className="hdr-btn"
              style={{display:"flex",alignItems:"center",gap:8,background:"rgba(255,255,255,.1)",border:"1px solid rgba(255,255,255,.18)",borderRadius:22,padding:"4px 12px 4px 4px",cursor:"pointer"}}>
              <div style={{width:28,height:28,borderRadius:"50%",background:"rgba(255,255,255,.22)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700}}>{user?.name?.charAt(0)?.toUpperCase()||"U"}</div>
              <div style={{textAlign:"left"}}>
                <div style={{fontSize:12,fontWeight:600,lineHeight:1.15,color:"#fff"}}>{user?.name||"User"}</div>
                <div style={{fontSize:10,opacity:.55,lineHeight:1.1,color:"#fff"}}>{user?.email}</div>
              </div>
            </button>
            <button onClick={toggleDark} className="hdr-btn" title={dark?"Light mode":"Dark mode"}
              style={{background:"rgba(255,255,255,.1)",border:"1px solid rgba(255,255,255,.18)",color:"rgba(255,255,255,.88)",borderRadius:8,padding:"6px 11px",fontSize:15,cursor:"pointer"}}>
              {dark?"☀️":"🌙"}
            </button>
            <button onClick={onLogout} className="hdr-btn"
              style={{background:"rgba(255,255,255,.1)",border:"1px solid rgba(255,255,255,.18)",color:"rgba(255,255,255,.88)",borderRadius:8,padding:"6px 14px",fontSize:12,cursor:"pointer",fontWeight:500,fontFamily:"inherit"}}>
              🚪 Logout
            </button>
          </div>
        </div>
      </header>

      {/* ── BODY ── */}
      <div className="dashboard-body" style={{display:"flex",flex:1,overflow:"hidden",alignItems:"stretch",minHeight:0}}>

        <Sidebar c={c} docs={docs}
          onNewDoc={()=>setShowTemplates(true)}
          onTemplateClick={handleSidebarTemplate}
          activeFilter={activeFilter}
          onFilter={handleFilter}
          dictOpen={dictOpen}
          onToggleDict={()=>setDictOpen(v=>!v)}
          onFeedback={()=>setShowFeedback(true)}
          onProfile={()=>setShowProfile(true)}
        />

        {/* ── MAIN ── */}
        <main className="anim-main" style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",minWidth:0}}>

          {/* Top bar */}
          <div style={{padding:"13px 24px 11px",background:c.s2,borderBottom:`0.5px solid ${c.bd}`,display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:16,fontWeight:500,color:c.t1}}>{filterLabel[activeFilter]||"Documents"}</span>
              {!loading&&<span style={{fontSize:12,color:c.tm}}>{creating?"Creating…":`${filtered.length} document${filtered.length!==1?"s":""}`}</span>}
              <button type="button" onClick={()=>setDocumentsOpen(v=>!v)} aria-expanded={documentsOpen}
                title={documentsOpen?"Collapse documents":"Expand documents"}
                style={{width:27,height:27,border:`0.5px solid ${c.bd}`,borderRadius:7,background:c.s1,color:c.t2,cursor:"pointer",fontSize:14,lineHeight:1}}>
                {documentsOpen?"⌃":"⌄"}
              </button>
            </div>
            <div style={{flex:1}}/>
            <div style={{position:"relative",width:240}}>
              <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",fontSize:13,color:c.tm}}>🔍</span>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search documents…"
                style={{width:"100%",padding:"7px 10px 7px 30px",border:`0.5px solid ${c.bdStr}`,borderRadius:8,fontSize:12.5,outline:"none",background:c.s1,color:c.t1,boxSizing:"border-box",fontFamily:"inherit"}}/>
            </div>
            <div style={{display:"flex",gap:2,background:c.s1,border:`0.5px solid ${c.bd}`,borderRadius:8,padding:2}}>
              {[["updatedAt","Date"],["title","Title"],["wordCount","Words"]].map(([f,l])=>(
                <button key={f} onClick={()=>toggleSort(f)} className="sort-tab"
                  style={{padding:"5px 11px",fontSize:12,borderRadius:6,border:"none",background:sortBy===f?c.s2:"transparent",color:sortBy===f?c.blue:c.t2,cursor:"pointer",fontWeight:sortBy===f?500:400,fontFamily:"inherit"}}>
                  {l}{arrow(f)}
                </button>
              ))}
            </div>
            <div style={{display:"flex",border:`0.5px solid ${c.bdStr}`,borderRadius:8,overflow:"hidden"}}>
              {[["grid","⊞"],["list","☰"]].map(([m,icon])=>(
                <button key={m} onClick={()=>setViewMode(m)} className="view-btn"
                  style={{padding:"6px 11px",fontSize:15,border:"none",background:viewMode===m?c.blue:"transparent",color:viewMode===m?"#fff":c.t2,cursor:"pointer"}}>
                  {icon}
                </button>
              ))}
            </div>
            <button onClick={()=>loadDocs(true)} title="Refresh" className="refresh-btn"
              style={{padding:"6px 11px",fontSize:14,border:`0.5px solid ${c.bd}`,borderRadius:8,background:"transparent",color:c.t2,cursor:"pointer"}}>
              ↻
            </button>
          </div>

          {/* Content */}
          <div style={{padding:"22px 24px",flex:1}}>

            {/* Stats — no LIVE badge */}
            <div className="dashboard-stats" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:26}}>
              <StatCard label="Total documents" value={docs.length}                         icon="📁" accent={c.blue}   c={c} delay={0}/>
              <StatCard label="Shared publicly"  value={docs.filter(d=>d.isPublic).length}  icon="🌐" accent={c.green}  c={c} delay={0.07}/>
              <StatCard label="Words written"    value={fmtWordsTotal}                       icon="✍️" accent={c.gold}   c={c} delay={0.14}/>
              <StatCard label="Dictionary words" value={adminDictCount.toLocaleString()}                              icon="📚" accent={c.purple} c={c} delay={0.21}/>
            </div>

            {documentsOpen&&(
              <div className="sidebar-section-body documents-scroll" style={{overflow:"visible",paddingBottom:12}}>
                {error&&(
                  <div style={{background:c.redLt,border:`0.5px solid ${c.redBd}`,borderRadius:8,padding:"11px 14px",marginBottom:18,color:c.red,fontSize:13}}>
                    ⚠️ {error} — <button onClick={()=>loadDocs(true)} style={{background:"none",border:"none",color:c.red,cursor:"pointer",textDecoration:"underline",fontSize:13}}>Retry</button>
                  </div>
                )}

                {/* Page content — animated on filter change */}
                {loading ? <Spinner c={c}/> : (
                  <div key={pageKey} className="page-enter">
                    {filtered.length===0 ? (
                      <EmptyState filter={activeFilter} search={search} onNew={()=>setShowTemplates(true)} c={c}/>
                    ) : viewMode==="grid" ? (
                      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(274px,1fr))",gap:16}}>
                        {filtered.map((doc,i)=>(
                          <DocCard key={doc.id} doc={doc} c={c} token={token} idx={i}
                            onEdit={id=>onOpenEditor?.(id)}
                            onDelete={handleDelete}
                            onPrintPdf={handlePrintPdf}
                            onShare={d=>setShareDoc(d)}
                            onNotify={showToast}
                          />
                        ))}
                      </div>
                    ) : (
                      <div style={{background:c.s2,border:`0.5px solid ${c.bd}`,borderRadius:14,overflow:"visible"}}>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 90px 60px 110px 172px",gap:10,padding:"9px 18px",background:c.s0,borderBottom:`0.5px solid ${c.bd}`,fontSize:11,fontWeight:700,color:c.tm,textTransform:"uppercase",letterSpacing:".4px",borderRadius:"14px 14px 0 0"}}>
                          <span>Title</span><span>Words</span><span>Pages</span><span>Updated</span><span style={{textAlign:"right"}}>Actions</span>
                        </div>
                        {filtered.map((doc,i)=>(
                          <DocRow key={doc.id} doc={doc} c={c} token={token} idx={i}
                            onEdit={id=>onOpenEditor?.(id)}
                            onDelete={handleDelete}
                            onPrintPdf={handlePrintPdf}
                            onShare={d=>setShareDoc(d)}
                            onNotify={showToast}
                            isLast={i===filtered.length-1}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <footer style={{padding:"12px 24px",borderTop:`0.5px solid ${c.bd}`,fontSize:11.5,color:c.tm,display:"flex",alignItems:"center",justifyContent:"space-between",background:c.s2,flexShrink:0}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <ChinaLeaf size={16} color={c.tm}/>
              <span style={{fontFamily:"serif",fontSize:13}}>کٲشُر وٲرڈ ایڈیٹَر</span>
            </div>
            <span>Adhfar Nabi · Aaqidah Majeed ·Mudasir saleem Ganie </span>
            <span>Supervisor.Dr. Hilal Ahmad Khanday  </span>
            <span> KU South Campus</span>
          </footer>
        </main>

        {dictOpen&&<DictSidebar c={c} onClose={()=>setDictOpen(false)} showToast={showToast}/>}
      </div>

      {/* ── MODALS ── */}
      {showTemplates&&<TemplatePickerModal dark={dark} onClose={()=>setShowTemplates(false)} onSelect={createFromTemplate}/>}
      {modal&&<AppModal {...modal} onClose={()=>setModal(null)} dark={dark}/>}
      {shareDoc&&(
        <ShareModal doc={shareDoc} token={token} dark={dark}
          onClose={()=>setShareDoc(null)}
          onUpdated={updated=>{const next=normalizeDocument(updated);setDocs(p=>p.map(d=>d.id===next.id?{...d,...next}:d));setShareDoc(next)}}
        />
      )}
      {showFeedback&&<FeedbackModal user={user} token={token} dark={dark} onClose={()=>setShowFeedback(false)}/>}
      {showProfile&&(
        <ProfileModal user={user} token={token} dark={dark}
          onClose={()=>setShowProfile(false)}
          onUpdated={u=>{updateUser(u);setShowProfile(false);showToast("Profile updated ✓")}}
        />
      )}
      {toast&&<Toast msg={toast.msg} type={toast.type}/>}

      <style>{CSS}</style>
    </div>
  )
}
