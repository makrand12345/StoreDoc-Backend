const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Verification check
pool.connect((err, client, release) => {
  if (err) {
    return console.error('❌ Error acquiring client:', err.stack);
  }
  console.log('✅ Database connected successfully to PostgreSQL');
  release();
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};