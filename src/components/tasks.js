import { useEffect, useState } from 'react'
import { api } from '../api.js'

// Tasks for BOM lines missing info (RAMP-139, API from RAMP-138):
// GET /api/projects/:id/tasks, PATCH /api/tasks/:id with owner_id, status and/or due_date.
// The backend creates a task for each incomplete line and closes it when the line is filled in.

export const TASK_STATUSES = [
  { value: 'open', label: 'Open' },
  { value: 'in progress', label: 'In progress' },
  { value: 'done', label: 'Done' },
]

export function statusLabel(status) {
  return TASK_STATUSES.find((s) => s.value === status)?.label ?? status
}

export function isOpenTask(task) {
  return task.status !== 'done'
}

// Today as YYYY-MM-DD in the user's time zone, to compare with due dates
export function todayISO(now = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function isOverdue(task, today = todayISO()) {
  return isOpenTask(task) && Boolean(task.due_date) && task.due_date < today
}

const STATUS_ORDER = { 'in progress': 0, open: 1, done: 2 }

// Unfinished first (in progress, then open), then by due date with undated last
export function sortTasks(tasks) {
  return [...tasks].sort((a, b) =>
    (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3)
    || (a.due_date || '9999-99-99').localeCompare(b.due_date || '9999-99-99')
    || a.id - b.id
  )
}

// Loads a project's tasks; `reloads` changing loads them again (e.g. after a BOM line is saved).
// `available` is false when the server has no tasks API yet (404), so the page can hide tasks.
export function useProjectTasks(projectId, reloads = 0) {
  const [state, setState] = useState({ key: null, tasks: [], available: true, error: null })
  const key = `${projectId}:${reloads}`

  useEffect(() => {
    let cancelled = false
    api(`/projects/${encodeURIComponent(projectId)}/tasks`)
      .then((data) => { if (!cancelled) setState({ key, tasks: data.tasks || [], available: true, error: null }) })
      .catch((err) => {
        if (cancelled) return
        if (err.status === 404) setState({ key, tasks: [], available: false, error: null })
        else setState((prev) => ({ ...prev, key, error: err }))
      })
    return () => { cancelled = true }
  }, [projectId, key])

  const setTasks = (update) => setState((prev) => ({ ...prev, tasks: update(prev.tasks) }))
  // Keep showing the last tasks while a reload is on its way
  return { ...state, loading: state.key === null, setTasks }
}

// Open tasks per project for the projects list: { counts: Map(projectId -> number), available }.
// Uses `open_tasks` from GET /api/projects when the server sends it; otherwise counts each project's tasks.
export function useOpenTaskCounts(projects) {
  const ids = projects.map((p) => p.id).join(',')
  const fromList = projects.length > 0 && projects.every((p) => typeof p.open_tasks === 'number')
  const [state, setState] = useState({ ids: null, counts: new Map(), available: true })

  useEffect(() => {
    if (fromList || !ids) return undefined
    let cancelled = false
    Promise.all(ids.split(',').map((id) =>
      api(`/projects/${encodeURIComponent(id)}/tasks`)
        .then((data) => [id, (data.tasks || []).filter(isOpenTask).length])
        .catch((err) => [id, err.status === 404 ? 'missing' : null])
    )).then((results) => {
      if (cancelled) return
      // Every project 404ing means the server has no tasks yet
      const available = !results.every(([, n]) => n === 'missing')
      const counts = new Map(results.filter(([, n]) => typeof n === 'number').map(([id, n]) => [Number(id), n]))
      setState({ ids, counts, available })
    })
    return () => { cancelled = true }
  }, [ids, fromList])

  if (fromList) return { counts: new Map(projects.map((p) => [p.id, p.open_tasks])), available: true }
  return { counts: state.ids === ids ? state.counts : new Map(), available: state.available }
}

// Who can own a task. Admins can list every user; everyone else can pick themselves
// (the full user list is admin-only on the server for now).
export function useOwnerChoices(currentUser, isAdmin) {
  const [users, setUsers] = useState(null)

  useEffect(() => {
    if (!isAdmin) return undefined
    let cancelled = false
    api('/users')
      .then((data) => { if (!cancelled) setUsers((data.users || []).map((u) => ({ id: u.id, username: u.username }))) })
      .catch(() => { if (!cancelled) setUsers(null) })
    return () => { cancelled = true }
  }, [isAdmin])

  if (isAdmin && users) return users
  return currentUser?.id ? [{ id: currentUser.id, username: currentUser.username }] : []
}

// Owner dropdown options for one task: Unassigned, the people above, and the current owner if not listed
export function ownerOptions(choices, task, currentUser) {
  const options = [{ value: '', label: 'Unassigned' }]
  for (const u of choices) {
    options.push({ value: String(u.id), label: u.id === currentUser?.id ? `${u.username} (me)` : u.username })
  }
  if (task.owner_id && !choices.some((u) => u.id === task.owner_id)) {
    options.push({ value: String(task.owner_id), label: task.owner || `User ${task.owner_id}` })
  }
  return options
}
