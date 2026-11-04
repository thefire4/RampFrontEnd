import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api.js'
import { fieldLabel, isBlank, missingList } from './bomFields.js'

// Required fields shown as columns; yield and unit share one column
const COLUMNS = [
  { label: 'Material', fields: ['material'] },
  { label: 'Supplier', fields: ['supplier'] },
  { label: 'Responsible', fields: ['supplier_contact'] },
  { label: 'Color', fields: ['color'] },
  { label: 'Placement', fields: ['location'] },
  { label: 'Size / width', fields: ['material_size'] },
  { label: 'Yield', fields: ['quantity', 'uom'] },
]

function cellText(item, fields) {
  if (fields.length === 2) {
    const [qty, unit] = fields
    return [item[qty], item[unit]].filter((v) => !isBlank(v)).join(' ')
  }
  return item[fields[0]]
}

function MissingItemsView({ projectId }) {
  const [project, setProject] = useState(null)
  const [items, setItems] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    const id = encodeURIComponent(projectId)
    Promise.all([api(`/projects/${id}`), api(`/projects/${id}/missing-items`)])
      .then(([detail, missing]) => {
        if (cancelled) return
        setProject(detail.project)
        setItems(missing.missing_items)
      })
      .catch((err) => { if (!cancelled) setError(err) })
    return () => { cancelled = true }
  }, [projectId])

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
          <h2>{notFound ? 'Project not found' : "Couldn't load missing items"}</h2>
          <p>{notFound ? "This project doesn't exist or may have been deleted." : error.message}</p>
          <Link to="/projects" className="primary-button link-button">Back to projects</Link>
        </div>
      </>
    )
  }

  if (!items) {
    return (
      <>
        {breadcrumb('Missing items')}
        <p className="muted" role="status">Loading missing items…</p>
      </>
    )
  }

  return (
    <>
      {breadcrumb('Missing items')}
      <div className="page-header">
        <h1>Missing items</h1>
        <p>
          {items.length === 0
            ? `Every BOM line in ${project.name} has its required details.`
            : `${items.length} BOM ${items.length === 1 ? 'line' : 'lines'} in ${project.name} still need details. Click a part to see all of its fields.`}
        </p>
      </div>

      {items.length === 0 ? (
        <div className="empty-state">
          <h2>Nothing missing</h2>
          <p>This project has no missing BOM items.</p>
          <Link to={`/projects/${projectId}`} className="primary-button link-button">Back to project</Link>
        </div>
      ) : (
        <section className="panel panel-flush" aria-label="Missing items">
          <div className="table-wrap">
            <table className="data-table bom-table">
              <thead>
                <tr>
                  <th scope="col">Part</th>
                  <th scope="col">Colorway</th>
                  {COLUMNS.map((c) => <th scope="col" key={c.label}>{c.label}</th>)}
                  <th scope="col">Missing</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="row-open">
                    <td>
                      <Link to={`/projects/${projectId}/parts/${item.id}`} className="row-title">
                        {item.name || 'Unnamed line'}
                      </Link>
                      {!isBlank(item.article_no) && <div className="row-subtitle mono">{item.article_no}</div>}
                    </td>
                    <td>{item.colorway_name || '—'}</td>
                    {COLUMNS.map((c) => {
                      const gaps = c.fields.filter((f) => item.missing_fields?.includes(f))
                      const text = cellText(item, c.fields)
                      return (
                        <td key={c.label} className={gaps.length ? 'cell-missing' : undefined}>
                          {isBlank(text) ? (gaps.length ? <span className="missing-text">Missing</span> : '—') : text}
                          {/* e.g. a yield that has a number but no unit */}
                          {gaps.length > 0 && !isBlank(text) && (
                            <div className="missing-text">No {gaps.map((f) => fieldLabel(f).toLowerCase()).join(' or ')}</div>
                          )}
                        </td>
                      )
                    })}
                    <td><span className="badge badge-missing">{missingList(item)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  )
}

export default function MissingItems() {
  const { projectId } = useParams()
  return <MissingItemsView key={projectId} projectId={projectId} />
}