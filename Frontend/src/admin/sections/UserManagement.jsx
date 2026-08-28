// src/admin/sections/UserManagement.jsx
import { useEffect, useState } from "react"
import { adminApi } from "../adminApi"
import { Card, Badge, Button, Input, Select, Spinner, EmptyState, Pagination, Modal, ConfirmDialog } from "../components/ui"

function formatDuration(totalSeconds) {
  if (!totalSeconds) return "No activity tracked yet"
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

export default function UserManagement() {
  const [rows, setRows] = useState(null)
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("all")
  const [page, setPage] = useState(1)
  const [meta, setMeta] = useState({ pages: 1 })
  const [detail, setDetail] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [error, setError] = useState("")
  const [tab, setTab] = useState("users") // users | online | history
  const [onlineUsers, setOnlineUsers] = useState(null)
  const [history, setHistory] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({ name: "", email: "", phone: "", password: "", autoVerify: true })
  const [createError, setCreateError] = useState("")
  const [resetResult, setResetResult] = useState(null) // { name, tempPassword }

  function load() {
    const params = new URLSearchParams({ search, status, page })
    adminApi.users(`?${params}`)
      .then(d => { setRows(d.users); setMeta(d) })
      .catch(e => setError(e.message))
  }

  useEffect(() => { if (tab === "users") load() }, [search, status, page, tab])
  useEffect(() => {
    if (tab === "online") adminApi.onlineUsers().then(d => setOnlineUsers(d.users)).catch(e => setError(e.message))
    if (tab === "history") adminApi.loginHistory().then(d => setHistory(d.logins)).catch(e => setError(e.message))
  }, [tab])

  async function toggleStatus(u) {
    await adminApi.setUserStatus(u.id, !u.active)
    load()
  }

  async function openDetail(u) {
    const d = await adminApi.user(u.id)
    setDetail(d)
  }

  async function doDelete() {
    await adminApi.deleteUser(confirmDelete.id)
    setConfirmDelete(null)
    load()
  }

  async function verifyEmail(u) {
    await adminApi.verifyUserEmail(u.id)
    load()
  }

  async function resetPassword(u) {
    const res = await adminApi.resetUserPassword(u.id)
    setResetResult({ name: u.name, tempPassword: res.tempPassword })
  }

  async function submitCreate(e) {
    e.preventDefault()
    setCreateError("")
    try {
      await adminApi.createUser(createForm)
      setShowCreate(false)
      setCreateForm({ name: "", email: "", phone: "", password: "", autoVerify: true })
      load()
    } catch (err) {
      setCreateError(err.message || "Couldn't create user")
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex gap-1.5 mb-3">
          {[["users", "All Users"], ["online", "Online Now"], ["history", "Login History"]].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${tab === id ? "bg-indigo-600 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"}`}>
              {label}
            </button>
          ))}
        </div>
        {tab === "users" && (
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <Input placeholder="Search by name or email…" value={search}
              onChange={e => { setPage(1); setSearch(e.target.value) }} className="sm:max-w-xs" />
            <Select value={status} onChange={e => { setPage(1); setStatus(e.target.value) }} className="sm:max-w-[160px]">
              <option value="all">All statuses</option>
              <option value="verified">Verified</option>
              <option value="unverified">Unverified</option>
              <option value="disabled">Disabled</option>
            </Select>
            <div className="sm:ml-auto">
              <Button size="sm" onClick={() => setShowCreate(true)}>+ Create User</Button>
            </div>
          </div>
        )}
      </Card>

      {tab === "online" && (
        <Card title={`${onlineUsers?.length ?? "…"} users online now`}>
          {!onlineUsers ? <Spinner /> : onlineUsers.length === 0 ? (
            <EmptyState icon="💤" title="No one's online right now" />
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {onlineUsers.map(u => (
                <div key={u._id} className="py-2.5 flex items-center justify-between">
                  <p className="text-sm text-slate-700 dark:text-slate-200 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" /> {u.name} <span className="text-slate-400">{u.email}</span>
                  </p>
                  <span className="text-xs text-slate-400">active {new Date(u.lastActiveAt).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === "history" && (
        <Card title="Recent Logins">
          {!history ? <Spinner /> : history.length === 0 ? (
            <EmptyState icon="🕓" title="No login history yet" />
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {history.map(l => (
                <div key={l._id} className="py-2.5 flex items-center justify-between gap-3">
                  <p className="text-sm text-slate-700 dark:text-slate-200">{l.email}</p>
                  <span className="text-xs text-slate-400">{new Date(l.createdAt).toLocaleString()} · {l.ip || "—"}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === "users" && (
      <Card>
        {error && <p className="text-rose-500 text-sm mb-3">{error}</p>}
        {!rows ? <Spinner /> : rows.length === 0 ? (
          <EmptyState icon="👥" title="No users found" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 uppercase tracking-wide border-b border-slate-100 dark:border-slate-700">
                  <th className="pb-2 font-medium">Name</th>
                  <th className="pb-2 font-medium">Email</th>
                  <th className="pb-2 font-medium">Docs</th>
                  <th className="pb-2 font-medium">Time in Editor</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Joined</th>
                  <th className="pb-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {rows.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors duration-150">
                    <td className="py-2.5">
                      <button onClick={() => openDetail(u)} className="font-medium text-slate-700 dark:text-slate-200 hover:text-indigo-600 flex items-center gap-1.5">
                        {u.online && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" title="Online now" />}
                        {u.name}
                      </button>
                    </td>
                    <td className="py-2.5 text-slate-500 dark:text-slate-400">{u.email}</td>
                    <td className="py-2.5 text-slate-500 dark:text-slate-400">{u.documentCount}</td>
                    <td className="py-2.5 text-slate-500 dark:text-slate-400">{formatDuration(u.totalActiveSeconds)}</td>
                    <td className="py-2.5">
                      {!u.active ? <Badge tone="red">Disabled</Badge>
                        : u.emailVerified ? <Badge tone="green">Verified</Badge>
                        : <Badge tone="amber">Unverified</Badge>}
                    </td>
                    <td className="py-2.5 text-slate-400">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td className="py-2.5">
                      <div className="flex justify-end gap-1.5 flex-wrap">
                        {!u.emailVerified && (
                          <Button size="sm" variant="secondary" onClick={() => verifyEmail(u)}>Verify Email</Button>
                        )}
                        <Button size="sm" variant="secondary" onClick={() => resetPassword(u)}>Reset Password</Button>
                        <Button size="sm" variant="secondary" onClick={() => toggleStatus(u)}>
                          {u.active ? "Block" : "Unblock"}
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => setConfirmDelete(u)}>Delete</Button>
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
      )}

      {detail && (
        <Modal title={detail.user.name} onClose={() => setDetail(null)} wide>
          <div className="grid sm:grid-cols-2 gap-3 mb-5 text-sm">
            <p><span className="text-slate-400">Email:</span> {detail.user.email}</p>
            <p><span className="text-slate-400">Phone:</span> {detail.user.phone || "—"}</p>
            <p><span className="text-slate-400">Joined:</span> {new Date(detail.user.createdAt).toLocaleString()}</p>
            <p><span className="text-slate-400">Status:</span> {detail.user.active ? "Active" : "Blocked"} {detail.user.online && <Badge tone="green">Online</Badge>}</p>
            <p><span className="text-slate-400">Time in editor:</span> {formatDuration(detail.user.totalActiveSeconds)}</p>
          </div>
          <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Documents ({detail.documents.length})</h4>
          {detail.documents.length === 0 ? (
            <p className="text-sm text-slate-400 mb-4">No documents.</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700 mb-4">
              {detail.documents.map(d => (
                <div key={d._id} className="py-2 flex justify-between text-sm">
                  <span className="text-slate-700 dark:text-slate-200">{d.title}</span>
                  <span className="text-slate-400">{d.wordCount} words</span>
                </div>
              ))}
            </div>
          )}
          <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Recent Logins</h4>
          {detail.recentLogins?.length ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {detail.recentLogins.map(l => (
                <div key={l._id} className="py-1.5 text-xs text-slate-400 flex justify-between">
                  <span>{new Date(l.createdAt).toLocaleString()}</span>
                  <span>{l.ip || "—"}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-slate-400">No login history.</p>}
        </Modal>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Delete user?"
          message={`This permanently deletes ${confirmDelete.name} and soft-deletes all their documents. This can't be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={doDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
      {showCreate && (
        <Modal title="Create New User" onClose={() => setShowCreate(false)}>
          <form onSubmit={submitCreate} className="space-y-3">
            {createError && <p className="text-rose-500 text-xs">{createError}</p>}
            <Input label="Name" required value={createForm.name}
              onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} />
            <Input label="Email" type="email" required value={createForm.email}
              onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))} />
            <Input label="Phone (optional)" value={createForm.phone}
              onChange={e => setCreateForm(f => ({ ...f, phone: e.target.value }))} />
            <Input label="Temporary Password" type="text" required minLength={8} value={createForm.password}
              onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))} />
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <input type="checkbox" checked={createForm.autoVerify}
                onChange={e => setCreateForm(f => ({ ...f, autoVerify: e.target.checked }))} />
              Mark email as verified
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button type="submit">Create User</Button>
            </div>
          </form>
        </Modal>
      )}

      {resetResult && (
        <Modal title="Password Reset" onClose={() => setResetResult(null)}>
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">
            A temporary password was emailed to <strong>{resetResult.name}</strong>. You can also share it directly:
          </p>
          <p className="text-lg font-mono font-bold tracking-wider bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-2 text-center">
            {resetResult.tempPassword}
          </p>
          <p className="text-xs text-slate-400 mt-3">Ask them to change it right after logging in.</p>
          <div className="flex justify-end pt-4">
            <Button onClick={() => setResetResult(null)}>Done</Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
