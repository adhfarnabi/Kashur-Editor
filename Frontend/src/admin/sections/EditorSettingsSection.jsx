// src/admin/sections/EditorSettingsSection.jsx
import { useEffect, useState } from "react"
import { adminApi } from "../adminApi"
import { Card, Button, Input, Select, Textarea, Spinner } from "../components/ui"

export default function EditorSettingsSection() {
  const [settings, setSettings] = useState(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  useEffect(() => { adminApi.getSettings().then(d => setSettings(d.settings)) }, [])

  const set = (k, v) => setSettings(s => ({ ...s, [k]: v }))

  async function save() {
    setSaving(true); setMessage("")
    try {
      const { settings: updated } = await adminApi.updateSettings(settings)
      setSettings(updated)
      setMessage("Settings saved.")
    } catch (e) { setMessage(e.message) }
    setSaving(false)
  }

  if (!settings) return <Spinner />

  return (
    <div className="space-y-4 max-w-2xl">
      <Card title="App Settings">
        <div className="grid sm:grid-cols-2 gap-4">
          <Input label="Application Name" value={settings.appName} onChange={e => set("appName", e.target.value)} />
          <Input label="Logo URL" value={settings.appLogoUrl} onChange={e => set("appLogoUrl", e.target.value)} placeholder="https://…/logo.png" />
          <label className="block">
            <span className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Primary Theme Color</span>
            <div className="flex items-center gap-2">
              <input type="color" value={settings.primaryColor} onChange={e => set("primaryColor", e.target.value)} className="w-10 h-9 rounded border border-slate-200 dark:border-slate-600" />
              <Input value={settings.primaryColor} onChange={e => set("primaryColor", e.target.value)} className="flex-1" />
            </div>
          </label>
          <Select label="Default Language" value={settings.defaultLanguage} onChange={e => set("defaultLanguage", e.target.value)}>
            <option value="kashmiri">Kashmiri</option>
            <option value="english">English</option>
            <option value="urdu">Urdu</option>
          </Select>
          <Select label="Date & Time Format" value={settings.dateFormat} onChange={e => set("dateFormat", e.target.value)}>
            <option value="DD/MM/YYYY">DD/MM/YYYY</option>
            <option value="MM/DD/YYYY">MM/DD/YYYY</option>
            <option value="YYYY-MM-DD">YYYY-MM-DD</option>
          </Select>
          <Select label="Backup Schedule" value={settings.backupSchedule} onChange={e => set("backupSchedule", e.target.value)}>
            <option value="off">Off (manual only)</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </Select>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 mt-4">
          <input type="checkbox" checked={settings.documentApprovalRequired} onChange={e => set("documentApprovalRequired", e.target.checked)} />
          Require admin approval before shared documents go public
        </label>
        <p className="text-xs text-slate-400 mt-2">
          Backup Schedule is a preference flag for now — actual scheduled backups would need a cron
          job calling the export endpoint; the setting's stored and ready for that when you add it.
        </p>
      </Card>

      <Card title="About Page Content">
        <div className="space-y-3">
          <Textarea label="Developer Info" rows={2} value={settings.aboutDeveloperInfo} onChange={e => set("aboutDeveloperInfo", e.target.value)} />
          <div className="grid sm:grid-cols-2 gap-4">
            <Input label="Version" value={settings.aboutVersion} onChange={e => set("aboutVersion", e.target.value)} />
            <Input label="License" value={settings.aboutLicense} onChange={e => set("aboutLicense", e.target.value)} />
            <Input label="Docs URL" value={settings.aboutDocsUrl} onChange={e => set("aboutDocsUrl", e.target.value)} />
            <Input label="Contact Email" value={settings.aboutContactEmail} onChange={e => set("aboutContactEmail", e.target.value)} />
          </div>
        </div>
      </Card>

      <Card title="Document Defaults">
        <div className="grid sm:grid-cols-2 gap-4">
          <Input label="Default Font" value={settings.defaultFont} onChange={e => set("defaultFont", e.target.value)} />
          <Input label="Default Font Size" type="number" value={settings.defaultFontSize} onChange={e => set("defaultFontSize", Number(e.target.value))} />
          <Select label="Default Theme" value={settings.defaultTheme} onChange={e => set("defaultTheme", e.target.value)}>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="system">Follow System</option>
          </Select>
          <Input label="Max Documents / User (0 = unlimited)" type="number" value={settings.maxDocumentsPerUser} onChange={e => set("maxDocumentsPerUser", Number(e.target.value))} />
        </div>
      </Card>

      <Card title="Autosave">
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 mb-3">
          <input type="checkbox" checked={settings.autoSaveEnabled} onChange={e => set("autoSaveEnabled", e.target.checked)} />
          Enable autosave
        </label>
        <Input label="Autosave Interval (seconds)" type="number" value={settings.autoSaveInterval}
          onChange={e => set("autoSaveInterval", Number(e.target.value))} disabled={!settings.autoSaveEnabled} className="max-w-[200px]" />
      </Card>

      <Card title="Access & Sharing">
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={settings.allowSignups} onChange={e => set("allowSignups", e.target.checked)} />
            Allow new user signups
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={settings.allowPublicSharing} onChange={e => set("allowPublicSharing", e.target.checked)} />
            Allow public document sharing
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={settings.maintenanceMode} onChange={e => set("maintenanceMode", e.target.checked)} />
            Maintenance mode (blocks non-admin usage)
          </label>
          {settings.maintenanceMode && (
            <Input label="Maintenance Message" value={settings.maintenanceMessage} onChange={e => set("maintenanceMessage", e.target.value)}
              placeholder="We'll be back shortly…" />
          )}
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save Settings"}</Button>
        {message && <span className="text-sm text-slate-500">{message}</span>}
      </div>
    </div>
  )
}
