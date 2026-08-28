// routes/admin/analytics.js
// Powers the Analytics section: 30-day trend charts (bar) plus overview
// numbers and a per-user leaderboard. Every number here comes from real
// stored data — nothing is invented. Two commonly-requested metrics are
// deliberately left out because the app doesn't capture the data they'd
// need yet: "Traffic Sources" (no referrer capture) and per-document
// font usage (fonts aren't recorded per document, only listed as available
// in the font picker).
const express  = require("express")
const router   = express.Router()
const User     = require("../../models/User")
const Document = require("../../models/Document")
const Feedback = require("../../models/Feedback")
const LoginHistory = require("../../models/LoginHistory")
const ActivityLog = require("../../models/ActivityLog")
const Font = require("../../models/Font")
const Template = require("../../models/Template")
const DictionaryEntry = require("../../models/DictionaryEntry")
const Shape = require("../../models/Shape")
const { summarizeEditorSessions } = require("../../utils/sessionAnalytics")

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

function isMobileUA(ua = "") {
  return /Mobile|Android|iPhone|iPad|iPod|Windows Phone/i.test(ua)
}

router.get("/", async (req, res) => {
  try {
    const since = daysAgo(29) // 30-day window
    const todayStart = daysAgo(0)
    const weekAgo = daysAgo(6)
    const monthAgo = daysAgo(29)

    const [
      totalUsers, verifiedUsers, activeToday, activeWeek, activeMonth,
      newUsersToday, newUsersMonth,
      totalDocuments, publicDocuments, sharedDocuments,
      sessionEvents,
      publicDocTrendRaw, privateDocTrendRaw, signupTrendRaw, loginTrendRaw, feedbackTrendRaw,
      topUsersRaw, recentLogins,
      storageAgg,
      feedbackTypeRaw, wordBandsRaw, loginHoursRaw,
      editorsRaw, documentQualityRaw,
      activeFonts, activeTemplates, dictionaryEntries, activeShapes,
    ] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ emailVerified: true }),
      User.countDocuments({ lastActiveAt: { $gte: todayStart } }),
      User.countDocuments({ lastActiveAt: { $gte: weekAgo } }),
      User.countDocuments({ lastActiveAt: { $gte: monthAgo } }),
      User.countDocuments({ createdAt: { $gte: todayStart } }),
      User.countDocuments({ createdAt: { $gte: monthAgo } }),
      Document.countDocuments({ deletedAt: null }),
      Document.countDocuments({ deletedAt: null, isPublic: true }),
      Document.countDocuments({ deletedAt: null, isPublic: true }), // "shared" == public, no separate share-link counter
      ActivityLog.find({
        action: "editor.session",
        createdAt: { $gte: since },
      })
        .select("actorId actorName actorEmail meta.durationSeconds createdAt")
        .lean(),
      Document.aggregate([
        { $match: { createdAt: { $gte: since }, deletedAt: null, isPublic: true } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: REPORT_TIME_ZONE } }, count: { $sum: 1 } } },
      ]),
      Document.aggregate([
        { $match: { createdAt: { $gte: since }, deletedAt: null, isPublic: { $ne: true } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: REPORT_TIME_ZONE } }, count: { $sum: 1 } } },
      ]),
      User.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: REPORT_TIME_ZONE } }, count: { $sum: 1 } } },
      ]),
      LoginHistory.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: REPORT_TIME_ZONE } }, count: { $sum: 1 } } },
      ]),
      Feedback.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: REPORT_TIME_ZONE } }, count: { $sum: 1 } } },
      ]),
      Document.aggregate([
        { $match: { deletedAt: null } },
        { $group: { _id: "$userId", documentCount: { $sum: 1 }, totalWords: { $sum: "$wordCount" }, lastActive: { $max: "$updatedAt" } } },
        { $sort: { documentCount: -1 } },
        { $limit: 10 },
        { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
        { $unwind: "$user" },
      ]),
      LoginHistory.find({ createdAt: { $gte: since } }).select("userAgent").lean(),
      Document.aggregate([
        { $match: { deletedAt: null } },
        { $project: { bytes: { $strLenBytes: { $ifNull: ["$html", ""] } } } },
        { $group: { _id: null, totalBytes: { $sum: "$bytes" } } },
      ]),
      Feedback.aggregate([{ $group: { _id: "$type", count: { $sum: 1 } } }]),
      Document.aggregate([
        { $match: { deletedAt: null } },
        { $bucket: {
          groupBy: { $ifNull: ["$wordCount", 0] },
          boundaries: [0, 1, 101, 501, 1001, 5001],
          default: "5000+",
          output: { count: { $sum: 1 } },
        } },
      ]),
      LoginHistory.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: { $hour: { date: "$createdAt", timezone: REPORT_TIME_ZONE } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Document.aggregate([
        { $match: { deletedAt: null, userId: { $ne: null } } },
        { $group: { _id: "$userId" } },
        { $count: "count" },
      ]),
      Document.aggregate([
        { $match: { deletedAt: null } },
        { $group: {
          _id: null,
          avgWords: { $avg: { $ifNull: ["$wordCount", 0] } },
          avgPages: { $avg: { $ifNull: ["$pageCount", 1] } },
          emptyDocuments: { $sum: { $cond: [{ $lte: [{ $ifNull: ["$wordCount", 0] }, 0] }, 1, 0] } },
          substantialDocuments: { $sum: { $cond: [{ $gte: [{ $ifNull: ["$wordCount", 0] }, 500] }, 1, 0] } },
        } },
      ]),
      Font.countDocuments({ active: true }),
      Template.countDocuments({ active: true }),
      DictionaryEntry.countDocuments({ active: true }),
      Shape.countDocuments({ active: true }),
    ])

    const toMap = (rows) => Object.fromEntries(rows.map(r => [r._id, r.count]))
    const publicMap  = toMap(publicDocTrendRaw)
    const privateMap = toMap(privateDocTrendRaw)
    const signupMap  = toMap(signupTrendRaw)
    const loginMap   = toMap(loginTrendRaw)
    const feedbackMap = toMap(feedbackTrendRaw)

    const documentTrend = []
    const signupTrend = []
    const loginTrend = []
    const feedbackTrend = []
    for (let i = 29; i >= 0; i--) {
      const d = daysAgo(i)
      const key = reportingDateKey(d)
      documentTrend.push({ date: key, public: publicMap[key] || 0, private: privateMap[key] || 0 })
      signupTrend.push({ date: key, count: signupMap[key] || 0 })
      loginTrend.push({ date: key, count: loginMap[key] || 0 })
      feedbackTrend.push({ date: key, feedback: feedbackMap[key] || 0 })
    }

    // Device usage — parsed from stored login user-agents (real, if coarse)
    let desktop = 0, mobile = 0
    for (const row of recentLogins) {
      if (isMobileUA(row.userAgent)) mobile++
      else desktop++
    }

    const sessionSummary = summarizeEditorSessions(sessionEvents, since, new Date())
    const totalTimeSeconds = sessionSummary.totalSeconds
    const avgTimeSeconds = sessionSummary.avgSeconds
    const totalStorageBytes = storageAgg[0]?.totalBytes || 0
    const asDistribution = (rows, colors) => rows.map((row, index) => ({
      label: String(row._id || "other"),
      value: row.count,
      color: colors[index % colors.length],
    }))
    const hourMap = Object.fromEntries(loginHoursRaw.map(row => [row._id, row.count]))
    const loginByHour = Array.from({ length: 24 }, (_, hour) => ({
      label: `${String(hour).padStart(2, "0")}:00`,
      hour,
      count: hourMap[hour] || 0,
    }))
    const wordBandLabels = { "0": "Empty", "1": "1–100", "101": "101–500", "501": "501–1k", "1001": "1k–5k", "5000+": "5k+" }
    const wordCountDistribution = wordBandsRaw.map(row => ({
      label: wordBandLabels[String(row._id)] || String(row._id),
      value: row.count,
    }))
    const editors = editorsRaw[0]?.count || 0
    const quality = documentQualityRaw[0] || {}

    res.json({
      overview: {
        totalUsers,
        activeToday,
        activeWeek,
        activeMonth,
        newUsersToday,
        newUsersMonth,
        totalDocuments,
        publicDocuments,
        privateDocuments: totalDocuments - publicDocuments,
        sharedDocuments,
        totalLoginsLast30d: recentLogins.length,
        avgEditingMinutes: +(avgTimeSeconds / 60).toFixed(1),
        totalEditingHours: +(totalTimeSeconds / 3600).toFixed(1),
        totalStorageMb: +(totalStorageBytes / (1024 * 1024)).toFixed(2),
      },
      documentTrend,
      signupTrend,
      loginTrend,
      feedbackTrend,
      deviceUsage: { desktop, mobile },
      feedbackTypeDistribution: asDistribution(feedbackTypeRaw, ["#f59e0b", "#ef4444", "#8b5cf6", "#64748b"]),
      wordCountDistribution,
      loginByHour,
      engagementFunnel: [
        { label: "Registered", value: totalUsers },
        { label: "Verified", value: verifiedUsers },
        { label: "Active (30d)", value: activeMonth },
        { label: "Created a document", value: editors },
      ],
      documentQuality: {
        avgWords: +(quality.avgWords || 0).toFixed(1),
        avgPages: +(quality.avgPages || 0).toFixed(1),
        emptyDocuments: quality.emptyDocuments || 0,
        substantialDocuments: quality.substantialDocuments || 0,
      },
      contentInventory: { activeFonts, activeTemplates, dictionaryEntries, activeShapes },
      topUsers: topUsersRaw.map(u => ({
        id: u._id,
        name: u.user.name,
        email: u.user.email,
        documentCount: u.documentCount,
        totalWords: u.totalWords || 0,
        lastActive: u.lastActive,
      })),
    })
  } catch (e) {
    console.error("Admin analytics error:", e)
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
