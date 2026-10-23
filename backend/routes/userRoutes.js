
import express from 'express'
import bcrypt from 'bcryptjs'
import { pool } from '../db.js'
import authMiddleware from '../middleware/authMiddleware.js'

const router = express.Router()

function normalizeRole(role = '') {
  return String(role)
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_')
}

function databaseRole(role) {
  const roles = {
    admin: 'Admin',
    project_manager: 'Project Manager',
    team_member: 'Team Member',
    viewer: 'Viewer',
  }

  return roles[normalizeRole(role)]
}

function publicUser(user) {
  return {
    ...user,
    role: normalizeRole(user.role),
  }
}

// GET /api/users/me — Get the logged-in user's profile
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, role, is_active, created_at
       FROM users
       WHERE id = $1`,
      [req.user.id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: 'User not found.',
      })
    }

    return res.json(publicUser(result.rows[0]))
  } catch (error) {
    console.error('Profile error:', error.message)

    return res.status(500).json({
      message: 'Could not fetch profile.',
    })
  }
})

// GET /api/users — List workspace users
router.get('/', authMiddleware, async (req, res) => {
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

    return res.json(result.rows.map(publicUser))
  } catch (error) {
    console.error('Users error:', error.message)

    return res.status(500).json({
      message: 'Could not fetch users.',
    })
  }
})

// POST /api/users — Create a workspace user (Admin only)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const currentRole = normalizeRole(req.user.role)

    if (currentRole !== 'admin') {
      return res.status(403).json({
        message: 'Only administrators can create users.',
      })
    }

    const { name, email, password, role = 'Team Member' } = req.body

    if (
      typeof name !== 'string' ||
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      !name.trim() ||
      !email.trim() ||
      password.length < 8
    ) {
      return res.status(400).json({
        message:
          'Name, email, and a password of at least 8 characters are required.',
      })
    }

    const normalizedRole = normalizeRole(role)
    const allowedRoles = [
      'admin',
      'project_manager',
      'team_member',
      'viewer',
    ]

    if (!allowedRoles.includes(normalizedRole)) {
      return res.status(400).json({
        message: 'Invalid user role.',
      })
    }

    const normalizedEmail = email.trim().toLowerCase()

    const existing = await pool.query(
      'SELECT id FROM users WHERE LOWER(email) = $1',
      [normalizedEmail]
    )

    if (existing.rows.length > 0) {
      return res.status(409).json({
        message: 'Email already registered.',
      })
    }

    const passwordHash = await bcrypt.hash(password, 10)

    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role, is_active, created_at`,
      [
        name.trim(),
        normalizedEmail,
        passwordHash,
        databaseRole(normalizedRole),
      ]
    )

    return res.status(201).json({
      message: 'User created successfully.',
      user: publicUser(result.rows[0]),
    })
  } catch (error) {
    console.error('Create user error:', error.message)

    if (error.code === '23505') {
      return res.status(409).json({
        message: 'Email already registered.',
      })
    }

    return res.status(500).json({
      message: 'Could not create user.',
    })
  }
})

// PUT /api/users/me — Update the logged-in user's profile
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

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: 'User not found.',
      })
    }

    return res.json({
      message: 'Profile updated successfully.',
      user: publicUser(result.rows[0]),
    })
  } catch (error) {
    console.error('Profile update error:', error.message)

    return res.status(500).json({
      message: 'Could not update profile.',
    })
  }
})

// PATCH /api/users/:id — Deactivate a user (Admin only)
router.patch('/:id', authMiddleware, async (req, res) => {
  try {
    if (normalizeRole(req.user.role) !== 'admin') {
      return res.status(403).json({
        message: 'Only administrators can deactivate users.',
      })
    }

    if (req.body.is_active !== false) {
      return res.status(400).json({
        message: 'Only deactivation is supported by this endpoint.',
      })
    }

    if (String(req.params.id) === String(req.user.id)) {
      return res.status(400).json({
        message: 'You cannot deactivate your own account.',
      })
    }

    const result = await pool.query(
      `UPDATE users
       SET is_active = FALSE
       WHERE id = $1
       RETURNING id, name, email, role, is_active, created_at`,
      [req.params.id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: 'User not found.',
      })
    }

    return res.json({
      message: 'User deactivated successfully.',
      user: publicUser(result.rows[0]),
    })
  } catch (error) {
    console.error('Deactivate user error:', error.message)

    return res.status(500).json({
      message: 'Could not deactivate user.',
    })
  }
})



// Create a user (Admin only)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const currentRole = String(req.user?.role || '')
      .toLowerCase()
      .trim()
      .replace(/[\s-]+/g, '_');

    if (currentRole !== 'admin') {
      return res.status(403).json({
        message: 'Only admins can create users',
      });
    }

    const { name, email, password, role } = req.body;

    if (!name?.trim() || !email?.trim() || !password || !role) {
      return res.status(400).json({
        message: 'Name, email, password and role are required',
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: 'Password must be at least 8 characters',
      });
    }

    const normalizedRole = String(role)
      .toLowerCase()
      .trim()
      .replace(/[\s-]+/g, '_');

    const allowedRoles = [
      'admin',
      'project_manager',
      'team_member',
      'viewer',
    ];

    if (!allowedRoles.includes(normalizedRole)) {
      return res.status(400).json({
        message: 'Invalid role selected',
      });
    }

    const existingUser = await pool.query(
      'SELECT id FROM users WHERE LOWER(email) = LOWER($1)',
      [email.trim()]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        message: 'Email is already registered',
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role, is_active, created_at`,
      [
        name.trim(),
        email.trim().toLowerCase(),
        passwordHash,
        normalizedRole,
      ]
    );

    return res.status(201).json({
      message: 'User created successfully',
      user: result.rows[0],
    });
  } catch (error) {
    console.error('Create user error:', error);

    if (error.code === '23505') {
      return res.status(409).json({
        message: 'Email is already registered',
      });
    }

    return res.status(500).json({
      message: 'Failed to create user',
    });
  }
});


export default router
