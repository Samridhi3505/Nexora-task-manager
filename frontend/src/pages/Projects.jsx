
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../services/api.js';
import '../styles/Projects.css';

function getUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch {
    return null;
  }
}

function normalizeRole(role = '') {
  return String(role)
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function getProjectName(project) {
  return project.name || project.title || 'Untitled project';
}

function getProjectsFromResponse(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.projects)) return data.projects;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

export default function Projects() {
  const user = getUser();
  const role = normalizeRole(user?.role);

  const isAdmin = role === 'admin';
  const isManager = ['project_manager', 'projectmanager'].includes(role);
  const isMember = ['team_member', 'teammember'].includes(role);
  const isViewer = role === 'viewer';

  const canCreate = isAdmin || isManager;

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [form, setForm] = useState({
    name: '',
    description: '',
  });

  const pageInfo = {
    admin: {
      title: 'All Projects',
      subtitle: 'View every workspace project and oversee progress.',
    },
    project_manager: {
      title: 'All Projects',
      subtitle: 'Explore workspace projects and manage authorized work.',
    },
    projectmanager: {
      title: 'All Projects',
      subtitle: 'Explore workspace projects and manage authorized work.',
    },
    team_member: {
      title: 'All Projects',
      subtitle: 'Explore projects and find work relevant to your team.',
    },
    teammember: {
      title: 'All Projects',
      subtitle: 'Explore projects and find work relevant to your team.',
    },
    viewer: {
      title: 'All Projects',
      subtitle: 'Browse projects and view their details.',
    },
  };

  const currentPage = pageInfo[role] || {
    title: 'All Projects',
    subtitle: 'Browse projects available in the workspace.',
  };

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const data = await apiRequest('/projects');
      setProjects(getProjectsFromResponse(data));
    } catch (err) {
      setProjects([]);
      setError(err.message || 'Could not load projects.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const filteredProjects = useMemo(() => {
    const query = search.trim().toLowerCase();

    return projects.filter((project) => {
      const name = getProjectName(project).toLowerCase();
      const description = String(project.description || '').toLowerCase();
      const status = String(project.status || 'active').toLowerCase();

      const matchesSearch =
        name.includes(query) || description.includes(query);

      const matchesStatus =
        statusFilter === 'all' ||
        status === statusFilter ||
        (statusFilter === 'in_progress' && status === 'in progress');

      return matchesSearch && matchesStatus;
    });
  }, [projects, search, statusFilter]);

  const activeCount = projects.filter(
    (project) =>
      String(project.status || 'active').toLowerCase() === 'active'
  ).length;

  const completedCount = projects.filter(
    (project) =>
      String(project.status || '').toLowerCase() === 'completed'
  ).length;

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!canCreate) {
      setError('You do not have permission to create projects.');
      return;
    }

    if (!form.name.trim()) {
      setError('Please enter a project name.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      await apiRequest('/projects', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim(),
        }),
      });

      setForm({ name: '', description: '' });
      setShowForm(false);
      await loadProjects();
    } catch (err) {
      setError(err.message || 'Could not create project.');
    } finally {
      setSaving(false);
    }
  }

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

          <h1>{currentPage.title}</h1>
          <p className="muted">{currentPage.subtitle}</p>
        </div>

        {canCreate && (
          <button
            className="primary-button"
            type="button"
            onClick={() => setShowForm((previous) => !previous)}
          >
            {showForm ? 'Cancel' : '+ Create Project'}
          </button>
        )}
      </header>

      {error && (
        <div className="error-message" role="alert">
          <p>{error}</p>
          <button type="button" onClick={loadProjects}>
            Try Again
          </button>
        </div>
      )}

      <section className="project-summary">
        <article className="project-summary-card">
          <span>Total Projects</span>
          <strong>{projects.length}</strong>
        </article>

        <article className="project-summary-card">
          <span>Active Projects</span>
          <strong>{activeCount}</strong>
        </article>

        <article className="project-summary-card">
          <span>Completed Projects</span>
          <strong>{completedCount}</strong>
        </article>
      </section>

      {showForm && canCreate && (
        <form className="project-form" onSubmit={handleSubmit}>
          <h2>Create a New Project</h2>

          <label>
            Project name
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Enter project name"
              required
              maxLength={180}
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

          <button
            className="primary-button"
            type="submit"
            disabled={saving}
          >
            {saving ? 'Creating...' : 'Save Project'}
          </button>
        </form>
      )}

      <section className="project-toolbar">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search all projects..."
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
              ? 'No projects were returned by the server.'
              : 'Try changing your search or status filter.'}
          </p>

          {canCreate && projects.length === 0 && (
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

              <small>
                Created:{' '}
                {project.created_at
                  ? new Date(project.created_at).toLocaleDateString()
                  : 'Date unavailable'}
              </small>

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
  );
}
