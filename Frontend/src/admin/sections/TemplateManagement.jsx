// src/admin/sections/TemplateManagement.jsx
import { useEffect, useState } from "react"
import { adminApi } from "../adminApi"
import { Card, Badge, Button, Input, Select, Textarea, Spinner, EmptyState, Modal, ConfirmDialog } from "../components/ui"

const EMPTY = { title: "", category: "other", description: "", thumbnailUrl: "", html: "" }

export default function TemplateManagement() {
  const [templates, setTemplates] = useState(null)
  const [editing, setEditing] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [error, setError] = useState("")

  function load() {
    adminApi.templates().then(d => setTemplates(d.templates)).catch(e => setError(e.message))
  }
  useEffect(() => { load() }, [])

  async function save(form) {
    if (form._id) await adminApi.updateTemplate(form._id, form)
    else await adminApi.createTemplate(form)
    setEditing(null)
    load()
  }
  async function doDelete() {
    await adminApi.deleteTemplate(confirmDelete._id)
    setConfirmDelete(null)
    load()
  }

  return (
    <div className="space-y-4">
      <Card
        title={`Document templates offered to users (${templates?.length ?? "…"})`}
        action={<Button size="sm" onClick={() => setEditing({ ...EMPTY })}>+ Add Template</Button>}
      >
        <p className="text-xs text-slate-400 mb-4">
          Templates offered to users. "Cover Page" category shows up in the editor's
          Insert → Cover Page dialog; every other category shows up in the
          "new document" picker on the dashboard instead.
        </p>
        {error && <p className="text-rose-500 text-sm mb-3">{error}</p>}
        {!templates ? <Spinner /> : templates.length === 0 ? (
          <EmptyState icon="🗂️" title="No templates yet" sub="Add cover pages, letters, reports, etc." />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {templates.map(t => (
              <div key={t._id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{t.title}</p>
                  {!t.active && <Badge tone="slate">Inactive</Badge>}
                </div>
                <Badge tone="indigo">{t.category}</Badge>
                <p className="text-xs text-slate-400 mt-2 mb-3 line-clamp-2">{t.description || "No description"}</p>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="secondary" onClick={() => setEditing(t)}>Edit</Button>
                  <Button size="sm" variant="danger" onClick={() => setConfirmDelete(t)}>Delete</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {editing && <TemplateForm template={editing} onSave={save} onClose={() => setEditing(null)} />}
      {confirmDelete && (
        <ConfirmDialog title="Delete template?" message={`Remove "${confirmDelete.title}"?`}
          confirmLabel="Delete" danger onConfirm={doDelete} onCancel={() => setConfirmDelete(null)} />
      )}
    </div>
  )
}

function TemplateForm({ template, onSave, onClose }) {
  const [form, setForm] = useState({ ...EMPTY, ...template })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <Modal title={template._id ? "Edit Template" : "Add Template"} onClose={onClose} wide>
      <div className="space-y-3">
        <Input label="Title" value={form.title} onChange={e => set("title", e.target.value)} />
        <Select label="Category" value={form.category} onChange={e => set("category", e.target.value)}>
          <option value="cover-page">Cover Page</option>
          <option value="letter">Letter</option>
          <option value="report">Report</option>
          <option value="resume">Resume</option>
          <option value="assignment">Assignment</option>
          <option value="other">Other</option>
        </Select>
        <Input label="Description" value={form.description} onChange={e => set("description", e.target.value)} />
        <Input label="Thumbnail URL (optional)" value={form.thumbnailUrl} onChange={e => set("thumbnailUrl", e.target.value)} />
        <Textarea label="Template HTML" rows={6} value={form.html} onChange={e => set("html", e.target.value)}
          placeholder="<h1>Cover Page</h1><p>…</p>" />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(form)}>Save</Button>
        </div>
      </div>
    </Modal>
  )
}
