
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

async function canAccessTask(taskId, userId, userRole) {
  const role = normalizeRole(userRole)

  if (role === 'admin') {
    const result = await pool.query(
      'SELECT id FROM tasks WHERE id = $1',
      [taskId]
    )
    return result.rows.length > 0
  }

  const result = await pool.query(
    `SELECT t.id
     FROM tasks t
     JOIN projects p ON p.id = t.project_id
     LEFT JOIN project_members pm
       ON pm.project_id = p.id
       AND pm.user_id = $2
     WHERE t.id = $1
       AND (
         p.created_by = $2
         OR p.owner_id = $2
         OR pm.user_id = $2
       )
     LIMIT 1`,
    [taskId, userId]
  )

  return result.rows.length > 0
}

// GET /api/comments/task/:taskId
router.get('/task/:taskId', async (req, res) => {
  try {
    const taskId = Number(req.params.taskId)

    if (!Number.isInteger(taskId) || taskId <= 0) {
      return res.status(400).json({
        message: 'Invalid task ID.',
      })
    }

    const hasAccess = await canAccessTask(
      taskId,
      req.user.id,
      req.user.role
    )

    if (!hasAccess) {
      return res.status(404).json({
        message: 'Task not found or you do not have access.',
      })
    }

    const result = await pool.query(
      `SELECT c.id, c.task_id, c.user_id, c.body,
              c.created_at, u.name AS user_name
       FROM comments c
       LEFT JOIN users u ON u.id = c.user_id
       WHERE c.task_id = $1
       ORDER BY c.created_at ASC`,
      [taskId]
    )

    return res.json(result.rows)
  } catch (error) {
    console.error('Fetch comments error:', error.message)
    return res.status(500).json({
      message: 'Could not fetch comments.',
    })
  }
})

// POST /api/comments
router.post('/', async (req, res) => {
  try {
    const { task_id, body } = req.body
    const taskId = Number(task_id)

    if (
      !Number.isInteger(taskId) ||
      taskId <= 0 ||
      typeof body !== 'string' ||
      !body.trim()
    ) {
      return res.status(400).json({
        message: 'A valid task ID and comment are required.',
      })
    }

    const hasAccess = await canAccessTask(
      taskId,
      req.user.id,
      req.user.role
    )

    if (!hasAccess) {
      return res.status(403).json({
        message: 'You cannot comment on this task.',
      })
    }

    const result = await pool.query(
      `INSERT INTO comments (task_id, user_id, body)
       VALUES ($1, $2, $3)
       RETURNING id, task_id, user_id, body, created_at`,
      [taskId, req.user.id, body.trim()]
    )

    return res.status(201).json({
      message: 'Comment added successfully.',
      comment: result.rows[0],
    })
  } catch (error) {
    console.error('Add comment error:', error.message)
    return res.status(500).json({
      message: 'Could not add comment.',
    })
  }
})

export default router
