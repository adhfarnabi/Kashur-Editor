// src/admin/sections/AboutApp.jsx
import { useEffect, useState } from "react"
import { adminApi } from "../adminApi"
import { Card, Badge, Spinner } from "../components/ui"

export default function AboutApp() {
  const [settings, setSettings] = useState(null)
  useEffect(() => { adminApi.getSettings().then(d => setSettings(d.settings)).catch(() => setSettings({})) }, [])
  if (!settings) return <Spinner />

  return (
    <div className="space-y-4 max-w-2xl">
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-2xl overflow-hidden">
            {settings.appLogoUrl ? <img src={settings.appLogoUrl} alt="logo" className="w-full h-full object-cover" /> : "📝"}
          </div>
          <div>
            <h2 className="font-bold text-lg text-slate-800 dark:text-slate-100">{settings.appName || "Kashur Editor"}</h2>
            <p className="text-sm text-slate-400">A full-stack Kashmiri Nastaliq word processor · v{settings.aboutVersion || "1.0.0"}</p>
          </div>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          Kashur Editor is an MS Word-style, RTL-first word processor built for writing in Kashmiri
          Nastaliq script — with shapes, charts, tables, image editing, cover pages, WordArt, and a
          dedicated Kashmiri writing assistant. Built with the MERN stack (MongoDB, Express, React, Node.js).
        </p>
      </Card>

      <Card title="Developer Information">
        <p className="text-sm text-slate-600 dark:text-slate-300">{settings.aboutDeveloperInfo}</p>
      </Card>

      <Card title="License & Documentation">
        <div className="space-y-2 text-sm">
          <p><span className="text-slate-400">License:</span> {settings.aboutLicense}</p>
          {settings.aboutDocsUrl && (
            <p><span className="text-slate-400">Docs:</span> <a href={settings.aboutDocsUrl} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">{settings.aboutDocsUrl}</a></p>
          )}
          {settings.aboutContactEmail && (
            <p><span className="text-slate-400">Contact:</span> {settings.aboutContactEmail}</p>
          )}
        </div>
        <p className="text-xs text-slate-400 mt-3">Edit this info from Editor Settings → App Settings.</p>
      </Card>

      <Card title="Tech Stack">
        <div className="flex flex-wrap gap-2">
          {["React", "Node.js", "Express", "MongoDB", "Mongoose", "JWT Auth", "Nodemailer", "docx"].map(t => (
            <Badge key={t} tone="indigo">{t}</Badge>
          ))}
        </div>
      </Card>
    </div>
  )
}
