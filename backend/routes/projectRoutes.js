
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

function isAdmin(req) {
  return normalizeRole(req.user.role) === 'admin'
}

function canManageProjects(req) {
  return ['admin', 'project_manager'].includes(
    normalizeRole(req.user.role)
  )
}

// GET /api/projects
// List projects the user can access.
router.get('/', async (req, res) => {
  try {
    const userId = Number(req.user.id)

    const result = await pool.query(
      `SELECT DISTINCT p.*
       FROM projects p
       LEFT JOIN project_members pm
         ON pm.project_id = p.id
         AND pm.user_id = $1
       WHERE $2 = 'admin'
          OR p.created_by = $1
          OR p.owner_id = $1
          OR pm.user_id = $1
       ORDER BY p.id DESC`,
      [userId, normalizeRole(req.user.role)]
    )

    return res.json(result.rows)
  } catch (error) {
    console.error('Fetch projects error:', error.message)
    return res.status(500).json({
      message: 'Could not fetch projects.',
    })
  }
})

// GET /api/projects/:id
router.get('/:id', async (req, res) => {
  try {
    const projectId = Number(req.params.id)

    if (!Number.isInteger(projectId) || projectId <= 0) {
      return res.status(400).json({
        message: 'Invalid project ID.',
      })
    }

    const result = await pool.query(
      `SELECT DISTINCT p.*
       FROM projects p
       LEFT JOIN project_members pm
         ON pm.project_id = p.id
         AND pm.user_id = $2
       WHERE p.id = $1
         AND (
           $3 = 'admin'
           OR p.created_by = $2
           OR p.owner_id = $2
           OR pm.user_id = $2
         )
       LIMIT 1`,
      [
        projectId,
        Number(req.user.id),
        normalizeRole(req.user.role),
      ]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: 'Project not found or you do not have access.',
      })
    }

    return res.json(result.rows[0])
  } catch (error) {
    console.error('Fetch project error:', error.message)
    return res.status(500).json({
      message: 'Could not fetch project.',
    })
  }
})

// POST /api/projects
router.post('/', async (req, res) => {
  if (!canManageProjects(req)) {
    return res.status(403).json({
      message: 'Only Admins and Project Managers can create projects.',
    })
  }

  let client

  try {
    const { name, description = '' } = req.body

    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({
        message: 'Project name is required.',
      })
    }

    if (typeof description !== 'string') {
      return res.status(400).json({
        message: 'Description must be text.',
      })
    }

    client = await pool.connect()
    await client.query('BEGIN')

    const result = await client.query(
      `INSERT INTO projects
         (name, description, status, created_by, owner_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        name.trim(),
        description.trim(),
        'Active',
        Number(req.user.id),
        Number(req.user.id),
      ]
    )

    const project = result.rows[0]

    await client.query(
      `INSERT INTO project_members
         (project_id, user_id, project_role)
       VALUES ($1, $2, $3)
       ON CONFLICT (project_id, user_id) DO NOTHING`,
      [
        project.id,
        Number(req.user.id),
        'Project Manager',
      ]
    )

    await client.query('COMMIT')

    return res.status(201).json({
      message: 'Project created successfully.',
      project,
    })
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK').catch(() => {})
    }

    console.error('Create project error:', error.message)
    return res.status(500).json({
      message: 'Could not create project.',
    })
  } finally {
    client?.release()
  }
})

// PUT /api/projects/:id
router.put('/:id', async (req, res) => {
  if (!canManageProjects(req)) {
    return res.status(403).json({
      message: 'You cannot update projects.',
    })
  }

  try {
    const projectId = Number(req.params.id)

    if (!Number.isInteger(projectId) || projectId <= 0) {
      return res.status(400).json({
        message: 'Invalid project ID.',
      })
    }

    const { name, description, status } = req.body
    const allowedStatuses = ['Active', 'Completed', 'On Hold']

    if (
      name !== undefined &&
      (typeof name !== 'string' || !name.trim())
    ) {
      return res.status(400).json({
        message: 'Project name cannot be empty.',
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

    if (
      status !== undefined &&
      !allowedStatuses.includes(status)
    ) {
      return res.status(400).json({
        message: 'Invalid project status.',
      })
    }

    const result = await pool.query(
      `UPDATE projects
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           status = COALESCE($3, status),
           updated_at = NOW()
       WHERE id = $4
         AND (
           $5 = 'admin'
           OR created_by = $6
           OR owner_id = $6
         )
       RETURNING *`,
      [
        name === undefined ? null : name.trim(),
        description === undefined ? null : description.trim(),
        status ?? null,
        projectId,
        normalizeRole(req.user.role),
        Number(req.user.id),
      ]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: 'Project not found or you cannot manage it.',
      })
    }

    return res.json({
      message: 'Project updated successfully.',
      project: result.rows[0],
    })
  } catch (error) {
    console.error('Update project error:', error.message)
    return res.status(500).json({
      message: 'Could not update project.',
    })
  }
})

// DELETE /api/projects/:id
router.delete('/:id', async (req, res) => {
  if (!canManageProjects(req)) {
    return res.status(403).json({
      message: 'You cannot delete projects.',
    })
  }

  try {
    const projectId = Number(req.params.id)

    if (!Number.isInteger(projectId) || projectId <= 0) {
      return res.status(400).json({
        message: 'Invalid project ID.',
      })
    }

    const result = await pool.query(
      `DELETE FROM projects
       WHERE id = $1
         AND (
           $2 = 'admin'
           OR created_by = $3
           OR owner_id = $3
         )
       RETURNING id`,
      [
        projectId,
        normalizeRole(req.user.role),
        Number(req.user.id),
      ]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: 'Project not found or you cannot manage it.',
      })
    }

    return res.json({
      message: 'Project deleted successfully.',
    })
  } catch (error) {
    console.error('Delete project error:', error.message)

    // Foreign-key constraints may prevent deleting a project
    // while tasks or other related records still exist.
    return res.status(500).json({
      message: 'Could not delete project. It may have related tasks or records.',
    })
  }
})

export default router
