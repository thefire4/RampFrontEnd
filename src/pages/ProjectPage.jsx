import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api.js'

// Expects GET /api/projects/:id to return
// { project: {...}, colorways: [{ id, name, materials: [...] }], files: [{ id, file_name, file_type, url, created_at }] }

const stageLabels = {
  'in progress': 'In progress',
  blocked: 'Blocked',
  finished: 'Finished',
}

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']

// Same rule as the backend's missing-BOM count: these fields must be filled in.
const REQUIRED_BOM_FIELDS = ['material', 'supplier', 'color', 'quantity']

function isBlank(value) {
  return value === null || value === undefined || String(value).trim() === ''
}

function isImage(file) {
  const type = (file.file_type || '').toLowerCase()
  const ext = (file.file_name || '').split('.').pop().toLowerCase()
  return type.startsWith('image/') || IMAGE_EXTENSIONS.includes(type) || IMAGE_EXTENSIONS.includes(ext)
}

function formatDate(value) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function StageBadge({ stage }) {
  const key = (stage || '').replace(/\s+/g, '-')
  return <span className={`badge stage-${key}`}>{stageLabels[stage] || stage || '—'}</span>
}

function ProjectDetails({ project }) {
  const details = [
    ['Customer / division', project.customer],
    ['Style #', project.style_no],
    ['PO #', project.po_no],
    ['Date', formatDate(project.project_date || project.created_at)],
    ['Season', project.season],
    ['Designer', project.designer],
    ['Size range', project.size_range],
    ['Fabric / yarn', project.fabric_yarn],
    ['Weight', project.weight],
  ]
  // The first four always show (with a dash if empty); the extras only when filled in.
  const visible = details.filter(([, value], i) => i < 4 || !isBlank(value))

  return (
    <section className="panel" aria-labelledby="details-heading">
      <h2 id="details-heading" className="visually-hidden">Project details</h2>
      <dl className="detail-grid">
        <div>
          <dt>Stage</dt>
          <dd><StageBadge stage={project.stage} /></dd>
        </div>
        {visible.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{isBlank(value) ? '—' : value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function BomCell({ material, field }) {
  const value = material[field]
  if (!isBlank(value)) return value
  if (REQUIRED_BOM_FIELDS.includes(field)) return <span className="badge badge-warn">Missing</span>
  return <span className="muted-dash">—</span>
}

function BomTable({ colorways }) {
  const [selectedId, setSelectedId] = useState(colorways[0]?.id)
  const selected = colorways.find((c) => c.id === selectedId) || colorways[0]
  const totalLines = colorways.reduce((sum, c) => sum + c.materials.length, 0)

  return (
    <section className="panel" aria-labelledby="bom-heading">
      <div className="section-header">
        <h2 id="bom-heading">BOM</h2>
        <span className="muted">{totalLines} {totalLines === 1 ? 'line' : 'lines'}</span>
      </div>

      {colorways.length === 0 ? (
        <p className="muted">No BOM lines yet.</p>
      ) : (
        <>
          {colorways.length > 1 && (
            <div className="segmented" role="group" aria-label="Colorway">
              {colorways.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={c.id === selected.id}
                  onClick={() => setSelectedId(c.id)}
                >
                  {c.name} <span className="count">{c.materials.length}</span>
                </button>
              ))}
            </div>
          )}

          {selected.materials.length === 0 ? (
            <p className="muted">No BOM lines for {selected.name} yet.</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table bom-table">
                <caption className="visually-hidden">BOM lines for {selected.name}</caption>
                <thead>
                  <tr>
                    <th scope="col">Item</th>
                    <th scope="col">Material</th>
                    <th scope="col">Supplier</th>
                    <th scope="col">Article #</th>
                    <th scope="col">Size</th>
                    <th scope="col">Qty</th>
                    <th scope="col">UOM</th>
                    <th scope="col">Color</th>
                    <th scope="col">Placement</th>
                    <th scope="col">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.materials.map((m) => (
                    <tr key={m.id}>
                      <td className="row-title">{m.name || '—'}</td>
                      <td><BomCell material={m} field="material" /></td>
                      <td>
                        <BomCell material={m} field="supplier" />
                        {!isBlank(m.supplier_contact) && <div className="row-subtitle">{m.supplier_contact}</div>}
                      </td>
                      <td><BomCell material={m} field="article_no" /></td>
                      <td><BomCell material={m} field="material_size" /></td>
                      <td><BomCell material={m} field="quantity" /></td>
                      <td><BomCell material={m} field="uom" /></td>
                      <td><BomCell material={m} field="color" /></td>
                      <td className="wrap-cell"><BomCell material={m} field="location" /></td>
                      <td className="wrap-cell"><BomCell material={m} field="notes" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  )
}

function Sketches({ images }) {
  return (
    <section className="panel" aria-labelledby="sketches-heading">
      <h2 id="sketches-heading">Sketches</h2>
      {images.length === 0 ? (
        <p className="muted">No sketches uploaded yet.</p>
      ) : (
        <ul className="sketch-grid">
          {images.map((file) => (
            <li key={file.id}>
              <a href={file.url} target="_blank" rel="noreferrer">
                <img src={file.url} alt={file.file_name} loading="lazy" />
                <span>{file.file_name}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Files({ files }) {
  return (
    <section className="panel" aria-labelledby="files-heading">
      <h2 id="files-heading">Files</h2>
      {files.length === 0 ? (
        <p className="muted">No files uploaded yet.</p>
      ) : (
        <ul className="file-list">
          {files.map((file) => (
            <li key={file.id}>
              <a href={file.url} target="_blank" rel="noreferrer">{file.file_name}</a>
              <span className="muted">
                {[file.file_type, formatDate(file.created_at)].filter(Boolean).join(' · ')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function ProjectView({ projectId }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    api(`/projects/${encodeURIComponent(projectId)}`)
      .then((result) => { if (!cancelled) setData(result) })
      .catch((err) => { if (!cancelled) setError(err) })
    return () => { cancelled = true }
  }, [projectId])

  const breadcrumb = (label) => (
    <nav className="breadcrumb" aria-label="Breadcrumb">
      <Link to="/projects">Projects</Link> / <span>{label}</span>
    </nav>
  )

  if (error) {
    const notFound = error.status === 404
    return (
      <>
        {breadcrumb(notFound ? 'Not found' : 'Error')}
        <div className="empty-state" role="alert">
          <h2>{notFound ? 'Project not found' : "Couldn't load this project"}</h2>
          <p>{notFound ? "This project doesn't exist or may have been deleted." : error.message}</p>
          <Link to="/projects" className="primary-button link-button">Back to projects</Link>
        </div>
      </>
    )
  }

  if (!data) {
    return (
      <>
        {breadcrumb('Loading…')}
        <p className="muted" role="status">Loading project…</p>
      </>
    )
  }

  const { project, colorways = [], files = [] } = data
  const images = files.filter(isImage)
  const otherFiles = files.filter((f) => !isImage(f))

  return (
    <>
      {breadcrumb(project.name)}

      <div className="page-header">
        <h1>{project.name}</h1>
        {project.style_description && <p>{project.style_description}</p>}
      </div>

      <ProjectDetails project={project} />
      <BomTable colorways={colorways} />
      <Sketches images={images} />
      <Files files={otherFiles} />
    </>
  )
}

export default function ProjectPage() {
  const { projectId } = useParams()
  // Keyed so switching projects starts fresh instead of showing the previous one.
  return <ProjectView key={projectId} projectId={projectId} />
}
