import { useCallback, useEffect, useState } from 'react'
import { api } from '../api.js'

// Vendors (RAMP-145, API from RAMP-144): GET/POST /api/vendors, GET/PATCH/DELETE /api/vendors/:id,
// GET /api/vendors/:id/bom-lines. BOM lines only carry vendor_id, so pages load the list once
// and look each vendor up by id.

export const VENDOR_FIELDS = [
  { name: 'name', label: 'Vendor name', maxLength: 255, required: true },
  { name: 'contact_name', label: 'Contact person', maxLength: 255 },
  { name: 'email', label: 'Email', type: 'email', maxLength: 255 },
  { name: 'phone', label: 'Phone', type: 'tel', maxLength: 50 },
  { name: 'notes', label: 'Notes', type: 'textarea', maxLength: 5000 },
]

// The details follow-ups need: a person and a way to reach them
export const CONTACT_FIELDS = ['contact_name', 'email', 'phone']

function isBlank(value) {
  return value === null || value === undefined || String(value).trim() === ''
}

export function missingContactFields(vendor) {
  return CONTACT_FIELDS.filter((field) => isBlank(vendor?.[field]))
}

// A-Z ignoring case, so "Pezzetti" comes before "PROGRESSIVE LABEL" whatever the database's collation
export function sortVendors(vendors) {
  return [...(vendors || [])].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
}

export function vendorsById(vendors) {
  return new Map((vendors || []).map((v) => [v.id, v]))
}

// Options for the vendor dropdown on a BOM line; '' means no vendor
export function vendorOptions(vendors) {
  return [
    { value: '', label: 'No vendor' },
    ...(vendors || []).map((v) => ({ value: v.id, label: v.name })),
  ]
}

// Loads the vendor list once. `available` is false when the backend has no vendors API yet (404),
// so pages can hide vendor features instead of showing an error.
export function useVendors() {
  const [vendors, setVendors] = useState([])
  const [available, setAvailable] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reloads, setReloads] = useState(0)

  useEffect(() => {
    let cancelled = false
    api('/vendors')
      .then((data) => {
        if (cancelled) return
        setVendors(sortVendors(data.vendors))
        setAvailable(true)
        setError(null)
      })
      .catch((err) => {
        if (cancelled) return
        if (err.status === 404) setAvailable(false)
        else setError(err)
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [reloads])

  const reload = useCallback(() => setReloads((n) => n + 1), [])
  return { vendors, setVendors, available, loading, error, reload }
}
