// models/Shape.js
// Custom shapes available in the editor's Insert → Shapes menu, on top of
// the built-in 25+ shape types. Stored as raw SVG markup so the editor can
// drop them straight onto the page.
const mongoose = require("mongoose")

const ShapeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    category: { type: String, default: "Custom", trim: true },
    svgMarkup: { type: String, required: true }, // full <svg>...</svg> string
    active: { type: Boolean, default: true, index: true },
    sortOrder: { type: Number, default: 0 },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
  },
  { timestamps: true }
)

module.exports = mongoose.model("Shape", ShapeSchema)
