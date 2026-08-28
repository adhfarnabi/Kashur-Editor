// utils/email.js
const nodemailer = require("nodemailer")

// SMTP transporter.
// Port 587 = STARTTLS (secure:false)
// Port 465 = SSL      (secure:true)
// If BOTH ports are blocked on your network → use Ethereal dev account (see below)
function createTransporter() {
  if (process.env.MAIL_USER && process.env.MAIL_PASS) {
    const port = parseInt(process.env.MAIL_PORT || "587")
    const secure = port === 465  // 465 = SSL, 587 = STARTTLS

    return nodemailer.createTransport({
      host: process.env.MAIL_HOST || "smtp.gmail.com",
      port,
      secure,
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
      tls: {
        rejectUnauthorized: false,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    })
  }
  // Dev fallback — OTP and contact messages print to console
  console.warn("⚠️  MAIL_USER/MAIL_PASS not set. Printing emails to console (dev mode).")
  return null
}

// ─── SEND FUNCTION ────────────────────────────────────────────────────────────
async function sendEmail({ to, subject, html, text, replyTo }) {
  const transporter = createTransporter()

  if (!transporter) {
    console.log("\n📧  EMAIL (dev mode — not actually sent)")
    console.log(`   To:      ${to}`)
    if (replyTo) console.log(`   ReplyTo: ${replyTo}`)
    console.log(`   Subject: ${subject}`)
    console.log(`   Body:    ${text || html.replace(/<[^>]+>/g, " ").trim().slice(0, 200)}`)
    console.log("")
    return { messageId: "dev-console", preview: null }
  }

  const mailOpts = {
    from: `"${process.env.MAIL_FROM_NAME || "Kashur Editor"}" <${process.env.MAIL_USER}>`,
    to, subject, html,
    text: text || html.replace(/<[^>]+>/g, " "),
  }
  if (replyTo) mailOpts.replyTo = replyTo

  const result = await transporter.sendMail(mailOpts)
  return result
}

// ─── EMAIL TEMPLATES ─────────────────────────────────────────────────────────

function otpVerifyEmail(name, otp) {
  return {
    subject: "Kashur Editor — Verify Your Email | ای میل تصدیق",
    html: `<!DOCTYPE html>
<html dir="rtl" lang="ks">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family:Arial,sans-serif;background:#f0f4f8;margin:0;padding:0;">
<div style="max-width:520px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.1);">
  <div style="background:#2b579a;padding:28px 32px;text-align:center;">
    <h1 style="color:#fff;margin:0;font-size:22px;">کٲشُر ایڈیٹر</h1>
    <p style="color:rgba(255,255,255,.8);margin:6px 0 0;font-size:13px;">Kashur Editor</p>
  </div>
  <div style="padding:32px;direction:rtl;text-align:right;">
    <p style="font-size:16px;color:#1f2937;margin:0 0 16px;">السلام علیکم ${name},</p>
    <p style="font-size:14px;color:#4b5563;line-height:1.7;margin:0 0 24px;">
      پنُن ای میل تصدیق کرنہ خٲطرٕ یہِ نِچُہ دِتھ OTP کوڈ استعمال کٔریو:
    </p>
    <div style="background:#f0f4f8;border:2px dashed #2b579a;border-radius:10px;padding:24px;text-align:center;margin:0 0 24px;">
      <p style="font-size:13px;color:#6b7280;margin:0 0 8px;">تُہُند OTP کوڈ</p>
      <div style="font-size:42px;font-weight:700;letter-spacing:12px;color:#2b579a;font-family:monospace;">${otp}</div>
      <p style="font-size:12px;color:#9ca3af;margin:8px 0 0;">یہِ کوڈ <strong>10 مِنَٹ</strong> منز ختم گژھِ</p>
    </div>
    <p style="font-size:13px;color:#6b7280;">اگر تُہۍ یہِ اکاؤنٹ نہٕ بَنٲو، تہٕ یہِ ای میل نظرانداز کٔریو۔</p>
  </div>
  <div style="background:#f9fafb;padding:16px 32px;text-align:center;border-top:1px solid #e5e7eb;">
    <p style="font-size:12px;color:#9ca3af;margin:0;">Kashur Editor © ${new Date().getFullYear()}</p>
  </div>
</div>
</body>
</html>`,
  }
}

function otpResetEmail(name, otp) {
  return {
    subject: "Kashur Editor — Password Reset OTP | پاس ورڈ ری سیٹ",
    html: `<!DOCTYPE html>
<html dir="rtl" lang="ks">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family:Arial,sans-serif;background:#f0f4f8;margin:0;padding:0;">
<div style="max-width:520px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.1);">
  <div style="background:#c0392b;padding:28px 32px;text-align:center;">
    <h1 style="color:#fff;margin:0;font-size:22px;">پاسورٕڈ ری سیٹ</h1>
    <p style="color:rgba(255,255,255,.8);margin:6px 0 0;font-size:13px;">Password Reset Request</p>
  </div>
  <div style="padding:32px;direction:rtl;text-align:right;">
    <p style="font-size:16px;color:#1f2937;margin:0 0 16px;">السلام علیکم ${name},</p>
    <p style="font-size:14px;color:#4b5563;line-height:1.7;margin:0 0 24px;">
      یہِ نِچُہ دِتھ OTP کوڈ استعمال کٔرِتھ پنُن پاسورٕڈ تبدیل کٔریو:
    </p>
    <div style="background:#fff5f5;border:2px dashed #c0392b;border-radius:10px;padding:24px;text-align:center;margin:0 0 24px;">
      <p style="font-size:13px;color:#6b7280;margin:0 0 8px;">پاسورٕڈ ری سیٹ OTP</p>
      <div style="font-size:42px;font-weight:700;letter-spacing:12px;color:#c0392b;font-family:monospace;">${otp}</div>
      <p style="font-size:12px;color:#9ca3af;margin:8px 0 0;">یہِ کوڈ <strong>10 مِنَٹ</strong> منز ختم گژھِ</p>
    </div>
    <p style="font-size:13px;color:#6b7280;">اگر تُہۍ یہِ درخواست نہٕ کٔرٕمُت، تہٕ یہِ ای میل نظرانداز کٔریو۔</p>
  </div>
  <div style="background:#f9fafb;padding:16px 32px;text-align:center;border-top:1px solid #e5e7eb;">
    <p style="font-size:12px;color:#9ca3af;margin:0;">Kashur Editor © ${new Date().getFullYear()}</p>
  </div>
</div>
</body>
</html>`,
  }
}

function contactEmail({ fromName, fromEmail, type, subject, message }) {
  const typeLabels = { feedback: "💬 Feedback", bug: "🐛 Bug Report", feature: "💡 Feature Request", other: "📧 Other" }
  const typeLabel = typeLabels[type] || type
  return {
    subject: `[Kashur Editor] ${typeLabel}: ${subject}`,
    html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f0f4f8;margin:0;padding:0;">
<div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.1);">
  <div style="background:#2b579a;padding:22px 28px;">
    <h1 style="color:#fff;margin:0;font-size:18px;">Kashur Editor — User ${typeLabel}</h1>
  </div>
  <div style="padding:28px;">
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      <tr><td style="padding:6px 0;font-size:13px;color:#6b7280;width:100px;">From</td><td style="padding:6px 0;font-size:14px;font-weight:600;color:#1f2937;">${fromName} &lt;${fromEmail}&gt;</td></tr>
      <tr><td style="padding:6px 0;font-size:13px;color:#6b7280;">Type</td><td style="padding:6px 0;font-size:14px;color:#1f2937;">${typeLabel}</td></tr>
      <tr><td style="padding:6px 0;font-size:13px;color:#6b7280;">Subject</td><td style="padding:6px 0;font-size:14px;color:#1f2937;">${subject}</td></tr>
    </table>
    <div style="background:#f9fafb;border-left:4px solid #2b579a;border-radius:0 8px 8px 0;padding:16px 18px;">
      <p style="font-size:13px;color:#6b7280;margin:0 0 8px;">Message:</p>
      <p style="font-size:15px;color:#1f2937;line-height:1.7;margin:0;white-space:pre-wrap;">${message}</p>
    </div>
    <p style="font-size:12px;color:#9ca3af;margin-top:20px;">
      Reply to this email to respond directly to ${fromName} at ${fromEmail}.
    </p>
  </div>
  <div style="background:#f9fafb;padding:14px 28px;text-align:center;border-top:1px solid #e5e7eb;">
    <p style="font-size:12px;color:#9ca3af;margin:0;">Kashur Editor © ${new Date().getFullYear()}</p>
  </div>
</div>
</body>
</html>`,
  }
}

module.exports = { sendEmail, otpVerifyEmail, otpResetEmail, contactEmail }