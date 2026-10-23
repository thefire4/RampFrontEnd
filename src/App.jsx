import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import { RequireAdmin, RequireAuth } from './auth/guards.jsx'
import Login from './pages/Login.jsx'
import ProjectsList from './pages/ProjectsList.jsx'
import ProjectPage from './pages/ProjectPage.jsx'
import ChangePassword from './pages/ChangePassword.jsx'
import Users from './pages/Users.jsx'
import Placeholder from './pages/Placeholder.jsx'
import NewProject from './pages/NewProject.jsx'

export default function App() {
  return (
    <Routes>
      {/* Login sits outside the app shell */}
      <Route path="/login" element={<Login />} />

      {/* Everything else needs a session; logged-out users are sent to /login */}
      <Route element={<RequireAuth />}>
        {/* Every page inside here shares the header, nav and page shell */}
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/projects" replace />} />
          <Route path="/projects" element={<ProjectsList />} />
          <Route path="/projects/new" element={<NewProject />} />
          <Route path="/projects/:projectId" element={<ProjectPage />} />
          <Route path="/tasks" element={<Placeholder title="Tasks & follow-ups" />} />
          <Route path="/shipments" element={<Placeholder title="Shipments" />} />
          <Route path="/inventory" element={<Placeholder title="Inventory" />} />
          <Route path="/activity" element={<Placeholder title="Activity log" />} />
          <Route path="/account/password" element={<ChangePassword />} />

          {/* Admin-only pages */}
          <Route element={<RequireAdmin />}>
            <Route path="/users" element={<Users />} />
          </Route>

          <Route path="*" element={<Placeholder title="Page not found" />} />
        </Route>
      </Route>
    </Routes>
  )
}
