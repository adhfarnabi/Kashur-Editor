// src/admin/AdminLayout.jsx
import { useEffect, useState } from "react"
import { useAdminAuth } from "./AdminAuthContext"
import { ConfirmDialog } from "./components/ui"

export const NAV_SECTIONS = [
  { group: "Overview", items: [
    { id: "dashboard", label: "Dashboard", icon: "📊" },
    { id: "analytics", label: "Analytics", icon: "📈" },
    { id: "reports", label: "Reports", icon: "🧾" },
  ]},
  { group: "Content", items: [
    { id: "documents", label: "Documents", icon: "📄" },
    { id: "users", label: "Users", icon: "👥" },
    { id: "feedback", label: "Feedback & Messages", icon: "💬", badgeKey: "feedback" },
  ]},
  { group: "Editor Content", items: [
    { id: "fonts", label: "Font Management", icon: "🔤" },
    { id: "templates", label: "Template Management", icon: "🗂️" },
    { id: "dictionary", label: "Dictionary", icon: "📖" },
    { id: "images", label: "Shape Management", icon: "🔷" },
  ]},
  { group: "System", items: [
    { id: "backup", label: "Backup & Restore", icon: "💾" },
    { id: "editor-settings", label: "Editor Settings", icon: "⚙️" },
    { id: "activity", label: "Activity Logs", icon: "🕓" },
    { id: "system", label: "System Settings", icon: "🛠️" },
    { id: "about", label: "About", icon: "ℹ️" },
  ]},
]

export default function AdminLayout({ active, onNavigate, badges = {}, children }) {
  const { admin, logout } = useAdminAuth()
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [darkMode, setDarkMode] = useState(() =>
    document.documentElement.classList.contains("dark") ||
    localStorage.getItem("kashur-admin-dark") === "true",
  )

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode)
    localStorage.setItem("kashur-admin-dark", String(darkMode))
  }, [darkMode])

  const activeLabel = NAV_SECTIONS.flatMap(g => g.items).find(i => i.id === active)?.label || ""

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-40 w-64 bg-slate-950 flex flex-col
        transform transition-transform md:translate-x-0
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
      `}>
        <div className="flex items-center gap-2.5 px-5 h-16 border-b border-slate-800 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-sm shadow-lg shadow-indigo-900/50 ring-1 ring-indigo-400/20">🛡️</div>
          <div>
            <p className="text-white text-sm font-semibold leading-tight">Kashur Admin</p>
            <p className="text-slate-500 text-[10px] leading-tight flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" /> Control Panel
            </p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {NAV_SECTIONS.map(group => (
            <div key={group.group}>
              <p className="px-2 text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-1.5">{group.group}</p>
              <div className="space-y-0.5">
                {group.items.map(item => {
                  const isActive = active === item.id
                  const badge = item.badgeKey ? badges[item.badgeKey] : null
                  return (
                    <button
                      key={item.id}
                      onClick={() => { onNavigate(item.id); setSidebarOpen(false) }}
                      className={`relative w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all duration-150 ${
                        isActive
                          ? "bg-indigo-600 text-white font-medium shadow-sm shadow-indigo-900/40"
                          : "text-slate-400 hover:bg-slate-900 hover:text-slate-200 hover:translate-x-0.5"
                      }`}
                    >
                      {isActive && <span className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-5 rounded-full bg-indigo-400" />}
                      <span className="text-base">{item.icon}</span>
                      <span className="flex-1 text-left">{item.label}</span>
                      {!!badge && (
                        <span className="text-[10px] bg-rose-500 text-white rounded-full px-1.5 py-0.5 font-semibold min-w-[18px] text-center animate-pulse">
                          {badge}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-800">
          <div className="flex items-center gap-2.5 px-2 py-2 mb-1">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white text-xs font-bold shrink-0 ring-2 ring-slate-800">
              {admin?.name?.[0]?.toUpperCase() || "A"}
            </div>
            <div className="min-w-0">
              <p className="text-slate-200 text-xs font-medium truncate">{admin?.name}</p>
              <p className="text-slate-500 text-[10px] truncate">{admin?.email}</p>
            </div>
          </div>
          <button
            onClick={() => setConfirmLogout(true)}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-slate-400 hover:bg-slate-900 hover:text-rose-400 transition-colors duration-150"
          >
            <span className="text-base">🚪</span> Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 flex items-center px-4 md:px-6 gap-3 shrink-0 sticky top-0 z-20">
          <button className="md:hidden text-slate-500" onClick={() => setSidebarOpen(true)}>☰</button>
          <h1 className="text-base font-semibold text-slate-800 dark:text-slate-100">{activeLabel}</h1>
          <span className="hidden sm:inline text-xs text-slate-400">
            {new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
          </span>
          <div className="ml-auto flex items-center gap-1.5 text-xs text-slate-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
            Live
          </div>
          <button
            type="button"
            onClick={() => setDarkMode(value => !value)}
            className="w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            title={darkMode ? "Use light mode" : "Use dark mode"}
            aria-label={darkMode ? "Use light mode" : "Use dark mode"}
          >
            {darkMode ? "☀️" : "🌙"}
          </button>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>

      {confirmLogout && (
        <ConfirmDialog
          title="Log out?"
          message="You'll need to sign in again to access the admin panel."
          confirmLabel="Log out"
          danger
          onConfirm={() => { setConfirmLogout(false); logout() }}
          onCancel={() => setConfirmLogout(false)}
        />
      )}
    </div>
  )
}
