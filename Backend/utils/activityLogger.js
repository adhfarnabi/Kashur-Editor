// utils/activityLogger.js
// Small helper to write to ActivityLog without cluttering every route with
// try/catch boilerplate. Logging failures never break the main request.
const ActivityLog = require("../models/ActivityLog")

async function logActivity({
  action, actorType = "user", actor = null,
  targetType = null, targetId = null, targetLabel = "",
  meta = {}, req = null,
}) {
  try {
    await ActivityLog.create({
      action,
      actorType,
      actorId:    actor?._id || actor?.id || null,
      actorName:  actor?.name || "",
      actorEmail: actor?.email || "",
      targetType,
      targetId,
      targetLabel,
      meta,
      ip: req?.ip || req?.headers?.["x-forwarded-for"] || "",
    })
  } catch (e) {
    console.error("Activity log error:", e.message)
  }
}

module.exports = { logActivity }
