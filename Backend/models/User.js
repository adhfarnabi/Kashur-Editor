// models/User.js
const mongoose = require("mongoose")
const bcrypt   = require("bcryptjs")
const crypto   = require("crypto")

const UserSchema = new mongoose.Schema(
  {
    name: {
      type:     String,
      required: [true, "Name is required"],
      trim:     true,
      minlength: [2,  "Name must be at least 2 characters"],
      maxlength: [100,"Name must be at most 100 characters"],
    },
    email: {
      type:      String,
      required:  [true, "Email is required"],
      unique:    true,
      lowercase: true,
      trim:      true,
      match:     [/^\S+@\S+\.\S+$/, "Please enter a valid email"],
      index:     true,
    },
    phone: {
      type:  String,
      trim:  true,
      match: [/^[+]?[\d\s\-()]{7,20}$/, "Please enter a valid phone number"],
    },
    password: {
      type:     String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters"],
      select:   false, // never returned in queries by default
    },

    // ── Email verification ──────────────────────────────────────────────────
    emailVerified: {
      type:    Boolean,
      default: false,
      index:   true,
    },

    // ── OTP (used for email verification AND forgot password) ───────────────
    otp:          { type: String,  select: false },
    otpExpiry:    { type: Date,    select: false },
    otpPurpose:   {                               // "verify" | "reset"
      type:    String,
      enum:    ["verify", "reset"],
      select:  false,
    },
    otpAttempts:  { type: Number, default: 0, select: false }, // brute-force guard

    // ── Password reset ──────────────────────────────────────────────────────
    passwordChangedAt: { type: Date, select: false },

    // ── Soft delete / ban ───────────────────────────────────────────────────
    active:    { type: Boolean, default: true,  select: false },
    deletedAt: { type: Date,    default: null,  select: false },

    // ── ADMIN PANEL ADDITION — powers "Online Users" in the admin panel ─────
    lastActiveAt: { type: Date, default: null, index: true },
    // ── ADMIN PANEL ADDITION — cumulative time spent in the editor ──────────
    totalActiveSeconds: { type: Number, default: 0 },
  },
  {
    timestamps: true, // createdAt, updatedAt
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
)

// ─────────────────────────────────────────────────────────────────────────────
//  INDEXES
// ─────────────────────────────────────────────────────────────────────────────
UserSchema.index({ email: 1, emailVerified: 1 })

// ─────────────────────────────────────────────────────────────────────────────
//  PRE-SAVE HOOK — hash password before saving
// ─────────────────────────────────────────────────────────────────────────────
UserSchema.pre("save", async function () {
  // Only hash if password field was modified
  if (!this.isModified("password")) return

  const salt = await bcrypt.genSalt(12)
  this.password = await bcrypt.hash(this.password, salt)

  // Record when password was changed (used to invalidate old tokens)
  if (!this.isNew) {
    this.passwordChangedAt = new Date(Date.now() - 1000)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
//  INSTANCE METHODS
// ─────────────────────────────────────────────────────────────────────────────

/** Compare plain password with hashed password in DB */
UserSchema.methods.comparePassword = async function (plainPassword) {
  return bcrypt.compare(plainPassword, this.password)
}

/** Generate a 6-digit OTP, hash it, save expiry & purpose */
UserSchema.methods.generateOTP = function (purpose = "verify") {
  const otp = Math.floor(100000 + Math.random() * 900000).toString() // 6 digits
  // Store hash of OTP (not plain) — same security principle as passwords
  this.otp         = crypto.createHash("sha256").update(otp).digest("hex")
  this.otpExpiry   = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
  this.otpPurpose  = purpose
  this.otpAttempts = 0
  return otp // return PLAIN otp — only time it's available; send to email
}

/** Verify OTP — returns true/false. Handles expiry + brute force */
UserSchema.methods.verifyOTP = function (plainOtp, purpose) {
  if (!this.otp || !this.otpExpiry || !this.otpPurpose) return "invalid"
  if (this.otpPurpose !== purpose)                       return "invalid"
  if (new Date() > this.otpExpiry)                       return "expired"
  if (this.otpAttempts >= 5)                             return "locked"  // max 5 tries
  const hash = crypto.createHash("sha256").update(plainOtp).digest("hex")
  if (hash !== this.otp) {
    this.otpAttempts += 1
    return "wrong"
  }
  // Valid — clear OTP fields
  this.otp         = undefined
  this.otpExpiry   = undefined
  this.otpPurpose  = undefined
  this.otpAttempts = 0
  return "ok"
}

/** Check if JWT was issued before password was changed */
UserSchema.methods.isTokenValid = function (iatSeconds) {
  if (!this.passwordChangedAt) return true
  return iatSeconds >= Math.floor(this.passwordChangedAt.getTime() / 1000)
}

/** Safe user object for API responses (no password/OTP) */
UserSchema.methods.toPublic = function () {
  return {
    id:            this._id,
    name:          this.name,
    email:         this.email,
    phone:         this.phone,
    emailVerified: this.emailVerified,
    createdAt:     this.createdAt,
  }
}

module.exports = mongoose.model("User", UserSchema)