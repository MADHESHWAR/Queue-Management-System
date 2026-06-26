const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.MYSQL_HOST || '127.0.0.1',
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'queue_management',
  port: parseInt(process.env.MYSQL_PORT || '3306', 10),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: process.env.MYSQL_SSL === 'true' ? { rejectUnauthorized: false } : undefined
};

let pool;

const connectDB = async () => {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS tokens (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tokenNumber INT NOT NULL,
      customerName VARCHAR(255) NOT NULL,
      status ENUM('Waiting', 'Serving', 'Completed', 'Skipped') DEFAULT 'Waiting',
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_status (status),
      INDEX idx_createdAt (createdAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;

  try {
    // Attempt direct database connection first (recommended for cloud hosts like Aiven)
    console.log(`Attempting connection to MySQL database "${dbConfig.database}" at ${dbConfig.host}:${dbConfig.port}...`);
    pool = mysql.createPool(dbConfig);
    
    // Ping the database
    await pool.query('SELECT 1');
    console.log(`✓ MySQL connected directly to database: ${dbConfig.database}`);

    // Verify/create tokens table
    await pool.query(createTableQuery);
    console.log('✓ MySQL Tokens table verified/created successfully');
  } catch (error) {
    // If the database does not exist, try to connect without database name and create it
    if (error.code === 'ER_BAD_DB_ERROR') {
      try {
        console.log(`Database "${dbConfig.database}" does not exist. Attempting auto-creation...`);
        const adminConfig = { ...dbConfig };
        delete adminConfig.database;

        const connection = await mysql.createConnection(adminConfig);
        await connection.query(`CREATE DATABASE \`${dbConfig.database}\``);
        await connection.end();
        console.log(`✓ Database "${dbConfig.database}" created successfully`);

        // Reconnect with database
        pool = mysql.createPool(dbConfig);
        await pool.query(createTableQuery);
        console.log('✓ MySQL Tokens table verified/created successfully');
        return;
      } catch (createError) {
        console.error(`Failed to automatically create database: ${createError.message}`);
      }
    }

    console.error(`MySQL Connection/Initialization Error: ${error.message}`);
    process.exit(1); // Exit process with failure
  }
};

const getPool = () => {
  if (!pool) {
    throw new Error('Database not connected. Call connectDB first.');
  }
  return pool;
};

// Export connectDB as main export, with getPool as helper
module.exports = connectDB;
module.exports.getPool = getPool;
