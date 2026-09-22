const request = require('supertest');
const app = require('../app');
const pool = require('../db');

describe('GET /products', () => {
  test('returns a list of products', async () => {
    const response = await request(app).get('/products');

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });
});

describe('GET /products/:id', () => {
  test('returns 404 for a product that does not exist', async () => {
    const response = await request(app).get('/products/999999999');

    expect(response.status).toBe(404);
  });

  test('returns 400 for an invalid id', async () => {
    const response = await request(app).get('/products/not-a-number');

    expect(response.status).toBe(400);
  });
});

describe('POST /products (admin only)', () => {
  test('rejects the request when no one is logged in', async () => {
    const response = await request(app)
      .post('/products')
      .send({ name: 'New Product', price: '9.99', stock: 10 });

    expect(response.status).toBe(401);
  });

  test('rejects the request from a logged-in customer who is not an admin', async () => {
    const agent = request.agent(app);
    const email = `test-customer-${Date.now()}@example.com`;

    await agent
      .post('/auth/register')
      .send({ name: 'Customer', email, password: 'password123' });
    await agent.post('/auth/login').send({ email, password: 'password123' });

    const response = await agent
      .post('/products')
      .send({ name: 'New Product', price: '9.99', stock: 10 });

    expect(response.status).toBe(403);

    await pool.query('DELETE FROM users WHERE email = $1', [email]);
  });
});
