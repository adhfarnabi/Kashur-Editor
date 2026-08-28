// routes/auth.js
//
// ALL AUTH ENDPOINTS
// ──────────────────
// POST /api/auth/signup          — register (or re-trigger OTP for unverified)
// POST /api/auth/verify-otp      — verify email OTP → issue JWT
// POST /api/auth/resend-otp      — resend OTP (verify or reset)
// POST /api/auth/login           — login with email + password
// POST /api/auth/forgot-password — send reset OTP
// POST /api/auth/reset-password  — verify reset OTP + set new password
// GET  /api/auth/me              — get current user (requires JWT)
// POST /api/auth/logout          — client-side only (invalidate on frontend)

const express  = require("express")
const router   = express.Router()
const User     = require("../models/User")
const { generateToken }              = require("../utils/jwt")
const { sendEmail, otpVerifyEmail, otpResetEmail } = require("../utils/email")
const { protect }                    = require("../middleware/auth")
const LoginHistory = require("../models/LoginHistory") // ADMIN PANEL ADDITION
const { logActivity } = require("../utils/activityLogger")
const https    = require("https")
const qs       = require("querystring")

const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET;


function verifyCaptcha(token) {
    return new Promise((resolve) => {
        if (!token) {
            console.error("reCAPTCHA: No token received");
            return resolve(false);
        }

        const body = qs.stringify({
            secret: RECAPTCHA_SECRET,
            response: token
        });

        const options = {
            hostname: "www.google.com",
            path: "/recaptcha/api/siteverify",
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Content-Length": Buffer.byteLength(body)
            }
        };

        const req = https.request(options, (res) => {
            let data = "";

            res.on("data", (chunk) => {
                data += chunk;
            });

            res.on("end", () => {
                try {
                    const result = JSON.parse(data);

                    console.log("reCAPTCHA Google response:", result);

                    resolve(result.success === true);
                } catch (error) {
                    console.error("reCAPTCHA response parse error:", error);
                    console.error("Raw response:", data);
                    resolve(false);
                }
            });
        });

        req.on("error", (error) => {
            console.error("reCAPTCHA request error:", error);
            resolve(false);
        });

        req.write(body);
        req.end();
    });
}

// ─── HELPER: send OTP email ───────────────────────────────────────────────────
async function dispatchOTP(user, purpose) {
  const plainOtp = user.generateOTP(purpose)
  await user.save({ validateBeforeSave: false })
  const template = purpose === "reset"
    ? otpResetEmail(user.name, plainOtp)
    : otpVerifyEmail(user.name, plainOtp)
  await sendEmail({ to: user.email, ...template })
  return plainOtp // only for dev logging; never expose in API response
}

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/auth/signup
//
//  Flow:
//    CASE 1: Email exists + verified     → 409 "already registered, please login"
//    CASE 2: Email exists + NOT verified → resend OTP, ask to verify
//    CASE 3: Email not exists            → create user, send OTP
// ─────────────────────────────────────────────────────────────────────────────
router.post("/signup", async (req, res) => {
  try {
    // ADMIN PANEL ADDITION — respect the "Allow new user signups" toggle
    const EditorSettings = require("../models/EditorSettings")
    const settings = await EditorSettings.getSingleton()
    if (settings.allowSignups === false) {
      return res.status(403).json({ error: "New signups are currently disabled by the administrator." })
    }

    const { name, email, phone, password, confirmPassword, captchaToken } = req.body


    // ── Input validation ──────────────────────────────────────────────────
    const errors = []
    if (!name  || name.trim().length < 2)              errors.push("Name must be at least 2 characters")
    if (!email || !/^\S+@\S+\.\S+$/.test(email))       errors.push("Valid email is required")
    if (!password)                                      errors.push("Password is required")
    if (password && password.length < 8)               errors.push("Password must be at least 8 characters")
    if (password && !/[A-Z]/.test(password))           errors.push("Password must contain at least one uppercase letter")
    if (password && !/[0-9]/.test(password))           errors.push("Password must contain at least one number")
    if (password && confirmPassword && password !== confirmPassword) errors.push("Passwords do not match")
    if (errors.length > 0) return res.status(422).json({ error: errors[0], errors })

    // ── reCAPTCHA verification ────────────────────────────────────────────
    const captchaOk = await verifyCaptcha(captchaToken)
    if (!captchaOk) {
      return res.status(422).json({ error: "CAPTCHA verification failed. Please try again." })
    }

    const normalizedEmail = email.toLowerCase().trim()

    // ── Check existing user ───────────────────────────────────────────────
    let user = await User.findOne({ email: normalizedEmail }).select("+otp +otpExpiry +otpPurpose +otpAttempts")

    if (user && user.emailVerified) {
      // CASE 1: Already registered and verified
      return res.status(409).json({
        error:  "This email is already registered. Please log in.",
        code:   "ALREADY_REGISTERED",
        action: "login",
      })
    }



    if (user && !user.emailVerified) {
      // CASE 2: Registered but not verified — update details and resend OTP
      user.name     = name.trim()
      user.phone    = phone?.trim()
      user.password = password // will be hashed in pre-save
      await dispatchOTP(user, "verify")
      return res.status(200).json({
        message: "Account exists but email not verified. A new OTP has been sent to your email.",
        email:   normalizedEmail,
        action:  "verify",
      })
    }

    // CASE 3: New user — create + send OTP
    user = new User({
      name:  name.trim(),
      email: normalizedEmail,
      phone: phone?.trim(),
      password,
    })
    await dispatchOTP(user, "verify")

    res.status(201).json({
      message: "Account created! Please check your email for the OTP verification code.",
      email:   normalizedEmail,
      action:  "verify",
    })
  } catch (e) {
    console.error("Signup error:", e)
    if (e.code === 11000) {
      return res.status(409).json({ error: "This email is already registered.", code: "ALREADY_REGISTERED" })
    }
    res.status(500).json({ error: "Registration failed. Please try again." })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/auth/verify-otp
//
//  Verifies OTP for email verification (purpose = "verify").
//  On success: marks email as verified, hashes password, issues JWT.
// ─────────────────────────────────────────────────────────────────────────────
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body
    if (!email || !otp) return res.status(422).json({ error: "Email and OTP are required" })

    const user = await User.findOne({ email: email.toLowerCase().trim() })
      .select("+otp +otpExpiry +otpPurpose +otpAttempts +password")
    if (!user) return res.status(404).json({ error: "User not found" })
    if (user.emailVerified) {
      return res.status(400).json({ error: "Email already verified. Please log in.", action: "login" })
    }

    const result = user.verifyOTP(otp.trim(), "verify")

    if (result === "expired") {
      return res.status(400).json({ error: "OTP expired. Please request a new one.", code: "OTP_EXPIRED", action: "resend" })
    }
    if (result === "locked") {
      return res.status(429).json({ error: "Too many wrong attempts. Please request a new OTP.", code: "OTP_LOCKED", action: "resend" })
    }
    if (result === "wrong") {
      await user.save({ validateBeforeSave: false })
      const remaining = 5 - user.otpAttempts
      return res.status(400).json({ error: `Incorrect OTP. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining.`, code: "OTP_WRONG", attemptsLeft: remaining })
    }

    // OTP verified ✓
    user.emailVerified = true
    await user.save({ validateBeforeSave: false })

    const token = generateToken(user._id)
    res.status(200).json({
      message: "Email verified successfully! Welcome.",
      token,
      user:    user.toPublic(),
    })
  } catch (e) {
    console.error("Verify OTP error:", e)
    res.status(500).json({ error: "Verification failed. Please try again." })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/auth/resend-otp
//  Body: { email, purpose }  where purpose = "verify" | "reset"
// ─────────────────────────────────────────────────────────────────────────────
router.post("/resend-otp", async (req, res) => {
  try {
    const { email, purpose = "verify" } = req.body
    if (!email) return res.status(422).json({ error: "Email is required" })

    const user = await User.findOne({ email: email.toLowerCase().trim() })
      .select("+otp +otpExpiry +otpPurpose +otpAttempts")
    if (!user) return res.status(404).json({ error: "No account found with this email" })

    if (purpose === "verify" && user.emailVerified) {
      return res.status(400).json({ error: "Email already verified. Please log in.", action: "login" })
    }

    // Rate limit: don't resend if previous OTP still has > 9 minutes left
    if (user.otpExpiry && new Date(user.otpExpiry) > new Date(Date.now() + 9 * 60 * 1000)) {
      const secondsLeft = Math.ceil((new Date(user.otpExpiry) - Date.now()) / 1000)
      return res.status(429).json({
        error: `Please wait ${Math.ceil(secondsLeft / 60)} minute(s) before requesting a new OTP.`,
        code:  "RESEND_TOO_SOON",
        secondsLeft,
      })
    }

    await dispatchOTP(user, purpose)
    res.status(200).json({ message: "A new OTP has been sent to your email.", email: user.email })
  } catch (e) {
    console.error("Resend OTP error:", e)
    res.status(500).json({ error: "Failed to resend OTP. Please try again." })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/auth/login
//
//  Flow:
//    CASE 1: Email not found                  → 404, suggest signup
//    CASE 2: Email found + NOT verified       → resend OTP, ask to verify
//    CASE 3: Email found + wrong password     → 401
//    CASE 4: Email found + correct password   → issue JWT
// ─────────────────────────────────────────────────────────────────────────────
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(422).json({ error: "Email and password are required" })
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() })
      .select("+password +otp +otpExpiry +otpPurpose +otpAttempts +active")
    
    // CASE 1: Not found
    if (!user) {
      return res.status(404).json({
        error:  "No account found with this email. Please sign up.",
        code:   "NOT_FOUND",
        action: "signup",
      })
    }

    // CASE 2: Found but not verified
    if (!user.emailVerified) {
      await dispatchOTP(user, "verify")
      return res.status(403).json({
        error:  "Email not verified. A new OTP has been sent to your email.",
        code:   "EMAIL_NOT_VERIFIED",
        email:  user.email,
        action: "verify",
      })
    }

    // CASE 3: Wrong password
    const isMatch = await user.comparePassword(password)
    if (!isMatch) {
      return res.status(401).json({
        error: "Incorrect email or password.",
        code:  "WRONG_CREDENTIALS",
      })
    }

    // CASE 4: Success
    const token = generateToken(user._id)

    // ADMIN PANEL ADDITION — login history + online-status tracking
    user.lastActiveAt = new Date()
    await user.save()
    await LoginHistory.create({
      userId: user._id, email: user.email,
      ip: req.ip || "", userAgent: req.headers["user-agent"] || "",
    })

    res.status(200).json({
      message: "Login successful. Welcome back!",
      token,
      user:    user.toPublic(),
    })
  } catch (e) {
    console.error("Login error:", e)
    res.status(500).json({ error: "Login failed. Please try again." })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/auth/forgot-password
//  Body: { email }
//    CASE 1: Email not found → 404
//    CASE 2: Email found     → generate + send reset OTP
// ─────────────────────────────────────────────────────────────────────────────
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body
    if (!email) return res.status(422).json({ error: "Email is required" })

    const user = await User.findOne({ email: email.toLowerCase().trim() })
      .select("+otp +otpExpiry +otpPurpose +otpAttempts")

    // CASE 1: Not found
    if (!user) {
      return res.status(404).json({
        error:  "No account found with this email.",
        code:   "NOT_FOUND",
        action: "signup",
      })
    }

    // CASE 2: Send reset OTP
    await dispatchOTP(user, "reset")
    res.status(200).json({
      message: "A password reset OTP has been sent to your email.",
      email:   user.email,
      action:  "reset",
    })
  } catch (e) {
    console.error("Forgot password error:", e)
    res.status(500).json({ error: "Failed to send reset OTP. Please try again." })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/auth/reset-password
//  Body: { email, otp, newPassword, confirmPassword }
// ─────────────────────────────────────────────────────────────────────────────
router.post("/reset-password", async (req, res) => {
  try {
    const { email, otp, newPassword, confirmPassword } = req.body
    if (!email || !otp || !newPassword) {
      return res.status(422).json({ error: "Email, OTP, and new password are required" })
    }

    // Validate new password
    const errors = []
    if (newPassword.length < 8)               errors.push("Password must be at least 8 characters")
    if (!/[A-Z]/.test(newPassword))           errors.push("Password must contain at least one uppercase letter")
    if (!/[0-9]/.test(newPassword))           errors.push("Password must contain at least one number")
    if (confirmPassword && newPassword !== confirmPassword) errors.push("Passwords do not match")
    if (errors.length > 0) return res.status(422).json({ error: errors[0], errors })

    const user = await User.findOne({ email: email.toLowerCase().trim() })
      .select("+otp +otpExpiry +otpPurpose +otpAttempts +password")
    if (!user) return res.status(404).json({ error: "User not found" })

    const result = user.verifyOTP(otp.trim(), "reset")
    if (result === "expired") {
      return res.status(400).json({ error: "OTP expired. Please request a new one.", code: "OTP_EXPIRED", action: "resend" })
    }
    if (result === "locked") {
      return res.status(429).json({ error: "Too many wrong attempts. Please request a new OTP.", code: "OTP_LOCKED", action: "resend" })
    }
    if (result === "wrong") {
      await user.save({ validateBeforeSave: false })
      const remaining = 5 - user.otpAttempts
      return res.status(400).json({ error: `Incorrect OTP. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining.`, code: "OTP_WRONG", attemptsLeft: remaining })
    }

    // OTP valid — update password (pre-save hook hashes it)
    user.password = newPassword
    user.emailVerified = true // ensure verified
    await user.save()

    // Issue a new token so they're logged in immediately
    const token = generateToken(user._id)
    res.status(200).json({
      message: "Password reset successfully! You are now logged in.",
      token,
      user:    user.toPublic(),
    })
  } catch (e) {
    console.error("Reset password error:", e)
    res.status(500).json({ error: "Password reset failed. Please try again." })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/auth/me  — get current user profile (requires JWT)
// ─────────────────────────────────────────────────────────────────────────────
router.get("/me", protect, async (req, res) => {
  // ADMIN PANEL ADDITION — lightweight heartbeat so "Online Users" reflects
  // actual active sessions, not just login time. Also accumulates time spent
  // in the editor: if the gap since the last heartbeat is under 2 minutes,
  // we count that gap as active time. A bigger gap means the tab was closed
  // or idle, so it's not counted — this keeps the total honest without
  // needing a dedicated session-tracking system.
  const HEARTBEAT_CAP_SECONDS = 120
  const now = new Date()
  const gapSeconds = req.user.lastActiveAt ? (now - req.user.lastActiveAt) / 1000 : 0
  const editorActive = req.get("x-editor-active") === "1"
  const addSeconds = editorActive && gapSeconds > 0 && gapSeconds <= HEARTBEAT_CAP_SECONDS
    ? Math.round(gapSeconds)
    : 0

  User.findByIdAndUpdate(req.user._id, {
      $set: { lastActiveAt: now },
      $inc: { totalActiveSeconds: addSeconds },
    })
    .then(() => {
      if (addSeconds < 5) return
      return logActivity({
        action: "editor.session",
        actorType: "user",
        actor: req.user,
        targetType: "editor",
        meta: { durationSeconds: addSeconds },
        req,
      })
    })
    .catch(() => {})
  res.status(200).json({ user: req.user.toPublic() })
})

// ─────────────────────────────────────────────────────────────────────────────
//  PUT /api/auth/me  — update profile (name, phone)
// ─────────────────────────────────────────────────────────────────────────────
router.put("/me", protect, async (req, res) => {
  try {
    const { name, phone } = req.body
    const user = await User.findById(req.user._id)
    if (name && name.trim().length >= 2) user.name = name.trim()
    if (phone !== undefined) user.phone = phone?.trim()
    await user.save()
    res.status(200).json({ message: "Profile updated.", user: user.toPublic() })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/auth/change-password  — change password while logged in
//  Body: { currentPassword, newPassword, confirmPassword }
// ─────────────────────────────────────────────────────────────────────────────
router.post("/change-password", protect, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body

    if (!currentPassword || !newPassword) {
      return res.status(422).json({ error: "Current and new password are required" })
    }

    // Validate new password strength
    const errs = []
    if (newPassword.length < 8)           errs.push("Password must be at least 8 characters")
    if (!/[A-Z]/.test(newPassword))       errs.push("Password must contain at least one uppercase letter")
    if (!/[0-9]/.test(newPassword))       errs.push("Password must contain at least one number")
    if (confirmPassword && newPassword !== confirmPassword) errs.push("Passwords do not match")
    if (errs.length) return res.status(422).json({ error: errs[0], errors: errs })

    // Get user with password field
    const user = await User.findById(req.user._id).select("+password")
    if (!user) return res.status(404).json({ error: "User not found" })

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword)
    if (!isMatch) {
      return res.status(401).json({ error: "Current password is incorrect", code: "WRONG_PASSWORD" })
    }

    // Update — pre-save hook will hash it
    user.password = newPassword
    await user.save()

    res.status(200).json({ message: "Password changed successfully." })
  } catch (e) {
    console.error("Change password error:", e)
    res.status(500).json({ error: e.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/auth/logout
// ─────────────────────────────────────────────────────────────────────────────
router.post("/logout", protect, (req, res) => {
  res.status(200).json({ message: "Logged out successfully." })
})

module.exports = router
