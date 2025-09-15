const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database configuration
const dbConfig = {
  host: process.env.DATABASE_HOST || 'localhost',
  port: process.env.DATABASE_PORT || 5432,
  database: process.env.DATABASE_NAME || 'syntra',
  user: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || '221202',
};

async function setupTransportRequestsSchema() {
  const pool = new Pool(dbConfig);
  
  try {
    console.log('🔄 Setting up Transport Requests schema...');
    
    // Read the SQL file
    const sqlFilePath = path.join(__dirname, 'create-transport-requests-table.sql');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    
    // Execute the SQL
    await pool.query(sqlContent);
    
    console.log('✅ Transport Requests schema setup completed successfully!');
    
    // Verify the tables were created
    const tables = ['transport_requests', 'transport_details', 'transport_approval_steps'];
    
    for (const table of tables) {
      const result = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        );
      `, [table]);
      
      if (result.rows[0].exists) {
        console.log(`✅ Table '${table}' exists`);
      } else {
        console.log(`❌ Table '${table}' was not created`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error setting up Transport Requests schema:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the setup if this file is executed directly
if (require.main === module) {
  setupTransportRequestsSchema()
    .then(() => {
      console.log('🎉 Transport Requests schema setup completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Transport Requests schema setup failed:', error);
      process.exit(1);
    });
}

module.exports = { setupTransportRequestsSchema }; 