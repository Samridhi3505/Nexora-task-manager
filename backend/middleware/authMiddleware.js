
import jwt from 'jsonwebtoken'

export default function authMiddleware(req, res, next) {
  const authorization = req.headers.authorization

  if (!authorization || !authorization.startsWith('Bearer ')) {
    return res.status(401).json({
      message: 'Please log in first.',
    })
  }

  if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET is not configured.')

    return res.status(500).json({
      message: 'Authentication is not configured correctly.',
    })
  }

  const token = authorization.slice(7).trim()

  if (!token) {
    return res.status(401).json({
      message: 'Authentication token is missing.',
    })
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    if (!decoded.id || !decoded.role) {
      return res.status(401).json({
        message: 'Token is missing required user information.',
      })
    }

    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: String(decoded.role)
        .toLowerCase()
        .trim()
        .replace(/[\s-]+/g, '_'),
    }

    next()
  } catch (error) {
    return res.status(401).json({
      message:
        error.name === 'TokenExpiredError'
          ? 'Your session has expired. Please log in again.'
          : 'Invalid authentication token.',
    })
  }
}
