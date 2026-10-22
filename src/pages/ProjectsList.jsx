import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api.js'

const stageLabels = {
  'in progress': 'In progress',
  blocked: 'Blocked',
  finished: 'Finished',
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function StageBadge({ stage }) {
  const key = (stage || '').replace(/\s+/g, '-')
  return <span className={`badge stage-${key}`}>{stageLabels[stage] || stage || '—'}</span>
}

function MissingCount({ count }) {
  if (!count) return <span className="badge badge-ok">None</span>
  return <span className="badge badge-warn">{count} missing</span>
}

export default function ProjectsList() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api('/projects')
      .then((data) => setProjects(data.projects))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const newProjectButton = (
    <Link to="/projects/new" className="primary-button link-button">New project</Link>
  )

  let content
  if (loading) {
    content = <p className="muted">Loading projects…</p>
  } else if (error) {
    content = <div className="alert alert-error" role="alert">{error}</div>
  } else if (projects.length === 0) {
    content = (
      <div className="empty-state">
        <h2>No projects yet</h2>
        <p>Projects you create will show up here with their BOM status.</p>
        {newProjectButton}
      </div>
    )
  } else {
    content = (
      <div className="panel">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Project</th>
                <th scope="col">Customer / division</th>
                <th scope="col">Style #</th>
                <th scope="col">Stage</th>
                <th scope="col">Created</th>
                <th scope="col">Missing BOM items</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                // The whole row is clickable; the name link keeps it keyboard and screen reader friendly.
                <tr key={p.id} className="clickable-row" onClick={() => navigate(`/projects/${p.id}`)}>
                  <td>
                    <Link to={`/projects/${p.id}`} onClick={(e) => e.stopPropagation()} className="row-title">
                      {p.name}
                    </Link>
                    {p.style_description && <div className="row-subtitle">{p.style_description}</div>}
                  </td>
                  <td>{p.customer || '—'}</td>
                  <td>{p.style_no || '—'}</td>
                  <td><StageBadge stage={p.stage} /></td>
                  <td>{formatDate(p.created_at)}</td>
                  <td><MissingCount count={p.missing_bom_items} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="page-header page-header-actions">
        <div>
          <h1>Projects</h1>
          <p>Every style in development or production, with BOM readiness and open items.</p>
        </div>
        {projects.length > 0 && newProjectButton}
      </div>

      {content}
    </>
  )
}
