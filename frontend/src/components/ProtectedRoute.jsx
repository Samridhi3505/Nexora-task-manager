
import { Navigate, Outlet, useLocation } from 'react-router-dom'

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

  // Require both a token and valid user information.
  if (!token || !user || !user.id || !user.role) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  // Restrict pages based on the user's role.
  if (
    allowedRoles &&
    !allowedRoles.includes(
      String(user.role).toLowerCase().replace(/[\s-]+/g, '_')
    )
  ) {
    return <Navigate to="/dashboard" replace />
  }

  return children ?? <Outlet />
}
