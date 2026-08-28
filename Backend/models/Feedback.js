// models/Feedback.js
// Stores every contact/feedback submission so admins can review it in the
// panel, in addition to the email that already gets sent to DEVELOPER_EMAIL.
const mongoose = require("mongoose")

const FeedbackSchema = new mongoose.Schema(
  {
    fromName:  { type: String, required: true, trim: true, maxlength: 150 },
    fromEmail: { type: String, required: true, trim: true, lowercase: true },
    type: {
      type: String,
      enum: ["feedback", "bug", "feature", "other"],
      default: "other",
    },
    subject: { type: String, required: true, trim: true, maxlength: 300 },
    message: { type: String, required: true, trim: true },

    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    status: {
      type: String,
      enum: ["new", "read", "replied", "archived"],
      default: "new",
      index: true,
    },
    emailSent: { type: Boolean, default: false },
  },
  { timestamps: true }
)

FeedbackSchema.index({ createdAt: -1 })

module.exports = mongoose.model("Feedback", FeedbackSchema)
