// utils/jwt.js
const jwt = require("jsonwebtoken")

const SECRET      = process.env.JWT_SECRET || "change-this-secret-in-production"
const EXPIRES_IN  = process.env.JWT_EXPIRES_IN || "7d"

/** Generate a signed JWT for a user */
function generateToken(userId) {
  return jwt.sign(
    { id: userId },
    SECRET,
    { expiresIn: EXPIRES_IN }
  )
}

/** Verify a JWT — returns decoded payload or throws */
function verifyToken(token) {
  return jwt.verify(token, SECRET)
}

module.exports = { generateToken, verifyToken }