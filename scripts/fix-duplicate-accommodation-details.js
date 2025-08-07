const { Pool } = require('pg');
const path = require('path');

// Set up environment for database
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Database configuration
const dbConfig = {
  host: process.env.DATABASE_HOST || 'localhost',
  port: process.env.DATABASE_PORT || 5432,
  database: process.env.DATABASE_NAME || 'syntra',
  user: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || '221202',
};

async function fixDuplicateAccommodationDetails() {
  const pool = new Pool(dbConfig);
  
  try {
    console.log('🔍 Investigating duplicate accommodation details...');
    
    // Find travel requests with multiple accommodation detail records
    const duplicateQuery = await pool.query(`
      SELECT 
        trf_id,
        COUNT(*) as count
      FROM 
        trf_accommodation_details
      GROUP BY 
        trf_id
      HAVING 
        COUNT(*) > 1
      ORDER BY 
        count DESC
    `);
    
    if (duplicateQuery.rows.length === 0) {
      console.log('✅ No travel requests with duplicate accommodation details found.');
      return;
    }
    
    console.log(`❌ Found ${duplicateQuery.rows.length} travel requests with multiple accommodation details:`);
    
    for (const row of duplicateQuery.rows) {
      console.log(`   TRF ${row.trf_id}: ${row.count} accommodation details`);
      
      // Get details of the duplicate records
      const detailsQuery = await pool.query(`
        SELECT 
          id,
          trf_id,
          location,
          check_in_date,
          check_out_date,
          accommodation_type,
          created_at
        FROM 
          trf_accommodation_details
        WHERE 
          trf_id = $1
        ORDER BY 
          created_at ASC
      `, [row.trf_id]);
      
      console.log(`     Details for ${row.trf_id}:`);
      for (let i = 0; i < detailsQuery.rows.length; i++) {
        const detail = detailsQuery.rows[i];
        const isOldest = i === 0;
        console.log(`       ${isOldest ? '📋' : '🗑️ '} ${detail.id}: ${detail.location} (${detail.created_at.toISOString()})`);
      }
      
      // Keep only the oldest (first created) accommodation detail record
      if (detailsQuery.rows.length > 1) {
        const oldestRecord = detailsQuery.rows[0];
        const duplicateIds = detailsQuery.rows.slice(1).map(r => r.id);
        
        console.log(`     🔄 Keeping oldest record: ${oldestRecord.id}`);
        console.log(`     🗑️  Removing duplicate records: ${duplicateIds.join(', ')}`);
        
        // Delete the duplicate records
        const deleteResult = await pool.query(`
          DELETE FROM trf_accommodation_details 
          WHERE id = ANY($1)
        `, [duplicateIds]);
        
        console.log(`     ✅ Removed ${deleteResult.rowCount} duplicate accommodation detail records for TRF ${row.trf_id}`);
      }
    }
    
    console.log('\n🎉 Duplicate accommodation details cleanup completed!');
    
  } catch (error) {
    console.error('❌ Error fixing duplicate accommodation details:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the fix if this file is executed directly
if (require.main === module) {
  fixDuplicateAccommodationDetails()
    .then(() => {
      console.log('\n✅ Duplicate accommodation details fix completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Duplicate accommodation details fix failed:', error);
      process.exit(1);
    });
}

module.exports = { fixDuplicateAccommodationDetails };