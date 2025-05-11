// your-project-root/db_config.js
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Зазвичай для Neon.tech це потрібно
  }
});

module.exports = pool;