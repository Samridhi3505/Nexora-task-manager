
import express from 'express'
import { pool } from '../db.js'
import authMiddleware from '../middleware/authMiddleware.js'

const router = express.Router()

router.use(authMiddleware)

function normalizeRole(role = '') {
  return String(role)
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_')
}

function canManageProjects(role) {
  return ['admin', 'project_manager'].includes(normalizeRole(role))
}

function canUpdateTask(role) {
  return ['admin', 'project_manager', 'team_member'].includes(
    normalizeRole(role)
  )
}

async function canAccessProject(projectId, userId, role) {
  const result = await pool.query(
    `SELECT p.id
     FROM projects p
     LEFT JOIN project_members pm
       ON pm.project_id = p.id AND pm.user_id = $2
     WHERE p.id = $1
       AND (
         $3 = 'admin'
         OR p.created_by = $2
         OR p.owner_id = $2
         OR pm.user_id = $2
       )
     LIMIT 1`,
    [projectId, userId, normalizeRole(role)]
  )

  return result.rows.length > 0
}

// GET /api/tasks
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT t.*
       FROM tasks t
       JOIN projects p ON p.id = t.project_id
       LEFT JOIN project_members pm
         ON pm.project_id = p.id AND pm.user_id = $1
       WHERE $2 = 'admin'
          OR p.created_by = $1
          OR p.owner_id = $1
          OR pm.user_id = $1
          OR t.assignee_id = $1
       ORDER BY t.id DESC`,
      [Number(req.user.id), normalizeRole(req.user.role)]
    )

    return res.json(result.rows)
  } catch (error) {
    console.error('Fetch tasks error:', error.message)
    return res.status(500).json({
      message: 'Could not fetch tasks.',
    })
  }
})

// POST /api/tasks
router.post('/', async (req, res) => {
  if (!canManageProjects(req.user.role)) {
    return res.status(403).json({
      message: 'Only Admins and Project Managers can create tasks.',
    })
  }

  try {
    const {
      project_id,
      title,
      description = '',
      assignee_id = null,
      due_date = null,
      priority = 'Medium',
    } = req.body

    const projectId = Number(project_id)

    if (
      !Number.isInteger(projectId) ||
      projectId <= 0 ||
      typeof title !== 'string' ||
      !title.trim()
    ) {
      return res.status(400).json({
        message: 'A valid project ID and task title are required.',
      })
    }

    if (typeof description !== 'string') {
      return res.status(400).json({
        message: 'Description must be text.',
      })
    }

    if (!['Low', 'Medium', 'High'].includes(priority)) {
      return res.status(400).json({
        message: 'Priority must be Low, Medium, or High.',
      })
    }

    if (
      due_date !== null &&
      due_date !== '' &&
      (typeof due_date !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(due_date) ||
        Number.isNaN(Date.parse(`${due_date}T00:00:00Z`)))
    ) {
      return res.status(400).json({
        message: 'Due date must use YYYY-MM-DD format.',
      })
    }

    const hasAccess = await canAccessProject(
      projectId,
      Number(req.user.id),
      req.user.role
    )

    if (!hasAccess) {
      return res.status(403).json({
        message: 'You cannot create tasks in this project.',
      })
    }

    let assigneeId = null

    if (assignee_id !== null && assignee_id !== '') {
      assigneeId = Number(assignee_id)

      if (!Number.isInteger(assigneeId) || assigneeId <= 0) {
        return res.status(400).json({
          message: 'Invalid assignee ID.',
        })
      }

      const member = await pool.query(
        `SELECT 1
         FROM project_members
         WHERE project_id = $1 AND user_id = $2
         UNION
         SELECT 1
         FROM projects
         WHERE id = $1 AND owner_id = $2`,
        [projectId, assigneeId]
      )

      if (!member.rows.length) {
        return res.status(400).json({
          message: 'The assignee must be a member or owner of the project.',
        })
      }
    }

    const result = await pool.query(
      `INSERT INTO tasks
         (project_id, title, description, status, priority,
          assignee_id, created_by, due_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        projectId,
        title.trim(),
        description.trim(),
        'To Do',
        priority,
        assigneeId,
        Number(req.user.id),
        due_date || null,
      ]
    )

    return res.status(201).json({
      message: 'Task created successfully.',
      task: result.rows[0],
    })
  } catch (error) {
    console.error('Create task error:', error.message)
    return res.status(500).json({
      message: 'Could not create task.',
    })
  }
})

// PUT /api/tasks/:id
router.put('/:id', async (req, res) => {
  const role = normalizeRole(req.user.role)

  if (!canUpdateTask(role)) {
    return res.status(403).json({
      message: 'You cannot update tasks.',
    })
  }

  try {
    const taskId = Number(req.params.id)

    if (!Number.isInteger(taskId) || taskId <= 0) {
      return res.status(400).json({
        message: 'Invalid task ID.',
      })
    }

    const {
      title,
      description,
      status,
      assignee_id,
      due_date,
      priority,
    } = req.body

    const allowedStatuses = ['To Do', 'In Progress', 'Done']
    const allowedPriorities = ['Low', 'Medium', 'High']

    if (
      title !== undefined &&
      (typeof title !== 'string' || !title.trim())
    ) {
      return res.status(400).json({
        message: 'Task title cannot be empty.',
      })
    }

    if (
      description !== undefined &&
      typeof description !== 'string'
    ) {
      return res.status(400).json({
        message: 'Description must be text.',
      })
    }

    if (status !== undefined && !allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: 'Status must be To Do, In Progress, or Done.',
      })
    }

    if (
      priority !== undefined &&
      !allowedPriorities.includes(priority)
    ) {
      return res.status(400).json({
        message: 'Priority must be Low, Medium, or High.',
      })
    }

    if (
      due_date !== undefined &&
      due_date !== null &&
      due_date !== '' &&
      (typeof due_date !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(due_date) ||
        Number.isNaN(Date.parse(`${due_date}T00:00:00Z`)))
    ) {
      return res.status(400).json({
        message: 'Due date must use YYYY-MM-DD format.',
      })
    }

    const access = await pool.query(
      `SELECT t.id, t.project_id, t.assignee_id
       FROM tasks t
       JOIN projects p ON p.id = t.project_id
       LEFT JOIN project_members pm
         ON pm.project_id = p.id AND pm.user_id = $2
       WHERE t.id = $1
         AND (
           $3 = 'admin'
           OR p.created_by = $2
           OR p.owner_id = $2
           OR pm.user_id = $2
           OR t.assignee_id = $2
         )
       LIMIT 1`,
      [taskId, Number(req.user.id), role]
    )

    if (!access.rows.length) {
      return res.status(404).json({
        message: 'Task not found or you do not have access.',
      })
    }

    const task = access.rows[0]

    if (
      role === 'team_member' &&
      Number(task.assignee_id) !== Number(req.user.id)
    ) {
      return res.status(403).json({
        message: 'Team Members can only update their assigned tasks.',
      })
    }

    let assigneeId = assignee_id

    if (assignee_id !== undefined) {
      if (assignee_id === null || assignee_id === '') {
        assigneeId = null
      } else {
        assigneeId = Number(assignee_id)

        if (!Number.isInteger(assigneeId) || assigneeId <= 0) {
          return res.status(400).json({
            message: 'Invalid assignee ID.',
          })
        }

        const member = await pool.query(
          `SELECT 1
           FROM project_members
           WHERE project_id = $1 AND user_id = $2
           UNION
           SELECT 1
           FROM projects
           WHERE id = $1 AND owner_id = $2`,
          [task.project_id, assigneeId]
        )

        if (!member.rows.length) {
          return res.status(400).json({
            message: 'The assignee must be a member or owner of the project.',
          })
        }
      }
    }

    const result = await pool.query(
      `UPDATE tasks
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           status = COALESCE($3, status),
           assignee_id = CASE
             WHEN $4 THEN $5
             ELSE assignee_id
           END,
           due_date = CASE
             WHEN $6 THEN $7::date
             ELSE due_date
           END,
           priority = COALESCE($8, priority),
           version = version + 1,
           updated_at = NOW()
       WHERE id = $9
       RETURNING *`,
      [
        title === undefined ? null : title.trim(),
        description === undefined ? null : description.trim(),
        status ?? null,
        assignee_id !== undefined,
        assigneeId ?? null,
        due_date !== undefined,
        due_date === '' ? null : due_date ?? null,
        priority ?? null,
        taskId,
      ]
    )

    return res.json({
      message: 'Task updated successfully.',
      task: result.rows[0],
    })
  } catch (error) {
    console.error('Update task error:', error.message)
    return res.status(500).json({
      message: 'Could not update task.',
    })
  }
})

// DELETE /api/tasks/:id
router.delete('/:id', async (req, res) => {
  if (!canManageProjects(req.user.role)) {
    return res.status(403).json({
      message: 'Only Admins and Project Managers can delete tasks.',
    })
  }

  try {
    const taskId = Number(req.params.id)

    if (!Number.isInteger(taskId) || taskId <= 0) {
      return res.status(400).json({
        message: 'Invalid task ID.',
      })
    }

    const result = await pool.query(
      `DELETE FROM tasks t
       USING projects p
       WHERE t.id = $1
         AND p.id = t.project_id
         AND (
           $2 = 'admin'
           OR p.created_by = $3
           OR p.owner_id = $3
         )
       RETURNING t.id`,
      [
        taskId,
        normalizeRole(req.user.role),
        Number(req.user.id),
      ]
    )

    if (!result.rows.length) {
      return res.status(404).json({
        message: 'Task not found or you cannot delete it.',
      })
    }

    return res.json({
      message: 'Task deleted successfully.',
    })
  } catch (error) {
    console.error('Delete task error:', error.message)
    return res.status(500).json({
      message: 'Could not delete task. It may have related comments or records.',
    })
  }
})

export default router
