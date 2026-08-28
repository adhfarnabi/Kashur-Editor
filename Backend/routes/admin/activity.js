// routes/admin/activity.js
const express = require("express")
const router  = express.Router()
const ActivityLog = require("../../models/ActivityLog")

// GET /api/admin/activity?action=&actorType=&page=&limit=
router.get("/", async (req, res) => {
  try {
    const { action = "all", actorType = "all", page = 1, limit = 40 } = req.query
    const filter = {}
    if (action !== "all") filter.action = action
    else filter.action = { $ne: "editor.session" }
    if (actorType !== "all") filter.actorType = actorType

    const pageNum  = Math.max(1, parseInt(page))
    const limitNum = Math.min(200, Math.max(1, parseInt(limit)))

    const [logs, total] = await Promise.all([
      ActivityLog.find(filter).sort({ createdAt: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum).lean(),
      ActivityLog.countDocuments(filter),
    ])
    res.json({ logs, total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
