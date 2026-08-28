/**
 * LandingPage.jsx  —  Kashur Word Editor  (Animated Edition)
 *
 * Dynamic features added:
 *   • Typewriter loop in Hero (cycles Kashmiri phrases)
 *   • Floating particle canvas background in Hero
 *   • Scroll-reveal fade-up on every section
 *   • Animated number counters in Download stats
 *   • Feature cards staggered entrance
 *   • Step circles pulse on enter
 *   • Navbar smooth glass on scroll
 *   • Saffron cursor blink in editor mockup
 */

import { useState, useEffect, useRef, useCallback } from "react"

// ─── TOKENS ────────────────────────────────────────────────────────────────
const C = {
  // ── Indigo family (richer, deeper) ──────────────────────────────
  indigoDark:   "#080F20",   // near-black indigo — hero/footer bg
  indigo:       "#142040",   // primary brand indigo
  indigoMid:    "#1E305E",   // gradient mid
  indigoLight:  "#2A4280",   // hover states, accents
  indigoGlass:  "#1A2D55",   // card/panel surfaces

  // ── Saffron family (warm, vivid Kashmir saffron) ─────────────────
  saffron:      "#F0A500",   // primary saffron — buttons, accents
  saffronHover: "#FFB820",   // hover — brighter
  saffronLight: "#FFF4D6",   // tint backgrounds
  saffronDark:  "#B57800",   // text on light bg
  saffronGlow:  "#F0A50040", // glow effect (transparent)

  // ── Neutrals ─────────────────────────────────────────────────────
  cream:        "#FEFCF6",   // warm white page bg
  white:        "#FFFFFF",
  slate:        "#F2F5FC",   // section alternating bg
  border:       "#E0E8F5",   // card borders
  borderDark:   "rgba(255,255,255,0.10)",

  // ── Text ─────────────────────────────────────────────────────────
  text:         "#101D38",   // primary text — deep indigo
  muted:        "#506080",   // secondary text
  hint:         "#8898B8",   // placeholder / hint text
}
const UI  = "'Inter','Segoe UI',system-ui,sans-serif"
const KSH = "'Noto Nastaliq Urdu','Jameel Noori Nastaleem',serif"
const API = "http://localhost:3001/api"

// ─── FONT LOADER ───────────────────────────────────────────────────────────
function FontLoader() {
  useEffect(() => {
    if (document.getElementById("kw-gf")) return
    const l = document.createElement("link")
    l.id = "kw-gf"; l.rel = "stylesheet"
    l.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Nastaliq+Urdu:wght@400;700&display=swap"
    document.head.appendChild(l)
  }, [])
  return null
}

// ─── GLOBAL ANIMATION STYLES ──────────────────────────────────────────────
function AnimStyles() {
  return (
    <style>{`
      @keyframes kwFadeUp {
        from { opacity:0; transform:translateY(32px); }
        to   { opacity:1; transform:translateY(0);    }
      }
      @keyframes kwPulse {
        0%,100% { box-shadow: 0 0 0 0 rgba(232,160,32,.5); }
        50%      { box-shadow: 0 0 0 16px rgba(232,160,32,0); }
      }
      @keyframes kwBlink {
        0%,100% { opacity:1; }
        50%      { opacity:0; }
      }
      @keyframes kwFloat {
        0%,100% { transform:translateY(0px);  }
        50%      { transform:translateY(-10px); }
      }
      @keyframes kwShimmer {
        0%   { background-position: 0%   50%; }
        100% { background-position: 200% 50%; }
      }
      @keyframes kwSpin {
        from { transform:rotate(0deg);   }
        to   { transform:rotate(360deg); }
      }
      .kw-reveal   { opacity:0; }
      .kw-revealed { animation: kwFadeUp .65s cubic-bezier(.22,.68,0,1.2) forwards; }
      .kw-pulse    { animation: kwPulse 2s ease-in-out infinite; }
      .kw-blink    { animation: kwBlink 1.1s step-end infinite; }
      .kw-float    { animation: kwFloat 4s ease-in-out infinite; }
      .kw-feat:hover { box-shadow:0 18px 48px rgba(27,42,74,.13)!important; transform:translateY(-6px)!important; }
    `}</style>
  )
}

// ─── SCROLL REVEAL HOOK ────────────────────────────────────────────────────
function useReveal(delay = 0) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current; if (!el) return
    el.classList.add("kw-reveal")
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        setTimeout(() => el.classList.add("kw-revealed"), delay)
        obs.disconnect()
      }
    }, { threshold: 0.15 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [delay])
  return ref
}

// ─── ANIMATED COUNTER ─────────────────────────────────────────────────────
function Counter({ target, suffix = "", duration = 1800 }) {
  const [val, setVal] = useState(0)
  const ref = useRef(null)
  const ran = useRef(false)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !ran.current) {
        ran.current = true
        const start = performance.now()
        const tick = now => {
          const p = Math.min((now - start) / duration, 1)
          const ease = 1 - Math.pow(1 - p, 3)
          setVal(Math.round(ease * target))
          if (p < 1) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
        obs.disconnect()
      }
    }, { threshold: 0.5 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [target, duration])
  return <span ref={ref}>{val}{suffix}</span>
}

// ─── TYPEWRITER HOOK ──────────────────────────────────────────────────────
function useTypewriter(phrases, typingSpeed = 90, pauseMs = 1800, deleteSpeed = 55) {
  const [display, setDisplay] = useState("")
  const [phase, setPhase]     = useState("typing")
  const [idx, setIdx]         = useState(0)
  const [charIdx, setCharIdx] = useState(0)

  useEffect(() => {
    const current = phrases[idx]
    let timer
    if (phase === "typing") {
      if (charIdx < current.length) {
        timer = setTimeout(() => setCharIdx(c => c + 1), typingSpeed)
      } else {
        timer = setTimeout(() => setPhase("pause"), pauseMs)
      }
    } else if (phase === "pause") {
      setPhase("deleting")
    } else if (phase === "deleting") {
      if (charIdx > 0) {
        timer = setTimeout(() => setCharIdx(c => c - 1), deleteSpeed)
      } else {
        setIdx(i => (i + 1) % phrases.length)
        setPhase("typing")
      }
    }
    setDisplay(current.slice(0, charIdx))
    return () => clearTimeout(timer)
  }, [phase, charIdx, idx, phrases, typingSpeed, pauseMs, deleteSpeed])

  return display
}

// ─── PARTICLE CANVAS ──────────────────────────────────────────────────────
function ParticleCanvas() {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    let W, H, particles, raf

    const resize = () => {
      W = canvas.width  = canvas.offsetWidth
      H = canvas.height = canvas.offsetHeight
    }
    resize()
    window.addEventListener("resize", resize)

    const N = 55
    particles = Array.from({ length: N }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.6 + .4,
      vx: (Math.random() - .5) * .35,
      vy: (Math.random() - .5) * .35,
      a: Math.random() * .5 + .1,
    }))

    const draw = () => {
      ctx.clearRect(0, 0, W, H)
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0
        if (p.y < 0) p.y = H; if (p.y > H) p.y = 0
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(232,160,32,${p.a})`
        ctx.fill()
      })
      // draw lines between close particles
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const d  = Math.sqrt(dx*dx + dy*dy)
          if (d < 100) {
            ctx.beginPath()
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.strokeStyle = `rgba(232,160,32,${.12 * (1 - d/100)})`
            ctx.lineWidth = .6
            ctx.stroke()
          }
        }
      }
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize) }
  }, [])
  return (
    <canvas ref={canvasRef} style={{
      position: "absolute", inset: 0, width: "100%", height: "100%",
      pointerEvents: "none", zIndex: 0,
    }} />
  )
}

function goTo(id) { document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }) }

// ═══════════════════════════════════════════════════════════════════
//  NAVBAR
// ═══════════════════════════════════════════════════════════════════
function Navbar({ onLogin, onSignup }) {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen]         = useState(false)
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 40)
    window.addEventListener("scroll", h)
    return () => window.removeEventListener("scroll", h)
  }, [])
  const NAV = [
    { label:"Features",     id:"features"     },
    { label:"How It Works", id:"how-it-works"  },
    { label:"Download",    id:"download"      },
    { label:"Contact",      id:"contact"       },
  ]
  return (
    <nav style={{
      position:"fixed", top:0, left:0, right:0, zIndex:1000,
      background: scrolled ? "rgba(8,15,32,0.97)" : "transparent",
      backdropFilter: scrolled ? "blur(16px)" : "none",
      borderBottom: scrolled ? "1px solid rgba(255,255,255,.08)" : "none",
      transition:"background .4s, border .4s",
      fontFamily:UI,
    }}>
      <div style={{ maxWidth:1160, margin:"0 auto", padding:"0 28px", height:66,
        display:"flex", alignItems:"center", justifyContent:"space-between" }}>

        <button onClick={() => goTo("hero")} style={{
          background:"none", border:"none", cursor:"pointer",
          display:"flex", alignItems:"center", gap:10,
        }}>
          <div style={{ width:38, height:38, background:C.saffron, borderRadius:10,
            display:"flex", alignItems:"center", justifyContent:"center",
            transition:"transform .2s",
          }}
          onMouseEnter={e => e.currentTarget.style.transform = "rotate(-8deg) scale(1.08)"}
          onMouseLeave={e => e.currentTarget.style.transform = "none"}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M4 6.5h12M4 10h12M4 13.5h7" stroke={C.indigo} strokeWidth="2.2" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <div style={{ fontFamily:KSH, fontSize:16, color:C.white, lineHeight:1.3, direction:"rtl" }}>کٲشُر ایڈیٹر</div>
            <div style={{ fontSize:10, color:"rgba(255,255,255,.4)", letterSpacing:.6 }}>Kashur Word Editor</div>
          </div>
        </button>

        <div className="kw-desk" style={{ display:"flex", gap:4 }}>
          {NAV.map(l => (
            <button key={l.id} onClick={() => goTo(l.id)} style={{
              background:"none", border:"none", fontSize:13.5, fontWeight:500,
              color:"rgba(255,255,255,.7)", cursor:"pointer",
              padding:"6px 13px", borderRadius:7, fontFamily:UI,
              transition:"color .15s, background .15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.color=C.white; e.currentTarget.style.background="rgba(255,255,255,.09)" }}
            onMouseLeave={e => { e.currentTarget.style.color="rgba(255,255,255,.7)"; e.currentTarget.style.background="transparent" }}>
              {l.label}
            </button>
          ))}
        </div>

        <div style={{ display:"flex", gap:10, alignItems:"center" }}>
          <button onClick={onLogin} style={{
            background:"transparent", border:"1px solid rgba(255,255,255,.25)",
            color:C.white, padding:"8px 20px", borderRadius:8,
            fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:UI,
            transition:"all .15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor="rgba(255,255,255,.6)"; e.currentTarget.style.background="rgba(255,255,255,.07)" }}
          onMouseLeave={e => { e.currentTarget.style.borderColor="rgba(255,255,255,.25)"; e.currentTarget.style.background="transparent" }}>
            Log In
          </button>
          <button onClick={onSignup} style={{
            background:C.saffron, color:C.indigo, border:"none",
            padding:"9px 22px", borderRadius:8,
            fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:UI,
            transition:"background .15s, transform .15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.background=C.saffronHover; e.currentTarget.style.transform="translateY(-1px)" }}
          onMouseLeave={e => { e.currentTarget.style.background=C.saffron; e.currentTarget.style.transform="none" }}>
            Sign Up Free
          </button>
          <button onClick={() => setOpen(v=>!v)} className="kw-burger"
            style={{ background:"none", border:"none", cursor:"pointer", padding:6, display:"none" }}>
            {[0,1,2].map(i => (
              <div key={i} style={{ width:22, height:2, background:C.white, margin:"4px 0", borderRadius:2 }} />
            ))}
          </button>
        </div>
      </div>

      {open && (
        <div style={{ background:C.indigoDark, padding:"8px 28px 22px",
          borderTop:"1px solid rgba(255,255,255,.08)" }}>
          {NAV.map(l => (
            <button key={l.id} onClick={() => { goTo(l.id); setOpen(false) }} style={{
              display:"block", width:"100%", textAlign:"left",
              background:"none", border:"none", padding:"12px 0",
              fontSize:15, color:"rgba(255,255,255,.8)", cursor:"pointer",
              borderBottom:"1px solid rgba(255,255,255,.07)", fontFamily:UI,
            }}>{l.label}</button>
          ))}
          <div style={{ display:"flex", gap:10, marginTop:18 }}>
            <button onClick={onLogin} style={{ flex:1, padding:10, border:"1px solid rgba(255,255,255,.2)", borderRadius:8, fontSize:14, background:"transparent", color:C.white, cursor:"pointer", fontFamily:UI }}>Log In</button>
            <button onClick={onSignup} style={{ flex:1, padding:10, border:"none", borderRadius:8, fontSize:14, background:C.saffron, color:C.indigo, cursor:"pointer", fontWeight:700, fontFamily:UI }}>Sign Up Free</button>
          </div>
        </div>
      )}
      <style>{`
        @media(max-width:768px){ .kw-desk{display:none!important;} .kw-burger{display:block!important;} }
      `}</style>
    </nav>
  )
}

// ═══════════════════════════════════════════════════════════════════
//  HERO
// ═══════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════
//  EDITOR MOCKUP  — live typing in Kashmiri
// ═══════════════════════════════════════════════════════════════════

// Lines that will be "typed" one by one, looping forever
const EDITOR_LINES = [
  { text: " کٲشُر ایڈیٹر",                           bold: true,  heading: true  },
  { text: "اَگَر فِردَوس بَر رُوئے زَمیں اَست،",   bold: false, heading: false },
  { text: "ہَمیں اَست و ہَمیں اَست و ہَمیں اَست۔،",      bold: false, heading: false },
  { text: "اَن پۄشِ تِلی یِلی وَن پۄشِ،",       bold: false, heading: false },
  { text: "یِمَن دِل صاف، تِمَن رَب نزدیک۔",     bold: false, heading: false },
]

function EditorMockup() {
  const [lineIdx,  setLineIdx]  = useState(0)
  const [charIdx,  setCharIdx]  = useState(0)
  const [phase,    setPhase]    = useState("typing")   // typing | pause | clearing
  const [done,     setDone]     = useState([])         // completed lines

  useEffect(() => {
    const current = EDITOR_LINES[lineIdx]
    let timer

    if (phase === "typing") {
      if (charIdx < current.text.length) {
        timer = setTimeout(() => setCharIdx(c => c + 1), 55)
      } else {
        // line done — pause then move to next
        timer = setTimeout(() => {
          setDone(d => [...d, { ...current, typed: current.text }])
          setCharIdx(0)
          if (lineIdx < EDITOR_LINES.length - 1) {
            setLineIdx(l => l + 1)
            setPhase("typing")
          } else {
            // all lines done — pause then clear and restart
            setPhase("pause")
          }
        }, 600)
      }
    } else if (phase === "pause") {
      timer = setTimeout(() => {
        setDone([])
        setLineIdx(0)
        setCharIdx(0)
        setPhase("typing")
      }, 2200)
    }

    return () => clearTimeout(timer)
  }, [phase, charIdx, lineIdx])

  const currentLine = EDITOR_LINES[lineIdx]
  const typingText  = currentLine.text.slice(0, charIdx)

  return (
    <div style={{ display:"flex", justifyContent:"center" }} className="kw-float">
      <div style={{
        background:C.white, borderRadius:16, overflow:"hidden",
        width:"100%", maxWidth:450,
        boxShadow:"0 40px 90px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.06)",
        transform:"perspective(1200px) rotateY(-8deg) rotateX(4deg)",
      }}>

        {/* ── Title bar ── */}
        <div style={{ background:`linear-gradient(90deg, ${C.indigoDark}, ${C.indigo})`, padding:"11px 16px",
          display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", gap:6 }}>
            {["#E74C3C","#F1C40F","#2ECC71"].map(bg => (
              <div key={bg} style={{ width:11, height:11, borderRadius:"50%", background:bg }} />
            ))}
          </div>
          <span style={{ color:"rgba(255,255,255,.6)", fontSize:11, fontFamily:KSH, direction:"rtl" }}>
            مٮ۪نٛز دَستاویٖز — کٲشُر ایڈیٹر
          </span>
          <div />
        </div>

        {/* ── Toolbar ── */}
        <div style={{ background:"#F8F9FC", borderBottom:"1px solid #E4E9F2",
          padding:"7px 14px", display:"flex", gap:5, alignItems:"center" }}>
          {[
            { t:"B", s:{ fontWeight:700   } },
            { t:"I", s:{ fontStyle:"italic" } },
            { t:"U", s:{ textDecoration:"underline" } },
          ].map(b => (
            <div key={b.t} style={{ width:27, height:25, borderRadius:4, background:C.white,
              border:"1px solid #DDE3EE", display:"flex", alignItems:"center",
              justifyContent:"center", fontSize:11, color:C.indigo, fontFamily:UI, ...b.s }}>
              {b.t}
            </div>
          ))}
          <div style={{ width:1, height:18, background:"#DDE3EE", margin:"0 4px" }} />
          {["≡","A","⇌"].map(b => (
            <div key={b} style={{ width:27, height:25, borderRadius:4, background:C.white,
              border:"1px solid #DDE3EE", display:"flex", alignItems:"center",
              justifyContent:"center", fontSize:11, color:C.muted }}>{b}</div>
          ))}
          {/* Live word count */}
          <div style={{ marginLeft:"auto", display:"flex", gap:6, alignItems:"center" }}>
            <span style={{ fontSize:9, color:C.hint, fontFamily:UI }}>
              {done.reduce((a,l) => a + l.typed.length, 0) + charIdx} حرف
            </span>
            <div style={{ background:C.saffron, color:C.indigo,
              borderRadius:5, padding:"3px 9px", fontSize:10, fontWeight:700, fontFamily:UI }}>
              💾 Saved
            </div>
          </div>
        </div>

        {/* ── Page (the live typing area) ── */}
        <div style={{
          padding:"20px 22px 24px", background:"#FDFCFB",
          direction:"rtl", textAlign:"right",
          minHeight:240, fontFamily:KSH,
        }}>

          {/* Completed lines */}
          {done.map((l, i) => (
            <div key={i} style={{
              fontSize: l.heading ? 17 : 13,
              fontWeight: l.bold ? 700 : 400,
              color: l.heading ? C.indigo : C.text,
              lineHeight: 1.9,
              marginBottom: l.heading ? 10 : 2,
              borderBottom: l.heading ? `2px solid ${C.saffron}` : "none",
              paddingBottom: l.heading ? 6 : 0,
              opacity: 1,
            }}>{l.typed}</div>
          ))}

          {/* Currently typing line */}
          {phase !== "pause" && (
            <div style={{
              fontSize: currentLine.heading ? 17 : 13,
              fontWeight: currentLine.bold ? 700 : 400,
              color: currentLine.heading ? C.indigo : C.text,
              lineHeight: 1.9,
              display:"flex", justifyContent:"flex-end", alignItems:"center", gap:1,
            }}>
              <span className="kw-blink" style={{
                display:"inline-block", width:2, height: currentLine.heading ? 20 : 15,
                background:C.saffron, borderRadius:1, marginLeft:2, flexShrink:0,
              }} />
              <span>{typingText}</span>
            </div>
          )}

          {/* Idle state after full clear */}
          {phase === "pause" && (
            <div style={{ display:"flex", justifyContent:"flex-end", alignItems:"center" }}>
              <span className="kw-blink" style={{
                display:"inline-block", width:2, height:18,
                background:C.saffron, borderRadius:1,
              }} />
            </div>
          )}
        </div>

        {/* ── Status bar ── */}
        <div style={{
          background:"#F3F5FB", borderTop:"1px solid #E4E9F2",
          padding:"5px 14px", display:"flex", justifyContent:"space-between",
          alignItems:"center",
        }}>
          <span style={{ fontSize:10, color:C.hint, fontFamily:UI }}>کٲشُر نَستعلیٖق</span>
          <div style={{ display:"flex", gap:12, alignItems:"center" }}>
            <span style={{ fontSize:10, color:C.hint, fontFamily:UI }}>A4</span>
            <span style={{ fontSize:10, color:C.hint, fontFamily:UI }}>صَفحہ ۱</span>
            <div style={{ width:6, height:6, borderRadius:"50%", background:"#2ECC71" }} />
          </div>
        </div>

      </div>
    </div>
  )
}

const PHRASES = [
"کٲشُر لِکھٕو",        // Write Kashmiri
  "کٲشِر تہذیٖب",         // Kashmiri Culture  
  "کٲشُر ایڈیٹر",      // Kashur Editor
  "پَنٕنۍ زبٲن",        // Our Language
  "کٲشُر قَلَم",    // Kashmiri Pen
]

function Hero({ onSignup, onLogin }) {
  const typed    = useTypewriter(PHRASES, 100, 2000, 60)
  const heroRef  = useReveal(0)
  const [blink, setBlink] = useState(true)

  return (
    <section id="hero" style={{
      background:`linear-gradient(150deg, ${C.indigoDark} 0%, ${C.indigo} 45%, ${C.indigoMid} 75%, ${C.indigoGlass} 100%)`,
      minHeight:"100vh",
      display:"flex", alignItems:"center",
      padding:"110px 28px 80px",
      position:"relative", overflow:"hidden",
      fontFamily:UI,
    }}>
      <ParticleCanvas />

      {/* Saffron glow */}
      <div style={{
        position:"absolute", top:"35%", right:"28%",
        width:440, height:440, borderRadius:"50%",
        background:`radial-gradient(circle, ${C.saffronGlow} 0%, transparent 68%)`,
        pointerEvents:"none", zIndex:1,
      }} />

      {/* Ghost watermark */}
      <div style={{
        position:"absolute", top:"50%", right:-20,
        transform:"translateY(-52%)",
        fontFamily:KSH, fontWeight:700,
        fontSize:"clamp(100px,16vw,200px)",
        color:"rgba(255,255,255,0.025)",
        direction:"rtl", lineHeight:1,
        userSelect:"none", pointerEvents:"none",
        whiteSpace:"nowrap", zIndex:1,
      }}>لیکھ کٲشُر</div>

      <div ref={heroRef} style={{
        maxWidth:1160, width:"100%", margin:"0 auto",
        display:"grid", gridTemplateColumns:"1fr 1fr",
        gap:72, alignItems:"center", position:"relative", zIndex:2,
      }}>
        {/* Left */}
        <div>
          {/* Badge */}
          <div style={{
            display:"inline-flex", alignItems:"center", gap:8,
            background:`${C.saffron}22`, border:`1px solid ${C.saffron}55`,
            borderRadius:100, padding:"5px 16px", marginBottom:28,
          }}>
            <div style={{ width:7, height:7, borderRadius:"50%", background:C.saffron, boxShadow:`0 0 8px ${C.saffron}` }} className="kw-pulse" />
            <span style={{ fontSize:12, color:C.saffron, fontWeight:600, letterSpacing:.5 }}>
              Free Kashmiri Word Processor
            </span>
          </div>

          <h1 style={{ margin:"0 0 6px", color:C.white, fontWeight:800,
            fontSize:"clamp(34px,5vw,58px)", lineHeight:1.08, letterSpacing:-1 }}>
            Write in Kashmiri.
          </h1>

          {/* Typewriter */}
          <div style={{ minHeight:"clamp(44px,6vw,72px)", marginBottom:24, display:"flex", alignItems:"center" }}>
            <span style={{
              fontFamily:KSH, fontSize:"clamp(28px,4.5vw,54px)",
              color:C.saffron, lineHeight:1.4, fontWeight:700,
              direction:"rtl",
            }}>{typed}</span>
            <span className="kw-blink" style={{
              display:"inline-block", width:3, height:"clamp(32px,4vw,50px)",
              background:C.saffron, marginLeft:4, borderRadius:2, flexShrink:0,
            }} />
          </div>

          <p style={{ fontSize:"clamp(15px,1.7vw,17.5px)", color:"rgba(255,255,255,.65)",
            lineHeight:1.82, marginBottom:38, maxWidth:460 }}>
            A full-featured Kashmiri word processor right in your browser —
            A4 pages, rich formatting, cloud auto-save, PDF export, and
            public sharing. All free, no download needed.
          </p>

          <div style={{ display:"flex", gap:14, flexWrap:"wrap", marginBottom:36 }}>
            <button onClick={onSignup} style={{
              background:C.saffron, color:C.indigo, border:"none",
              padding:"15px 32px", borderRadius:10,
              fontSize:15, fontWeight:700, cursor:"pointer", fontFamily:UI,
              transition:"background .15s, transform .15s, box-shadow .15s",
              boxShadow:`0 6px 28px ${C.saffron}60`,
            }}
            onMouseEnter={e => { e.currentTarget.style.background=C.saffronHover; e.currentTarget.style.transform="translateY(-3px)"; e.currentTarget.style.boxShadow=`0 8px 32px ${C.saffron}66` }}
            onMouseLeave={e => { e.currentTarget.style.background=C.saffron; e.currentTarget.style.transform="none"; e.currentTarget.style.boxShadow=`0 4px 22px ${C.saffron}55` }}>
              Start Writing Free →
            </button>
            <button onClick={onLogin} style={{
              background:"rgba(255,255,255,.08)", color:"rgba(255,255,255,.88)",
              border:"1px solid rgba(255,255,255,.22)",
              padding:"15px 28px", borderRadius:10,
              fontSize:15, fontWeight:500, cursor:"pointer", fontFamily:UI,
              transition:"background .15s",
            }}
            onMouseEnter={e => e.currentTarget.style.background="rgba(255,255,255,.14)"}
            onMouseLeave={e => e.currentTarget.style.background="rgba(255,255,255,.08)"}>
              Log In
            </button>
          </div>

          <div style={{ display:"flex", gap:20, flexWrap:"wrap" }}>
            {[["✓","Free forever"],["✓","Secure login"],["✓","Cloud save"],["✓","PDF export"]].map(([ic,txt]) => (
              <div key={txt} style={{ display:"flex", alignItems:"center", gap:6 }}>
                <span style={{ color:C.saffron, fontWeight:700, fontSize:13 }}>{ic}</span>
                <span style={{ fontSize:12.5, color:"rgba(255,255,255,.5)" }}>{txt}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Editor mockup — floats + live typing */}
        <EditorMockup />
      </div>
      <style>{`
        @media(max-width:768px){
          #hero > div > div { grid-template-columns:1fr!important; gap:44px!important; }
          #hero > div > div > div:last-child { display:none!important; }
        }
      `}</style>
    </section>
  )
}

// ═══════════════════════════════════════════════════════════════════
//  WAVE DIVIDER
// ═══════════════════════════════════════════════════════════════════
function WaveDivider({ flip = false, topColor = C.indigoMid, bottomColor = C.cream }) {
  return (
    <div style={{
      background: topColor,
      lineHeight: 0,
      transform: flip ? "scaleY(-1)" : "none",
    }}>
      <svg viewBox="0 0 1440 60" preserveAspectRatio="none"
        style={{ display:"block", width:"100%", height:60 }}>
        <path
          d="M0,30 C240,60 480,0 720,30 C960,60 1200,0 1440,30 L1440,60 L0,60 Z"
          fill={bottomColor}
        />
      </svg>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
//  FEATURES
// ═══════════════════════════════════════════════════════════════════
const FEATS = [
  {
    icon:"📄",
    title:"RTL A4 Page Engine",
    desc:"Renders true right-to-left A4 page sheets with automatic text reflow, Nastaliq line-height compensation, and visual page-break separators — exactly like Word but built for کٲشُر.",
  },
  {
    icon:"🖊",
    title:"Rich Formatting",
    desc:"Bold, italic, underline, strikethrough, font size, font color, highlight, headings H1–H3, bullet & numbered lists, alignment.",
  },
  {
    icon:"☁️",
    title:"MongoDB Auto-Save",
    desc:"Every edit is debounced and pushed to MongoDB Atlas every 30 seconds via a JWT-authenticated REST API. Documents persist per-user and are accessible from any device.",
  },
  {
    icon:"📤",
    title:"Export Anywhere",
    desc:"Download your document as PDF (print-to-PDF), DOCX (opens in Microsoft Word), or plain TXT. All from inside the editor.",
  },
  {
    icon:"🔗",
    title:"Public URL Sharing",
    desc:"Make any document public and share a link. Anyone with the link can view the PDF without logging in. Revoke anytime.",
  },
  {
    icon:"🔒",
    title:"Secure by Design",
    desc:"Email verification with OTP, bcrypt password hashing, JWT authentication, per-user document isolation — your files are private.",
  },
]

function FeatureCard({ f, delay, num }) {
  const ref = useReveal(delay)
  return (
    <div ref={ref} className="kw-feat" style={{
      background:C.white, borderRadius:16, padding:"30px 26px",
      border:`1px solid ${C.border}`,
      transition:"box-shadow .25s, transform .25s, border-color .25s",
      cursor:"default", position:"relative", overflow:"hidden",
    }}
    onMouseEnter={e => e.currentTarget.style.borderColor = C.indigoLight+"55"}
    onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
      {/* Tool number watermark */}
      <div style={{
        position:"absolute", top:16, right:20,
        fontSize:42, fontWeight:800, color:`${C.indigo}0A`,
        lineHeight:1, userSelect:"none", pointerEvents:"none",
        fontFamily:UI,
      }}>0{num}</div>

      {/* Icon + badge row */}
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:18 }}>
        <div style={{ width:50, height:50, borderRadius:13, background:C.slate,
          display:"flex", alignItems:"center", justifyContent:"center", fontSize:24 }}>
          {f.icon}
        </div>
        <div style={{
          fontSize:10, fontWeight:700, color:C.saffronDark,
          background:C.saffronLight, padding:"3px 10px",
          borderRadius:100, letterSpacing:.8, textTransform:"uppercase",
        }}>Tool {num} of 6</div>
      </div>

      <h3 style={{ fontSize:16.5, fontWeight:700, color:C.text, marginBottom:9 }}>{f.title}</h3>
      <p style={{ fontSize:13.5, color:C.muted, lineHeight:1.78, margin:0 }}>{f.desc}</p>
    </div>
  )
}

function Features() {
  const titleRef = useReveal(0)
  return (
    <section id="features" style={{ padding:"100px 28px", background:C.cream, fontFamily:UI }}>
      <div style={{ maxWidth:1160, margin:"0 auto" }}>
        <div ref={titleRef} style={{ textAlign:"center", marginBottom:64 }}>
          <div style={{ display:"inline-block", fontSize:11, fontWeight:700,
            color:C.saffronDark, textTransform:"uppercase", letterSpacing:2,
            background:C.saffronLight, padding:"4px 14px", borderRadius:100, marginBottom:16 }}>
            Features
          </div>
          <h2 style={{ fontSize:"clamp(28px,4vw,40px)", fontWeight:800,
            color:C.text, margin:"0 0 14px", letterSpacing:-.5 }}>
          Features — Built for{" "}
            <span style={{ color:C.saffronDark, fontFamily:KSH, fontSize:"clamp(30px,4.2vw,42px)" }}>
              kashmiri
            </span>{" "}script
          </h2>
          <p style={{ fontSize:16, color:C.muted, maxWidth:560, margin:"0 auto", lineHeight:1.78 }}>
            Every tool is engineered specifically for right-to-left Nastaliq rendering —
            real A4 layout, cloud sync, PDF export, secure auth, share links, and rich formatting,
            all running natively in your browser. Zero plugins. Zero installs.
          </p>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(300px,1fr))", gap:20 }}>
          {FEATS.map((f,i) => <FeatureCard key={i} f={f} delay={i * 80} num={i+1} />)}
        </div>
      </div>
    </section>
  )
}

// ═══════════════════════════════════════════════════════════════════
//  HOW IT WORKS
// ═══════════════════════════════════════════════════════════════════
const STEPS = [
  { n:"01", icon:"✉️", title:"Create a free account",
    desc:"Sign up with your email. You'll receive a 6-digit OTP to verify in under 30 seconds." },
  { n:"02", icon:"✍️", title:"Start writing in Kashmiri",
    desc:"Open a document and type. Format text, add headings and lists — works exactly like Word." },
  { n:"03", icon:"🚀", title:"Save, export & share",
    desc:"Auto-save keeps work safe. Export as PDF, DOCX, or TXT. Share a public link instantly." },
]

function StepCard({ s, delay }) {
  const ref = useReveal(delay)
  return (
    <div ref={ref} style={{ textAlign:"center" }}>
      <div style={{ fontSize:11, fontWeight:700, color:C.saffron, letterSpacing:2, marginBottom:14 }}>{s.n}</div>
      <div style={{
        width:76, height:76, borderRadius:"50%",
        background:`linear-gradient(135deg, ${C.indigo}, ${C.indigoLight})`,
        display:"flex", alignItems:"center", justifyContent:"center",
        margin:"0 auto 22px", fontSize:30,
      }} className="kw-pulse">{s.icon}</div>
      <h3 style={{ fontSize:17.5, fontWeight:700, color:C.text, marginBottom:11 }}>{s.title}</h3>
      <p style={{ fontSize:14, color:C.muted, lineHeight:1.78, maxWidth:260, margin:"0 auto" }}>{s.desc}</p>
    </div>
  )
}

function HowItWorks() {
  const titleRef = useReveal(0)
  return (
    <section id="how-it-works" style={{ padding:"100px 28px", background:C.white, fontFamily:UI }}>
      <div style={{ maxWidth:1000, margin:"0 auto" }}>
        <div ref={titleRef} style={{ textAlign:"center", marginBottom:64 }}>
          <div style={{ display:"inline-block", fontSize:11, fontWeight:700,
            color:C.saffronDark, textTransform:"uppercase", letterSpacing:2,
            background:C.saffronLight, padding:"4px 14px", borderRadius:100, marginBottom:16 }}>
            how-it-works
          </div>
          <h2 style={{ fontSize:"clamp(28px,4vw,40px)", fontWeight:800,
            color:C.text, margin:"0 0 14px", letterSpacing:-.5 }}>
            Start Writing in 3 Simple Steps
          </h2>
          <p style={{ fontSize:16, color:C.muted, maxWidth:420, margin:"0 auto", lineHeight:1.75 }}>
            From zero to your first Kashmiri document in under two minutes.
          </p>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(260px,1fr))", gap:36, position:"relative" }}>
          {STEPS.map((s,i) => (
            <div key={i} style={{ position:"relative" }}>
              {i < STEPS.length-1 && (
                <div className="kw-connector" style={{
                  position:"absolute", top:56,
                  left:"calc(50% + 50px)", right:"calc(-50% + 50px)",
                  height:2, borderTop:`2px dashed ${C.border}`, display:"none",
                }} />
              )}
              <StepCard s={s} delay={i*120} />
            </div>
          ))}
        </div>
      </div>
      <style>{`@media(min-width:900px){ .kw-connector{display:block!important;} }`}</style>
    </section>
  )
}

// ═══════════════════════════════════════════════════════════════════
//  DOWNLOAD  (with animated counters)
// ═══════════════════════════════════════════════════════════════════
function Download() {
  const titleRef = useReveal(0)
  const btnRef   = useReveal(200)
  const statsRef = useReveal(350)

  return (
    <section id="download" style={{
      padding:"100px 28px",
      background:`linear-gradient(160deg, ${C.indigoDark} 0%, ${C.indigo} 50%, ${C.indigoMid} 85%, ${C.indigoGlass} 100%)`,
      fontFamily:UI, position:"relative", overflow:"hidden",
    }}>
      <ParticleCanvas />
      <div style={{
        position:"absolute", top:-80, left:"50%", transform:"translateX(-50%)",
        width:600, height:350, borderRadius:"50%",
        background:`radial-gradient(ellipse, ${C.saffron}20 0%, transparent 70%)`,
        pointerEvents:"none", zIndex:1,
      }} />
      <div style={{
        position:"absolute", bottom:-30, left:-20,
        fontFamily:KSH, fontSize:160, color:"rgba(255,255,255,.025)",
        lineHeight:1, userSelect:"none", pointerEvents:"none",
        direction:"rtl", zIndex:1,
      }}>وسائل</div>

      <div style={{ maxWidth:860, margin:"0 auto", textAlign:"center", position:"relative", zIndex:2 }}>
        <div ref={titleRef}>
          <div style={{ display:"inline-block", fontSize:11, fontWeight:700,
            color:C.saffron, textTransform:"uppercase", letterSpacing:2,
            background:`${C.saffron}20`, border:`1px solid ${C.saffron}45`,
            padding:"4px 14px", borderRadius:100, marginBottom:20 }}>
            Download
          </div>
          <h2 style={{ fontSize:"clamp(28px,4vw,44px)", fontWeight:800,
            color:C.white, margin:"0 0 16px", letterSpacing:-.5, lineHeight:1.18 }}>
            Kashmiri Tools for Your System
          </h2>
          <p style={{ fontSize:16, color:"rgba(255,255,255,.55)",
            maxWidth:500, margin:"0 auto 50px", lineHeight:1.78 }}>
            Download the Kashmiri keyboard layout, fonts, and reference materials for offline use on Windows.
          </p>
        </div>

        <div ref={btnRef} style={{ display:"flex", gap:18, justifyContent:"center", flexWrap:"wrap", marginBottom:58 }}>
          <a href="../../public/resources/Packagae(KbFonts).zip" download style={{ textDecoration:"none" }}>
            <button style={{
              background:C.saffron, color:C.indigo, border:"none",
              padding:"16px 30px", borderRadius:12, fontSize:14.5, fontWeight:700,
              cursor:"pointer", fontFamily:UI,
              display:"flex", alignItems:"center", gap:12,
              transition:"background .15s, transform .15s",
              boxShadow:`0 6px 28px ${C.saffron}60`,
            }}
            onMouseEnter={e => { e.currentTarget.style.background=C.saffronHover; e.currentTarget.style.transform="translateY(-3px)" }}
            onMouseLeave={e => { e.currentTarget.style.background=C.saffron; e.currentTarget.style.transform="none" }}>
              <span style={{ fontSize:24 }}>⌨️</span>
              <div style={{ textAlign:"left" }}>
                <div>Kashmiri Keyboard + Fonts</div>
                <div style={{ fontSize:11, fontWeight:400, color:"rgba(27,42,74,.65)", marginTop:2 }}>
                  Windows layout package (.zip)
                </div>
              </div>
            </button>
          </a>

          <a href="../../public/resources/kashmiri-alphabet.pdf" download style={{ textDecoration:"none" }}>
            <div style={{
              background:"rgba(255,255,255,.08)", color:C.white,
              border:"1px solid rgba(255,255,255,.2)",
              padding:"16px 30px", borderRadius:12, fontSize:14.5, fontWeight:500,
              display:"flex", alignItems:"center", gap:12, cursor:"pointer",
              transition:"background .15s, transform .15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background="rgba(255,255,255,.14)"; e.currentTarget.style.transform="translateY(-3px)" }}
            onMouseLeave={e => { e.currentTarget.style.background="rgba(255,255,255,.08)"; e.currentTarget.style.transform="none" }}>
              <span style={{ fontSize:24 }}>📄</span>
              <div style={{ textAlign:"left" }}>
                <div>Kashmiri Alphabet PDF</div>
                <div style={{ fontSize:11, fontWeight:400, color:"rgba(255,255,255,.4)", marginTop:2 }}>
                  Reference chart for learners
                </div>
              </div>
            </div>
          </a>
        </div>

        {/* Animated stat counters */}
        <div ref={statsRef} style={{
          display:"flex", justifyContent:"center", flexWrap:"wrap",
          borderTop:"1px solid rgba(255,255,255,.1)", paddingTop:44,
        }}>
          {[
            { label:"Always free",       isText:true,  text:"Free"  },
            { label:"Cloud-connected",     isText:false, num:100, suffix:"%" },
            { label:"Kashmiri", isText:true, text:"Support"},
            { label:"One-click install", isText:true,  text:"Easy"  },
          ].map((s,i,arr) => (
            <div key={i} style={{
              textAlign:"center", padding:"0 36px",
              borderRight: i<arr.length-1 ? "1px solid rgba(255,255,255,.1)" : "none",
            }}>
              <div style={{ fontSize:28, fontWeight:800, color:C.white }}>
                {s.isText ? s.text : <Counter target={s.num} suffix={s.suffix} />}
              </div>
              <div style={{ fontSize:12, color:"rgba(255,255,255,.42)", marginTop:5 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ═══════════════════════════════════════════════════════════════════
//  CONTACT
// ═══════════════════════════════════════════════════════════════════
function Contact() {
  const [form, setForm]     = useState({ name:"", email:"", type:"feedback", message:"" })
  const [status, setStatus] = useState(null)
  const [errors, setErrors] = useState({})
  const leftRef  = useReveal(0)
  const rightRef = useReveal(150)

  const set = field => val => setForm(p => ({ ...p, [field]: val }))

  function validate() {
    const e = {}
    if (!form.name.trim())             e.name    = "Name is required"
    if (!/\S+@\S+\.\S+/.test(form.email)) e.email = "Valid email required"
    if (form.message.trim().length<10) e.message  = "At least 10 characters"
    setErrors(e); return !Object.keys(e).length
  }

  async function handleSubmit(ev) {
  ev.preventDefault(); if (!validate()) return
  setStatus("sending")
  const TYPE_LABELS = {
    feedback: "General Feedback",
    bug:      "Bug Report",
    feature:  "Feature Request",
    business: "Business Inquiry",
  }
  try {
    const res = await fetch(`${API}/contact`, {
      method:"POST", headers:{ "Content-Type":"application/json" },
      body:JSON.stringify({
        fromName: form.name,
        fromEmail: form.email,
        type: form.type,
        subject: `${TYPE_LABELS[form.type] || "Contact"} from ${form.name}`,
        message: form.message,
      }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || "Request failed")
    }
    setStatus("sent")
    setForm({ name:"", email:"", type:"feedback", message:"" })
  } catch {
    setStatus("error")
  }
}

//   async function handleSubmit(ev) {
//     ev.preventDefault(); if (!validate()) return
//     setStatus("sending")
//     // try {
//       const TYPE_LABELS = {
//   feedback: "General Feedback",
//   bug:      "Bug Report",
//   feature:  "Feature Request",
//   business: "Business Inquiry",
// }
// const res = await fetch(`${API}/contact`, {
//   method:"POST", headers:{ "Content-Type":"application/json" },
//   body:JSON.stringify({
//     fromName: form.name,
//     fromEmail: form.email,
//     type: form.type,
//     subject: `${TYPE_LABELS[form.type] || "Contact"} from ${form.name}`,
//     message: form.message,
//   }),
// })
// if (!res.ok) {
//   const data = await res.json().catch(() => ({}))
//   throw new Error(data.error || "Request failed")
// }












//     //   const res = await fetch(`${API}/contact`, {
//     //     method:"POST", headers:{ "Content-Type":"application/json" },
//     //     body:JSON.stringify({ fromName:form.name, fromEmail:form.email, type:form.type, message:form.message }),
//     //   })
//     //   if (!res.ok) throw new Error()
//     //   setStatus("sent")
//     //   setForm({ name:"", email:"", type:"feedback", message:"" })
//     // } catch { setStatus("error") }
//   }

  const inp = (extra={}) => ({
    width:"100%", padding:"10px 14px", border:`1.5px solid ${C.border}`,
    borderRadius:8, fontSize:14, fontFamily:UI, color:C.text,
    background:C.white, outline:"none", boxSizing:"border-box",
    transition:"border-color .2s", ...extra,
  })
  const lbl = { display:"block", fontSize:12.5, fontWeight:600, color:C.muted, marginBottom:6, letterSpacing:.3 }

  return (
    <section id="contact" style={{ padding:"100px 28px", background:C.slate, fontFamily:UI }}>
      <div style={{ maxWidth:980, margin:"0 auto",
        display:"grid", gridTemplateColumns:"1fr 1fr", gap:60, alignItems:"start" }}>

        <div ref={leftRef}>
          <div style={{ display:"inline-block", fontSize:11, fontWeight:700,
            color:C.saffronDark, textTransform:"uppercase", letterSpacing:2,
            background:C.saffronLight, padding:"4px 14px", borderRadius:100, marginBottom:20 }}>
            Contact
          </div>
          <h2 style={{ fontSize:"clamp(26px,3.5vw,38px)", fontWeight:800,
            color:C.text, margin:"0 0 16px", letterSpacing:-.4, lineHeight:1.18 }}>
            We're listening.
          </h2>
          <p style={{ fontSize:15, color:C.muted, lineHeight:1.82, marginBottom:34 }}>
            Found a bug? Have a feature request? Want to collaborate?
            We read every message and respond within 48 hours.
          </p>
          <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
            {[
              { icon:"🐛", title:"Bug Report",       desc:"Tell us what broke — we'll fix it fast"   },
              { icon:"💡", title:"Feature Request",  desc:"Suggest something new for the editor"     },
              { icon:"💬", title:"Feedback",         desc:"Share your experience with Kashur Editor" },
              { icon:"📧", title:"Business Inquiry", desc:"Partner or collaborate with us"           },
            ].map(it => (
              <div key={it.title} style={{ display:"flex", gap:14, alignItems:"flex-start" }}>
                <div style={{ width:42, height:42, borderRadius:11,
                  background:C.white, border:`1px solid ${C.border}`,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:19, flexShrink:0 }}>{it.icon}</div>
                <div>
                  <div style={{ fontWeight:600, fontSize:14, color:C.text }}>{it.title}</div>
                  <div style={{ fontSize:13, color:C.hint, marginTop:3 }}>{it.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div ref={rightRef} style={{ background:C.white, borderRadius:18, padding:"34px 30px",
          border:`1px solid ${C.border}`, boxShadow:"0 10px 40px rgba(27,42,74,.07)" }}>
          {status === "sent" ? (
            <div style={{ textAlign:"center", padding:"44px 0" }}>
              <div style={{ width:62, height:62, borderRadius:"50%", background:"#EAFAF2",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:28, margin:"0 auto 20px" }}>✅</div>
              <h3 style={{ fontSize:20, fontWeight:700, color:C.text, marginBottom:8 }}>Message sent!</h3>
              <p style={{ fontSize:14, color:C.muted }}>Thank you. We'll get back to you within 48 hours.</p>
              <button onClick={() => setStatus(null)} style={{ marginTop:22, background:C.indigo, color:C.white,
                border:"none", padding:"10px 26px", borderRadius:8, fontSize:13,
                cursor:"pointer", fontFamily:UI, fontWeight:600 }}>Send another</button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              <h3 style={{ fontSize:17, fontWeight:700, color:C.text, marginBottom:24 }}>Send a message</h3>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>
                <div>
                  <label style={lbl}>Your name</label>
                  <input value={form.name} onChange={e => set("name")(e.target.value)} placeholder="Ahmad Ali"
                    style={inp({ borderColor: errors.name ? "#E74C3C" : C.border })}
                    onFocus={e => e.target.style.borderColor = C.indigoLight}
                    onBlur={e  => e.target.style.borderColor = errors.name ? "#E74C3C" : C.border} />
                  {errors.name && <span style={{ fontSize:11, color:"#E74C3C" }}>{errors.name}</span>}
                </div>
                <div>
                  <label style={lbl}>Email address</label>
                  <input type="email" value={form.email} onChange={e => set("email")(e.target.value)} placeholder="you@example.com"
                    style={inp({ borderColor: errors.email ? "#E74C3C" : C.border })}
                    onFocus={e => e.target.style.borderColor = C.indigoLight}
                    onBlur={e  => e.target.style.borderColor = errors.email ? "#E74C3C" : C.border} />
                  {errors.email && <span style={{ fontSize:11, color:"#E74C3C" }}>{errors.email}</span>}
                </div>
              </div>
              <div style={{ marginBottom:14 }}>
                <label style={lbl}>Type</label>
                <select value={form.type} onChange={e => set("type")(e.target.value)} style={inp({ cursor:"pointer" })}>
                  <option value="feedback">💬  General Feedback</option>
                  <option value="bug">🐛  Bug Report</option>
                  <option value="feature">💡  Feature Request</option>
                  <option value="business">📧  Business Inquiry</option>
                </select>
              </div>
              <div style={{ marginBottom:22 }}>
                <label style={lbl}>Message</label>
                <textarea value={form.message} onChange={e => set("message")(e.target.value)}
                  placeholder="What's on your mind?" rows={5}
                  style={inp({ resize:"vertical", minHeight:120, borderColor: errors.message ? "#E74C3C" : C.border })}
                  onFocus={e => e.target.style.borderColor = C.indigoLight}
                  onBlur={e  => e.target.style.borderColor = errors.message ? "#E74C3C" : C.border} />
                {errors.message && <span style={{ fontSize:11, color:"#E74C3C" }}>{errors.message}</span>}
              </div>
              <button type="submit" disabled={status==="sending"} style={{
                width:"100%", padding:"13px",
                background: status==="sending" ? C.hint : C.indigo,
                color:C.white, border:"none", borderRadius:9,
                fontSize:14, fontWeight:700,
                cursor: status==="sending" ? "wait" : "pointer",
                fontFamily:UI, transition:"background .15s",
              }}
              onMouseEnter={e => { if(status!=="sending") e.currentTarget.style.background = C.indigoMid }}
              onMouseLeave={e => { if(status!=="sending") e.currentTarget.style.background = C.indigo }}>
                {status==="sending" ? "Sending…" : "Send Message →"}
              </button>
              {status==="error" && (
                <p style={{ fontSize:12, color:"#E74C3C", textAlign:"center", marginTop:10 }}>
                  Something went wrong. Please try again.
                </p>
              )}
            </form>
          )}
        </div>
      </div>
      <style>{`@media(max-width:768px){ #contact>div{grid-template-columns:1fr!important;gap:40px!important;} }`}</style>
    </section>
  )
}

// ═══════════════════════════════════════════════════════════════════
//  FOOTER
// ═══════════════════════════════════════════════════════════════════
function Footer({ onLogin, onSignup }) {
  const yr = new Date().getFullYear()
  const ref = useReveal(0)
  const COLS = [
    { heading:"Product", items:[["Features",()=>goTo("features")],["How It Works",()=>goTo("how-it-works")],["Resources",()=>goTo("download")]] },
    { heading:"Account", items:[["Log In",onLogin],["Sign Up Free",onSignup]] },
    { heading:"Support", items:[["Contact Us",()=>goTo("contact")],["Bug Report",()=>goTo("contact")],["Feature Request",()=>goTo("contact")]] },
  ]
  return (
    <footer style={{ background:C.indigoDark, color:"rgba(255,255,255,.55)", fontFamily:UI, padding:"62px 28px 32px" }}>
      <div ref={ref} style={{ maxWidth:1160, margin:"0 auto" }}>
        <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr", gap:44, marginBottom:52 }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:18 }}>
              <div style={{ width:38, height:38, background:C.saffron, borderRadius:9,
                display:"flex", alignItems:"center", justifyContent:"center" }}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M4 6.5h12M4 10h12M4 13.5h7" stroke={C.indigo} strokeWidth="2.2" strokeLinecap="round"/>
                </svg>
              </div>
              <div>
                <div style={{ fontFamily:KSH, fontSize:15, color:C.white, direction:"rtl", lineHeight:1.3 }}>کٲشُر ایڈیٹر</div>
                <div style={{ fontSize:10, color:"rgba(255,255,255,.32)", letterSpacing:.6 }}>Kashur Word Editor</div>
              </div>
            </div>
            <p style={{ fontSize:13, lineHeight:1.82, maxWidth:270, margin:"0 0 22px" }}>
              A free browser-based Kashmiri word processor with real A4 pages, cloud save, and PDF export.
            </p>
            <div style={{ display:"flex", gap:8 }}>
              {[{ icon:"🐙",label:"GitHub",href:"#" },{ icon:"🐦",label:"Twitter",href:"#" },{ icon:"💬",label:"WhatsApp",href:"#" }].map(s => (
                <a key={s.label} href={s.href} title={s.label} style={{
                  width:34, height:34, borderRadius:8, background:"rgba(255,255,255,.07)",
                  border:"1px solid rgba(255,255,255,.1)",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:15, textDecoration:"none", transition:"background .15s",
                }}
                onMouseEnter={e => e.currentTarget.style.background="rgba(255,255,255,.14)"}
                onMouseLeave={e => e.currentTarget.style.background="rgba(255,255,255,.07)"}>
                  {s.icon}
                </a>
              ))}
            </div>
          </div>
          {COLS.map(col => (
            <div key={col.heading}>
              <div style={{ fontSize:11, fontWeight:700, color:C.white, textTransform:"uppercase", letterSpacing:1.5, marginBottom:18 }}>
                {col.heading}
              </div>
              {col.items.map(([lbl,fn]) => (
                <div key={lbl} style={{ marginBottom:11 }}>
                  <button onClick={fn} style={{ background:"none", border:"none", color:"rgba(255,255,255,.48)", fontSize:13, cursor:"pointer", padding:0, fontFamily:UI, transition:"color .15s" }}
                  onMouseEnter={e => e.currentTarget.style.color=C.saffron}
                  onMouseLeave={e => e.currentTarget.style.color="rgba(255,255,255,.48)"}>
                    {lbl}
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div style={{ borderTop:"1px solid rgba(255,255,255,.08)", paddingTop:26,
          display:"flex", flexDirection:"column", gap:16 }}>

          {/* Developed by */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, flexWrap:"wrap" }}>
            <span style={{ fontSize:12, color:"rgba(255,255,255,.35)", letterSpacing:.4 }}>Developed by</span>
            {[
              { name:"Adfar Nabi",     roll:"15" },
              { name:"Aaqidah Majeed", roll:"24" },
              { name:"Mudasir Saleem", roll:"33" },
            ].map((dev, i, arr) => (
              <span key={dev.name} style={{ display:"inline-flex", alignItems:"center", gap:6 }}>
                <span style={{
                  display:"inline-flex", alignItems:"center", gap:7,
                  background:"rgba(255,255,255,.07)",
                  border:"1px solid rgba(255,255,255,.12)",
                  borderRadius:100, padding:"4px 12px",
                }}>
                  <span style={{
                    width:20, height:20, borderRadius:"50%",
                    background:C.saffron, color:C.indigo,
                    fontSize:9, fontWeight:800,
                    display:"inline-flex", alignItems:"center", justifyContent:"center", flexShrink:0,
                  }}>{dev.roll}</span>
                  <span style={{ fontSize:12.5, color:"rgba(255,255,255,.75)", fontWeight:500 }}>{dev.name}</span>
                </span>
                {i < arr.length - 1 && (
                  <span style={{ color:"rgba(255,255,255,.2)", fontSize:14, margin:"0 2px" }}>·</span>
                )}
              </span>
            ))}
          </div>

          {/* Copyright + links */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:12 }}>
            <span style={{ fontSize:13 }}>© {yr} Kashur Word Editor. All rights reserved.</span>
            <div style={{ display:"flex", gap:22 }}>
              {["Privacy Policy","Terms of Service"].map(l => (
                <button key={l} style={{ background:"none", border:"none", color:"rgba(255,255,255,.32)", fontSize:12, cursor:"pointer", fontFamily:UI }}>{l}</button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <style>{`
        @media(max-width:768px){
          footer>div>div:first-child{grid-template-columns:1fr 1fr!important;}
          footer>div>div:first-child>div:first-child{grid-column:1/-1;}
        }
      `}</style>
    </footer>
  )
}

// ─── BACK TO TOP ──────────────────────────────────────────────────
function BackToTop() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const h = () => setShow(window.scrollY > 400)
    window.addEventListener("scroll", h)
    return () => window.removeEventListener("scroll", h)
  }, [])
  if (!show) return null
  return (
    <button onClick={() => window.scrollTo({ top:0, behavior:"smooth" })} style={{
      position:"fixed", bottom:28, right:28, width:44, height:44,
      borderRadius:"50%", background:C.saffron, color:C.indigo,
      border:"none", fontSize:18, fontWeight:700, cursor:"pointer",
      boxShadow:`0 6px 24px ${C.saffron}70`, zIndex:999,
      display:"flex", alignItems:"center", justifyContent:"center",
      transition:"background .15s, transform .15s",
    }}
    onMouseEnter={e => { e.currentTarget.style.background=C.saffronHover; e.currentTarget.style.transform="scale(1.1)" }}
    onMouseLeave={e => { e.currentTarget.style.background=C.saffron; e.currentTarget.style.transform="none" }}>
      ↑
    </button>
  )
}

// ═══════════════════════════════════════════════════════════════════
//  ROOT
// ═══════════════════════════════════════════════════════════════════
export default function LandingPage({ onLogin, onSignup }) {
  return (
    <div style={{ fontFamily:UI }}>
      <FontLoader />
      <AnimStyles />
      {/* Saffron top accent bar */}
      <div style={{
        position:"fixed", top:0, left:0, right:0, height:3, zIndex:1100,
        background:`linear-gradient(90deg, ${C.saffron}, ${C.saffronHover}, ${C.saffron})`,
        backgroundSize:"200% 100%",
        animation:"kwShimmer 3s linear infinite",
      }} />
      <Navbar   onLogin={onLogin} onSignup={onSignup} />
      <Hero     onSignup={onSignup} onLogin={onLogin} />
      <WaveDivider topColor={C.indigoMid} bottomColor={C.cream} />
      <Features />
      <HowItWorks />
      <WaveDivider topColor={C.white} bottomColor={C.indigoDark} />
      <Download />
      <WaveDivider flip={true} topColor={C.indigoDark} bottomColor={C.slate} />
      <Contact />
      <Footer   onLogin={onLogin} onSignup={onSignup} />
      <BackToTop />
    </div>
  )
}