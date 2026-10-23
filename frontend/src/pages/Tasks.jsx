
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import Sidebar from '../components/Sidebar.jsx';
import { apiRequest } from '../services/api.js';
import '../styles/Tasks.css';

const STATUSES = ['To Do', 'In Progress', 'Completed'];

const STATIC_TEAM_MEMBERS = [
  { id: 2, name: 'Rahul Sharma' },
  { id: 3, name: 'Priya Singh' },
  { id: 4, name: 'Aman Verma' },
  { id: 5, name: 'Sneha Patel' },
  { id: 6, name: 'Aditya Gupta' },
];


function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}');
  } catch {
    return {};
  }
}

function normalizeRole(role = '') {
  return String(role)
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_');
}

function getTaskAssigneeId(task) {
  return task.assignee_id ?? task.assigned_to ?? task.user_id;
}

function getErrorMessage(error, fallback) {
  return error?.message || fallback;
}

function getList(data, key) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.[key])) return data[key];
  return [];
}

export default function Tasks() {
  const { id: routeProjectId } = useParams();

  // Keep the project ID visible and validate it before API requests.
  const [projectIdInput, setProjectIdInput] = useState(
    routeProjectId || ''
  );

  const projectId = String(projectIdInput).trim();
  const validProjectId =
    /^\d+$/.test(projectId) && Number(projectId) > 0;

  const [user] = useState(getCurrentUser);
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);

  const [form, setForm] = useState({
    title: '',
    description: '',
    assignee_id: '',
  });

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const role = normalizeRole(user.role);
  const userId = user.id ?? user.user_id;

  const isAdmin = role === 'admin';
  const isManager =
    role === 'project_manager' || role === 'projectmanager';
  const isMember =
    role === 'team_member' || role === 'member';
  const isViewer = role === 'viewer';

  const canCreateTasks = isManager;
  const canAssignTasks = isManager;
  const canDeleteTasks = isManager;

  const loadTasks = useCallback(async () => {
    setError('');
    setNotice('');
    setTasks([]);
    setMembers([]);

    if (!validProjectId) {
      setLoading(false);
      setError(
        'A valid project ID is required. Enter a positive numeric project ID that exists in the database.'
      );
      return;
    }

    setLoading(true);

    try {
      const taskData = await apiRequest(
        `/tasks?projectId=${encodeURIComponent(projectId)}`
      );

      setTasks(getList(taskData, 'tasks'));

      if (canAssignTasks) {
        try {
          const memberData = await apiRequest(
            `/projects/${encodeURIComponent(projectId)}/members`
          );

          setMembers(getList(memberData, 'members'));
        } catch (err) {
          setMembers([]);
          setNotice(
            `Tasks loaded, but project members could not be loaded: ${
              err.message || 'Please check your project-members API route.'
            }`
          );
        }
      }
    } catch (err) {
      setError(
        getErrorMessage(err, 'Could not load tasks.')
      );
    } finally {
      setLoading(false);
    }
  }, [projectId, validProjectId, canAssignTasks]);

  useEffect(() => {
    setProjectIdInput(routeProjectId || '');
  }, [routeProjectId]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const visibleTasks = useMemo(() => {
    let result = [...tasks];

    // Team members only see their assigned tasks.
    if (isMember) {
      result = result.filter(
        task =>
          String(getTaskAssigneeId(task)) === String(userId)
      );
    }

    if (search.trim()) {
      const query = search.trim().toLowerCase();

      result = result.filter(task =>
        [
          task.title,
          task.description,
          task.status,
          task.assignee_name,
        ].some(value =>
          String(value || '').toLowerCase().includes(query)
        )
      );
    }

    if (statusFilter !== 'All') {
      result = result.filter(
        task => task.status === statusFilter
      );
    }

    return result;
  }, [tasks, isMember, userId, search, statusFilter]);

  function handleProjectIdChange(event) {
    setProjectIdInput(event.target.value);
    setTasks([]);
    setMembers([]);
    setError('');
    setNotice('');
  }

  async function createTask(event) {
    event.preventDefault();
    setError('');
    setNotice('');

    if (!validProjectId) {
      setError('Enter a valid positive numeric project ID.');
      return;
    }

    if (!canCreateTasks) {
      setError('You do not have permission to create tasks.');
      return;
    }

    if (!form.title.trim()) {
      setError('Task title is required.');
      return;
    }

    const assigneeId =
      form.assignee_id.trim() === ''
        ? null
        : Number(form.assignee_id);

    if (
      assigneeId !== null &&
      (!Number.isSafeInteger(assigneeId) || assigneeId <= 0)
    ) {
      setError('Select a valid project member.');
      return;
    }

    setCreating(true);

    try {
      await apiRequest('/tasks', {
        method: 'POST',
        body: JSON.stringify({
          project_id: Number(projectId),
          title: form.title.trim(),
          description: form.description.trim(),
          assignee_id: assigneeId,
        }),
      });

      setForm({
        title: '',
        description: '',
        assignee_id: '',
      });

      setNotice('Task created successfully.');
      await loadTasks();
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          'Could not create task. Check the project ID and backend validation.'
        )
      );
    } finally {
      setCreating(false);
    }
  }

  async function updateTask(task, changes) {
    setError('');
    setNotice('');

    const isAssignedToCurrentUser =
      String(getTaskAssigneeId(task)) === String(userId);

    const canUpdateStatus =
      isManager || (isMember && isAssignedToCurrentUser);

    if (!canUpdateStatus) {
      setError('You do not have permission to update this task.');
      return;
    }

    try {
      await apiRequest(`/tasks/${task.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          ...changes,
          version: task.version,
        }),
      });

      setNotice('Task updated successfully.');
      await loadTasks();
    } catch (err) {
      const message = err?.message || '';

      setError(
        message.includes('409')
          ? 'This task was changed by someone else. Refresh and try again.'
          : message || 'Could not update task.'
      );
    }
  }

  async function deleteTask(task) {
    if (!canDeleteTasks) {
      setError('You do not have permission to delete tasks.');
      return;
    }

    if (!window.confirm(`Delete "${task.title}"?`)) {
      return;
    }

    setError('');
    setNotice('');

    try {
      await apiRequest(`/tasks/${task.id}`, {
        method: 'DELETE',
      });

      setNotice('Task deleted successfully.');
      await loadTasks();
    } catch (err) {
      setError(
        getErrorMessage(err, 'Could not delete task.')
      );
    }
  }

  const pageTitle = isAdmin
    ? 'Project Tasks — Admin'
    : isManager
      ? 'Manage Project Tasks'
      : isMember
        ? 'My Assigned Tasks'
        : 'Project Tasks';

  const completedCount = visibleTasks.filter(
    task => task.status === 'Completed'
  ).length;

  const inProgressCount = visibleTasks.filter(
    task => task.status === 'In Progress'
  ).length;

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
                  ? 'Focus on your assigned work and update your task status.'
                  : isViewer
                    ? 'View project tasks and track their progress.'
                    : 'Monitor task progress for this project.'}
            </p>
          </div>

          <Link
            className="tasks-back-link"
            to={
              validProjectId
                ? `/projects/${projectId}`
                : '/projects'
            }
          >
            ← Back to project
          </Link>
        </div>

        {error && (
          <p
            className="tasks-message tasks-error"
            role="alert"
          >
            {error}
          </p>
        )}

        {notice && (
          <p
            className="tasks-message tasks-success"
            role="status"
          >
            {notice}
          </p>
        )}

        {/* Valid project ID section */}
        <section className="tasks-panel">
          <h2>Project ID</h2>

          <p className="tasks-panel-description">
            Enter the numeric ID of an existing project. The
            backend must verify that the project exists and that
            you have permission to access it.
          </p>

          <form
            className="tasks-form"
            onSubmit={event => {
              event.preventDefault();
              loadTasks();
            }}
          >
            <label>
              Valid Project ID
              <input
                type="number"
                min="1"
                step="1"
                value={projectIdInput}
                onChange={handleProjectIdChange}
                placeholder="e.g. 1"
                required
              />
            </label>

            <button
              type="submit"
              disabled={loading || !validProjectId}
            >
              {loading ? 'Loading...' : 'Load Project Tasks'}
            </button>
          </form>

          {validProjectId && (
            <p className="tasks-panel-description">
              Selected project ID: <strong>{projectId}</strong>
            </p>
          )}
        </section>

        <section className="tasks-summary">
          <article className="tasks-stat">
            <span className="tasks-stat-label">
              Total tasks  :  
            </span>
            <strong className="tasks-stat-value">
              {visibleTasks.length}
            </strong>
          </article>

          <article className="tasks-stat">
            <span className="tasks-stat-label">
              In progress  :  
            </span>
            <strong className="tasks-stat-value">
              {inProgressCount}
            </strong>
          </article>

          <article className="tasks-stat">
            <span className="tasks-stat-label">
              Completed  :  
            </span>
            <strong className="tasks-stat-value">
              {completedCount}
            </strong>
          </article>
        </section>

        {canCreateTasks && (
          <section className="tasks-panel">
            <h2>Create a task</h2>

            <p className="tasks-panel-description">
              Create a task for the selected project and optionally
              assign it to a project member.
            </p>

            <form
              className="tasks-form"
              onSubmit={createTask}
            >
              <label>
                Project ID
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={projectIdInput}
                  onChange={handleProjectIdChange}
                  placeholder="Enter an existing project ID"
                  required
                />
              </label>

              <label>
                Task title
                <input
                  value={form.title}
                  onChange={event =>
                    setForm({
                      ...form,
                      title: event.target.value,
                    })
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
                  onChange={event =>
                    setForm({
                      ...form,
                      description: event.target.value,
                    })
                  }
                  placeholder="Describe what needs to be done"
                  rows={3}
                />
              </label>

                     
<label>
  Assign to

  <select
    value={form.assignee_id}
    onChange={(e) =>
      setForm({
        ...form,
        assignee_id: e.target.value,
      })
    }
  >
    <option value="">Unassigned</option>

    {STATIC_TEAM_MEMBERS.map((member) => (
      <option key={member.id} value={member.id}>
        {member.name}
      </option>
    ))}
  </select>
</label>


              <button
                type="submit"
                disabled={
                  loading ||
                  creating ||
                  !validProjectId
                }
              >
                {creating ? 'Creating...' : 'Create Task'}
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
              onChange={event => setSearch(event.target.value)}
            />

            <select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={event =>
                setStatusFilter(event.target.value)
              }
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

          {!loading &&
            validProjectId &&
            visibleTasks.length === 0 && (
              <div className="tasks-empty">
                <h3>No tasks found</h3>
                <p>
                  {isMember
                    ? 'You have no assigned tasks matching these filters.'
                    : 'Try another search or status filter, or create a task.'}
                </p>
              </div>
            )}

          {!loading &&
            validProjectId &&
            visibleTasks.length > 0 && (
              <div className="tasks-grid">
                {visibleTasks.map(task => {
                  const isAssignedToCurrentUser =
                    String(getTaskAssigneeId(task)) ===
                    String(userId);

                  const canChangeThisStatus =
                    isManager ||
                    (isMember && isAssignedToCurrentUser);

                  return (
                    <article
                      className="task-card"
                      key={task.id}
                    >
                      <div className="task-card-top">
                        <span
                          className={`task-status status-${normalizeRole(
                            task.status
                          )}`}
                        >
                          {task.status}
                        </span>

                        <span className="task-id">
                          Task #{task.id}
                        </span>
                      </div>

                      <h3>{task.title}</h3>

                      <p className="task-description">
                        {task.description ||
                          'No description provided.'}
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
                            value={task.status || 'To Do'}
                            onChange={event =>
                              updateTask(task, {
                                status: event.target.value,
                              })
                            }
                          >
                            {STATUSES.map(status => (
                              <option
                                key={status}
                                value={status}
                              >
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
                  );
                })}
              </div>
            )}
        </section>
      </main>
    </div>
  );
}
