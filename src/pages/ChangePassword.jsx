import { useState } from 'react'
import { api } from '../api.js'

const emptyForm = { current_password: '', new_password: '', confirm_password: '' }

export default function ChangePassword() {
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function update(field) {
    return (e) => setForm({ ...form, [field]: e.target.value })
  }

  // Same rules as the backend, checked here first so the user gets instant feedback.
  function validate() {
    if (!form.current_password || !form.new_password || !form.confirm_password) {
      return 'Fill in all three password fields.'
    }
    if (form.new_password.length < 8) return 'New password must be at least 8 characters.'
    if (form.new_password !== form.confirm_password) return 'New passwords do not match.'
    if (form.new_password === form.current_password) {
      return 'New password must be different from your current password.'
    }
    return ''
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSuccess('')
    const problem = validate()
    if (problem) {
      setError(problem)
      return
    }

    setError('')
    setSubmitting(true)
    try {
      const data = await api('/change-password', { method: 'POST', body: form })
      setSuccess(data.message || 'Password changed.')
      setForm(emptyForm)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className="page-header">
        <h1>Change password</h1>
        <p>Use at least 8 characters.</p>
      </div>

      <form className="form-card" onSubmit={handleSubmit} noValidate>
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        {success && <div className="alert alert-success" role="status">{success}</div>}

        <label htmlFor="current_password">Current password</label>
        <input
          id="current_password"
          type="password"
          autoComplete="current-password"
          value={form.current_password}
          onChange={update('current_password')}
        />
        <label htmlFor="new_password">New password</label>
        <input
          id="new_password"
          type="password"
          autoComplete="new-password"
          value={form.new_password}
          onChange={update('new_password')}
        />
        <label htmlFor="confirm_password">Confirm new password</label>
        <input
          id="confirm_password"
          type="password"
          autoComplete="new-password"
          value={form.confirm_password}
          onChange={update('confirm_password')}
        />
        <button type="submit" className="primary-button" disabled={submitting}>
          {submitting ? 'Saving…' : 'Change password'}
        </button>
      </form>
    </>
  )
}
