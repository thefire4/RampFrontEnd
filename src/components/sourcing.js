// Sourcing details on each BOM line (RAMP-142; backend RAMP-141).
// Agreed fields on every BOM line, also accepted by PATCH /api/materials/:id:
//   supplied_by:      'customer' | 'btu' | null
//   required_arrival: 'YYYY-MM-DD' | null   (required arrival date at BTU)
//   sourcing_status:  'rfq sent' | 'ordered' | 'shipped' | 'received' | 'approved' | null
//   approvals_needed: ['lab dip' | 'test report' | 'sample yardage', ...]

export const SUPPLIED_BY = [
  { value: 'customer', label: 'Customer' },
  { value: 'btu', label: 'BTU' },
]

// In the order a material moves through; `tone` picks the badge color
export const SOURCING_STATUSES = [
  { value: 'rfq sent', label: 'RFQ sent', tone: 'rfq' },
  { value: 'ordered', label: 'Ordered', tone: 'ordered' },
  { value: 'shipped', label: 'Shipped', tone: 'shipped' },
  { value: 'received', label: 'Received', tone: 'received' },
  { value: 'approved', label: 'Approved', tone: 'approved' },
]

export const APPROVALS = [
  { value: 'lab dip', label: 'Lab dip' },
  { value: 'test report', label: 'Test report' },
  { value: 'sample yardage', label: 'Sample yardage' },
]

// The Edit form's sourcing fields; '' in a dropdown means not set yet
export const SOURCING_FIELDS = [
  { name: 'supplied_by', label: 'Supplied by', type: 'select', options: [{ value: '', label: 'Not set' }, ...SUPPLIED_BY] },
  { name: 'required_arrival', label: 'Required arrival at BTU', type: 'date' },
  { name: 'sourcing_status', label: 'Sourcing status', type: 'select', options: [{ value: '', label: 'Not started' }, ...SOURCING_STATUSES] },
  { name: 'approvals_needed', label: 'Approvals needed', type: 'checkboxes', options: APPROVALS },
]

const label = (list, value) => list.find((o) => o.value === value)?.label ?? value

export const suppliedByLabel = (value) => label(SUPPLIED_BY, value)
export const approvalLabel = (value) => label(APPROVALS, value)

export function statusInfo(value) {
  return SOURCING_STATUSES.find((s) => s.value === value) ?? null
}

// True when the server sends sourcing details (RAMP-141 merged); until then the columns stay hidden
export function hasSourcing(colorways) {
  return colorways.some((c) => c.materials.some((m) => 'sourcing_status' in m))
}

// Today as YYYY-MM-DD in the user's time zone, to compare with required arrival dates
export function localToday(now = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

// Past its required arrival date and not at BTU yet (received or approved means it arrived)
export function isLate(material, today) {
  if (!material.required_arrival) return false
  if (['received', 'approved'].includes(material.sourcing_status)) return false
  return material.required_arrival < today
}
