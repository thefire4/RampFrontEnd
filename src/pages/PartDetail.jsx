import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api.js'
import { PART_FIELDS, isBlank, missingList } from './bomFields.js'

function PartDetailView({ projectId, partId }) {
  const [project, setProject] = useState(null)
  const [part, setPart] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    const pid = encodeURIComponent(projectId)
    Promise.all([api(`/projects/${pid}`), api(`/projects/${pid}/materials/${encodeURIComponent(partId)}`)])
      .then(([detail, result]) => {
        if (cancelled) return
        setProject(detail.project)
        setPart(result.material)
      })
      .catch((err) => { if (!cancelled) setError(err) })
    return () => { cancelled = true }
  }, [projectId, partId])

  const breadcrumb = (current) => (
    <nav className="breadcrumb" aria-label="Breadcrumb">
      <Link to="/projects">Projects</Link>
      {project && <> / <Link to={`/projects/${projectId}`}>{project.name}</Link></>}
      {' / '}<span>{current}</span>
    </nav>
  )

  if (error) {
    const notFound = error.status === 404
    return (
      <>
        {breadcrumb(notFound ? 'Not found' : 'Error')}
        <div className="empty-state" role="alert">
          <h2>{notFound ? 'Part not found' : "Couldn't load this part"}</h2>
          <p>{notFound ? "This part doesn't exist in this project or may have been deleted." : error.message}</p>
          <Link to={`/projects/${projectId}`} className="primary-button link-button">Back to project</Link>
        </div>
      </>
    )
  }

  if (!part) {
    return (
      <>
        {breadcrumb('Loading…')}
        <p className="muted" role="status">Loading part…</p>
      </>
    )
  }

  const missing = part.missing_fields || []

  return (
    <>
      {breadcrumb(part.name || 'Unnamed line')}

      <div className="page-header">
        <div className="project-title">
          <h1>{part.name || 'Unnamed line'}</h1>
          {!isBlank(part.article_no) && <span className="chip">{part.article_no}</span>}
          {missing.length === 0
            ? <span className="badge badge-ok">Complete</span>
            : <span className="badge badge-missing">Missing {missingList(part)}</span>}
        </div>
        {part.colorway_name && <p>Colorway: {part.colorway_name}</p>}
      </div>

      <section className="panel" aria-label="Part details">
        <dl className="detail-grid">
          {PART_FIELDS.map(([field, label]) => {
            const isMissing = missing.includes(field)
            return (
              <div key={field} className={isMissing ? 'detail-missing' : undefined}>
                <dt>{label}</dt>
                <dd>
                  {isMissing && isBlank(part[field])
                    ? <span className="missing-text">Missing</span>
                    : isBlank(part[field]) ? '—' : String(part[field])}
                  {isMissing && !isBlank(part[field]) && <span className="missing-text"> (needs a value above 0)</span>}
                </dd>
              </div>
            )
          })}
        </dl>
      </section>

      <div className="form-actions">
        {missing.length > 0 && (
          <Link to={`/projects/${projectId}/missing`} className="secondary-button link-button">Back to missing items</Link>
        )}
        <Link to={`/projects/${projectId}`} className="secondary-button link-button">Back to project</Link>
      </div>
    </>
  )
}

export default function PartDetail() {
  const { projectId, partId } = useParams()
  return <PartDetailView key={`${projectId}-${partId}`} projectId={projectId} partId={partId} />
}