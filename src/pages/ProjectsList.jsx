import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
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

const STATUS_OPTIONS = [
  ['missing', 'Missing info'],
  ['complete', 'BOM complete'],
  ['empty', 'No BOM yet'],
]

function bomStatus(p) {
  if (p.total_bom_lines === 0) return 'empty'
  return p.missing_bom_items > 0 ? 'missing' : 'complete'
}

function matchesSearch(p, query) {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  return [p.name, p.style_no, p.po_no, p.customer, p.style_description]
    .some((value) => value && String(value).toLowerCase().includes(needle))
}

function filterProjects(projects, { q, stage, division, status }) {
  return projects.filter((p) =>
    matchesSearch(p, q) &&
    (!stage || p.stage === stage) &&
    (!division || p.customer === division) &&
    (!status || bomStatus(p) === status)
  )
}

function ProjectFilters({ projects, filters, onChange, onClear, active }) {
  const divisions = [...new Set(projects.map((p) => p.customer).filter((c) => c && c.trim()))]
    .sort((a, b) => a.localeCompare(b))
  const stages = [...new Set([...Object.keys(stageLabels), ...projects.map((p) => p.stage).filter(Boolean)])]

  return (
    <div className="filter-bar" role="search" aria-label="Filter projects">
      <div className="field filter-search">
        <label htmlFor="project-search">Search</label>
        <input
          id="project-search"
          type="search"
          placeholder="Name, style #, PO or customer"
          value={filters.q}
          onChange={(e) => onChange('q', e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="filter-stage">Stage</label>
        <select id="filter-stage" value={filters.stage} onChange={(e) => onChange('stage', e.target.value)}>
          <option value="">All stages</option>
          {stages.map((s) => <option key={s} value={s}>{stageLabels[s] || s}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="filter-division">Division</label>
        <select id="filter-division" value={filters.division} onChange={(e) => onChange('division', e.target.value)}>
          <option value="">All divisions</option>
          {divisions.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="filter-status">BOM status</label>
        <select id="filter-status" value={filters.status} onChange={(e) => onChange('status', e.target.value)}>
          <option value="">Any status</option>
          {STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      <button type="button" className="secondary-button" onClick={onClear} disabled={!active}>
        Clear filters
      </button>
    </div>
  )
}

export default function ProjectsList() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api('/projects')
      .then((data) => setProjects(data.projects))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const filters = {
    q: searchParams.get('q') ?? '',
    stage: searchParams.get('stage') ?? '',
    division: searchParams.get('division') ?? '',
    status: searchParams.get('status') ?? '',
  }
  const filtersActive = Object.values(filters).some((v) => v !== '')
  const visible = filterProjects(projects, filters)

  function setFilter(key, value) {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    setSearchParams(next, { replace: true })
  }

  function clearFilters() {
    setSearchParams({}, { replace: true })
  }

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
  } else if (visible.length === 0) {
    content = (
      <div className="empty-state">
        <h2>No projects match</h2>
        <p>Try a different search or clear the filters.</p>
        <button type="button" className="primary-button link-button" onClick={clearFilters}>Clear filters</button>
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
              {visible.map((p) => (
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

      {!loading && !error && projects.length > 0 && (
        <>
          <ProjectFilters
            projects={projects}
            filters={filters}
            onChange={setFilter}
            onClear={clearFilters}
            active={filtersActive}
          />
          <p className="result-count" aria-live="polite">
            {filtersActive ? `Showing ${visible.length} of ${projects.length} projects` : `${projects.length} projects`}
          </p>
        </>
      )}

      {content}
    </>
  )
}