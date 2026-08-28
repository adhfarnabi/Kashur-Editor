// routes/admin/reports.js
const express = require("express")
const router = express.Router()
const User = require("../../models/User")
const Document = require("../../models/Document")
const Font = require("../../models/Font")
const Template = require("../../models/Template")
const DictionaryEntry = require("../../models/DictionaryEntry")
const Shape = require("../../models/Shape")
const LoginHistory = require("../../models/LoginHistory")
const ActivityLog = require("../../models/ActivityLog")
const Feedback = require("../../models/Feedback")
const { summarizeEditorSessions } = require("../../utils/sessionAnalytics")
const { currentPeriodShare, resolveDeletedCount } = require("../../utils/reportMetrics")

// Kashmir/India reporting day by default. Override these values in .env if the
// application is deployed for another timezone.
const REPORT_TIME_ZONE = process.env.REPORT_TIME_ZONE || "Asia/Kolkata"
const parsedOffset = Number(process.env.REPORT_TIMEZONE_OFFSET_MINUTES)
const REPORT_OFFSET_MINUTES = Number.isFinite(parsedOffset) ? parsedOffset : 330
const DAY_MS = 24 * 60 * 60 * 1000

function startOfReportingDay(date = new Date()) {
  const shifted = new Date(date.getTime() + REPORT_OFFSET_MINUTES * 60000)
  return new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) -
      REPORT_OFFSET_MINUTES * 60000,
  )
}

function startOfReportingMonth(date = new Date()) {
  const shifted = new Date(date.getTime() + REPORT_OFFSET_MINUTES * 60000)
  return new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), 1) -
      REPORT_OFFSET_MINUTES * 60000,
  )
}

function startOfReportingYear(date = new Date()) {
  const shifted = new Date(date.getTime() + REPORT_OFFSET_MINUTES * 60000)
  return new Date(
    Date.UTC(shifted.getUTCFullYear(), 0, 1) -
      REPORT_OFFSET_MINUTES * 60000,
  )
}

function parseReportingDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""))
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const utc = Date.UTC(year, month - 1, day) - REPORT_OFFSET_MINUTES * 60000
  const parsed = new Date(utc)
  const shifted = new Date(parsed.getTime() + REPORT_OFFSET_MINUTES * 60000)

  if (
    shifted.getUTCFullYear() !== year ||
    shifted.getUTCMonth() !== month - 1 ||
    shifted.getUTCDate() !== day
  ) {
    return null
  }
  return parsed
}

function makeWindow(start, end) {
  return { $gte: start, $lt: end }
}

// Returns the selected window and the immediately preceding window of exactly
// the same duration. Half-open windows avoid double counting boundary records.
function resolveRange(req) {
  const { range = "30d", from, to } = req.query
  const now = new Date()
  const todayStart = startOfReportingDay(now)
  let start
  let end = now

  if (range === "custom") {
    start = parseReportingDate(from)
    if (!start) {
      const error = new Error("A valid custom start date is required (YYYY-MM-DD).")
      error.status = 400
      throw error
    }

    if (to) {
      const toStart = parseReportingDate(to)
      if (!toStart) {
        const error = new Error("The custom end date must use YYYY-MM-DD.")
        error.status = 400
        throw error
      }
      end = new Date(Math.min(toStart.getTime() + DAY_MS, now.getTime()))
    }
  } else if (range === "today") {
    start = todayStart
  } else if (range === "7d") {
    start = new Date(todayStart.getTime() - 6 * DAY_MS)
  } else if (range === "30d") {
    start = new Date(todayStart.getTime() - 29 * DAY_MS)
  } else if (range === "month") {
    start = startOfReportingMonth(now)
  } else if (range === "year") {
    start = startOfReportingYear(now)
  } else {
    start = new Date(todayStart.getTime() - 29 * DAY_MS)
  }

  if (start >= end) {
    const error = new Error("The report start date must be before the end date.")
    error.status = 400
    throw error
  }

  const duration = end.getTime() - start.getTime()
  const previousEnd = start
  const previousStart = new Date(start.getTime() - duration)

  return {
    range,
    start,
    end,
    current: makeWindow(start, end),
    previous: makeWindow(previousStart, previousEnd),
  }
}

function isMobileUserAgent(userAgent = "") {
  return /Mobile|Android|iPhone|iPad|iPod|Windows Phone/i.test(userAgent)
}

// A bounded 0-100 score: current / (current + previous equal range) * 100.
// Unlike conventional percentage change, it can never display +200%, -100%,
// or another value that is confusing as a dashboard progress percentage.
const growthShare = currentPeriodShare

const distribution = rows =>
  rows.map(row => ({ label: String(row._id || "other"), value: row.count }))

const asMap = rows =>
  Object.fromEntries(rows.map(row => [row._id, row.count]))

async function buildSummary(resolvedRange) {
  const { current, previous, start, end } = resolvedRange
  const currentDocuments = { createdAt: current }
  const currentStorageActivity = { updatedAt: current, deletedAt: null }

  const [
    totalUsers,
    totalDocuments,
    activeUserIds,
    newUsersInRange,
    newUsersPrevious,
    docsCreatedInRange,
    docsCreatedPrevious,
    deletedDocumentEvents,
    deletedDocumentRecords,
    publicDocuments,
    storageAgg,
    perUserStorage,
    fonts,
    templateCount,
    dictionaryCount,
    shapeCount,
    sessionEvents,
    loginsInRange,
    topActiveLoginUsers,
    failedAdminLogins,
    adminActionCount,
    accountChanges,
    backupEvents,
    feedbackStatusRaw,
    feedbackTypeRaw,
    signupTrendRaw,
    documentTrendRaw,
    loginTrendRaw,
    feedbackTrendRaw,
    loginAgents,
    heatmapRaw,
  ] = await Promise.all([
    User.countDocuments({}),
    Document.countDocuments({ deletedAt: null }),
    LoginHistory.distinct("userId", { createdAt: current }),
    User.countDocuments({ createdAt: current }),
    User.countDocuments({ createdAt: previous }),
    Document.countDocuments(currentDocuments),
    Document.countDocuments({ createdAt: previous }),
    // Count deletion operations, not only records that happen to remain
    // deleted.  This stays correct when a document is restored and deleted
    // again. The document-state count below is a fallback for legacy rows
    // created before activity logging was introduced.
    ActivityLog.countDocuments({ action: "document.deleted", createdAt: current }),
    Document.countDocuments({ deletedAt: current }),
    Document.countDocuments({ ...currentDocuments, isPublic: true }),
    Document.aggregate([
      { $match: currentStorageActivity },
      { $project: { bytes: { $strLenBytes: { $ifNull: ["$html", ""] } } } },
      { $group: { _id: null, totalBytes: { $sum: "$bytes" } } },
    ]),
    Document.aggregate([
      { $match: currentStorageActivity },
      {
        $project: {
          userId: 1,
          bytes: { $strLenBytes: { $ifNull: ["$html", ""] } },
        },
      },
      { $group: { _id: "$userId", bytes: { $sum: "$bytes" } } },
      { $sort: { bytes: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
    ]),
    Font.find({}).select("name isDefault").lean(),
    Template.countDocuments({}),
    DictionaryEntry.countDocuments({}),
    Shape.countDocuments({}),
    ActivityLog.find({
      action: "editor.session",
      createdAt: current,
    })
      .select("actorId actorName actorEmail meta.durationSeconds createdAt")
      .lean(),
    LoginHistory.countDocuments({ createdAt: current }),
    LoginHistory.aggregate([
      { $match: { createdAt: current } },
      { $group: { _id: "$userId", logins: { $sum: 1 } } },
      { $sort: { logins: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
    ]),
    ActivityLog.countDocuments({
      action: "admin.login_failed",
      createdAt: current,
    }),
    ActivityLog.countDocuments({ actorType: "admin", createdAt: current }),
    ActivityLog.countDocuments({
      action: { $in: ["user.disabled", "user.enabled", "user.deleted"] },
      createdAt: current,
    }),
    ActivityLog.countDocuments({
      action: { $in: ["backup.created", "backup.restored"] },
      createdAt: current,
    }),
    Feedback.aggregate([
      { $match: { createdAt: current } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Feedback.aggregate([
      { $match: { createdAt: current } },
      { $group: { _id: "$type", count: { $sum: 1 } } },
    ]),
    User.aggregate([
      { $match: { createdAt: current } },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
              timezone: REPORT_TIME_ZONE,
            },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Document.aggregate([
      { $match: { createdAt: current } },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
              timezone: REPORT_TIME_ZONE,
            },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    LoginHistory.aggregate([
      { $match: { createdAt: current } },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
              timezone: REPORT_TIME_ZONE,
            },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Feedback.aggregate([
      { $match: { createdAt: current } },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
              timezone: REPORT_TIME_ZONE,
            },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    LoginHistory.find({ createdAt: current }).select("userAgent").lean(),
    LoginHistory.aggregate([
      { $match: { createdAt: current } },
      {
        $project: {
          day: {
            $add: [
              {
                $mod: [
                  {
                    $add: [
                      { $dayOfWeek: { date: "$createdAt", timezone: REPORT_TIME_ZONE } },
                      5,
                    ],
                  },
                  7,
                ],
              },
              1,
            ],
          },
          hour: {
            $hour: { date: "$createdAt", timezone: REPORT_TIME_ZONE },
          },
        },
      },
      {
        $group: {
          _id: { day: "$day", hour: "$hour" },
          value: { $sum: 1 },
        },
      },
      { $sort: { "_id.day": 1, "_id.hour": 1 } },
    ]),
  ])

  const totalBytes = storageAgg[0]?.totalBytes || 0
  const deletedDocuments = resolveDeletedCount(deletedDocumentEvents, deletedDocumentRecords)
  const time = summarizeEditorSessions(sessionEvents, start, end)
  const activeUsersInRange = new Set([
    ...activeUserIds.map(id => String(id)),
    ...sessionEvents.map(event => String(event.actorId || "")).filter(Boolean),
  ]).size
  const trafficCounts = loginAgents.reduce(
    (counts, login) => {
      const key = isMobileUserAgent(login.userAgent) ? "Mobile" : "Desktop"
      counts[key] += 1
      return counts
    },
    { Desktop: 0, Mobile: 0 },
  )
  const trafficReport = Object.entries(trafficCounts).map(([label, value]) => ({
    label,
    value,
  }))
  const signupMap = asMap(signupTrendRaw)
  const documentMap = asMap(documentTrendRaw)
  const loginMap = asMap(loginTrendRaw)
  const feedbackMap = asMap(feedbackTrendRaw)
  const allDates = [
    ...new Set([
      ...Object.keys(signupMap),
      ...Object.keys(documentMap),
      ...Object.keys(loginMap),
      ...Object.keys(feedbackMap),
    ]),
  ].sort()

  return {
    userReport: {
      totalUsers,
      newUsersInRange,
      activeUsersInRange,
    },
    documentReport: {
      totalDocuments,
      documentsCreatedInRange: docsCreatedInRange,
      publicDocuments,
      privateDocuments: Math.max(0, docsCreatedInRange - publicDocuments),
      deletedDocuments,
    },
    usageReport: {
      totalTimeSpentHours: +((time.totalSeconds || 0) / 3600).toFixed(1),
      totalTimeSpentMinutes: +((time.totalSeconds || 0) / 60).toFixed(1),
      trackedSessions: time.trackedSessions || 0,
      avgTimeSpentMinutes: +((time.avgSeconds || 0) / 60).toFixed(1),
      longestSessionMinutes: +((time.longestSeconds || 0) / 60).toFixed(1),
      shortestSessionMinutes: +((time.shortestSeconds || 0) / 60).toFixed(1),
      topTimeUsers: time.topTimeUsers.map(row => ({
        name: row.name,
        email: row.email,
        hours: +((row.totalSeconds || 0) / 3600).toFixed(1),
        sessions: row.sessions || 0,
      })),
    },
    storageReport: {
      storageInRangeMb: +(totalBytes / (1024 * 1024)).toFixed(3),
      totalStorageMb: +(totalBytes / (1024 * 1024)).toFixed(3),
      topStorageUsers: perUserStorage.map(row => ({
        name: row.user?.name || "Unknown",
        email: row.user?.email || "—",
        storageMb: +(row.bytes / (1024 * 1024)).toFixed(3),
      })),
    },
    contentReport: {
      fontCount: fonts.length,
      templateCount,
      dictionaryEntryCount: dictionaryCount,
      shapeCount,
    },
    loginReport: {
      loginsInRange,
      topActiveUsers: topActiveLoginUsers.map(row => ({
        name: row.user?.name || "Unknown",
        email: row.user?.email || "—",
        logins: row.logins,
      })),
    },
    securityReport: {
      failedAdminLogins,
      adminActions: adminActionCount,
      userAccountChanges: accountChanges,
      backupEvents,
    },
    feedbackReport: {
      total: feedbackStatusRaw.reduce((sum, row) => sum + row.count, 0),
      byStatus: distribution(feedbackStatusRaw),
      byType: distribution(feedbackTypeRaw),
    },
    trafficReport,
    weeklyHeatmap: heatmapRaw.map(row => ({
      day: row._id.day,
      hour: row._id.hour,
      value: row.value,
    })),
    rangeTrend: allDates.map(date => ({
      date,
      signups: signupMap[date] || 0,
      documents: documentMap[date] || 0,
      logins: loginMap[date] || 0,
      feedback: feedbackMap[date] || 0,
    })),
    rangeGrowth: {
      usersCurrent: newUsersInRange,
      usersPrevious: newUsersPrevious,
      userGrowth: growthShare(newUsersInRange, newUsersPrevious),
      docsCurrent: docsCreatedInRange,
      docsPrevious: docsCreatedPrevious,
      docGrowth: growthShare(docsCreatedInRange, docsCreatedPrevious),
    },
  }
}

router.get("/", async (req, res) => {
  try {
    const resolvedRange = resolveRange(req)
    const summary = await buildSummary(resolvedRange)
    res.json({
      ...summary,
      range: resolvedRange.range,
      rangeStart: resolvedRange.start.toISOString(),
      rangeEnd: resolvedRange.end.toISOString(),
      generatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Reports error:", error)
    res.status(error.status || 500).json({ error: error.message })
  }
})

// GET /api/admin/reports/export.csv?type=summary|users|documents|storage|login|security&range=...
router.get("/export.csv", async (req, res) => {
  try {
    const resolvedRange = resolveRange(req)
    const type = req.query.type || "summary"
    const summary = await buildSummary(resolvedRange)
    let rows

    if (type === "users") {
      rows = [
        ["Metric", "Value"],
        ["New Users (selected range)", summary.userReport.newUsersInRange],
        ["Active Users (selected range)", summary.userReport.activeUsersInRange],
      ]
    } else if (type === "documents") {
      rows = [
        ["Metric", "Value"],
        ["Documents Created (selected range)", summary.documentReport.documentsCreatedInRange],
        ["Public Documents Created (selected range)", summary.documentReport.publicDocuments],
        ["Private Documents Created (selected range)", summary.documentReport.privateDocuments],
        ["Documents Deleted (selected range)", summary.documentReport.deletedDocuments],
      ]
    } else if (type === "storage") {
      rows = [
        ["Storage Activity (MB)", summary.storageReport.storageInRangeMb, ""],
        ["User", "Email", "Storage Activity (MB)"],
        ...summary.storageReport.topStorageUsers.map(user => [
          user.name,
          user.email,
          user.storageMb,
        ]),
      ]
    } else if (type === "login") {
      rows = [
        ["Total Logins (selected range)", summary.loginReport.loginsInRange, ""],
        ["User", "Email", "Logins"],
        ...summary.loginReport.topActiveUsers.map(user => [
          user.name,
          user.email,
          user.logins,
        ]),
      ]
    } else if (type === "security") {
      rows = [
        ["Metric", "Value"],
        ["Failed Admin Logins", summary.securityReport.failedAdminLogins],
        ["Admin Actions", summary.securityReport.adminActions],
        ["User Account Changes", summary.securityReport.userAccountChanges],
        ["Backup Events", summary.securityReport.backupEvents],
      ]
    } else {
      rows = [
        ["Metric", "Value"],
        ["Range Start", resolvedRange.start.toISOString()],
        ["Range End", resolvedRange.end.toISOString()],
        ["New Users", summary.userReport.newUsersInRange],
        ["Active Users", summary.userReport.activeUsersInRange],
        ["Documents Created", summary.documentReport.documentsCreatedInRange],
        ["Documents Deleted", summary.documentReport.deletedDocuments],
        ["Storage Activity (MB)", summary.storageReport.storageInRangeMb],
        ["Editor Sessions", summary.usageReport.trackedSessions],
        ["Total Editor Time (hours)", summary.usageReport.totalTimeSpentHours],
        ["Average Session Time (minutes)", summary.usageReport.avgTimeSpentMinutes],
        [
          "User Growth Share (current / current + previous)",
          `${summary.rangeGrowth.userGrowth.value}%`,
        ],
        [
          "Document Growth Share (current / current + previous)",
          `${summary.rangeGrowth.docGrowth.value}%`,
        ],
        ["Generated At", new Date().toISOString()],
      ]
    }

    const csv = rows
      .map(row =>
        row
          .map(value => `"${String(value ?? "").replace(/"/g, '""')}"`)
          .join(","),
      )
      .join("\n")

    res.setHeader("Content-Type", "text/csv; charset=utf-8")
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="kashur-editor-${type}-report-${Date.now()}.csv"`,
    )
    res.send(csv)
  } catch (error) {
    console.error("Reports CSV error:", error)
    res.status(error.status || 500).json({ error: error.message })
  }
})

router.__test = { growthShare, resolveDeletedCount }

module.exports = router
