const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authMiddleware, requireRole } = require('../middleware/auth');

// Get all tags for a list
router.get('/list/:listId', authMiddleware, requireRole(['owner','editor','viewer']), async (req, res) => {
  const { listId } = req.params;
  try {
    const result = await pool.query('SELECT * FROM tags WHERE list_id=$1', [listId]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// Create tag
router.post('/', authMiddleware, requireRole(['owner','editor']), async (req, res) => {
  const { listId, name, color } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO tags (list_id, name, color) VALUES ($1,$2,$3) RETURNING *',
      [listId, name, color]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    if (err.code === '23505') return res.status(400).json({ message: 'Tag name already exists in this list' });
    res.status(500).send('Server error');
  }
});

// Update tag
router.put('/:tagId', authMiddleware, async (req, res) => {
  const { tagId } = req.params;
  const { name, color } = req.body;
  try {
    const check = await pool.query(
      `SELECT lm.role FROM tags tg
       JOIN lists l ON tg.list_id = l.id
       JOIN list_memberships lm ON l.id = lm.list_id
       WHERE tg.id=$1 AND lm.user_id=$2`,
      [tagId, req.user.userId]
    );
    if (check.rows.length === 0 || !['owner','editor'].includes(check.rows[0].role))
      return res.status(403).json({ message: 'Insufficient permissions' });

    const result = await pool.query(
      'UPDATE tags SET name=$1, color=$2 WHERE id=$3 RETURNING *',
      [name, color, tagId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// Delete tag
router.delete('/:tagId', authMiddleware, async (req, res) => {
  const { tagId } = req.params;
  try {
    const check = await pool.query(
      `SELECT lm.role FROM tags tg
       JOIN lists l ON tg.list_id = l.id
       JOIN list_memberships lm ON l.id = lm.list_id
       WHERE tg.id=$1 AND lm.user_id=$2`,
      [tagId, req.user.userId]
    );
    if (check.rows.length === 0 || check.rows[0].role !== 'owner')
      return res.status(403).json({ message: 'Only owner can delete tag' });

    await pool.query('DELETE FROM tags WHERE id=$1', [tagId]);
    res.json({ message: 'Tag deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

module.exports = router;
