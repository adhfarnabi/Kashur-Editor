// routes/admin/templates.js
const express  = require("express")
const router   = express.Router()
const Template = require("../../models/Template")
const { logActivity } = require("../../utils/activityLogger")

router.get("/", async (req, res) => {
  try {
    const { category = "all" } = req.query
    const filter = category !== "all" ? { category } : {}
    const templates = await Template.find(filter).sort({ createdAt: -1 }).lean()
    res.json({ templates })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.get("/:id", async (req, res) => {
  try {
    const template = await Template.findById(req.params.id).lean()
    if (!template) return res.status(404).json({ error: "Template not found" })
    res.json({ template })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.post("/", async (req, res) => {
  try {
    const { title, category, description, thumbnailUrl, html } = req.body
    if (!title || !html) return res.status(422).json({ error: "title and html are required" })

    const template = await Template.create({
      title, category, description, thumbnailUrl, html, createdBy: req.admin._id,
    })
    await logActivity({ action: "template.created", actorType: "admin", actor: req.admin, targetType: "Template", targetId: template._id, targetLabel: template.title, req })
    res.status(201).json({ template })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.put("/:id", async (req, res) => {
  try {
    const { title, category, description, thumbnailUrl, html, active } = req.body
    const template = await Template.findByIdAndUpdate(
      req.params.id,
      { $set: { title, category, description, thumbnailUrl, html, active } },
      { new: true, omitUndefined: true }
    )
    if (!template) return res.status(404).json({ error: "Template not found" })
    await logActivity({ action: "template.updated", actorType: "admin", actor: req.admin, targetType: "Template", targetId: template._id, targetLabel: template.title, req })
    res.json({ template })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.delete("/:id", async (req, res) => {
  try {
    const template = await Template.findByIdAndDelete(req.params.id)
    if (!template) return res.status(404).json({ error: "Template not found" })
    await logActivity({ action: "template.deleted", actorType: "admin", actor: req.admin, targetType: "Template", targetId: template._id, targetLabel: template.title, req })
    res.json({ deleted: true, id: req.params.id })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
