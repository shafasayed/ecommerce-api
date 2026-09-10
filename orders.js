const express = require('express');
const pool = require('./db');

const router = express.Router();

// Require an existing, logged-in account.
router.use(async (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Please log in first' });
  }

  try {
    const result = await pool.query(
      'SELECT id FROM users WHERE id = $1',
      [req.session.userId]
    );

    if (!result.rows.length) {
      return res.status(401).json({ error: 'Account no longer exists' });
    }

    next();
  } catch (error) {
    next(error);
  }
});

router.param('id', (req, res, next, value) => {
  const id = Number(value);

  if (!Number.isInteger(id) || id < 1 || id > 2147483647) {
    return res.status(400).json({ error: 'Invalid order ID' });
  }

  req.orderId = id;
  next();
});

// List only my orders.
router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, status, total, created_at
       FROM orders
       WHERE user_id = $1
       ORDER BY created_at DESC, id DESC`,
      [req.session.userId]
    );

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// View one of my orders, including its purchased items.
router.get('/:id', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT
         o.id,
         o.status,
         o.total,
         o.created_at,
         COALESCE(
           jsonb_agg(
             jsonb_build_object(
               'id', oi.id,
               'product_id', oi.product_id,
               'product_name', oi.product_name,
               'quantity', oi.quantity,
               'unit_price', oi.unit_price::text
             ) ORDER BY oi.id
           ) FILTER (WHERE oi.id IS NOT NULL),
           '[]'::jsonb
         ) AS items
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       WHERE o.id = $1 AND o.user_id = $2
       GROUP BY o.id`,
      [req.orderId, req.session.userId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Cancel a pending order and restore stock exactly once.
router.patch('/:id', async (req, res, next) => {
  const body = req.body;

  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body) ||
    body.status !== 'cancelled' ||
    Object.keys(body).some((key) => key !== 'status')
  ) {
    return res.status(400).json({
      error: 'Send only {"status":"cancelled"}'
    });
  }

  let client;

  try {
    client = await pool.connect();
    await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');

    const result = await client.query(
      `SELECT id, status
       FROM orders
       WHERE id = $1 AND user_id = $2
       FOR UPDATE`,
      [req.orderId, req.session.userId]
    );

    if (!result.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Order not found' });
    }

    if (result.rows[0].status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'Only pending orders can be cancelled'
      });
    }

    // Lock remaining products in a consistent order.
    // Deleted products have no stock record to restore.
    const products = await client.query(
      `SELECT p.id
       FROM products p
       WHERE p.id IN (
         SELECT product_id
         FROM order_items
         WHERE order_id = $1
       )
       ORDER BY p.id
       FOR UPDATE`,
      [req.orderId]
    );

    for (const product of products.rows) {
      await client.query(
        `UPDATE products
         SET stock = stock + (
           SELECT SUM(quantity)
           FROM order_items
           WHERE order_id = $1 AND product_id = $2
         )
         WHERE id = $2`,
        [req.orderId, product.id]
      );
    }

    const updated = await client.query(
      `UPDATE orders
       SET status = 'cancelled'
       WHERE id = $1
       RETURNING id, status, total, created_at`,
      [req.orderId]
    );

    await client.query('COMMIT');
    res.json(updated.rows[0]);
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK').catch(() => {});
    }

    if (error.code === '40001' || error.code === '40P01') {
      return res.status(409).json({
        error: 'The order or stock changed. Please try again'
      });
    }

    next(error);
  } finally {
    if (client) {
      client.release();
    }
  }
});

// Delete only my cancelled orders.
// The database also deletes their order_items.
router.delete('/:id', async (req, res, next) => {
  try {
    const result = await pool.query(
      `DELETE FROM orders
       WHERE id = $1
         AND user_id = $2
         AND status = 'cancelled'
       RETURNING id`,
      [req.orderId, req.session.userId]
    );

    if (result.rows.length) {
      return res.json({ message: 'Order deleted successfully' });
    }

    const existing = await pool.query(
      'SELECT id FROM orders WHERE id = $1 AND user_id = $2',
      [req.orderId, req.session.userId]
    );

    if (!existing.rows.length) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.status(409).json({
      error: 'Cancel the order before deleting it'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;