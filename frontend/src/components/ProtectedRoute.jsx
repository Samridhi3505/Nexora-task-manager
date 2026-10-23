
import { Navigate, Outlet, useLocation } from 'react-router-dom'

function normalizeRole(role = '') {
  return String(role)
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
}

export default function ProtectedRoute({ children, allowedRoles }) {
  const location = useLocation()
  const token = localStorage.getItem('token')
  const storedUser = localStorage.getItem('user')

  let user = null

  try {
    user = storedUser ? JSON.parse(storedUser) : null
  } catch {
    user = null
  }

  if (!token || !user?.id || !user?.role) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location }}
      />
    )
  }

  if (
    allowedRoles &&
    !allowedRoles.map(normalizeRole).includes(normalizeRole(user.role))
  ) {
    return <Navigate to="/dashboard" replace />
  }

  return children ?? <Outlet />
}
