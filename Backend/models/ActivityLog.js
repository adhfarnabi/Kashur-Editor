// models/ActivityLog.js
// Append-only log of important actions across the app — surfaced in the
// admin panel's "Activity Logs" section.
const mongoose = require("mongoose")

const ActivityLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      enum: [
        "document.created", "document.updated", "document.deleted",
        "document.shared", "document.unshared",
        "editor.session",
        "user.signup", "user.login", "user.disabled", "user.enabled", "user.deleted",
        "user.created_by_admin", "user.email_verified_by_admin", "user.password_reset_by_admin",
        "admin.login", "admin.login_failed",
        "font.created", "font.updated", "font.deleted",
        "template.created", "template.updated", "template.deleted",
        "dictionary.created", "dictionary.updated", "dictionary.deleted",
        "image.created", "image.deleted",
        "settings.updated",
        "backup.created", "backup.restored",
      ],
      index: true,
    },
    // Who performed the action
    actorType: { type: String, enum: ["user", "admin", "system"], default: "user" },
    actorId:   { type: mongoose.Schema.Types.ObjectId, default: null },
    actorName: { type: String, default: "" },
    actorEmail:{ type: String, default: "" },

    // What it was performed on (optional — e.g. a document id)
    targetType: { type: String, default: null },
    targetId:   { type: mongoose.Schema.Types.ObjectId, default: null },
    targetLabel:{ type: String, default: "" }, // e.g. document title, for quick display

    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    ip:   { type: String, default: "" },
  },
  { timestamps: true }
)

ActivityLogSchema.index({ createdAt: -1 })
ActivityLogSchema.index({ action: 1, actorId: 1, createdAt: -1 })

module.exports = mongoose.model("ActivityLog", ActivityLogSchema)
