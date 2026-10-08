import { Link, useParams } from 'react-router-dom'

export default function ProjectPage() {
  const { projectId } = useParams()

  return (
    <>
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/projects">Projects</Link> / <span>{projectId}</span>
      </nav>

      <div className="page-header">
        <h1>Project {projectId}</h1>
        <p>Style details, BOM, missing info and activity will live here.</p>
      </div>

      <div className="placeholder-box">Project details and BOM table go here (Sprint 2).</div>
    </>
  )
}