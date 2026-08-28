// routes/admin/settings.js
const express = require("express")
const router  = express.Router()
const EditorSettings = require("../../models/EditorSettings")
const { logActivity } = require("../../utils/activityLogger")

router.get("/", async (req, res) => {
  try {
    const settings = await EditorSettings.getSingleton()
    res.json({ settings })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.put("/", async (req, res) => {
  try {
    const allowed = [
      "defaultFont", "defaultFontSize", "defaultTheme",
      "autoSaveEnabled", "autoSaveInterval", "maxDocumentsPerUser",
      "allowPublicSharing", "allowSignups", "maintenanceMode", "maintenanceMessage",
      "appName", "appLogoUrl", "primaryColor", "defaultLanguage", "dateFormat",
      "backupSchedule", "documentApprovalRequired",
      "aboutDeveloperInfo", "aboutVersion", "aboutLicense", "aboutDocsUrl", "aboutContactEmail",
    ]
    const updates = {}
    for (const key of allowed) if (req.body[key] !== undefined) updates[key] = req.body[key]
    updates.updatedBy = req.admin._id

    const settings = await EditorSettings.findOneAndUpdate(
      { singleton: "main" }, { $set: updates }, { new: true, upsert: true }
    )
    await logActivity({ action: "settings.updated", actorType: "admin", actor: req.admin, meta: updates, req })
    res.json({ settings })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
