
import express from 'express';
import { pool } from '../db.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(authMiddleware);

function normalizeRole(role = '') {
  return String(role).trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function canManageTasks(role) {
  return ['admin', 'project_manager'].includes(normalizeRole(role));
}

function validId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0;
}

function getBodyValue(body, snakeCase, camelCase) {
  if (body[snakeCase] !== undefined) return body[snakeCase];
  if (camelCase && body[camelCase] !== undefined) return body[camelCase];
  return undefined;
}

async function canAccessProject(projectId, userId, role) {
  const result = await pool.query(
    `SELECT p.id
     FROM projects p
     LEFT JOIN project_members pm
       ON pm.project_id = p.id AND pm.user_id = $2
     WHERE p.id = $1
       AND (
         $3 = 'admin'
         OR p.created_by = $2
         OR p.owner_id = $2
         OR pm.user_id = $2
       )
     LIMIT 1`,
    [projectId, userId, normalizeRole(role)]
  );

  return result.rows.length > 0;
}

async function isProjectAssignee(projectId, assigneeId) {
  const result = await pool.query(
    `SELECT 1
     FROM projects p
     WHERE p.id = $1 AND p.owner_id = $2
     UNION
     SELECT 1
     FROM project_members pm
     WHERE pm.project_id = $1 AND pm.user_id = $2
     LIMIT 1`,
    [projectId, assigneeId]
  );

  return result.rows.length > 0;
}

// GET /api/tasks
router.get('/', async (req, res) => {
  try {
    const userId = Number(req.user.id);
    const role = normalizeRole(req.user.role);
    const projectId = req.query.projectId ?? req.query.project_id;

    if (projectId !== undefined && !validId(projectId)) {
      return res.status(400).json({ message: 'Invalid project ID.' });
    }

    const values = [userId, role];
    let projectFilter = '';

    if (projectId !== undefined) {
      values.push(Number(projectId));
      projectFilter = `AND t.project_id = $${values.length}`;
    }

    const result = await pool.query(
      `SELECT DISTINCT t.*
       FROM tasks t
       JOIN projects p ON p.id = t.project_id
       LEFT JOIN project_members pm
         ON pm.project_id = p.id AND pm.user_id = $1
       WHERE (
         $2 = 'admin'
         OR p.created_by = $1
         OR p.owner_id = $1
         OR pm.user_id = $1
         OR t.assignee_id = $1
       )
       ${projectFilter}
       ORDER BY t.id DESC`,
      values
    );

    return res.json(result.rows);
  } catch (error) {
    console.error('Fetch tasks error:', error);
    return res.status(500).json({
      message: 'Could not fetch tasks.',
      error: error.message
    });
  }
});

// POST /api/tasks
router.post('/', async (req, res) => {
  if (!canManageTasks(req.user.role)) {
    return res.status(403).json({
      message: 'Only Admins and Project Managers can create tasks.'
    });
  }

  try {
    const projectValue = getBodyValue(req.body, 'project_id', 'projectId');
    const titleValue = req.body.title;
    const descriptionValue = req.body.description ?? '';
    const assigneeValue = getBodyValue(req.body, 'assignee_id', 'assigneeId');
    const dueDateValue = getBodyValue(req.body, 'due_date', 'dueDate');
    const priorityValue = req.body.priority ?? 'Medium';
    const statusValue = req.body.status ?? 'To Do';

    if (!validId(projectValue)) {
      return res.status(400).json({
        message: 'A valid project_id is required.'
      });
    }

    const projectId = Number(projectValue);

    if (typeof titleValue !== 'string' || !titleValue.trim()) {
      return res.status(400).json({
        message: 'A non-empty task title is required.'
      });
    }

    if (typeof descriptionValue !== 'string') {
      return res.status(400).json({
        message: 'Description must be text.'
      });
    }

    if (!['Low', 'Medium', 'High'].includes(priorityValue)) {
      return res.status(400).json({
        message: 'Priority must be Low, Medium, or High.'
      });
    }

    if (!['To Do', 'In Progress', 'Done'].includes(statusValue)) {
      return res.status(400).json({
        message: 'Status must be To Do, In Progress, or Done.'
      });
    }

    const dueDate = dueDateValue || null;

    if (
      dueDate !== null &&
      (typeof dueDate !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(dueDate) ||
        Number.isNaN(Date.parse(`${dueDate}T00:00:00Z`)))
    ) {
      return res.status(400).json({
        message: 'Due date must use YYYY-MM-DD format.'
      });
    }

    const hasAccess = await canAccessProject(
      projectId,
      Number(req.user.id),
      req.user.role
    );

    if (!hasAccess) {
      return res.status(403).json({
        message: 'You cannot create tasks in this project.'
      });
    }

    let assigneeId = null;

    if (assigneeValue !== undefined && assigneeValue !== null && assigneeValue !== '') {
      if (!validId(assigneeValue)) {
        return res.status(400).json({
          message: 'Invalid assignee ID.'
        });
      }

      assigneeId = Number(assigneeValue);

      const member = await isProjectAssignee(projectId, assigneeId);

      if (!member) {
        return res.status(400).json({
          message: 'The assignee must be a member or owner of this project.'
        });
      }
    }

    const result = await pool.query(
      `INSERT INTO tasks
        (project_id, title, description, status, priority,
         assignee_id, created_by, due_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        projectId,
        titleValue.trim(),
        descriptionValue.trim(),
        statusValue,
        priorityValue,
        assigneeId,
        Number(req.user.id),
        dueDate
      ]
    );

    return res.status(201).json({
      message: 'Task created successfully.',
      task: result.rows[0]
    });
  } catch (error) {
    console.error('Create task error:', error);

    return res.status(500).json({
      message: 'Could not create task.',
      error: error.message
    });
  }
});

// Shared handler for PUT and PATCH /api/tasks/:id
async function updateTask(req, res) {
  const role = normalizeRole(req.user.role);

  if (!['admin', 'project_manager', 'team_member'].includes(role)) {
    return res.status(403).json({
      message: 'You cannot update tasks.'
    });
  }

  try {
    const taskId = Number(req.params.id);

    if (!validId(taskId)) {
      return res.status(400).json({ message: 'Invalid task ID.' });
    }

    const {
      title,
      description,
      status,
      priority
    } = req.body;

    const assigneeValue = getBodyValue(req.body, 'assignee_id', 'assigneeId');
    const dueDateValue = getBodyValue(req.body, 'due_date', 'dueDate');

    if (title !== undefined && (typeof title !== 'string' || !title.trim())) {
      return res.status(400).json({
        message: 'Task title cannot be empty.'
      });
    }

    if (description !== undefined && typeof description !== 'string') {
      return res.status(400).json({
        message: 'Description must be text.'
      });
    }

    if (
      status !== undefined &&
      !['To Do', 'In Progress', 'Done'].includes(status)
    ) {
      return res.status(400).json({
        message: 'Status must be To Do, In Progress, or Done.'
      });
    }

    if (
      priority !== undefined &&
      !['Low', 'Medium', 'High'].includes(priority)
    ) {
      return res.status(400).json({
        message: 'Priority must be Low, Medium, or High.'
      });
    }

    const dueDate = dueDateValue === '' ? null : dueDateValue;

    if (
      dueDate !== undefined &&
      dueDate !== null &&
      (typeof dueDate !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(dueDate) ||
        Number.isNaN(Date.parse(`${dueDate}T00:00:00Z`)))
    ) {
      return res.status(400).json({
        message: 'Due date must use YYYY-MM-DD format.'
      });
    }

    const access = await pool.query(
      `SELECT t.id, t.project_id, t.assignee_id
       FROM tasks t
       JOIN projects p ON p.id = t.project_id
       LEFT JOIN project_members pm
         ON pm.project_id = p.id AND pm.user_id = $2
       WHERE t.id = $1
         AND (
           $3 = 'admin'
           OR p.created_by = $2
           OR p.owner_id = $2
           OR pm.user_id = $2
           OR t.assignee_id = $2
         )
       LIMIT 1`,
      [taskId, Number(req.user.id), role]
    );

    if (!access.rows.length) {
      return res.status(404).json({
        message: 'Task not found or you do not have access.'
      });
    }

    const task = access.rows[0];

    if (role === 'team_member' && Number(task.assignee_id) !== Number(req.user.id)) {
      return res.status(403).json({
        message: 'Team Members can only update their assigned tasks.'
      });
    }

    let assigneeId = task.assignee_id;
    const assigneeWasProvided =
      assigneeValue !== undefined;

    if (assigneeWasProvided) {
      if (assigneeValue === null || assigneeValue === '') {
        assigneeId = null;
      } else {
        if (!validId(assigneeValue)) {
          return res.status(400).json({
            message: 'Invalid assignee ID.'
          });
        }

        assigneeId = Number(assigneeValue);

        if (!(await isProjectAssignee(Number(task.project_id), assigneeId))) {
          return res.status(400).json({
            message: 'The assignee must be a member or owner of this project.'
          });
        }
      }
    }

    if (assigneeWasProvided && !canManageTasks(role)) {
      return res.status(403).json({
        message: 'Only Admins and Project Managers can assign tasks.'
      });
    }

    const result = await pool.query(
      `UPDATE tasks
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           status = COALESCE($3, status),
           assignee_id = CASE WHEN $4 THEN $5 ELSE assignee_id END,
           due_date = CASE WHEN $6 THEN $7::date ELSE due_date END,
           priority = COALESCE($8, priority),
           version = COALESCE(version, 0) + 1,
           updated_at = NOW()
       WHERE id = $9
       RETURNING *`,
      [
        title === undefined ? null : title.trim(),
        description === undefined ? null : description.trim(),
        status ?? null,
        assigneeWasProvided,
        assigneeId,
        dueDateValue !== undefined,
        dueDate ?? null,
        priority ?? null,
        taskId
      ]
    );

    return res.json({
      message: 'Task updated successfully.',
      task: result.rows[0]
    });
  } catch (error) {
    console.error('Update task error:', error);

    return res.status(500).json({
      message: 'Could not update task.',
      error: error.message
    });
  }
}

router.patch('/:id', updateTask);
router.put('/:id', updateTask);

// DELETE /api/tasks/:id
router.delete('/:id', async (req, res) => {
  if (!canManageTasks(req.user.role)) {
    return res.status(403).json({
      message: 'Only Admins and Project Managers can delete tasks.'
    });
  }

  try {
    const taskId = Number(req.params.id);

    if (!validId(taskId)) {
      return res.status(400).json({ message: 'Invalid task ID.' });
    }

    const result = await pool.query(
      `DELETE FROM tasks t
       USING projects p
       WHERE t.id = $1
         AND p.id = t.project_id
         AND (
           $2 = 'admin'
           OR p.created_by = $3
           OR p.owner_id = $3
         )
       RETURNING t.id`,
      [taskId, normalizeRole(req.user.role), Number(req.user.id)]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        message: 'Task not found or you cannot delete it.'
      });
    }

    return res.json({ message: 'Task deleted successfully.' });
  } catch (error) {
    console.error('Delete task error:', error);

    return res.status(500).json({
      message: 'Could not delete task.',
      error: error.message
    });
  }
});

export default router;
