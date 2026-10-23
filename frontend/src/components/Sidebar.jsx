
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import '../styles/Sidebar.css'

function normalizeRole(role = '') {
  return String(role)
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_')
}

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}')
  } catch {
    return {}
  }
}

function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const [user, setUser] = useState(getStoredUser)

  useEffect(() => {
    setUser(getStoredUser())
  }, [location.pathname])

  const role = normalizeRole(user.role)

  const roleLabels = {
    admin: 'Administrator',
    project_manager: 'Project Manager',
    team_member: 'Team Member',
    viewer: 'Viewer',
  }

  const links = [
    { label: 'Dashboard', path: '/dashboard', icon: '▦' },
    { label: 'Projects', path: '/projects', icon: '📁' },
    { label: 'Tasks', path: '/tasks', icon: '✓' },
    { label: 'Team', path: '/team', icon: '♧' },
    ...(role === 'admin'
      ? [{ label: 'Users', path: '/users', icon: '♙' }]
      : []),
    { label: 'Profile', path: '/profile', icon: '◉' },
  ]

  function logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login', { replace: true })
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span>Nexora</span>
      </div>

      <div className="sidebar-user">
        <div className="sidebar-user-avatar">
          {(user.name || user.email || 'U')
            .charAt(0)
            .toUpperCase()}
        </div>

        <div className="sidebar-user-info">
          <strong>{user.name || 'Workspace User'}</strong>
          <span>{roleLabels[role] || 'User'}</span>
        </div>
      </div>

      <p className="sidebar-section-title">WORKSPACE</p>

      <nav className="sidebar-nav">
        {links.map((link) => (
          <NavLink
            key={link.label}
            to={link.path}
            end={link.path === '/projects'}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'active' : ''}`
            }
          >
            <span className="sidebar-link-icon">{link.icon}</span>
            <span>{link.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <button
          type="button"
          className="sidebar-logout"
          onClick={logout}
        >
          <span className="sidebar-link-icon">↪</span>
          Logout
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
