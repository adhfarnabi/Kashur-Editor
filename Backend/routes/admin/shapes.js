// routes/admin/shapes.js
const express = require("express")
const router  = express.Router()
const Shape   = require("../../models/Shape")
const { logActivity } = require("../../utils/activityLogger")

router.get("/", async (req, res) => {
  try {
    const shapes = await Shape.find({}).sort({ sortOrder: 1, name: 1 }).lean()
    res.json({ shapes })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.post("/", async (req, res) => {
  try {
    const { name, category, svgMarkup, sortOrder } = req.body
    if (!name || !svgMarkup) return res.status(422).json({ error: "name and svgMarkup are required" })
    if (!svgMarkup.trim().startsWith("<svg")) return res.status(422).json({ error: "svgMarkup must be a valid <svg>...</svg> string" })

    const shape = await Shape.create({ name, category, svgMarkup, sortOrder: sortOrder || 0, addedBy: req.admin._id })
    await logActivity({ action: "image.created", actorType: "admin", actor: req.admin, targetType: "Shape", targetId: shape._id, targetLabel: shape.name, req })
    res.status(201).json({ shape })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.put("/:id", async (req, res) => {
  try {
    const { name, category, svgMarkup, active, sortOrder } = req.body
    const shape = await Shape.findByIdAndUpdate(
      req.params.id, { $set: { name, category, svgMarkup, active, sortOrder } }, { new: true, omitUndefined: true }
    )
    if (!shape) return res.status(404).json({ error: "Shape not found" })
    res.json({ shape })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.delete("/:id", async (req, res) => {
  try {
    const shape = await Shape.findByIdAndDelete(req.params.id)
    if (!shape) return res.status(404).json({ error: "Shape not found" })
    await logActivity({ action: "image.deleted", actorType: "admin", actor: req.admin, targetType: "Shape", targetId: shape._id, targetLabel: shape.name, req })
    res.json({ deleted: true, id: req.params.id })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
