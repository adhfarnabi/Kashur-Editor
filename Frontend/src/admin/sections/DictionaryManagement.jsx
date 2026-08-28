// src/admin/sections/DictionaryManagement.jsx
import { useEffect, useState } from "react"
import { adminApi } from "../adminApi"
import { Card, Button, Input, Select, Textarea, Spinner, EmptyState, Pagination, Modal, ConfirmDialog } from "../components/ui"

// Field names mirror the built-in dictionary's structure exactly (see
// Backend/models/DictionaryEntry.js for the mapping) so entries display
// identically once merged into the real Dictionary panel on the site.
const EMPTY = {
  englishWord: "", word: "", transliteration: "", meaningEnglish: "",
  meaningUrdu: "", exampleEnglish: "", exampleKashmiri: "", partOfSpeech: "other", category: "general",
}

export default function DictionaryManagement() {
  const [rows, setRows] = useState(null)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [meta, setMeta] = useState({ pages: 1 })
  const [editing, setEditing] = useState(null)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [error, setError] = useState("")

  function load() {
    const params = new URLSearchParams({ search, page })
    adminApi.dictionary(`?${params}`).then(d => { setRows(d.entries); setMeta(d) }).catch(e => setError(e.message))
  }
  useEffect(() => { load() }, [search, page])

  async function save(form) {
    if (form._id) await adminApi.updateDictionaryEntry(form._id, form)
    else await adminApi.createDictionaryEntry(form)
    setEditing(null)
    load()
  }
  async function doDelete() {
    await adminApi.deleteDictionaryEntry(confirmDelete._id)
    setConfirmDelete(null)
    load()
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-col sm:flex-row gap-3 sm:justify-between">
          <Input placeholder="Search words…" value={search} onChange={e => { setPage(1); setSearch(e.target.value) }} className="sm:max-w-xs" />
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setBulkOpen(true)}>Bulk Import</Button>
            <Button size="sm" onClick={() => setEditing({ ...EMPTY })}>+ Add Word</Button>
          </div>
        </div>
      </Card>

      <Card title={`Dictionary entries (${meta.total ?? "…"} total)`}>
        {error && <p className="text-rose-500 text-sm mb-3">{error}</p>}
        {!rows ? <Spinner /> : rows.length === 0 ? (
          <EmptyState icon="📖" title="No dictionary entries yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 uppercase tracking-wide border-b border-slate-100 dark:border-slate-700">
                  <th className="pb-2 font-medium">English Word</th>
                  <th className="pb-2 font-medium">Kashmiri Meaning</th>
                  <th className="pb-2 font-medium">Transliteration</th>
                  <th className="pb-2 font-medium">Type</th>
                  <th className="pb-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {rows.map(e => (
                  <tr key={e._id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors duration-150">
                    <td className="py-2.5 font-medium text-slate-700 dark:text-slate-200">{e.englishWord}</td>
                    <td className="py-2.5 text-slate-500 dark:text-slate-400" dir="rtl">{e.word}</td>
                    <td className="py-2.5 text-slate-500 dark:text-slate-400">{e.transliteration}</td>
                    <td className="py-2.5 text-slate-400">{e.partOfSpeech}</td>
                    <td className="py-2.5 text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" variant="secondary" onClick={() => setEditing(e)}>Edit</Button>
                        <Button size="sm" variant="danger" onClick={() => setConfirmDelete(e)}>Delete</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={meta.page || 1} pages={meta.pages || 1} onChange={setPage} />
      </Card>

      {editing && <WordForm entry={editing} onSave={save} onClose={() => setEditing(null)} />}
      {bulkOpen && <BulkImport onDone={() => { setBulkOpen(false); load() }} onClose={() => setBulkOpen(false)} />}
      {confirmDelete && (
        <ConfirmDialog title="Delete word?" message={`Remove "${confirmDelete.englishWord}" from the dictionary?`}
          confirmLabel="Delete" danger onConfirm={doDelete} onCancel={() => setConfirmDelete(null)} />
      )}
    </div>
  )
}

function WordForm({ entry, onSave, onClose }) {
  const [form, setForm] = useState({ ...EMPTY, ...entry })
  const [error, setError] = useState("")
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  function submit() {
    if (!form.englishWord.trim()) return setError("English Word is required — this is what users search by")
    if (!form.word.trim()) return setError("Kashmiri Meaning is required")
    onSave(form)
  }

  return (
    <Modal title={entry._id ? "Edit Word" : "Add Word"} onClose={onClose} wide>
      <div className="space-y-3">
        {error && <p className="text-rose-500 text-sm">{error}</p>}
        <p className="text-xs text-slate-400">
          This mirrors the built-in dictionary's structure: an English headword users search by, with its Kashmiri meaning.
        </p>
        <Input label="English Word (headword — what users search by)" value={form.englishWord} onChange={e => set("englishWord", e.target.value)} placeholder="e.g. Abandoned" />
        <Input label="Kashmiri Meaning (script)" value={form.word} onChange={e => set("word", e.target.value)} dir="rtl" placeholder="e.g. ترٛومُت" />
        <Input label="Kashmiri Meaning (Roman transliteration)" value={form.transliteration} onChange={e => set("transliteration", e.target.value)} placeholder="e.g. Trovmut" />
        <Input label="Plain English Gloss (optional)" value={form.meaningEnglish} onChange={e => set("meaningEnglish", e.target.value)} placeholder="Optional extra English clarification" />
        <Select label="Part of Speech" value={form.partOfSpeech} onChange={e => set("partOfSpeech", e.target.value)}>
          {["noun","verb","adjective","adverb","pronoun","other"].map(p => <option key={p} value={p}>{p}</option>)}
        </Select>
        <Input label="Example Sentence (English)" value={form.exampleEnglish} onChange={e => set("exampleEnglish", e.target.value)} placeholder="An abandoned factory." />
        <Input label="Example Sentence (Kashmiri, Roman)" value={form.exampleKashmiri} onChange={e => set("exampleKashmiri", e.target.value)} placeholder="Akh traivmich factry." />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>Save</Button>
        </div>
      </div>
    </Modal>
  )
}

function BulkImport({ onDone, onClose }) {
  const [raw, setRaw] = useState("")
  const [error, setError] = useState("")
  async function submit() {
    try {
      const lines = raw.split("\n").map(l => l.trim()).filter(Boolean)
      const entries = lines.map(line => {
        const [englishWord, word = "", transliteration = ""] = line.split(",").map(s => s.trim())
        return { englishWord, word, transliteration }
      })
      await adminApi.bulkDictionary(entries)
      onDone()
    } catch (e) { setError(e.message) }
  }
  return (
    <Modal title="Bulk Import Dictionary" onClose={onClose} wide>
      <p className="text-xs text-slate-400 mb-2">One word per line: <code>English word, Kashmiri meaning (script), transliteration</code></p>
      {error && <p className="text-rose-500 text-sm mb-2">{error}</p>}
      <Textarea rows={8} value={raw} onChange={e => setRaw(e.target.value)}
        placeholder={"Abandoned, ترٛومُت, Trovmut\nWater, آب, Aab"} />
      <div className="flex justify-end gap-2 pt-3">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={submit}>Import</Button>
      </div>
    </Modal>
  )
}
