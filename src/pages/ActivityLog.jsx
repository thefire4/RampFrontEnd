import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api.js'

// RAMP-154: a project's change history, from GET /api/projects/:id/history
// (newest first; one entry per changed field).

const FIELD_LABELS = {
  name: 'Description',
  material: 'Material',
  supplier: 'Supplier',
  supplier_contact: 'Responsible',
  color: 'Color',
  quantity: 'Yield',
  uom: 'Unit',
  location: 'Placement',
  material_size: 'Size / width',
  article_no: 'Article #',
  notes: 'Notes',
}
const ACTION_LABELS = { created: 'Added', updated: 'Changed', deleted: 'Removed' }
const ACTION_BADGES = { created: 'badge-ok', updated: 'stage-in-progress', deleted: 'badge-missing' }
const UNKNOWN_USER = 'Unknown user'

function fieldLabel(field) {
  return FIELD_LABELS[field] || field || '—'
}

function userLabel(entry) {
  return entry.username || UNKNOWN_USER
}

function formatTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

function Value({ value }) {
  if (value === null || value === undefined || value === '') return <span className="muted-dash">—</span>
  return value
}

function ActionBadge({ action }) {
  if (!ACTION_LABELS[action]) return null
  return <span className={`badge ${ACTION_BADGES[action]}`}>{ACTION_LABELS[action]}</span>
}

function Breadcrumb({ project, projectId }) {
  return (
    <nav className="breadcrumb" aria-label="Breadcrumb">
      <Link to="/projects">Projects</Link>
      {' / '}
      <Link to={`/projects/${projectId}`}>{project?.name || 'Project'}</Link>
      {' / '}
      <span>Activity log</span>
    </nav>
  )
}

function LineCell({ entry, projectId, lineNames }) {
  const line = lineNames.get(entry.entity_id)
  if (!line) return <span className="muted">Removed line</span>
  return (
    <>
      <Link to={`/projects/${projectId}/parts/${entry.entity_id}`}>{line.name}</Link>
      {line.colorway && <div className="row-subtitle">{line.colorway}</div>}
    </>
  )
}

function ActivityLogView({ projectId }) {
  const [project, setProject] = useState(null)
  const [lineNames, setLineNames] = useState(new Map())
  const [history, setHistory] = useState(null)
  const [error, setError] = useState(null)
  const [user, setUser] = useState('')
  const [field, setField] = useState('')

  useEffect(() => {
    let cancelled = false
    const id = encodeURIComponent(projectId)
    Promise.all([api(`/projects/${id}`), api(`/projects/${id}/history`)])
      .then(([detail, log]) => {
        if (cancelled) return
        setProject(detail.project)
        const names = new Map()
        for (const c of detail.colorways ?? []) {
          for (const m of c.materials ?? []) names.set(m.id, { name: m.name || 'Unnamed line', colorway: c.name })
        }
        setLineNames(names)
        setHistory(log.history ?? [])
      })
      .catch((err) => {
        if (!cancelled) setError(err)
      })
    return () => {
      cancelled = true
    }
  }, [projectId])

  const users = useMemo(
    () => [...new Set((history ?? []).map(userLabel))].sort((a, b) => a.localeCompare(b)),
    [history]
  )
  const fields = useMemo(
    () => [...new Set((history ?? []).map((e) => e.field_name).filter(Boolean))]
      .sort((a, b) => fieldLabel(a).localeCompare(fieldLabel(b))),
    [history]
  )
  const shown = useMemo(
    () => (history ?? []).filter((e) => (!user || userLabel(e) === user) && (!field || e.field_name === field)),
    [history, user, field]
  )

  if (error) {
    const notFound = error.status === 404
    return (
      <>
        <Breadcrumb projectId={projectId} />
        <div className="empty-state" role="alert">
          <h2>{notFound ? 'Project not found' : "Couldn't load the activity log"}</h2>
          <p>{notFound ? 'It may have been removed, or the link is wrong.' : error.message}</p>
          <Link to="/projects" className="primary-button link-button">Back to projects</Link>
        </div>
      </>
    )
  }

  if (!history) return <p className="muted" role="status">Loading activity…</p>

  const filtering = Boolean(user || field)
  function clearFilters() {
    setUser('')
    setField('')
  }

  return (
    <>
      <Breadcrumb project={project} projectId={projectId} />

      <div className="page-header">
        <h1>Activity log</h1>
        <p>Every change made to {project.name}, newest first.</p>
      </div>

      {history.length === 0 ? (
        <div className="empty-state">
          <h2>No changes yet</h2>
          <p>Edits to this project&apos;s BOM will show up here, with who made them and when.</p>
          <Link to={`/projects/${projectId}`} className="primary-button link-button">Back to project</Link>
        </div>
      ) : (
        <>
          <div className="filter-bar" role="search" aria-label="Filter changes">
            <div className="field">
              <label htmlFor="activity-user">User</label>
              <select id="activity-user" value={user} onChange={(e) => setUser(e.target.value)}>
                <option value="">All users</option>
                {users.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="activity-field">Field</label>
              <select id="activity-field" value={field} onChange={(e) => setField(e.target.value)}>
                <option value="">All fields</option>
                {fields.map((f) => <option key={f} value={f}>{fieldLabel(f)}</option>)}
              </select>
            </div>
            <button type="button" className="secondary-button" onClick={clearFilters} disabled={!filtering}>
              Clear filters
            </button>
          </div>

          <p className="muted result-count" role="status">
            {filtering
              ? `Showing ${shown.length} of ${history.length} changes`
              : `${history.length} ${history.length === 1 ? 'change' : 'changes'}`}
          </p>

          {shown.length === 0 ? (
            <div className="empty-state">
              <h2>No changes match</h2>
              <p>Try a different user or field.</p>
              <button type="button" className="primary-button" onClick={clearFilters}>Clear filters</button>
            </div>
          ) : (
            <section className="panel panel-flush" aria-label="Changes">
              <table className="data-table activity-table">
                <thead>
                  <tr>
                    <th scope="col">When</th>
                    <th scope="col">User</th>
                    <th scope="col">BOM line</th>
                    <th scope="col">Field</th>
                    <th scope="col">Old value</th>
                    <th scope="col">New value</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((entry) => (
                    <tr key={entry.id}>
                      <td className="nowrap">
                        <time dateTime={entry.changed_at || undefined}>{formatTime(entry.changed_at)}</time>
                      </td>
                      <td>{userLabel(entry)}</td>
                      <td><LineCell entry={entry} projectId={projectId} lineNames={lineNames} /></td>
                      <td>
                        <div>{entry.field_name ? fieldLabel(entry.field_name) : <span className="muted-dash">—</span>}</div>
                        <ActionBadge action={entry.action} />
                      </td>
                      <td className="old-value"><Value value={entry.old_value} /></td>
                      <td className="new-value"><Value value={entry.new_value} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </>
      )}
    </>
  )
}

export default function ActivityLog() {
  const { projectId } = useParams()
  return <ActivityLogView key={projectId} projectId={projectId} />
}