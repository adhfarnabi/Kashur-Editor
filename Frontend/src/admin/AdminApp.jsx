// src/admin/AdminApp.jsx
import { useEffect, useState } from "react"
import { AdminAuthProvider, useAdminAuth } from "./AdminAuthContext"
import { adminApi } from "./adminApi"
import AdminLogin from "./AdminLogin"
import AdminLayout from "./AdminLayout"

import AdminDashboard from "./sections/AdminDashboard"
import Analytics from "./sections/Analytics"
import Reports from "./sections/Reports"
import UserManagement from "./sections/UserManagement"
import DocumentManagement from "./sections/DocumentManagement"
import FontManagement from "./sections/FontManagement"
import TemplateManagement from "./sections/TemplateManagement"
import DictionaryManagement from "./sections/DictionaryManagement"
import ShapeManagement from "./sections/ShapeManagement"
import BackupRestore from "./sections/BackupRestore"
import EditorSettingsSection from "./sections/EditorSettingsSection"
import ActivityLogs from "./sections/ActivityLogs"
import FeedbackMessages from "./sections/FeedbackMessages"
import AboutApp from "./sections/AboutApp"
import SystemSettings from "./sections/SystemSettings"

const ADMIN_SECTION_KEY = "kashur_admin_section"

function AdminShell() {
  const { admin, isLoading } = useAdminAuth()
  const [section, setSection] = useState(() =>
    localStorage.getItem(ADMIN_SECTION_KEY) || "dashboard",
  )
  const [feedbackCount, setFeedbackCount] = useState(0)

  useEffect(() => {
    if (!admin) return
    const refreshFeedbackCount = () =>
      adminApi.feedback("?status=new&limit=1")
        .then(data => setFeedbackCount(data.newCount || 0))
        .catch(() => {})
    refreshFeedbackCount()
    const timer = window.setInterval(refreshFeedbackCount, 60000)
    return () => window.clearInterval(timer)
  }, [admin])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-slate-700 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (!admin) return <AdminLogin />

  const sections = {
    dashboard: <AdminDashboard />,
    analytics: <Analytics />,
    reports: <Reports />,
    users: <UserManagement />,
    documents: <DocumentManagement />,
    fonts: <FontManagement />,
    templates: <TemplateManagement />,
    dictionary: <DictionaryManagement />,
    images: <ShapeManagement />,
    backup: <BackupRestore />,
    "editor-settings": <EditorSettingsSection />,
    activity: <ActivityLogs />,
    feedback: <FeedbackMessages onCountChange={setFeedbackCount} />,
    system: <SystemSettings />,
    about: <AboutApp />,
  }
  const activeSection = sections[section] ? section : "dashboard"
  const navigate = nextSection => {
    setSection(nextSection)
    localStorage.setItem(ADMIN_SECTION_KEY, nextSection)
  }

  return (
    <AdminLayout active={activeSection} onNavigate={navigate} badges={{ feedback: feedbackCount }}>
      {sections[activeSection]}
    </AdminLayout>
  )
}

export default function AdminApp() {
  return (
    <AdminAuthProvider>
      <AdminShell />
    </AdminAuthProvider>
  )
}
