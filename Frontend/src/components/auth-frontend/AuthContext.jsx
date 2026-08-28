// AuthContext.jsx
// Global authentication state — wraps the whole app.
// Provides: user, token, login(), logout(), isLoading
//
// Usage:
//   import { useAuth } from "./AuthContext"
//   const { user, logout } = useAuth()

import { createContext, useContext, useState, useEffect, useCallback } from "react"

const API_BASE = "http://localhost:3001/api"
const TOKEN_KEY = "Kashur_editor_token"

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,      setUser]      = useState(null)
  const [token,     setToken]     = useState(() => localStorage.getItem(TOKEN_KEY))
  const [isLoading, setIsLoading] = useState(true) // true while checking stored token

  // ── On mount: validate stored token by fetching /me ──────────────────────
  useEffect(() => {
    async function checkStoredToken() {
      const stored = localStorage.getItem(TOKEN_KEY)
      if (!stored) { setIsLoading(false); return }
      try {
        const res = await fetch(`${API_BASE}/auth/me`, {
          headers: {
            Authorization: `Bearer ${stored}`,
            "X-Editor-Active": window.__kashurEditorActive ? "1" : "0",
          },
        })
        if (res.ok) {
          const data = await res.json()
          setUser(data.user)
          setToken(stored)
        } else {
          // Token expired or invalid — clear it
          localStorage.removeItem(TOKEN_KEY)
          setToken(null)
        }
      } catch (_) {
        // Network error — keep token but clear user
        setToken(null)
        localStorage.removeItem(TOKEN_KEY)
      }
      setIsLoading(false)
    }
    checkStoredToken()
  }, [])

  // ── ADMIN PANEL ADDITION — periodic heartbeat ────────────────────────────
  // Calls /me every 60s while logged in and the tab is visible. The backend
  // uses the gap between heartbeats to accumulate "time spent in editor" for
  // the admin panel's Reports/User Management. Without this, that stat would
  // barely move since /me was previously only called once on page load.
  useEffect(() => {
    if (!token) return
    const interval = setInterval(() => {
      if (document.visibilityState !== "visible") return
      fetch(`${API_BASE}/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Editor-Active": window.__kashurEditorActive ? "1" : "0",
        },
      }).catch(() => {})
    }, 60000)
    return () => clearInterval(interval)
  }, [token])

  /** Call after successful login or signup verification */
  const login = useCallback((userData, authToken) => {
    localStorage.setItem(TOKEN_KEY, authToken)
    setToken(authToken)
    setUser(userData)
  }, [])

  /** Clear auth state */
  const logout = useCallback(async () => {
    const stored = localStorage.getItem(TOKEN_KEY)
    if (stored) {
      // Fire and forget — server-side logout is just logging
      fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${stored}` },
      }).catch(() => {})
    }
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setUser(null)
  }, [])

  /** Update local user state (after profile edit etc.) */
  const updateUser = useCallback((updated) => {
    setUser(prev => ({ ...prev, ...updated }))
  }, [])

  /** Auth header for fetch calls */
  const authHeader = token ? { Authorization: `Bearer ${token}` } : {}

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, updateUser, authHeader }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>")
  return ctx
}
