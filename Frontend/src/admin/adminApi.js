// src/admin/adminApi.js
// Thin fetch wrapper for every /api/admin/* call. Keeps the admin token
// handling in one place so components stay simple.
const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:3001/api").replace(/\/$/, "")
const TOKEN_KEY = "kashur_admin_token"

export function getAdminToken() {
  return localStorage.getItem(TOKEN_KEY)
}
export function setAdminToken(token) {
  localStorage.setItem(TOKEN_KEY, token)
}
export function clearAdminToken() {
  localStorage.removeItem(TOKEN_KEY)
}

async function request(path, { method = "GET", body, headers = {} } = {}) {
  const token = getAdminToken()
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  let data = null
  try { data = await res.json() } catch { /* no body */ }

  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`)
    err.status = res.status
    err.code = data?.code
    throw err
  }
  return data
}

export const adminApi = {
  // Auth
  login: (email, password) => request("/admin/auth/login", { method: "POST", body: { email, password } }),
  me: () => request("/admin/auth/me"),
  changePassword: (body) => request("/admin/auth/change-password", { method: "POST", body }),

  // Dashboard
  dashboard: () => request("/admin/dashboard"),
  analytics: () => request("/admin/analytics"),

  // Users
  users: (params = "") => request(`/admin/users${params}`),
  user: (id) => request(`/admin/users/${id}`),
  onlineUsers: () => request("/admin/users/online"),
  loginHistory: (params = "") => request(`/admin/users/login-history${params}`),
  setUserStatus: (id, active) => request(`/admin/users/${id}/status`, { method: "PATCH", body: { active } }),
  deleteUser: (id) => request(`/admin/users/${id}`, { method: "DELETE" }),
  createUser: (body) => request(`/admin/users`, { method: "POST", body }),
  verifyUserEmail: (id) => request(`/admin/users/${id}/verify`, { method: "PATCH" }),
  resetUserPassword: (id) => request(`/admin/users/${id}/reset-password`, { method: "POST" }),

  // Documents
  documents: (params = "") => request(`/admin/documents${params}`),
  document: (id) => request(`/admin/documents/${id}`),
  deleteDocument: (id) => request(`/admin/documents/${id}`, { method: "DELETE" }),
  restoreDocument: (id) => request(`/admin/documents/${id}/restore`, { method: "PATCH" }),
  archiveDocument: (id, archived) => request(`/admin/documents/${id}/archive`, { method: "PATCH", body: { archived } }),
  setDocumentApproval: (id, status) => request(`/admin/documents/${id}/approval`, { method: "PATCH", body: { status } }),

  // Reports
  reports: (params = "") => request(`/admin/reports${params}`),
  reportsCsvUrl: (params = "") => `${API_BASE}/admin/reports/export.csv${params}`,

  // Fonts
  fonts: () => request("/admin/fonts"),
  createFont: (body) => request("/admin/fonts", { method: "POST", body }),
  updateFont: (id, body) => request(`/admin/fonts/${id}`, { method: "PUT", body }),
  deleteFont: (id) => request(`/admin/fonts/${id}`, { method: "DELETE" }),

  // Templates
  templates: (params = "") => request(`/admin/templates${params}`),
  createTemplate: (body) => request("/admin/templates", { method: "POST", body }),
  updateTemplate: (id, body) => request(`/admin/templates/${id}`, { method: "PUT", body }),
  deleteTemplate: (id) => request(`/admin/templates/${id}`, { method: "DELETE" }),

  // Dictionary
  dictionary: (params = "") => request(`/admin/dictionary${params}`),
  createDictionaryEntry: (body) => request("/admin/dictionary", { method: "POST", body }),
  bulkDictionary: (entries) => request("/admin/dictionary/bulk", { method: "POST", body: { entries } }),
  updateDictionaryEntry: (id, body) => request(`/admin/dictionary/${id}`, { method: "PUT", body }),
  deleteDictionaryEntry: (id) => request(`/admin/dictionary/${id}`, { method: "DELETE" }),

  // Shapes
  shapes: (params = "") => request(`/admin/shapes${params}`),
  createShape: (body) => request("/admin/shapes", { method: "POST", body }),
  updateShape: (id, body) => request(`/admin/shapes/${id}`, { method: "PUT", body }),
  deleteShape: (id) => request(`/admin/shapes/${id}`, { method: "DELETE" }),

  // Backup
  exportBackup: (include) => request(`/admin/backup/export${include ? `?include=${include}` : ""}`),
  restoreBackup: (body) => request("/admin/backup/restore", { method: "POST", body }),

  // Settings
  getSettings: () => request("/admin/settings"),
  updateSettings: (body) => request("/admin/settings", { method: "PUT", body }),

  // Activity
  activity: (params = "") => request(`/admin/activity${params}`),

  // Feedback
  feedback: (params = "") => request(`/admin/feedback${params}`),
  setFeedbackStatus: (id, status) => request(`/admin/feedback/${id}/status`, { method: "PATCH", body: { status } }),
  replyFeedback: (id, message) => request(`/admin/feedback/${id}/reply`, { method: "POST", body: { message } }),
  deleteFeedback: (id) => request(`/admin/feedback/${id}`, { method: "DELETE" }),
}
