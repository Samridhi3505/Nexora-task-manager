
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Sidebar from '../components/Sidebar.jsx'
import { apiRequest } from '../services/api.js'
import '../styles/Users.css'

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null')
  } catch {
    return null
  }
}

function normalizeRole(role) {
  return String(role || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
}

const ROLE_LABELS = {
  admin: 'Admin',
  project_manager: 'Project Manager',
  projectmanager: 'Project Manager',
  team_member: 'Team Member',
  teammember: 'Team Member',
  viewer: 'Viewer',
}

export default function Users() {
  const currentUser = getStoredUser()
  const currentRole = normalizeRole(currentUser?.role)
  const isAdmin = currentRole === 'admin'
  const isManager = ['project_manager', 'projectmanager'].includes(currentRole)
  const isMember = ['team_member', 'teammember'].includes(currentRole)
  const isViewer = currentRole === 'viewer'

  const [users, setUsers] = useState([])
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'Team Member',
  })
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function loadUsers() {
    if (!isAdmin) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')

    try {
      const data = await apiRequest('/users')
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.users)
          ? data.users
          : []

      setUsers(list)
    } catch (err) {
      setError(err.message || 'Could not load users.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [isAdmin])

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const searchText =
        `${user.name || ''} ${user.email || ''}`.toLowerCase()

      const matchesSearch = searchText.includes(search.toLowerCase())
      const role = normalizeRole(user.role)
      const matchesRole = roleFilter === 'all' || role === roleFilter
      const active = user.is_active !== false
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && active) ||
        (statusFilter === 'inactive' && !active)

      return matchesSearch && matchesRole && matchesStatus
    })
  }, [users, search, roleFilter, statusFilter])

  function handleChange(event) {
    const { name, value } = event.target
    setForm((previous) => ({ ...previous, [name]: value }))
  }

  async function createUser(event) {
    event.preventDefault()

    if (!isAdmin) {
      setError('Only administrators can create workspace accounts.')
      return
    }

    setSaving(true)
    setError('')
    setNotice('')

    try {
      await apiRequest('/users', {
        method: 'POST',
        body: JSON.stringify(form),
      })

      setForm({
        name: '',
        email: '',
        password: '',
        role: 'Team Member',
      })

      setShowForm(false)
      setNotice('User created successfully.')
      await loadUsers()
    } catch (err) {
      setError(err.message || 'Could not create user.')
    } finally {
      setSaving(false)
    }
  }

  async function deactivateUser(user) {
    if (!isAdmin) return

    if (!window.confirm(`Deactivate ${user.name}?`)) return

    setError('')
    setNotice('')

    try {
      await apiRequest(`/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: false }),
      })

      setNotice(`${user.name} has been deactivated.`)
      await loadUsers()
    } catch (err) {
      setError(err.message || 'Could not deactivate user.')
    }
  }

  const activeCount = users.filter(
    (user) => user.is_active !== false
  ).length

  const inactiveCount = users.length - activeCount

  const pageInfo = isAdmin
    ? {
        eyebrow: 'ADMIN WORKSPACE',
        title: 'User Management',
        description: 'Manage workspace accounts and their assigned roles.',
      }
    : isManager
      ? {
          eyebrow: 'MANAGEMENT WORKSPACE',
          title: 'Project Users',
          description: 'Find and coordinate the members of your projects.',
        }
      : isMember
        ? {
            eyebrow: 'TEAM WORKSPACE',
            title: 'My Teammates',
            description: 'View your project teammates and their responsibilities.',
          }
        : {
            eyebrow: 'READ-ONLY WORKSPACE',
            title: 'User Directory',
            description: 'Your account does not have workspace user administration access.',
          }

  return (
    <div className="layout">
      <Sidebar />

      <main className="page">
        <header className="page-header">
          <div>
            <p className="eyebrow">{pageInfo.eyebrow}</p>
            <h1>{pageInfo.title}</h1>
            <p className="muted">{pageInfo.description}</p>
          </div>

          {isAdmin && (
            <button
              type="button"
              className="primary-button"
              onClick={() => setShowForm((previous) => !previous)}
            >
              {showForm ? 'Cancel' : '+ Create User'}
            </button>
          )}
        </header>

        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}

        {notice && (
          <p className="users-notice" role="status">
            {notice}
          </p>
        )}

        {isAdmin && (
          <>
            <section className="users-summary">
              <article className="users-summary-card">
                <span>Total Users  : </span>
                <strong>{users.length}</strong>
              </article>
              <article className="users-summary-card">
                <span>Active Users  : </span>
                <strong>{activeCount}</strong>
              </article>
              <article className="users-summary-card">
                <span>Inactive Users  : </span>
                <strong>{inactiveCount}</strong>
              </article>
            </section>

            {showForm && (
              <form className="users-form" onSubmit={createUser}>
                <h2>Create Workspace User</h2>

                <label>
                  Full name
                  <input
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    maxLength={100}
                    required
                  />
                </label>

                <label>
                  Email
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    required
                  />
                </label>

                <label>
                  Temporary password
                  <input
                    type="password"
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                    minLength={8}
                    autoComplete="new-password"
                    required
                  />
                </label>

               <label>
  Workspace role
  <select
    name="role"
    value={form.role}
    onChange={handleChange}
    required
  >
    <option value="Admin">Admin</option>
    <option value="Project Manager">Project Manager</option>
    <option value="Team Member">Team Member</option>
    <option value="Viewer">Viewer</option>
  </select>
</label>

                <p className="muted">
                  Admin accounts should be created through a controlled setup
                  process.
                </p>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={saving}
                >
                  {saving ? 'Creating...' : 'Create User'}
                </button>
              </form>
            )}

            <section className="users-directory">
              <h2>Workspace Accounts</h2>

              <div className="users-toolbar">
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by name or email..."
                  aria-label="Search users"
                />

                <select
                  value={roleFilter}
                  onChange={(event) => setRoleFilter(event.target.value)}
                  aria-label="Filter by role"
                >
                  <option value="all">All roles</option>
                  <option value="admin">Admin</option>
                  <option value="project_manager">Project Manager</option>
                  <option value="team_member">Team Member</option>
                  <option value="viewer">Viewer</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  aria-label="Filter by account status"
                >
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              {loading ? (
                <p className="muted">Loading users...</p>
              ) : filteredUsers.length === 0 ? (
                <p className="muted">No users match these filters.</p>
              ) : (
                <div className="users-grid">
                  {filteredUsers.map((user) => (
                    <article className="user-card" key={user.id}>
                      <div className="user-card-top">
                        <div className="user-avatar">
                          {(user.name || user.email || 'U')
                            .charAt(0)
                            .toUpperCase()}
                        </div>

                        <span
                          className={`user-status ${
                            user.is_active === false ? 'inactive' : 'active'
                          }`}
                        >
                          {user.is_active === false ? 'Inactive' : 'Active'}
                        </span>
                      </div>

                      <h3>{user.name || 'Unnamed user'}</h3>
                      <p className="user-email">{user.email}</p>

                      <p className="user-role">
                        {ROLE_LABELS[normalizeRole(user.role)] ||
                          user.role ||
                          'Role not specified'}
                      </p>

                      {user.is_active !== false && (
                        <button
                          type="button"
                          className="user-deactivate-button"
                          onClick={() => deactivateUser(user)}
                          disabled={String(user.id) === String(currentUser?.id)}
                        >
                          {String(user.id) === String(currentUser?.id)
                            ? 'Your account'
                            : 'Deactivate Account'}
                        </button>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {isManager && (
          <section className="users-role-panel">
            <h2>Manage Your Project Teams</h2>
            <p className="muted">
              Project Managers should manage membership within projects they
              are authorized to manage, rather than administer all workspace
              accounts.
            </p>
            <Link to="/projects">Open Projects →</Link>
          </section>
        )}

        {isMember && (
          <section className="users-role-panel">
            <h2>Collaborate with Your Team</h2>
            <p className="muted">
              View the people associated with your projects through the Team
              section.
            </p>
            <Link to="/projects">Open My Projects →</Link>
          </section>
        )}

        {isViewer && (
          <section className="users-role-panel">
            <h2>Read-Only Access</h2>
            <p className="muted">
              You can view information available to your account, but cannot
              create, edit, or deactivate workspace users.
            </p>
            <Link to="/dashboard">Back to Dashboard →</Link>
          </section>
        )}

        {!isAdmin && !isManager && !isMember && !isViewer && (
          <section className="users-role-panel">
            <h2>Role not recognized</h2>
            <p className="muted">
              Your account role could not be identified. Contact an
              administrator for assistance.
            </p>
          </section>
        )}
      </main>
    </div>
  )
}
