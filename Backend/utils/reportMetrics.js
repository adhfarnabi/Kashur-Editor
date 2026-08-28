function currentPeriodShare(current, previous) {
  const currentValue = Math.max(0, Number(current) || 0)
  const previousValue = Math.max(0, Number(previous) || 0)
  const combinedValue = currentValue + previousValue

  return {
    value: combinedValue === 0
      ? 0
      : +((currentValue / combinedValue) * 100).toFixed(1),
    isNew: false,
  }
}

function resolveDeletedCount(eventCount, recordCount) {
  return Math.max(0, Number(eventCount) || 0, Number(recordCount) || 0)
}

module.exports = { currentPeriodShare, resolveDeletedCount }
