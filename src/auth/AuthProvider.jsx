import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, setUnauthorizedHandler } from '../api.js'
import { AuthContext } from './authContext.js'

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // On first load, ask the backend whether we already have a session.
  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null))
    api('/me')
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (username, password) => {
    await api('/login', { method: 'POST', body: { username, password } })
    const me = await api('/me')
    setUser(me)
    return me
  }, [])

  const logout = useCallback(async () => {
    try {
      await api('/logout', { method: 'POST' })
    } finally {
      // Clear local state even if the request failed, so the user is never stuck "logged in".
      setUser(null)
    }
  }, [])

  const value = useMemo(
    () => ({ user, loading, isAdmin: user?.role === 'admin', login, logout }),
    [user, loading, login, logout]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
