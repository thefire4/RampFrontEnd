import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import { useCurrentUser } from '../auth/authContext.js'
import { fieldLabel } from '../pages/bomFields.js'
import {
  isOpenTask, isOverdue, ownerOptions, sortTasks, statusLabel, TASK_STATUSES, todayISO, useOwnerChoices,
} from './tasks.js'

// RAMP-139: a project's tasks (one per BOM line missing info) with owner, status and due date
// that save as soon as they're changed, filtered by status.

const FILTERS = [{ value: 'all', label: 'All' }, ...TASK_STATUSES]

function missingText(task) {
  const fields = task.missing_fields || []
  if (fields.length === 0) return 'Nothing missing'
  return fields.map((f) => fieldLabel(f).toLowerCase()).join(', ')
}

// A full, sensible date; typing in a date field passes through partial years like "0002"
function isUsableDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const year = Number(value.slice(0, 4))
  return year >= 2000 && year <= 2100 && !Number.isNaN(new Date(value).getTime())
}

function TaskRow({ task, line, projectId, owners, currentUser, today, onSaved }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  // The due date being typed; saved when the field is left, not on every keystroke
  const [dueDraft, setDueDraft] = useState(null)
  const dueValue = dueDraft ?? task.due_date ?? ''

  function commitDueDate(e) {
    // A half-typed date reads as empty, but the browser marks it as bad input
    if (e?.target?.validity?.badInput) {
      setError('Enter a full due date, like 11/25/2026.')
      return
    }
    if (dueDraft === null) return
    const next = dueDraft || null
    if (next === (task.due_date || null)) { setDueDraft(null); return }
    if (next && !isUsableDate(next)) {
      setError('Enter a full due date, like 11/25/2026.')
      return
    }
    save({ due_date: next }).then(() => setDueDraft(null))
  }
  const title = line ? [line.name, line.material].filter(Boolean).join(' · ') || 'Unnamed line' : `BOM line ${task.bom_line_id}`
  const label = line?.name || `line ${task.bom_line_id}`

  async function save(changes) {
    setSaving(true)
    setError('')
    try {
      const data = await api(`/tasks/${encodeURIComponent(task.id)}`, { method: 'PATCH', body: changes })
      onSaved(data.task ?? { ...task, ...changes })
    } catch (err) {
      setError(`Couldn't save: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  const overdue = isOverdue(task, today)
  const rowClass = [task.status === 'done' ? 'task-done' : '', overdue ? 'task-overdue' : ''].filter(Boolean).join(' ')

  return (
    <tr className={rowClass || undefined}>
      <td>
        <Link className="row-title" to={`/projects/${projectId}/parts/${task.bom_line_id}`}>{title}</Link>
        {line?.colorway && <div className="row-subtitle">{line.colorway}</div>}
      </td>
      <td className="wrap-cell">
        {task.status === 'done' && (task.missing_fields || []).length === 0
          ? <span className="muted">Filled in</span>
          : <span className="missing-text">{missingText(task)}</span>}
      </td>
      <td>
        <select
          aria-label={`Owner for ${label}`}
          value={task.owner_id ? String(task.owner_id) : ''}
          onChange={(e) => save({ owner_id: e.target.value ? Number(e.target.value) : null })}
          disabled={saving}
        >
          {ownerOptions(owners, task, currentUser).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </td>
      <td>
        <select
          aria-label={`Status for ${label}`}
          value={task.status}
          onChange={(e) => save({ status: e.target.value })}
          disabled={saving}
        >
          {TASK_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </td>
      <td>
        <input
          type="date"
          aria-label={`Due date for ${label}`}
          value={dueValue}
          onChange={(e) => { setDueDraft(e.target.value); setError('') }}
          onBlur={commitDueDate}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitDueDate(e) } }}
          aria-invalid={error ? true : undefined}
          disabled={saving}
        />
        {overdue && <div><span className="badge badge-missing">Overdue</span></div>}
        {error && <div className="field-error" role="alert">{error}</div>}
      </td>
    </tr>
  )
}

export default function TaskList({ projectId, tasks, lines, error, onTaskSaved }) {
  const { user, isAdmin } = useCurrentUser()
  const owners = useOwnerChoices(user, isAdmin)
  const [filter, setFilter] = useState('all')
  const today = todayISO()

  // Sort when the tasks load or the filter changes, not on every edit, so a row
  // doesn't jump away right after you change its status or due date
  const orderKey = `${filter}|${tasks.map((t) => t.id).sort((a, b) => a - b).join(',')}`
  const [order, setOrder] = useState({ key: null, ids: [] })
  const filtered = filter === 'all' ? tasks : tasks.filter((t) => t.status === filter)
  if (order.key !== orderKey) setOrder({ key: orderKey, ids: sortTasks(filtered).map((t) => t.id) })
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const visible = (order.key === orderKey ? order.ids : sortTasks(filtered).map((t) => t.id)).map((id) => byId.get(id)).filter(Boolean)

  const counts = Object.fromEntries(TASK_STATUSES.map((s) => [s.value, tasks.filter((t) => t.status === s.value).length]))
  const openCount = tasks.filter(isOpenTask).length

  return (
    <section className="panel panel-flush" aria-label="Tasks">
      <div className="panel-pad task-toolbar">
        <p className="muted">
          One task per BOM line that&apos;s missing info. A task closes by itself once its line is filled in.
          {' '}{openCount} open.
        </p>
        <div className="segmented" role="group" aria-label="Filter tasks by status">
          {FILTERS.map((f) => (
            <button key={f.value} type="button" aria-pressed={filter === f.value} onClick={() => setFilter(f.value)}>
              {f.label} · {f.value === 'all' ? tasks.length : counts[f.value]}
            </button>
          ))}
        </div>
      </div>
      {error && <div className="alert alert-error panel-pad" role="alert">Couldn&apos;t load tasks: {error.message}</div>}

      {tasks.length === 0 ? (
        <p className="muted panel-pad">No tasks. Every BOM line has its required details.</p>
      ) : visible.length === 0 ? (
        <p className="muted panel-pad">No {statusLabel(filter).toLowerCase()} tasks.</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table task-table">
            <thead>
              <tr>
                <th scope="col">BOM line</th>
                <th scope="col">What&apos;s missing</th>
                <th scope="col">Owner</th>
                <th scope="col">Status</th>
                <th scope="col">Due date</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  line={lines.get(task.bom_line_id)}
                  projectId={projectId}
                  owners={owners}
                  currentUser={user}
                  today={today}
                  onSaved={onTaskSaved}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
