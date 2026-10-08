import { useNavigate } from 'react-router-dom'

export default function Login() {
  const navigate = useNavigate()

  // Placeholder: no real auth yet. Sign in just goes to the projects list.
  function handleSubmit(e) {
    e.preventDefault()
    navigate('/projects')
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1 className="brand-dark">RAMP CORE OS</h1>
        <label htmlFor="email">Email</label>
        <input id="email" type="email" autoComplete="email" />
        <label htmlFor="password">Password</label>
        <input id="password" type="password" autoComplete="current-password" />
        <button type="submit" className="primary-button">Sign in</button>
      </form>
    </div>
  )
}