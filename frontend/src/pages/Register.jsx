
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiRequest } from '../services/api.js'
import '../styles/Login.css'

const ROLES = [
   {
    value: 'admin',
    label: 'Admin',
    description: 'Manage users and oversee the workspace.',
  },
  {
    value: 'project_manager',
    label: 'Project Manager',
    description: 'Manage projects, tasks, and team members.',
  },
  {
    value: 'team_member',
    label: 'Team Member',
    description: 'Collaborate on assigned projects and tasks.',
  },
  {
    value: 'viewer',
    label: 'Viewer',
    description: 'View projects and track progress.',
  },
]

export default function Register() {
  const navigate = useNavigate()

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'team_member',
  })

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  function handleChange(event) {
    const { name, value } = event.target

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }))

    setError('')
    setSuccess('')
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (loading) return

    if (form.password.length < 8) {
      setError('Password must contain at least 8 characters.')
      return
    }

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setError('')
    setSuccess('')
    setLoading(true)

    try {
      await apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          role: form.role,
        }),
      })

      setSuccess('Account created successfully! Redirecting to login...')

      navigate('/login', {
        replace: true,
        state: { registered: true },
      })
    } catch (err) {
      setError(
        err.message || 'Registration failed. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  const selectedRole = ROLES.find(
    (role) => role.value === form.role
  )

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <p className="auth-eyebrow">NEOSTATS WORKSPACE</p>

        <h1>Create your account</h1>

        <p className="auth-subtitle">
          Join Nexora and set up your personalized workspace.
        </p>

        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}

        {success && (
          <p className="auth-success" role="status">
            {success}
          </p>
        )}

        <label htmlFor="name">Full name</label>
        <input
          id="name"
          name="name"
          type="text"
          value={form.name}
          onChange={handleChange}
          placeholder="Enter your full name"
          autoComplete="name"
          maxLength={100}
          disabled={loading}
          required
        />

        <label htmlFor="email">Email address</label>
        <input
          id="email"
          name="email"
          type="email"
          value={form.email}
          onChange={handleChange}
          placeholder="you@example.com"
          autoComplete="email"
          disabled={loading}
          required
        />

        <label htmlFor="role">Choose your role</label>
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
              {role.label}
            </option>
          ))}
        </select>

        {selectedRole && (
          <p className="auth-role-description">
            {selectedRole.description}
          </p>
        )}

        <label htmlFor="password">Create password</label>
        <input
          id="password"
          name="password"
          type="password"
          value={form.password}
          onChange={handleChange}
          placeholder="At least 8 characters"
          autoComplete="new-password"
          minLength={8}
          disabled={loading}
          required
        />

        <label htmlFor="confirmPassword">Confirm password</label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          value={form.confirmPassword}
          onChange={handleChange}
          placeholder="Re-enter your password"
          autoComplete="new-password"
          minLength={8}
          disabled={loading}
          required
        />

        <button
          className="auth-button"
          type="submit"
          disabled={loading}
        >
          {loading ? 'Creating account...' : 'Create account'}
        </button>

        <p className="auth-footer">
          Already have an account?{' '}
          <Link to="/login">Login</Link>
        </p>
      </form>
    </div>
  )
}
