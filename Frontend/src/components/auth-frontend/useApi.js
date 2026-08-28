// useApi.js
// Authenticated fetch wrapper.
// Automatically injects Authorization header.
// Handles 401 (token expired) by logging out.
//
// Usage:
//   const api = useApi()
//   const docs = await api.get("/documents")
//   const doc  = await api.post("/documents", { title, html })

import { useCallback } from "react"
import { useAuth } from "./AuthContext"

const API_BASE = "http://localhost:3001/api"

export function useApi() {
  const { token, logout } = useAuth()

  const request = useCallback(async (method, path, body, opts = {}) => {
    const headers = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts.headers,
    }

    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      ...opts,
    })

    // Auto-logout on expired/invalid token
    if (res.status === 401) {
      const data = await res.json().catch(() => ({}))
      if (data.code === "TOKEN_EXPIRED" || data.code === "TOKEN_INVALID" || data.code === "TOKEN_STALE") {
        logout()
        throw new Error("Session expired. Please log in again.")
      }
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
      throw Object.assign(new Error(err.error || "Request failed"), { status: res.status, code: err.code, data: err })
    }

    return res.json()
  }, [token, logout])

  return {
    get:    (path, opts)        => request("GET",    path, null, opts),
    post:   (path, body, opts)  => request("POST",   path, body, opts),
    put:    (path, body, opts)  => request("PUT",    path, body, opts),
    patch:  (path, body, opts)  => request("PATCH",  path, body, opts),
    delete: (path, opts)        => request("DELETE", path, null, opts),
  }
}