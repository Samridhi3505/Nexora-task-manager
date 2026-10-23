
function normalizeRole(role = '') {
  return String(role)
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_')
}

// Check whether a user can manage a project.
export function canManageProject(user, project) {
  if (!user || !project) return false

  const role = normalizeRole(user.role)
  const userId = Number(user.id)

  // Admins can manage every project.
  if (role === 'admin') return true

  // Project Managers can manage projects they created or own.
  if (role === 'project_manager') {
    return (
      Number(project.created_by) === userId ||
      Number(project.owner_id) === userId
    )
  }

  return false
}

// Check whether a user can edit a task.
export function canEditTask(user, task) {
  if (!user || !task) return false

  const role = normalizeRole(user.role)
  const userId = Number(user.id)

  // Admins can edit any task.
  if (role === 'admin') return true

  // Project Managers can edit tasks in projects they created or own.
  if (role === 'project_manager') {
    return (
      Number(task.project_created_by) === userId ||
      Number(task.project_owner_id) === userId
    )
  }

  // Team Members can edit tasks assigned to them.
  if (role === 'team_member') {
    return Number(task.assignee_id) === userId
  }

  // Viewers have read-only access.
  return false
}
