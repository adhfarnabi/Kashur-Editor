// models/Template.js
// Reusable document templates (cover pages, letters, reports) offered to
// users when they start a new document.
const mongoose = require("mongoose")

const TemplateSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    category: {
      type: String,
      enum: ["cover-page", "letter", "report", "resume", "assignment", "other"],
      default: "other",
      index: true,
    },
    description: { type: String, default: "", maxlength: 500 },
    thumbnailUrl: { type: String, default: "" },
    html: { type: String, required: true }, // the actual template markup inserted into the editor

    active: { type: Boolean, default: true, index: true },
    usageCount: { type: Number, default: 0 },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
  },
  { timestamps: true }
)

module.exports = mongoose.model("Template", TemplateSchema)
