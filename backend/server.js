
import 'dotenv/config'
import express from 'express'
import cors from 'cors'

import { testDatabaseConnection } from './db.js'

import authRoutes from './routes/authRoutes.js'
import userRoutes from './routes/userRoutes.js'
import projectRoutes from './routes/projectRoutes.js'
import taskRoutes from './routes/taskRoutes.js'
import commentRoutes from './routes/commentRoutes.js'
import dashboardRoutes from './routes/dashboardRoutes.js'

const app = express()

// CORS configuration
const allowedOrigins = (
  process.env.FRONTEND_URL || 'http://localhost:5173'
)
  .split(',')
  .map((origin) => origin.trim())

app.use(
  cors({
    origin(origin, callback) {
      // Allow requests without an Origin header, such as Postman.
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true)
      }

      return callback(new Error('Origin not allowed by CORS'))
    },
  })
)

// Request parsing
app.use(express.json({ limit: '1mb' }))

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'neostats-backend',
  })
})

// API routes
app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/projects', projectRoutes)
app.use('/api/tasks', taskRoutes)
app.use('/api/comments', commentRoutes)
app.use('/api/dashboard', dashboardRoutes)

// Unknown route handler
app.use((req, res) => {
  res.status(404).json({
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  })
})

// Central error handler
app.use((err, _req, res, _next) => {
  console.error('API error:', err.message)

  if (err.message === 'Origin not allowed by CORS') {
    return res.status(403).json({
      message: 'This frontend origin is not allowed.',
    })
  }

  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({
      message: 'Invalid JSON request body.',
    })
  }

  return res.status(err.status || 500).json({
    message:
      err.status && err.status < 500
        ? err.message
        : 'Internal server error.',
  })
})

const PORT = process.env.PORT || 5000

async function startServer() {
  try {
    await testDatabaseConnection()

    app.listen(PORT, () => {
      console.log(`API running at http://localhost:${PORT}`)
      console.log(`Health check: http://localhost:${PORT}/api/health`)
    })
  } catch (error) {
    console.error('Database connection failed:', error.message)
    process.exit(1)
  }
}

startServer()
