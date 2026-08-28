// models/Document.js
const mongoose = require("mongoose")

const DocumentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      default: "Document 1",
      trim: true,
      maxlength: 500,
    },
    html: {
      type: String,
      default: "",
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    // NEW: Public sharing fields
    isPublic: {
      type: Boolean,
      default: false,
    },
    shareToken: {
      type: String,
      default: null,
    },
    wordCount: {
      type: Number,
      default: 0,
    },
    pageCount: {
      type: Number,
      default: 1,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    // ── ADMIN PANEL ADDITIONS ────────────────────────────────────────────────
    archivedAt: { type: Date, default: null, index: true }, // separate from delete — hidden from user's list but recoverable
    approvalStatus: {
      type: String,
      enum: ["approved", "pending", "rejected"],
      default: "approved", // existing documents stay unaffected; only matters if you turn approval workflow on
    },
  },
  {
    timestamps: true,
    collection: "documents",
  }
)

// Indexes
DocumentSchema.index({ userId: 1, updatedAt: -1 })
DocumentSchema.index({ deletedAt: 1 })
DocumentSchema.index(
  { shareToken: 1 },
  {
    unique: true,
    partialFilterExpression: { shareToken: { $type: "string" } },
  }
)

// Virtual: excerpt
DocumentSchema.virtual("excerpt").get(function () {
  if (!this.html) return ""
  return this.html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200)
})

// Instance method: toSafeObject
DocumentSchema.methods.toSafeObject = function () {
  return {
    id:        this._id,
    title:     this.title,
    excerpt:   this.excerpt,
    wordCount: this.wordCount,
    pageCount: this.pageCount,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    isPublic:  this.isPublic,      // include if needed in future responses
  }
}

// Static: count words
DocumentSchema.statics.countWords = function (html) {
  if (!html) return 0
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
  return text ? text.split(/\s+/).length : 0
}

module.exports = mongoose.model("Document", DocumentSchema)
