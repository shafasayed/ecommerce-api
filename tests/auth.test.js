const request = require('supertest');
const app = require('../app');
const pool = require('../db');

describe('POST /auth/register', () => {
  const testEmail = `test-register-${Date.now()}@example.com`;

  afterAll(async () => {
    await pool.query('DELETE FROM users WHERE email = $1', [testEmail]);
  });

  test('creates a new account with valid data', async () => {
    const response = await request(app)
      .post('/auth/register')
      .send({ name: 'Test User', email: testEmail, password: 'password123' });

    expect(response.status).toBe(201);
    expect(response.body.user.email).toBe(testEmail);
  });

  test('rejects a duplicate email', async () => {
    const response = await request(app)
      .post('/auth/register')
      .send({ name: 'Test User', email: testEmail, password: 'password123' });

    expect(response.status).toBe(409);
  });

  test('rejects a password that is too short', async () => {
    const response = await request(app)
      .post('/auth/register')
      .send({
        name: 'Test User',
        email: `short-${Date.now()}@example.com`,
        password: '123'
      });

    expect(response.status).toBe(400);
  });
});

describe('POST /auth/login and /auth/logout', () => {
  const testEmail = `test-login-${Date.now()}@example.com`;
  const testPassword = 'password123';

  beforeAll(async () => {
    await request(app)
      .post('/auth/register')
      .send({ name: 'Login Test', email: testEmail, password: testPassword });
  });

  afterAll(async () => {
    await pool.query('DELETE FROM users WHERE email = $1', [testEmail]);
  });

  test('logs in with correct credentials and sets a session cookie', async () => {
    const response = await request(app)
      .post('/auth/login')
      .send({ email: testEmail, password: testPassword });

    expect(response.status).toBe(200);
    expect(response.headers['set-cookie']).toBeDefined();
  });

  test('rejects an incorrect password', async () => {
    const response = await request(app)
      .post('/auth/login')
      .send({ email: testEmail, password: 'wrongpassword' });

    expect(response.status).toBe(401);
  });

  test('logs out a logged-in user', async () => {
    const agent = request.agent(app);

    await agent.post('/auth/login').send({ email: testEmail, password: testPassword });
    const response = await agent.post('/auth/logout');

    expect(response.status).toBe(200);
  });
});
