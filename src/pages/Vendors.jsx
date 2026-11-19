import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import EditForm from '../components/EditForm.jsx'
import { missingContactFields, sortVendors, useVendors, VENDOR_FIELDS } from '../components/vendors.js'

// RAMP-145: every vendor once, with a real contact so follow-ups reach a person.
// List plus add and edit forms; each vendor's own page lists its BOM lines.

const CONTACT_LABELS = { contact_name: 'contact person', email: 'email', phone: 'phone' }

function MissingContact({ vendor }) {
  const gaps = missingContactFields(vendor)
  if (gaps.length === 0) return null
  return <span className="badge badge-missing">No {gaps.map((g) => CONTACT_LABELS[g]).join(', ')}</span>
}

function Cell({ value, href }) {
  if (!value) return <span className="muted-dash">—</span>
  return href ? <a href={href}>{value}</a> : value
}

export default function Vendors() {
  const { vendors, setVendors, available, loading, error } = useVendors()
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [notice, setNotice] = useState('')

  async function create(changes) {
    const data = await api('/vendors', { method: 'POST', body: changes })
    setVendors((prev) => sortVendors([...prev, data.vendor]))
    setAdding(false)
    setNotice(`Added ${data.vendor.name}.`)
  }

  async function update(vendor, changes) {
    const data = await api(`/vendors/${encodeURIComponent(vendor.id)}`, { method: 'PATCH', body: changes })
    setVendors((prev) => sortVendors(prev.map((v) => (v.id === vendor.id ? data.vendor : v))))
    setEditingId(null)
    setNotice(`Saved ${data.vendor.name}.`)
  }

  const header = (
    <div className="page-header page-header-row">
      <div>
        <h1>Vendors</h1>
        <p>Each supplier once, with the person to contact. Link vendors to BOM lines from a line&apos;s Edit form.</p>
      </div>
      {available && !adding && (
        <button type="button" className="primary-button" onClick={() => { setAdding(true); setEditingId(null); setNotice('') }}>
          Add vendor
        </button>
      )}
    </div>
  )

  if (!available) {
    return (
      <>
        {header}
        <div className="empty-state" role="status">
          <h2>Vendors aren&apos;t available yet</h2>
          <p>The server doesn&apos;t support vendor records yet.</p>
        </div>
      </>
    )
  }

  return (
    <>
      {header}
      {notice && <div className="alert alert-success" role="status">{notice}</div>}
      {error && <div className="alert alert-error" role="alert">Couldn&apos;t load vendors: {error.message}</div>}

      {adding && (
        <section className="panel" aria-label="Add vendor">
          <h2>Add vendor</h2>
          <EditForm
            label="Add vendor"
            idPrefix="new-vendor"
            fields={VENDOR_FIELDS}
            values={{}}
            creating
            saveLabel="Add vendor"
            onSave={create}
            onCancel={() => setAdding(false)}
          />
        </section>
      )}

      <section className="panel panel-flush" aria-label="Vendor list">
        {loading ? (
          <p className="muted panel-pad" role="status">Loading vendors…</p>
        ) : vendors.length === 0 ? (
          <p className="muted panel-pad">No vendors yet. Add the first one to start linking BOM lines.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table vendor-table">
              <thead>
                <tr>
                  <th scope="col">Vendor</th>
                  <th scope="col">Contact person</th>
                  <th scope="col">Email</th>
                  <th scope="col">Phone</th>
                  <th scope="col"><span className="visually-hidden">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((v) =>
                  v.id === editingId ? (
                    <tr key={v.id} className="edit-row">
                      <td colSpan={5}>
                        <EditForm
                          label={`Edit ${v.name}`}
                          idPrefix={`vendor-${v.id}`}
                          fields={VENDOR_FIELDS}
                          values={v}
                          missing={missingContactFields(v)}
                          onSave={(changes) => update(v, changes)}
                          onCancel={() => setEditingId(null)}
                        />
                      </td>
                    </tr>
                  ) : (
                    <tr key={v.id}>
                      <td>
                        <Link className="row-title" to={`/vendors/${v.id}`}>{v.name}</Link>
                        <div><MissingContact vendor={v} /></div>
                      </td>
                      <td><Cell value={v.contact_name} /></td>
                      <td className="wrap-cell"><Cell value={v.email} href={v.email && `mailto:${v.email}`} /></td>
                      <td><Cell value={v.phone} href={v.phone && `tel:${v.phone.replace(/[^\d+]/g, '')}`} /></td>
                      <td className="actions">
                        <button
                          type="button"
                          className="secondary-button small-button"
                          onClick={() => { setEditingId(v.id); setAdding(false); setNotice('') }}
                          disabled={editingId !== null}
                          aria-label={`Edit ${v.name}`}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
