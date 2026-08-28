// routes/admin/backup.js
// GET  /api/admin/backup/export — downloads a JSON dump of core collections
// POST /api/admin/backup/restore — restores from a previously exported dump
//
// This is a logical (JSON) backup, not a raw MongoDB binary dump — simplest
// to implement without extra tooling (mongodump), and portable. For a real
// production deployment you'd eventually want scheduled mongodump backups
// too, but this covers "export my data / restore it" for a project like
// this.
const express  = require("express")
const router   = express.Router()
const User     = require("../../models/User")
const Document = require("../../models/Document")
const Font     = require("../../models/Font")
const Template = require("../../models/Template")
const DictionaryEntry = require("../../models/DictionaryEntry")
const Shape = require("../../models/Shape")
const EditorSettings = require("../../models/EditorSettings")
const { logActivity } = require("../../utils/activityLogger")

const COLLECTIONS = { User, Document, Font, Template, DictionaryEntry, Shape, EditorSettings }

router.get("/export", async (req, res) => {
  try {
    const { include = "Document,Font,Template,DictionaryEntry,Shape,EditorSettings" } = req.query
    const names = include.split(",").map(s => s.trim()).filter(Boolean)

    const data = {}
    for (const name of names) {
      if (!COLLECTIONS[name]) continue
      // Never export password hashes, even for User — exclude sensitive fields
      const projection = name === "User" ? "-password" : undefined
      data[name] = await COLLECTIONS[name].find({}, projection).lean()
    }

    await logActivity({ action: "backup.created", actorType: "admin", actor: req.admin, meta: { collections: names }, req })

    res.setHeader("Content-Disposition", `attachment; filename="kashur-editor-backup-${Date.now()}.json"`)
    res.json({ exportedAt: new Date().toISOString(), collections: names, data })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// POST /api/admin/backup/restore — body: { data: { CollectionName: [...] }, mode: "merge" | "replace" }
// "merge" (default) inserts/upserts by _id. "replace" wipes the collection first.
// NOTE: This never touches the User collection to avoid accidentally
// restoring stale password hashes over live accounts — restore users
// manually/carefully if you ever truly need to.
router.post("/restore", async (req, res) => {
  try {
    const { data, mode = "merge" } = req.body
    if (!data || typeof data !== "object") return res.status(422).json({ error: "data object is required" })

    const results = {}
    for (const [name, rows] of Object.entries(data)) {
      if (name === "User") { results[name] = "skipped (users are never auto-restored)"; continue }
      const Model = COLLECTIONS[name]
      if (!Model || !Array.isArray(rows)) continue

      if (mode === "replace") await Model.deleteMany({})

      let count = 0
      for (const row of rows) {
        const { _id, ...rest } = row
        await Model.findByIdAndUpdate(_id, { $set: rest }, { upsert: true, setDefaultsOnInsert: true })
        count++
      }
      results[name] = `${count} records restored`
    }

    await logActivity({ action: "backup.restored", actorType: "admin", actor: req.admin, meta: { mode, results }, req })
    res.json({ message: "Restore complete.", results })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
