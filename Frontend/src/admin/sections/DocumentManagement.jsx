// src/admin/sections/DocumentManagement.jsx
import { useEffect, useState } from "react"
import { adminApi } from "../adminApi"
import { Card, Badge, Button, Input, Select, Spinner, EmptyState, Pagination, Modal, ConfirmDialog } from "../components/ui"

const APPROVAL_TONE = { approved: "green", pending: "amber", rejected: "red" }

export default function DocumentManagement() {
  const [rows, setRows] = useState(null)
  const [search, setSearch] = useState("")
  const [archived, setArchived] = useState("false")
  const [page, setPage] = useState(1)
  const [meta, setMeta] = useState({ pages: 1 })
  const [preview, setPreview] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [error, setError] = useState("")

  function load() {
    const params = new URLSearchParams({ search, page, archived })
    adminApi.documents(`?${params}`)
      .then(d => { setRows(d.documents); setMeta(d) })
      .catch(e => setError(e.message))
  }
  useEffect(() => { load() }, [search, page, archived])

  async function openPreview(d) {
    const full = await adminApi.document(d.id)
    setPreview(full)
  }
  async function doDelete() {
    await adminApi.deleteDocument(confirmDelete.id)
    setConfirmDelete(null)
    load()
  }
  async function toggleArchive(d) {
    await adminApi.archiveDocument(d.id, !d.isArchived)
    load()
  }
  async function setApproval(d, status) {
    await adminApi.setDocumentApproval(d.id, status)
    load()
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <Input placeholder="Search documents by title…" value={search}
            onChange={e => { setPage(1); setSearch(e.target.value) }} className="sm:max-w-xs" />
          <Select value={archived} onChange={e => { setPage(1); setArchived(e.target.value) }} className="sm:max-w-[160px]">
            <option value="false">Active</option>
            <option value="true">Archived</option>
            <option value="all">All</option>
          </Select>
        </div>
      </Card>

      <Card>
        {error && <p className="text-rose-500 text-sm mb-3">{error}</p>}
        {!rows ? <Spinner /> : rows.length === 0 ? (
          <EmptyState icon="📄" title="No documents found" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 uppercase tracking-wide border-b border-slate-100 dark:border-slate-700">
                  <th className="pb-2 font-medium">Title</th>
                  <th className="pb-2 font-medium">Owner</th>
                  <th className="pb-2 font-medium">Words</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Updated</th>
                  <th className="pb-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {rows.map(d => (
                  <tr key={d.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors duration-150">
                    <td className="py-2.5">
                      <button onClick={() => openPreview(d)} className="font-medium text-slate-700 dark:text-slate-200 hover:text-indigo-600 text-left">
                        {d.title}
                      </button>
                    </td>
                    <td className="py-2.5 text-slate-500 dark:text-slate-400">{d.owner?.email || "—"}</td>
                    <td className="py-2.5 text-slate-500 dark:text-slate-400">{d.wordCount}</td>
                    <td className="py-2.5 flex gap-1 flex-wrap">
                      {d.isPublic && <Badge tone="indigo">Public</Badge>}
                      {d.isArchived && <Badge tone="slate">Archived</Badge>}
                      <Badge tone={APPROVAL_TONE[d.approvalStatus]}>{d.approvalStatus}</Badge>
                    </td>
                    <td className="py-2.5 text-slate-400">{new Date(d.updatedAt).toLocaleDateString()}</td>
                    <td className="py-2.5 text-right">
                      <div className="flex justify-end gap-1.5 flex-wrap">
                        <Button size="sm" variant="secondary" onClick={() => toggleArchive(d)}>
                          {d.isArchived ? "Unarchive" : "Archive"}
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => setConfirmDelete(d)}>Delete</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={meta.page || 1} pages={meta.pages || 1} onChange={setPage} />
      </Card>

      {preview && (
        <Modal title={preview.title} onClose={() => setPreview(null)} wide>
          <p className="text-xs text-slate-400 mb-3">
            Owner: {preview.owner?.email || "—"} · {preview.wordCount} words
          </p>
          <div className="flex gap-1.5 mb-3">
            {["approved", "pending", "rejected"].map(s => (
              <button key={s} onClick={() => setApproval(preview, s)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${preview.approvalStatus === s ? "bg-indigo-600 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"}`}>
                {s}
              </button>
            ))}
          </div>
          <div
            className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 max-h-[50vh] overflow-y-auto text-sm bg-slate-50 dark:bg-slate-900"
            dir="rtl"
            dangerouslySetInnerHTML={{ __html: preview.html || "<p class='text-slate-400'>Empty document</p>" }}
          />
        </Modal>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Delete document?"
          message={`"${confirmDelete.title}" will be moved to trash (soft-deleted). This is reversible from the database if needed.`}
          confirmLabel="Delete"
          danger
          onConfirm={doDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}
