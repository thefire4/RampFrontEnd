import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api.js'
import EditForm from '../components/EditForm.jsx'
import VendorContact from '../components/VendorContact.jsx'
import { missingContactFields, VENDOR_FIELDS } from '../components/vendors.js'

// RAMP-145 / RAMP-143: one vendor's contact details and every BOM line linked to it.

function lineTitle(line) {
  return [line.name, line.material].filter(Boolean).join(' · ') || 'Unnamed line'
}

function VendorView({ vendorId }) {
  const [vendor, setVendor] = useState(null)
  const [lines, setLines] = useState(null)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(false)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let cancelled = false
    const id = encodeURIComponent(vendorId)
    Promise.all([api(`/vendors/${id}`), api(`/vendors/${id}/bom-lines`)])
      .then(([v, l]) => {
        if (cancelled) return
        setVendor(v.vendor)
        setLines(l.bom_lines || [])
      })
      .catch((err) => { if (!cancelled) setError(err) })
    return () => { cancelled = true }
  }, [vendorId])

  async function save(changes) {
    const data = await api(`/vendors/${encodeURIComponent(vendorId)}`, { method: 'PATCH', body: changes })
    setVendor(data.vendor)
    setEditing(false)
    setNotice('Saved.')
  }

  const crumb = (
    <nav className="breadcrumb" aria-label="Breadcrumb">
      <Link to="/vendors">Vendors</Link> / <span>{vendor?.name || (error ? 'Not found' : 'Loading…')}</span>
    </nav>
  )

  if (error) {
    const notFound = error.status === 404
    return (
      <>
        {crumb}
        <div className="empty-state" role="alert">
          <h2>{notFound ? 'Vendor not found' : "Couldn't load this vendor"}</h2>
          <p>{notFound ? "This vendor doesn't exist or may have been removed." : error.message}</p>
          <Link to="/vendors" className="primary-button link-button">Back to vendors</Link>
        </div>
      </>
    )
  }

  if (!vendor) {
    return (
      <>
        {crumb}
        <p className="muted" role="status">Loading vendor…</p>
      </>
    )
  }

  const gaps = missingContactFields(vendor)

  return (
    <>
      {crumb}
      <div className="page-header">
        <h1>{vendor.name}</h1>
      </div>
      {notice && <div className="alert alert-success" role="status">{notice}</div>}

      <section className="panel" aria-label="Contact">
        <div className="summary-head">
          <h2 className="eyebrow">Contact</h2>
          {!editing && (
            <button type="button" className="secondary-button small-button" onClick={() => { setEditing(true); setNotice('') }}>
              Edit vendor
            </button>
          )}
        </div>
        {editing ? (
          <EditForm
            label={`Edit ${vendor.name}`}
            idPrefix={`vendor-${vendor.id}`}
            fields={VENDOR_FIELDS}
            values={vendor}
            missing={gaps}
            onSave={save}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <>
            <VendorContact vendor={vendor} showName={false} className="vendor-contact-large" />
            {gaps.length > 0 && (
              <p className="form-hint">Add a contact person, email and phone so follow-ups reach a real person.</p>
            )}
            {vendor.notes && <p className="vendor-notes">{vendor.notes}</p>}
          </>
        )}
      </section>

      <section className="panel panel-flush" aria-label={`BOM lines for ${vendor.name}`}>
        <h2 className="panel-pad panel-title">
          BOM lines <span className="muted">· {lines.length}</span>
        </h2>
        {lines.length === 0 ? (
          <p className="muted panel-pad">No BOM lines linked yet. Pick this vendor in a BOM line&apos;s Edit form.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Project</th>
                  <th scope="col">Colorway</th>
                  <th scope="col">BOM line</th>
                  <th scope="col">Color</th>
                  <th scope="col">Yield</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.id}>
                    <td><Link to={`/projects/${line.project_id}`}>{line.project_name}</Link></td>
                    <td>{line.colorway_name || <span className="muted-dash">—</span>}</td>
                    <td>
                      <Link className="row-title" to={`/projects/${line.project_id}/parts/${line.id}`}>{lineTitle(line)}</Link>
                    </td>
                    <td>{line.color || <span className="muted-dash">—</span>}</td>
                    <td className="mono">
                      {line.quantity === null || line.quantity === undefined
                        ? <span className="muted-dash">—</span>
                        : `${line.quantity}${line.uom ? ` ${line.uom}` : ''}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}

export default function VendorDetail() {
  const { vendorId } = useParams()
  // Keyed so switching vendors starts fresh
  return <VendorView key={vendorId} vendorId={vendorId} />
}
