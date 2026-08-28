// routes/admin/feedback.js
const express  = require("express")
const router   = express.Router()
const Feedback = require("../../models/Feedback")
const { sendEmail } = require("../../utils/email")

router.get("/", async (req, res) => {
  try {
    const { status = "all", page = 1, limit = 20 } = req.query
    const filter = status !== "all" ? { status } : {}
    const pageNum  = Math.max(1, parseInt(page))
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)))

    const [items, total, newCount] = await Promise.all([
      Feedback.find(filter).sort({ createdAt: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum).lean(),
      Feedback.countDocuments(filter),
      Feedback.countDocuments({ status: "new" }),
    ])
    res.json({ items, total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum), newCount })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.patch("/:id/status", async (req, res) => {
  try {
    const { status } = req.body
    if (!["new", "read", "replied", "archived"].includes(status)) {
      return res.status(422).json({ error: "Invalid status" })
    }
    const item = await Feedback.findByIdAndUpdate(req.params.id, { $set: { status } }, { new: true })
    if (!item) return res.status(404).json({ error: "Not found" })
    res.json({ item })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// POST /api/admin/feedback/:id/reply — sends a real email to the user and
// marks the message as replied
router.post("/:id/reply", async (req, res) => {
  try {
    const { message } = req.body
    if (!message || !message.trim()) return res.status(422).json({ error: "Reply message is required" })

    const item = await Feedback.findById(req.params.id)
    if (!item) return res.status(404).json({ error: "Not found" })

    await sendEmail({
      to: item.fromEmail,
      subject: `Re: ${item.subject}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <p>Hi ${item.fromName || "there"},</p>
          <p>${message.replace(/\n/g, "<br/>")}</p>
          <hr style="border:none;border-top:1px solid #eee;margin:20px 0"/>
          <p style="color:#888;font-size:12px">Your original message: "${item.subject}"</p>
        </div>`,
      replyTo: req.admin.email,
    })

    item.status = "replied"
    await item.save()

    res.json({ message: "Reply sent.", item })
  } catch (e) {
    console.error("Feedback reply error:", e)
    res.status(500).json({ error: "Could not send reply. " + e.message })
  }
})

router.delete("/:id", async (req, res) => {
  try {
    const item = await Feedback.findByIdAndDelete(req.params.id)
    if (!item) return res.status(404).json({ error: "Not found" })
    res.json({ deleted: true, id: req.params.id })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
