const assert = require("node:assert/strict")
const test = require("node:test")

const documentRoutes = require("../routes/documents")
const Document = require("../models/Document")

const {
  buildDocxBuffer,
  downloadHeaders,
  htmlToText,
  parseHtmlToBlocks,
  shareUrlFor,
} = documentRoutes.__test

test("TXT conversion preserves Kashmiri Unicode, line breaks, and entities", () => {
  const text = htmlToText("<h1>کٲشُر</h1><p>زبان&nbsp;&amp;&nbsp;&#x6A9;تاب</p><ul><li>اکھ</li><li>زٕ</li></ul>")
  assert.match(text, /کٲشُر/)
  assert.match(text, /زبان & کتاب/)
  assert.match(text, /اکھ\nزٕ/)
})

test("HTML parser recognizes headings, ordered lists, tables, and paragraphs", () => {
  const blocks = parseHtmlToBlocks(
    "<h2>عنوان</h2><ol><li>اکھ</li><li>زٕ</li></ol><table><tr><td>الف</td><td>ب</td></tr></table><p>متن</p>"
  )
  assert.deepEqual(blocks.map(block => block.type), ["heading", "list", "table", "paragraph"])
  assert.equal(blocks[1].ordered, true)
  assert.deepEqual(blocks[1].items, ["اکھ", "زٕ"])
})

test("DOCX export creates a valid Office Open XML zip buffer", async () => {
  const buffer = await buildDocxBuffer(
    "کٲشُر دستاویز",
    "<h1>عنوان</h1><p><strong>کٲشُر</strong> متن</p><ol><li>اکھ</li><li>زٕ</li></ol>"
  )
  assert.ok(Buffer.isBuffer(buffer))
  assert.ok(buffer.length > 1000)
  assert.equal(buffer.subarray(0, 2).toString("ascii"), "PK")
})

test("download headers support Unicode names without permitting header injection", () => {
  const value = downloadHeaders('کٲشُر\r\n"report"', "docx")
  assert.match(value, /^attachment; filename=/)
  assert.match(value, /filename\*=UTF-8''/)
  assert.doesNotMatch(value, /[\r\n]/)
})

test("share URLs have one slash and document share tokens are unique", () => {
  const previous = process.env.FRONTEND_URL
  process.env.FRONTEND_URL = "https://editor.example/"
  assert.equal(shareUrlFor("abc123"), "https://editor.example/view/abc123")
  if (previous === undefined) delete process.env.FRONTEND_URL
  else process.env.FRONTEND_URL = previous

  const tokenIndex = Document.schema.indexes().find(([fields]) => fields.shareToken === 1)
  assert.ok(tokenIndex)
  assert.equal(tokenIndex[1].unique, true)
  assert.deepEqual(tokenIndex[1].partialFilterExpression, {
    shareToken: { $type: "string" },
  })
})

test("share and export endpoints are registered", () => {
  const registered = documentRoutes.stack.map(layer => {
    const methods = Object.keys(layer.route?.methods || {})
    return methods.map(method => `${method.toUpperCase()} ${layer.route.path}`)
  }).flat()

  assert.ok(registered.includes("PATCH /:id/share"))
  assert.ok(registered.includes("GET /:id/export/txt"))
  assert.ok(registered.includes("GET /:id/export/docx"))
})
