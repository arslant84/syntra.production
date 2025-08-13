/**
 * Setup Password Hashing Trigger
 * This script adds a database trigger to automatically hash passwords
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const config = require('./config');

// Database configuration
const pool = new Pool(config.database);

async function setupPasswordTrigger() {
  console.log('🔄 Setting up password hashing trigger...');
  
  try {
    // Read the SQL file
    const sqlFilePath = path.resolve(__dirname, './add-password-hash-trigger.sql');
    const sql = fs.readFileSync(sqlFilePath, 'utf8');
    
    console.log('📋 Executing password trigger setup...');
    
    // Execute the SQL commands
    await pool.query(sql);
    
    console.log('✅ Password hashing trigger setup completed successfully!');
    console.log('\n🔒 Security Features Added:');
    console.log('- Automatic password hashing on INSERT');
    console.log('- Automatic password hashing on UPDATE');
    console.log('- Uses bcrypt with 12 salt rounds');
    console.log('- Only hashes plaintext passwords (skips already hashed)');
    
  } catch (error) {
    console.error('💥 Error setting up password trigger:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the setup
setupPasswordTrigger();
