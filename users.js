const express = require('express');
const pool = require('./db');

const router = express.Router();

// Require login for every route in this file.
router.use((req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({
      error: 'Please log in first'
    });
  }

  next();
});

// GET /users/me — View my account.
router.get('/me', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email FROM users WHERE id = $1',
      [req.session.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: 'Account no longer exists. Please log in again'
      });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: 'Unable to fetch account'
    });
  }
});

// PATCH /users/me — Update my name, email, or both.
router.patch('/me', async (req, res) => {
  const { name, email } = req.body || {};

  if (name === undefined && email === undefined) {
    return res.status(400).json({
      error: 'Provide a name or email to update'
    });
  }

  let cleanName = null;
  let cleanEmail = null;

  if (name !== undefined) {
    if (
      typeof name !== 'string' ||
      name.trim().length === 0 ||
      name.trim().length > 100
    ) {
      return res.status(400).json({
        error: 'Name must contain 1–100 characters'
      });
    }

    cleanName = name.trim();
  }

  if (email !== undefined) {
    if (
      typeof email !== 'string' ||
      email.trim().length > 255 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ) {
      return res.status(400).json({
        error: 'Enter a valid email'
      });
    }

    cleanEmail = email.trim().toLowerCase();
  }

  try {
    const result = await pool.query(
      `UPDATE users
       SET name = COALESCE($1, name),
           email = COALESCE($2, email)
       WHERE id = $3
       RETURNING id, name, email`,
      [cleanName, cleanEmail, req.session.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: 'Account no longer exists. Please log in again'
      });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({
        error: 'An account with that email already exists'
      });
    }

    console.error(error);
    res.status(500).json({
      error: 'Unable to update account'
    });
  }
});

// DELETE /users/me — Delete my account.
router.delete('/me', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM users WHERE id = $1 RETURNING id',
      [req.session.userId]
    );

    const accountExisted = result.rows.length > 0;

    req.session.destroy((error) => {
      if (error) {
        console.error(error);
        return res.status(500).json({
          error: 'Account removed, but unable to close the session'
        });
      }

      res.clearCookie('connect.sid', {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: false
      });

      if (!accountExisted) {
        return res.status(404).json({
          error: 'Account not found'
        });
      }

      res.json({
        message: 'Account deleted successfully'
      });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: 'Unable to delete account'
    });
  }
});

module.exports = router;