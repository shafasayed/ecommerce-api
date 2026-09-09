const express = require('express');
const pool = require('./db');

const app = express();
const PORT = 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Welcome to my e-commerce API!' });
});

app.get('/products', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, description, price, stock FROM products ORDER BY id'
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to fetch products' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});