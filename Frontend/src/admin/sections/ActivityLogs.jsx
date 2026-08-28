// src/admin/sections/ActivityLogs.jsx
import { useEffect, useState } from "react"
import { adminApi } from "../adminApi"
import { Card, Badge, Select, Spinner, EmptyState, Pagination } from "../components/ui"

const ACTION_LABELS = {
  "document.created": "created a document",
  "document.updated": "edited a document",
  "document.deleted": "deleted a document",
  "user.signup": "signed up",
  "user.disabled": "was disabled",
  "user.enabled": "was enabled",
  "user.deleted": "was deleted",
  "admin.login": "admin logged in",
  "admin.login_failed": "admin login failed",
  "font.created": "added a font",
  "template.created": "added a template",
  "dictionary.created": "added a dictionary entry",
  "image.created": "added an image",
  "settings.updated": "updated editor settings",
  "backup.created": "exported a backup",
  "backup.restored": "restored a backup",
}

const TONE = { document: "sky", user: "indigo", admin: "amber", font: "emerald", template: "emerald", dictionary: "emerald", image: "emerald", settings: "slate", backup: "rose" }

export default function ActivityLogs() {
  const [logs, setLogs] = useState(null)
  const [actorType, setActorType] = useState("all")
  const [page, setPage] = useState(1)
  const [meta, setMeta] = useState({ pages: 1 })
  const [error, setError] = useState("")

  useEffect(() => {
    const params = new URLSearchParams({ actorType, page })
    adminApi.activity(`?${params}`).then(d => { setLogs(d.logs); setMeta(d) }).catch(e => setError(e.message))
  }, [actorType, page])

  return (
    <div className="space-y-4">
      <Card>
        <Select value={actorType} onChange={e => { setPage(1); setActorType(e.target.value) }} className="max-w-[180px]">
          <option value="all">Everyone</option>
          <option value="user">Users</option>
          <option value="admin">Admins</option>
          <option value="system">System</option>
        </Select>
      </Card>

      <Card>
        {error && <p className="text-rose-500 text-sm mb-3">{error}</p>}
        {!logs ? <Spinner /> : logs.length === 0 ? (
          <EmptyState icon="🕓" title="No activity recorded yet" />
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {logs.map(l => {
              const category = l.action.split(".")[0]
              return (
                <div key={l._id} className="py-2.5 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-slate-700 dark:text-slate-200">
                      <span className="font-medium">{l.actorName || l.actorEmail || l.actorType}</span>{" "}
                      {ACTION_LABELS[l.action] || l.action}
                      {l.targetLabel && <span className="text-slate-400"> — "{l.targetLabel}"</span>}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">{new Date(l.createdAt).toLocaleString()}</p>
                  </div>
                  <Badge tone={TONE[category] || "slate"}>{l.actorType}</Badge>
                </div>
              )
            })}
          </div>
        )}
        <Pagination page={meta.page || 1} pages={meta.pages || 1} onChange={setPage} />
      </Card>
    </div>
  )
}
