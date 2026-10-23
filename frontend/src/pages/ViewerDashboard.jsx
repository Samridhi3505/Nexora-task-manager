
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from '../services/api.js'
import '../styles/Dashboard.css'

export default function ViewerDashboard() {
  const [projects, setProjects] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDashboard() {
      try {
        const [projectData, dashboardData] = await Promise.all([
          apiRequest("/projects"),
          apiRequest("/dashboard"),
        ]);

        setProjects(
          Array.isArray(projectData)
            ? projectData
            : projectData.projects || []
        );
        setStats(dashboardData.stats || dashboardData || {});
      } catch (err) {
        setError(err.message || "Unable to load dashboard");
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  if (loading) return <p className="dashboard-message">Loading viewer dashboard...</p>;
  if (error) return <p className="dashboard-error">{error}</p>;

  return (
    <div className="role-dashboard">
      <header className="dashboard-header">
        <div>
          <p className="dashboard-eyebrow">READ-ONLY WORKSPACE</p>
          <h1>Viewer Dashboard</h1>
          <p>Explore project information and track progress.</p>
        </div>
        <Link to="/projects" className="dashboard-button">
          Browse Projects
        </Link>
      </header>

      <section className="dashboard-stats">
        <Stat title="Available Projects" value={projects.length} />
        <Stat title="Total Tasks" value={stats.total_tasks ?? 0} />
        <Stat title="In Progress" value={stats.in_progress_tasks ?? 0} />
        <Stat title="Completed" value={stats.completed_tasks ?? 0} />
      </section>

      <section className="dashboard-section">
        <div className="section-heading">
          <h2>Project Overview</h2>
        </div>

        <div className="dashboard-grid">
          {projects.length ? projects.map((project) => (
            <article className="project-card" key={project.id}>
              <h3>{project.name || project.title || "Untitled Project"}</h3>
              <p>{project.description || "No description provided."}</p>
              <span className="project-status">{project.status || "Active"}</span>
              <Link to={`/projects/${project.id}`}>View details →</Link>
            </article>
          )) : <Empty message="No projects available to view." />}
        </div>
      </section>

      <p className="dashboard-note">
        Viewer access is read-only. Editing permissions are controlled by the backend.
      </p>
    </div>
  );
}

function Stat({ title, value }) {
  return (
    <article className="stat-card">
      <p>{title}</p>
      <h2>{value}</h2>
    </article>
  );
}

function Empty({ message }) {
  return <p className="dashboard-note">{message}</p>;
}
