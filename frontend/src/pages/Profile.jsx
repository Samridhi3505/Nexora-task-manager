
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Sidebar from '../components/Sidebar.jsx'
import { apiRequest } from '../services/api.js'
import '../styles/Profile.css'

function normalizeRole(role = '') {
  return role.toLowerCase().trim().replace(/[\s-]+/g, '_')
}

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}')
  } catch {
    return {}
  }
}

const roleDescriptions = {
  admin: 'Manage users and oversee projects across the workspace.',
  project_manager: 'Organize projects, assign tasks, and coordinate team members.',
  team_member: 'Work on assigned tasks and collaborate with your project team.',
  viewer: 'View permitted projects and monitor task progress.',
}

export default function Profile() {
  const [user, setUser] = useState(getStoredUser)
  const [name, setName] = useState(user.name || '')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const role = normalizeRole(user.role)
  const description =
    roleDescriptions[role] || 'View your account information.'

  useEffect(() => {
    let active = true

    async function loadProfile() {
      setLoading(true)
      setError('')

      try {
        const data = await apiRequest('/users/me')
        const profile = data.user || data

        if (!active) return

        setUser(previous => ({ ...previous, ...profile }))
        setName(profile.name || '')
        localStorage.setItem(
          'user',
          JSON.stringify({ ...user, ...profile })
        )
      } catch (err) {
        if (active) {
          // Display cached profile information if the endpoint
          // is not available, but explain that it could not refresh.
          setError(
            err.message || 'Could not refresh your profile from the server.'
          )
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    loadProfile()

    return () => {
      active = false
    }
  }, [])

  async function saveProfile(e) {
    e.preventDefault()
    setError('')
    setSuccess('')

    const trimmedName = name.trim()

    if (!trimmedName) {
      setError('Please enter your name.')
      return
    }

    setSaving(true)

    try {
      const data = await apiRequest('/users/me', {
        method: 'PATCH',
        body: JSON.stringify({ name: trimmedName }),
      })

      const updatedUser = {
        ...user,
        ...(data.user || data),
        name: (data.user || data).name || trimmedName,
      }

      setUser(updatedUser)
      setName(updatedUser.name)
      localStorage.setItem('user', JSON.stringify(updatedUser))
      setSuccess('Your profile has been updated.')
    } catch (err) {
      setError(err.message || 'Could not save your profile.')
    } finally {
      setSaving(false)
    }
  }

  const initials = (user.name || user.email || 'U')
    .split(' ')
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="layout">
      <Sidebar />

      <main className="page profile-page">
        <div className="profile-heading">
          <div>
            <p className="profile-eyebrow">ACCOUNT SETTINGS</p>
            <h1>My Profile</h1>
            <p>Manage your personal information and account details.</p>
          </div>

          <Link to="/dashboard" className="profile-back-link">
            ← Dashboard
          </Link>
        </div>

        {error && (
          <p className="profile-message profile-error" role="alert">
            {error}
          </p>
        )}

        {success && (
          <p className="profile-message profile-success" role="status">
            {success}
          </p>
        )}

        {loading && <p>Loading profile...</p>}

        <div className="profile-layout">
          <section className="profile-card profile-overview">
            <div className="profile-avatar">{initials}</div>
            <h2>{user.name || 'Your Name'}</h2>
            <p className="profile-email">{user.email || 'Email unavailable'}</p>

            <span className="profile-role">
              {(user.role || 'User')
                .replace(/[_-]/g, ' ')
                .replace(/\b\w/g, char => char.toUpperCase())}
            </span>

            <p className="profile-description">{description}</p>
          </section>

          <section className="profile-card profile-edit">
            <h2>Personal information</h2>
            <p className="profile-muted">
              Update the name displayed across your workspace.
            </p>

            <form onSubmit={saveProfile}>
              <label>
                Full name
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Enter your name"
                  maxLength={100}
                  required
                />
              </label>

              <label>
                Email address
                <input
                  type="email"
                  value={user.email || ''}
                  readOnly
                />
                <small>Contact your administrator if your email needs to change.</small>
              </label>

              <label>
                Account role
                <input
                  value={(user.role || 'User')
                    .replace(/[_-]/g, ' ')
                    .replace(/\b\w/g, char => char.toUpperCase())}
                  readOnly
                />
                <small>Your role cannot be changed from this page.</small>
              </label>

              <button type="submit" disabled={saving || loading}>
                {saving ? 'Saving...' : 'Save changes'}
              </button>
            </form>
          </section>
        </div>
      </main>
    </div>
  )
}
