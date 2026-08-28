// routes/admin/users.js
// Full user management: list/search, view detail, enable/disable, delete,
// login history, and online-status tracking.
const express  = require("express")
const router   = express.Router()
const User     = require("../../models/User")
const Document = require("../../models/Document")
const LoginHistory = require("../../models/LoginHistory")
const { logActivity } = require("../../utils/activityLogger")

const ONLINE_WINDOW_MS = 5 * 60 * 1000 // active within last 5 minutes = "online"

// GET /api/admin/users/online — must come before /:id
router.get("/online", async (req, res) => {
  try {
    const since = new Date(Date.now() - ONLINE_WINDOW_MS)
    const users = await User.find({ lastActiveAt: { $gte: since } })
      .select("name email lastActiveAt").sort({ lastActiveAt: -1 }).lean()
    res.json({ users, count: users.length })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// GET /api/admin/users/login-history?page=&limit= — global recent logins
router.get("/login-history", async (req, res) => {
  try {
    const { page = 1, limit = 30 } = req.query
    const pageNum  = Math.max(1, parseInt(page))
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)))
    const [logins, total] = await Promise.all([
      LoginHistory.find({}).sort({ createdAt: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum).lean(),
      LoginHistory.countDocuments({}),
    ])
    res.json({ logins, total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// GET /api/admin/users?search=&status=&page=&limit=
router.get("/", async (req, res) => {
  try {
    const { search = "", status = "all", page = 1, limit = 20 } = req.query
    const filter = {}
    if (search.trim()) {
      filter.$or = [
        { name:  { $regex: search.trim(), $options: "i" } },
        { email: { $regex: search.trim(), $options: "i" } },
      ]
    }
    if (status === "verified")   filter.emailVerified = true
    if (status === "unverified") filter.emailVerified = false
    if (status === "disabled")   filter.active = false

    const pageNum  = Math.max(1, parseInt(page))
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)))

    const [users, total] = await Promise.all([
      User.find(filter).select("+active +deletedAt")
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      User.countDocuments(filter),
    ])

    // Attach document counts in one aggregation
    const ids = users.map(u => u._id)
    const counts = await Document.aggregate([
      { $match: { userId: { $in: ids }, deletedAt: null } },
      { $group: { _id: "$userId", count: { $sum: 1 } } },
    ])
    const countMap = Object.fromEntries(counts.map(c => [String(c._id), c.count]))
    const onlineSince = new Date(Date.now() - ONLINE_WINDOW_MS)

    res.json({
      users: users.map(u => ({
        id: u._id, name: u.name, email: u.email, phone: u.phone,
        emailVerified: u.emailVerified, active: u.active !== false,
        createdAt: u.createdAt, documentCount: countMap[String(u._id)] || 0,
        lastActiveAt: u.lastActiveAt || null,
        online: !!(u.lastActiveAt && u.lastActiveAt >= onlineSince),
        totalActiveSeconds: u.totalActiveSeconds || 0,
      })),
      total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum),
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/admin/users/:id
router.get("/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("+active +deletedAt").lean()
    if (!user) return res.status(404).json({ error: "User not found" })
    const [documents, recentLogins] = await Promise.all([
      Document.find({ userId: user._id, deletedAt: null })
        .select("title wordCount createdAt updatedAt").sort({ updatedAt: -1 }).lean(),
      LoginHistory.find({ userId: user._id }).sort({ createdAt: -1 }).limit(10).lean(),
    ])
    const onlineSince = new Date(Date.now() - ONLINE_WINDOW_MS)
    res.json({
      user: {
        id: user._id, name: user.name, email: user.email, phone: user.phone,
        emailVerified: user.emailVerified, active: user.active !== false,
        createdAt: user.createdAt, lastActiveAt: user.lastActiveAt || null,
        online: !!(user.lastActiveAt && user.lastActiveAt >= onlineSince),
        totalActiveSeconds: user.totalActiveSeconds || 0,
      },
      documents,
      recentLogins,
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// PATCH /api/admin/users/:id/status — enable/disable
router.patch("/:id/status", async (req, res) => {
  try {
    const { active } = req.body
    if (typeof active !== "boolean") return res.status(422).json({ error: "active (boolean) is required" })

    const user = await User.findByIdAndUpdate(req.params.id, { $set: { active } }, { new: true })
    if (!user) return res.status(404).json({ error: "User not found" })

    await logActivity({
      action: active ? "user.enabled" : "user.disabled",
      actorType: "admin", actor: req.admin,
      targetType: "User", targetId: user._id, targetLabel: user.email, req,
    })

    res.json({ message: active ? "User enabled." : "User disabled.", id: user._id, active })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// DELETE /api/admin/users/:id — permanent delete (also soft-deletes their documents)
router.delete("/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
    if (!user) return res.status(404).json({ error: "User not found" })

    await Document.updateMany({ userId: user._id }, { $set: { deletedAt: new Date() } })
    await user.deleteOne()

    await logActivity({
      action: "user.deleted", actorType: "admin", actor: req.admin,
      targetType: "User", targetId: user._id, targetLabel: user.email, req,
    })

    res.json({ deleted: true, id: req.params.id })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/admin/users — admin creates a new user account directly
router.post("/", async (req, res) => {
  try {
    const { name, email, phone, password, autoVerify = true } = req.body
    if (!name || !email || !password) {
      return res.status(422).json({ error: "name, email and password are required" })
    }
    const existing = await User.findOne({ email: email.toLowerCase().trim() })
    if (existing) return res.status(409).json({ error: "A user with that email already exists" })

    const user = await User.create({
      name, email, phone, password,
      emailVerified: !!autoVerify,
    })

    await logActivity({
      action: "user.created_by_admin", actorType: "admin", actor: req.admin,
      targetType: "User", targetId: user._id, targetLabel: user.email, req,
    })

    res.status(201).json({ user: user.toPublic() })
  } catch (e) {
    if (e.name === "ValidationError") return res.status(422).json({ error: e.message })
    res.status(500).json({ error: e.message })
  }
})

// PATCH /api/admin/users/:id/verify — mark a user's email as verified
router.patch("/:id/verify", async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { $set: { emailVerified: true } }, { new: true })
    if (!user) return res.status(404).json({ error: "User not found" })

    await logActivity({
      action: "user.email_verified_by_admin", actorType: "admin", actor: req.admin,
      targetType: "User", targetId: user._id, targetLabel: user.email, req,
    })

    res.json({ message: "Email marked as verified.", id: user._id, emailVerified: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/admin/users/:id/reset-password — generate a new temporary
// password, save it (hashed, via the normal pre-save hook), and email it
// to the user. Returns the plain password once so the admin can also hand
// it over directly if mail isn't configured (dev mode prints to console).
router.post("/:id/reset-password", async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
    if (!user) return res.status(404).json({ error: "User not found" })

    const tempPassword = require("crypto").randomBytes(6).toString("base64url") // ~8 chars, URL-safe
    user.password = tempPassword
    await user.save()

    const { sendEmail } = require("../../utils/email")
    try {
      await sendEmail({
        to: user.email,
        subject: "Kashur Editor — Your password was reset by an admin",
        html: `<p>Hello ${user.name},</p><p>An administrator reset your Kashur Editor password. Your temporary password is:</p><p style="font-size:20px;font-weight:700;letter-spacing:2px;">${tempPassword}</p><p>Please log in and change it right away.</p>`,
      })
    } catch (mailErr) {
      console.error("Reset-password email failed to send:", mailErr.message)
    }

    await logActivity({
      action: "user.password_reset_by_admin", actorType: "admin", actor: req.admin,
      targetType: "User", targetId: user._id, targetLabel: user.email, req,
    })

    res.json({ message: "Password reset. A temporary password was emailed to the user.", tempPassword })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
