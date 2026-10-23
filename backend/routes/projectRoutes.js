
import express from 'express';
import { pool } from '../db.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(authMiddleware);

// ==================== HELPERS ====================

function normalizeRole(role = '') {
  return String(role)
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '_');
}

function isAdmin(req) {
  return normalizeRole(req.user?.role) === 'admin';
}

function isValidId(id) {
  return Number.isInteger(id) && id > 0;
}

function isManager(role) {
  return normalizeRole(role) === 'project_manager';
}

function canManageProject(req, project) {
  const userId = Number(req.user.id);
  const role = normalizeRole(req.user.role);
  const memberRole = normalizeRole(project.current_project_role);

  return (
    role === 'admin' ||
    Number(project.created_by) === userId ||
    Number(project.owner_id) === userId ||
    memberRole === 'project_manager'
  );
}

function handleError(res, message, error) {
  console.error(message, error);

  return res.status(500).json({
    message,
    error: error.message
  });
}

// ==================== GET ALL PROJECTS ====================
// GET /api/projects

router.get('/', async (req, res) => {
  try {
    const userId = Number(req.user.id);
    const role = normalizeRole(req.user.role);

    const result = await pool.query(
      `SELECT DISTINCT
          p.*,
          manager.name AS project_manager_name,
          manager.email AS project_manager_email
       FROM projects p
       LEFT JOIN users manager
         ON manager.id = p.owner_id
       LEFT JOIN project_members pm
         ON pm.project_id = p.id
        AND pm.user_id = $1
       WHERE $2 = 'admin'
          OR p.created_by = $1
          OR p.owner_id = $1
          OR pm.user_id = $1
       ORDER BY p.id DESC`,
      [userId, role]
    );

    return res.json(result.rows);
  } catch (error) {
    return handleError(res, 'Could not fetch projects.', error);
  }
});

// ==================== GET PROJECT MANAGERS ====================
// GET /api/projects/managers

router.get('/managers', async (req, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({
      message: 'Only Admins can view project managers.'
    });
  }

  try {
    const result = await pool.query(
      `SELECT id, name, email, role
       FROM users
       WHERE is_active = TRUE
       ORDER BY name ASC`
    );

    const managers = result.rows.filter(user =>
      isManager(user.role)
    );

    return res.json(managers);
  } catch (error) {
    return handleError(
      res,
      'Could not fetch project managers.',
      error
    );
  }
});

// ==================== GET SINGLE PROJECT ====================
// GET /api/projects/:id

router.get('/:id', async (req, res) => {
  try {
    const projectId = Number(req.params.id);
    const userId = Number(req.user.id);
    const role = normalizeRole(req.user.role);

    if (!isValidId(projectId)) {
      return res.status(400).json({
        message: 'Invalid project ID.'
      });
    }

    const result = await pool.query(
      `SELECT DISTINCT
          p.*,
          manager.name AS project_manager_name,
          manager.email AS project_manager_email
       FROM projects p
       LEFT JOIN users manager
         ON manager.id = p.owner_id
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
      [projectId, userId, role]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: 'Project not found or you do not have access.'
      });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    return handleError(res, 'Could not fetch project.', error);
  }
});

// ==================== CREATE PROJECT ====================
// POST /api/projects

router.post('/', async (req, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({
      message: 'Only Admins can create projects.'
    });
  }

  let client;

  try {
    const {
      name,
      description = '',
      project_manager_id
    } = req.body;

    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({
        message: 'Project name is required.'
      });
    }

    if (typeof description !== 'string') {
      return res.status(400).json({
        message: 'Description must be text.'
      });
    }

    let managerId = null;

    if (
      project_manager_id !== undefined &&
      project_manager_id !== null &&
      project_manager_id !== ''
    ) {
      managerId = Number(project_manager_id);

      if (!isValidId(managerId)) {
        return res.status(400).json({
          message: 'Invalid project manager ID.'
        });
      }

      const managerResult = await pool.query(
        `SELECT id, name, email, role
         FROM users
         WHERE id = $1
           AND is_active = TRUE`,
        [managerId]
      );

      if (
        managerResult.rows.length === 0 ||
        !isManager(managerResult.rows[0].role)
      ) {
        return res.status(400).json({
          message: 'Select a valid active project manager.'
        });
      }
    }

    client = await pool.connect();
    await client.query('BEGIN');

    const projectResult = await client.query(
      `INSERT INTO projects (
         name,
         description,
         status,
         created_by,
         owner_id
       )
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        name.trim(),
        description.trim(),
        'Active',
        Number(req.user.id),
        managerId
      ]
    );

    const project = projectResult.rows[0];

    if (managerId !== null) {
      await client.query(
        `INSERT INTO project_members (
           project_id,
           user_id,
           project_role
         )
         VALUES ($1, $2, $3)
         ON CONFLICT (project_id, user_id)
         DO UPDATE SET project_role = EXCLUDED.project_role`,
        [project.id, managerId, 'Project Manager']
      );
    }

    await client.query('COMMIT');

    return res.status(201).json({
      message: 'Project created successfully.',
      project
    });
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK').catch(() => {});
    }

    return handleError(res, 'Could not create project.', error);
  } finally {
    client?.release();
  }
});

// ==================== UPDATE PROJECT ====================
// PUT /api/projects/:id

router.put('/:id', async (req, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({
      message: 'Only Admins can update projects.'
    });
  }

  try {
    const projectId = Number(req.params.id);

    if (!isValidId(projectId)) {
      return res.status(400).json({
        message: 'Invalid project ID.'
      });
    }

    const { name, description, status } = req.body;
    const allowedStatuses = ['Active', 'Completed', 'On Hold'];

    if (
      name !== undefined &&
      (typeof name !== 'string' || !name.trim())
    ) {
      return res.status(400).json({
        message: 'Project name cannot be empty.'
      });
    }

    if (
      description !== undefined &&
      typeof description !== 'string'
    ) {
      return res.status(400).json({
        message: 'Description must be text.'
      });
    }

    if (
      status !== undefined &&
      !allowedStatuses.includes(status)
    ) {
      return res.status(400).json({
        message: 'Invalid project status.'
      });
    }

    const result = await pool.query(
      `UPDATE projects
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           status = COALESCE($3, status),
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [
        name === undefined ? null : name.trim(),
        description === undefined ? null : description.trim(),
        status ?? null,
        projectId
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: 'Project not found.'
      });
    }

    return res.json({
      message: 'Project updated successfully.',
      project: result.rows[0]
    });
  } catch (error) {
    return handleError(res, 'Could not update project.', error);
  }
});

// ==================== ASSIGN PROJECT MANAGER ====================
// PATCH /api/projects/:id/assign-manager

router.patch('/:id/assign-manager', async (req, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({
      message: 'Only Admins can assign project managers.'
    });
  }

  let client;

  try {
    const projectId = Number(req.params.id);
    const managerId = Number(req.body.project_manager_id);

    if (!isValidId(projectId)) {
      return res.status(400).json({
        message: 'Invalid project ID.'
      });
    }

    if (!isValidId(managerId)) {
      return res.status(400).json({
        message: 'A valid project manager is required.'
      });
    }

    const managerResult = await pool.query(
      `SELECT id, name, email, role
       FROM users
       WHERE id = $1
         AND is_active = TRUE`,
      [managerId]
    );

    if (
      managerResult.rows.length === 0 ||
      !isManager(managerResult.rows[0].role)
    ) {
      return res.status(400).json({
        message: 'Selected user is not an active project manager.'
      });
    }

    client = await pool.connect();
    await client.query('BEGIN');

    const projectResult = await client.query(
      `UPDATE projects
       SET owner_id = $1,
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [managerId, projectId]
    );

    if (projectResult.rows.length === 0) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        message: 'Project not found.'
      });
    }

    await client.query(
      `INSERT INTO project_members (
         project_id,
         user_id,
         project_role
       )
       VALUES ($1, $2, $3)
       ON CONFLICT (project_id, user_id)
       DO UPDATE SET project_role = EXCLUDED.project_role`,
      [projectId, managerId, 'Project Manager']
    );

    await client.query('COMMIT');

    return res.json({
      message: 'Project manager assigned successfully.',
      project: {
        ...projectResult.rows[0],
        project_manager_name: managerResult.rows[0].name,
        project_manager_email: managerResult.rows[0].email
      }
    });
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK').catch(() => {});
    }

    return handleError(
      res,
      'Could not assign project manager.',
      error
    );
  } finally {
    client?.release();
  }
});

// ==================== ADD PROJECT MEMBER ====================
// POST /api/projects/:id/members

router.post('/:id/members', async (req, res) => {
  try {
    const projectId = Number(req.params.id);
    const userId = Number(req.body.user_id);
    const projectRole = req.body.project_role || 'Team Member';

    const allowedRoles = [
      'Project Manager',
      'Team Member',
      'Viewer'
    ];

    if (!isValidId(projectId) || !isValidId(userId)) {
      return res.status(400).json({
        message: 'Valid project ID and user ID are required.'
      });
    }

    if (!allowedRoles.includes(projectRole)) {
      return res.status(400).json({
        message: 'Invalid project role.'
      });
    }

    const currentUserId = Number(req.user.id);

    const projectResult = await pool.query(
      `SELECT
         p.id,
         p.created_by,
         p.owner_id,
         pm.project_role AS current_project_role
       FROM projects p
       LEFT JOIN project_members pm
         ON pm.project_id = p.id
        AND pm.user_id = $2
       WHERE p.id = $1`,
      [projectId, currentUserId]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({
        message: 'Project not found.'
      });
    }

    if (!canManageProject(req, projectResult.rows[0])) {
      return res.status(403).json({
        message: 'You are not authorized to assign project members.'
      });
    }

    const userResult = await pool.query(
      `SELECT id, name, email, role
       FROM users
       WHERE id = $1
         AND is_active = TRUE`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        message: 'Active user not found.'
      });
    }

    const selectedUser = userResult.rows[0];

    if (normalizeRole(selectedUser.role) === 'admin') {
      return res.status(400).json({
        message: 'Administrators cannot be assigned as project members.'
      });
    }

    if (
      projectRole === 'Project Manager' &&
      !isManager(selectedUser.role)
    ) {
      return res.status(400).json({
        message: 'Only a Project Manager can have this project role.'
      });
    }

    const result = await pool.query(
      `INSERT INTO project_members (
         project_id,
         user_id,
         project_role
       )
       VALUES ($1, $2, $3)
       ON CONFLICT (project_id, user_id)
       DO NOTHING
       RETURNING project_id, user_id, project_role, joined_at`,
      [projectId, userId, projectRole]
    );

    if (result.rows.length === 0) {
      return res.status(409).json({
        message: 'This user is already assigned to the project.'
      });
    }

    return res.status(201).json({
      message: 'Team member assigned successfully.',
      member: {
        ...result.rows[0],
        name: selectedUser.name,
        email: selectedUser.email
      }
    });
  } catch (error) {
    return handleError(
      res,
      'Could not assign team member to project.',
      error
    );
  }
});

// ==================== GET PROJECT MEMBERS ====================
// GET /api/projects/:id/members

router.get('/:id/members', async (req, res) => {
  try {
    const projectId = Number(req.params.id);
    const userId = Number(req.user.id);
    const role = normalizeRole(req.user.role);

    if (!isValidId(projectId)) {
      return res.status(400).json({
        message: 'Invalid project ID.'
      });
    }

    const access = await pool.query(
      `SELECT p.id
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
      [projectId, userId, role]
    );

    if (access.rows.length === 0) {
      return res.status(404).json({
        message: 'Project not found or you do not have access.'
      });
    }

    const result = await pool.query(
      `SELECT
         u.id,
         u.name,
         u.email,
         pm.project_role,
         pm.joined_at
       FROM project_members pm
       JOIN users u ON u.id = pm.user_id
       WHERE pm.project_id = $1
       ORDER BY u.name ASC`,
      [projectId]
    );

    return res.json(result.rows);
  } catch (error) {
    return handleError(
      res,
      'Could not fetch project members.',
      error
    );
  }
});

// ==================== REMOVE PROJECT MEMBER ====================
// DELETE /api/projects/:id/members/:userId

router.delete('/:id/members/:userId', async (req, res) => {
  try {
    const projectId = Number(req.params.id);
    const memberId = Number(req.params.userId);

    if (!isValidId(projectId) || !isValidId(memberId)) {
      return res.status(400).json({
        message: 'Valid project ID and user ID are required.'
      });
    }

    const projectResult = await pool.query(
      `SELECT
         p.id,
         p.created_by,
         p.owner_id,
         pm.project_role AS current_project_role
       FROM projects p
       LEFT JOIN project_members pm
         ON pm.project_id = p.id
        AND pm.user_id = $2
       WHERE p.id = $1`,
      [projectId, Number(req.user.id)]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({
        message: 'Project not found.'
      });
    }

    if (!canManageProject(req, projectResult.rows[0])) {
      return res.status(403).json({
        message: 'You are not authorized to remove project members.'
      });
    }

    const project = projectResult.rows[0];

    if (Number(project.owner_id) === memberId) {
      return res.status(400).json({
        message: 'Reassign the project manager before removing them.'
      });
    }

    const result = await pool.query(
      `DELETE FROM project_members
       WHERE project_id = $1
         AND user_id = $2
       RETURNING project_id, user_id`,
      [projectId, memberId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: 'Project member not found.'
      });
    }

    return res.json({
      message: 'Project member removed successfully.'
    });
  } catch (error) {
    return handleError(
      res,
      'Could not remove project member.',
      error
    );
  }
});

// ==================== DELETE PROJECT ====================
// DELETE /api/projects/:id

router.delete('/:id', async (req, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({
      message: 'Only Admins can delete projects.'
    });
  }

  try {
    const projectId = Number(req.params.id);

    if (!isValidId(projectId)) {
      return res.status(400).json({
        message: 'Invalid project ID.'
      });
    }

    const result = await pool.query(
      `DELETE FROM projects
       WHERE id = $1
       RETURNING id`,
      [projectId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: 'Project not found.'
      });
    }

    return res.json({
      message: 'Project deleted successfully.'
    });
  } catch (error) {
    return handleError(
      res,
      'Could not delete project. It may have related tasks or records.',
      error
    );
  }
});

export default router;
