import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api.js'
import { percentComplete } from './bomFields.js'
import EditForm from '../components/EditForm.jsx'
import ImageGallery from '../components/ImageGallery.jsx'
import UploadList from '../components/UploadList.jsx'
import { ACCEPT_ATTRIBUTE, ACCEPTED_DESCRIPTION, friendlyUploadError, toUploadItems } from '../components/uploads.js'

// Follows the Sprint 1 project page wireframe.
// Expects GET /api/projects/:id to return
// { project: {...}, colorways: [{ id, name, materials: [...] }], files: [{ id, file_name, file_type, url, created_at }] }
// A material may include an optional `category` (e.g. "Fabric", "Trims"); the BOM table groups by it when present.
// The project and each material may include `fields: { [field]: { value, source } }` saying where each value came from.

const stageLabels = {
  'in progress': 'In progress',
  blocked: 'Blocked',
  finished: 'Finished',
}

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']

// Same rule as the backend's missing-BOM count (MISSING_BOM_ITEM in projects.py):
// a line is missing info when any of these is blank, or the yield is 0 or less.
const REQUIRED_BOM_FIELDS = [
  ['material', 'material'],
  ['supplier', 'supplier'],
  ['supplier_contact', 'responsible'],
  ['location', 'placement'],
  ['material_size', 'size / width'],
  ['color', 'color'],
  ['quantity', 'yield'],
  ['uom', 'unit'],
]
const REQUIRED_BOM_KEYS = new Set(REQUIRED_BOM_FIELDS.map(([field]) => field))

// Fields a user can edit on a BOM line. Length limits match the backend.
const BOM_FIELDS = [
  { name: 'name', label: 'Description', maxLength: 50 },
  { name: 'material', label: 'Material', maxLength: 100 },
  { name: 'supplier', label: 'Supplier', maxLength: 100 },
  { name: 'color', label: 'Color', maxLength: 50 },
  { name: 'quantity', label: 'Yield', type: 'number' },
  { name: 'uom', label: 'Unit', maxLength: 50 },
  { name: 'location', label: 'Placement', maxLength: 1000 },
  { name: 'material_size', label: 'Size / width', maxLength: 50 },
  { name: 'article_no', label: 'Article #', maxLength: 100 },
  { name: 'supplier_contact', label: 'Responsible', maxLength: 255 },
  { name: 'notes', label: 'Notes', maxLength: 1000 },
].map((f) => ({ ...f, required: REQUIRED_BOM_KEYS.has(f.name) }))

// Project details a user can edit. None are required; length limits match the backend.
const PROJECT_FIELDS = [
  { name: 'customer', label: 'Customer', maxLength: 255 },
  { name: 'season', label: 'Season', maxLength: 50 },
  { name: 'project_date', label: 'Date', type: 'date' },
  { name: 'size_range', label: 'Size range', maxLength: 50 },
  { name: 'fabric_yarn', label: 'Main fabric', maxLength: 100 },
  { name: 'designer', label: 'Designer', maxLength: 100 },
  { name: 'style_no', label: 'Style #', maxLength: 100 },
  { name: 'po_no', label: 'PO #', maxLength: 100 },
  { name: 'weight', label: 'Weight', maxLength: 100 },
]

function isBlank(value) {
  return value === null || value === undefined || String(value).trim() === ''
}

function isFieldMissing(material, field) {
  if (field === 'quantity') return isBlank(material.quantity) || Number(material.quantity) <= 0
  return isBlank(material[field])
}

// Field names that still need filling in, e.g. ['supplier', 'uom']
function missingKeys(material) {
  return REQUIRED_BOM_FIELDS.filter(([field]) => isFieldMissing(material, field)).map(([field]) => field)
}

// Readable names of the same fields, e.g. ['supplier', 'unit']
function missingFields(material) {
  return REQUIRED_BOM_FIELDS.filter(([field]) => isFieldMissing(material, field)).map(([, label]) => label)
}

function isImage(file) {
  const type = (file.file_type || '').toLowerCase()
  const ext = (file.file_name || '').split('.').pop().toLowerCase()
  return type.startsWith('image/') || IMAGE_EXTENSIONS.includes(type) || IMAGE_EXTENSIONS.includes(ext)
}

function formatDate(value) {
  if (!value) return null
  // A plain YYYY-MM-DD is a calendar date; reading it as UTC would show the day before in US time zones
  const plain = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  const date = plain ? new Date(Number(plain[1]), Number(plain[2]) - 1, Number(plain[3])) : new Date(value)
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

// Where a value came from, as sent by the API in `fields[field].source`.
// kind is "file", "manual", "generated", "unknown" or "missing".
function sourceOf(entity, field) {
  return entity.fields?.[field]?.source ?? null
}

// Real tech pack names run 70+ characters; keep the start and the extension so the label stays on one line
const MAX_FILE_LABEL = 28

function shortFileName(name) {
  if (name.length <= MAX_FILE_LABEL) return name
  return `${name.slice(0, MAX_FILE_LABEL - 10).trimEnd()}…${name.slice(-8).trimStart()}`
}

function describeSource(source) {
  if (!source) return null
  if (source.kind === 'file') {
    const where = [source.sheet && `sheet ${source.sheet}`, source.row && `row ${source.row}`].filter(Boolean).join(', ')
    const fullName = source.file_name || 'Uploaded file'
    return { label: shortFileName(fullName), fullName, where, url: source.url }
  }
  if (source.kind === 'manual') return { label: 'Entered by hand' }
  if (source.kind === 'generated') return { label: 'Set automatically' }
  // "unknown" and "missing" have nothing useful to show
  return null
}

// Text for hover tooltips, e.g. "From BOM.xlsx (sheet BLACK, row 14)"
function sourceTitle(source) {
  const info = describeSource(source)
  if (!info) return undefined
  if (!info.fullName) return info.label
  return `From ${info.fullName}${info.where ? ` (${info.where})` : ''}`
}

// Same source = same kind and same file
function sourceKey(source) {
  return source ? `${source.kind}:${source.file_id ?? ''}` : ''
}

function SourceTag({ source }) {
  const info = describeSource(source)
  if (!info) return null
  const title = sourceTitle(source)

  if (info.url) {
    return (
      <a className="source-tag source-file" href={info.url} target="_blank" rel="noreferrer" title={`${title}. Opens the original file.`}>
        {info.label}
      </a>
    )
  }
  return <span className="source-tag source-manual" title={title}>{info.label}</span>
}

// The source most of the filled-in values share, shown once per BOM row or once for the project details.
// `only` limits it to some fields, e.g. the details the page shows.
function primarySource(entity, only) {
  const counts = new Map()
  for (const [field, entry] of Object.entries(entity.fields ?? {})) {
    if (only && !only.includes(field)) continue
    if (isBlank(entry?.value) || !describeSource(entry.source)) continue
    const key = sourceKey(entry.source)
    const current = counts.get(key) ?? { source: entry.source, count: 0 }
    counts.set(key, { ...current, count: current.count + 1 })
  }
  let best = null
  for (const candidate of counts.values()) {
    if (!best || candidate.count > best.count) best = candidate
  }
  return best?.source ?? null
}

// After a save, the edited fields were typed in by hand
function markEnteredByHand(fields, changes) {
  if (!fields) return fields
  const next = { ...fields }
  for (const [field, value] of Object.entries(changes)) {
    next[field] = { value, source: { kind: 'manual' } }
  }
  return next
}

function MissingTotal({ count }) {
  if (count === 0) return <span className="badge badge-ok">BOM complete</span>
  return (
    <span className="badge badge-missing" role="status">
      {count} {count === 1 ? 'line' : 'lines'} missing info
    </span>
  )
}

function ProjectHeader({ project, missingTotal }) {
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
          <MissingTotal count={missingTotal} />
          <Link to={`/projects/${project.id}/missing`} className="secondary-button link-button small-button">
            View missing items
          </Link>
        </div>
        {subtitle.length > 0 && <p>{subtitle.join(' · ')}</p>}
      </div>
    </>
  )
}

// The date input needs YYYY-MM-DD; the API may send a full timestamp
function dateInputValue(value) {
  if (isBlank(value)) return ''
  const match = /^\d{4}-\d{2}-\d{2}/.exec(String(value))
  return match ? match[0] : ''
}

function ProjectDetailsForm({ project, onCancel, onSaved }) {
  const values = { ...project, project_date: dateInputValue(project.project_date) }
  const missing = PROJECT_FIELDS.filter((f) => isBlank(values[f.name])).map((f) => f.name)

  async function save(changes) {
    const data = await api(`/projects/${encodeURIComponent(project.id)}`, { method: 'PATCH', body: changes })
    const saved = data.project ?? { ...project, ...changes }
    // The save response has no sources, so mark what was just typed in as entered by hand
    onSaved({ ...saved, fields: markEnteredByHand(project.fields, changes) })
  }

  return (
    <EditForm
      label="Edit project details"
      idPrefix={`project-${project.id}`}
      fields={PROJECT_FIELDS}
      values={values}
      missing={missing}
      onSave={save}
      onCancel={onCancel}
    />
  )
}

// Whole-project overview: how many BOM lines are complete vs still missing info
function ProjectCompleteness({ colorways }) {
  const lines = colorways.flatMap((c) => c.materials)
  const missing = lines.filter((m) => missingFields(m).length > 0).length
  const complete = lines.length - missing
  const percent = percentComplete(lines.length, missing)

  return (
    <section className="panel" aria-label="BOM completeness">
      <h2>BOM completeness</h2>
      {lines.length === 0 ? (
        <p className="muted">No BOM lines yet. Upload a BOM to see what's complete.</p>
      ) : (
        <>
          <div className="stat-grid">
            <div className="stat-card">
              <div className="eyebrow">Complete</div>
              <div className="stat-value stat-good">{complete}</div>
              <div className="muted">lines with every required field</div>
            </div>
            <div className="stat-card">
              <div className="eyebrow">Missing info</div>
              <div className={`stat-value ${missing ? 'stat-bad' : ''}`}>{missing}</div>
              <div className="muted">lines still need details</div>
            </div>
            <div className="stat-card">
              <div className="eyebrow">Total lines</div>
              <div className="stat-value">{lines.length}</div>
              <div className="muted">across {colorways.length} {colorways.length === 1 ? 'colorway' : 'colorways'}</div>
            </div>
          </div>
          <div className="progress-cell">
            <div
              className="progress"
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Project BOM complete"
            >
              <div style={{ width: `${percent}%` }} />
            </div>
            <span className="percent">{percent}% complete</span>
          </div>
        </>
      )}
    </section>
  )
}

function ProjectSummary({ project, sketches, onSaved }) {
  const [editing, setEditing] = useState(false)

  // [label, value, field name the API uses for its source]
  const details = [
    ['Customer', project.customer, 'customer'],
    ['Season', project.season, 'season'],
    ['Date', formatDate(project.project_date || project.created_at), 'project_date'],
    ['Size range', project.size_range, 'size_range'],
    ['Main fabric', project.fabric_yarn, 'fabric_yarn'],
    ['Designer', project.designer, 'designer'],
    ['Style #', project.style_no, 'style_no'],
    ['PO #', project.po_no, 'po_no'],
    ['Weight', project.weight, 'weight'],
  ]

  // When most details came from one file, name it once instead of under every value
  const main = primarySource(project, details.map(([, , field]) => field))
  const shared = main?.kind === 'file' ? main : null

  return (
    <section className="panel project-summary" aria-label="Project details">
      <div className="summary-details">
        <div className="summary-head">
          <h2 className="eyebrow">Details</h2>
          {!editing && (
            <button type="button" className="secondary-button small-button" onClick={() => setEditing(true)}>
              Edit details
            </button>
          )}
        </div>
        {editing ? (
          <ProjectDetailsForm
            project={project}
            onCancel={() => setEditing(false)}
            onSaved={(updated) => {
              onSaved(updated)
              setEditing(false)
            }}
          />
        ) : (
          <>
            {shared && (
              <p className="summary-source">
                Details from <SourceTag source={shared} />
              </p>
            )}
            <dl className="detail-grid">
              {details.map(([label, value, field]) => {
                const source = sourceOf(project, field)
                const ownLabel = !isBlank(value) && sourceKey(source) !== sourceKey(shared)
                return (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd title={isBlank(value) ? undefined : sourceTitle(source)}>
                      {isBlank(value) ? '—' : value}
                      {ownLabel && <SourceTag source={source} />}
                    </dd>
                  </div>
                )
              })}
            </dl>
          </>
        )}
      </div>

      <div className="summary-sketches">
               <h2 className="eyebrow">Sketches &amp; images{sketches.length > 0 && ` · ${sketches.length}`}</h2>
        <ImageGallery images={sketches} />
      </div>
    </section>
  )
}

function StatCards({ lines }) {
  const missingCount = lines.filter((m) => missingFields(m).length > 0).length
  const covered = lines.length - missingCount
  const percent = percentComplete(lines.length, missingCount)

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

function NeedsAttention({ lines, colorwayName, onEdit, editDisabled }) {
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
            <button
              type="button"
              className="secondary-button small-button"
              onClick={() => onEdit(m.id)}
              disabled={editDisabled}
              aria-label={`Edit missing info for ${m.name || 'unnamed line'}`}
            >
              Edit
            </button>
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

function MissingLabel({ fields }) {
  const [open, setOpen] = useState(false)
  const list = `Missing: ${fields.join(', ')}`

  return (
    <span className="missing-label">
      <button
        type="button"
        className="badge badge-missing missing-toggle"
        title={list}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        Missing {fields.length}
      </button>
      {open && <span className="missing-list">{list}</span>}
    </span>
  )
}

function BomRow({ m, onEdit, editDisabled }) {
  const { projectId } = useParams()
  const gaps = missingFields(m)
  const isOpen = gaps.length > 0
  const cell = (value) => (isBlank(value) ? <span className="muted-dash">—</span> : value)
  const required = (value) => (isBlank(value) ? <Missing /> : value)
  // Highlights the cell itself when a required value is empty (yield shares its cell with the unit)
  const requiredCell = (...fields) => (fields.some((f) => isFieldMissing(m, f)) ? 'cell-missing' : undefined)

  // The row shows its main source once; a value only gets its own label when it came from somewhere else
  const rowSource = primarySource(m)
  const tip = (field) => (isBlank(m[field]) ? undefined : sourceTitle(sourceOf(m, field)))
  const ownSource = (field) => {
    const source = sourceOf(m, field)
    if (isBlank(m[field]) || sourceKey(source) === sourceKey(rowSource)) return null
    return <SourceTag source={source} />
  }

  return (
    <tr className={isOpen ? 'row-open' : undefined}>
      <td>
        <div className="row-title">
           <Link to={`/projects/${projectId}/parts/${m.id}`} title={tip('name')} className="row-title">
            {m.name || 'Unnamed line'}
          </Link>
          {' · '}
          <span title={tip('material')}>{required(m.material)}</span>
        </div>
        {!isBlank(m.article_no) && <div className="row-subtitle mono" title={tip('article_no')}>{m.article_no}</div>}
        {rowSource && <SourceTag source={rowSource} />}
        {ownSource('material')}
        {isOpen && <MissingLabel fields={gaps} />}
      </td>
      <td className={requiredCell('supplier')} title={tip('supplier')}>{required(m.supplier)}{ownSource('supplier')}</td>
      <td className={requiredCell('color')} title={tip('color')}>{required(m.color)}{ownSource('color')}</td>
      <td className={['wrap-cell', requiredCell('location')].filter(Boolean).join(' ')} title={tip('location')}>
        {required(m.location)}{ownSource('location')}
      </td>
      <td className={requiredCell('material_size')} title={tip('material_size')}>
        {required(m.material_size)}{ownSource('material_size')}
      </td>
      <td className={requiredCell('supplier_contact')} title={tip('supplier_contact')}>
        {required(m.supplier_contact)}
        {ownSource('supplier_contact')}
      </td>
      <td className={['mono', requiredCell('quantity', 'uom')].filter(Boolean).join(' ')} title={tip('quantity')}>
        {isBlank(m.quantity) ? (
          <Missing />
        ) : isBlank(m.uom) ? (
          <>{m.quantity} <span className="missing-text">no unit</span></>
        ) : (
          `${m.quantity} ${m.uom}`
        )}
        {ownSource('quantity')}
      </td>
      <td className="wrap-cell" title={tip('notes')}>{cell(m.notes)}{ownSource('notes')}</td>
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
  async function save(changes) {
    const data = await api(`/materials/${encodeURIComponent(m.id)}`, { method: 'PATCH', body: changes })
    const saved = data.material ?? { ...m, ...changes }
    // The save response has no sources, so mark what was just typed in as entered by hand
    onSaved({ ...saved, fields: markEnteredByHand(m.fields, changes) })
  }

  return (
    <tr className="edit-row">
      <td colSpan={9}>
        <EditForm
          label={`Edit ${m.name || 'line'}`}
          idPrefix={`edit-${m.id}`}
          fields={BOM_FIELDS}
          values={m}
          missing={missingKeys(m)}
          onSave={save}
          onCancel={onCancel}
        />
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
      <NeedsAttention
        lines={lines}
        colorwayName={selected.name}
        onEdit={(id) => setEditingId(id)}
        editDisabled={editingId !== null}
      />

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

// RAMP-132: add files to the project from the Files tab.
// Each file is checked when chosen, uploads one at a time, and says why if it fails;
// the rest of the page keeps working and a failed file can be tried again.
function FileUploader({ projectId, onUploaded }) {
  const [items, setItems] = useState([])
  const [busy, setBusy] = useState(false)

  function setStatus(key, status, message = null) {
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, status, message } : item)))
  }

  async function upload(toUpload) {
    setBusy(true)
    let uploaded = 0
    for (const item of toUpload) {
      setStatus(item.key, 'uploading')
      try {
        const form = new FormData()
        form.append('file', item.file)
        await api(`/projects/${encodeURIComponent(projectId)}/import`, { method: 'POST', body: form })
        setStatus(item.key, 'done')
        uploaded += 1
      } catch (err) {
        setStatus(item.key, 'failed', friendlyUploadError(err.message))
      }
    }
    setBusy(false)
    // New files can add BOM lines and details, so reload the project once
    if (uploaded > 0) onUploaded()
  }

  function handleChoose(e) {
    const added = toUploadItems(e.target.files)
    // Clear the input so the same file can be chosen again after fixing it
    e.target.value = ''
    if (added.length === 0) return
    setItems((prev) => [...prev, ...added])
    const valid = added.filter((i) => i.status === 'waiting')
    if (valid.length) upload(valid)
  }

  return (
    <div className="file-uploader">
      <div className="field">
        <label htmlFor={`upload-${projectId}`}>Upload files</label>
        <input
          id={`upload-${projectId}`}
          type="file"
          multiple
          accept={ACCEPT_ATTRIBUTE}
          onChange={handleChoose}
          disabled={busy}
          aria-describedby={`upload-${projectId}-hint`}
        />
        <p className="field-hint" id={`upload-${projectId}-hint`}>{ACCEPTED_DESCRIPTION}</p>
      </div>
      <UploadList
        items={items}
        label="Uploads"
        busy={busy}
        onRetry={(item) => upload([item])}
        onRemove={(item) => setItems((prev) => prev.filter((i) => i.key !== item.key))}
      />
    </div>
  )
}

function FilesTab({ files, projectId, onUploaded }) {
  return (
    <section className="panel" aria-label="Files">
      <FileUploader projectId={projectId} onUploaded={onUploaded} />
      {files.length === 0 ? (
        <p className="muted">No files uploaded yet.</p>
      ) : (
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
      )}
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
  // Bumped after an upload so the project reloads with the new file's details and BOM lines
  const [reloads, setReloads] = useState(0)

  useEffect(() => {
    let cancelled = false
    api(`/projects/${encodeURIComponent(projectId)}`)
      .then((result) => { if (!cancelled) setData(result) })
      .catch((err) => {
        // A failed reload keeps showing what's already on the page
        if (!cancelled && reloads === 0) setError(err)
      })
    return () => { cancelled = true }
  }, [projectId, reloads])

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

  function handleProjectSaved(updated) {
    setData((prev) => ({ ...prev, project: { ...prev.project, ...updated } }))
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
  const missingTotal = colorways.reduce(
    (sum, c) => sum + c.materials.filter((m) => missingFields(m).length > 0).length,
    0
  )
  const tabs = [
    { id: 'bom', label: `BOM (${totalLines})` },
    { id: 'files', label: `Files (${files.length})` },
  ]

  return (
    <>
      <ProjectHeader project={project} missingTotal={missingTotal} />
      <ProjectSummary project={project} sketches={sketches} onSaved={handleProjectSaved} />
      <ProjectCompleteness colorways={colorways} />

      <Tabs tabs={tabs} active={tab} onChange={setTab} />
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="tab-panel">
        {tab === 'bom' ? <BomTab colorways={colorways} onMaterialSaved={handleMaterialSaved} /> : <FilesTab files={files} projectId={project.id ?? projectId} onUploaded={() => setReloads((n) => n + 1)} />}
      </div>
    </>
  )
}

export default function ProjectPage() {
  const { projectId } = useParams()
  // Keyed so switching projects starts fresh instead of showing the previous one.
  return <ProjectView key={projectId} projectId={projectId} />
}