import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api.js'

// Follows the Sprint 1 project page wireframe.
// Expects GET /api/projects/:id to return
// { project: {...}, colorways: [{ id, name, materials: [...] }], files: [{ id, file_name, file_type, url, created_at }] }
// A material may include an optional `category` (e.g. "Fabric", "Trims"); the BOM table groups by it when present.

const stageLabels = {
  'in progress': 'In progress',
  blocked: 'Blocked',
  finished: 'Finished',
}

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']

// Same rule as the backend's missing-BOM count: these fields must be filled in.
const REQUIRED_BOM_FIELDS = [
  ['material', 'material'],
  ['supplier', 'supplier'],
  ['color', 'color'],
  ['quantity', 'yield'],
]

// Fields a user can edit on a BOM line: [field, label, input type]
const EDITABLE_FIELDS = [
  ['name', 'Description'],
  ['material', 'Material'],
  ['supplier', 'Supplier'],
  ['color', 'Color'],
  ['quantity', 'Yield', 'number'],
  ['uom', 'Unit'],
  ['location', 'Placement'],
  ['material_size', 'Size / width'],
  ['article_no', 'Article #'],
  ['supplier_contact', 'Responsible'],
  ['notes', 'Notes'],
]

function toFormValue(value) {
  return value === null || value === undefined ? '' : String(value)
}

function isBlank(value) {
  return value === null || value === undefined || String(value).trim() === ''
}

function missingFields(material) {
  return REQUIRED_BOM_FIELDS.filter(([field]) => isBlank(material[field])).map(([, label]) => label)
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

function joinList(items) {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} or ${items[items.length - 1]}`
}

function StageBadge({ stage }) {
  const key = (stage || '').replace(/\s+/g, '-')
  return <span className={`badge stage-${key}`}>{stageLabels[stage] || stage || '—'}</span>
}

function Missing() {
  return <span className="missing-text">Missing</span>
}

function ProjectHeader({ project }) {
  const subtitle = [
    project.customer,
    project.season,
    project.po_no && `PO ${project.po_no}`,
    project.style_description,
  ].filter((v) => !isBlank(v))

  return (
    <>
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/projects">Projects</Link>
        {project.customer && <> / <span>{project.customer}</span></>}
        {' / '}<span>{project.style_no || project.name}</span>
      </nav>

      <div className="page-header">
        <div className="project-title">
          <h1>{project.name}</h1>
          {project.style_no && <span className="chip">{project.style_no}</span>}
          <StageBadge stage={project.stage} />
        </div>
        {subtitle.length > 0 && <p>{subtitle.join(' · ')}</p>}
      </div>
    </>
  )
}

function ProjectSummary({ project, sketches }) {
  const details = [
    ['Customer', project.customer],
    ['Season', project.season],
    ['Date', formatDate(project.project_date || project.created_at)],
    ['Size range', project.size_range],
    ['Main fabric', project.fabric_yarn],
    ['Designer', project.designer],
    ['Style #', project.style_no],
    ['PO #', project.po_no],
    ['Weight', project.weight],
  ]

  return (
    <section className="panel project-summary" aria-label="Project details">
      <dl className="detail-grid">
        {details.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{isBlank(value) ? '—' : value}</dd>
          </div>
        ))}
      </dl>

      <div className="summary-sketches">
        <h2 className="eyebrow">Sketches</h2>
        {sketches.length === 0 ? (
          <div className="sketch-placeholder">No sketches uploaded yet</div>
        ) : (
          <ul className="sketch-grid">
            {sketches.map((file) => (
              <li key={file.id}>
                <a href={file.url} target="_blank" rel="noreferrer">
                  <img src={file.url} alt={file.file_name} loading="lazy" />
                  <span>{file.file_name}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

function StatCards({ lines }) {
  const missingCount = lines.filter((m) => missingFields(m).length > 0).length
  const covered = lines.length - missingCount
  const percent = lines.length ? Math.round((covered / lines.length) * 100) : 0

  return (
    <div className="stat-grid">
      <div className="stat-card">
        <div className="eyebrow">Lines covered</div>
        <div className="stat-value">{covered} / {lines.length}</div>
        <div className="progress" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Lines covered">
          <div style={{ width: `${percent}%` }} />
        </div>
      </div>
      <div className="stat-card">
        <div className="eyebrow">Missing info</div>
        <div className={`stat-value ${missingCount ? 'stat-bad' : ''}`}>{missingCount}</div>
        <div className="muted">lines with blank required fields</div>
      </div>
    </div>
  )
}

function NeedsAttention({ lines, colorwayName }) {
  const open = lines.filter((m) => missingFields(m).length > 0)
  if (open.length === 0) return null

  return (
    <section className="panel attention" aria-labelledby="attention-heading">
      <h2 id="attention-heading">Needs attention · {colorwayName}</h2>
      <ul className="attention-list">
        {open.map((m) => (
          <li key={m.id}>
            <span className="badge badge-missing">Missing info</span>
            <div className="attention-body">
              <div className="row-title">{[m.name, m.material].filter((v) => !isBlank(v)).join(' · ') || 'Unnamed line'}</div>
              <div className="muted">No {joinList(missingFields(m))} entered.</div>
            </div>
            <div className="attention-owner">
              Responsible: <strong>{isBlank(m.supplier_contact) ? '[Unassigned]' : m.supplier_contact}</strong>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

// Keeps the order categories first appear in. With no categories, everything is one unlabelled group.
function groupByCategory(lines) {
  const groups = new Map()
  for (const m of lines) {
    const key = isBlank(m.category) ? '' : m.category
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(m)
  }
  return [...groups.entries()]
}

function BomRow({ m, onEdit, editDisabled }) {
  const isOpen = missingFields(m).length > 0
  const cell = (value) => (isBlank(value) ? <span className="muted-dash">—</span> : value)
  const required = (value) => (isBlank(value) ? <Missing /> : value)

  return (
    <tr className={isOpen ? 'row-open' : undefined}>
      <td>
        <div className="row-title">
          {m.name || 'Unnamed line'}
          {' · '}
          {required(m.material)}
        </div>
        {!isBlank(m.article_no) && <div className="row-subtitle mono">{m.article_no}</div>}
      </td>
      <td>{required(m.supplier)}</td>
      <td>{required(m.color)}</td>
      <td className="wrap-cell">{cell(m.location)}</td>
      <td>{cell(m.material_size)}</td>
      <td>{isBlank(m.supplier_contact) ? <Missing /> : m.supplier_contact}</td>
      <td className="mono">{isBlank(m.quantity) ? <Missing /> : `${m.quantity} ${m.uom || ''}`.trim()}</td>
      <td className="wrap-cell">{cell(m.notes)}</td>
      <td className="actions">
        <button
          type="button"
          className="secondary-button small-button"
          onClick={onEdit}
          disabled={editDisabled}
          aria-label={`Edit ${m.name || 'line'}`}
        >
          Edit
        </button>
      </td>
    </tr>
  )
}

function BomEditRow({ m, onCancel, onSaved }) {
  const [form, setForm] = useState(() =>
    Object.fromEntries(EDITABLE_FIELDS.map(([field]) => [field, toFormValue(m[field])]))
  )
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  function update(field) {
    return (e) => setForm({ ...form, [field]: e.target.value })
  }

  async function handleSave(e) {
    e.preventDefault()

    // Only send fields that actually changed; blank means "clear it"
    const changes = {}
    for (const [field] of EDITABLE_FIELDS) {
      const value = form[field].trim()
      if (value !== toFormValue(m[field]).trim()) changes[field] = value === '' ? null : value
    }

    if ('quantity' in changes && changes.quantity !== null) {
      const qty = Number(changes.quantity)
      if (!Number.isFinite(qty) || qty < 0) {
        setError('Yield must be a number of 0 or more.')
        return
      }
      changes.quantity = qty
    }

    if (Object.keys(changes).length === 0) {
      onCancel()
      return
    }

    setError('')
    setSaving(true)
    try {
      const data = await api(`/materials/${encodeURIComponent(m.id)}`, { method: 'PATCH', body: changes })
      onSaved(data.material ?? { ...m, ...changes })
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  const label = `Edit ${m.name || 'line'}`

  return (
    <tr className="edit-row">
      <td colSpan={9}>
        <form
          className="bom-edit-form"
          aria-label={label}
          onSubmit={handleSave}
          onKeyDown={(e) => e.key === 'Escape' && onCancel()}
          noValidate
        >
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          <div className="bom-edit-grid">
            {EDITABLE_FIELDS.map(([field, fieldLabel, type]) => (
              <div className="field" key={field}>
                <label htmlFor={`edit-${m.id}-${field}`}>{fieldLabel}</label>
                <input
                  id={`edit-${m.id}-${field}`}
                  type={type === 'number' ? 'number' : 'text'}
                  step={type === 'number' ? 'any' : undefined}
                  min={type === 'number' ? 0 : undefined}
                  value={form[field]}
                  onChange={update(field)}
                />
              </div>
            ))}
          </div>
          <div className="bom-edit-actions">
            <button type="submit" className="primary-button" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button type="button" className="secondary-button" onClick={onCancel} disabled={saving}>
              Cancel
            </button>
          </div>
        </form>
      </td>
    </tr>
  )
}

function BomTab({ colorways, onMaterialSaved }) {
  const [selectedId, setSelectedId] = useState(colorways[0]?.id)
  const [openOnly, setOpenOnly] = useState(false)
  const [editingId, setEditingId] = useState(null)

  if (colorways.length === 0) return <p className="muted">No BOM lines yet.</p>

  const selected = colorways.find((c) => c.id === selectedId) || colorways[0]
  const lines = selected.materials
  const visible = openOnly ? lines.filter((m) => missingFields(m).length > 0) : lines
  const groups = groupByCategory(visible)

  return (
    <>
      <div className="bom-toolbar">
        <div className="segmented" role="group" aria-label="Colorway">
          {colorways.map((c) => (
            <button key={c.id} type="button" aria-pressed={c.id === selected.id} onClick={() => { setSelectedId(c.id); setEditingId(null) }}>
              {c.name} · {c.materials.length}
            </button>
          ))}
        </div>
        <button type="button" className="secondary-button" aria-pressed={openOnly} onClick={() => setOpenOnly(!openOnly)}>
          {openOnly ? 'Show all lines' : 'Show only open lines'}
        </button>
      </div>

      <StatCards lines={lines} />
      <NeedsAttention lines={lines} colorwayName={selected.name} />

      <section className="panel panel-flush" aria-label={`BOM lines for ${selected.name}`}>
        {visible.length === 0 ? (
          <p className="muted panel-pad">
            {openOnly ? `Every line for ${selected.name} is complete.` : `No BOM lines for ${selected.name} yet.`}
          </p>
        ) : (
          <div className="table-wrap">
            <table className="data-table bom-table">
              <thead>
                <tr>
                  <th scope="col">Description</th>
                  <th scope="col">Supplier</th>
                  <th scope="col">Color</th>
                  <th scope="col">Placement</th>
                  <th scope="col">Size / width</th>
                  <th scope="col">Responsible</th>
                  <th scope="col">Yield</th>
                  <th scope="col">Notes</th>
                  <th scope="col"><span className="visually-hidden">Actions</span></th>
                </tr>
              </thead>
              {groups.map(([category, rows]) => (
                <tbody key={category || 'all'}>
                  {category && (
                    <tr className="group-row">
                      <th scope="colgroup" colSpan={9}>
                        {category} <span>{rows.length} {rows.length === 1 ? 'line' : 'lines'}</span>
                      </th>
                    </tr>
                  )}
                  {rows.map((m) =>
                    m.id === editingId ? (
                      <BomEditRow
                        key={m.id}
                        m={m}
                        onCancel={() => setEditingId(null)}
                        onSaved={(updated) => {
                          onMaterialSaved(selected.id, updated)
                          setEditingId(null)
                        }}
                      />
                    ) : (
                      <BomRow key={m.id} m={m} onEdit={() => setEditingId(m.id)} editDisabled={editingId !== null} />
                    )
                  )}
                </tbody>
              ))}
            </table>
          </div>
        )}
      </section>
    </>
  )
}

function FilesTab({ files }) {
  if (files.length === 0) return <p className="muted">No files uploaded yet.</p>

  return (
    <section className="panel" aria-label="Files">
      <ul className="file-list">
        {files.map((file) => (
          <li key={file.id}>
            <a href={file.url} target="_blank" rel="noreferrer">{file.file_name}</a>
            <span className="muted">
              {[isImage(file) ? 'Sketch' : file.file_type, formatDate(file.created_at)].filter(Boolean).join(' · ')}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Tabs({ tabs, active, onChange }) {
  return (
    <div className="tabs" role="tablist" aria-label="Project sections">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          id={`tab-${t.id}`}
          aria-selected={t.id === active}
          aria-controls={`panel-${t.id}`}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

function ProjectView({ projectId }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('bom')

  useEffect(() => {
    let cancelled = false
    api(`/projects/${encodeURIComponent(projectId)}`)
      .then((result) => { if (!cancelled) setData(result) })
      .catch((err) => { if (!cancelled) setError(err) })
    return () => { cancelled = true }
  }, [projectId])

  // Swap the saved line into state; stats, flags and Needs attention recalculate from it
  function handleMaterialSaved(colorwayId, updated) {
    setData((prev) => ({
      ...prev,
      colorways: prev.colorways.map((c) =>
        c.id !== colorwayId
          ? c
          : { ...c, materials: c.materials.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)) }
      ),
    }))
  }

  if (error) {
    const notFound = error.status === 404
    return (
      <>
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <Link to="/projects">Projects</Link> / <span>{notFound ? 'Not found' : 'Error'}</span>
        </nav>
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
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <Link to="/projects">Projects</Link> / <span>Loading…</span>
        </nav>
        <p className="muted" role="status">Loading project…</p>
      </>
    )
  }

  const { project, colorways = [], files = [] } = data
  const sketches = files.filter(isImage)
  const totalLines = colorways.reduce((sum, c) => sum + c.materials.length, 0)
  const tabs = [
    { id: 'bom', label: `BOM (${totalLines})` },
    { id: 'files', label: `Files (${files.length})` },
  ]

  return (
    <>
      <ProjectHeader project={project} />
      <ProjectSummary project={project} sketches={sketches} />

      <Tabs tabs={tabs} active={tab} onChange={setTab} />
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="tab-panel">
        {tab === 'bom' ? <BomTab colorways={colorways} onMaterialSaved={handleMaterialSaved} /> : <FilesTab files={files} />}
      </div>
    </>
  )
}

export default function ProjectPage() {
  const { projectId } = useParams()
  // Keyed so switching projects starts fresh instead of showing the previous one.
  return <ProjectView key={projectId} projectId={projectId} />
}
