import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api.js'
import UploadList from '../components/UploadList.jsx'
import { ACCEPT_ATTRIBUTE, ACCEPTED_DESCRIPTION, friendlyUploadError, toUploadItems } from '../components/uploads.js'

// Create a project by uploading its files. Builds on Andy's RAMP-77 draft:
// the first file creates the project (POST /api/projects/import, form fields: file, name),
// the rest are added to it one at a time (POST /api/projects/:id/import, form field: file).
// RAMP-132: each file is checked as soon as it's chosen, failures say which file and why,
// and a failed file can be tried again without reloading the page.

function fileForm(file, name) {
  const form = new FormData()
  form.append('file', file)
  if (name) form.append('name', name)
  return form
}

export default function NewProject() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [items, setItems] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  // Set once the first file has created the project
  const [projectId, setProjectId] = useState(null)

  function setStatus(key, status, message = null) {
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, status, message } : item)))
  }

  function handleChoose(e) {
    const added = toUploadItems(e.target.files)
    // Clear the input so the same file can be chosen again after fixing it
    e.target.value = ''
    if (added.length === 0) return
    setError('')
    setItems((prev) => [...prev, ...added])
  }

  function handleRemove(item) {
    setItems((prev) => prev.filter((i) => i.key !== item.key))
  }

  // Uploads one file; returns the project id on success, null on failure
  async function uploadOne(item, currentId) {
    setStatus(item.key, 'uploading')
    try {
      if (currentId) {
        await api(`/projects/${encodeURIComponent(currentId)}/import`, { method: 'POST', body: fileForm(item.file) })
        setStatus(item.key, 'done')
        return currentId
      }
      const data = await api('/projects/import', { method: 'POST', body: fileForm(item.file, name.trim()) })
      setStatus(item.key, 'done')
      setProjectId(data.project_id)
      return data.project_id
    } catch (err) {
      setStatus(item.key, 'failed', friendlyUploadError(err.message))
      return null
    }
  }

  async function uploadAll(toUpload) {
    // Other files that already failed and aren't being retried now
    const stillFailed = items.some((i) => i.status === 'failed' && !toUpload.includes(i))
    setBusy(true)
    let currentId = projectId
    let failures = 0

    for (const item of toUpload) {
      const result = await uploadOne(item, currentId)
      if (result) {
        currentId = result
        continue
      }
      failures += 1
      // Without a project there is nothing to add the other files to, so stop here
      if (!currentId) break
    }

    setBusy(false)
    if (failures === 0 && currentId && !stillFailed) {
      navigate(`/projects/${currentId}`)
      return
    }
    if (!currentId) setError("The project wasn't created. Fix or remove the file that failed, then try again.")
    else setError('')
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (items.length === 0) {
      setError('Choose at least one file to upload.')
      return
    }
    if (items.some((i) => i.status === 'invalid')) {
      setError("Some files can't be uploaded. Remove them before creating the project.")
      return
    }
    const toUpload = items.filter((i) => i.status === 'waiting' || i.status === 'failed')
    if (toUpload.length === 0) return
    setError('')
    uploadAll(toUpload)
  }

  function handleRetry(item) {
    setError('')
    // Before the project exists, retrying the first file also sends the files waiting after it
    if (projectId === null) uploadAll(items.filter((i) => i.status === 'waiting' || i.status === 'failed'))
    else uploadAll([item])
  }

  const failed = items.filter((i) => i.status === 'failed')
  const created = projectId !== null

  return (
    <>
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/projects">Projects</Link> / <span>New project</span>
      </nav>

      <div className="page-header">
        <h1>New project</h1>
        <p>Upload the tech pack or BOM. Project details and BOM lines are read from the file.</p>
      </div>

      <form className="form-card upload-card" onSubmit={handleSubmit} noValidate aria-label="New project">
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        {created && failed.length > 0 && (
          <div className="alert alert-error" role="alert">
            The project was created, but {failed.length === 1 ? 'one file' : `${failed.length} files`} didn&apos;t upload.
            Try {failed.length === 1 ? 'it' : 'them'} again below, or open the project and add {failed.length === 1 ? 'it' : 'them'} later.
          </div>
        )}

        <label htmlFor="project-name">Project name</label>
        <input
          id="project-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Defaults to the first file's name"
          disabled={busy || created}
        />

        <label htmlFor="project-files">Files</label>
        <input
          id="project-files"
          type="file"
          multiple
          accept={ACCEPT_ATTRIBUTE}
          onChange={handleChoose}
          disabled={busy || created}
          aria-describedby="project-files-hint"
        />
        <p className="field-hint" id="project-files-hint">
          {ACCEPTED_DESCRIPTION}. Put the tech pack or BOM first. It&apos;s used to create the project.
        </p>

        <UploadList
          items={items}
          onRetry={handleRetry}
          onRemove={created ? undefined : handleRemove}
          busy={busy}
        />

        <div className="form-actions">
          {created ? (
            <Link to={`/projects/${projectId}`} className="primary-button link-button">Open project</Link>
          ) : (
            <button type="submit" className="primary-button" disabled={busy}>
              {busy ? 'Uploading…' : 'Create project'}
            </button>
          )}
          <Link to="/projects" className="secondary-button link-button">{created ? 'Back to projects' : 'Cancel'}</Link>
        </div>
      </form>
    </>
  )
}
