// models/Admin.js
// Admin accounts. The very first admin is auto-created on server startup
// from ADMIN_EMAIL / ADMIN_PASSWORD in .env (see utils/seedAdmin.js), so
// access is controlled by your .env file as requested. The password is
// hashed the same way User passwords are — never stored in plain text.
const mongoose = require("mongoose")
const bcrypt   = require("bcryptjs")

const AdminSchema = new mongoose.Schema(
  {
    name:  { type: String, required: true, trim: true, default: "Admin" },
    email: {
      type: String, required: true, unique: true, lowercase: true, trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please enter a valid email"],
    },
    password: { type: String, required: true, select: false },

    role: { type: String, enum: ["admin"], default: "admin" },
    active: { type: Boolean, default: true },

    lastLoginAt: { type: Date, default: null },
    lastLoginIp: { type: String, default: "" },
  },
  { timestamps: true }
)

AdminSchema.pre("save", async function () {
  if (!this.isModified("password")) return
  const salt = await bcrypt.genSalt(12)
  this.password = await bcrypt.hash(this.password, salt)
})

AdminSchema.methods.comparePassword = async function (plain) {
  return bcrypt.compare(plain, this.password)
}

AdminSchema.methods.toPublic = function () {
  return { id: this._id, name: this.name, email: this.email, role: this.role }
}

module.exports = mongoose.model("Admin", AdminSchema)
