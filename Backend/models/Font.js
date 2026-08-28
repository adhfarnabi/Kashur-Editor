// models/Font.js
// Fonts made available inside the Kashur Editor's font picker.
// Admin can add/edit/remove/enable-disable fonts without a code deploy.
const mongoose = require("mongoose")

const FontSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 150 }, // display name, e.g. "Noto Nastaliq Urdu"
    family: { type: String, required: true, trim: true },               // CSS font-family value
    script: {
      type: String,
      enum: ["kashmiri", "urdu", "english", "other"],
      default: "kashmiri",
    },
    // Where the font file lives — a URL (Google Fonts, CDN, or your own /fonts path)
    url: { type: String, default: "" },
    fileFormat: { type: String, enum: ["ttf", "otf", "woff", "woff2", "google", ""], default: "" },

    isDefault: { type: Boolean, default: false },
    active:    { type: Boolean, default: true, index: true },
    sortOrder: { type: Number, default: 0 },

    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
  },
  { timestamps: true }
)

module.exports = mongoose.model("Font", FontSchema)
