import { NavLink, Outlet, Link } from 'react-router-dom'

const navItems = [
  { to: '/projects', label: 'Projects' },
  { to: '/tasks', label: 'Tasks & follow-ups' },
  { to: '/shipments', label: 'Shipments' },
  { to: '/inventory', label: 'Inventory' },
  { to: '/activity', label: 'Activity log' },
]

export default function Layout() {
  return (
    <div className="app">
      <header className="app-header">
        <Link to="/projects" className="brand">RAMP CORE OS</Link>
        <span className="version">v0.1</span>

        <div className="header-search">
          <label htmlFor="global-search" className="visually-hidden">Search</label>
          <input id="global-search" type="search" placeholder="Search styles, POs, vendors" />
        </div>

        <button type="button" className="header-button">Account</button>
      </header>

      <div className="app-body">
        <nav className="app-nav" aria-label="Main">
          {navItems.map((item) => (
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