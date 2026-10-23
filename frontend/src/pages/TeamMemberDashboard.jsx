
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from '../services/api.js'
import "../styles/Dashboard.css";

export default function TeamMemberDashboard() {
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDashboard() {
      try {
        const [projectData, taskData, dashboardData] = await Promise.all([
          apiRequest("/projects"),
          apiRequest("/tasks"),
          apiRequest("/dashboard"),
        ]);

        setProjects(
          Array.isArray(projectData)
            ? projectData
            : projectData.projects || []
        );
        setTasks(
          Array.isArray(taskData)
            ? taskData
            : taskData.tasks || []
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

  if (loading) return <p className="dashboard-message">Loading your dashboard...</p>;
  if (error) return <p className="dashboard-error">{error}</p>;

  return (
    <div className="role-dashboard">
      <header className="dashboard-header">
        <div>
          <p className="dashboard-eyebrow">YOUR WORKSPACE</p>
          <h1>Team Member Dashboard</h1>
          <p>Focus on your assigned tasks and team projects.</p>
        </div>
        <Link to="/projects" className="dashboard-button">
          My Projects
        </Link>
      </header>

      <section className="dashboard-stats">
        <Stat title="My Projects" value={projects.length} />
        <Stat title="Tasks Assigned" value={stats.total_tasks ?? tasks.length} />
        <Stat title="In Progress" value={stats.in_progress_tasks ?? countStatus(tasks, "in_progress")} />
        <Stat title="Completed" value={stats.completed_tasks ?? countStatus(tasks, "completed")} />
      </section>

      <section className="dashboard-section">
        <div className="section-heading">
          <h2>My Tasks</h2>
          <Link to="/projects">Browse projects →</Link>
        </div>

        <div className="dashboard-grid">
          {tasks.length ? tasks.map((task) => (
            <article className="project-card" key={task.id}>
              <h3>{task.title || "Untitled Task"}</h3>
              <p>{task.description || "No description provided."}</p>
              <span className="project-status">{task.status || "Pending"}</span>
              {task.due_date && (
                <p className="dashboard-note">
                  Due: {new Date(task.due_date).toLocaleDateString()}
                </p>
              )}
              <Link to={`/tasks/${task.id}`}>Open task →</Link>
            </article>
          )) : <Empty message="No tasks assigned yet." />}
        </div>
      </section>

      <section className="dashboard-section">
        <div className="section-heading">
          <h2>My Projects</h2>
        </div>
        <div className="dashboard-grid">
          {projects.length ? projects.map((project) => (
            <article className="project-card" key={project.id}>
              <h3>{project.name || project.title || "Untitled Project"}</h3>
              <p>{project.description || "No description provided."}</p>
              <Link to={`/projects/${project.id}`}>Open project →</Link>
            </article>
          )) : <Empty message="You haven't joined any projects yet." />}
        </div>
      </section>
    </div>
  );
}

function countStatus(tasks, status) {
  return tasks.filter(
    (task) => String(task.status || "").toLowerCase().replaceAll(" ", "_") === status
  ).length;
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
