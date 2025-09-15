// scripts/config.js
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

module.exports = {
  database: {
    host: process.env.DATABASE_HOST || 'localhost',
    port: process.env.DATABASE_PORT || 5432,
    database: process.env.DATABASE_NAME || 'syntra',
    user: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || '221202',
  }
};