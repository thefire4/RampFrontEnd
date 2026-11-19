import { useEffect, useRef, useState } from 'react'

// Shared edit form for BOM lines and project details (RAMP-134).
// - Highlights fields listed in `missing` and focuses the first one when it opens
// - Checks the input before saving and shows each problem next to its field
// - Sends only the fields that changed; a cleared field is sent as null
//
// fields: [{ name, label, type?, maxLength?, required?, options? }]
//   type: 'text' (default) | 'number' | 'date' | 'email' | 'tel' | 'textarea' | 'select' | 'checkboxes'
//   options (select only): [{ value, label }]; values are numbers or strings, '' means none (sent as null)
//   options (checkboxes): [{ value, label }]; the field is a list of the ticked values (sent as an array)
// creating: true for an "add new" form, where required fields must be filled in
//   even if they started blank, and saving with nothing filled in is an error.
// onSave(changes) should throw to show an error and keep the form open.

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
// Loose on purpose: something@something.something, no spaces
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function toFormValue(value) {
  if (Array.isArray(value)) return [...value].sort().join(',')
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
function check(fields, form, initial, creating) {
  const changes = {}
  const errors = {}

  for (const { name, label, type, maxLength, required, options } of fields) {
    const value = form[name].trim()
    if (creating && required && value === '') {
      errors[name] = `${label} is required.`
      continue
    }
    if (value === initial[name].trim()) continue

    if (type === 'checkboxes') {
      changes[name] = value ? value.split(',') : []
      continue
    }

    if (value === '') {
      if (required) errors[name] = `${label} can't be left blank.`
      else changes[name] = null
      continue
    }

    if (type === 'select') {
      // The <select> holds strings; send the option's own value (e.g. a numeric id)
      const option = (options || []).find((o) => String(o.value) === value)
      if (option) changes[name] = option.value
      else errors[name] = `Choose a ${lowerFirst(label)} from the list.`
      continue
    }

    if (type === 'email' && !EMAIL_PATTERN.test(value)) {
      errors[name] = `${label} must be an email address, like name@example.com.`
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

export default function EditForm({
  label, idPrefix, fields, values, missing = [], onSave, onCancel, className = '', creating = false, saveLabel = 'Save',
}) {
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
    const { changes, errors: found } = check(fields, form, initial, creating)

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
        {fields.map(({ name, label: fieldLabel, type, maxLength, required, options }) => {
          const id = `${idPrefix}-${name}`
          const isMissing = missingSet.has(name)
          const error = errors[name]
          const describedBy = [isMissing && `${id}-flag`, error && `${id}-error`].filter(Boolean).join(' ')
          const classes = [
            'field', type === 'textarea' && 'field-wide', isMissing && 'field-missing', error && 'field-invalid',
          ].filter(Boolean).join(' ')
          const shared = {
            id,
            ref: (el) => { inputs.current[name] = el },
            value: form[name],
            onChange: update(name),
            'aria-invalid': error ? true : undefined,
            'aria-describedby': describedBy || undefined,
            'aria-required': creating && required ? true : undefined,
          }

          let control
          if (type === 'checkboxes') {
            const ticked = new Set(form[name] ? form[name].split(',') : [])
            const toggle = (value) => {
              const next = new Set(ticked)
              if (next.has(value)) next.delete(value)
              else next.add(value)
              update(name)({ target: { value: [...next].sort().join(',') } })
            }
            control = (
              <div className="checkbox-group" role="group" aria-labelledby={`${id}-label`}>
                {(options || []).map((o, i) => (
                  <label key={o.value} className="checkbox-option">
                    <input
                      type="checkbox"
                      ref={i === 0 ? (el) => { inputs.current[name] = el } : undefined}
                      checked={ticked.has(o.value)}
                      onChange={() => toggle(o.value)}
                    />
                    {o.label}
                  </label>
                ))}
              </div>
            )
          } else if (type === 'select') {
            control = (
              <select {...shared}>
                {(options || []).map((o) => (
                  <option key={String(o.value)} value={String(o.value)}>{o.label}</option>
                ))}
              </select>
            )
          } else if (type === 'textarea') {
            control = <textarea {...shared} rows={3} maxLength={maxLength} />
          } else {
            const inputType = ['number', 'date', 'email', 'tel'].includes(type) ? type : 'text'
            control = (
              <input
                {...shared}
                type={inputType}
                step={type === 'number' ? 'any' : undefined}
                min={type === 'number' ? 0 : undefined}
                maxLength={type === 'number' || type === 'date' ? undefined : maxLength}
                autoComplete={type === 'email' ? 'email' : type === 'tel' ? 'tel' : undefined}
              />
            )
          }

          return (
            <div className={classes} key={name}>
              <div className="field-label-row">
                {type === 'checkboxes'
                  ? <span className="field-label" id={`${id}-label`}>{fieldLabel}</span>
                  : <label htmlFor={id}>{fieldLabel}{creating && required && <span className="required-mark" aria-hidden="true"> *</span>}</label>}
                {isMissing && <span className="field-flag" id={`${id}-flag`}>Missing</span>}
              </div>
              {control}
              {error && <span className="field-error" id={`${id}-error`}>{error}</span>}
            </div>
          )
        })}
      </div>

      <div className="edit-actions">
        <button type="submit" className="primary-button" disabled={saving}>
          {saving ? 'Saving…' : saveLabel}
        </button>
        <button type="button" className="secondary-button" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </form>
  )
}
