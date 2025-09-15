/**
 * Create Test User Script
 * This script creates a test user with hashed password for testing the security fixes
 */

const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

// Database configuration
const pool = new Pool({
  host: process.env.DATABASE_HOST || 'localhost',
  database: process.env.DATABASE_NAME || 'syntra',
  user: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD,
  port: process.env.DATABASE_PORT || 5432,
});

async function createTestUser() {
  console.log('🔄 Creating test user...');
  
  try {
    // Test user credentials
    const testUser = {
      email: 'admin@syntra.local',
      password: 'AdminPassword123!@#', // 18 characters - meets requirement
      name: 'Test Administrator',
      role: 'admin'
    };
    
    console.log(`📧 Email: ${testUser.email}`);
    console.log(`🔑 Password: ${testUser.password}`);
    
    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [testUser.email]
    );
    
    if (existingUser.rows.length > 0) {
      console.log('👤 User already exists, updating password...');
      
      // Hash the new password
      const hashedPassword = await bcrypt.hash(testUser.password, 12);
      
      // Update existing user
      await pool.query(
        'UPDATE users SET password = $1, updated_at = NOW() WHERE email = $2',
        [hashedPassword, testUser.email]
      );
      
      console.log('✅ Test user password updated successfully!');
    } else {
      console.log('👤 Creating new test user...');
      
      // Hash the password
      const hashedPassword = await bcrypt.hash(testUser.password, 12);
      
      // First, ensure we have a role (create if needed)
      let roleResult = await pool.query('SELECT id FROM roles WHERE name = $1', [testUser.role]);
      let roleId;
      
      if (roleResult.rows.length === 0) {
        console.log('🔧 Creating admin role...');
        const newRole = await pool.query(
          'INSERT INTO roles (name, description, created_at, updated_at) VALUES ($1, $2, NOW(), NOW()) RETURNING id',
          [testUser.role, 'System Administrator']
        );
        roleId = newRole.rows[0].id;
      } else {
        roleId = roleResult.rows[0].id;
      }
      
      // Create the user
      const newUser = await pool.query(
        'INSERT INTO users (name, email, password, role_id, role, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) RETURNING id',
        [testUser.name, testUser.email, hashedPassword, roleId, testUser.role]
      );
      
      console.log('✅ Test user created successfully!');
      console.log(`📋 User ID: ${newUser.rows[0].id}`);
      console.log(`🎭 Role ID: ${roleId}`);
    }
    
    console.log('\n🎯 Test Login Credentials:');
    console.log(`📧 Email: ${testUser.email}`);
    console.log(`🔑 Password: ${testUser.password}`);
    console.log('\n🌐 You can now sign in at: http://localhost:3000/login');
    
  } catch (error) {
    console.error('💥 Error creating test user:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Check if required environment variables are set
if (!process.env.DATABASE_PASSWORD) {
  console.error('❌ DATABASE_PASSWORD environment variable is required');
  process.exit(1);
}

// Create the test user
createTestUser();