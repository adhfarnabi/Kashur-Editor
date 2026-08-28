// src/admin/sections/SystemSettings.jsx
import { useEffect, useState } from "react"
import { adminApi } from "../adminApi"
import { Card, Badge, Button, Input, Spinner } from "../components/ui"

export default function SystemSettings() {
  const [health, setHealth] = useState(null)

  useEffect(() => {
    fetch("http://localhost:3001/api/health").then(r => r.json()).then(setHealth).catch(() => setHealth({ status: "error" }))
  }, [])

  return (
    <div className="space-y-4 max-w-2xl">
      <Card title="System Health">
        {!health ? <Spinner /> : (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">API Server</span>
              <Badge tone={health.status === "ok" ? "green" : "red"}>{health.status === "ok" ? "Online" : "Offline"}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Database</span>
              <Badge tone={health.database === "connected" ? "green" : "red"}>{health.database || "unknown"}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Server Time</span>
              <span className="text-slate-600 dark:text-slate-300">{health.time ? new Date(health.time).toLocaleString() : "—"}</span>
            </div>
          </div>
        )}
      </Card>

      <ChangePasswordCard />
    </div>
  )
}

function ChangePasswordCard() {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" })
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function submit(e) {
    e.preventDefault()
    setError(""); setMessage(""); setBusy(true)
    try {
      await adminApi.changePassword(form)
      setMessage("Password changed successfully.")
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" })
    } catch (e) { setError(e.message) }
    setBusy(false)
  }

  return (
    <Card title="Change Admin Password">
      <form onSubmit={submit} className="space-y-3">
        {error && <p className="text-rose-500 text-sm">{error}</p>}
        {message && <p className="text-emerald-600 dark:text-emerald-400 text-sm">{message}</p>}
        <Input label="Current Password" type="password" value={form.currentPassword} onChange={e => set("currentPassword", e.target.value)} required />
        <Input label="New Password" type="password" value={form.newPassword} onChange={e => set("newPassword", e.target.value)} required minLength={8} />
        <Input label="Confirm New Password" type="password" value={form.confirmPassword} onChange={e => set("confirmPassword", e.target.value)} required minLength={8} />
        <Button type="submit" disabled={busy}>{busy ? "Updating…" : "Update Password"}</Button>
      </form>
    </Card>
  )
}
