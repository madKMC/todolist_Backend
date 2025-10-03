const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authMiddleware } = require('../middleware/auth');

// Get all tasks for a list
router.get('/list/:listId', authMiddleware, async (req, res) => {
  const { listId } = req.params;
  try {
    const result = await pool.query(
      'SELECT * FROM tasks WHERE list_id = $1 AND is_archived = FALSE',
      [listId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// Create a task (requires owner/editor)
router.post('/', authMiddleware, async (req, res) => {
  const { listId, title, description, priority, status, due_date, recurring_rule } = req.body;
  try {
    const check = await pool.query(
      'SELECT role FROM list_memberships WHERE list_id=$1 AND user_id=$2',
      [listId, req.user.userId]
    );
    if (check.rows.length === 0 || !['owner','editor'].includes(check.rows[0].role))
      return res.status(403).json({ message: 'Insufficient permissions' });

    const result = await pool.query(
      `INSERT INTO tasks (list_id, title, description, priority, status, due_date, recurring_rule)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [listId, title, description, priority || 3, status || 'pending', due_date, recurring_rule]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// Get a single task
router.get('/:taskId', authMiddleware, async (req, res) => {
  const { taskId } = req.params;
  try {
    const result = await pool.query(
      `SELECT t.* 
       FROM tasks t 
       JOIN list_memberships lm ON t.list_id = lm.list_id
       WHERE t.id = $1 AND lm.user_id = $2`,
      [taskId, req.user.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Task not found or no access' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// Update task (requires owner/editor)
router.put('/:taskId', authMiddleware, async (req, res) => {
  const { taskId } = req.params;
  const { title, description, priority, status, due_date, recurring_rule, is_archived } = req.body;
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
      `UPDATE tasks SET title=$1, description=$2, priority=$3, status=$4, due_date=$5, recurring_rule=$6, is_archived=$7, updated_at=NOW()
       WHERE id=$8 RETURNING *`,
      [title, description, priority, status, due_date, recurring_rule, is_archived, taskId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// Delete task (requires owner)
router.delete('/:taskId', authMiddleware, async (req, res) => {
  const { taskId } = req.params;
  try {
    const check = await pool.query(
      `SELECT lm.role FROM tasks t
       JOIN list_memberships lm ON t.list_id = lm.list_id
       WHERE t.id=$1 AND lm.user_id=$2`,
      [taskId, req.user.userId]
    );
    if (check.rows.length === 0 || check.rows[0].role !== 'owner')
      return res.status(403).json({ message: 'Only owner can delete task' });

    await pool.query('DELETE FROM tasks WHERE id=$1', [taskId]);
    res.json({ message: 'Task deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

module.exports = router;
