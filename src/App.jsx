import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Login from './pages/Login.jsx'
import ProjectsList from './pages/ProjectsList.jsx'
import ProjectPage from './pages/ProjectPage.jsx'
import Placeholder from './pages/Placeholder.jsx'

export default function App() {
  return (
    <Routes>
      {/* Login sits outside the app shell */}
      <Route path="/login" element={<Login />} />

      {/* Every page inside here shares the header, nav and page shell */}
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/projects" replace />} />
        <Route path="/projects" element={<ProjectsList />} />
        <Route path="/projects/:projectId" element={<ProjectPage />} />
        <Route path="/tasks" element={<Placeholder title="Tasks & follow-ups" />} />
        <Route path="/shipments" element={<Placeholder title="Shipments" />} />
        <Route path="/inventory" element={<Placeholder title="Inventory" />} />
        <Route path="/activity" element={<Placeholder title="Activity log" />} />
        <Route path="*" element={<Placeholder title="Page not found" />} />
      </Route>
    </Routes>
  )
}