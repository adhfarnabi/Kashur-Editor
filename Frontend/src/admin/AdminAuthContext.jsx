// src/admin/AdminAuthContext.jsx
import { createContext, useContext, useEffect, useState } from "react"
import { adminApi, getAdminToken, setAdminToken, clearAdminToken } from "./adminApi"

const AdminAuthContext = createContext(null)
export const useAdminAuth = () => useContext(AdminAuthContext)

export function AdminAuthProvider({ children }) {
  const [admin, setAdmin]     = useState(null)
  const [isLoading, setLoading] = useState(true)

  useEffect(() => {
    const token = getAdminToken()
    if (!token) { setLoading(false); return }

    adminApi.me()
      .then(({ admin }) => setAdmin(admin))
      .catch(() => clearAdminToken())
      .finally(() => setLoading(false))
  }, [])

  async function login(email, password) {
    const { token, admin } = await adminApi.login(email, password)
    setAdminToken(token)
    setAdmin(admin)
    return admin
  }

  function logout() {
    clearAdminToken()
    setAdmin(null)
  }

  return (
    <AdminAuthContext.Provider value={{ admin, isLoading, login, logout }}>
      {children}
    </AdminAuthContext.Provider>
  )
}
