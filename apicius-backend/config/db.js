const { Pool } = require('pg');
require('dotenv').config();

// Create a new pool instance with your database configuration
const pool = new Pool({
    user: process.env.DB_USER || 'Masterblaster',        // Database user
    host: process.env.DB_HOST || 'localhost',           
    database: process.env.DB_NAME || 'apicius_db',      // Database name
    password: process.env.DB_PASSWORD || 'Anjodaguarda123!',// Database password
    port: process.env.DB_PORT || 5433,                  // Port number (default for PostgreSQL is 5432)
});

// Export the pool instance to use throughout the app
module.exports = pool;
