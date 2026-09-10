const express = require('express');
const pool = require('./db');

const router = express.Router();

// Check that the logged-in account still exists.
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

function validInteger(value) {
  return Number.isInteger(value) && value > 0 && value <= 2147483647;
}

// Create my cart.
router.post('/', async (req, res, next) => {
  try {
    const result = await pool.query(
      `INSERT INTO carts (user_id)
       VALUES ($1)
       ON CONFLICT (user_id) DO NOTHING
       RETURNING id, user_id`,
      [req.session.userId]
    );

    if (!result.rows.length) {
      return res.status(409).json({ error: 'You already have a cart' });
    }

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// View my cart and its items.
router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT
         c.id,
         COALESCE(
           jsonb_agg(
             jsonb_build_object(
               'id', ci.id,
               'product_id', p.id,
               'name', p.name,
               'quantity', ci.quantity,
               'unit_price', p.price::text,
               'subtotal', (p.price * ci.quantity)::text
             ) ORDER BY ci.id
           ) FILTER (WHERE ci.id IS NOT NULL),
           '[]'::jsonb
         ) AS items,
         COALESCE(SUM(p.price * ci.quantity), 0)::text AS total
       FROM carts c
       LEFT JOIN cart_items ci ON ci.cart_id = c.id
       LEFT JOIN products p ON p.id = ci.product_id
       WHERE c.user_id = $1
       GROUP BY c.id`,
      [req.session.userId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Create a cart first' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Add a product, or increase its quantity if already in the cart.
router.post('/items', async (req, res, next) => {
  const { product_id, quantity = 1 } = req.body || {};

  if (!validInteger(product_id) || !validInteger(quantity)) {
    return res.status(400).json({
      error: 'Product ID and quantity must be positive integers'
    });
  }

  try {
    const cart = await pool.query(
      'SELECT id FROM carts WHERE user_id = $1',
      [req.session.userId]
    );

    if (!cart.rows.length) {
      return res.status(404).json({ error: 'Create a cart first' });
    }

    const result = await pool.query(
      `INSERT INTO cart_items (cart_id, product_id, quantity)
       SELECT $1, id, $3
       FROM products
       WHERE id = $2
       ON CONFLICT (cart_id, product_id)
       DO UPDATE
       SET quantity = cart_items.quantity + EXCLUDED.quantity
       RETURNING id, cart_id, product_id, quantity`,
      [cart.rows[0].id, product_id, quantity]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Change an item's quantity.
// :id is the cart item's ID, not the product ID.
router.patch('/items/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  const { quantity } = req.body || {};

  if (!validInteger(id) || !validInteger(quantity)) {
    return res.status(400).json({
      error: 'Item ID and quantity must be positive integers'
    });
  }

  try {
    const result = await pool.query(
      `UPDATE cart_items ci
       SET quantity = $1
       FROM carts c
       WHERE ci.cart_id = c.id
         AND c.user_id = $2
         AND ci.id = $3
       RETURNING ci.id, ci.product_id, ci.quantity`,
      [quantity, req.session.userId, id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Cart item not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Remove one item from my cart.
router.delete('/items/:id', async (req, res, next) => {
  const id = Number(req.params.id);

  if (!validInteger(id)) {
    return res.status(400).json({ error: 'Invalid cart item ID' });
  }

  try {
    const result = await pool.query(
      `DELETE FROM cart_items ci
       USING carts c
       WHERE ci.cart_id = c.id
         AND c.user_id = $1
         AND ci.id = $2
       RETURNING ci.id`,
      [req.session.userId, id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Cart item not found' });
    }

    res.json({ message: 'Item removed' });
  } catch (error) {
    next(error);
  }
});

// Delete my cart. Its items are deleted by the database cascade.
router.delete('/', async (req, res, next) => {
  try {
    const result = await pool.query(
      'DELETE FROM carts WHERE user_id = $1 RETURNING id',
      [req.session.userId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Cart not found' });
    }

    res.json({ message: 'Cart deleted' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;