require('dotenv').config();

const { Pool } = require('pg');

// Locally, Pool() reads PGHOST/PGPORT/etc from .env.
// In production, Render provides a single DATABASE_URL instead.
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    })
  : new Pool();

module.exports = pool;