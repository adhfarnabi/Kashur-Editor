// models/DictionaryEntry.js
// Kashmiri dictionary / spell-check word list, editable from the admin panel.
// Field names deliberately mirror the built-in kashmiriData.js structure so
// entries look identical once merged into the real Dictionary panel:
//   englishWord      → kashmiriData's "title" (the English headword you search by)
//   pos              → kashmiriData's "pos" (pronunciation + part of speech, one string)
//   meaningEnglish    → kashmiriData's "englishMeaning" (Kashmiri meaning, Roman letters)
//   word (Kashmiri)  → kashmiriData's "kashmiriMeaning" (Kashmiri script)
//   exampleEnglish   → kashmiriData's "englishExample"
//   exampleKashmiri  → kashmiriData's "kashmiriExample"
const mongoose = require("mongoose")

const DictionaryEntrySchema = new mongoose.Schema(
  {
    englishWord: { type: String, required: true, trim: true, index: true }, // headword — what users search by
    word:        { type: String, required: true, trim: true },              // Kashmiri script meaning
    transliteration: { type: String, default: "", trim: true },              // Roman Kashmiri meaning
    meaningEnglish:  { type: String, default: "", trim: true },              // plain English gloss (optional, separate from pos)
    meaningUrdu:     { type: String, default: "", trim: true },
    exampleEnglish:  { type: String, default: "", trim: true },
    exampleKashmiri: { type: String, default: "", trim: true },
    partOfSpeech: {
      type: String,
      enum: ["noun", "verb", "adjective", "adverb", "pronoun", "other"],
      default: "other",
    },
    category: { type: String, default: "general", trim: true },
    active:   { type: Boolean, default: true, index: true },

    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
  },
  { timestamps: true }
)

DictionaryEntrySchema.index({ englishWord: { type: String, required: true, trim: true } }, { unique: true })

module.exports = mongoose.model("DictionaryEntry", DictionaryEntrySchema)
