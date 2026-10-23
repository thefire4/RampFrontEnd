import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api.js'

// RAMP-77: create a project by uploading its files.
// The first file creates the project (POST /api/projects/import, form fields: file, name).
// Any other files are added to it one at a time (POST /api/projects/:id/import, form field: file).

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileForm(file, name) {
  const form = new FormData()
  form.append('file', file)
  if (name) form.append('name', name)
  return form
}

export default function NewProject() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [files, setFiles] = useState([])
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [partial, setPartial] = useState(null) // { projectId, failed: [{ name, message }] }

  async function handleSubmit(e) {
    e.preventDefault()
    if (files.length === 0) {
      setError('Choose at least one file to upload.')
      return
    }

    setError('')
    setPartial(null)
    setSubmitting(true)

    const [first, ...rest] = files
    let projectId
    try {
      setStatus(`Uploading 1 of ${files.length}: ${first.name}`)
      const data = await api('/projects/import', { method: 'POST', body: fileForm(first, name.trim()) })
      projectId = data.project_id
    } catch (err) {
      setError(`${first.name}: ${err.message}`)
      setStatus('')
      setSubmitting(false)
      return
    }

    const failed = []
    for (const [i, file] of rest.entries()) {
      setStatus(`Uploading ${i + 2} of ${files.length}: ${file.name}`)
      try {
        await api(`/projects/${encodeURIComponent(projectId)}/import`, { method: 'POST', body: fileForm(file) })
      } catch (err) {
        failed.push({ name: file.name, message: err.message })
      }
    }

    if (failed.length === 0) {
      navigate(`/projects/${projectId}`)
      return
    }

    // The project exists, so don't send people back to create it again; show what didn't make it.
    setStatus('')
    setSubmitting(false)
    setPartial({ projectId, failed })
  }

  return (
    <>
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/projects">Projects</Link> / <span>New project</span>
      </nav>

      <div className="page-header">
        <h1>New project</h1>
        <p>Upload the tech pack or BOM. Project details and BOM lines are read from the file.</p>
      </div>

      {partial ? (
        <div className="form-card" role="alert">
          <div className="alert alert-error">
            Project created, but {partial.failed.length === 1 ? 'one file' : `${partial.failed.length} files`} didn&apos;t upload:
            <ul className="upload-failures">
              {partial.failed.map((f) => (
                <li key={f.name}><strong>{f.name}</strong>: {f.message}</li>
              ))}
            </ul>
          </div>
          <Link to={`/projects/${partial.projectId}`} className="primary-button link-button">Open project</Link>
        </div>
      ) : (
        <form className="form-card" onSubmit={handleSubmit} noValidate>
          {error && <div className="alert alert-error" role="alert">{error}</div>}

          <label htmlFor="project-name">Project name</label>
          <input
            id="project-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Defaults to the first file's name"
            disabled={submitting}
          />

          <label htmlFor="project-files">Files</label>
          <input
            id="project-files"
            type="file"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files || []))}
            disabled={submitting}
          />
          <p className="field-hint">Put the tech pack or BOM first. It's used to create the project.</p>

          {files.length > 0 && (
            <ol className="selected-files" aria-label="Selected files">
              {files.map((file) => (
                <li key={`${file.name}-${file.size}`}>
                  <span>{file.name}</span>
                  <span className="muted">{formatSize(file.size)}</span>
                </li>
              ))}
            </ol>
          )}

          {status && <p className="muted" role="status">{status}</p>}

          <div className="form-actions">
            <button type="submit" className="primary-button" disabled={submitting}>
              {submitting ? 'Uploading…' : 'Create project'}
            </button>
            <Link to="/projects" className="secondary-button link-button">Cancel</Link>
          </div>
        </form>
      )}
    </>
  )
}