import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './authContext.js'

// Sends anyone without a session to /login, remembering where they were headed.
export function RequireAuth() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <div className="loading-screen">Loading…</div>
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  return <Outlet />
}

// Non-admins never see admin pages; they land back on Projects.
export function RequireAdmin() {
  const { isAdmin } = useAuth()
  if (!isAdmin) return <Navigate to="/projects" replace />
  return <Outlet />
}
