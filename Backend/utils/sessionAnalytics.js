// Groups timestamped heartbeat segments into logical editor sessions.
function summarizeEditorSessions(events, rangeStart, rangeEnd) {
  const gapLimitMs = 2 * 60 * 1000
  const sessionsByUser = new Map()

  const sorted = [...events].sort((a, b) => {
    const userCompare = String(a.actorId || "").localeCompare(String(b.actorId || ""))
    return userCompare || new Date(a.createdAt) - new Date(b.createdAt)
  })

  for (const event of sorted) {
    const rawSeconds = Number(event.meta?.durationSeconds)
    if (!Number.isFinite(rawSeconds) || rawSeconds <= 0) continue

    const userKey = String(event.actorId || event.actorEmail || "unknown")
    const eventEnd = Math.min(new Date(event.createdAt).getTime(), rangeEnd.getTime())
    const eventStart = Math.max(eventEnd - rawSeconds * 1000, rangeStart.getTime())
    const seconds = Math.max(0, (eventEnd - eventStart) / 1000)
    if (!seconds) continue

    if (!sessionsByUser.has(userKey)) {
      sessionsByUser.set(userKey, {
        name: event.actorName || "Unknown",
        email: event.actorEmail || "—",
        sessions: [],
      })
    }

    const user = sessionsByUser.get(userKey)
    const currentSession = user.sessions[user.sessions.length - 1]
    if (!currentSession || eventStart - currentSession.end > gapLimitMs) {
      user.sessions.push({ start: eventStart, end: eventEnd, seconds })
    } else {
      currentSession.end = Math.max(currentSession.end, eventEnd)
      currentSession.seconds += seconds
    }
  }

  const allSessions = []
  const topTimeUsers = []
  for (const user of sessionsByUser.values()) {
    const totalSeconds = user.sessions.reduce((sum, session) => sum + session.seconds, 0)
    allSessions.push(...user.sessions)
    topTimeUsers.push({
      name: user.name,
      email: user.email,
      totalSeconds,
      sessions: user.sessions.length,
    })
  }
  topTimeUsers.sort((a, b) => b.totalSeconds - a.totalSeconds)

  const totalSeconds = allSessions.reduce((sum, session) => sum + session.seconds, 0)
  const durations = allSessions.map(session => session.seconds)
  return {
    totalSeconds,
    trackedSessions: allSessions.length,
    avgSeconds: durations.length ? totalSeconds / durations.length : 0,
    longestSeconds: durations.length ? Math.max(...durations) : 0,
    shortestSeconds: durations.length ? Math.min(...durations) : 0,
    topTimeUsers: topTimeUsers.slice(0, 10),
  }
}

module.exports = { summarizeEditorSessions }
