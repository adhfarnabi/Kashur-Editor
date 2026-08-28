// App.jsx — Root component with full auth flow + public share view
//
// NEW in this version:
//   ✅ Dark Mode — global toggle, persisted to localStorage, propagated via DarkModeContext
//   ✅ Logout Confirmation — custom modal instead of direct logout
//
// Screens:
//   home | login | signup | verify | forgot | reset | dashboard | editor
//   + public /view/:token route (no auth required)

import { useState, useEffect, createContext, useContext } from "react"
import { AuthProvider, useAuth } from "./components/auth-frontend/AuthContext"
import {
  LoginPage, SignupPage, OTPVerifyPage,
  ForgotPasswordPage, ResetPasswordPage,
} from "./components/auth-frontend/AuthPages"
import Dashboard    from "./components/Dashboard"
import UrduEditor   from "./components/KashurEditor"
import PublicView   from "./components/PublicView"
import LandingPage  from "./components/LandingPage"
import AdminApp     from "./admin/AdminApp" // ADMIN PANEL ADDITION

// ══════════════════════════════════════════════════════════════════════════════
//  DARK MODE CONTEXT
//  Usage anywhere:  const { dark, toggleDark } = useDarkMode()
// ══════════════════════════════════════════════════════════════════════════════
export const DarkModeContext = createContext({ dark: false, toggleDark: () => {} })
export const useDarkMode = () => useContext(DarkModeContext)

function DarkModeProvider({ children }) {
  // Persist preference in localStorage; default to system preference
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem("kashur-dark-mode")
    if (saved !== null) return saved === "true"
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false
  })

  useEffect(() => {
    localStorage.setItem("kashur-dark-mode", String(dark))
    // Apply CSS class on <html> so global CSS variables can react
    if (dark) {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }, [dark])

  const toggleDark = () => setDark(v => !v)

  return (
    <DarkModeContext.Provider value={{ dark, toggleDark }}>
      {/* Inject global dark-mode CSS variables */}
      <style>{`
        :root {
          --bg-app:     #f0f4f8;
          --bg-card:    #ffffff;
          --bg-header:  #2b579a;
          --text-main:  #1f2937;
          --text-sub:   #6b7280;
          --border:     #e2e8f0;
          --input-bg:   #ffffff;
          --shadow:     rgba(0,0,0,.12);
        }
        html.dark {
          --bg-app:     #111827;
          --bg-card:    #1f2937;
          --bg-header:  #1e3a5f;
          --text-main:  #f3f4f6;
          --text-sub:   #9ca3af;
          --border:     #374151;
          --input-bg:   #374151;
          --shadow:     rgba(0,0,0,.4);
        }
        /* Smooth transition for all colour changes */
        *, *::before, *::after {
          transition: background-color .2s, border-color .2s, color .15s;
        }
      `}</style>
      {children}
    </DarkModeContext.Provider>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
//  LOGOUT CONFIRMATION MODAL
// ══════════════════════════════════════════════════════════════════════════════
function LogoutModal({ onConfirm, onCancel, dark }) {
  const bg    = dark ? "#1f2937" : "#ffffff"
  const text  = dark ? "#f3f4f6" : "#1f2937"
  const sub   = dark ? "#9ca3af" : "#6b7280"
  const overlay = "rgba(0,0,0,0.55)"

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}
      style={{
        position: "fixed", inset: 0, background: overlay,
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 999999, fontFamily: "Segoe UI, system-ui, sans-serif",
      }}
    >
      <div style={{
        background: bg, borderRadius: 16, padding: "32px 28px",
        width: "100%", maxWidth: 380,
        boxShadow: "0 20px 60px rgba(0,0,0,.35)",
        textAlign: "center",
        animation: "modalPop .2s cubic-bezier(.34,1.56,.64,1)",
      }}>
        <style>{`@keyframes modalPop{from{transform:scale(.85);opacity:0}to{transform:scale(1);opacity:1}}`}</style>

        {/* Icon */}
        <div style={{ fontSize: 48, marginBottom: 12 }}>🚪</div>

        {/* Title */}
        <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700, color: text }}>
          Log Out?
        </h2>

        {/* Message */}
        <p style={{ margin: "0 0 28px", fontSize: 14, color: sub, lineHeight: 1.6 }}>
          Are you sure you want to log out of <strong style={{ color: text }}>کٲشُر ورڈ ایڈیٹر</strong>?
          <br />Any unsaved changes will be lost.
        </p>

        {/* Buttons */}
        <div style={{ display: "flex", gap: 12 }}>
          {/* Cancel */}
          <button
            onClick={onCancel}
            style={{
              flex: 1, padding: "10px 0", borderRadius: 10,
              border: `1.5px solid ${dark ? "#374151" : "#e2e8f0"}`,
              background: "transparent", color: text,
              fontSize: 14, fontWeight: 600, cursor: "pointer",
            }}
            onMouseEnter={e => e.currentTarget.style.background = dark ? "#374151" : "#f3f4f6"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
          >
            Stay Logged In
          </button>

          {/* Confirm */}
          <button
            onClick={onConfirm}
            style={{
              flex: 1, padding: "10px 0", borderRadius: 10,
              border: "none", background: "#c0392b", color: "#fff",
              fontSize: 14, fontWeight: 600, cursor: "pointer",
            }}
            onMouseEnter={e => e.currentTarget.style.background = "#a93226"}
            onMouseLeave={e => e.currentTarget.style.background = "#c0392b"}
          >
            Yes, Log Out
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Check if current URL is a public share link ──────────────────────────────
function getShareToken() {
  const path  = window.location.pathname
  const match = path.match(/^\/view\/([a-f0-9]{64})$/i)
  return match ? match[1] : null
}

function InnerApp() {
  const { user, isLoading, logout } = useAuth()
  const { dark, toggleDark }        = useDarkMode()

  const [screen,         setScreen]         = useState("home")
  const [verifyState,    setVerifyState]    = useState(null)
  const [resetEmail,     setResetEmail]     = useState("")
  const [editDocId,      setEditDocId]      = useState(null)
  const [showLogoutModal, setShowLogoutModal] = useState(false)

  // Whether the person has actually proceeded past the Landing page in THIS
  // session (by clicking Log In / Sign Up, or by logging in successfully).
  // This is intentionally NOT persisted — every time the app is opened or
  // reloaded it should land on the Landing page first, even if there's a
  // valid saved session, rather than jumping straight to the Dashboard.
  const [enteredApp, setEnteredApp] = useState(false)

  // ── Public share view — no auth, no nav ──────────────────────────────────
  const shareToken = getShareToken()
  if (shareToken) return <PublicView token={shareToken}/>

  // ── Loading splash ────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background: dark ? "#111827" : "#f0f4f8", fontFamily:"Segoe UI,sans-serif" }}>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:48, marginBottom:12 }}>📝</div>
          <div style={{ width:36, height:36, border:`3px solid ${dark?"#374151":"#e2e8f0"}`, borderTopColor:"#2b579a", borderRadius:"50%", animation:"spin .7s linear infinite", margin:"0 auto" }}/>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          <p style={{ color: dark ? "#9ca3af" : "#6b7280", marginTop:12, fontSize:14 }}>براہِ کرم انتظار کریو، کٲشُر وٲرڈ ایڈیٹَر لوڈ گژھان چھ…</p>
        </div>
      </div>
    )
  }

  // ── Logout handler — shows confirmation first ─────────────────────────────
  function handleLogoutRequest() {
    setShowLogoutModal(true)
  }
  function handleLogoutConfirm() {
    setShowLogoutModal(false)
    logout()
    setScreen("home")
    setEnteredApp(false)
  }
  function handleLogoutCancel() {
    setShowLogoutModal(false)
  }

  // ── Already logged in AND has proceeded past Landing this session ────────
  if (user && enteredApp) {
    return (
      <>
        {showLogoutModal && (
          <LogoutModal
            dark={dark}
            onConfirm={handleLogoutConfirm}
            onCancel={handleLogoutCancel}
          />
        )}

        {screen === "editor" ? (
          <UrduEditor
            docId={editDocId}
            dark={dark}
            toggleDark={toggleDark}
            onBackToDashboard={() => { setEditDocId(null); setScreen("dashboard") }}
          />
        ) : (
          <Dashboard
            dark={dark}
            toggleDark={toggleDark}
            onOpenEditor={id => { setEditDocId(id);   setScreen("editor") }}
            onNewDocument={() => { setEditDocId(null); setScreen("editor") }}
            onLogout={handleLogoutRequest}
          />
        )}
      </>
    )
  }

  // ── Auth screens ──────────────────────────────────────────────────────────
  if (screen === "signup") {
    return (
      <SignupPage
        dark={dark}
        onGoToLogin={()  => setScreen("login")}
        onNeedVerify={s  => { setVerifyState(s); setScreen("verify") }}
      />
    )
  }
  if (screen === "verify") {
    return (
      <OTPVerifyPage
        dark={dark}
        email={verifyState?.email}
        purpose={verifyState?.purpose || "verify"}
        onSuccess={() => setEnteredApp(true)}
        onGoToLogin={() => setScreen("login")}
      />
    )
  }
  if (screen === "forgot") {
    return (
      <ForgotPasswordPage
        dark={dark}
        onGoToLogin={() => setScreen("login")}
        onOtpSent={({ email }) => { setResetEmail(email); setScreen("reset") }}
      />
    )
  }
  if (screen === "reset") {
    return (
      <ResetPasswordPage
        dark={dark}
        email={resetEmail}
        onSuccess={() => {}}
        onGoToLogin={() => setScreen("login")}
      />
    )
  }
  if (screen === "login") {
    return (
      <LoginPage
        dark={dark}
        onGoToSignup={()  => setScreen("signup")}
        onForgotPassword={() => setScreen("forgot")}
        onNeedVerify={s  => { setVerifyState(s); setScreen("verify") }}
        onSuccess={() => setEnteredApp(true)}
      />
    )
  }

  // ── Default: Landing / Home page ──────────────────────────────────────────
  return (
    <LandingPage
      dark={dark}
      toggleDark={toggleDark}
      onLogin={()  => { if (user) { setEnteredApp(true) } else { setScreen("login") } }}
      onSignup={() => setScreen("signup")}
    />
  )
}

export default function App() {
  // ADMIN PANEL ADDITION — /admin is a fully separate app with its own auth
  // (admin JWT, not the regular user AuthProvider), so we short-circuit here
  // before any of the regular user auth/dark-mode context is set up.
  if (window.location.pathname.startsWith("/admin")) {
    return <AdminApp />
  }

  return (
    <DarkModeProvider>
      <AuthProvider>
        <InnerApp />
      </AuthProvider>
    </DarkModeProvider>
  )
}