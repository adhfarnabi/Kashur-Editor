// middleware/auth.js
const User = require("../models/User")
const { verifyToken } = require("../utils/jwt")

/**
 * protect — JWT authentication middleware
 * Reads Bearer token from Authorization header.
 * Attaches req.user to the request.
 * Returns 401 if missing / invalid / expired.
 */
async function protect(req, res, next) {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Authentication required. Please log in." })
    }
    const token = authHeader.split(" ")[1]

    let decoded
    try {
      decoded = verifyToken(token)
    } catch (e) {
      if (e.name === "TokenExpiredError") {
        return res.status(401).json({ error: "Session expired. Please log in again.", code: "TOKEN_EXPIRED" })
      }
      return res.status(401).json({ error: "Invalid token. Please log in again.", code: "TOKEN_INVALID" })
    }

    const user = await User.findById(decoded.id).select("+passwordChangedAt +active")
    if (!user || !user.active) {
      return res.status(401).json({ error: "User not found or account deactivated." })
    }

    if (!user.isTokenValid(decoded.iat)) {
      return res.status(401).json({ error: "Password recently changed. Please log in again.", code: "TOKEN_STALE" })
    }

    // ADMIN PANEL ADDITION — maintenance mode blocks regular document usage.
    // Login/auth itself still works so people aren't locked out of seeing
    // the message; this only guards the /api/documents/* routes that use
    // this middleware.
    const EditorSettings = require("../models/EditorSettings")
    const settings = await EditorSettings.getSingleton()
    if (settings.maintenanceMode) {
      return res.status(503).json({
        error: settings.maintenanceMessage || "Kashur Editor is currently under maintenance. Please check back soon.",
        code: "MAINTENANCE_MODE",
      })
    }

    req.user = user
    next()
  } catch (e) {
    console.error("Auth middleware error:", e)
    res.status(500).json({ error: "Authentication error" })
  }
}

/** requireVerified — use after protect(). Blocks if email not verified. */
function requireVerified(req, res, next) {
  if (!req.user.emailVerified) {
    return res.status(403).json({
      error: "Please verify your email address first.",
      code:  "EMAIL_NOT_VERIFIED",
    })
  }
  next()
}

module.exports = { protect, requireVerified }