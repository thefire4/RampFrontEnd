import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, test, vi } from 'vitest'
import { api } from '../api.js'
import ProjectsList from './ProjectsList.jsx'

vi.mock('../api.js', () => ({ api: vi.fn() }))

test('lists projects with links and missing counts', async () => {
  api.mockResolvedValue({ projects: [{ id: 7, name: 'Test Jacket', customer: 'Acme', stage: 'blocked', missing_bom_items: 3 }] })
  render(<MemoryRouter><ProjectsList /></MemoryRouter>)

  expect(await screen.findByRole('link', { name: 'Test Jacket' })).toHaveAttribute('href', '/projects/7')
  expect(screen.getByText('3 missing')).toBeInTheDocument()
})

test('shows empty state', async () => {
  api.mockResolvedValue({ projects: [] })
  render(<MemoryRouter><ProjectsList /></MemoryRouter>)

  expect(await screen.findByText('No projects yet')).toBeInTheDocument()
})