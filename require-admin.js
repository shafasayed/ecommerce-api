const pool = require('./db');

async function requireAdmin(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({
      error: 'Please log in first'
    });
  }

  try {
    const result = await pool.query(
      'SELECT role FROM users WHERE id = $1',
      [req.session.userId]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({
        error: 'Account no longer exists. Please log in again'
      });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({
        error: 'Admin access required'
      });
    }

    next();
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: 'Unable to verify admin access'
    });
  }
}

module.exports = requireAdmin;