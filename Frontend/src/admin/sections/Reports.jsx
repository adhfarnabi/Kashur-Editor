// src/admin/sections/Reports.jsx
import { Fragment, useEffect, useState } from "react"
import { adminApi, getAdminToken } from "../adminApi"
import {
  StatCard, Card, Spinner, Badge, formatStorage,
  PieChart,
} from "../components/ui"

const RANGE_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "month", label: "This Month" },
  { value: "year", label: "This Year" },
]

const CSV_TYPES = [
  { value: "summary", label: "Summary" },
  { value: "users", label: "User Report" },
  { value: "documents", label: "Document Report" },
  { value: "storage", label: "Storage Report" },
  { value: "login", label: "Login Report" },
  { value: "security", label: "Security Report" },
]

const RANGE_LABELS = {
  today: "Today",
  "7d": "Last 7 Days",
  "30d": "Last 30 Days",
  month: "This Month",
  year: "This Year",
  custom: "Custom Range",
}

const toNumber = value => {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

const firstNumber = (...values) => {
  const value = values.find(item => item !== undefined && item !== null && item !== "")
  return toNumber(value)
}

const round = (value, digits = 1) => {
  const factor = 10 ** digits
  return Math.round((toNumber(value) + Number.EPSILON) * factor) / factor
}

const formatDuration = minutes => {
  const safeMinutes = Math.max(0, toNumber(minutes))
  if (safeMinutes < 60) return `${round(safeMinutes)} min`

  const hours = Math.floor(safeMinutes / 60)
  const remainingMinutes = Math.round(safeMinutes % 60)
  if (remainingMinutes === 60) return `${hours + 1} hr`
  return remainingMinutes ? `${hours} hr ${remainingMinutes} min` : `${hours} hr`
}

export default function Reports() {
  const [data, setData] = useState(null)
  const [error, setError] = useState("")
  const [range, setRange] = useState("30d")
  const [customFrom, setCustomFrom] = useState("")
  const [customTo, setCustomTo] = useState("")
  const [refreshTick, setRefreshTick] = useState(0)
  const [downloading, setDownloading] = useState("")
  const [exportError, setExportError] = useState("")

  function activeParams() {
    if (range === "custom" && customFrom) {
      return `?range=custom&from=${customFrom}&to=${customTo || customFrom}`
    }
    return `?range=${range}`
  }

  useEffect(() => {
    if (range === "custom" && !customFrom) return // wait for the user to pick a date
    let cancelled = false
    const params = activeParams()
    const loadReports = (silent = false) => {
      if (!silent) setData(null)
      setError("")
      return adminApi.reports(params)
        .then(result => {
          if (!cancelled) setData(result)
        })
        .catch(e => {
          // A background refresh should keep the last good report visible.
          if (!cancelled) setError(e.message)
        })
    }

    loadReports(false)

    // Keep report cards dynamic after documents are created/deleted in another
    // admin section or browser tab. Also refresh as soon as this tab regains
    // focus, so the admin does not need to change the date filter manually.
    const refresh = () => {
      if (document.visibilityState === "visible") loadReports(true)
    }
    const timer = window.setInterval(refresh, 30000)
    window.addEventListener("focus", refresh)
    document.addEventListener("visibilitychange", refresh)

    return () => {
      cancelled = true
      window.clearInterval(timer)
      window.removeEventListener("focus", refresh)
      document.removeEventListener("visibilitychange", refresh)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, customFrom, customTo, refreshTick])

  async function downloadCsv(type, override) {
    setDownloading(type)
    setExportError("")
    try {
      const finalParams = override || `?type=${type}&${activeParams().slice(1)}`
      const res = await fetch(adminApi.reportsCsvUrl(finalParams), {
        headers: { Authorization: `Bearer ${getAdminToken()}` },
      })
      if (!res.ok) {
        const message = await res.json().catch(() => null)
        throw new Error(message?.error || `Export failed (${res.status})`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `kashur-editor-${type}-report-${Date.now()}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setExportError(e.message)
    } finally {
      setDownloading("")
    }
  }

  if (error && !data) return <Card><p className="text-rose-500 text-sm">{error}</p></Card>
  if (!data) return <Spinner />

  // FIX: default every field to a safe empty shape. The backend may not yet
  // return trafficReport / weeklyHeatmap / rangeGrowth / feedbackReport / rangeTrend
  // for every range, and without these defaults the .map()/.reduce() calls below
  // throw on `undefined`, which crashes the whole component to a white screen.
  const {
    userReport = {}, documentReport = {}, usageReport = {}, storageReport = {}, contentReport = {},
    loginReport = {}, securityReport = {},
    rangeGrowth = {
      userGrowth: { isNew: true, value: 0 },
      docGrowth: { isNew: true, value: 0 },
      usersPrevious: 0,
      docsPrevious: 0,
    },
    feedbackReport = { total: 0 },
    rangeTrend = [],
    trafficReport = [],
    weeklyHeatmap = [],
  } = data

  const selectedRangeLabel = range === "custom" && customFrom
    ? `${customFrom} to ${customTo || customFrom}`
    : RANGE_LABELS[range] || "Selected Range"
  const hasRangeActiveUsers = userReport.activeUsersInRange !== undefined

  // Support the common session-count names used by different API versions.
  // If the API only sends total time and average time, derive the count.
  const sessionsFromArray = Array.isArray(usageReport.sessions) ? usageReport.sessions.length : undefined
  const totalTimeMinutes = Math.max(0, firstNumber(
    usageReport.totalTimeSpentMinutes,
    usageReport.totalMinutes,
    usageReport.totalDurationMinutes,
    toNumber(usageReport.totalTimeSpentHours) * 60,
  ))
  const totalTimeHours = round(totalTimeMinutes / 60)
  const reportedAvgSessionMinutes = Math.max(0, firstNumber(
    usageReport.avgTimeSpentMinutes,
    usageReport.avgSessionMinutes,
    usageReport.averageSessionMinutes,
  ))
  const trackedSessions = Math.max(0, Math.round(firstNumber(
    usageReport.trackedSessions,
    usageReport.sessionCount,
    usageReport.sessionsCount,
    usageReport.sessionCountInRange,
    usageReport.totalSessions,
    usageReport.totalTrackedSessions,
    usageReport.editorSessions,
    sessionsFromArray,
    reportedAvgSessionMinutes ? totalTimeMinutes / reportedAvgSessionMinutes : 0,
  )))
  const avgSessionMinutes = reportedAvgSessionMinutes ||
    (trackedSessions ? totalTimeMinutes / trackedSessions : 0)
  const longestSessionMinutes = Math.max(0, firstNumber(
    usageReport.longestSessionMinutes,
    usageReport.longestSession,
    usageReport.maxSessionMinutes,
  ))
  const shortestSessionMinutes = Math.max(0, firstNumber(
    usageReport.shortestSessionMinutes,
    usageReport.shortestSession,
    usageReport.minSessionMinutes,
  ))
  const sessionText = `${trackedSessions} ${trackedSessions === 1 ? "session" : "sessions"}`
  const rangeTrendRows = Array.isArray(rangeTrend) ? rangeTrend : []
  const trafficRows = Array.isArray(trafficReport) ? trafficReport : []
  const heatmapRows = Array.isArray(weeklyHeatmap) ? weeklyHeatmap : []

  const activityPie = [
    { label: "Signups", value: rangeTrendRows.reduce((s, r) => s + toNumber(r.signups), 0), color: "#6366f1" },
    { label: "Documents", value: rangeTrendRows.reduce((s, r) => s + toNumber(r.documents), 0), color: "#0ea5e9" },
    { label: "Logins", value: rangeTrendRows.reduce((s, r) => s + toNumber(r.logins), 0), color: "#10b981" },
    { label: "Feedback", value: rangeTrendRows.reduce((s, r) => s + toNumber(r.feedback), 0), color: "#f43f5e" },
  ]
  const trafficPie = trafficRows.map((row, index) => ({
    ...row,
    value: toNumber(row.value),
    color: ["#8b5cf6", "#06b6d4", "#f59e0b", "#10b981", "#f43f5e"][index % 5],
  }))
  const heatValue = (day, hour) => toNumber(
    heatmapRows.find(cell => toNumber(cell.day) === day && toNumber(cell.hour) === hour)?.value,
  )
  const heatBlocks = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].flatMap((_, dayIndex) =>
    [0, 3, 6, 9, 12, 15, 18, 21].map(hour =>
      [0, 1, 2].reduce((sum, offset) => sum + heatValue(dayIndex + 1, hour + offset), 0),
    ),
  )
  const maxHeat = Math.max(1, ...heatBlocks)
  const growthValue = growth => `${round(growth?.value)}%`
  const growthSub = (current, previous) =>
    `Current: ${toNumber(current)} · Previous: ${toNumber(previous)}`
  const userGrowth = rangeGrowth?.userGrowth || { isNew: true, value: 0 }
  const documentGrowth = rangeGrowth?.docGrowth || { isNew: true, value: 0 }

  return (
    <div className="space-y-6">
      {error && (
        <Card>
          <p className="text-amber-600 dark:text-amber-400 text-sm">
            Latest live refresh failed: {error}. Showing the last successful report.
          </p>
        </Card>
      )}
      {/* Filter bar */}
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">📅 Date Range:</span>
          <div className="flex flex-wrap gap-1.5">
            {RANGE_OPTIONS.map(o => (
              <button
                key={o.value}
                onClick={() => setRange(o.value)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors duration-150 ${
                  range === o.value
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                }`}
              >
                {o.label}
              </button>
            ))}
            <button
              onClick={() => {
                if (!customFrom) {
                  const today = new Date().toLocaleDateString("en-CA")
                  setCustomFrom(today)
                  setCustomTo(today)
                }
                setRange("custom")
              }}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors duration-150 ${
                range === "custom"
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              }`}
            >
              Custom Range
            </button>
          </div>
          {range === "custom" && (
            <div className="flex items-center gap-2 text-xs">
              <input
                type="date"
                value={customFrom}
                onChange={event => {
                  const nextFrom = event.target.value
                  setCustomFrom(nextFrom)
                  if (!customTo || customTo < nextFrom) setCustomTo(nextFrom)
                }}
                className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-500" />
              <span className="text-slate-400">to</span>
              <input type="date" value={customTo} min={customFrom || undefined} onChange={e => setCustomTo(e.target.value)}
                className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-500" />
              {!customFrom && <span className="text-amber-500">Pick a start date</span>}
            </div>
          )}
          <button
            type="button"
            onClick={() => setRefreshTick(value => value + 1)}
            className="ml-auto px-2.5 py-1 rounded-md text-xs font-medium bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors duration-150"
          >
            ↻ Refresh Now
          </button>
        </div>
      </Card>

      {/* Quick stats — Total Users / Total Documents already live on Dashboard & Analytics,
          so this row only surfaces numbers unique to a range-filtered report */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="New Users" value={toNumber(userReport.newUsersInRange)} sub={selectedRangeLabel} accent="indigo" icon="👥" />
        <StatCard label="Documents Created" value={toNumber(documentReport.documentsCreatedInRange)} sub={selectedRangeLabel} accent="emerald" icon="📄" />
        <StatCard label="Deleted Documents" value={toNumber(documentReport.deletedDocuments)} sub={selectedRangeLabel} accent="emerald" icon="🗑️" />
        <StatCard
          label={hasRangeActiveUsers ? "Active Users" : "Active Users Today"}
          value={firstNumber(userReport.activeUsersInRange, userReport.activeUsersToday)}
          sub={hasRangeActiveUsers ? selectedRangeLabel : "Today only"}
          accent="sky"
          icon="⚡"
        />
        <StatCard
          label="Storage Activity"
          value={formatStorage(firstNumber(storageReport.storageInRangeMb, storageReport.totalStorageMb))}
          sub={selectedRangeLabel}
          accent="amber"
          icon="💾"
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Time in Editor" value={`${totalTimeHours} hrs`} sub={`${sessionText} · ${selectedRangeLabel}`} accent="rose" icon="⏱️" />
        <StatCard label="Avg. Session Time" value={formatDuration(avgSessionMinutes)} sub={`${sessionText} · ${selectedRangeLabel}`} accent="rose" icon="⏱️" />
        <StatCard
          label="User Growth Score"
          value={growthValue(userGrowth)}
          sub={growthSub(rangeGrowth?.usersCurrent, rangeGrowth?.usersPrevious)}
          accent={toNumber(userGrowth.value) >= 50 ? "emerald" : "rose"}
          icon="📈"
        />
        <StatCard
          label="Document Growth Score"
          value={growthValue(documentGrowth)}
          sub={growthSub(rangeGrowth?.docsCurrent, rangeGrowth?.docsPrevious)}
          accent={toNumber(documentGrowth.value) >= 50 ? "emerald" : "rose"}
          icon="📈"
        />
      </div>

      <p className="text-xs text-slate-400">
        Growth score = current-range activity ÷ (current-range + previous equal-range activity) × 100. It always stays between 0% and 100%.
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Longest Session" value={formatDuration(longestSessionMinutes)} sub={selectedRangeLabel} accent="indigo" icon="↗" />
        <StatCard label="Shortest Session" value={formatDuration(shortestSessionMinutes)} sub={selectedRangeLabel} accent="sky" icon="↘" />
        <StatCard label="Logins" value={toNumber(loginReport.loginsInRange)} sub={selectedRangeLabel} accent="emerald" icon="🔐" />
        <StatCard label="Feedback" value={toNumber(feedbackReport?.total)} sub={selectedRangeLabel} accent="amber" icon="💬" />
      </div>

      <Card title="Range Activity Overview — Pie Chart">
        <p className="text-xs text-slate-400 mb-4">
          Totals recalculate whenever Today, 7 Days, 30 Days or a custom range is selected.
        </p>
        <PieChart data={activityPie} size={190} />
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Device Traffic">
          <p className="text-xs text-slate-400 mb-4">Desktop and mobile logins in the selected range, based on stored user-agent data.</p>
          <PieChart data={trafficPie} size={170} />
        </Card>
        <Card title="Weekly Login Heatmap">
          <p className="text-xs text-slate-400 mb-4">Day and time pattern for logins in the selected range.</p>
          <div className="overflow-x-auto">
            <div className="min-w-[620px] grid gap-1" style={{ gridTemplateColumns: "44px repeat(8, minmax(56px, 1fr))" }}>
              <span />
              {[0, 3, 6, 9, 12, 15, 18, 21].map(hour => <span key={hour} className="text-[10px] text-center text-slate-400">{String(hour).padStart(2, "0")}:00</span>)}
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((dayName, dayIndex) => (
                <Fragment key={dayName}>
                  <span className="text-[10px] text-slate-400 self-center">{dayName}</span>
                  {[0, 3, 6, 9, 12, 15, 18, 21].map(hour => {
                    const value = [0, 1, 2].reduce((sum, offset) => sum + heatValue(dayIndex + 1, hour + offset), 0)
                    const opacity = value === 0 ? 0.08 : 0.25 + (value / maxHeat) * 0.75
                    return <span key={`${dayName}-${hour}`} title={`${dayName} ${hour}:00 — ${value} logins`} className="h-7 rounded bg-indigo-500" style={{ opacity }} />
                  })}
                </Fragment>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Content report */}
      <Card title="🔤 Content Report">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div><p className="text-slate-400 text-xs">Fonts</p><p className="font-semibold text-slate-700 dark:text-slate-200">{contentReport.fontCount}</p></div>
          <div><p className="text-slate-400 text-xs">Templates</p><p className="font-semibold text-slate-700 dark:text-slate-200">{contentReport.templateCount}</p></div>
          <div><p className="text-slate-400 text-xs">Dictionary Entries</p><p className="font-semibold text-slate-700 dark:text-slate-200">{contentReport.dictionaryEntryCount}</p></div>
        </div>
      </Card>

      {/* Security report */}
      <Card title="🔒 Security Report">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div><p className="text-slate-400 text-xs">Failed Admin Logins</p><p className="font-semibold text-slate-700 dark:text-slate-200">{securityReport.failedAdminLogins}</p></div>
          <div><p className="text-slate-400 text-xs">Admin Actions</p><p className="font-semibold text-slate-700 dark:text-slate-200">{securityReport.adminActions}</p></div>
          <div><p className="text-slate-400 text-xs">User Account Changes</p><p className="font-semibold text-slate-700 dark:text-slate-200">{securityReport.userAccountChanges}</p></div>
          <div><p className="text-slate-400 text-xs">Backup Events</p><p className="font-semibold text-slate-700 dark:text-slate-200">{securityReport.backupEvents}</p></div>
        </div>
        <p className="text-xs text-slate-400 mt-3">Full detail lives in Activity Logs — these are just range totals.</p>
      </Card>

      <Card title="Most Time Spent in Editor">
        {usageReport.topTimeUsers?.length ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {usageReport.topTimeUsers.map((u, i) => (
              <div key={i} className="py-2.5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{u.name}</p>
                  <p className="text-xs text-slate-400">{u.email}</p>
                </div>
                <Badge tone="slate">{u.hours} hrs · {u.sessions || 0} sessions</Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">No editor activity tracked yet.</p>
        )}
      </Card>

      <Card title="Top Active Users (by logins in range)">
        {loginReport.topActiveUsers?.length ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {loginReport.topActiveUsers.map((u, i) => (
              <div key={i} className="py-2.5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{u.name}</p>
                  <p className="text-xs text-slate-400">{u.email}</p>
                </div>
                <Badge tone="slate">{u.logins} logins</Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">No logins in this range.</p>
        )}
      </Card>

      <Card title="Top Storage Activity by User">
        {storageReport.topStorageUsers?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 uppercase tracking-wide border-b border-slate-100 dark:border-slate-700">
                  <th className="pb-2 font-medium">User</th>
                  <th className="pb-2 font-medium">Storage Activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {storageReport.topStorageUsers.map((u, i) => (
                  <tr key={i}>
                    <td className="py-2.5">
                      <p className="font-medium text-slate-700 dark:text-slate-200">{u.name}</p>
                      <p className="text-xs text-slate-400">{u.email}</p>
                    </td>
                    <td className="py-2.5"><Badge tone="slate">{formatStorage(u.storageMb)}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-400">No document data yet.</p>
        )}
      </Card>

      {/* Export options */}
      <Card title="📥 Export Options">
        {exportError && <p className="text-xs text-rose-500 mb-3">{exportError}</p>}
        <div className="flex flex-wrap gap-2">
          {CSV_TYPES.map(t => (
            <button
              key={t.value}
              onClick={() => downloadCsv(t.value)}
              disabled={Boolean(downloading)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors duration-150"
            >
              {downloading === t.value ? "Preparing…" : `⬇ ${t.label} CSV`}
            </button>
          ))}
          <button
            onClick={() => downloadCsv("summary", "?type=summary&range=month")}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors duration-150"
          >
            📆 Generate Monthly Report
          </button>
        </div>
      </Card>

      <p className="text-xs text-slate-400">
        Report generated {data.generatedAt ? new Date(data.generatedAt).toLocaleString() : "just now"} · {selectedRangeLabel}
      </p>
    </div>
  )
}
