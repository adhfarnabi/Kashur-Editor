// models/LoginHistory.js
// One row per successful login — powers the admin "Login History" view
// and, combined with User.lastActiveAt, the "Online Users" indicator.
const mongoose = require("mongoose")

const LoginHistorySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    email:  { type: String, required: true },
    ip:     { type: String, default: "" },
    userAgent: { type: String, default: "" },
  },
  { timestamps: true }
)

LoginHistorySchema.index({ createdAt: -1 })

module.exports = mongoose.model("LoginHistory", LoginHistorySchema)
