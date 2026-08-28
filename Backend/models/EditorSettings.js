// models/EditorSettings.js
// A single document holding editor-wide defaults, controlled from the
// admin panel's "Editor Settings" section. Frontend can fetch this at
// startup (GET /api/settings/public) to apply defaults for new documents.
const mongoose = require("mongoose")

const EditorSettingsSchema = new mongoose.Schema(
  {
    singleton: { type: String, default: "main", unique: true }, // always "main" — enforces one doc

    defaultFont:      { type: String, default: "Noto Nastaliq Urdu" },
    defaultFontSize:  { type: Number, default: 14 },
    defaultTheme:     { type: String, enum: ["light", "dark", "system"], default: "system" },

    autoSaveEnabled:  { type: Boolean, default: true },
    autoSaveInterval: { type: Number, default: 30 }, // seconds

    maxDocumentsPerUser: { type: Number, default: 0 }, // 0 = unlimited
    allowPublicSharing:  { type: Boolean, default: true },
    allowSignups:        { type: Boolean, default: true },
    maintenanceMode:     { type: Boolean, default: false },
    maintenanceMessage:  { type: String, default: "" },

    // ── ADMIN PANEL ADDITIONS — App Settings ─────────────────────────────────
    appName:  { type: String, default: "Kashur Editor" },
    appLogoUrl: { type: String, default: "" },
    primaryColor: { type: String, default: "#6366f1" },
    defaultLanguage: { type: String, enum: ["kashmiri", "english", "urdu"], default: "kashmiri" },
    dateFormat: { type: String, default: "DD/MM/YYYY" },
    backupSchedule: { type: String, enum: ["off", "daily", "weekly", "monthly"], default: "off" },
    documentApprovalRequired: { type: Boolean, default: false },

    // ── ADMIN PANEL ADDITIONS — About Page (editable from Settings) ─────────
    aboutDeveloperInfo: { type: String, default: "Built by Adhfar Nabi, Aaqidah Majeed, and Mudasir Saleem — MCA, University of Kashmir, South Campus, Anantnag." },
    aboutVersion: { type: String, default: "1.0.0" },
    aboutLicense: { type: String, default: "Academic Project — All Rights Reserved" },
    aboutDocsUrl: { type: String, default: "" },
    aboutContactEmail: { type: String, default: "" },

    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
  },
  { timestamps: true }
)

// Helper — always returns the one settings doc, creating it if missing
EditorSettingsSchema.statics.getSingleton = async function () {
  let doc = await this.findOne({ singleton: "main" })
  if (!doc) doc = await this.create({ singleton: "main" })
  return doc
}

module.exports = mongoose.model("EditorSettings", EditorSettingsSchema)
