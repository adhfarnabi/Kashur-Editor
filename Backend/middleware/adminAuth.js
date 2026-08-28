// middleware/adminAuth.js
const Admin = require("../models/Admin")
const { verifyAdminToken } = require("../utils/adminJwt")

async function protectAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Admin authentication required." })
    }
    const token = authHeader.split(" ")[1]

    let decoded
    try {
      decoded = verifyAdminToken(token)
    } catch (e) {
      if (e.name === "TokenExpiredError") {
        return res.status(401).json({ error: "Session expired. Please log in again.", code: "TOKEN_EXPIRED" })
      }
      return res.status(401).json({ error: "Invalid admin token.", code: "TOKEN_INVALID" })
    }

    if (decoded.role !== "admin") {
      return res.status(403).json({ error: "Not an admin token." })
    }

    const admin = await Admin.findById(decoded.id)
    if (!admin || !admin.active) {
      return res.status(401).json({ error: "Admin account not found or disabled." })
    }

    req.admin = admin
    next()
  } catch (e) {
    console.error("Admin auth middleware error:", e)
    res.status(500).json({ error: "Authentication error" })
  }
}

module.exports = { protectAdmin }
