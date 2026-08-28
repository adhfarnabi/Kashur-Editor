// routes/documents.js
// All document routes are protected by JWT (protect middleware in server.js)
// Every query is scoped to req.user._id — users only see their own documents

const express  = require("express")
const crypto   = require("crypto")
const router   = express.Router()
const Document = require("../models/Document")
const { logActivity } = require("../utils/activityLogger") // ADMIN PANEL ADDITION

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function decodeHtmlEntities(value) {
  return (value || "")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
}

function frontendBaseUrl() {
  return (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/+$/, "")
}

function shareUrlFor(token) {
  return token ? `${frontendBaseUrl()}/view/${token}` : null
}

function downloadHeaders(title, extension) {
  const cleanTitle = String(title || "Document")
    .replace(/[\r\n]/g, " ")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
    .trim()
    .slice(0, 180) || "Document"
  const asciiTitle = cleanTitle.replace(/[^\x20-\x7E]/g, "_")
  const filename = `${cleanTitle}.${extension}`
  return `attachment; filename="${asciiTitle}.${extension}"; filename*=UTF-8''${encodeURIComponent(filename)}`
}

function htmlToText(html) {
  return decodeHtmlEntities((html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/td>/gi, "\t")
    .replace(/<\/th>/gi, "\t")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim())
}

function stripTags(html) {
  return decodeHtmlEntities((html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, ""))
}

function splitIntoBlocks(html) {
  const results = []
  const re = /<(h[1-6]|p|div|blockquote|pre|ul|ol|table)(\s[^>]*)?>(\s*[\s\S]*?)<\/\1>|<hr\s*\/?>/gi
  let m
  while ((m = re.exec(html)) !== null) {
    if (m[0].startsWith("<hr")) {
      results.push({ tag: "hr", content: "" })
    } else {
      results.push({ tag: m[1], attrs: m[2] || "", content: m[3] || "" })
    }
  }
  if (results.length === 0 && html.trim()) {
    results.push({ tag: "p", attrs: "", content: html })
  }
  return results
}

function parseInlineRuns(html) {
  const runs = []
  const flat = html
    .replace(/<\/?(div|p|br|span)[^>]*>/gi, m => m.includes("br") ? "\n" : "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')

  const inlineRe = /<(strong|b|em|i|u|s|strike|span)([^>]*)>([\s\S]*?)<\/\1>|([^<]+)/gi
  let m
  while ((m = inlineRe.exec(flat)) !== null) {
    if (m[4] !== undefined) {
      const text = m[4].replace(/\s+/g, " ")
      if (text.trim()) runs.push({ text })
    } else if (m[1]) {
      const tag   = m[1].toLowerCase()
      const inner = stripTags(m[3]).replace(/&nbsp;/gi, " ")
      if (!inner.trim()) continue
      let color
      const sm = m[2].match(/color\s*:\s*([^;)"]+)/i)
      if (sm) color = sm[1].trim().replace(/^#/, "")
      runs.push({
        text:      inner,
        bold:      tag === "strong" || tag === "b",
        italic:    tag === "em"     || tag === "i",
        underline: tag === "u",
        color:     color || undefined,
      })
    }
  }
  if (runs.length === 0) {
    const t = stripTags(html).replace(/&nbsp;/gi, " ").trim()
    if (t) runs.push({ text: t })
  }
  return runs
}

function parseHtmlToBlocks(html) {
  const blocks = []
  const cleaned = (html || "")
    .replace(/<div[^>]*class="page-break-marker"[^>]*>[\s\S]*?<\/div>/gi, "")
    .replace(/<!-- PAGE_BREAK -->/gi, "")

  const segments = splitIntoBlocks(cleaned)
  for (const seg of segments) {
    const tag = seg.tag.toLowerCase()
    if (tag === "hr") {
      blocks.push({ type: "hr" })
    } else if (/^h[1-6]$/.test(tag)) {
      blocks.push({ type: "heading", level: parseInt(tag[1]), runs: parseInlineRuns(seg.content) })
    } else if (tag === "ul" || tag === "ol") {
      const items = []
      const liRe  = /<li[^>]*>([\s\S]*?)<\/li>/gi
      let li
      while ((li = liRe.exec(seg.content)) !== null) {
        const t = stripTags(li[1]).trim()
        if (t) items.push(t)
      }
      if (items.length > 0) blocks.push({ type: "list", ordered: tag === "ol", items })
    } else if (tag === "table") {
      const rows = []
      const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
      let tr
      while ((tr = trRe.exec(seg.content)) !== null) {
        const cells = []
        const tdRe  = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi
        let td
        while ((td = tdRe.exec(tr[1])) !== null) {
          cells.push(stripTags(td[1]).trim() || " ")
        }
        if (cells.length > 0) rows.push({ cells })
      }
      if (rows.length > 0) blocks.push({ type: "table", rows })
    } else if (tag === "blockquote") {
      blocks.push({ type: "blockquote", runs: parseInlineRuns(seg.content) })
    } else {
      const runs = parseInlineRuns(seg.content)
      const text = runs.map(r => r.text).join("").trim()
      if (text) blocks.push({ type: "paragraph", runs })
    }
  }
  return blocks
}

async function buildDocxBuffer(title, html) {
  try {
    const {
      Document: DocxDoc, Packer, Paragraph, TextRun, HeadingLevel,
      AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle,
      LevelFormat,
    } = require("docx")

    const blocks   = parseHtmlToBlocks(html || "")
    const children = []
    const exportFont = "Noto Nastaliq Urdu"

    for (const block of blocks) {
      if (block.type === "heading") {
        const lvlMap = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3]
        children.push(new Paragraph({
          heading:      lvlMap[block.level - 1] || HeadingLevel.HEADING_1,
          bidirectional: true,
          alignment:    AlignmentType.RIGHT,
          children:     (block.runs || []).map(r => new TextRun({
            text: r.text || "", bold: !!r.bold, italics: !!r.italic,
            underline: r.underline ? {} : undefined, font: exportFont, rtl: true,
          })),
        }))
      } else if (block.type === "table") {
        const rows = block.rows.map(row =>
          new TableRow({
            children: row.cells.map(cell =>
              new TableCell({
                width: { size: Math.floor(100 / row.cells.length), type: WidthType.PERCENTAGE },
                children: [new Paragraph({
                  bidirectional: true, alignment: AlignmentType.RIGHT,
                  children: [new TextRun({ text: cell, font: exportFont, rtl: true })],
                })],
                borders: {
                  top:    { style: BorderStyle.SINGLE, size: 1 },
                  bottom: { style: BorderStyle.SINGLE, size: 1 },
                  left:   { style: BorderStyle.SINGLE, size: 1 },
                  right:  { style: BorderStyle.SINGLE, size: 1 },
                },
              })
            ),
          })
        )
        if (rows.length > 0) {
          children.push(new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }))
          children.push(new Paragraph({ children: [] }))
        }
      } else if (block.type === "list") {
        block.items.forEach(item => {
          children.push(new Paragraph({
            bidirectional: true, alignment: AlignmentType.RIGHT,
            bullet: block.ordered ? undefined : { level: 0 },
            numbering: block.ordered ? { reference: "ordered-list", level: 0 } : undefined,
            children: [new TextRun({ text: item, font: exportFont, rtl: true })],
          }))
        })
      } else if (block.type === "hr") {
        children.push(new Paragraph({
          alignment: AlignmentType.CENTER,
          children:  [new TextRun({ text: "─".repeat(40) })],
        }))
      } else {
        const runs = (block.runs && block.runs.length > 0)
          ? block.runs
          : [{ text: block.text || "" }]
        children.push(new Paragraph({
          bidirectional: true,
          alignment:     AlignmentType.RIGHT,
          indent:        block.type === "blockquote" ? { right: 720 } : undefined,
          children:      runs.map(r => new TextRun({
            text:      r.text || "",
            bold:      !!r.bold,
            italics:   !!r.italic,
            underline: r.underline ? {} : undefined,
            color:     r.color || undefined,
            font:      exportFont,
            size:      block.type === "blockquote" ? 22 : 24,
            rtl:       true,
          })),
        }))
      }
    }

    if (children.length === 0) children.push(new Paragraph({ children: [new TextRun({ text: "" })] }))

    const doc = new DocxDoc({
      title,
      numbering: {
        config: [{
          reference: "ordered-list",
          levels: [{
            level: 0,
            format: LevelFormat.DECIMAL,
            text: "%1.",
            alignment: AlignmentType.RIGHT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } },
          }],
        }],
      },
      sections: [{
        properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
        children,
      }],
    })
    return await Packer.toBuffer(doc)
  } catch (e) {
    console.error("DOCX build error:", e.message)
    return null
  }
}

// ─── ROUTES ──────────────────────────────────────────────────────────────────
// All routes receive req.user from the protect middleware in server.js
// Every query uses userId: req.user._id → complete per-user isolation

router.get("/", async (req, res) => {
  try {
    // ADMIN PANEL ADDITION — archived docs stay in the database (recoverable
    // from the admin panel) but are hidden from the user's own list, same as
    // deletedAt already was.
    const filter = { deletedAt: null, archivedAt: null, userId: req.user._id }
    const docs = await Document.find(filter)
      .select("title wordCount pageCount createdAt updatedAt isPublic shareToken") // add these
      .sort({ updatedAt: -1 })
      .lean()

    res.json(docs.map(d => ({
      id: d._id,
      title: d.title,
      wordCount: d.wordCount,
      pageCount: d.pageCount,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      isPublic: d.isPublic,
      shareToken: d.shareToken,
      shareUrl: shareUrlFor(d.shareToken),
    })))
  } catch (e) { 
    res.status(500).json({ error: e.message }) 
  }
})

// GET /:id — get one (must belong to this user)
router.get("/:id", async (req, res) => {
  try {
    const doc = await Document.findOne({
      _id: req.params.id, userId: req.user._id, deletedAt: null, archivedAt: null,
    })
    if (!doc) return res.status(404).json({ error: "Document not found" })
    res.json({
      id: doc._id, title: doc.title, html: doc.html,
      wordCount: doc.wordCount, pageCount: doc.pageCount,
      createdAt: doc.createdAt, updatedAt: doc.updatedAt,
    })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// POST / — create document for this user
router.post("/", async (req, res) => {
  try {
    const { title = "Document 1", html = "", pageCount = 1 } = req.body

    // Title must be unique per user (not globally)
    const exists = await Document.findOne({
      title:    { $regex: `^${title.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
      userId:   req.user._id,
      deletedAt: null,
    })
    if (exists) return res.status(409).json({
      error: `You already have a document named "${title.trim()}". Please choose a different name.`,
      code:  "DUPLICATE_TITLE",
    })

    const doc = await Document.create({
      title:     title.trim(),
      html,
      wordCount: Document.countWords(html),
      pageCount,
      userId:    req.user._id,  // always set to logged-in user
    })

    // ADMIN PANEL ADDITION — log for Activity Logs section
    await logActivity({
      action: "document.created", actorType: "user", actor: req.user,
      targetType: "Document", targetId: doc._id, targetLabel: doc.title, req,
    })

    res.status(201).json({
      id: doc._id, title: doc.title, wordCount: doc.wordCount,
      pageCount: doc.pageCount, createdAt: doc.createdAt, updatedAt: doc.updatedAt,
    })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// PUT /:id — update (must belong to this user)
router.put("/:id", async (req, res) => {
  try {
    const { title, html, pageCount } = req.body

    // If renaming, check uniqueness within this user's documents
    if (title !== undefined) {
      const exists = await Document.findOne({
        title:    { $regex: `^${title.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
        userId:   req.user._id,
        _id:      { $ne: req.params.id },
        deletedAt: null,
      })
      if (exists) return res.status(409).json({
        error: `You already have a document named "${title.trim()}".`,
        code:  "DUPLICATE_TITLE",
      })
    }

    const updates = {}
    if (title     !== undefined) updates.title     = title.trim()
    if (html      !== undefined) { updates.html = html; updates.wordCount = Document.countWords(html) }
    if (pageCount !== undefined) updates.pageCount = pageCount

    const doc = await Document.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id, deletedAt: null, archivedAt: null },
      { $set: updates },
      { returnDocument: 'after' }
    )
    if (!doc) return res.status(404).json({ error: "Document not found" })

    // ADMIN PANEL ADDITION
    await logActivity({
      action: "document.updated", actorType: "user", actor: req.user,
      targetType: "Document", targetId: doc._id, targetLabel: doc.title, req,
    })

    res.json({ id: doc._id, title: doc.title, wordCount: doc.wordCount, updatedAt: doc.updatedAt })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// DELETE /:id — soft delete (must belong to this user)
router.delete("/:id", async (req, res) => {
  try {
    const doc = await Document.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id, deletedAt: null, archivedAt: null },
      { $set: { deletedAt: new Date() } },
      { returnDocument: 'after' }
    )
    if (!doc) return res.status(404).json({ error: "Document not found" })

    // ADMIN PANEL ADDITION
    await logActivity({
      action: "document.deleted", actorType: "user", actor: req.user,
      targetType: "Document", targetId: doc._id, targetLabel: doc.title, req,
    })

    res.json({ deleted: true, id: doc._id })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// POST /:id/autosave — lightweight autosave
router.post("/:id/autosave", async (req, res) => {
  try {
    const { html, title, pageCount } = req.body
    const updates = { html: html || "" }
    if (title)     updates.title     = title
    if (pageCount) updates.pageCount = pageCount
    updates.wordCount = Document.countWords(html)
    await Document.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id, deletedAt: null, archivedAt: null },
      { $set: updates }
    )
    res.json({ saved: true, updatedAt: new Date() })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// GET /:id/export/txt
router.get("/:id/export/txt", async (req, res) => {
  try {
    const doc = await Document.findOne({
      _id: req.params.id, userId: req.user._id, deletedAt: null, archivedAt: null,
    })
    if (!doc) return res.status(404).json({ error: "Document not found" })
    res.setHeader("Content-Type", "text/plain; charset=utf-8")
    res.setHeader("Content-Disposition", downloadHeaders(doc.title, "txt"))
    res.send(`\uFEFF${htmlToText(doc.html)}`)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// GET /:id/export/docx — requires: npm install docx
router.get("/:id/export/docx", async (req, res) => {
  try {
    const doc = await Document.findOne({
      _id: req.params.id, userId: req.user._id, deletedAt: null, archivedAt: null,
    })
    if (!doc) return res.status(404).json({ error: "Document not found" })

    try { require("docx") } catch (_) {
      return res.status(501).json({
        error:   "DOCX export requires the 'docx' package",
        install: "Run: npm install docx  then restart the server",
      })
    }

    const buf = await buildDocxBuffer(doc.title, doc.html)
    if (!buf) return res.status(500).json({ error: "Failed to generate DOCX" })

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    res.setHeader("Content-Disposition", downloadHeaders(doc.title, "docx"))
    res.setHeader("Content-Length", buf.length)
    res.send(buf)
  } catch (e) {
    console.error("DOCX export:", e)
    res.status(500).json({ error: e.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
//  PATCH /:id/share  — toggle public/private, generate/remove shareToken
//  Body: { isPublic: true | false }
//  Returns: { isPublic, shareToken, shareUrl }
// ─────────────────────────────────────────────────────────────────────────────
router.patch("/:id/share", async (req, res) => {
  try {
    const { isPublic } = req.body
    if (typeof isPublic !== "boolean") {
      return res.status(422).json({ error: "isPublic (boolean) is required" })
    }

    // ADMIN PANEL ADDITION — respect the "Allow public document sharing" toggle.
    // Turning a document private is always allowed even if sharing is disabled.
    if (isPublic) {
      const EditorSettings = require("../models/EditorSettings")
      const settings = await EditorSettings.getSingleton()
      if (settings.allowPublicSharing === false) {
        return res.status(403).json({ error: "Public sharing is currently disabled by the administrator." })
      }
    }

    const doc = await Document.findOne({
      _id: req.params.id, userId: req.user._id, deletedAt: null, archivedAt: null,
    })
    if (!doc) return res.status(404).json({ error: "Document not found" })

    if (isPublic) {
      // Generate a new share token if one doesn't exist
      if (!doc.shareToken) {
        // crypto-random 32-byte hex string — unguessable
        doc.shareToken = crypto.randomBytes(32).toString("hex")
      }
      doc.isPublic = true
    } else {
      // Private — revoke the token entirely so old links stop working
      doc.shareToken = null
      doc.isPublic   = false
    }

    await doc.save()

    await logActivity({
      action: isPublic ? "document.shared" : "document.unshared",
      actorType: "user",
      actor: req.user,
      targetType: "Document",
      targetId: doc._id,
      targetLabel: doc.title,
      req,
    })

    res.json({
      id:         doc._id,
      isPublic:   doc.isPublic,
      shareToken: doc.shareToken,
      shareUrl:   shareUrlFor(doc.shareToken),
    })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
module.exports.__test = {
  buildDocxBuffer,
  decodeHtmlEntities,
  downloadHeaders,
  htmlToText,
  parseHtmlToBlocks,
  shareUrlFor,
}
