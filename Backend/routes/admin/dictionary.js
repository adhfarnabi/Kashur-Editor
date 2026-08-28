// routes/admin/dictionary.js
const express = require("express")
const router  = express.Router()
const DictionaryEntry = require("../../models/DictionaryEntry")
const { logActivity } = require("../../utils/activityLogger")

// GET /api/admin/dictionary?search=&page=&limit=
router.get("/", async (req, res) => {
  try {
    const { search = "", page = 1, limit = 30 } = req.query
    const filter = {}
    if (search.trim()) {
      filter.$or = [
        { englishWord: { $regex: search.trim(), $options: "i" } },
        { word: { $regex: search.trim(), $options: "i" } },
        { transliteration: { $regex: search.trim(), $options: "i" } },
        { meaningEnglish: { $regex: search.trim(), $options: "i" } },
      ]
    }
    const pageNum  = Math.max(1, parseInt(page))
    const limitNum = Math.min(200, Math.max(1, parseInt(limit)))

    const [entries, total] = await Promise.all([
      DictionaryEntry.find(filter).sort({ englishWord: 1 }).skip((pageNum - 1) * limitNum).limit(limitNum).lean(),
      DictionaryEntry.countDocuments(filter),
    ])
    res.json({ entries, total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.post("/", async (req, res) => {
  try {
    const { englishWord, word, transliteration, meaningEnglish, meaningUrdu, exampleEnglish, exampleKashmiri, partOfSpeech, category } = req.body
    if (!englishWord) return res.status(422).json({ error: "englishWord (the English headword) is required" })
    if (!word) return res.status(422).json({ error: "word (Kashmiri script meaning) is required" })

    const entry = await DictionaryEntry.create({
      englishWord, word, transliteration, meaningEnglish, meaningUrdu, exampleEnglish, exampleKashmiri, partOfSpeech, category,
      addedBy: req.admin._id,
    })
    await logActivity({ action: "dictionary.created", actorType: "admin", actor: req.admin, targetType: "DictionaryEntry", targetId: entry._id, targetLabel: entry.englishWord, req })
    res.status(201).json({ entry })
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: "This word already exists in the dictionary." })
    res.status(500).json({ error: e.message })
  }
})

// POST /api/admin/dictionary/bulk — array of entries, e.g. from a CSV paste
router.post("/bulk", async (req, res) => {
  try {
    const { entries } = req.body
    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(422).json({ error: "entries (array) is required" })
    }
    const docs = entries
      .filter(e => e.englishWord && e.englishWord.trim() && e.word && e.word.trim())
      .map(e => ({ ...e, addedBy: req.admin._id }))

    const result = await DictionaryEntry.insertMany(docs, { ordered: false }).catch(err => err)
    const insertedCount = result.insertedCount ?? (Array.isArray(result) ? result.length : 0)

    await logActivity({ action: "dictionary.created", actorType: "admin", actor: req.admin, meta: { bulk: true, count: insertedCount }, req })
    res.status(201).json({ message: `${insertedCount} entries added (duplicates skipped).` })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.put("/:id", async (req, res) => {
  try {
    const { englishWord, word, transliteration, meaningEnglish, meaningUrdu, exampleEnglish, exampleKashmiri, partOfSpeech, category, active } = req.body
    const entry = await DictionaryEntry.findByIdAndUpdate(
      req.params.id,
      { $set: { englishWord, word, transliteration, meaningEnglish, meaningUrdu, exampleEnglish, exampleKashmiri, partOfSpeech, category, active } },
      { new: true, omitUndefined: true }
    )
    if (!entry) return res.status(404).json({ error: "Entry not found" })
    await logActivity({ action: "dictionary.updated", actorType: "admin", actor: req.admin, targetType: "DictionaryEntry", targetId: entry._id, targetLabel: entry.englishWord, req })
    res.json({ entry })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.delete("/:id", async (req, res) => {
  try {
    const entry = await DictionaryEntry.findByIdAndDelete(req.params.id)
    if (!entry) return res.status(404).json({ error: "Entry not found" })
    await logActivity({ action: "dictionary.deleted", actorType: "admin", actor: req.admin, targetType: "DictionaryEntry", targetId: entry._id, targetLabel: entry.englishWord, req })
    res.json({ deleted: true, id: req.params.id })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
