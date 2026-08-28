// server.js — kashur Editor API Server (MongoDB / Mongoose)
require("dotenv").config()
const express   = require("express")
const mongoose  = require("mongoose")
const cors      = require("cors")

const documentRoutes = require("./routes/documents")
const authRoutes     = require("./routes/auth")
const publicRoutes   = require("./routes/public") // ADMIN PANEL ADDITION — fonts/templates/shapes for the real editor
const { protect, requireVerified } = require("./middleware/auth")

// ─── ADMIN PANEL ADDITIONS ─────────────────────────────────────────────────
const seedAdmin       = require("./utils/seedAdmin")
const { protectAdmin } = require("./middleware/adminAuth")

const adminAuthRoutes       = require("./routes/admin/auth")
const adminDashboardRoutes  = require("./routes/admin/dashboard")
const adminAnalyticsRoutes  = require("./routes/admin/analytics")
const adminUserRoutes       = require("./routes/admin/users")
const adminDocumentRoutes   = require("./routes/admin/documents")
const adminFontRoutes       = require("./routes/admin/fonts")
const adminTemplateRoutes   = require("./routes/admin/templates")
const adminDictionaryRoutes = require("./routes/admin/dictionary")
const adminShapeRoutes      = require("./routes/admin/shapes")
const adminBackupRoutes     = require("./routes/admin/backup")
const adminSettingsRoutes   = require("./routes/admin/settings")
const adminActivityRoutes   = require("./routes/admin/activity")
const adminFeedbackRoutes   = require("./routes/admin/feedback")
const adminReportsRoutes    = require("./routes/admin/reports")
// ────────────────────────────────────────────────────────────────────────────

const app  = express()
const PORT = process.env.PORT || 3001

// ─── CORS ─────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:4173",
  "http://localhost:8080",
  process.env.FRONTEND_URL,
].filter(Boolean)

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true)
    cb(new Error(`CORS blocked: ${origin}`))
  },
  methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization","X-Editor-Active"],
  credentials: true,
}))

app.use(express.json({ limit: "15mb" }))
app.use(express.urlencoded({ extended: true }))

// ─── MONGODB ──────────────────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/kashur_editor"

mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log(`✅  MongoDB connected: ${MONGO_URI}`)
    await seedAdmin() // creates the first admin from .env if none exists yet
  })
  .catch(err => {
    console.error("❌  MongoDB connection failed:", err.message)
    process.exit(1)
  })

mongoose.connection.on("disconnected", () => console.warn("⚠️  MongoDB disconnected"))
mongoose.connection.on("reconnected",  () => console.log("✅  MongoDB reconnected"))

// ─── ROUTES ───────────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({ status:"ok", time:new Date().toISOString(), database: mongoose.connection.readyState===1?"connected":"disconnected" })
})



// Auth routes — public (no JWT needed)
app.use("/api/auth", authRoutes)

// ADMIN PANEL ADDITION — public, no auth: lets KashurEditor.jsx pull
// admin-managed fonts, templates, and shapes at runtime
app.use("/api/public", publicRoutes)

// ─── CONTACT / FEEDBACK — sends email to developer AND saves to DB ────────────
// Can be called with or without JWT (we read user info from body if provided)
app.post("/api/contact", async (req, res) => {
  try {
    const { fromName, fromEmail, type, subject, message } = req.body

    // Basic validation
    if (!subject || !subject.trim()) return res.status(422).json({ error: "Subject is required" })
    if (!message || message.trim().length < 10) return res.status(422).json({ error: "Message must be at least 10 characters" })
    if (!fromEmail) return res.status(422).json({ error: "Email is required" })

    const Feedback = require("./models/Feedback")
    const { sendEmail, contactEmail } = require("./utils/email")
    const template = contactEmail({ fromName, fromEmail, type, subject, message })

    // Save to DB first so it always shows up in the admin panel, even if
    // email sending fails or isn't configured.
    const savedFeedback = await Feedback.create({
      fromName: fromName || "Anonymous",
      fromEmail,
      type: ["feedback", "bug", "feature"].includes(type) ? type : "other",
      subject,
      message,
      userId: req.body.userId || null,
    })

    // Send TO the developer's email (MAIL_USER or a dedicated DEVELOPER_EMAIL)
    const devEmail = process.env.DEVELOPER_EMAIL || process.env.MAIL_USER
    if (!devEmail) {
      console.log("\n📬  CONTACT FORM SUBMISSION (email not configured — saved to DB only)")
      console.log(`   From:    ${fromName} <${fromEmail}>`)
      console.log(`   Type:    ${type}`)
      console.log(`   Subject: ${subject}`)
      console.log(`   Message: ${message}\n`)
      return res.json({ ok: true, message: "Message received (dev mode — not emailed, saved to admin panel)" })
    }

    try {
      await sendEmail({
        to:      devEmail,
        subject: template.subject,
        html:    template.html,
        replyTo: `"${fromName}" <${fromEmail}>`,
      })
      savedFeedback.emailSent = true
      await savedFeedback.save()
    } catch (mailErr) {
      // Email failed but we already saved it — the admin can still see it.
      console.error("Contact email send failed (message was still saved):", mailErr.message)
    }

    res.json({ ok: true, message: "Message sent successfully" })
  } catch (e) {
    console.error("Contact form error:", e)
    res.status(500).json({ error: "Failed to send message. Please try again." })
  }
})

// ─── PUBLIC SHARE VIEW — no login required ────────────────────────────────────
// GET /api/share/:token  → returns document HTML for anyone with the link
// This is intentionally OUTSIDE the protect middleware
app.get("/api/share/:token", async (req, res) => {
  try {
    const Document = require("./models/Document")
    const doc = await Document.findOne({
      shareToken: req.params.token,
      isPublic:   true,
      deletedAt:  null,
      archivedAt: null,
    }).select("title html wordCount pageCount updatedAt isPublic shareToken")

    if (!doc) {
      return res.status(404).json({ error: "Document not found or link has been deactivated." })
    }

    // Return minimal data — no userId, no wordCount, just what viewer needs
    res.json({
      id:    doc._id,
      title: doc.title,
      html:  doc.html,
      wordCount: doc.wordCount,
      pageCount: doc.pageCount,
      updatedAt: doc.updatedAt,
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── PUBLIC EDITOR SETTINGS — no login required ───────────────────────────────
// GET /api/settings/public → lets the editor fetch admin-configured defaults
// (default font, autosave interval, maintenance mode) at startup.
app.get("/api/settings/public", async (req, res) => {
  try {
    const EditorSettings = require("./models/EditorSettings")
    const s = await EditorSettings.getSingleton()
    res.json({
      defaultFont: s.defaultFont,
      defaultFontSize: s.defaultFontSize,
      defaultTheme: s.defaultTheme,
      autoSaveEnabled: s.autoSaveEnabled,
      autoSaveInterval: s.autoSaveInterval,
      allowPublicSharing: s.allowPublicSharing,
      allowSignups: s.allowSignups,
      maintenanceMode: s.maintenanceMode,
      maintenanceMessage: s.maintenanceMessage,
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Document routes — protected (must be logged in + email verified)
app.use("/api/documents", protect, requireVerified, documentRoutes)

// ─── ADMIN ROUTES ───────────────────────────────────────────────────────────
// Login is public; everything else under /api/admin/* requires a valid
// admin JWT (checked by protectAdmin).
app.use("/api/admin/auth", adminAuthRoutes)
app.use("/api/admin/dashboard",  protectAdmin, adminDashboardRoutes)
app.use("/api/admin/analytics",  protectAdmin, adminAnalyticsRoutes)
app.use("/api/admin/documents",  protectAdmin, adminDocumentRoutes)
app.use("/api/admin/users",      protectAdmin, adminUserRoutes)
app.use("/api/admin/feedback",   protectAdmin, adminFeedbackRoutes)
app.use("/api/admin/fonts",      protectAdmin, adminFontRoutes)
app.use("/api/admin/templates",  protectAdmin, adminTemplateRoutes)
app.use("/api/admin/dictionary", protectAdmin, adminDictionaryRoutes)
app.use("/api/admin/shapes",     protectAdmin, adminShapeRoutes)
app.use("/api/admin/activity",   protectAdmin, adminActivityRoutes)
app.use("/api/admin/reports",    protectAdmin, adminReportsRoutes)
app.use("/api/admin/backup",     protectAdmin, adminBackupRoutes)
app.use("/api/admin/settings",   protectAdmin, adminSettingsRoutes)

// ─── ERROR HANDLERS ───────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Not found: ${req.method} ${req.originalUrl}` })
})

app.use((err, req, res, next) => {
  console.error("Server error:", err)
  res.status(500).json({ error: err.message || "Internal server error" })
})

// ─── START ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀  kashur Editor API → http://localhost:${PORT}`)
  console.log(`\n   Auth endpoints:`)
  console.log(`   POST /api/auth/signup`)
  console.log(`   POST /api/auth/verify-otp`)
  console.log(`   POST /api/auth/resend-otp`)
  console.log(`   POST /api/auth/login`)
  console.log(`   POST /api/auth/forgot-password`)
  console.log(`   POST /api/auth/reset-password`)
  console.log(`   GET  /api/auth/me`)
  console.log(`\n   Document endpoints (JWT required):`)
  console.log(`   GET  /api/documents`)
  console.log(`   POST /api/documents`)
  console.log(`   PUT  /api/documents/:id`)
  console.log(`   DELETE /api/documents/:id`)
  console.log(`   PATCH /api/documents/:id/share`)
  console.log(`   GET  /api/documents/:id/export/txt`)
  console.log(`   GET  /api/documents/:id/export/docx`)
  console.log(`   GET  /api/share/:token (public)`)
  console.log(`\n   Admin panel:`)
  console.log(`   POST /api/admin/auth/login`)
  console.log(`   GET  /api/admin/dashboard\n`)
})
