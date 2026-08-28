const test = require("node:test")
const assert = require("node:assert/strict")
const { summarizeEditorSessions } = require("../utils/sessionAnalytics")

const rangeStart = new Date("2026-07-30T00:00:00.000Z")
const rangeEnd = new Date("2026-07-31T00:00:00.000Z")

test("consecutive heartbeat segments become one editor session", () => {
  const summary = summarizeEditorSessions([
    {
      actorId: "user-1",
      actorName: "Adhfar ",
      meta: { durationSeconds: 60 },
      createdAt: new Date("2026-07-30T01:01:00.000Z"),
    },
    {
      actorId: "user-1",
      actorName: "Adhfar",
      meta: { durationSeconds: 60 },
      createdAt: new Date("2026-07-30T01:02:00.000Z"),
    },
  ], rangeStart, rangeEnd)

  assert.equal(summary.trackedSessions, 1)
  assert.equal(summary.totalSeconds, 120)
  assert.equal(summary.avgSeconds, 120)
})

test("a gap creates a separate session and shortest/longest remain accurate", () => {
  const summary = summarizeEditorSessions([
    {
      actorId: "user-1",
      meta: { durationSeconds: 60 },
      createdAt: new Date("2026-07-30T01:01:00.000Z"),
    },
    {
      actorId: "user-1",
      meta: { durationSeconds: 30 },
      createdAt: new Date("2026-07-30T03:00:30.000Z"),
    },
  ], rangeStart, rangeEnd)

  assert.equal(summary.trackedSessions, 2)
  assert.equal(summary.totalSeconds, 90)
  assert.equal(summary.longestSeconds, 60)
  assert.equal(summary.shortestSeconds, 30)
})

test("duration is clipped to the selected reporting window", () => {
  const summary = summarizeEditorSessions([
    {
      actorId: "user-1",
      meta: { durationSeconds: 120 },
      createdAt: new Date("2026-07-30T00:01:00.000Z"),
    },
  ], rangeStart, rangeEnd)

  assert.equal(summary.totalSeconds, 60)
})
