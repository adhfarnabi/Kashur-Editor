// src/admin/sections/BackupRestore.jsx
import { useRef, useState } from "react"
import { adminApi } from "../adminApi"
import { Card, Button, Select } from "../components/ui"

const COLLECTIONS = ["Document", "Font", "Template", "DictionaryEntry", "Shape", "EditorSettings"]

export default function BackupRestore() {
  const [selected, setSelected] = useState(COLLECTIONS)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [mode, setMode] = useState("merge")
  const fileRef = useRef()

  function toggle(name) {
    setSelected(s => s.includes(name) ? s.filter(x => x !== name) : [...s, name])
  }

  async function handleExport() {
    setBusy(true); setError(""); setMessage("")
    try {
      const data = await adminApi.exportBackup(selected.join(","))
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `kashur-editor-backup-${Date.now()}.json`
      a.click()
      URL.revokeObjectURL(url)
      setMessage("Backup downloaded.")
    } catch (e) { setError(e.message) }
    setBusy(false)
  }

  async function handleRestoreFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true); setError(""); setMessage("")
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      const result = await adminApi.restoreBackup({ data: parsed.data || parsed, mode })
      setMessage(`Restore complete: ${JSON.stringify(result.results)}`)
    } catch (e) { setError(e.message) }
    setBusy(false)
    e.target.value = ""
  }

  return (
    <div className="space-y-4">
      <Card title="Export Backup">
        <p className="text-xs text-slate-400 mb-3">
          Downloads a JSON snapshot of the selected collections. User accounts and passwords are never included.
        </p>
        <div className="flex flex-wrap gap-2 mb-4">
          {COLLECTIONS.map(name => (
            <label key={name} className="flex items-center gap-1.5 text-sm bg-slate-100 dark:bg-slate-700 rounded-lg px-2.5 py-1.5 cursor-pointer">
              <input type="checkbox" checked={selected.includes(name)} onChange={() => toggle(name)} />
              {name}
            </label>
          ))}
        </div>
        <Button onClick={handleExport} disabled={busy || selected.length === 0}>
          {busy ? "Working…" : "Download Backup"}
        </Button>
      </Card>

      <Card title="Restore from Backup">
        <p className="text-xs text-slate-400 mb-3">
          Upload a previously exported JSON file. <strong>Merge</strong> upserts records by ID;
          <strong> Replace</strong> wipes each included collection first. User accounts are always skipped for safety.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Select value={mode} onChange={e => setMode(e.target.value)} className="w-40">
            <option value="merge">Merge</option>
            <option value="replace">Replace</option>
          </Select>
          <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={busy}>
            {busy ? "Restoring…" : "Choose Backup File"}
          </Button>
          <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={handleRestoreFile} />
        </div>
      </Card>

      {message && <Card><p className="text-sm text-emerald-600 dark:text-emerald-400">{message}</p></Card>}
      {error && <Card><p className="text-sm text-rose-500">{error}</p></Card>}
    </div>
  )
}
