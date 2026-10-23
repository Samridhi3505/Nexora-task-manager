
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Sidebar from '../components/Sidebar.jsx'
import { apiRequest } from '../services/api.js'
import '../styles/Tasks.css'

const STATUSES = ['To Do', 'In Progress', 'Completed']

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}')
  } catch {
    return {}
  }
}

function normalizeRole(role = '') {
  return role
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_')
}

function getTaskAssigneeId(task) {
  return task.assignee_id ?? task.assigned_to ?? task.user_id
}

export default function Tasks() {
  const { id: projectId } = useParams()

  const [user] = useState(getCurrentUser)
  const [tasks, setTasks] = useState([])
  const [members, setMembers] = useState([])
  const [form, setForm] = useState({
    title: '',
    description: '',
    assignee_id: '',
  })

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const role = normalizeRole(user.role)
  const userId = user.id ?? user.user_id

  const isAdmin = role === 'admin'
  const isManager = role === 'project_manager' || role === 'projectmanager'
  const isMember = role === 'team_member' || role === 'member'
  const isViewer = role === 'viewer'

  const canCreateTasks = isManager
  const canAssignTasks = isManager
  const canDeleteTasks = isManager

  async function loadTasks() {
    setLoading(true)
    setError('')
    setNotice('')

    try {
      const taskData = await apiRequest(
        `/tasks?projectId=${encodeURIComponent(projectId)}`
      )

      setTasks(
        Array.isArray(taskData)
          ? taskData
          : taskData.tasks || []
      )

      // Only managers need the member list for task assignment.
      if (canAssignTasks) {
        try {
          const memberData = await apiRequest(
            `/projects/${projectId}/members`
          )

          setMembers(
            Array.isArray(memberData)
              ? memberData
              : memberData.members || []
          )
        } catch {
          setMembers([])
          setNotice(
            'Tasks loaded, but the project member list could not be loaded.'
          )
        }
      } else {
        setMembers([])
      }
    } catch (err) {
      setError(err.message || 'Could not load tasks.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTasks()
  }, [projectId])

  // Team Members see only their assigned tasks.
  // The backend must also enforce this restriction.
  const visibleTasks = useMemo(() => {
    let result = tasks

    if (isMember) {
      result = result.filter(
        task => String(getTaskAssigneeId(task)) === String(userId)
      )
    }

    if (search.trim()) {
      const query = search.toLowerCase()

      result = result.filter(task =>
        [
          task.title,
          task.description,
          task.status,
          task.assignee_name,
        ].some(value =>
          String(value || '').toLowerCase().includes(query)
        )
      )
    }

    if (statusFilter !== 'All') {
      result = result.filter(task => task.status === statusFilter)
    }

    return result
  }, [tasks, isMember, userId, search, statusFilter])

  async function createTask(e) {
    e.preventDefault()
    setError('')
    setNotice('')

    if (!canCreateTasks) {
      setError('You do not have permission to create tasks.')
      return
    }

    try {
      await apiRequest('/tasks', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          project_id: Number(projectId),
          assignee_id: form.assignee_id
            ? Number(form.assignee_id)
            : null,
        }),
      })

      setForm({
        title: '',
        description: '',
        assignee_id: '',
      })

      setNotice('Task created successfully.')
      await loadTasks()
    } catch (err) {
      setError(err.message || 'Could not create task.')
    }
  }

  async function updateTask(task, changes) {
    setError('')
    setNotice('')

    const isAssignedToCurrentUser =
      String(getTaskAssigneeId(task)) === String(userId)

    const canUpdateStatus =
      isManager || (isMember && isAssignedToCurrentUser)

    if (!canUpdateStatus) {
      setError('You do not have permission to update this task.')
      return
    }

    try {
      await apiRequest(`/tasks/${task.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          ...changes,
          version: task.version,
        }),
      })

      setNotice('Task updated successfully.')
      await loadTasks()
    } catch (err) {
      setError(
        err.message?.includes('409')
          ? 'This task was changed by someone else. Refresh and try again.'
          : err.message || 'Could not update task.'
      )
    }
  }

  async function deleteTask(task) {
    if (!canDeleteTasks) {
      setError('You do not have permission to delete tasks.')
      return
    }

    if (!window.confirm(`Delete "${task.title}"?`)) return

    setError('')
    setNotice('')

    try {
      await apiRequest(`/tasks/${task.id}`, {
        method: 'DELETE',
      })

      setNotice('Task deleted successfully.')
      await loadTasks()
    } catch (err) {
      setError(err.message || 'Could not delete task.')
    }
  }

  const pageTitle = isAdmin
    ? 'Project Tasks — Admin'
    : isManager
      ? 'Manage Project Tasks'
      : isMember
        ? 'My Assigned Tasks'
        : 'Project Tasks'

  const completedCount = visibleTasks.filter(
    task => task.status === 'Completed'
  ).length

  const inProgressCount = visibleTasks.filter(
    task => task.status === 'In Progress'
  ).length

  return (
    <div className="layout">
      <Sidebar />

      <main className="page tasks-page">
        <div className="tasks-heading">
          <div>
            <p className="tasks-eyebrow">PROJECT WORKSPACE</p>
            <h1>{pageTitle}</h1>
            <p className="tasks-subtitle">
              {isManager
                ? 'Create tasks, assign teammates, and track progress.'
                : isMember
                  ? 'Focus on your assigned work and keep your task status updated.'
                  : isViewer
                    ? 'View project tasks and track their progress.'
                    : 'Monitor task progress for this project.'}
            </p>
          </div>

          <Link
            className="tasks-back-link"
            to={`/projects/${projectId}`}
          >
            ← Back to project
          </Link>
        </div>

        {error && (
          <p className="tasks-message tasks-error" role="alert">
            {error}
          </p>
        )}

        {notice && (
          <p className="tasks-message tasks-success" role="status">
            {notice}
          </p>
        )}

        <section className="tasks-summary">
          <article className="tasks-stat">
            <span>Total tasks</span>
            <strong>{visibleTasks.length}</strong>
          </article>

          <article className="tasks-stat">
            <span>In progress</span>
            <strong>{inProgressCount}</strong>
          </article>

          <article className="tasks-stat">
            <span>Completed</span>
            <strong>{completedCount}</strong>
          </article>
        </section>

        {canCreateTasks && (
          <section className="tasks-panel">
            <h2>Create a task</h2>
            <p className="tasks-panel-description">
              Add a task and optionally assign it to a project member.
            </p>

            <form className="tasks-form" onSubmit={createTask}>
              <label>
                Task title
                <input
                  value={form.title}
                  onChange={e =>
                    setForm({ ...form, title: e.target.value })
                  }
                  placeholder="e.g. Build the login page"
                  required
                  maxLength={200}
                />
              </label>

              <label>
                Description
                <textarea
                  value={form.description}
                  onChange={e =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder="Describe what needs to be done"
                  rows={3}
                />
              </label>

              <label>
                Assign to
                <select
                  value={form.assignee_id}
                  onChange={e =>
                    setForm({ ...form, assignee_id: e.target.value })
                  }
                >
                  <option value="">Unassigned</option>
                  {members.map(member => {
                    const memberId = member.user_id ?? member.id

                    return (
                      <option key={memberId} value={memberId}>
                        {member.name || member.email || `User ${memberId}`}
                      </option>
                    )
                  })}
                </select>
              </label>

              <button type="submit" disabled={loading}>
                Create task
              </button>
            </form>
          </section>
        )}

        <section className="tasks-panel">
          <div className="tasks-list-heading">
            <div>
              <h2>
                {isMember ? 'My tasks' : 'All visible tasks'}
              </h2>
              <p className="tasks-panel-description">
                {visibleTasks.length} task(s) match your filters.
              </p>
            </div>
          </div>

          <div className="tasks-toolbar">
            <input
              aria-label="Search tasks"
              placeholder="Search tasks..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />

            <select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="All">All statuses</option>
              {STATUSES.map(status => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          {loading && <p>Loading tasks...</p>}

          {!loading && visibleTasks.length === 0 && (
            <div className="tasks-empty">
              <h3>No tasks found</h3>
              <p>
                {isMember
                  ? 'You have no assigned tasks matching these filters.'
                  : 'Try another search or status filter.'}
              </p>
            </div>
          )}

          {!loading && visibleTasks.length > 0 && (
            <div className="tasks-grid">
              {visibleTasks.map(task => {
                const isAssignedToCurrentUser =
                  String(getTaskAssigneeId(task)) === String(userId)

                const canChangeThisStatus =
                  isManager || (isMember && isAssignedToCurrentUser)

                return (
                  <article className="task-card" key={task.id}>
                    <div className="task-card-top">
                      <span
                        className={`task-status status-${normalizeRole(task.status)}`}
                      >
                        {task.status}
                      </span>

                      <span className="task-id">
                        Task #{task.id}
                      </span>
                    </div>

                    <h3>{task.title}</h3>

                    <p className="task-description">
                      {task.description || 'No description provided.'}
                    </p>

                    <div className="task-meta">
                      <span>Assigned to</span>
                      <strong>
                        {task.assignee_name || 'Unassigned'}
                      </strong>
                    </div>

                    {canChangeThisStatus ? (
                      <label className="task-status-control">
                        Update status
                        <select
                          value={task.status}
                          onChange={e =>
                            updateTask(task, {
                              status: e.target.value,
                            })
                          }
                        >
                          {STATUSES.map(status => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <p className="task-readonly">
                        {isViewer
                          ? 'Read-only access'
                          : 'Status updates are not available for your role.'}
                      </p>
                    )}

                    <div className="task-card-actions">
                      <Link to={`/tasks/${task.id}`}>
                        Open task details →
                      </Link>

                      {canDeleteTasks && (
                        <button
                          className="task-delete-button"
                          type="button"
                          onClick={() => deleteTask(task)}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
