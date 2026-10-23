
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiRequest } from '../services/api.js'
import '../styles/Dashboard.css'

export default function AdminDashboard() {
  const [data, setData] = useState({
    projects: [],
    stats: {},
    users: [],
  })

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadDashboard() {
      try {
        const [projectsResponse, dashboardResponse, usersResponse] =
          await Promise.all([
            apiRequest('/projects'),
            apiRequest('/dashboard'),
            apiRequest('/users'),
          ])

        if (cancelled) return

        const projects = Array.isArray(projectsResponse)
          ? projectsResponse
          : projectsResponse?.projects || []

        const users = Array.isArray(usersResponse)
          ? usersResponse
          : usersResponse?.users || []

        const stats = dashboardResponse?.stats || dashboardResponse || {}

        setData({
          projects,
          users,
          stats: {
            total_projects:
              Number(stats.total_projects ?? projects.length),
            total_tasks: Number(stats.total_tasks ?? 0),
            in_progress_tasks: Number(stats.in_progress_tasks ?? 0),
            total_users: Number(stats.total_users ?? users.length),
          },
        })
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Unable to load admin dashboard.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadDashboard()

    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <p className="dashboard-message">
        Loading admin dashboard...
      </p>
    )
  }

  if (error) {
    return (
      <div className="dashboard-error" role="alert">
        <p>{error}</p>
        <button type="button" onClick={() => window.location.reload()}>
          Try again
        </button>
      </div>
    )
  }

  const { stats, projects, users } = data

  return (
    <div className="role-dashboard">
      <header className="dashboard-header">
        <div>
          <p className="dashboard-eyebrow">NEOSTATS WORKSPACE</p>
          <h1>Admin Dashboard</h1>
          <p>Manage users, projects, and workspace activity.</p>
        </div>

        <Link to="/projects" className="dashboard-button">
          View Projects
        </Link>
      </header>

      <section className="dashboard-stats">
        <Stat title="Total Projects" value={stats.total_projects} />
        <Stat title="Total Tasks" value={stats.total_tasks} />
        <Stat title="In Progress" value={stats.in_progress_tasks} />
        <Stat title="Total Users" value={stats.total_users} />
      </section>

      <section className="dashboard-section">
        <div className="section-heading">
          <h2>All Projects</h2>
          <Link to="/projects">View all →</Link>
        </div>

        <div className="dashboard-grid">
          {projects.length > 0 ? (
            projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))
          ) : (
            <Empty message="No projects available yet." />
          )}
        </div>
      </section>

      <section className="dashboard-section">
        <div className="section-heading">
          <h2>User Management</h2>
          <Link to="/users">Manage users →</Link>
        </div>

        <p className="dashboard-note">
          {users.length} user{users.length === 1 ? '' : 's'} in the workspace.
          Manage users and project access from the Users page.
        </p>
      </section>
    </div>
  )
}

function Stat({ title, value }) {
  return (
    <article className="stat-card">
      <p>{title}</p>
      <h2>{value ?? 0}</h2>
    </article>
  )
}

function ProjectCard({ project }) {
  return (
    <article className="project-card">
      <h3>
        {project.name || project.title || 'Untitled Project'}
      </h3>

      <p>{project.description || 'No description provided.'}</p>

      <span className="project-status">
        {project.status || 'Active'}
      </span>

      <Link to={`/projects/${project.id}`}>
        Open project →
      </Link>
    </article>
  )
}

function Empty({ message }) {
  return <p className="dashboard-note">{message}</p>
}
