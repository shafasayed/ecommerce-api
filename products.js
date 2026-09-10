const express = require('express');
const pool = require('./db');
const requireAdmin = require('./require-admin');

const router = express.Router();

// Validate product IDs for routes containing :id.
router.param('id', (req, res, next, value) => {
  const id = Number(value);

  if (!Number.isInteger(id) || id < 1 || id > 2147483647) {
    return res.status(400).json({
      error: 'Product ID must be a positive integer'
    });
  }

  req.productId = id;
  next();
});

// Validate product details for creation and updates.
function validateProduct(data, partial = false) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return 'Send a JSON object containing product details';
  }

  const fields = ['name', 'description', 'price', 'stock'];

  if (Object.keys(data).some((key) => !fields.includes(key))) {
    return 'Only name, description, price, and stock are allowed';
  }

  if (partial && Object.keys(data).length === 0) {
    return 'Provide at least one field to update';
  }

  if (!partial || data.name !== undefined) {
    if (
      typeof data.name !== 'string' ||
      data.name.trim().length === 0 ||
      data.name.trim().length > 150
    ) {
      return 'Product name must contain 1–150 characters';
    }
  }

  if (
    data.description !== undefined &&
    typeof data.description !== 'string'
  ) {
    return 'Description must be text';
  }

  if (!partial || data.price !== undefined) {
    if (
      !['string', 'number'].includes(typeof data.price) ||
      !/^\d{1,8}(\.\d{1,2})?$/.test(String(data.price))
    ) {
      return 'Price must be between 0 and 99999999.99 with at most 2 decimal places';
    }
  }

  if (data.stock !== undefined) {
    if (
      !Number.isInteger(data.stock) ||
      data.stock < 0 ||
      data.stock > 2147483647
    ) {
      return 'Stock must be a whole number between 0 and 2147483647';
    }
  }

  return null;
}

// GET /products — List all products.
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, description, price, stock FROM products ORDER BY id'
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: 'Unable to fetch products'
    });
  }
});

// GET /products/:id — View one product.
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, description, price, stock
       FROM products
       WHERE id = $1`,
      [req.productId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Product not found'
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: 'Unable to fetch product'
    });
  }
});

// POST /products — Create a product, admin only.
router.post('/', requireAdmin, async (req, res) => {
  const validationError = validateProduct(req.body);

  if (validationError) {
    return res.status(400).json({
      error: validationError
    });
  }

  const { name, description, price, stock = 0 } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO products (name, description, price, stock)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, description, price, stock`,
      [
        name.trim(),
        description === undefined ? null : description.trim(),
        String(price),
        stock
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: 'Unable to create product'
    });
  }
});

// PATCH /products/:id — Update a product, admin only.
router.patch('/:id', requireAdmin, async (req, res) => {
  const validationError = validateProduct(req.body, true);

  if (validationError) {
    return res.status(400).json({
      error: validationError
    });
  }

  const { name, description, price, stock } = req.body;

  try {
    const result = await pool.query(
      `UPDATE products
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           price = COALESCE($3, price),
           stock = COALESCE($4, stock)
       WHERE id = $5
       RETURNING id, name, description, price, stock`,
      [
        name === undefined ? null : name.trim(),
        description === undefined ? null : description.trim(),
        price === undefined ? null : String(price),
        stock === undefined ? null : stock,
        req.productId
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Product not found'
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: 'Unable to update product'
    });
  }
});

// DELETE /products/:id — Delete a product, admin only.
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM products WHERE id = $1 RETURNING id',
      [req.productId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Product not found'
      });
    }

    res.json({
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: 'Unable to delete product'
    });
  }
});

module.exports = router;