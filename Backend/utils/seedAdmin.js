// utils/seedAdmin.js
// Runs once at server startup. If no Admin exists yet, creates one using
// ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME from .env — this is what gives
// you access to the panel out of the box. After first login you can change
// the password from inside the panel (or just edit .env + restart, which
// will NOT overwrite an existing admin — it only seeds when the collection
// is empty).
const Admin = require("../models/Admin")

async function seedAdmin() {
  try {
    const existingCount = await Admin.countDocuments()
    if (existingCount > 0) return // already set up — never overwrite

    const email    = process.env.ADMIN_EMAIL
    const password = process.env.ADMIN_PASSWORD
    const name      = process.env.ADMIN_NAME || "Admin"

    if (!email || !password) {
      console.warn("\n⚠️  No admin account exists yet, and ADMIN_EMAIL / ADMIN_PASSWORD are not set in .env.")
      console.warn("   Add both to Backend/.env and restart the server to create the first admin.\n")
      return
    }

    await Admin.create({ name, email: email.toLowerCase().trim(), password, role: "admin" })
    console.log(`\n✅  Admin account created for ${email} (from .env). You can log in at /admin now.\n`)
  } catch (e) {
    console.error("❌  Admin seed failed:", e.message)
  }
}

module.exports = seedAdmin
