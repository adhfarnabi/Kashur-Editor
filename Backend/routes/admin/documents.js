// routes/admin/documents.js
// Admin-wide document visibility — unlike routes/documents.js, these are
// NOT scoped to a single user. Admins can see, preview, and remove any
// document.
const express  = require("express")
const router   = express.Router()
const Document = require("../../models/Document")
const { logActivity } = require("../../utils/activityLogger")

// GET /api/admin/documents?search=&page=&limit=&includeDeleted=&archived=&approval=
router.get("/", async (req, res) => {
  try {
    const { search = "", page = 1, limit = 20, includeDeleted = "false", archived = "all", approval = "all" } = req.query
    const filter = {}
    if (includeDeleted !== "true") filter.deletedAt = null
    if (search.trim()) filter.title = { $regex: search.trim(), $options: "i" }
    if (archived === "true") filter.archivedAt = { $ne: null }
    if (archived === "false") filter.archivedAt = null
    if (approval !== "all") filter.approvalStatus = approval

    const pageNum  = Math.max(1, parseInt(page))
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)))

    const [docs, total] = await Promise.all([
      Document.find(filter)
        .populate("userId", "name email")
        .select("title wordCount pageCount isPublic shareToken createdAt updatedAt deletedAt archivedAt approvalStatus userId")
        .sort({ updatedAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      Document.countDocuments(filter),
    ])

    res.json({
      documents: docs.map(d => ({
        id: d._id, title: d.title, wordCount: d.wordCount, pageCount: d.pageCount,
        isPublic: d.isPublic, isDeleted: !!d.deletedAt, isArchived: !!d.archivedAt,
        approvalStatus: d.approvalStatus || "approved",
        createdAt: d.createdAt, updatedAt: d.updatedAt,
        owner: d.userId ? { id: d.userId._id, name: d.userId.name, email: d.userId.email } : null,
      })),
      total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum),
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/admin/documents/:id — full preview (includes html)
router.get("/:id", async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id).populate("userId", "name email").lean()
    if (!doc) return res.status(404).json({ error: "Document not found" })
    res.json({
      id: doc._id, title: doc.title, html: doc.html,
      wordCount: doc.wordCount, pageCount: doc.pageCount,
      isPublic: doc.isPublic, isDeleted: !!doc.deletedAt,
      createdAt: doc.createdAt, updatedAt: doc.updatedAt,
      owner: doc.userId ? { id: doc.userId._id, name: doc.userId.name, email: doc.userId.email } : null,
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// DELETE /api/admin/documents/:id — soft delete
router.delete("/:id", async (req, res) => {
  try {
    const doc = await Document.findOneAndUpdate(
      { _id: req.params.id, deletedAt: null },
      { $set: { deletedAt: new Date() } },
      { new: true },
    )
    if (!doc) return res.status(404).json({ error: "Document not found or already deleted" })

    await logActivity({
      action: "document.deleted", actorType: "admin", actor: req.admin,
      targetType: "Document", targetId: doc._id, targetLabel: doc.title, req,
    })

    res.json({ deleted: true, id: doc._id })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// PATCH /api/admin/documents/:id/restore — undo soft delete
router.patch("/:id/restore", async (req, res) => {
  try {
    const doc = await Document.findByIdAndUpdate(
      req.params.id, { $set: { deletedAt: null } }, { new: true }
    )
    if (!doc) return res.status(404).json({ error: "Document not found" })
    res.json({ restored: true, id: doc._id })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// PATCH /api/admin/documents/:id/archive — hide from user's list, recoverable
router.patch("/:id/archive", async (req, res) => {
  try {
    const { archived } = req.body
    const doc = await Document.findByIdAndUpdate(
      req.params.id, { $set: { archivedAt: archived ? new Date() : null } }, { new: true }
    )
    if (!doc) return res.status(404).json({ error: "Document not found" })
    await logActivity({
      action: archived ? "document.updated" : "document.updated", actorType: "admin", actor: req.admin,
      targetType: "Document", targetId: doc._id, targetLabel: doc.title,
      meta: { archived: !!archived }, req,
    })
    res.json({ id: doc._id, isArchived: !!doc.archivedAt })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// PATCH /api/admin/documents/:id/approval — approve/reject (only matters if
// EditorSettings.documentApprovalRequired is turned on)
router.patch("/:id/approval", async (req, res) => {
  try {
    const { status } = req.body
    if (!["approved", "pending", "rejected"].includes(status)) {
      return res.status(422).json({ error: "status must be approved, pending, or rejected" })
    }
    const doc = await Document.findByIdAndUpdate(
      req.params.id, { $set: { approvalStatus: status } }, { new: true }
    )
    if (!doc) return res.status(404).json({ error: "Document not found" })
    await logActivity({
      action: "document.updated", actorType: "admin", actor: req.admin,
      targetType: "Document", targetId: doc._id, targetLabel: doc.title,
      meta: { approvalStatus: status }, req,
    })
    res.json({ id: doc._id, approvalStatus: doc.approvalStatus })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
