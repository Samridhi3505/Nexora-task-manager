
import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { pool } from '../db.js'

const router = express.Router()

const PUBLIC_ROLES = [
  'project_manager',
  'team_member',
  'viewer',
]

const ALL_ROLES = ['admin', ...PUBLIC_ROLES]

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
    id: user.id,
    name: user.name,
    email: user.email,
    role: normalizeRole(user.role),
  }
}

function createToken(user) {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured')
  }

  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: normalizeRole(user.role),
    },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  )
}

// REGISTER
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body
    const role = normalizeRole(req.body.role || 'team_member')

    if (
      typeof name !== 'string' ||
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      !name.trim() ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        message: 'Name, email, and password are required.',
      })
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: 'Password must contain at least 8 characters.',
      })
    }

    if (!PUBLIC_ROLES.includes(role)) {
      return res.status(403).json({
        message: 'Admin registration is restricted.',
      })
    }

    const normalizedEmail = email.trim().toLowerCase()

    const existing = await pool.query(
      'SELECT id FROM users WHERE LOWER(email) = $1',
      [normalizedEmail]
    )

    if (existing.rows.length) {
      return res.status(409).json({
        message: 'Email already registered.',
      })
    }

    const roleResult = await pool.query(
      'SELECT id FROM roles WHERE name = $1',
      [databaseRole(role)]
    )

    if (!roleResult.rows.length) {
      return res.status(500).json({
        message: 'The selected role is missing from the roles table.',
      })
    }

    const passwordHash = await bcrypt.hash(password, 10)

    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role_id`,
      [
        name.trim(),
        normalizedEmail,
        passwordHash,
        roleResult.rows[0].id,
      ]
    )

    return res.status(201).json({
      message: 'Registration successful. Please log in.',
      user: {
        id: result.rows[0].id,
        name: result.rows[0].name,
        email: result.rows[0].email,
        role,
      },
    })
  } catch (error) {
    console.error('Registration error:', error.message)

    if (error.code === '23505') {
      return res.status(409).json({
        message: 'Email already registered.',
      })
    }

    return res.status(500).json({
      message: 'Registration failed.',
    })
  }
})

// LOGIN
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    const requestedRole = req.body.role
      ? normalizeRole(req.body.role)
      : null

    if (
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        message: 'Email and password are required.',
      })
    }

    const result = await pool.query(
      `SELECT
         u.id,
         u.name,
         u.email,
         u.password_hash,
         u.is_active,
         r.name AS role
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE LOWER(u.email) = $1`,
      [email.trim().toLowerCase()]
    )

    if (!result.rows.length) {
      return res.status(401).json({
        message: 'Invalid email or password.',
      })
    }

    const user = result.rows[0]

    if (!user.is_active) {
      return res.status(403).json({
        message: 'This account is inactive. Contact an administrator.',
      })
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.password_hash
    )

    if (!passwordMatches) {
      return res.status(401).json({
        message: 'Invalid email or password.',
      })
    }

    const role = normalizeRole(user.role)

    if (!ALL_ROLES.includes(role)) {
      return res.status(403).json({
        message: 'Your account has an unsupported role.',
      })
    }

    if (requestedRole && requestedRole !== role) {
      return res.status(403).json({
        message: `This account is not registered as ${requestedRole.replace(/_/g, ' ')}.`,
      })
    }

    const authenticatedUser = { ...user, role }
    const token = createToken(authenticatedUser)

    return res.status(200).json({
      message: 'Login successful',
      token,
      user: publicUser(authenticatedUser),
    })
  } catch (error) {
    console.error('Login error:', error.message)

    return res.status(500).json({
      message: 'Login failed. Check the backend terminal for details.',
    })
  }
})

export default router
