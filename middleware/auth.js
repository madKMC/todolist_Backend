const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

router.use(cookieParser());

// Helper: generate tokens
function generateAccessToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '15m' });
}

function generateRefreshToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, { expiresIn: '30d' });
}

// Send tokens (cookie in production, JSON in dev)
function sendTokens(res, accessToken, refreshToken) {
  if (process.env.NODE_ENV === 'production') {
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });
    return res.json({ accessToken });
  } else {
    return res.json({ accessToken, refreshToken });
  }
}

// Basic auth middleware: verify JWT
function authMiddleware(req, res, next) {
  const token = req.header('Authorization')?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { userId }
    next();
  } catch (err) {
    return res.status(403).json({ message: 'Invalid token' });
  }
}

// Role check for list access
function requireRole(requiredRoles) {
  return async (req, res, next) => {
    const listId = req.params.listId || req.body.listId;
    if (!listId) return res.status(400).json({ message: 'List ID required' });

    try {
      const result = await pool.query(
        'SELECT role FROM list_memberships WHERE list_id = $1 AND user_id = $2',
        [listId, req.user.userId]
      );
      if (result.rows.length === 0) {
        return res.status(403).json({ message: 'Not a member of this list' });
      }

      const userRole = result.rows[0].role;
      if (!requiredRoles.includes(userRole)) {
        return res.status(403).json({ message: 'Insufficient permissions' });
      }

      req.user.role = userRole;
      next();
    } catch (err) {
      console.error(err);
      res.status(500).send('Server error');
    }
  };
}

// REGISTER
router.post('/register', async (req, res) => {
  const { email, password, name } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING *',
      [email, hashedPassword, name]
    );

    const user = result.rows[0];
    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    // Save refresh token in DB
    await pool.query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, NOW() + interval \'30 days\')',
      [user.id, refreshToken]
    );

    sendTokens(res, accessToken, refreshToken);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// LOGIN
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    // Store refresh token in DB
    await pool.query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, NOW() + interval \'30 days\')',
      [user.id, refreshToken]
    );

    sendTokens(res, accessToken, refreshToken);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// REFRESH TOKEN
router.post('/refresh', async (req, res) => {
  const token =
    process.env.NODE_ENV === 'production'
      ? req.cookies.refreshToken
      : req.body.token;

  if (!token) return res.status(401).json({ message: 'No refresh token' });

  try {
    const dbToken = await pool.query(
      'SELECT * FROM refresh_tokens WHERE token = $1 AND expires_at > NOW()',
      [token]
    );
    if (dbToken.rows.length === 0) {
      return res.status(403).json({ message: 'Invalid refresh token' });
    }

    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const accessToken = generateAccessToken(decoded.userId);

    sendTokens(res, accessToken, token); // reuse refresh token
  } catch (err) {
    console.error(err);
    res.status(403).json({ message: 'Invalid token' });
  }
});

// LOGOUT
router.post('/logout', async (req, res) => {
  const token =
    process.env.NODE_ENV === 'production'
      ? req.cookies.refreshToken
      : req.body.token;

  try {
    await pool.query('DELETE FROM refresh_tokens WHERE token = $1', [token]);
    if (process.env.NODE_ENV === 'production') {
      res.clearCookie('refreshToken', { httpOnly: true, secure: true, sameSite: 'strict' });
    }
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

module.exports = { router, authMiddleware, requireRole };
