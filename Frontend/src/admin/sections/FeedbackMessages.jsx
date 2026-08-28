// src/admin/sections/FeedbackMessages.jsx
import { useEffect, useState } from "react"
import { adminApi } from "../adminApi"
import { Card, Badge, Button, Select, Textarea, Spinner, EmptyState, Pagination, Modal, ConfirmDialog } from "../components/ui"

const STATUS_TONE = { new: "indigo", read: "slate", replied: "green", archived: "slate" }

export default function FeedbackMessages({ onCountChange }) {
  const [items, setItems] = useState(null)
  const [status, setStatus] = useState("all")
  const [page, setPage] = useState(1)
  const [meta, setMeta] = useState({ pages: 1 })
  const [open, setOpen] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [error, setError] = useState("")
  const [replyText, setReplyText] = useState("")
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState("")

  function load() {
    const params = new URLSearchParams({ status, page })
    adminApi.feedback(`?${params}`)
      .then(d => { setItems(d.items); setMeta(d); onCountChange?.(d.newCount) })
      .catch(e => setError(e.message))
  }
  useEffect(() => { load() }, [status, page])

  async function openItem(item) {
    setOpen(item)
    if (item.status === "new") {
      await adminApi.setFeedbackStatus(item.id || item._id, "read")
      load()
    }
  }
  async function setStatusFor(item, s) {
    await adminApi.setFeedbackStatus(item._id, s)
    setOpen(o => o ? { ...o, status: s } : o)
    load()
  }
  async function sendReply() {
    if (!replyText.trim()) return
    setSending(true); setSendError("")
    try {
      await adminApi.replyFeedback(open._id, replyText)
      setReplyText("")
      setOpen(o => ({ ...o, status: "replied" }))
      load()
    } catch (e) { setSendError(e.message) }
    setSending(false)
  }
  async function doDelete() {
    await adminApi.deleteFeedback(confirmDelete._id)
    setConfirmDelete(null)
    setOpen(null)
    load()
  }

  return (
    <div className="space-y-4">
      <Card>
        <Select value={status} onChange={e => { setPage(1); setStatus(e.target.value) }} className="max-w-[180px]">
          <option value="all">All</option>
          <option value="new">New</option>
          <option value="read">Read</option>
          <option value="replied">Replied</option>
          <option value="archived">Archived</option>
        </Select>
      </Card>

      <Card>
        {error && <p className="text-rose-500 text-sm mb-3">{error}</p>}
        {!items ? <Spinner /> : items.length === 0 ? (
          <EmptyState icon="💬" title="No messages yet" />
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {items.map(f => (
              <button key={f._id} onClick={() => openItem(f)} className="w-full text-left py-3 flex items-start justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-700/40 -mx-5 px-5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{f.subject}</p>
                  <p className="text-xs text-slate-400 truncate">{f.fromName} &lt;{f.fromEmail}&gt;</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge tone={STATUS_TONE[f.status]}>{f.status}</Badge>
                  <span className="text-xs text-slate-400">{new Date(f.createdAt).toLocaleDateString()}</span>
                </div>
              </button>
            ))}
          </div>
        )}
        <Pagination page={meta.page || 1} pages={meta.pages || 1} onChange={setPage} />
      </Card>

      {open && (
        <Modal title={open.subject} onClose={() => { setOpen(null); setReplyText(""); setSendError("") }} wide>
          <p className="text-xs text-slate-400 mb-1">From: {open.fromName} &lt;{open.fromEmail}&gt;</p>
          <p className="text-xs text-slate-400 mb-4">{new Date(open.createdAt).toLocaleString()} · Type: {open.type}</p>
          <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap mb-5 bg-slate-50 dark:bg-slate-900 rounded-lg p-3">{open.message}</p>

          <div className="flex flex-wrap gap-2 mb-4">
            <Button size="sm" variant="secondary" onClick={() => setStatusFor(open, "archived")}>Archive</Button>
            <Button size="sm" variant="danger" onClick={() => setConfirmDelete(open)}>Delete</Button>
          </div>

          <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Reply</h4>
          {sendError && <p className="text-rose-500 text-sm mb-2">{sendError}</p>}
          <Textarea rows={4} value={replyText} onChange={e => setReplyText(e.target.value)}
            placeholder={`Hi ${open.fromName}, thanks for reaching out...`} />
          <div className="flex justify-end mt-2">
            <Button onClick={sendReply} disabled={sending || !replyText.trim()}>
              {sending ? "Sending…" : "Send Reply Email"}
            </Button>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <ConfirmDialog title="Delete message?" message="This can't be undone." confirmLabel="Delete" danger
          onConfirm={doDelete} onCancel={() => setConfirmDelete(null)} />
      )}
    </div>
  )
}
