const express = require('express');
const pool = require('./db');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger');

const authRouter = require('./auth');
const usersRouter = require('./users');
const productsRouter = require('./products');
const cartRouter = require('./cart');
const checkoutRouter = require('./checkout');
const ordersRouter = require('./orders');

const app = express();
const PORT = 3000;

if (!process.env.SESSION_SECRET) {
  throw new Error('Add SESSION_SECRET to your .env file');
}

app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));

app.use(
  session({
    store: new PgSession({
      pool,
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

// API documentation.
app.get('/openapi.json', (req, res) => {
  res.json(swaggerDocument);
});

app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerDocument)
);

// API routes.
app.use('/auth', authRouter);
app.use('/users', usersRouter);
app.use('/products', productsRouter);
app.use('/cart', checkoutRouter);
app.use('/cart', cartRouter);
app.use('/orders', ordersRouter);

app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to my e-commerce API!',
    documentation: '/api-docs'
  });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Handle errors passed to next(error).
app.use((error, req, res, next) => {
  console.error(error);

  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  if (error.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body too large' });
  }

  if (error.code === '22003') {
    return res.status(400).json({ error: 'Number is too large' });
  }

  if (error.code === '23503') {
    return res.status(409).json({
      error: 'A related record changed. Refresh and try again'
    });
  }

  if (error.code === '23505') {
    return res.status(409).json({
      error: 'This record already exists'
    });
  }

  if (error.code === '40001' || error.code === '40P01') {
    return res.status(409).json({
      error: 'Data changed during the request. Please try again'
    });
  }

  res.status(500).json({
    error: 'Something went wrong on the server'
  });
});

const server = app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Swagger: http://localhost:${PORT}/api-docs`);
});

server.on('error', (error) => {
  console.error('Server could not start:', error.message);
  process.exit(1);
});