const pool = require('./db');

async function testConnection() {
  try {
    const result = await pool.query(
      'SELECT current_database() AS database'
    );

    console.log('Connected to:', result.rows[0].database);
  } catch (error) {
    console.error('Connection failed:', error.message);
  } finally {
    await pool.end();
  }
}

testConnection();