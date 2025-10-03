const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authMiddleware } = require('../middleware/auth');

// Get all subtasks for a task
router.get('/task/:taskId', authMiddleware, async (req, res) => {
  const { taskId } = req.params;
  try {
    const result = await pool.query(
      `SELECT s.* FROM subtasks s
       JOIN tasks t ON s.task_id = t.id
       JOIN list_memberships lm ON t.list_id = lm.list_id
       WHERE s.task_id=$1 AND lm.user_id=$2`,
      [taskId, req.user.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// Create subtask
router.post('/', authMiddleware, async (req, res) => {
  const { taskId, title, description, status, position } = req.body;
  try {
    const check = await pool.query(
      `SELECT lm.role FROM tasks t
       JOIN list_memberships lm ON t.list_id = lm.list_id
       WHERE t.id=$1 AND lm.user_id=$2`,
      [taskId, req.user.userId]
    );
    if (check.rows.length === 0 || !['owner','editor'].includes(check.rows[0].role))
      return res.status(403).json({ message: 'Insufficient permissions' });

    const result = await pool.query(
      `INSERT INTO subtasks (task_id, title, description, status, position)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [taskId, title, description, status || 'pending', position || 0]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// Update subtask
router.put('/:subtaskId', authMiddleware, async (req, res) => {
  const { subtaskId } = req.params;
  const { title, description, status, position } = req.body;
  try {
    const check = await pool.query(
      `SELECT lm.role FROM subtasks s
       JOIN tasks t ON s.task_id = t.id
       JOIN list_memberships lm ON t.list_id = lm.list_id
       WHERE s.id=$1 AND lm.user_id=$2`,
      [subtaskId, req.user.userId]
    );
    if (check.rows.length === 0 || !['owner','editor'].includes(check.rows[0].role))
      return res.status(403).json({ message: 'Insufficient permissions' });

    const result = await pool.query(
      `UPDATE subtasks SET title=$1, description=$2, status=$3, position=$4, updated_at=NOW()
       WHERE id=$5 RETURNING *`,
      [title, description, status, position, subtaskId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// Delete subtask
router.delete('/:subtaskId', authMiddleware, async (req, res) => {
  const { subtaskId } = req.params;
  try {
    const check = await pool.query(
      `SELECT lm.role FROM subtasks s
       JOIN tasks t ON s.task_id = t.id
       JOIN list_memberships lm ON t.list_id = lm.list_id
       WHERE s.id=$1 AND lm.user_id=$2`,
      [subtaskId, req.user.userId]
    );
    if (check.rows.length === 0 || check.rows[0].role !== 'owner')
      return res.status(403).json({ message: 'Only owner can delete subtask' });

    await pool.query('DELETE FROM subtasks WHERE id=$1', [subtaskId]);
    res.json({ message: 'Subtask deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

module.exports = router;
