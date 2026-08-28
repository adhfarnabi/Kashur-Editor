// src/admin/sections/ShapeManagement.jsx
import { useEffect, useState } from "react"
import { adminApi } from "../adminApi"
import { Card, Badge, Button, Input, Textarea, Spinner, EmptyState, Modal, ConfirmDialog } from "../components/ui"

const EMPTY = { name: "", category: "Custom", svgMarkup: "" }

export default function ShapeManagement() {
  const [shapes, setShapes] = useState(null)
  const [editing, setEditing] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [error, setError] = useState("")

  function load() {
    adminApi.shapes().then(d => setShapes(d.shapes)).catch(e => setError(e.message))
  }
  useEffect(() => { load() }, [])

  async function save(form) {
    if (form._id) await adminApi.updateShape(form._id, form)
    else await adminApi.createShape(form)
    setEditing(null)
    load()
  }
  async function toggleActive(s) {
    await adminApi.updateShape(s._id, { active: !s.active })
    load()
  }
  async function doDelete() {
    await adminApi.deleteShape(confirmDelete._id)
    setConfirmDelete(null)
    load()
  }

  return (
    <div className="space-y-4">
      <Card
        title={`Custom shapes available in the editor (${shapes?.length ?? "…"})`}
        action={<Button size="sm" onClick={() => setEditing({ ...EMPTY })}>+ Add Shape</Button>}
      >
        <p className="text-xs text-slate-400 mb-4">
          These sit alongside the editor's 25+ built-in shapes, in their own "Custom" category in
          the Insert → Shapes menu. Paste any valid <code>&lt;svg&gt;...&lt;/svg&gt;</code> markup.
        </p>
        {error && <p className="text-rose-500 text-sm mb-3">{error}</p>}
        {!shapes ? <Spinner /> : shapes.length === 0 ? (
          <EmptyState icon="🔷" title="No custom shapes yet" />
        ) : (
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
            {shapes.map(s => (
              <div key={s._id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 flex flex-col items-center gap-2">
                <div className="w-16 h-16 flex items-center justify-center bg-slate-50 dark:bg-slate-900 rounded" dangerouslySetInnerHTML={{ __html: s.svgMarkup }} />
                <p className="text-xs font-medium text-slate-700 dark:text-slate-200 text-center">{s.name}</p>
                {!s.active && <Badge tone="slate">Inactive</Badge>}
                <div className="flex gap-1">
                  <Button size="sm" variant="secondary" onClick={() => toggleActive(s)}>{s.active ? "Off" : "On"}</Button>
                  <Button size="sm" variant="secondary" onClick={() => setEditing(s)}>Edit</Button>
                  <Button size="sm" variant="danger" onClick={() => setConfirmDelete(s)}>Del</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {editing && <ShapeForm shape={editing} onSave={save} onClose={() => setEditing(null)} />}
      {confirmDelete && (
        <ConfirmDialog title="Delete shape?" message={`Remove "${confirmDelete.name}" from the editor's shape menu?`}
          confirmLabel="Delete" danger onConfirm={doDelete} onCancel={() => setConfirmDelete(null)} />
      )}
    </div>
  )
}

function ShapeForm({ shape, onSave, onClose }) {
  const [form, setForm] = useState({ ...EMPTY, ...shape })
  const [error, setError] = useState("")
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  function submit() {
    if (!form.svgMarkup.trim().startsWith("<svg")) {
      setError("SVG markup must start with <svg ...>")
      return
    }
    onSave(form)
  }

  return (
    <Modal title={shape._id ? "Edit Shape" : "Add Shape"} onClose={onClose} wide>
      <div className="space-y-3">
        {error && <p className="text-rose-500 text-sm">{error}</p>}
        <Input label="Name" value={form.name} onChange={e => set("name", e.target.value)} />
        <Input label="Category" value={form.category} onChange={e => set("category", e.target.value)} />
        <Textarea label="SVG Markup" rows={6} value={form.svgMarkup} onChange={e => set("svgMarkup", e.target.value)}
          placeholder='<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="#6366f1"/></svg>' />
        {form.svgMarkup.trim().startsWith("<svg") && (
          <div>
            <p className="text-xs text-slate-400 mb-1">Preview:</p>
            <div className="w-20 h-20 border border-slate-200 dark:border-slate-700 rounded flex items-center justify-center bg-slate-50 dark:bg-slate-900" dangerouslySetInnerHTML={{ __html: form.svgMarkup }} />
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>Save</Button>
        </div>
      </div>
    </Modal>
  )
}
