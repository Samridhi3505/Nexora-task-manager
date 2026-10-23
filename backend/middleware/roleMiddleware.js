
const VALID_ROLES = [
  'admin',
  'project_manager',
  'team_member',
  'viewer',
]

function normalizeRole(role = '') {
  return String(role)
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_')
}

export function allowRoles(...roles) {
  const allowedRoles = roles.map(normalizeRole)

  return (req, res, next) => {
    // Authentication middleware must run first.
    if (!req.user) {
      return res.status(401).json({
        message: 'Please log in first.',
      })
    }

    const userRole = normalizeRole(req.user.role)

    if (!VALID_ROLES.includes(userRole)) {
      return res.status(403).json({
        message: 'Your account has an invalid role.',
      })
    }

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        message: 'You do not have permission to perform this action.',
      })
    }

    next()
  }
}
