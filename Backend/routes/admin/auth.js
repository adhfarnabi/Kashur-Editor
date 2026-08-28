// routes/admin/auth.js
// POST /api/admin/auth/login  — email + password → admin JWT
// GET  /api/admin/auth/me     — current admin profile
// POST /api/admin/auth/change-password
//
// There is intentionally no admin signup route. The single admin account is
// seeded from .env (see utils/seedAdmin.js). This project uses one flat
// admin role — no tiers.
const express = require("express")
const router  = express.Router()
const Admin   = require("../../models/Admin")
const { generateAdminToken } = require("../../utils/adminJwt")
const { protectAdmin }       = require("../../middleware/adminAuth")
const { logActivity }        = require("../../utils/activityLogger")

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(422).json({ error: "Email and password are required" })
    }

    const admin = await Admin.findOne({ email: email.toLowerCase().trim() }).select("+password")
    if (!admin || !admin.active) {
      await logActivity({ action: "admin.login_failed", actorType: "system", meta: { email }, req })
      return res.status(401).json({ error: "Incorrect email or password." })
    }

    const isMatch = await admin.comparePassword(password)
    if (!isMatch) {
      await logActivity({ action: "admin.login_failed", actorType: "system", meta: { email }, req })
      return res.status(401).json({ error: "Incorrect email or password." })
    }

    admin.lastLoginAt = new Date()
    admin.lastLoginIp = req.ip || ""
    await admin.save()

    const token = generateAdminToken(admin)
    await logActivity({ action: "admin.login", actorType: "admin", actor: admin, req })

    res.json({ message: "Login successful.", token, admin: admin.toPublic() })
  } catch (e) {
    console.error("Admin login error:", e)
    res.status(500).json({ error: "Login failed. Please try again." })
  }
})

router.get("/me", protectAdmin, (req, res) => {
  res.json({ admin: req.admin.toPublic() })
})

router.post("/change-password", protectAdmin, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body
    if (!currentPassword || !newPassword) {
      return res.status(422).json({ error: "Current and new password are required" })
    }
    if (newPassword.length < 8) {
      return res.status(422).json({ error: "New password must be at least 8 characters" })
    }
    if (confirmPassword && newPassword !== confirmPassword) {
      return res.status(422).json({ error: "Passwords do not match" })
    }

    const admin = await Admin.findById(req.admin._id).select("+password")
    const isMatch = await admin.comparePassword(currentPassword)
    if (!isMatch) return res.status(401).json({ error: "Current password is incorrect" })

    admin.password = newPassword
    await admin.save()
    res.json({ message: "Password changed successfully." })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
