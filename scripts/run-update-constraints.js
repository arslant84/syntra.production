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

async function updateTransportConstraints() {
  const pool = new Pool(dbConfig);
  
  try {
    console.log('🔄 Updating transport request constraints...');
    
    // Read the SQL file
    const sqlFilePath = path.join(__dirname, 'update-transport-constraints.sql');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    
    // Execute the SQL
    const result = await pool.query(sqlContent);
    
    console.log('✅ Transport request constraints updated successfully!');
    
    if (result.rows && result.rows.length > 0) {
      console.log('📋 Constraint status:');
      result.rows.forEach(row => {
        console.log(`  - ${row.column_name}: ${row.data_type} (${row.foreign_key_status})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error updating transport constraints:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the update if this file is executed directly
if (require.main === module) {
  updateTransportConstraints()
    .then(() => {
      console.log('🎉 Transport constraints update completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Transport constraints update failed:', error);
      process.exit(1);
    });
}

module.exports = { updateTransportConstraints }; 