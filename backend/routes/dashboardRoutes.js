
import express from 'express';
import { pool } from '../db.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = Number(req.user.id);

    const role = String(req.user.role || '')
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, '_');

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(401).json({
        message: 'Invalid authenticated user.'
      });
    }

    const result = await pool.query(
      `SELECT
         COUNT(DISTINCT p.id)::int AS total_projects,

         COUNT(DISTINCT t.id)::int AS total_tasks,

         COUNT(DISTINCT t.id) FILTER (
           WHERE LOWER(t.status) = 'done'
         )::int AS completed_tasks,

         COUNT(DISTINCT t.id) FILTER (
           WHERE LOWER(t.status) = 'to do'
         )::int AS pending_tasks,

         COUNT(DISTINCT t.id) FILTER (
           WHERE LOWER(t.status) = 'in progress'
         )::int AS in_progress_tasks

       FROM projects p

       LEFT JOIN project_members pm
         ON pm.project_id = p.id
         AND pm.user_id = $1

       LEFT JOIN tasks t
         ON t.project_id = p.id

       WHERE
         $2 = 'admin'
         OR p.created_by = $1
         OR p.owner_id = $1
         OR pm.user_id = $1
         OR t.assignee_id = $1`,
      [userId, role]
    );

    return res.json({
      total_projects: result.rows[0]?.total_projects ?? 0,
      total_tasks: result.rows[0]?.total_tasks ?? 0,
      completed_tasks: result.rows[0]?.completed_tasks ?? 0,
      pending_tasks: result.rows[0]?.pending_tasks ?? 0,
      in_progress_tasks: result.rows[0]?.in_progress_tasks ?? 0
    });
  } catch (error) {
    console.error('Dashboard error:', error);

    return res.status(500).json({
      message: 'Could not load dashboard statistics.',
      error: error.message
    });
  }
});

export default router;
