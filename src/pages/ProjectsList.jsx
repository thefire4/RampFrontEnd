import { Link } from 'react-router-dom'

export default function ProjectsList() {
  return (
    <>
      <div className="page-header">
        <h1>Projects</h1>
        <p>Every style in development or production, with BOM readiness and open items.</p>
      </div>

      <div className="placeholder-box">
        Projects table goes here (Sprint 2).
        <br />
        <Link to="/projects/DW11038">Open sample project DW11038</Link>
      </div>
    </>
  )
}