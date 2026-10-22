import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { useAuth } from '../auth/authContext.js'

const emptyForm = { username: '', email: '', password: '', role: 'user' }

export default function Users() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState('')

  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState('')
  const [notice, setNotice] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [removingId, setRemovingId] = useState(null)

  useEffect(() => {
    api('/users')
      .then((data) => setUsers(data.users))
      .catch((err) => setListError(err.message))
      .finally(() => setLoading(false))
  }, [])

  function update(field) {
    return (e) => setForm({ ...form, [field]: e.target.value })
  }

  async function handleAdd(e) {
    e.preventDefault()
    setNotice('')
    if (!form.username.trim() || !form.email.trim() || !form.password) {
      setFormError('Username, email and password are required.')
      return
    }
    if (form.password.length < 8) {
      setFormError('Password must be at least 8 characters.')
      return
    }

    setFormError('')
    setSubmitting(true)
    try {
      const data = await api('/users', {
        method: 'POST',
        body: { ...form, username: form.username.trim(), email: form.email.trim() },
      })
      setUsers((prev) => [...prev, data.user])
      setNotice(`Added ${data.user.username}.`)
      setForm(emptyForm)
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRemove(target) {
    if (!window.confirm(`Remove ${target.username}? They will no longer be able to log in.`)) return

    setNotice('')
    setListError('')
    setRemovingId(target.id)
    try {
      await api(`/users/${target.id}`, { method: 'DELETE' })
      setUsers((prev) => prev.filter((u) => u.id !== target.id))
      setNotice(`Removed ${target.username}.`)
    } catch (err) {
      setListError(err.message)
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <>
      <div className="page-header">
        <h1>Users</h1>
        <p>Add and remove employee accounts. Only admins can see this page.</p>
      </div>

      {notice && <div className="alert alert-success" role="status">{notice}</div>}

      <section className="panel" aria-labelledby="add-user-heading">
        <h2 id="add-user-heading">Add employee</h2>
        <form className="inline-form" onSubmit={handleAdd} noValidate>
          {formError && <div className="alert alert-error" role="alert">{formError}</div>}
          <div className="field">
            <label htmlFor="new-username">Username</label>
            <input id="new-username" autoComplete="off" value={form.username} onChange={update('username')} />
          </div>
          <div className="field">
            <label htmlFor="new-email">Email</label>
            <input id="new-email" type="email" autoComplete="off" value={form.email} onChange={update('email')} />
          </div>
          <div className="field">
            <label htmlFor="new-password">Temporary password</label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={update('password')}
            />
          </div>
          <div className="field">
            <label htmlFor="new-role">Role</label>
            <select id="new-role" value={form.role} onChange={update('role')}>
              <option value="user">Employee</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button type="submit" className="primary-button" disabled={submitting}>
            {submitting ? 'Adding…' : 'Add employee'}
          </button>
        </form>
      </section>

      <section className="panel" aria-labelledby="user-list-heading">
        <h2 id="user-list-heading">All users</h2>
        {listError && <div className="alert alert-error" role="alert">{listError}</div>}

        {loading ? (
          <p className="muted">Loading users…</p>
        ) : users.length === 0 ? (
          <p className="muted">No users yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Username</th>
                  <th scope="col">Email</th>
                  <th scope="col">Role</th>
                  <th scope="col"><span className="visually-hidden">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.username}</td>
                    <td>{u.email}</td>
                    <td>{u.role === 'admin' ? 'Admin' : 'Employee'}</td>
                    <td className="actions">
                      {/* The backend blocks admins from deleting themselves, so don't offer it. */}
                      {u.id === currentUser.id ? (
                        <span className="muted">You</span>
                      ) : (
                        <button
                          type="button"
                          className="danger-button"
                          onClick={() => handleRemove(u)}
                          disabled={removingId === u.id}
                        >
                          {removingId === u.id ? 'Removing…' : 'Remove'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
