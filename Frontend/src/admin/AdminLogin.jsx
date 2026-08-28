// src/admin/AdminLogin.jsx
import { useState } from "react"
import { useAdminAuth } from "./AdminAuthContext"

export default function AdminLogin() {
  const { login } = useAdminAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      await login(email.trim(), password)
    } catch (err) {
      setError(err.message || "Login failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/3 w-72 h-72 bg-indigo-600/20 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/3 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl" />
      <div className="w-full max-w-sm relative">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-2xl mx-auto mb-4 shadow-lg shadow-indigo-900/40">
            🛡️
          </div>
          <h1 className="text-white text-xl font-bold">Kashur Editor Admin</h1>
          <p className="text-slate-400 text-sm mt-1">Sign in to manage the platform</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          {error && (
            <div className="bg-rose-950/50 border border-rose-900 text-rose-300 text-sm rounded-lg px-3 py-2 mb-4">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Admin Email</label>
            <input
              type="email" required autoFocus value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 text-slate-100 text-sm px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="mb-6">
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Password</label>
            <input
              type="password" required value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 text-slate-100 text-sm px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <button
            type="submit" disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-medium text-sm rounded-lg py-2.5 transition"
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <p className="text-center text-slate-500 text-xs mt-6">
          Access is configured via the server's .env file.
        </p>
      </div>
    </div>
  )
}
