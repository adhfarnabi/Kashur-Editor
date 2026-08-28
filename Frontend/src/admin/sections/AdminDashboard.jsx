import { useEffect, useMemo, useState } from "react"
import { adminApi } from "../adminApi"
import { useAdminAuth } from "../AdminAuthContext"
import {
  Badge, BarChart, Card, EmptyState, HealthGauges, Pictograph,
  PieChart, StatCard, StatCardSkeleton, formatStorage,
} from "../components/ui"

function shortDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function timeAgo(iso) {
  if (!iso) return "—"
  const seconds = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (seconds < 60) return "just now"
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

function friendlyAction(action = "") {
  return action
    .replaceAll(".", " ")
    .replaceAll("_", " ")
    .replace(/\b\w/g, letter => letter.toUpperCase())
}

function formatUptime(seconds = 0) {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (days) return `${days}d ${hours}h`
  if (hours) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

export default function AdminDashboard() {
  const { admin } = useAdminAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState("")
  const [refreshing, setRefreshing] = useState(false)
  const [updatedAt, setUpdatedAt] = useState(null)

  async function load(silent = false) {
    if (!silent) setRefreshing(true)
    setError("")
    try {
      const response = await adminApi.dashboard()
      setData(response)
      setUpdatedAt(new Date())
    } catch (e) {
      setError(e.message)
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    load()
    const timer = window.setInterval(() => load(true), 60000)
    return () => window.clearInterval(timer)
  }, [])

  const trend = useMemo(
    () => data?.trend?.map(row => ({ ...row, label: shortDate(row.date) })) || [],
    [data],
  )

  if (error && !data) {
    return (
      <Card>
        <div className="flex items-center justify-between gap-4">
          <p className="text-rose-500 text-sm">{error}</p>
          <button onClick={() => load()} className="text-xs font-semibold text-indigo-600">Retry</button>
        </div>
      </Card>
    )
  }

  if (!data) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map(index => <StatCardSkeleton key={index} />)}
        </div>
        <Card><div className="h-56 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-700" /></Card>
      </div>
    )
  }

  const {
    stats, contentInventory, feedbackSummary, operationalHealth,
    systemHealth, topCreators, recentDocuments, recentActivity,
  } = data

  const feedbackChart = [
    { label: "New", value: feedbackSummary.new, color: "#f43f5e" },
    { label: "Read", value: feedbackSummary.read, color: "#38bdf8" },
    { label: "Replied", value: feedbackSummary.replied, color: "#10b981" },
    { label: "Archived", value: feedbackSummary.archived, color: "#94a3b8" },
  ]

  const inventory = [
    { label: "Fonts", value: contentInventory.activeFonts, color: "#6366f1" },
    { label: "Templates", value: contentInventory.activeTemplates, color: "#0ea5e9" },
    { label: "Dictionary", value: contentInventory.activeDictionaryEntries, color: "#10b981" },
    { label: "Shapes", value: contentInventory.activeShapes, color: "#f59e0b" },
  ]
  const operationalTotals = [
    { label: "Signups", value: trend.reduce((sum, row) => sum + row.signups, 0), color: "#6366f1" },
    { label: "Documents", value: trend.reduce((sum, row) => sum + row.documents, 0), color: "#0ea5e9" },
    { label: "Logins", value: trend.reduce((sum, row) => sum + row.logins, 0), color: "#10b981" },
  ]

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-700 p-5 text-white shadow-lg shadow-indigo-900/20">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-indigo-100 text-xs uppercase tracking-[0.18em]">Live control centre</p>
            <h2 className="text-2xl font-bold mt-1">Welcome, {admin?.name || "Admin"}</h2>
            <p className="text-indigo-100 text-sm mt-1">
              {stats.totalUsers} users · {stats.totalDocuments} documents · {stats.newFeedback} new messages
            </p>
          </div>
          <div className="text-right">
            <button
              onClick={() => load()}
              disabled={refreshing}
              className="rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 px-4 py-2 text-xs font-semibold transition disabled:opacity-60"
            >
              {refreshing ? "Refreshing…" : "↻ Refresh data"}
            </button>
            <p className="text-[11px] text-indigo-100 mt-2">
              Auto-refresh every minute · updated {updatedAt?.toLocaleTimeString()}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
          Latest refresh failed: {error}. Showing the last successful data.
        </div>
      )}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Total Users" value={stats.totalUsers} sub={`${stats.verifiedUsers} verified`} accent="indigo" icon="👥" />
        <StatCard label="Active This Week" value={stats.activeThisWeek} sub={`${stats.activeRate}% of users`} accent="emerald" icon="⚡" />
        <StatCard label="Live Documents" value={stats.totalDocuments} sub={`${stats.publicDocuments} public`} accent="sky" icon="📄" />
        <StatCard label="Storage Used" value={formatStorage(stats.totalStorageMb)} sub={`${stats.archivedDocuments} archived`} accent="amber" icon="💾" />
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/30 px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-emerald-600 dark:text-emerald-400">Database</p>
          <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200 mt-1">● {systemHealth?.database || "Connected"}</p>
        </div>
        <div className="rounded-xl border border-sky-200 bg-sky-50 dark:border-sky-900/60 dark:bg-sky-950/30 px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-sky-600 dark:text-sky-400">API uptime</p>
          <p className="text-sm font-semibold text-sky-800 dark:text-sky-200 mt-1">{formatUptime(systemHealth?.apiUptimeSeconds)}</p>
        </div>
        <div className="rounded-xl border border-violet-200 bg-violet-50 dark:border-violet-900/60 dark:bg-violet-950/30 px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-violet-600 dark:text-violet-400">Server memory</p>
          <p className="text-sm font-semibold text-violet-800 dark:text-violet-200 mt-1">{systemHealth?.memoryUsedMb || 0} MB heap</p>
        </div>
      </div>

      <Card title="Platform Health">
        <HealthGauges items={[
          { label: "Email verification", value: operationalHealth.verificationRate, sub: "Verified accounts out of all registrations" },
          { label: "7-day engagement", value: operationalHealth.activeRate, sub: "Users active during the current week" },
          { label: "Public sharing", value: operationalHealth.publicShareRate, sub: "Documents made available publicly" },
        ]} />
        <div className="grid sm:grid-cols-2 gap-3 mt-4">
          <div className={`rounded-xl px-4 py-3 border ${operationalHealth.pendingReviews ? "border-amber-200 bg-amber-50 text-amber-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
            <p className="text-xs font-semibold">Document review queue</p>
            <p className="text-2xl font-bold mt-1">{operationalHealth.pendingReviews}</p>
            <p className="text-[11px] opacity-80">Pending approval</p>
          </div>
          <div className={`rounded-xl px-4 py-3 border ${operationalHealth.unansweredFeedback ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
            <p className="text-xs font-semibold">Feedback response queue</p>
            <p className="text-2xl font-bold mt-1">{operationalHealth.unansweredFeedback}</p>
            <p className="text-[11px] opacity-80">New or read messages awaiting reply</p>
          </div>
        </div>
      </Card>

      <div className="grid xl:grid-cols-2 gap-4">
        <Card title="30-Day Operational Summary">
          <p className="text-xs text-slate-400 mb-4">Combined totals from the three daily graphs.</p>
          <PieChart data={operationalTotals} size={190} />
        </Card>
        <Card title="Content Inventory — Active Items">
          <p className="text-xs text-slate-400 mb-3">Current active fonts, templates, dictionary entries and shapes.</p>
          <PieChart data={inventory} size={190} />
        </Card>
      </div>

      <div className="grid xl:grid-cols-3 gap-4">
        <Card title="Signups — Last 30 Days">
          <p className="text-xs text-slate-400 mb-3">X-axis: date · Y-axis: new registrations.</p>
          <BarChart data={trend} keys={["signups"]} colors={["#6366f1"]} height={210} />
        </Card>
        <Card title="Documents — Last 30 Days">
          <p className="text-xs text-slate-400 mb-3">X-axis: date · Y-axis: documents created.</p>
          <BarChart data={trend} keys={["documents"]} colors={["#0ea5e9"]} height={210} />
        </Card>
        <Card title="Logins — Last 30 Days">
          <p className="text-xs text-slate-400 mb-3">X-axis: date · Y-axis: successful logins.</p>
          <BarChart data={trend} keys={["logins"]} colors={["#10b981"]} height={210} />
        </Card>
      </div>

      <Card title="Feedback Workload — Last 30 Days">
        <p className="text-xs text-slate-400 mb-4">
          Dynamic pictograph based on feedback created during the same 30-day dashboard window.
        </p>
        <Pictograph data={feedbackChart} icon="●" />
      </Card>

      <div className="grid xl:grid-cols-2 gap-4">
        <Card title="Top Document Creators">
          {topCreators.length === 0 ? <EmptyState icon="🏆" title="No documents yet" /> : (
            <div className="space-y-3">
              {topCreators.map((creator, index) => (
                <div key={creator.id} className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 flex items-center justify-center text-xs font-bold">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{creator.name}</p>
                    <p className="text-[11px] text-slate-400 truncate">{creator.email}</p>
                  </div>
                  <Badge tone="indigo">{creator.documentCount} docs</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card title="Recent Admin & System Activity">
          {recentActivity.length === 0 ? <EmptyState icon="🕘" title="No activity recorded yet" /> : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {recentActivity.map(item => (
                <div key={item.id} className="py-3 flex items-start gap-3">
                  <span className="mt-0.5 w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-sm">↗</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{friendlyAction(item.action)}</p>
                    <p className="text-xs text-slate-400 truncate">
                      {item.actorName}{item.targetLabel ? ` · ${item.targetLabel}` : ""}
                    </p>
                  </div>
                  <span className="text-[11px] text-slate-400 whitespace-nowrap">{timeAgo(item.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid xl:grid-cols-2 gap-4">
        <Card title="Recently Updated Documents">
          {recentDocuments.length === 0 ? <EmptyState icon="📄" title="No documents yet" /> : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {recentDocuments.map(document => (
                <div key={document.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{document.title}</p>
                    <p className="text-xs text-slate-400">
                      {document.owner?.name || "Unknown owner"} · {(document.wordCount || 0).toLocaleString()} words
                    </p>
                  </div>
                  <Badge tone="slate">{timeAgo(document.updatedAt)}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card title="Current Management Snapshot">
          <div className="grid grid-cols-2 gap-3">
            {inventory.map(item => (
              <div key={item.label} className="rounded-xl border border-slate-100 dark:border-slate-700 p-4">
                <p className="text-xs text-slate-400">{item.label}</p>
                <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">{item.value}</p>
                <p className="text-[11px] text-emerald-500 mt-1">Active and available</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
