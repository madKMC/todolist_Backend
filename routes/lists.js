const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authMiddleware, requireRole } = require('../middleware/auth');

// Get all lists for user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT l.* FROM lists l
       JOIN list_memberships lm ON lm.list_id = l.id
       WHERE lm.user_id = $1`,
      [req.user.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// Get a specific list (requires membership)
router.get('/:listId', authMiddleware, requireRole(['owner', 'editor', 'viewer']), async (req, res) => {
  const { listId } = req.params;
  try {
    const result = await pool.query('SELECT * FROM lists WHERE id = $1', [listId]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'List not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// Update a list (requires owner/editor)
router.put('/:listId', authMiddleware, requireRole(['owner', 'editor']), async (req, res) => {
  const { listId } = req.params;
  const { name, description, is_archived } = req.body;
  try {
    const result = await pool.query(
      `UPDATE lists
       SET name = $1,
           description = $2,
           is_archived = $3,
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [name, description, is_archived, listId]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'List not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// Delete a list (requires owner)
router.delete('/:listId', authMiddleware, requireRole(['owner']), async (req, res) => {
  const { listId } = req.params;
  try {
    await pool.query('DELETE FROM lists WHERE id = $1', [listId]);
    res.json({ message: 'List deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

module.exports = router;
