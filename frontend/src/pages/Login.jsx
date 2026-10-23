import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiRequest } from '../services/api.js'
import '../styles/Login.css'

const ROLES = [
  { value: 'admin', label: 'Admin', icon: '🛡️' },
  { value: 'project_manager', label: 'Project Manager', icon: '📊' },
  { value: 'team_member', label: 'Team Member', icon: '👥' },
  { value: 'viewer', label: 'Viewer', icon: '👁️' },
]

const DASHBOARDS = {
  admin: '/dashboard',
  project_manager: '/dashboard',
  team_member: '/dashboard',
  viewer: '/dashboard',
}

function normalizeRole(role = '') {
  return String(role).toLowerCase().trim().replace(/[\s-]+/g, '_')
}

export default function Login() {
  const navigate = useNavigate()

  const [form, setForm] = useState({
    email: '',
    password: '',
    role: 'admin',
  })

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleChange(event) {
    const { name, value } = event.target

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }))

    setError('')
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (loading) return

    setError('')
    setLoading(true)

    try {
      const data = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: form.email.trim(),
          password: form.password,
        }),
      })

      const token = data?.token || data?.accessToken
      const user = data?.user

      if (!token || !user?.role) {
        throw new Error(
          'The server response is missing the login token or user role.'
        )
      }

      const actualRole = normalizeRole(user.role)
      const selectedRole = normalizeRole(form.role)

      const supportedRole = ROLES.some(
        (role) => role.value === actualRole
      )

      if (!supportedRole) {
        throw new Error(
          'Your account has an unsupported role. Please contact your administrator.'
        )
      }

      if (actualRole !== selectedRole) {
        const actualRoleLabel = ROLES.find(
          (role) => role.value === actualRole
        )?.label

        throw new Error(
          `This account belongs to ${actualRoleLabel}. Please select the correct role.`
        )
      }

      // Save credentials only after the server response is validated.
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(user))

      navigate(DASHBOARDS[actualRole], { replace: true })
    } catch (err) {
      setError(
        err.message || 'Login failed. Please check your credentials.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <p className="auth-eyebrow">NEOSTATS WORKSPACE</p>

        <h1>Welcome back</h1>

        <p className="auth-subtitle">
          Sign in to your role-specific workspace.
        </p>

        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}

        <label htmlFor="role">Login as</label>
        <select
          id="role"
          name="role"
          className="auth-select"
          value={form.role}
          onChange={handleChange}
          disabled={loading}
          required
        >
          {ROLES.map((role) => (
            <option key={role.value} value={role.value}>
              {role.icon} {role.label}
            </option>
          ))}
        </select>

        <label htmlFor="email">Email address</label>
        <input
          id="email"
          type="email"
          name="email"
          value={form.email}
          onChange={handleChange}
          placeholder="you@example.com"
          autoComplete="username"
          disabled={loading}
          required
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          name="password"
          value={form.password}
          onChange={handleChange}
          placeholder="Enter your password"
          autoComplete="current-password"
          disabled={loading}
          required
        />

        <button
          className="auth-button"
          type="submit"
          disabled={loading}
        >
          {loading ? 'Signing in...' : 'Login to your workspace'}
        </button>

        <p className="auth-footer">
          Don't have an account?{' '}
          <Link to="/register">Create an account</Link>
        </p>
      </form>
    </div>
  )
}