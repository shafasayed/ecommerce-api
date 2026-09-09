const express = require('express');
const pool = require('./db');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const authRouter = require('./auth');
const usersRouter = require('./users');

const app = express();
const PORT = 3000;

if (!process.env.SESSION_SECRET) {
  throw new Error('Add SESSION_SECRET to your .env file');
}

// Read JSON request bodies.
app.use(express.json());

// Store login sessions in PostgreSQL.
app.use(
  session({
    store: new PgSession({
      pool: pool,
      createTableIfMissing: true
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 1000 * 60 * 60
    }
  })
);

// Connect the routers after session middleware.
app.use('/auth', authRouter);
app.use('/users', usersRouter);

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