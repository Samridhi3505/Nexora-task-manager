
import express from 'express'
import { pool } from '../db.js'
import authMiddleware from '../middleware/authMiddleware.js'

const router = express.Router()

function normalizeRole(role = '') {
  return String(role)
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_')
}

// GET /api/users/me
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, role, is_active, created_at
       FROM users
       WHERE id = $1`,
      [req.user.id]
    )

    if (!result.rows.length) {
      return res.status(404).json({ message: 'User not found.' })
    }

    const user = result.rows[0]

    return res.json({
      ...user,
      role: normalizeRole(user.role),
    })
  } catch (error) {
    console.error('Profile error:', error.message)
    return res.status(500).json({
      message: 'Could not fetch profile.',
    })
  }
})

// GET /api/users
// Admins and Project Managers can list users.
router.get(
  '/',
  authMiddleware,
  async (req, res) => {
    try {
      const role = normalizeRole(req.user.role)

      if (!['admin', 'project_manager'].includes(role)) {
        return res.status(403).json({
          message: 'You are not allowed to list all users.',
        })
      }

      const result = await pool.query(
        `SELECT id, name, email, role, is_active, created_at
         FROM users
         ORDER BY name`
      )

      return res.json(
        result.rows.map((user) => ({
          ...user,
          role: normalizeRole(user.role),
        }))
      )
    } catch (error) {
      console.error('Users error:', error.message)
      return res.status(500).json({
        message: 'Could not fetch users.',
      })
    }
  }
)

// PUT /api/users/me
router.put('/me', authMiddleware, async (req, res) => {
  try {
    const { name } = req.body

    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({
        message: 'Name is required.',
      })
    }

    const result = await pool.query(
      `UPDATE users
       SET name = $1
       WHERE id = $2
       RETURNING id, name, email, role`,
      [name.trim(), req.user.id]
    )

    if (!result.rows.length) {
      return res.status(404).json({ message: 'User not found.' })
    }

    return res.json({
      message: 'Profile updated successfully.',
      user: {
        ...result.rows[0],
        role: normalizeRole(result.rows[0].role),
      },
    })
  } catch (error) {
    console.error('Profile update error:', error.message)
    return res.status(500).json({
      message: 'Could not update profile.',
    })
  }
})

export default router
