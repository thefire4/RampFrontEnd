import { expect, test } from 'vitest'
import { isOverdue, ownerOptions, sortTasks, todayISO } from './tasks.js'

const task = (id, status, due_date = null, extra = {}) => ({ id, status, due_date, ...extra })

test('unfinished tasks come first, then by due date with undated last', () => {
  const sorted = sortTasks([
    task(1, 'done', '2026-01-01'),
    task(2, 'open'),
    task(3, 'open', '2026-12-01'),
    task(4, 'in progress', '2026-12-05'),
    task(5, 'open', '2026-11-20'),
  ])
  expect(sorted.map((t) => t.id)).toEqual([4, 5, 3, 2, 1])
})

test('only unfinished tasks past their due date are overdue', () => {
  const today = '2026-11-18'
  expect(isOverdue(task(1, 'open', '2026-11-17'), today)).toBe(true)
  expect(isOverdue(task(2, 'in progress', '2026-11-18'), today)).toBe(false)
  expect(isOverdue(task(3, 'done', '2026-01-01'), today)).toBe(false)
  expect(isOverdue(task(4, 'open'), today)).toBe(false)
})

test('today is in the local time zone', () => {
  expect(todayISO(new Date(2026, 10, 3, 23, 30))).toBe('2026-11-03')
})

test('owner choices: unassigned, people, and the current owner if not listed', () => {
  const me = { id: 2, username: 'andy' }
  const options = ownerOptions([me], task(1, 'open', null, { owner_id: 3, owner: 'rodrigo' }), me)
  expect(options).toEqual([
    { value: '', label: 'Unassigned' },
    { value: '2', label: 'andy (me)' },
    { value: '3', label: 'rodrigo' },
  ])
})
