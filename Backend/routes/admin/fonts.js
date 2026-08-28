// routes/admin/fonts.js
const express = require("express")
const router  = express.Router()
const Font    = require("../../models/Font")
const { logActivity } = require("../../utils/activityLogger")

router.get("/", async (req, res) => {
  try {
    const fonts = await Font.find({}).sort({ sortOrder: 1, name: 1 }).lean()
    res.json({ fonts })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.post("/", async (req, res) => {
  try {
    const { name, family, script, url, fileFormat, isDefault, sortOrder } = req.body
    if (!name || !family) return res.status(422).json({ error: "name and family are required" })

    if (isDefault) await Font.updateMany({}, { $set: { isDefault: false } })

    const font = await Font.create({
      name, family, script, url, fileFormat, isDefault: !!isDefault,
      sortOrder: sortOrder || 0, addedBy: req.admin._id,
    })

    await logActivity({ action: "font.created", actorType: "admin", actor: req.admin, targetType: "Font", targetId: font._id, targetLabel: font.name, req })
    res.status(201).json({ font })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.put("/:id", async (req, res) => {
  try {
    const { name, family, script, url, fileFormat, active, isDefault, sortOrder } = req.body
    if (isDefault) await Font.updateMany({}, { $set: { isDefault: false } })

    const font = await Font.findByIdAndUpdate(
      req.params.id,
      { $set: { name, family, script, url, fileFormat, active, isDefault, sortOrder } },
      { new: true, omitUndefined: true }
    )
    if (!font) return res.status(404).json({ error: "Font not found" })

    await logActivity({ action: "font.updated", actorType: "admin", actor: req.admin, targetType: "Font", targetId: font._id, targetLabel: font.name, req })
    res.json({ font })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.delete("/:id", async (req, res) => {
  try {
    const font = await Font.findByIdAndDelete(req.params.id)
    if (!font) return res.status(404).json({ error: "Font not found" })
    await logActivity({ action: "font.deleted", actorType: "admin", actor: req.admin, targetType: "Font", targetId: font._id, targetLabel: font.name, req })
    res.json({ deleted: true, id: req.params.id })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
