
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from '../services/api.js'
import "../styles/Dashboard.css";

export default function ProjectManagerDashboard() {
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

  if (loading) return <p className="dashboard-message">Loading project manager dashboard...</p>;
  if (error) return <p className="dashboard-error">{error}</p>;

  return (
    <div className="role-dashboard">
      <header className="dashboard-header">
        <div>
          <p className="dashboard-eyebrow">YOUR WORKSPACE</p>
          <h1>Project Manager Dashboard</h1>
          <p>Track project progress, tasks, and your team.</p>
        </div>
        <Link to="/projects" className="dashboard-button">
          Manage Projects
        </Link>
      </header>

      <section className="dashboard-stats">
        <Stat title="My Projects" value={stats.total_projects ?? projects.length} />
        <Stat title="Total Tasks" value={stats.total_tasks ?? 0} />
        <Stat title="In Progress" value={stats.in_progress_tasks ?? 0} />
        <Stat title="Completed" value={stats.completed_tasks ?? 0} />
      </section>

      <section className="dashboard-section">
        <div className="section-heading">
          <h2>Managed Projects</h2>
          <Link to="/projects">View all →</Link>
        </div>

        <div className="dashboard-grid">
          {projects.length ? projects.map((project) => (
            <article className="project-card" key={project.id}>
              <h3>{project.name || project.title || "Untitled Project"}</h3>
              <p>{project.description || "No description provided."}</p>
              <span className="project-status">{project.status || "Active"}</span>
              <div className="project-actions">
                <Link to={`/projects/${project.id}`}>Open project → </Link>
                <Link to={`/projects/${project.id}/tasks`}>View tasks </Link>
                <Link to={`/projects/${project.id}/team`}>Manage team </Link>
              </div>
            </article>
          )) : <Empty message="No assigned projects found." />}
        </div>
      </section>
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
