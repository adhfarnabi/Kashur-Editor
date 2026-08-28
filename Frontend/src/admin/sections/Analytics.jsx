// src/admin/sections/Analytics.jsx
import { useMemo, useState, useEffect } from "react"
import { adminApi } from "../adminApi"
import {
  Card, StatCard, Spinner, BarChart, PieChart,
  ToggleGroup, groupByWeek, Badge, EmptyState, DistributionBars,
} from "../components/ui"

function shortDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

const PAGE_SIZE = 10 // days shown per page

function PageNav({ page, totalPages, onPrev, onNext, rangeLabel }) {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-between mt-2 text-xs text-slate-400">
      <button
        onClick={onPrev}
        disabled={page === 0}
        className="px-2 py-1 rounded hover:text-slate-200 hover:bg-slate-700/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        ◀ Previous 10
      </button>
      <span>{rangeLabel} · Page {page + 1} of {totalPages}</span>
      <button
        onClick={onNext}
        disabled={page === totalPages - 1}
        className="px-2 py-1 rounded hover:text-slate-200 hover:bg-slate-700/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        Next 10 ▶
      </button>
    </div>
  )
}

export default function Analytics() {
  const [data, setData] = useState(null)
  const [error, setError] = useState("")
  const [userGrouping, setUserGrouping] = useState("day")
  const [docGrouping, setDocGrouping] = useState("day")
  const [growthPage, setGrowthPage] = useState(0) // shared by User Growth + Document Growth
  const [loginPage, setLoginPage] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [updatedAt, setUpdatedAt] = useState(null)

  async function load(silent = false) {
    if (!silent) setRefreshing(true)
    try {
      const result = await adminApi.analytics()
      setData(result)
      setError("")
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

  const signupDaily = useMemo(() => {
    if (!data) return []
    return data.signupTrend.map(t => ({ label: shortDate(t.date), date: t.date, value: t.count }))
  }, [data])

  const docDaily = useMemo(() => {
    if (!data) return []
    return data.documentTrend.map(t => ({
      label: shortDate(t.date),
      date: t.date,
      public: t.public,
      private: t.private,
    }))
  }, [data])

  const loginDaily = useMemo(() => {
    if (!data) return []
    return data.loginTrend.map(t => ({ label: shortDate(t.date), count: t.count }))
  }, [data])

  const signupChartData = useMemo(() => {
    if (!data) return []
    return userGrouping === "week"
      ? groupByWeek(data.signupTrend.map(t => ({ date: t.date, value: t.count })), ["value"])
      : signupDaily
  }, [data, userGrouping, signupDaily])

  const docChartData = useMemo(() => {
    if (!data) return []
    return docGrouping === "week"
      ? groupByWeek(data.documentTrend.map(t => ({ date: t.date, public: t.public, private: t.private })), ["public", "private"])
      : docDaily
  }, [data, docGrouping, docDaily])

  const userTotalPages = Math.max(1, Math.ceil(signupChartData.length / PAGE_SIZE))
  const docTotalPages = Math.max(1, Math.ceil(docChartData.length / PAGE_SIZE))
  const growthTotalPages = Math.max(userTotalPages, docTotalPages)
  const loginTotalPages = Math.max(1, Math.ceil(loginDaily.length / PAGE_SIZE))

  // Whenever the data set (or day/week grouping) changes, jump to the page that contains today
  useEffect(() => { setGrowthPage(growthTotalPages - 1) }, [growthTotalPages, userGrouping, docGrouping])
  useEffect(() => { setLoginPage(loginTotalPages - 1) }, [loginTotalPages])

  // Each chart clamps to its own page count, in case Day/Week grouping gives it fewer pages than the other
  const userPage = Math.min(growthPage, userTotalPages - 1)
  const docPage = Math.min(growthPage, docTotalPages - 1)

  const userPageData = signupChartData.slice(userPage * PAGE_SIZE, userPage * PAGE_SIZE + PAGE_SIZE)
  const docPageData = docChartData.slice(docPage * PAGE_SIZE, docPage * PAGE_SIZE + PAGE_SIZE)
  const loginPageData = loginDaily.slice(loginPage * PAGE_SIZE, loginPage * PAGE_SIZE + PAGE_SIZE)

  const growthRangeLabel = userPageData.length
    ? `${userPageData[0].label} – ${userPageData[userPageData.length - 1].label}`
    : ""
  const loginRangeLabel = loginPageData.length
    ? `${loginPageData[0].label} – ${loginPageData[loginPageData.length - 1].label}`
    : ""

  if (error && !data) return <Card><p className="text-rose-500 text-sm">{error}</p></Card>
  if (!data) return <Spinner />

  const { overview, deviceUsage, topUsers } = data
  const deviceTotal = deviceUsage.desktop + deviceUsage.mobile
  const engagementPie = data.engagementFunnel.map((item, index) => ({
    ...item,
    color: ["#4f46e5", "#0ea5e9", "#10b981", "#f59e0b"][index % 4],
  }))
  const documentVisibility = [
    { label: "Public", value: overview.publicDocuments, color: "#0ea5e9" },
    { label: "Private", value: overview.privateDocuments, color: "#6366f1" },
  ]
  const loginHours = data.loginByHour.map(row => ({
    label: row.label,
    value: row.count,
  }))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 shadow-sm">
        <div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Live analytics workspace</p>
          <p className="text-xs text-slate-400 mt-0.5">
            Auto-refreshes every minute{updatedAt ? ` · updated ${updatedAt.toLocaleTimeString()}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => load()}
          disabled={refreshing}
          className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 text-xs font-semibold transition disabled:opacity-50"
        >
          {refreshing ? "Refreshing…" : "↻ Refresh"}
        </button>
      </div>
      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30 px-4 py-3 text-xs text-amber-700 dark:text-amber-300">
          Latest refresh failed: {error}. Showing the previous data.
        </div>
      )}
      {/* Overview numbers */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total Users" value={overview.totalUsers} accent="indigo" icon="👥" />
        <StatCard label="Active Today" value={overview.activeToday} sub={`${overview.activeWeek} this week`} accent="sky" icon="⚡" />
        <StatCard label="New This Month" value={overview.newUsersMonth} sub={`${overview.newUsersToday} today`} accent="emerald" icon="📈" />
        <StatCard label="Total Documents" value={overview.totalDocuments} accent="amber" icon="📄" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Public Docs" value={overview.publicDocuments} sub={`${overview.privateDocuments} private`} accent="sky" icon="🌐" />
        <StatCard label="Documents Shared" value={overview.sharedDocuments} sub="Public / share-enabled" accent="indigo" icon="🔗" />
        <StatCard label="Avg. Session Time (30d)" value={`${overview.avgEditingMinutes}m`} sub={`${overview.totalEditingHours}h total`} accent="emerald" icon="⏱️" />
        <StatCard label="Total Logins (30d)" value={overview.totalLoginsLast30d} accent="amber" icon="🔑" />
      </div>

      {/* User growth — vertical bars: x-axis = date (or week), y-axis = signup count */}
      <Card
        title="User Growth"
        action={<ToggleGroup options={[{ label: "Day", value: "day" }, { label: "Week", value: "week" }]} value={userGrouping} onChange={setUserGrouping} />}
      >
        <p className="text-xs text-slate-400 mb-3">New user registrations, {userGrouping === "week" ? "grouped by week" : "day by day"} — last 30 days.</p>
        <BarChart data={userPageData} keys={["value"]} colors={["#4f46e5"]} height={210} />
        <PageNav
          page={growthPage}
          totalPages={growthTotalPages}
          onPrev={() => setGrowthPage(p => Math.max(0, p - 1))}
          onNext={() => setGrowthPage(p => Math.min(growthTotalPages - 1, p + 1))}
          rangeLabel={growthRangeLabel}
        />
      </Card>

      {/* Document growth — vertical bars: x-axis = date (or week), y-axis = documents created */}
      <Card
        title="Document Growth"
        action={<ToggleGroup options={[{ label: "Day", value: "day" }, { label: "Week", value: "week" }]} value={docGrouping} onChange={setDocGrouping} />}
      >
        <div className="flex items-center justify-between gap-3 mb-3">
          <p className="text-xs text-slate-400">Public and private documents created, {docGrouping === "week" ? "grouped by week" : "day by day"}.</p>
          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            <span><i className="inline-block w-2 h-2 rounded-sm bg-sky-500 mr-1" />Public</span>
            <span><i className="inline-block w-2 h-2 rounded-sm bg-indigo-500 mr-1" />Private</span>
          </div>
        </div>
        <BarChart data={docPageData} keys={["public", "private"]} colors={["#0ea5e9", "#6366f1"]} />
        <PageNav
          page={growthPage}
          totalPages={growthTotalPages}
          onPrev={() => setGrowthPage(p => Math.max(0, p - 1))}
          onNext={() => setGrowthPage(p => Math.min(growthTotalPages - 1, p + 1))}
          rangeLabel={growthRangeLabel}
        />
      </Card>

      {/* Login activity + device usage */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card title="Login Activity — Last 30 Days">
          <BarChart data={loginPageData} keys={["count"]} colors={["#f11e1e"]} />
          <PageNav
            page={loginPage}
            totalPages={loginTotalPages}
            onPrev={() => setLoginPage(p => Math.max(0, p - 1))}
            onNext={() => setLoginPage(p => Math.min(loginTotalPages - 1, p + 1))}
            rangeLabel={loginRangeLabel}
          />
        </Card>
        <Card title="Device Usage">
          <p className="text-xs text-slate-400 mb-3">Desktop vs. mobile, parsed from stored login user-agents (last 30 days).</p>
          {deviceTotal === 0 ? (
            <EmptyState icon="📱" title="No login data yet" />
          ) : (
            <BarChart
              data={[
                { label: "Mobile", value: deviceUsage.mobile },
                { label: "Desktop", value: deviceUsage.desktop },
              ]}
              keys={["value"]}
              colors={["#0ea83d"]}
              height={160}
            />
          )}
        </Card>
      </div>

      {/* These insights use different visual forms to avoid repeating trend charts. */}
      <div className="grid xl:grid-cols-2 gap-4">
        <Card title="User Engagement">
          <p className="text-xs text-slate-400 mb-4">Registered, verified, active and document-creator user groups.</p>
          <PieChart data={engagementPie} size={190} />
        </Card>
        <Card title="Document Visibility">
          <p className="text-xs text-slate-400 mb-4">Current public and private document distribution.</p>
          <PieChart data={documentVisibility} size={180} />
        </Card>
      </div>

      <div className="grid xl:grid-cols-3 gap-4">
        <Card title="Document Size Distribution">
          <p className="text-xs text-slate-400 mb-4">X-axis: word-count range · Y-axis: number of documents.</p>
          <BarChart data={data.wordCountDistribution} keys={["value"]} colors={["#6366f1"]} height={210} />
        </Card>
        <Card title="Feedback by Type">
          <p className="text-xs text-slate-400 mb-4">Feature requests, bugs and general feedback are shown separately.</p>
          <DistributionBars data={data.feedbackTypeDistribution} color="#f59e0b" />
        </Card>
        <Card title="Login Hours">
          <p className="text-xs text-slate-400 mb-4">X-axis: hour · Y-axis: successful logins during the last 30 days.</p>
          <BarChart data={loginHours} keys={["value"]} colors={["#10b981"]} height={210} />
        </Card>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Average Words / Doc" value={Math.round(data.documentQuality.avgWords)} sub={`${data.documentQuality.avgPages} average pages`} accent="indigo" icon="✍️" />
        <StatCard label="Empty Documents" value={data.documentQuality.emptyDocuments} sub="Need user attention" accent="rose" icon="🗒️" />
        <StatCard label="500+ Word Documents" value={data.documentQuality.substantialDocuments} sub="Substantial content" accent="emerald" icon="📚" />
        <StatCard label="Dictionary Coverage" value={data.contentInventory.dictionaryEntries} sub={`${data.contentInventory.activeFonts} active fonts`} accent="amber" icon="📖" />
      </div>

      <Card title="Most Active Users">
        <p className="text-xs text-slate-400 mb-3">
          Per-user breakdown — who's actually driving usage, not just site-wide totals.
        </p>
        {topUsers.length === 0 ? (
          <EmptyState icon="👥" title="No activity yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 uppercase tracking-wide border-b border-slate-100 dark:border-slate-700">
                  <th className="pb-2 font-medium">#</th>
                  <th className="pb-2 font-medium">User</th>
                  <th className="pb-2 font-medium">Documents</th>
                  <th className="pb-2 font-medium">Words Written</th>
                  <th className="pb-2 font-medium">Last Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {topUsers.map((u, i) => (
                  <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors duration-150">
                    <td className="py-2.5 text-slate-400">{i + 1}</td>
                    <td className="py-2.5">
                      <p className="font-medium text-slate-700 dark:text-slate-200">{u.name}</p>
                      <p className="text-xs text-slate-400">{u.email}</p>
                    </td>
                    <td className="py-2.5">
                      <Badge tone="indigo">{u.documentCount}</Badge>
                    </td>
                    <td className="py-2.5 text-slate-500 dark:text-slate-400">{u.totalWords.toLocaleString()}</td>
                    <td className="py-2.5 text-slate-400">{u.lastActive ? new Date(u.lastActive).toLocaleDateString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="text-xs text-slate-400 text-center">
       More insights and advanced analytics will become available as user activity and engagement data continue to grow .
      </p>
    </div>
  )
}
