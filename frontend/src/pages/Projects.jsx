
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiRequest } from '../services/api.js'
import '../styles/Projects.css'

const DEMO_MANAGERS = [
  { id: 101, name: 'Aarav Sharma', email: 'aarav.sharma@example.com' },
  { id: 102, name: 'Priya Verma', email: 'priya.verma@example.com' },
  { id: 103, name: 'Rahul Patel', email: 'rahul.patel@example.com' },
]

function getUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null')
  } catch {
    return null
  }
}

function normalizeRole(role = '') {
  return String(role)
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
}

function getProjectName(project) {
  return project.name || project.title || 'Untitled project'
}

function getProjectsFromResponse(data) {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.projects)) return data.projects
  if (Array.isArray(data?.data)) return data.data
  return []
}

function getManagersFromResponse(data) {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.managers)) return data.managers
  if (Array.isArray(data?.users)) return data.users
  return []
}

export default function Projects() {
  const user = getUser()
  const role = normalizeRole(user?.role)

  const isAdmin = role === 'admin'
  const isManager = ['project_manager', 'projectmanager'].includes(role)
  const isMember = ['team_member', 'teammember'].includes(role)
  const isViewer = role === 'viewer'

  const [projects, setProjects] = useState([])
  const [managers, setManagers] = useState(DEMO_MANAGERS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [assignments, setAssignments] = useState({})
  const [busyProjectId, setBusyProjectId] = useState(null)

  const [form, setForm] = useState({
    name: '',
    description: '',
    project_manager_id: '',
  })

  const loadProjects = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const data = await apiRequest('/projects')
      setProjects(getProjectsFromResponse(data))
    } catch (err) {
      setProjects([])
      setError(err.message || 'Could not load projects.')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadManagers = useCallback(async () => {
    if (!isAdmin) return

    try {
      const data = await apiRequest('/projects/managers')
      const apiManagers = getManagersFromResponse(data)

      setManagers(apiManagers.length > 0 ? apiManagers : DEMO_MANAGERS)
    } catch (err) {
      setManagers(DEMO_MANAGERS)
      console.warn('Using fallback manager names:', err.message)
    }
  }, [isAdmin])

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  useEffect(() => {
    loadManagers()
  }, [loadManagers])

  const filteredProjects = useMemo(() => {
    const query = search.trim().toLowerCase()

    return projects.filter((project) => {
      const name = getProjectName(project).toLowerCase()
      const description = String(project.description || '').toLowerCase()
      const status = String(project.status || 'active').toLowerCase()

      const matchesSearch =
        name.includes(query) || description.includes(query)

      const matchesStatus =
        statusFilter === 'all' ||
        status === statusFilter ||
        (statusFilter === 'in_progress' && status === 'in progress')

      return matchesSearch && matchesStatus
    })
  }, [projects, search, statusFilter])

  const activeCount = projects.filter(
    (project) =>
      String(project.status || 'active').toLowerCase() === 'active'
  ).length

  const completedCount = projects.filter(
    (project) =>
      String(project.status || '').toLowerCase() === 'completed'
  ).length

  function handleChange(event) {
    const { name, value } = event.target

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (!isAdmin) {
      setError('Only Admins can create projects.')
      return
    }

    if (!form.name.trim()) {
      setError('Please enter a project name.')
      return
    }

    if (!form.project_manager_id) {
      setError('Please assign a project manager.')
      return
    }

    const selectedManager = managers.find(
      (manager) => String(manager.id) === String(form.project_manager_id)
    )

    if (!selectedManager) {
      setError('Please select a valid project manager.')
      return
    }

    if (
      DEMO_MANAGERS.some(
        (manager) => String(manager.id) === String(selectedManager.id)
      )
    ) {
      setError(
        'This is a sample manager. Select a real manager account to save the project.'
      )
      return
    }

    setSaving(true)
    setError('')
    setNotice('')

    try {
      await apiRequest('/projects', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim(),
          project_manager_id: Number(form.project_manager_id),
        }),
      })

      setForm({
        name: '',
        description: '',
        project_manager_id: '',
      })

      setShowForm(false)
      setNotice('Project created and manager assigned successfully.')
      await loadProjects()
    } catch (err) {
      setError(err.message || 'Could not create project.')
    } finally {
      setSaving(false)
    }
  }

  function handleAssignmentChange(projectId, managerId) {
    setAssignments((previous) => ({
      ...previous,
      [projectId]: managerId,
    }))
  }

  async function handleAssignManager(project) {
    if (!isAdmin) return

    const managerId = assignments[project.id]

    if (!managerId) {
      setError('Select a project manager first.')
      return
    }

    const selectedManager = managers.find(
      (manager) => String(manager.id) === String(managerId)
    )

    if (!selectedManager) {
      setError('Please select a valid project manager.')
      return
    }

    if (
      DEMO_MANAGERS.some(
        (manager) => String(manager.id) === String(managerId)
      )
    ) {
      setError(
        'This is a sample manager. Select a real manager account to save an assignment.'
      )
      return
    }

    setBusyProjectId(project.id)
    setError('')
    setNotice('')

    try {
      await apiRequest(`/projects/${project.id}/assign-manager`, {
        method: 'PATCH',
        body: JSON.stringify({
          project_manager_id: Number(managerId),
        }),
      })

      setNotice(`Manager assigned to "${getProjectName(project)}".`)

      setAssignments((previous) => ({
        ...previous,
        [project.id]: '',
      }))

      await loadProjects()
    } catch (err) {
      setError(err.message || 'Could not assign project manager.')
    } finally {
      setBusyProjectId(null)
    }
  }

  async function handleDelete(project) {
    if (!isAdmin) return

    const confirmed = window.confirm(
      `Are you sure you want to delete "${getProjectName(project)}"? This action cannot be undone.`
    )

    if (!confirmed) return

    setBusyProjectId(project.id)
    setError('')
    setNotice('')

    try {
      await apiRequest(`/projects/${project.id}`, {
        method: 'DELETE',
      })

      setProjects((previous) =>
        previous.filter((item) => item.id !== project.id)
      )

      setNotice('Project deleted successfully.')
    } catch (err) {
      setError(
        err.message ||
          'Could not delete the project. It may have related tasks or records.'
      )
    } finally {
      setBusyProjectId(null)
    }
  }

  function getManagerName(project) {
    if (project.project_manager_name) {
      return project.project_manager_name
    }

    if (project.project_manager?.name) {
      return project.project_manager.name
    }

    const realManager = managers.find(
      (manager) =>
        String(manager.id) === String(project.owner_id) &&
        !DEMO_MANAGERS.some(
          (demo) => String(demo.id) === String(manager.id)
        )
    )

    if (realManager?.name) return realManager.name

    const index =
      Math.abs(Number(project.id) || 0) % DEMO_MANAGERS.length

    return DEMO_MANAGERS[index].name
  }

  const pageTitle = isAdmin ? 'All Projects' : 'My Projects'

  return (
    <main className="projects-page">
      <header className="projects-header page-header">
        <div>
          <p className="eyebrow">
            {isAdmin
              ? 'ADMIN WORKSPACE'
              : isManager
                ? 'MANAGEMENT WORKSPACE'
                : isMember
                  ? 'TEAM WORKSPACE'
                  : isViewer
                    ? 'READ-ONLY WORKSPACE'
                    : 'WORKSPACE'}
          </p>

          <h1>{pageTitle}</h1>

          <p className="muted">
            {isAdmin
              ? 'View all projects, assign managers, and manage project workspaces.'
              : isManager
                ? 'Explore projects you can access and manage authorized work.'
                : 'Browse projects available to you.'}
          </p>
        </div>

        {isAdmin && (
          <button
            className="primary-button"
            type="button"
            onClick={() => {
              setShowForm((previous) => !previous)
              setError('')
            }}
          >
            {showForm ? 'Cancel' : '+ Create Project'}
          </button>
        )}
      </header>

      {error && (
        <div className="error-message" role="alert">
          <p>{error}</p>
          <button type="button" onClick={loadProjects}>
            Refresh Projects
          </button>
        </div>
      )}

      {notice && (
        <div className="success-message" role="status">
          {notice}
        </div>
      )}

      <section className="project-summary">
        <article className="project-summary-card">
          <span>Total Projects  : </span>
          <strong>{projects.length}</strong>
        </article>

        <article className="project-summary-card">
          <span>Active Projects  : </span>
          <strong>{activeCount}</strong>
        </article>

        <article className="project-summary-card">
          <span>Completed Projects  : </span>
          <strong>{completedCount}</strong>
        </article>
      </section>

      {showForm && isAdmin && (
        <form className="project-form" onSubmit={handleSubmit}>
          <h2>Create a New Project</h2>

          <label>
            Project name
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Enter project name"
              maxLength={180}
              required
            />
          </label>

          <label>
            Description
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder="What is this project about?"
              rows={4}
            />
          </label>

          <label>
            Assign project manager
            <select
              name="project_manager_id"
              value={form.project_manager_id}
              onChange={handleChange}
              required
            >
              <option value="">Select a project manager</option>

              {managers.map((manager) => (
                <option key={manager.id} value={manager.id}>
                  {manager.name} ({manager.email})
                </option>
              ))}
            </select>
          </label>

          {form.project_manager_id && (
            <div className="selected-manager-preview">
              <span className="manager-avatar">
                {managers
                  .find(
                    (manager) =>
                      String(manager.id) === String(form.project_manager_id)
                  )
                  ?.name?.charAt(0)
                  .toUpperCase()}
              </span>

              <div>
                <span className="manager-preview-label">
                  Project will be assigned to
                </span>

                <strong>
                  {managers.find(
                    (manager) =>
                      String(manager.id) === String(form.project_manager_id)
                  )?.name}
                </strong>

                <small>
                  {managers.find(
                    (manager) =>
                      String(manager.id) === String(form.project_manager_id)
                  )?.email}
                </small>
              </div>
            </div>
          )}

          {managers.length === 0 && (
            <p className="muted">
              No project managers found. Create or activate a Project Manager
              account first.
            </p>
          )}

          <button
            className="primary-button"
            type="submit"
            disabled={
              saving ||
              managers.length === 0 ||
              DEMO_MANAGERS.some(
                (manager) =>
                  String(manager.id) === String(form.project_manager_id)
              )
            }
          >
            {saving ? 'Creating...' : 'Create Project'}
          </button>
        </form>
      )}

      <section className="project-toolbar">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search projects..."
          aria-label="Search projects"
        />

        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          aria-label="Filter projects by status"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="in_progress">In progress</option>
          <option value="completed">Completed</option>
          <option value="on hold">On Hold</option>
          <option value="archived">Archived</option>
        </select>
      </section>

      {loading ? (
        <p className="muted">Loading projects...</p>
      ) : filteredProjects.length === 0 ? (
        <section className="tasks-section">
          <h2>
            {projects.length === 0
              ? 'No projects found'
              : 'No matching projects'}
          </h2>

          <p className="muted">
            {projects.length === 0
              ? 'No projects are available to display.'
              : 'Try changing your search or status filter.'}
          </p>

          {isAdmin && projects.length === 0 && (
            <button
              className="primary-button"
              type="button"
              onClick={() => setShowForm(true)}
            >
              + Create Project
            </button>
          )}
        </section>
      ) : (
        <section className="projects-grid">
          {filteredProjects.map((project) => (
            <article className="project-card" key={project.id}>
              <span
                className={`project-status ${String(
                  project.status || 'active'
                )
                  .toLowerCase()
                  .replace(/\s+/g, '-')}`}
              >
                {project.status || 'Active'}
              </span>

              <h3>{getProjectName(project)}</h3>

              <p>
                {project.description || 'No description provided.'}
              </p>

              <p>
                <strong>Project manager:</strong> {getManagerName(project)}
              </p>

              <small>
                Created:{' '}
                {project.created_at
                  ? new Date(project.created_at).toLocaleDateString()
                  : 'Date unavailable'}
              </small>

              {isAdmin && (
                <div className="project-admin-actions">
                  <label>
                    Assign or change manager
                    <select
                      value={assignments[project.id] || ''}
                      onChange={(event) =>
                        handleAssignmentChange(
                          project.id,
                          event.target.value
                        )
                      }
                    >
                      <option value="">Select manager</option>

                      {managers.map((manager) => (
                        <option key={manager.id} value={manager.id}>
                          {manager.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <button
                    type="button"
                    className="primary-button"
                    disabled={
                      busyProjectId === project.id ||
                      !assignments[project.id]
                    }
                    onClick={() => handleAssignManager(project)}
                  >
                    {busyProjectId === project.id
                      ? 'Please wait...'
                      : 'Assign Manager'}
                  </button>

                  <button
                    type="button"
                    className="danger-button"
                    disabled={busyProjectId === project.id}
                    onClick={() => handleDelete(project)}
                  >
                    {busyProjectId === project.id
                      ? 'Please wait...'
                      : 'Delete Project'}
                  </button>
                </div>
              )}

              <div className="project-card-actions">
                <Link to={`/projects/${project.id}`}>
                  View Details →
                </Link>

                <Link to={`/projects/${project.id}/tasks`}>
                  {isManager ? 'Manage Tasks' : 'View Tasks'}
                </Link>

                <Link to={`/projects/${project.id}/team`}>
                  {isManager ? 'Manage Team' : 'View Team'}
                </Link>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  )
}
