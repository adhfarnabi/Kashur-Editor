// routes/admin/dashboard.js
// GET /api/admin/dashboard — headline stats + 30-day time-series for charts
const express      = require("express")
const router        = express.Router()
const User          = require("../../models/User")
const Document       = require("../../models/Document")
const Feedback       = require("../../models/Feedback")
const Admin          = require("../../models/Admin")
const LoginHistory   = require("../../models/LoginHistory")
const ActivityLog    = require("../../models/ActivityLog")
const Font           = require("../../models/Font")
const Template       = require("../../models/Template")
const DictionaryEntry = require("../../models/DictionaryEntry")
const Shape          = require("../../models/Shape")

const REPORT_TIME_ZONE = process.env.REPORT_TIME_ZONE || "Asia/Kolkata"
const parsedOffset = Number(process.env.REPORT_TIMEZONE_OFFSET_MINUTES)
const REPORT_OFFSET_MINUTES = Number.isFinite(parsedOffset) ? parsedOffset : 330
function daysAgo(n) {
  const now = new Date()
  const shifted = new Date(now.getTime() + REPORT_OFFSET_MINUTES * 60000)
  const reportingMidnight = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate(),
  ) - REPORT_OFFSET_MINUTES * 60000
  return new Date(reportingMidnight - n * 86400000)
}

function reportingDateKey(date) {
  const shifted = new Date(date.getTime() + REPORT_OFFSET_MINUTES * 60000)
  return shifted.toISOString().slice(0, 10)
}

router.get("/", async (req, res) => {
  try {
    const weekAgo = daysAgo(6) // includes today → 7-day window
    const since = daysAgo(29)

    const [
      totalUsers, verifiedUsers, activeThisWeek,
      totalDocuments, publicDocsCount, deletedDocuments,
      newFeedback, adminCount,
      recentDocs, storageAgg, topCreatorsRaw,
      pendingDocuments, archivedDocuments,
      activeFonts, activeTemplates, activeDictionaryEntries, activeShapes,
      feedbackBreakdownRaw, recentActivity,
    ] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ emailVerified: true }),
      User.countDocuments({ lastActiveAt: { $gte: weekAgo } }),
      Document.countDocuments({ deletedAt: null }),
      Document.countDocuments({ isPublic: true, deletedAt: null }),
      Document.countDocuments({ deletedAt: { $ne: null } }),
      Feedback.countDocuments({ status: "new" }),
      Admin.countDocuments({}),
      Document.find({ deletedAt: null })
        .sort({ updatedAt: -1 })
        .limit(8)
        .populate("userId", "name email")
        .select("title updatedAt wordCount userId")
        .lean(),
      Document.aggregate([
        { $match: { deletedAt: null } },
        { $project: { bytes: { $strLenBytes: { $ifNull: ["$html", ""] } } } },
        { $group: { _id: null, totalBytes: { $sum: "$bytes" } } },
      ]),
      Document.aggregate([
        { $match: { deletedAt: null } },
        { $group: { _id: "$userId", documentCount: { $sum: 1 }, lastActive: { $max: "$updatedAt" } } },
        { $sort: { documentCount: -1 } },
        { $limit: 5 },
        { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
        { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
      ]),
      Document.countDocuments({ deletedAt: null, approvalStatus: "pending" }),
      Document.countDocuments({ deletedAt: null, archivedAt: { $ne: null } }),
      Font.countDocuments({ active: true }),
      Template.countDocuments({ active: true }),
      DictionaryEntry.countDocuments({ active: true }),
      Shape.countDocuments({ active: true }),
      Feedback.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      ActivityLog.find({ action: { $ne: "editor.session" } })
        .sort({ createdAt: -1 })
        .limit(10)
        .select("action actorType actorName actorEmail targetType targetLabel createdAt")
        .lean(),
    ])

    // 30-day signups / documents / logins trend
    const [signupTrendRaw, docTrendRaw, loginTrendRaw] = await Promise.all([
      User.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: REPORT_TIME_ZONE } }, count: { $sum: 1 } } },
      ]),
      Document.aggregate([
        { $match: { createdAt: { $gte: since }, deletedAt: null } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: REPORT_TIME_ZONE } }, count: { $sum: 1 } } },
      ]),
      LoginHistory.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: REPORT_TIME_ZONE } }, count: { $sum: 1 } } },
      ]),
    ])

    const trendMap = (rows) => Object.fromEntries(rows.map(r => [r._id, r.count]))
    const signupMap = trendMap(signupTrendRaw)
    const docMap    = trendMap(docTrendRaw)
    const loginMap  = trendMap(loginTrendRaw)

    const days = []
    for (let i = 29; i >= 0; i--) {
      const d = daysAgo(i)
      const key = reportingDateKey(d)
      days.push({
        date: key,
        signups: signupMap[key] || 0,
        documents: docMap[key] || 0,
        logins: loginMap[key] || 0,
      })
    }

    const totalStorageBytes = storageAgg[0]?.totalBytes || 0
    const feedbackBreakdown = Object.fromEntries(feedbackBreakdownRaw.map(row => [row._id, row.count]))
    const verificationRate = totalUsers ? +((verifiedUsers / totalUsers) * 100).toFixed(1) : 0
    const publicShareRate = totalDocuments ? +((publicDocsCount / totalDocuments) * 100).toFixed(1) : 0
    const activeRate = totalUsers ? +((activeThisWeek / totalUsers) * 100).toFixed(1) : 0

    res.json({
      stats: {
        totalUsers,
        verifiedUsers,
        unverifiedUsers: totalUsers - verifiedUsers,
        activeThisWeek,
        totalDocuments,
        publicDocuments: publicDocsCount,
        privateDocuments: totalDocuments - publicDocsCount,
        deletedDocuments,
        newFeedback,
        totalStorageMb: +(totalStorageBytes / (1024 * 1024)).toFixed(2),
        pendingDocuments,
        archivedDocuments,
        verificationRate,
        publicShareRate,
        activeRate,
      },
      contentInventory: {
        activeFonts,
        activeTemplates,
        activeDictionaryEntries,
        activeShapes,
      },
      feedbackSummary: {
        new: feedbackBreakdown.new || 0,
        read: feedbackBreakdown.read || 0,
        replied: feedbackBreakdown.replied || 0,
        archived: feedbackBreakdown.archived || 0,
      },
      operationalHealth: {
        verificationRate,
        activeRate,
        publicShareRate,
        pendingReviews: pendingDocuments,
        unansweredFeedback: (feedbackBreakdown.new || 0) + (feedbackBreakdown.read || 0),
      },
      systemHealth: {
        database: "Connected",
        apiUptimeSeconds: Math.round(process.uptime()),
        memoryUsedMb: +(process.memoryUsage().heapUsed / (1024 * 1024)).toFixed(1),
        generatedAt: new Date().toISOString(),
      },
      // Real breakdown — Admins vs regular Users (no separate role field on
      // the User model, every user is a plain "User"; Admins live in their
      // own collection). This is genuine data, not a placeholder.
      roleDistribution: [
        { label: "Users", value: totalUsers, color: "#1B2A4A" },
        { label: "Admins", value: adminCount, color: "#E8A33D" },
      ],
      topCreators: topCreatorsRaw.map(u => ({
        id: u._id,
        name: u.user?.name || "Unknown",
        email: u.user?.email || "—",
        documentCount: u.documentCount,
        lastActive: u.lastActive,
      })),
      trend: days,
      recentDocuments: recentDocs.map(d => ({
        id: d._id,
        title: d.title,
        updatedAt: d.updatedAt,
        wordCount: d.wordCount,
        owner: d.userId ? { name: d.userId.name, email: d.userId.email } : null,
      })),
      recentActivity: recentActivity.map(item => ({
        id: item._id,
        action: item.action,
        actorType: item.actorType,
        actorName: item.actorName || item.actorEmail || "System",
        targetType: item.targetType,
        targetLabel: item.targetLabel,
        createdAt: item.createdAt,
      })),
    })
  } catch (e) {
    console.error("Admin dashboard error:", e)
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
