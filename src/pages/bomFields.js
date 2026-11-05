// Shared by the missing-items list and the part detail page.
export const PART_FIELDS = [
  ['name', 'Description'],
  ['material', 'Material'],
  ['supplier', 'Supplier'],
  ['supplier_contact', 'Responsible'],
  ['color', 'Color'],
  ['quantity', 'Yield'],
  ['uom', 'Unit'],
  ['location', 'Placement'],
  ['material_size', 'Size / width'],
  ['article_no', 'Article #'],
  ['notes', 'Notes'],
]

const LABELS = Object.fromEntries(PART_FIELDS)

export function fieldLabel(field) {
  return LABELS[field] || field
}

export function isBlank(value) {
  return value === null || value === undefined || String(value).trim() === ''
}

// Python's round(): halves go to the even number (12.5 -> 12, 13.5 -> 14), unlike Math.round
function roundHalfEven(value) {
  const rounded = Math.round(value)
  const isHalf = Math.abs(value - Math.trunc(value) - 0.5) < 1e-9
  return isHalf && rounded % 2 !== 0 ? rounded - 1 : rounded
}

// Percent of BOM lines with every required field filled in, used everywhere a percent is shown
// so the projects list and the project page always agree.
// Rounds like the API's percent_complete (Python's round()), with two exceptions so the
// number never misleads: 100% only when nothing is missing (199 of 200 is 99%), and
// 0% only when nothing is complete (1 of 300 is 1%).
export function percentComplete(total, missing) {
  if (!total) return 0
  const complete = Math.min(total, Math.max(0, total - (missing || 0)))
  const percent = roundHalfEven((complete / total) * 100)
  if (percent === 100 && complete < total) return 99
  if (percent === 0 && complete > 0) return 1
  return percent
}

export function missingList(item) {
  return (item.missing_fields || []).map((f) => fieldLabel(f).toLowerCase()).join(', ')
}