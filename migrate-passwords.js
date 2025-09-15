/**
 * Password Migration Script
 * This script migrates existing plaintext passwords to bcrypt hashes
 * 
 * IMPORTANT: Run this script ONCE when deploying the security updates
 * Make sure to backup your database before running this script
 */

const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const config = require('./config');

// Database configuration
const pool = new Pool(config.database);

async function migratePasswords() {
  console.log('🔄 Starting password migration...');
  
  try {
    // Get all users with plaintext passwords (assuming current passwords are plaintext)
    const result = await pool.query('SELECT id, email, password FROM users WHERE password IS NOT NULL');
    const users = result.rows;
    
    console.log(`📋 Found ${users.length} users to migrate`);
    
    let migratedCount = 0;
    let errorCount = 0;
    
    for (const user of users) {
      try {
        // Check if password is already hashed (bcrypt hashes start with $2b$)
        if (user.password.startsWith('$2b$')) {
          console.log(`⏭️  User ${user.email} already has hashed password, skipping`);
          continue;
        }
        
        // Hash the plaintext password
        console.log(`🔒 Hashing password for user: ${user.email}`);
        const hashedPassword = await bcrypt.hash(user.password, 12);
        
        // Update the user's password in the database
        await pool.query(
          'UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2',
          [hashedPassword, user.id]
        );
        
        migratedCount++;
        console.log(`✅ Successfully migrated password for user: ${user.email}`);
        
      } catch (error) {
        console.error(`❌ Error migrating password for user ${user.email}:`, error.message);
        errorCount++;
      }
    }
    
    console.log('\n📊 Migration Summary:');
    console.log(`✅ Successfully migrated: ${migratedCount} users`);
    console.log(`❌ Errors: ${errorCount} users`);
    console.log(`⏭️  Already migrated: ${users.length - migratedCount - errorCount} users`);
    
    if (errorCount === 0) {
      console.log('\n🎉 Password migration completed successfully!');
    } else {
      console.log('\n⚠️  Password migration completed with some errors. Please check the logs above.');
    }
    
  } catch (error) {
    console.error('💥 Fatal error during password migration:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Confirmation prompt
function promptForConfirmation() {
  console.log('⚠️  WARNING: This script will modify all user passwords in your database!');
  console.log('📋 Make sure you have backed up your database before proceeding.');
  console.log('🔄 This script will convert plaintext passwords to bcrypt hashes.');
  console.log('\nPress Ctrl+C to cancel, or any key to continue...');
  
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on('data', () => {
    process.stdin.setRawMode(false);
    process.stdin.pause();
    migratePasswords();
  });
}

// Start the migration process
promptForConfirmation();