/**
 * PublicView.jsx
 *
 * Read-only PDF viewer for shared documents.
 * Accessible via: /view/:shareToken
 * NO login required.
 *
 * Features:
 *  - Loads document HTML from /api/share/:token
 *  - Renders it in a clean A4-like reading layout
 *  - "Print / Save as PDF" button
 *  - Share buttons: WhatsApp, copy link, email
 *  - Shows "document not found" if token is invalid or revoked
 *
 * Usage in App.jsx:
 *   import PublicView from "./PublicView"
 *   // In your router, check if URL starts with /view/ and render PublicView
 *   // Pass the token as a prop: <PublicView token="abc123..." />
 */

import { useState, useEffect } from "react"

const API_BASE = "http://localhost:3001/api"

// ─── PALETTE ─────────────────────────────────────────────────────────────────
const BLUE   = "#2b579a"
const GRAY   = "#6b7280"
const BORDER = "#e5e7eb"
const WHITE  = "#ffffff"

// ─── PRINT FUNCTION ──────────────────────────────────────────────────────────
function printDoc(title, html) {
  const printHTML = `<!DOCTYPE html>
<html dir="rtl" lang="ur"><head>
<meta charset="utf-8">
<title>${title || "Document"}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; }
  @page { size: 210mm 297mm; margin: 20mm; }
  body { font-size: 12pt; line-height: 1.8; direction: rtl; text-align: right; color: #000; background: #fff; margin: 0; padding: 0; }
  img  { max-width: 100%; height: auto; }
  table { border-collapse: collapse; width: 100%; direction: rtl; }
  td, th { border: 1px solid #aaa; padding: 6px 8px; }
  h1 { font-size: 22pt; } h2 { font-size: 18pt; } h3 { font-size: 14pt; }
  ul, ol { padding-right: 24px; direction: rtl; }
  .page-break-marker { page-break-after: always; break-after: page; height: 0; border: none !important; }
  .page-break-marker span, .img-resize-handle { display: none !important; }
  #pbar { display: none !important; }
</style>
</head><body>
<div id="pbar" style="position:fixed;bottom:0;left:0;right:0;background:#2b579a;color:#fff;padding:10px 24px;display:flex;align-items:center;justify-content:space-between;font-family:sans-serif;font-size:14px;z-index:9999;">
  <span>📄 ${title}</span>
  <button onclick="window.print()" style="background:#fff;color:#2b579a;border:none;padding:7px 20px;border-radius:6px;font-weight:600;cursor:pointer;">🖨 Print / Save as PDF</button>
</div>
<div style="padding-bottom:60px;">${html}</div>
</body></html>`

  const blob = new Blob([printHTML], { type: "text/html;charset=utf-8" })
  const url  = URL.createObjectURL(blob)
  const win  = window.open(url, "_blank")
  if (!win) {
    const a = document.createElement("a"); a.href=url; a.target="_blank"; a.rel="noopener"
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
  }
  setTimeout(() => URL.revokeObjectURL(url), 30000)
}

// ─── SHARE BUTTONS ───────────────────────────────────────────────────────────
function ShareBar({ title, url }) {
  const [copied, setCopied] = useState(false)
  const text = `📄 ${title} — ${url}`

  function copyLink() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  const whatsapp = `https://wa.me/?text=${encodeURIComponent(text)}`
  const emailHref = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(text)}`
  const telegram  = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`
  const twitter   = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`

  const btnStyle = {
    display:       "inline-flex",
    alignItems:    "center",
    gap:           6,
    padding:       "8px 16px",
    borderRadius:  8,
    border:        `1px solid ${BORDER}`,
    background:    WHITE,
    color:         "#374151",
    fontSize:      13,
    fontWeight:    500,
    cursor:        "pointer",
    textDecoration:"none",
    fontFamily:    "inherit",
  }

  return (
    <div style={{
      background: WHITE,
      border:    `1px solid ${BORDER}`,
      borderRadius: 12,
      padding:   "16px 20px",
      marginBottom: 20,
    }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 12 }}>
        📤 Share this document
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>

        {/* Copy link */}
        <button onClick={copyLink} style={{ ...btnStyle, background: copied ? "#e8f5ee" : WHITE, color: copied ? "#1a7f4e" : "#374151" }}>
          {copied ? "✅ Copied!" : "🔗 Copy Link"}
        </button>

        {/* WhatsApp */}
        <a href={whatsapp} target="_blank" rel="noopener noreferrer"
          style={{ ...btnStyle, background: "#e8f5e9", color: "#1a7f4e", border: "1px solid #c8e6c9" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#25D366">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
            <path d="M12 0C5.373 0 0 5.373 0 12c0 2.122.554 4.118 1.523 5.857L.057 23.987l6.305-1.495A11.944 11.944 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.006-1.374l-.36-.213-3.737.885.939-3.638-.234-.374A9.818 9.818 0 1112 21.818z"/>
          </svg>
          WhatsApp
        </a>

        {/* Telegram */}
        <a href={telegram} target="_blank" rel="noopener noreferrer"
          style={{ ...btnStyle, background: "#e3f2fd", color: "#0277bd", border: "1px solid #bbdefb" }}>
          ✈️ Telegram
        </a>

        {/* Email */}
        <a href={emailHref}
          style={{ ...btnStyle, background: "#fff3e0", color: "#e65100", border: "1px solid #ffe0b2" }}>
          📧 Email
        </a>

        {/* Twitter / X */}
        <a href={twitter} target="_blank" rel="noopener noreferrer"
          style={{ ...btnStyle, background: "#e8f5fd", color: "#1da1f2", border: "1px solid #b3e5fc" }}>
          🐦 Twitter
        </a>

      </div>

      {/* URL display */}
      <div style={{
        marginTop: 12,
        padding: "8px 12px",
        background: "#f9fafb",
        borderRadius: 6,
        border: `1px solid ${BORDER}`,
        fontSize: 12,
        color: GRAY,
        wordBreak: "break-all",
        fontFamily: "monospace",
      }}>
        {url}
      </div>
    </div>
  )
}

// ─── LOADING SKELETON ────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "40px 20px" }}>
      {[100, 70, 90, 60, 85, 75].map((w, i) => (
        <div key={i} style={{
          height: i === 0 ? 28 : 16,
          width: `${w}%`,
          background: "#e5e7eb",
          borderRadius: 4,
          marginBottom: i === 0 ? 24 : 12,
          animation: "pulse 1.5s ease-in-out infinite",
        }}/>
      ))}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function PublicView({ token }) {
  const [doc,     setDoc]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  // The public share URL for this document (what gets shared)
  const shareUrl = window.location.href

  useEffect(() => {
    if (!token) { setError("Invalid share link."); setLoading(false); return }

    fetch(`${API_BASE}/share/${token}`)
      .then(async r => {
        if (!r.ok) {
          const e = await r.json().catch(() => ({}))
          throw new Error(e.error || "Document not found")
        }
        return r.json()
      })
      .then(data => { setDoc(data); setLoading(false) })
      .catch(e   => { setError(e.message); setLoading(false) })
  }, [token])

  // ── LOADING ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#f0f4f8", fontFamily: "Segoe UI, system-ui, sans-serif" }}>
        {/* Header skeleton */}
        <div style={{ background: BLUE, height: 56 }}/>
        <LoadingSkeleton/>
      </div>
    )
  }

  // ── ERROR ─────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div style={{ minHeight: "100vh", background: "#f0f4f8", fontFamily: "Segoe UI, system-ui, sans-serif", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ background: WHITE, borderRadius: 16, padding: "48px 40px", maxWidth: 400, textAlign: "center", boxShadow: "0 4px 24px rgba(0,0,0,.1)" }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>🔒</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "#1f2937", marginBottom: 8 }}>
            Document Not Available
          </h2>
          <p style={{ fontSize: 14, color: GRAY, lineHeight: 1.6, marginBottom: 0 }}>
            {error}
            <br/><br/>
            This document may have been made private or the link may be incorrect.
          </p>
        </div>
      </div>
    )
  }

  // ── DOCUMENT VIEW ─────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#f0f4f8", fontFamily: "Segoe UI, system-ui, sans-serif" }}>

      {/* ── TOP BAR ── */}
      <div style={{
        background: BLUE,
        color: WHITE,
        padding: "0 24px",
        height: 56,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        boxShadow: "0 2px 8px rgba(0,0,0,.15)",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <rect x="1" y="1" width="18" height="18" rx="3" fill="rgba(255,255,255,.2)"/>
            <path d="M5 7h10M5 10h10M5 13h6" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <span style={{ fontWeight: 600, fontSize: 15 }}>{doc.title}</span>
          <span style={{
            fontSize: 11,
            background: "rgba(255,255,255,.2)",
            padding: "2px 8px",
            borderRadius: 20,
            marginLeft: 4,
          }}>
            View Only
          </span>
        </div>

        <button
          onClick={() => printDoc(doc.title, doc.html)}
          style={{
            background: "rgba(255,255,255,.15)",
            border: "1px solid rgba(255,255,255,.3)",
            color: WHITE,
            padding: "6px 16px",
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
          }}>
          🖨 Print / Save as PDF
        </button>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 20px 60px" }}>

        {/* Share bar */}
        <ShareBar title={doc.title} url={shareUrl}/>

        {/* A4 document card */}
        <div style={{
          background: WHITE,
          borderRadius: 4,
          boxShadow: "0 2px 8px rgba(0,0,0,.15), 0 8px 32px rgba(0,0,0,.1)",
          padding: "72px 80px",
          minHeight: 800,
          direction: "rtl",
          textAlign: "right",
          fontSize: 16,
          lineHeight: 1.8,
          color: "#000",
          fontFamily: "Noto Nastaliq Urdu, Noto Naskh Arabic, Arial, serif",
          wordSpacing: 2,
        }}
          dangerouslySetInnerHTML={{ __html: doc.html }}
        />

        {/* Bottom share bar */}
        <div style={{ marginTop: 24 }}>
          <ShareBar title={doc.title} url={shareUrl}/>
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", fontSize: 12, color: GRAY, marginTop: 16 }}>
          Shared via <strong style={{ color: BLUE }}>کٲشُر ورڈ ایڈیٹر</strong>
          {" · "}This is a read-only view
        </div>
      </div>
    </div>
  )
}