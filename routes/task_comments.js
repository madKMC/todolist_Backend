const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authMiddleware } = require('../middleware/auth');

// Get all comments for a task
router.get('/task/:taskId', authMiddleware, async (req, res) => {
  const { taskId } = req.params;
  try {
    const result = await pool.query(
      `SELECT tc.*, u.name AS user_name
       FROM task_comments tc
       JOIN users u ON tc.user_id = u.id
       JOIN tasks t ON tc.task_id = t.id
       JOIN list_memberships lm ON t.list_id = lm.list_id
       WHERE tc.task_id=$1 AND lm.user_id=$2`,
      [taskId, req.user.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// Add a comment
router.post('/', authMiddleware, async (req, res) => {
  const { taskId, comment } = req.body;
  try {
    const check = await pool.query(
      `SELECT lm.role FROM tasks t
       JOIN list_memberships lm ON t.list_id = lm.list_id
       WHERE t.id=$1 AND lm.user_id=$2`,
      [taskId, req.user.userId]
    );
    if (check.rows.length === 0) return res.status(403).json({ message: 'No access to task' });

    const result = await pool.query(
      `INSERT INTO task_comments (task_id, user_id, comment)
       VALUES ($1,$2,$3) RETURNING *`,
      [taskId, req.user.userId, comment]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

module.exports = router;
