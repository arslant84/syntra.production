/**
 * Check User Password Status
 * This script checks the password format for a specific user
 */

const { Pool } = require('pg');
const config = require('./config');

// Database configuration
const pool = new Pool(config.database);

async function checkUserPassword(email) {
  console.log(`🔍 Checking password status for user: ${email}`);
  
  try {
    // Get user from database
    const result = await pool.query(
      'SELECT id, name, email, password, status FROM users WHERE email = $1',
      [email]
    );
    
    if (result.rows.length === 0) {
      console.log('❌ User not found');
      return;
    }
    
    const user = result.rows[0];
    
    console.log(`📋 User Details:`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Status: ${user.status}`);
    
    // Check password format
    if (!user.password) {
      console.log(`🔑 Password: NULL (No password set)`);
    } else if (user.password.startsWith('$2b$')) {
      console.log(`🔑 Password: HASHED (bcrypt format)`);
      console.log(`   Hash length: ${user.password.length} characters`);
    } else {
      console.log(`🔑 Password: PLAINTEXT (Security issue!)`);
      console.log(`   Password: ${user.password}`);
    }
    
    // Test password validation
    if (user.password && user.password.startsWith('$2b$')) {
      console.log(`\n🧪 Testing password validation...`);
      
      // Test with the original password (if we know it)
      const bcrypt = require('bcryptjs');
      
      // Try with the password from the image: GahrymanTe@2013
      const testPassword = 'GahrymanTe@2013';
      const isValid = await bcrypt.compare(testPassword, user.password);
      
      console.log(`   Test password: ${testPassword}`);
      console.log(`   Valid: ${isValid ? '✅ YES' : '❌ NO'}`);
      
      if (isValid) {
        console.log(`\n🎉 Password validation working correctly!`);
      } else {
        console.log(`\n⚠️  Password validation failed. The password may have been changed.`);
      }
    }
    
  } catch (error) {
    console.error('💥 Error checking user password:', error);
  } finally {
    await pool.end();
  }
}

// Check the specific user
const targetEmail = 'tekayev@outlook.com';
checkUserPassword(targetEmail);
