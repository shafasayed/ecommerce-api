const express = require('express');
const pool = require('./db');

const router = express.Router();

router.post('/checkout', async (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Please log in first' });
  }

  let client;

  try {
    client = await pool.connect();

    // Prevent conflicting requests from producing inconsistent orders.
    await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');

    const user = await client.query(
      'SELECT id FROM users WHERE id = $1',
      [req.session.userId]
    );

    if (!user.rows.length) {
      await client.query('ROLLBACK');
      return res.status(401).json({ error: 'Account no longer exists' });
    }

    const cart = await client.query(
      'SELECT id FROM carts WHERE user_id = $1 FOR UPDATE',
      [req.session.userId]
    );

    if (!cart.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Create a cart first' });
    }

    const cartId = cart.rows[0].id;

    // Lock the items and products while checking out.
    const items = await client.query(
      `SELECT ci.id, ci.product_id, ci.quantity,
              p.name, p.price, p.stock
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
       WHERE ci.cart_id = $1
       ORDER BY p.id
       FOR UPDATE OF ci, p`,
      [cartId]
    );

    if (!items.rows.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Your cart is empty' });
    }

    for (const item of items.rows) {
      if (item.quantity > item.stock) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: `Not enough stock for ${item.name}`,
          available: item.stock
        });
      }
    }

    const orderResult = await client.query(
      `INSERT INTO orders (user_id, status, total)
       VALUES ($1, 'pending', 0)
       RETURNING id`,
      [req.session.userId]
    );

    const orderId = orderResult.rows[0].id;

    for (const item of items.rows) {
      // Preserve the product name and price at purchase time.
      await client.query(
        `INSERT INTO order_items
           (order_id, product_id, product_name, quantity, unit_price)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          orderId,
          item.product_id,
          item.name,
          item.quantity,
          item.price
        ]
      );

      await client.query(
        'UPDATE products SET stock = stock - $1 WHERE id = $2',
        [item.quantity, item.product_id]
      );
    }

    // Calculate money using PostgreSQL's exact decimal arithmetic.
    const completedOrder = await client.query(
      `UPDATE orders
       SET total = (
         SELECT SUM(quantity * unit_price)
         FROM order_items
         WHERE order_id = $1
       )
       WHERE id = $1
       RETURNING id, user_id, status, total, created_at`,
      [orderId]
    );

    await client.query(
      'DELETE FROM cart_items WHERE cart_id = $1',
      [cartId]
    );

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Order placed successfully',
      order: completedOrder.rows[0]
    });
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK').catch(() => {});
    }

    if (error.code === '40001' || error.code === '40P01') {
      return res.status(409).json({
        error: 'The cart or stock changed during checkout. Please try again'
      });
    }

    if (error.code === '22003') {
      return res.status(400).json({
        error: 'Order total exceeds the supported limit'
      });
    }

    next(error);
  } finally {
    if (client) {
      client.release();
    }
  }
});

module.exports = router;