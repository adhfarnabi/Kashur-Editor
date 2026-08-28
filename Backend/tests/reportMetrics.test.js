const test = require("node:test")
const assert = require("node:assert/strict")
const { currentPeriodShare, resolveDeletedCount } = require("../utils/reportMetrics")

test("one current document and no previous document gives 100 percent", () => {
  assert.deepEqual(currentPeriodShare(1, 0), { value: 100, isNew: false })
})

test("equal current and previous activity gives 50 percent", () => {
  assert.deepEqual(currentPeriodShare(1, 1), { value: 50, isNew: false })
})

test("three current documents and one previous document gives 75 percent", () => {
  assert.deepEqual(currentPeriodShare(3, 1), { value: 75, isNew: false })
})

test("no current activity gives zero percent and an empty comparison is safe", () => {
  assert.deepEqual(currentPeriodShare(0, 3), { value: 0, isNew: false })
  assert.deepEqual(currentPeriodShare(0, 0), { value: 0, isNew: false })
})

test("deleted count uses logged deletion events and legacy record fallback", () => {
  assert.equal(resolveDeletedCount(3, 1), 3)
  assert.equal(resolveDeletedCount(0, 2), 2)
  assert.equal(resolveDeletedCount(undefined, undefined), 0)
})
