// utils/adminJwt.js
// Admin tokens are signed separately from user tokens (different secret if
// provided) and carry role:"admin" so they can never be mistaken for a
// regular user token even if someone tampers with the payload.
const jwt = require("jsonwebtoken")

// Falls back to JWT_SECRET with a suffix if you don't set a dedicated one —
// but for real deployments, set ADMIN_JWT_SECRET to a different value.
const SECRET     = process.env.ADMIN_JWT_SECRET || `${process.env.JWT_SECRET || "change-this-secret"}::admin`
const EXPIRES_IN = process.env.ADMIN_JWT_EXPIRES_IN || "12h"

function generateAdminToken(admin) {
  return jwt.sign(
    { id: admin._id, email: admin.email, role: "admin" },
    SECRET,
    { expiresIn: EXPIRES_IN }
  )
}

function verifyAdminToken(token) {
  return jwt.verify(token, SECRET)
}

module.exports = { generateAdminToken, verifyAdminToken }
