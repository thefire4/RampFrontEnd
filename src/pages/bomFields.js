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

export function missingList(item) {
  return (item.missing_fields || []).map((f) => fieldLabel(f).toLowerCase()).join(', ')
}