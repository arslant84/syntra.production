require('dotenv').config();
const postgres = require('postgres');

async function fixExternalPartyTSRs() {
  console.log('Fixing external party TSR user associations...');
  
  // Load environment variables
  const {
    DATABASE_HOST,
    DATABASE_NAME,
    DATABASE_USER,
    DATABASE_PASSWORD,
  } = process.env;

  // Initialize PostgreSQL client
  const sql = postgres({
    host: DATABASE_HOST,
    database: DATABASE_NAME,
    username: DATABASE_USER,
    password: DATABASE_PASSWORD,
    ssl: false,
  });

  try {
    // Get current user details (Arslan Tekayev)
    const currentUser = await sql`
      SELECT id, staff_id, name, email, department FROM users 
      WHERE staff_id = '1049681' OR name ILIKE '%Arslan%' OR email ILIKE '%arslan%'
      LIMIT 1
    `;
    
    if (currentUser.length === 0) {
      console.log('❌ Could not find current user details');
      return;
    }
    
    const user = currentUser[0];
    console.log('✅ Found user:', user.name, user.staff_id, user.email);
    
    // Update recent external party TSRs to be associated with the current user
    const result = await sql`
      UPDATE travel_requests 
      SET 
        requestor_name = ${user.name},
        staff_id = ${user.staff_id},
        department = ${user.department}
      WHERE travel_type = 'External Parties' 
        AND submitted_at >= '2025-08-26 00:00:00'
        AND (requestor_name IN ('Sample Name', 'John Smith') OR staff_id IS NULL)
    `;
    
    console.log(`✅ Updated ${result.count} external party TSRs to associate with user ${user.name}`);
    
    // List the updated TSRs
    const updatedTSRs = await sql`
      SELECT id, requestor_name, external_full_name, submitted_at
      FROM travel_requests 
      WHERE travel_type = 'External Parties' 
        AND submitted_at >= '2025-08-26 00:00:00'
        AND staff_id = ${user.staff_id}
      ORDER BY submitted_at DESC
    `;
    
    console.log('📋 Updated TSRs:');
    updatedTSRs.forEach(tsr => {
      console.log(`  - ${tsr.id}: ${tsr.requestor_name} (External: ${tsr.external_full_name})`);
    });
    
  } catch (error) {
    console.error('Error fixing external party TSRs:', error);
  } finally {
    await sql.end();
    console.log('Database connection closed');
  }
}

// Run the function
fixExternalPartyTSRs().catch(console.error);