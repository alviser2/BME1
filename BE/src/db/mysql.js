import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// MySQL connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'bme1_db',
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

// Test connection
async function testConnection() {
  try {
    const [rows] = await pool.query('SELECT NOW() as now');
    console.log('✅ MySQL connected:', rows[0].now);
    return true;
  } catch (err) {
    console.error('❌ MySQL connection error:', err.message);
    return false;
  }
}

testConnection();

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await pool.end();
  process.exit(0);
});

export { pool };
