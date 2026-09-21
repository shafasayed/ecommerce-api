const express = require('express');
const pool = require('./db');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const router = express.Router();

// Creates the order from the user's cart inside a transaction:
// checks stock, creates the order and its items, reduces stock,
// and clears the cart. Used both by the direct checkout route
// and after a successful Stripe payment.
async function createOrderFromCart(userId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');

    const user = await client.query(
      'SELECT id FROM users WHERE id = $1',
      [userId]
    );

    if (!user.rows.length) {
      await client.query('ROLLBACK');
      return { error: 'Account no longer exists', status: 401 };
    }

    const cart = await client.query(
      'SELECT id FROM carts WHERE user_id = $1 FOR UPDATE',
      [userId]
    );

    if (!cart.rows.length) {
      await client.query('ROLLBACK');
      return { error: 'Create a cart first', status: 404 };
    }

    const cartId = cart.rows[0].id;

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
      return { error: 'Your cart is empty', status: 400 };
    }

    for (const item of items.rows) {
      if (item.quantity > item.stock) {
        await client.query('ROLLBACK');
        return {
          error: `Not enough stock for ${item.name}`,
          status: 409
        };
      }
    }

    const orderResult = await client.query(
      `INSERT INTO orders (user_id, status, total)
       VALUES ($1, 'pending', 0)
       RETURNING id`,
      [userId]
    );

    const orderId = orderResult.rows[0].id;

    for (const item of items.rows) {
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

    return { order: completedOrder.rows[0], status: 201 };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});

    if (error.code === '40001' || error.code === '40P01') {
      return {
        error: 'The cart or stock changed during checkout. Please try again',
        status: 409
      };
    }

    if (error.code === '22003') {
      return {
        error: 'Order total exceeds the supported limit',
        status: 400
      };
    }

    throw error;
  } finally {
    client.release();
  }
}

// Direct checkout, without a payment step (kept for API completeness).
router.post('/checkout', async (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Please log in first' });
  }

  try {
    const result = await createOrderFromCart(req.session.userId);

    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    res.status(201).json({
      message: 'Order placed successfully',
      order: result.order
    });
  } catch (error) {
    next(error);
  }
});

// Creates a Stripe Checkout session for the user's current cart.
router.post('/checkout/session', async (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Please log in first' });
  }

  try {
    const cart = await pool.query(
      'SELECT id FROM carts WHERE user_id = $1',
      [req.session.userId]
    );

    if (!cart.rows.length) {
      return res.status(404).json({ error: 'Create a cart first' });
    }

    const items = await pool.query(
      `SELECT p.name, p.price, ci.quantity
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
       WHERE ci.cart_id = $1`,
      [cart.rows[0].id]
    );

    if (!items.rows.length) {
      return res.status(400).json({ error: 'Your cart is empty' });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: items.rows.map((item) => ({
        quantity: item.quantity,
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(Number(item.price) * 100),
          product_data: { name: item.name }
        }
      })),
      success_url:
        'http://localhost:5173/checkout/success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'http://localhost:5173/cart',
      metadata: { userId: String(req.session.userId) }
    });

    res.json({ url: session.url });
  } catch (error) {
    next(error);
  }
});

// Confirms a Stripe payment succeeded, then places the order.
router.post('/checkout/confirm', async (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Please log in first' });
  }

  const { session_id } = req.body || {};

  if (typeof session_id !== 'string' || session_id.length === 0) {
    return res.status(400).json({ error: 'session_id is required' });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.metadata.userId !== String(req.session.userId)) {
      return res.status(403).json({ error: 'This session does not belong to you' });
    }

    if (session.payment_status !== 'paid') {
      return res.status(402).json({ error: 'Payment not completed' });
    }

    const result = await createOrderFromCart(req.session.userId);

    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    res.status(201).json({
      message: 'Payment confirmed, order placed successfully',
      order: result.order
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
