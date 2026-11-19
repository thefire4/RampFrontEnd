// Sourcing details on each BOM line (RAMP-142), matching Enmanuel's backend (RAMP-140/141).
// Fields on every BOM line, also accepted by PATCH /api/materials/:id:
//   supplied_by:      free text, e.g. 'Customer', 'BTU', 'Factory A' (null when not set)
//   required_arrival: 'YYYY-MM-DD' | null   (required arrival date at BTU)
//   sourcing_status:  'awaiting' | 'delayed' | 'in stock' | null
//   approvals_needed: free text, e.g. 'Lab dip and test report' (null when none)

// Suggested in the Supplied by field; any other text is fine too
export const SUPPLIED_BY_SUGGESTIONS = ['Customer', 'BTU']

// `tone` picks the badge color; the name is always shown as text too
export const SOURCING_STATUSES = [
  { value: 'awaiting', label: 'Awaiting', tone: 'awaiting' },
  { value: 'delayed', label: 'Delayed', tone: 'delayed' },
  { value: 'in stock', label: 'In stock', tone: 'in-stock' },
]

// The Edit form's sourcing fields; '' in the status dropdown means not set yet
export const SOURCING_FIELDS = [
  { name: 'supplied_by', label: 'Supplied by', maxLength: 255, suggestions: SUPPLIED_BY_SUGGESTIONS },
  { name: 'required_arrival', label: 'Required arrival at BTU', type: 'date' },
  { name: 'sourcing_status', label: 'Sourcing status', type: 'select', options: [{ value: '', label: 'Not set' }, ...SOURCING_STATUSES] },
  { name: 'approvals_needed', label: 'Approvals needed', type: 'textarea', maxLength: 1000 },
]

// A known status, or the raw value shown plainly, so an unexpected value never breaks the page
export function statusInfo(value) {
  if (value === null || value === undefined || value === '') return null
  return SOURCING_STATUSES.find((s) => s.value === value) ?? { value, label: String(value), tone: 'other' }
}

// Approvals as text, whatever shape the server sends (text, a list, or nothing)
export function approvalsText(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join(', ')
  if (typeof value === 'string') return value.trim()
  return ''
}

// True when the server sends sourcing details; until then the columns stay hidden
export function hasSourcing(colorways) {
  return colorways.some((c) => c.materials.some((m) => 'sourcing_status' in m))
}

// Today as YYYY-MM-DD in the user's time zone, to compare with required arrival dates
export function localToday(now = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

// Past its required arrival date and not in stock yet
export function isLate(material, today) {
  if (!material.required_arrival) return false
  if (material.sourcing_status === 'in stock') return false
  return material.required_arrival < today
}
