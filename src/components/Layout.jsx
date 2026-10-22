import { useState } from 'react'
import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/authContext.js'

const navItems = [
  { to: '/projects', label: 'Projects' },
  { to: '/tasks', label: 'Tasks & follow-ups' },
  { to: '/shipments', label: 'Shipments' },
  { to: '/inventory', label: 'Inventory' },
  { to: '/activity', label: 'Activity log' },
]

const adminNavItems = [{ to: '/users', label: 'Users' }]

export default function Layout() {
  const { user, isAdmin, logout } = useAuth()
  const navigate = useNavigate()
  const [loggingOut, setLoggingOut] = useState(false)

  async function handleLogout() {
    setLoggingOut(true)
    try {
      await logout()
    } catch {
      // Local session is cleared either way; nothing else to do.
    }
    navigate('/login', { replace: true })
  }

  const visibleNav = isAdmin ? [...navItems, ...adminNavItems] : navItems

  return (
    <div className="app">
      <header className="app-header">
        <Link to="/projects" className="brand">RAMP CORE OS</Link>
        <span className="version">v0.1</span>

        <div className="header-search">
          <label htmlFor="global-search" className="visually-hidden">Search</label>
          <input id="global-search" type="search" placeholder="Search styles, POs, vendors" />
        </div>

        <div className="header-account">
          <span className="header-user">{user.username}</span>
          <Link to="/account/password" className="header-button">Change password</Link>
          <button type="button" className="header-button" onClick={handleLogout} disabled={loggingOut}>
            {loggingOut ? 'Logging out…' : 'Log out'}
          </button>
        </div>
      </header>

      <div className="app-body">
        <nav className="app-nav" aria-label="Main">
          {visibleNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <main className="app-main">
          <div className="page">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
