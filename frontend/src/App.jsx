
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  useLocation,
} from 'react-router-dom';

import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';

import AdminDashboard from './pages/AdminDashboard.jsx';
import ProjectManagerDashboard from './pages/ProjectManagerDashboard.jsx';
import TeamMemberDashboard from './pages/TeamMemberDashboard.jsx';
import ViewerDashboard from './pages/ViewerDashboard.jsx';

import Projects from './pages/Projects.jsx';
import ProjectDetails from './pages/ProjectDetails.jsx';
import Tasks from './pages/Tasks.jsx';
import Team from './pages/Team.jsx';
import Users from './pages/Users.jsx';
import Profile from './pages/Profile.jsx';

import Sidebar from './components/Sidebar.jsx';
import './index.css';

function getUser() {
  try {
    const storedUser = localStorage.getItem('user');
    return storedUser ? JSON.parse(storedUser) : null;
  } catch {
    return null;
  }
}

function normalizeRole(role = '') {
  return String(role)
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_');
}

function ProtectedRoute({ allowedRoles }) {
  const location = useLocation();
  const token = localStorage.getItem('token');
  const user = getUser();

  if (!token || !user || !user.id || !user.role) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location }}
      />
    );
  }

  const role = normalizeRole(user.role);

  if (
    allowedRoles &&
    !allowedRoles.map(normalizeRole).includes(role)
  ) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}

function AppLayout() {
  return (
    <div className="app-layout">
      <Sidebar />

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
function RoleDashboard() {
  const user = getUser();

  if (!localStorage.getItem('token') || !user?.id || !user?.role) {
    return <Navigate to="/login" replace />;
  }

  switch (normalizeRole(user.role)) {
    case 'admin':
      return <AdminDashboard />;

    case 'project_manager':
      return <ProjectManagerDashboard />;

    case 'team_member':
      return <TeamMemberDashboard />;

    case 'viewer':
      return <ViewerDashboard />;

    default:
      return <Navigate to="/login" replace />;
  }
}

function DashboardRedirect() {
  const user = getUser();
  const token = localStorage.getItem('token');

  return (
    <Navigate
      to={token && user?.id && user?.role ? '/dashboard' : '/login'}
      replace
    />
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public pages */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Authenticated pages with shared sidebar */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<RoleDashboard />} />

            <Route path="/projects" element={<Projects />} />
            <Route path="/projects/:id" element={<ProjectDetails />} />
            <Route path="/projects/:id/tasks" element={<Tasks />} />
            <Route path="/projects/:id/team" element={<Team />} />

            <Route path="/tasks" element={<Tasks />} />
            <Route path="/team" element={<Team />} />
            <Route path="/profile" element={<Profile />} />
          </Route>
        </Route>

        {/* Admin-only pages */}
        <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
          <Route element={<AppLayout />}>
            <Route path="/users" element={<Users />} />
          </Route>
        </Route>

        {/* Default pages */}
        <Route path="/" element={<DashboardRedirect />} />
        <Route path="*" element={<DashboardRedirect />} />
      </Routes>
    </BrowserRouter>
  );
}
