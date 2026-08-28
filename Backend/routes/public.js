// routes/public.js
// These are consumed by KashurEditor.jsx directly (not the admin panel) —
// no admin JWT required, just active/published items.
const express  = require("express")
const router   = express.Router()
const Font     = require("../models/Font")
const Template = require("../models/Template")
const Shape    = require("../models/Shape")
const DictionaryEntry = require("../models/DictionaryEntry")

router.get("/fonts", async (req, res) => {
  try {
    const fonts = await Font.find({ active: true }).sort({ sortOrder: 1, name: 1 })
      .select("name family script url fileFormat isDefault").lean()
    res.json({ fonts })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.get("/templates", async (req, res) => {
  try {
    const { category } = req.query
    const filter = { active: true }
    if (category) filter.category = category
    const templates = await Template.find(filter).sort({ createdAt: -1 })
      .select("title category description thumbnailUrl html").lean()
    res.json({ templates })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.get("/shapes", async (req, res) => {
  try {
    const shapes = await Shape.find({ active: true }).sort({ sortOrder: 1, name: 1 })
      .select("name category svgMarkup").lean()
    res.json({ shapes })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.get("/dictionary", async (req, res) => {
  try {
    const entries = await DictionaryEntry.find({ active: true })
      .select("englishWord word transliteration meaningEnglish meaningUrdu exampleEnglish exampleKashmiri partOfSpeech").lean()
    res.json({ entries })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
