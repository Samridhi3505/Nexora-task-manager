
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
    throw new Error('JWT_SECRET is not configured.')
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

    // Admin accounts cannot be created through public registration.
    if (!PUBLIC_ROLES.includes(role)) {
      return res.status(403).json({
        message: 'This role cannot be registered publicly.',
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

    const hashedPassword = await bcrypt.hash(password, 10)

    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role`,
      [
        name.trim(),
        normalizedEmail,
        hashedPassword,
        databaseRole(role),
      ]
    )

    return res.status(201).json({
      message: 'Registration successful. Please log in.',
      user: publicUser(result.rows[0]),
    })
  } catch (error) {
    console.error('Registration error:', error.message)

    if (error.code === '23505') {
      return res.status(409).json({
        message: 'Email already registered.',
      })
    }

    return res.status(500).json({
      message: 'Registration failed. Check the backend terminal.',
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

    if (requestedRole && !ALL_ROLES.includes(requestedRole)) {
      return res.status(400).json({
        message: 'Invalid role selected.',
      })
    }

    const result = await pool.query(
      `SELECT id, name, email, password_hash, role, is_active
       FROM users
       WHERE LOWER(email) = $1`,
      [email.trim().toLowerCase()]
    )

    if (result.rows.length === 0) {
      return res.status(401).json({
        message: 'Invalid email or password.',
      })
    }

    const user = result.rows[0]

    if (!user.is_active) {
      return res.status(403).json({
        message: 'Your account is inactive.',
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

    const actualRole = normalizeRole(user.role)

    if (!ALL_ROLES.includes(actualRole)) {
      return res.status(403).json({
        message: 'Your account has an unsupported role.',
      })
    }

    if (requestedRole && requestedRole !== actualRole) {
      return res.status(403).json({
        message: `This account is not registered as ${requestedRole.replace(/_/g, ' ')}.`,
      })
    }

    const token = createToken(user)

    return res.status(200).json({
      message: 'Login successful',
      token,
      user: publicUser(user),
    })
  } catch (error) {
    console.error('Login error:', error.message)

    return res.status(500).json({
      message: 'Login failed. Check the backend terminal.',
    })
  }
})

export default router
