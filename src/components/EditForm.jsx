import { useEffect, useRef, useState } from 'react'

// Shared edit form for BOM lines and project details (RAMP-134).
// - Highlights fields listed in `missing` and focuses the first one when it opens
// - Checks the input before saving and shows each problem next to its field
// - Sends only the fields that changed; a cleared field is sent as null
//
// fields: [{ name, label, type?: 'text' | 'number' | 'date', maxLength?, required? }]
// onSave(changes) should throw to show an error and keep the form open.

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function toFormValue(value) {
  return value === null || value === undefined ? '' : String(value)
}

function lowerFirst(text) {
  return text.charAt(0).toLowerCase() + text.slice(1)
}

function listWithAnd(items) {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

// Returns { changes, errors } for the current form values
function check(fields, form, initial) {
  const changes = {}
  const errors = {}

  for (const { name, label, type, maxLength, required } of fields) {
    const value = form[name].trim()
    if (value === initial[name].trim()) continue

    if (value === '') {
      if (required) errors[name] = `${label} can't be left blank.`
      else changes[name] = null
      continue
    }

    if (type === 'number') {
      const number = Number(value)
      if (!Number.isFinite(number) || number < 0) errors[name] = `${label} must be a number of 0 or more.`
      else changes[name] = number
      continue
    }

    if (type === 'date' && (!DATE_PATTERN.test(value) || Number.isNaN(new Date(value).getTime()))) {
      errors[name] = `${label} must be a valid date.`
      continue
    }

    if (maxLength && value.length > maxLength) {
      errors[name] = `${label} is too long (${maxLength} characters max).`
      continue
    }

    changes[name] = value
  }

  return { changes, errors }
}

export default function EditForm({ label, idPrefix, fields, values, missing = [], onSave, onCancel, className = '' }) {
  const [initial] = useState(() =>
    Object.fromEntries(fields.map(({ name }) => [name, toFormValue(values[name])]))
  )
  const [form, setForm] = useState(initial)
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [saving, setSaving] = useState(false)
  const inputs = useRef({})

  const missingSet = new Set(missing)
  const missingLabels = fields.filter((f) => missingSet.has(f.name)).map((f) => lowerFirst(f.label))
  const errorCount = Object.keys(errors).length

  // Start where the user is most likely needed: the first missing field, or the first field
  useEffect(() => {
    const first = fields.find((f) => missingSet.has(f.name)) ?? fields[0]
    inputs.current[first?.name]?.focus()
    // Only on open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function update(name) {
    return (e) => {
      setForm({ ...form, [name]: e.target.value })
      // Clear a field's error as soon as the user changes it
      if (errors[name]) {
        const rest = { ...errors }
        delete rest[name]
        setErrors(rest)
      }
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const { changes, errors: found } = check(fields, form, initial)

    setServerError('')
    setErrors(found)
    const firstError = fields.find((f) => found[f.name])
    if (firstError) {
      inputs.current[firstError.name]?.focus()
      return
    }

    if (Object.keys(changes).length === 0) {
      onCancel()
      return
    }

    setSaving(true)
    try {
      await onSave(changes)
    } catch (err) {
      setServerError(err.message)
      setSaving(false)
    }
  }

  return (
    <form
      className={`edit-form ${className}`.trim()}
      aria-label={label}
      onSubmit={handleSubmit}
      onKeyDown={(e) => e.key === 'Escape' && !saving && onCancel()}
      noValidate
    >
      {serverError && <div className="alert alert-error" role="alert">{serverError}</div>}
      {errorCount > 0 && (
        <div className="alert alert-error" role="alert">
          {errorCount === 1 ? 'Fix the highlighted field before saving.' : `Fix the ${errorCount} highlighted fields before saving.`}
        </div>
      )}
      {missingLabels.length > 0 && (
        <p className="form-hint">Fill in the highlighted {missingLabels.length === 1 ? 'field' : 'fields'}: {listWithAnd(missingLabels)}.</p>
      )}

      <div className="edit-grid">
        {fields.map(({ name, label: fieldLabel, type, maxLength }) => {
          const id = `${idPrefix}-${name}`
          const isMissing = missingSet.has(name)
          const error = errors[name]
          const describedBy = [isMissing && `${id}-flag`, error && `${id}-error`].filter(Boolean).join(' ')
          const classes = ['field', isMissing && 'field-missing', error && 'field-invalid'].filter(Boolean).join(' ')

          return (
            <div className={classes} key={name}>
              <div className="field-label-row">
                <label htmlFor={id}>{fieldLabel}</label>
                {isMissing && <span className="field-flag" id={`${id}-flag`}>Missing</span>}
              </div>
              <input
                id={id}
                ref={(el) => { inputs.current[name] = el }}
                type={type === 'number' || type === 'date' ? type : 'text'}
                step={type === 'number' ? 'any' : undefined}
                min={type === 'number' ? 0 : undefined}
                maxLength={type === 'number' || type === 'date' ? undefined : maxLength}
                value={form[name]}
                onChange={update(name)}
                aria-invalid={error ? true : undefined}
                aria-describedby={describedBy || undefined}
              />
              {error && <span className="field-error" id={`${id}-error`}>{error}</span>}
            </div>
          )
        })}
      </div>

      <div className="edit-actions">
        <button type="submit" className="primary-button" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="secondary-button" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </form>
  )
}
