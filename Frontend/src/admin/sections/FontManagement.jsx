// src/admin/sections/FontManagement.jsx
import { useEffect, useState } from "react"
import { adminApi } from "../adminApi"
import { Card, Badge, Button, Input, Select, Spinner, EmptyState, Modal, ConfirmDialog } from "../components/ui"

const EMPTY = { name: "", family: "", script: "kashmiri", url: "", fileFormat: "", isDefault: false }

export default function FontManagement() {
  const [fonts, setFonts] = useState(null)
  const [editing, setEditing] = useState(null) // font object or {} for new
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [error, setError] = useState("")

  function load() {
    adminApi.fonts().then(d => setFonts(d.fonts)).catch(e => setError(e.message))
  }
  useEffect(() => { load() }, [])

  async function save(form) {
    if (form._id) await adminApi.updateFont(form._id, form)
    else await adminApi.createFont(form)
    setEditing(null)
    load()
  }
  async function toggleActive(f) {
    await adminApi.updateFont(f._id, { active: !f.active })
    load()
  }
  async function doDelete() {
    await adminApi.deleteFont(confirmDelete._id)
    setConfirmDelete(null)
    load()
  }

  return (
    <div className="space-y-4">
      <Card
        title={`Fonts available in the editor (${fonts?.length ?? "…"})`}
        action={<Button size="sm" onClick={() => setEditing({ ...EMPTY })}>+ Add Font</Button>}
      >
        {error && <p className="text-rose-500 text-sm mb-3">{error}</p>}
        {!fonts ? <Spinner /> : fonts.length === 0 ? (
          <EmptyState icon="🔤" title="No fonts added yet" sub="Add your Kashmiri Nastaliq fonts here." />
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {fonts.map(f => (
              <div key={f._id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200 flex items-center gap-2">
                    {f.name} {f.isDefault && <Badge tone="indigo">Default</Badge>}
                    {!f.active && <Badge tone="slate">Inactive</Badge>}
                  </p>
                  <p className="text-xs text-slate-400" style={{ fontFamily: f.family }}>{f.family} · {f.script}</p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <Button size="sm" variant="secondary" onClick={() => toggleActive(f)}>{f.active ? "Deactivate" : "Activate"}</Button>
                  <Button size="sm" variant="secondary" onClick={() => setEditing(f)}>Edit</Button>
                  <Button size="sm" variant="danger" onClick={() => setConfirmDelete(f)}>Delete</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {editing && <FontForm font={editing} onSave={save} onClose={() => setEditing(null)} />}
      {confirmDelete && (
        <ConfirmDialog title="Delete font?" message={`Remove "${confirmDelete.name}" from the editor's font list?`}
          confirmLabel="Delete" danger onConfirm={doDelete} onCancel={() => setConfirmDelete(null)} />
      )}
    </div>
  )
}

function FontForm({ font, onSave, onClose }) {
  const [form, setForm] = useState({ ...EMPTY, ...font })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <Modal title={font._id ? "Edit Font" : "Add Font"} onClose={onClose}>
      <div className="space-y-3">
        <Input label="Display Name" value={form.name} onChange={e => set("name", e.target.value)} placeholder="Noto Nastaliq Urdu" />
        <Input label="CSS Font Family" value={form.family} onChange={e => set("family", e.target.value)} placeholder="'Noto Nastaliq Urdu', serif" />
        <Select label="Script" value={form.script} onChange={e => set("script", e.target.value)}>
          <option value="kashmiri">Kashmiri</option>
          <option value="urdu">Urdu</option>
          <option value="english">English</option>
          <option value="other">Other</option>
        </Select>
        <Input label="Font File URL (optional)" value={form.url} onChange={e => set("url", e.target.value)} placeholder="https://…/font.woff2" />
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={form.isDefault} onChange={e => set("isDefault", e.target.checked)} />
          Set as default font for new documents
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(form)}>Save</Button>
        </div>
      </div>
    </Modal>
  )
}
