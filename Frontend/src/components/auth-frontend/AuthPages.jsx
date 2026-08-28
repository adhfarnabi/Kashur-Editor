// AuthPages.jsx
// All authentication screens in one file:
//   <SignupPage />          — name, email, phone, password, confirm password + CAPTCHA
//   <LoginPage />           — email, password
//   <OTPVerifyPage />       — 6-digit OTP input
//   <ForgotPasswordPage />  — email input
//   <ResetPasswordPage />   — OTP + new password
//
// NEW in this version:
//   ✅ CAPTCHA / "I'm not a Robot" on SignupPage (self-contained, no 3rd-party keys needed)
//   ✅ Dark mode support via `dark` prop passed from App.jsx

import { useState, useRef, useEffect, useCallback } from "react"

const RECAPTCHA_SITE_KEY = "6LdYY5QtAAAAAFUCbloz1jlFOIlMHF6VGa4hTxcR"
import { useAuth } from "./AuthContext"

const API_BASE = "http://localhost:3001/api"

// ─── PALETTE (light + dark) ───────────────────────────────────────────────────
function palette(dark) {
  return {
    B:      dark ? "#4a90d9"   : "#2b579a",
    BL:     dark ? "#1e3a5f"   : "#e8f0fa",
    ERR:    dark ? "#f87171"   : "#c0392b",
    ERRL:   dark ? "#3b1010"   : "#fdecea",
    SUC:    dark ? "#34d399"   : "#1a7f4e",
    SUCL:   dark ? "#052e16"   : "#e8f5ee",
    BORDER: dark ? "#374151"   : "#e2e8f0",
    BG:     dark ? "#111827"   : "#f0f4f8",
    CARD:   dark ? "#1f2937"   : "#ffffff",
    TEXT:   dark ? "#f3f4f6"   : "#1f2937",
    SUB:    dark ? "#9ca3af"   : "#6b7280",
    INPUT:  dark ? "#374151"   : "#ffffff",
    LABEL:  dark ? "#d1d5db"   : "#374151",
  }
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
async function apiFetch(path, method = "POST", body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json()
  if (!res.ok) throw Object.assign(new Error(data.error || "Request failed"), { code: data.code, data })
  return data
}

function getPasswordStrength(pw) {
  if (!pw) return { score: 0, label: "", color: "#e5e7eb" }
  let score = 0
  if (pw.length >= 8)                 score++
  if (pw.length >= 12)                score++
  if (/[A-Z]/.test(pw))              score++
  if (/[0-9]/.test(pw))              score++
  if (/[^A-Za-z0-9]/.test(pw))      score++
  const levels = [
    { label: "",            color: "#e5e7eb" },
    { label: "Weak",        color: "#e74c3c" },
    { label: "Fair",        color: "#f39c12" },
    { label: "Good",        color: "#f1c40f" },
    { label: "Strong",      color: "#2ecc71" },
    { label: "Very Strong", color: "#27ae60" },
  ]
  return { score, ...levels[score] }
}

// ══════════════════════════════════════════════════════════════════════════════
//  GOOGLE reCAPTCHA v2 WIDGET
//  Uses the real Google reCAPTCHA v2 checkbox.
// ══════════════════════════════════════════════════════════════════════════════
function CaptchaWidget({ onVerified, dark }) {
  const containerRef = useRef(null)
  const widgetIdRef  = useRef(null)

  useEffect(() => {
    function renderWidget() {
      if (!containerRef.current || widgetIdRef.current !== null) return
      try {
        widgetIdRef.current = window.grecaptcha.render(containerRef.current, {
          sitekey:  RECAPTCHA_SITE_KEY,
          theme:    dark ? "dark" : "light",
          callback: (token) => { if (token) onVerified(true, token) },
          "expired-callback": () => { onVerified(false, null) },
          "error-callback":   () => { onVerified(false, null) },
        })
      } catch (e) { console.warn("reCAPTCHA render error:", e) }
    }

    if (window.grecaptcha && window.grecaptcha.render) {
      renderWidget()
    } else {
      const timer = setInterval(() => {
        if (window.grecaptcha && window.grecaptcha.render) { clearInterval(timer); renderWidget() }
      }, 200)
      return () => clearInterval(timer)
    }
  }, [])

  return (
    <div style={{ marginBottom: 18 }}>
      <div ref={containerRef} style={{ display: "flex", justifyContent: "center", minHeight: 78 }} />
    </div>
  )
}

// ─── SHARED UI ────────────────────────────────────────────────────────────────
function AuthCard({ title, subtitle, children, dark }) {
  const P = palette(dark)
  return (
    <div style={{ minHeight:"100vh", background: P.BG, display:"flex", alignItems:"center", justifyContent:"center", padding:16, fontFamily:"Segoe UI,system-ui,sans-serif" }}>
      <div style={{ background: P.CARD, borderRadius:16, width:"100%", maxWidth:440, boxShadow:`0 4px 32px ${dark?"rgba(0,0,0,.4)":"rgba(0,0,0,.12)"}`, overflow:"hidden" }}>
        {/* Header */}
        <div style={{ background: P.B, padding:"28px 32px", textAlign:"center" }}>
          <div style={{ fontSize:32, marginBottom:6 }}>📝</div>
          <h1 style={{ color:"#fff", margin:0, fontSize:22, fontWeight:700 }}>کٲشُر ورڈ ایڈیٹر</h1>
          <p style={{ color:"rgba(255,255,255,.7)", margin:"4px 0 0", fontSize:12 }}>Kashur Word Editor</p>
        </div>
        {/* Body */}
        <div style={{ padding:"28px 32px" }}>
          {title    && <h2 style={{ margin:"0 0 4px", fontSize:20, fontWeight:600, color: P.TEXT }}>{title}</h2>}
          {subtitle && <p  style={{ margin:"0 0 20px", fontSize:14, color: P.SUB }}>{subtitle}</p>}
          {children}
        </div>
      </div>
    </div>
  )
}

function Field({ label, type="text", value, onChange, placeholder, error, hint, autoFocus, dark }) {
  const P = palette(dark)
  const [show, setShow] = useState(false)
  const isPassword = type === "password"
  return (
    <div style={{ marginBottom:16 }}>
      {label && <label style={{ display:"block", fontSize:13, fontWeight:500, color: P.LABEL, marginBottom:5 }}>{label}</label>}
      <div style={{ position:"relative" }}>
        <input
          autoFocus={autoFocus}
          type={isPassword ? (show?"text":"password") : type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={{
            width:"100%", padding:"10px 14px", paddingRight: isPassword ? 44 : 14,
            border:`1.5px solid ${error ? P.ERR : P.BORDER}`, borderRadius:8,
            fontSize:14, outline:"none", boxSizing:"border-box",
            background: error ? P.ERRL : P.INPUT, color: P.TEXT,
            transition:"border-color .2s",
          }}
          onFocus={e => { e.target.style.borderColor = error ? P.ERR : P.B }}
          onBlur={e  => { e.target.style.borderColor = error ? P.ERR : P.BORDER }}
        />
        {isPassword && (
          <button type="button" onClick={() => setShow(s=>!s)}
            style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", fontSize:16, color: P.SUB }}>
            {show ? "🙈" : "👁"}
          </button>
        )}
      </div>
      {error && <p style={{ margin:"4px 0 0", fontSize:12, color: P.ERR }}>{error}</p>}
      {hint  && !error && <p style={{ margin:"4px 0 0", fontSize:12, color: P.SUB }}>{hint}</p>}
    </div>
  )
}

function SubmitBtn({ children, loading, disabled, dark }) {
  const P = palette(dark)
  return (
    <button type="submit" disabled={loading||disabled}
      style={{ width:"100%", padding:"11px", background: loading||disabled ? "#93c5fd" : P.B, color:"#fff", border:"none", borderRadius:8, fontSize:15, fontWeight:600, cursor: loading||disabled ? "not-allowed":"pointer", transition:"background .2s", marginTop:4 }}>
      {loading ? "Please wait…" : children}
    </button>
  )
}

function Alert({ type="error", message, dark }) {
  if (!message) return null
  const P = palette(dark)
  const styles = {
    error:   { bg: P.ERRL, color: P.ERR,  border: dark?"#7f1d1d":"#fca5a5", icon: "⚠️" },
    success: { bg: P.SUCL, color: P.SUC,  border: dark?"#14532d":"#86efac", icon: "✅" },
    info:    { bg: P.BL,   color: P.B,    border: dark?"#1e3a5f":"#93c5fd", icon: "ℹ️" },
  }
  const s = styles[type] || styles.error
  return (
    <div style={{ background:s.bg, border:`1px solid ${s.border}`, borderRadius:8, padding:"10px 14px", marginBottom:16, fontSize:13, color:s.color, display:"flex", gap:8, alignItems:"flex-start" }}>
      <span style={{ flexShrink:0 }}>{s.icon}</span>
      <span dangerouslySetInnerHTML={{ __html: message }}/>
    </div>
  )
}

function Divider({ children, dark }) {
  const P = palette(dark)
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, margin:"18px 0" }}>
      <div style={{ flex:1, height:1, background: P.BORDER }}/>
      <span style={{ fontSize:12, color: P.SUB }}>{children}</span>
      <div style={{ flex:1, height:1, background: P.BORDER }}/>
    </div>
  )
}

function LinkBtn({ children, onClick }) {
  return (
    <button type="button" onClick={onClick}
      style={{ background:"none", border:"none", color:"#2b579a", cursor:"pointer", fontSize:13, fontWeight:500, textDecoration:"underline", padding:0 }}>
      {children}
    </button>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
//  SIGNUP PAGE  ✅ now includes CAPTCHA
// ══════════════════════════════════════════════════════════════════════════════
export function SignupPage({ onGoToLogin, onNeedVerify, dark }) {
  const [form,          setForm]          = useState({ name:"", email:"", phone:"", password:"", confirm:"" })
  const [errors,        setErrors]        = useState({})
  const [alert,         setAlert]         = useState(null)
  const [loading,       setLoading]       = useState(false)
  const [captchaVerified, setCaptchaVerified] = useState(false)
  const [captchaToken,    setCaptchaToken]    = useState(null)

  const strength = getPasswordStrength(form.password)
  const P = palette(dark)

  function set(field) { return v => setForm(p=>({...p,[field]:v})) }

  function validate() {
    const e = {}
    if (!form.name.trim() || form.name.trim().length < 2) e.name = "Name must be at least 2 characters"
    if (!form.email || !/^\S+@\S+\.\S+$/.test(form.email)) e.email = "Valid email is required"
    if (!form.password) e.password = "Password is required"
    else if (form.password.length < 8)              e.password = "At least 8 characters"
    else if (!/[A-Z]/.test(form.password))          e.password = "Must contain an uppercase letter"
    else if (!/[0-9]/.test(form.password))          e.password = "Must contain a number"
    if (form.password && form.confirm && form.password !== form.confirm) e.confirm = "Passwords do not match"
    if (!form.confirm) e.confirm = "Please confirm your password"
    if (!captchaVerified) e.captcha = "Please complete the CAPTCHA verification"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return
    setLoading(true); setAlert(null)
    try {
      const data = await apiFetch("/auth/signup", "POST", {
        name: form.name.trim(), email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(), password: form.password, confirmPassword: form.confirm,
        captchaToken,
      })
      onNeedVerify({ email: data.email, purpose: "verify", message: data.message })
    } catch (err) {
      if (err.code === "ALREADY_REGISTERED") {
        setAlert({ type:"info", message:"This email is already registered. Please log in instead." })
      } else {
        setAlert({ type:"error", message: err.message })
      }
    }
    setLoading(false)
  }

  return (
    <AuthCard dark={dark} title="Create Account" subtitle="Sign up for your free account">
      <Alert dark={dark} {...(alert||{})} message={alert?.message}/>
      <form onSubmit={handleSubmit} noValidate>
        <Field dark={dark} label="Full Name" value={form.name} onChange={set("name")} placeholder="Your full name" error={errors.name} autoFocus/>
        <Field dark={dark} label="Email Address" type="email" value={form.email} onChange={set("email")} placeholder="you@example.com" error={errors.email}/>
        <Field dark={dark} label="Phone Number (optional)" type="tel" value={form.phone} onChange={set("phone")} placeholder="+92 300 0000000"/>
        <Field dark={dark} label="Password" type="password" value={form.password} onChange={set("password")} placeholder="Min 8 chars, 1 uppercase, 1 number" error={errors.password}/>

        {/* Password strength bar */}
        {form.password && (
          <div style={{ marginTop:-10, marginBottom:14 }}>
            <div style={{ height:4, background: dark?"#374151":"#e5e7eb", borderRadius:2, overflow:"hidden" }}>
              <div style={{ height:"100%", width:`${(strength.score/5)*100}%`, background:strength.color, transition:"width .3s,background .3s" }}/>
            </div>
            {strength.label && <span style={{ fontSize:11, color:strength.color, fontWeight:500 }}>{strength.label}</span>}
          </div>
        )}

        <Field dark={dark} label="Confirm Password" type="password" value={form.confirm} onChange={set("confirm")} placeholder="Re-enter your password" error={errors.confirm}/>

        {/* ── CAPTCHA ── */}
        <div style={{ marginBottom: errors.captcha ? 4 : 0 }}>
          <CaptchaWidget dark={dark} onVerified={(v, token) => { setCaptchaVerified(v); setCaptchaToken(token || null); setErrors(prev => ({ ...prev, captcha: undefined })) }} />
          {errors.captcha && (
            <p style={{ margin:"0 0 12px", fontSize:12, color: P.ERR }}>⚠️ {errors.captcha}</p>
          )}
        </div>

        <SubmitBtn dark={dark} loading={loading} disabled={!captchaVerified}>
          Create Account
        </SubmitBtn>
      </form>
      <Divider dark={dark}>already have an account?</Divider>
      <div style={{ textAlign:"center" }}>
        <LinkBtn onClick={onGoToLogin}>Log in instead</LinkBtn>
      </div>
    </AuthCard>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
//  OTP VERIFY PAGE
// ══════════════════════════════════════════════════════════════════════════════
export function OTPVerifyPage({ email, purpose = "verify", onSuccess, onGoToLogin, dark }) {
  const { login } = useAuth()
  const P = palette(dark)
  const [otp,       setOtp]       = useState(["","","","","",""])
  const [alert,     setAlert]     = useState(null)
  const [loading,   setLoading]   = useState(false)
  const [resending, setResending] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const inputRefs = useRef([])

  useEffect(() => { inputRefs.current[0]?.focus() }, [])
  useEffect(() => {
    if (countdown <= 0) return
    const t = setTimeout(() => setCountdown(c => c-1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  function handleOtpChange(i, val) {
    const digit = val.replace(/\D/g, "").slice(-1)
    const next = [...otp]; next[i] = digit; setOtp(next)
    if (digit && i < 5) inputRefs.current[i+1]?.focus()
  }
  function handleKeyDown(i, e) {
    if (e.key === "Backspace" && !otp[i] && i > 0) inputRefs.current[i-1]?.focus()
  }
  function handlePaste(e) {
    e.preventDefault()
    const text = e.clipboardData.getData("text").replace(/\D/g,"").slice(0,6)
    const next = [...otp]
    text.split("").forEach((d,i) => { if(i<6) next[i]=d })
    setOtp(next)
    inputRefs.current[Math.min(text.length, 5)]?.focus()
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const code = otp.join("")
    if (code.length !== 6) { setAlert({type:"error", message:"Please enter the complete 6-digit OTP"}); return }
    setLoading(true); setAlert(null)
    try {
      const data = await apiFetch("/auth/verify-otp", "POST", { email, otp: code })
      setAlert({ type:"success", message: data.message || "Email verified!" })
      setTimeout(() => { login(data.user, data.token); onSuccess?.() }, 800)
    } catch (err) {
      setAlert({ type:"error", message: err.message })
      if (err.code === "OTP_EXPIRED" || err.code === "OTP_LOCKED") {
        setOtp(["","","","","",""]); inputRefs.current[0]?.focus()
      }
    }
    setLoading(false)
  }

  async function handleResend() {
    setResending(true); setAlert(null)
    try {
      const data = await apiFetch("/auth/resend-otp", "POST", { email, purpose })
      setAlert({ type:"success", message: data.message })
      setCountdown(60); setOtp(["","","","","",""]); inputRefs.current[0]?.focus()
    } catch (err) {
      if (err.data?.secondsLeft) setCountdown(err.data.secondsLeft)
      setAlert({ type:"error", message: err.message })
    }
    setResending(false)
  }

  const isVerify = purpose === "verify"

  return (
    <AuthCard dark={dark} title={isVerify ? "Verify Your Email" : "Enter Reset OTP"} subtitle={`We sent a 6-digit code to ${email}`}>
      <Alert dark={dark} {...(alert||{})} message={alert?.message}/>
      <form onSubmit={handleSubmit}>
        <div style={{ display:"flex", gap:10, justifyContent:"center", marginBottom:24 }}>
          {otp.map((digit, i) => (
            <input key={i} ref={el => inputRefs.current[i] = el}
              type="text" inputMode="numeric" maxLength={1} value={digit}
              onChange={e => handleOtpChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)} onPaste={handlePaste}
              style={{
                width:48, height:56, textAlign:"center", fontSize:22, fontWeight:700,
                border:`2px solid ${digit ? P.B : P.BORDER}`, borderRadius:10,
                outline:"none", background: digit ? P.BL : P.INPUT, color: P.B,
                transition:"all .15s",
              }}
              onFocus={e => e.target.style.borderColor = P.B}
              onBlur={e  => e.target.style.borderColor = digit ? P.B : P.BORDER}
            />
          ))}
        </div>
        <SubmitBtn dark={dark} loading={loading}>{isVerify ? "Verify & Continue" : "Verify OTP"}</SubmitBtn>
      </form>
      <div style={{ textAlign:"center", marginTop:16 }}>
        {countdown > 0 ? (
          <span style={{ fontSize:13, color: P.SUB }}>Resend OTP in {countdown}s</span>
        ) : (
          <LinkBtn onClick={handleResend} disabled={resending}>{resending ? "Sending…" : "Resend OTP"}</LinkBtn>
        )}
      </div>
      {onGoToLogin && (
        <div style={{ textAlign:"center", marginTop:8 }}>
          <LinkBtn onClick={onGoToLogin}>Back to Login</LinkBtn>
        </div>
      )}
    </AuthCard>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
//  LOGIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
export function LoginPage({ onGoToSignup, onNeedVerify, onForgotPassword, onSuccess, dark }) {
  const { login }  = useAuth()
  const P = palette(dark)
  const [email,    setEmail]    = useState("")
  const [password, setPassword] = useState("")
  const [errors,   setErrors]   = useState({})
  const [alert,    setAlert]    = useState(null)
  const [loading,  setLoading]  = useState(false)

  function validate() {
    const e = {}
    if (!email    || !/^\S+@\S+\.\S+$/.test(email)) e.email    = "Valid email is required"
    if (!password)                                   e.password = "Password is required"
    setErrors(e); return Object.keys(e).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return
    setLoading(true); setAlert(null)
    try {
      const data = await apiFetch("/auth/login", "POST", { email: email.trim().toLowerCase(), password })
      login(data.user, data.token); onSuccess?.()
    } catch (err) {
      if (err.code === "NOT_FOUND") {
        setAlert({ type:"info", message:"No account found. Please sign up first." })
      } else if (err.code === "EMAIL_NOT_VERIFIED") {
        onNeedVerify?.({ email: email.trim().toLowerCase(), purpose:"verify", message: err.message })
      } else {
        setAlert({ type:"error", message: err.message })
      }
    }
    setLoading(false)
  }

  return (
    <AuthCard dark={dark} title="Welcome Back" subtitle="Log in to your account">
      <Alert dark={dark} {...(alert||{})} message={alert?.message}/>
      <form onSubmit={handleSubmit} noValidate>
        <Field dark={dark} label="Email Address" type="email" value={email} onChange={setEmail} placeholder="you@example.com" error={errors.email} autoFocus/>
        <Field dark={dark} label="Password" type="password" value={password} onChange={setPassword} placeholder="Your password" error={errors.password}/>
        <div style={{ textAlign:"right", marginTop:-8, marginBottom:16 }}>
          <LinkBtn onClick={onForgotPassword}>Forgot password?</LinkBtn>
        </div>
        <SubmitBtn dark={dark} loading={loading}>Log In</SubmitBtn>
      </form>
      <Divider dark={dark}>don't have an account?</Divider>
      <div style={{ textAlign:"center" }}>
        <LinkBtn onClick={onGoToSignup}>Create an account</LinkBtn>
      </div>
    </AuthCard>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
//  FORGOT PASSWORD PAGE
// ══════════════════════════════════════════════════════════════════════════════
export function ForgotPasswordPage({ onGoToLogin, onOtpSent, dark }) {
  const P = palette(dark)
  const [email,   setEmail]   = useState("")
  const [error,   setError]   = useState("")
  const [alert,   setAlert]   = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) { setError("Valid email is required"); return }
    setLoading(true); setAlert(null); setError("")
    try {
      const data = await apiFetch("/auth/forgot-password", "POST", { email: email.trim().toLowerCase() })
      setAlert({ type:"success", message: data.message })
      setTimeout(() => onOtpSent?.({ email: data.email }), 1000)
    } catch (err) {
      if (err.code === "NOT_FOUND") {
        setAlert({ type:"info", message:"No account found with this email. Please sign up." })
      } else {
        setAlert({ type:"error", message: err.message })
      }
    }
    setLoading(false)
  }

  return (
    <AuthCard dark={dark} title="Forgot Password" subtitle="Enter your email and we'll send you a reset code">
      <Alert dark={dark} {...(alert||{})} message={alert?.message}/>
      <form onSubmit={handleSubmit} noValidate>
        <Field dark={dark} label="Email Address" type="email" value={email} onChange={setEmail} placeholder="you@example.com" error={error} autoFocus/>
        <SubmitBtn dark={dark} loading={loading}>Send Reset OTP</SubmitBtn>
      </form>
      <Divider dark={dark}/>
      <div style={{ textAlign:"center" }}>
        <LinkBtn onClick={onGoToLogin}>Back to Login</LinkBtn>
      </div>
    </AuthCard>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
//  RESET PASSWORD PAGE
// ══════════════════════════════════════════════════════════════════════════════
export function ResetPasswordPage({ email, onSuccess, onGoToLogin, dark }) {
  const { login }  = useAuth()
  const P = palette(dark)
  const [otp,      setOtp]      = useState("")
  const [password, setPassword] = useState("")
  const [confirm,  setConfirm]  = useState("")
  const [errors,   setErrors]   = useState({})
  const [alert,    setAlert]    = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [resending,setResending]= useState(false)
  const [countdown,setCountdown]= useState(0)
  const strength = getPasswordStrength(password)

  useEffect(() => {
    if (countdown <= 0) return
    const t = setTimeout(() => setCountdown(c => c-1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  function validate() {
    const e = {}
    if (!otp || otp.trim().length !== 6) e.otp = "Enter the 6-digit OTP"
    if (!password)                        e.password = "New password is required"
    else if (password.length < 8)         e.password = "At least 8 characters"
    else if (!/[A-Z]/.test(password))     e.password = "Must contain an uppercase letter"
    else if (!/[0-9]/.test(password))     e.password = "Must contain a number"
    if (password && confirm && password !== confirm) e.confirm = "Passwords do not match"
    setErrors(e); return Object.keys(e).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return
    setLoading(true); setAlert(null)
    try {
      const data = await apiFetch("/auth/reset-password", "POST", {
        email, otp: otp.trim(), newPassword: password, confirmPassword: confirm,
      })
      setAlert({ type:"success", message: data.message })
      setTimeout(() => { login(data.user, data.token); onSuccess?.() }, 800)
    } catch (err) {
      setAlert({ type:"error", message: err.message })
      if (err.code === "OTP_EXPIRED" || err.code === "OTP_LOCKED") setOtp("")
    }
    setLoading(false)
  }

  async function handleResend() {
    setResending(true); setAlert(null)
    try {
      const data = await apiFetch("/auth/resend-otp", "POST", { email, purpose:"reset" })
      setAlert({ type:"success", message: data.message })
      setCountdown(60); setOtp("")
    } catch (err) {
      if (err.data?.secondsLeft) setCountdown(err.data.secondsLeft)
      setAlert({ type:"error", message: err.message })
    }
    setResending(false)
  }

  return (
    <AuthCard dark={dark} title="Reset Password" subtitle={`Enter the OTP sent to ${email}`}>
      <Alert dark={dark} {...(alert||{})} message={alert?.message}/>
      <form onSubmit={handleSubmit} noValidate>
        <Field dark={dark} label="OTP Code" value={otp} onChange={setOtp} placeholder="6-digit code from email" error={errors.otp} autoFocus/>
        <Field dark={dark} label="New Password" type="password" value={password} onChange={setPassword} placeholder="Min 8 chars, 1 uppercase, 1 number" error={errors.password}/>
        {password && (
          <div style={{ marginTop:-10, marginBottom:14 }}>
            <div style={{ height:4, background: dark?"#374151":"#e5e7eb", borderRadius:2, overflow:"hidden" }}>
              <div style={{ height:"100%", width:`${(strength.score/5)*100}%`, background:strength.color, transition:"width .3s" }}/>
            </div>
            {strength.label && <span style={{ fontSize:11, color:strength.color, fontWeight:500 }}>{strength.label}</span>}
          </div>
        )}
        <Field dark={dark} label="Confirm New Password" type="password" value={confirm} onChange={setConfirm} placeholder="Re-enter new password" error={errors.confirm}/>
        <SubmitBtn dark={dark} loading={loading}>Reset Password</SubmitBtn>
      </form>
      <div style={{ textAlign:"center", marginTop:14 }}>
        {countdown > 0 ? (
          <span style={{ fontSize:13, color: P.SUB }}>Resend in {countdown}s</span>
        ) : (
          <LinkBtn onClick={handleResend}>{resending ? "Sending…" : "Resend OTP"}</LinkBtn>
        )}
      </div>
      <div style={{ textAlign:"center", marginTop:8 }}>
        <LinkBtn onClick={onGoToLogin}>Back to Login</LinkBtn>
      </div>
    </AuthCard>
  )
}