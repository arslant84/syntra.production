const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  database: 'syntra',
  user: 'postgres',
  password: '221202',
});

async function simpleRBACDiagnosis() {
  try {
    await client.connect();
    console.log('Connected to database successfully\n');
    
    console.log('=== SIMPLIFIED RBAC DIAGNOSIS ===\n');
    
    // Check if there are Ticketing Admin users
    const ticketingAdmins = await client.query(`
      SELECT id, name, email, role, staff_id, department
      FROM users 
      WHERE role = 'Ticketing Admin'
    `);
    
    console.log(`Ticketing Admin users (${ticketingAdmins.rows.length}):`);
    ticketingAdmins.rows.forEach(user => {
      console.log(`  - ${user.name} (${user.email}) | Staff ID: ${user.staff_id}`);
    });
    
    // Check System Administrator users
    const systemAdmins = await client.query(`
      SELECT id, name, email, role, staff_id, department
      FROM users 
      WHERE role = 'System Administrator'  
    `);
    
    console.log(`\nSystem Administrator users (${systemAdmins.rows.length}):`);
    systemAdmins.rows.forEach(user => {
      console.log(`  - ${user.name} (${user.email}) | Staff ID: ${user.staff_id}`);
    });
    
    if (ticketingAdmins.rows.length === 0) {
      console.log('\n❌ NO TICKETING ADMIN USERS FOUND');
      console.log('   This could be the issue - no users have the Ticketing Admin role.');
      return;
    }
    
    // Test with the first Ticketing Admin
    const ticketingAdmin = ticketingAdmins.rows[0];
    console.log(`\nTesting filtering for Ticketing Admin: ${ticketingAdmin.name}`);
    
    // Simulate what the Ticketing Admin would see with user filtering
    const ticketingAdminView = await client.query(`
      SELECT 
        id, requestor_name, travel_type, status, staff_id
      FROM travel_requests 
      WHERE status = 'Approved'
        AND (
          staff_id = $1 
          OR requestor_name = $2
          OR requestor_name ILIKE $3
          OR email ILIKE $4
        )
      ORDER BY submitted_at DESC
    `, [
      ticketingAdmin.staff_id,
      ticketingAdmin.name, 
      `%${ticketingAdmin.name}%`,
      `%${ticketingAdmin.email}%`
    ]);
    
    console.log(`\nTicketing Admin filtered view: ${ticketingAdminView.rows.length} TRFs`);
    if (ticketingAdminView.rows.length === 0) {
      console.log('  ❌ NO TRFS MATCH - This explains why Ticketing Admin sees nothing!');
      console.log(`  The user filter looks for TRFs where:`);
      console.log(`    - staff_id = '${ticketingAdmin.staff_id}' OR`);
      console.log(`    - requestor_name = '${ticketingAdmin.name}' OR`);
      console.log(`    - requestor_name contains '${ticketingAdmin.name}' OR`);
      console.log(`    - email contains '${ticketingAdmin.email}'`);
      console.log(`  But none of the approved TRFs match these criteria.`);
    } else {
      ticketingAdminView.rows.forEach(trf => {
        console.log(`    ${trf.id} | ${trf.requestor_name} | ${trf.travel_type} | ${trf.staff_id}`);
      });
    }
    
    // Show what System Admin would see (all approved TRFs)
    const allApproved = await client.query(`
      SELECT id, requestor_name, travel_type, status, staff_id 
      FROM travel_requests 
      WHERE status = 'Approved'
      ORDER BY submitted_at DESC
    `);
    
    console.log(`\nSystem Admin view (all approved): ${allApproved.rows.length} TRFs`);
    allApproved.rows.forEach(trf => {
      console.log(`  ${trf.id} | ${trf.requestor_name} | ${trf.travel_type} | ${trf.staff_id}`);
    });
    
    console.log(`\n🎯 CONCLUSION:`);
    console.log(`   The issue is in the RBAC logic in shouldBypassUserFilter().`);
    console.log(`   Based on the code analysis:`);
    console.log(`   `);
    console.log(`   1. System Administrator is in ADMIN_ROLES and bypasses filtering ✅`);
    console.log(`   2. Ticketing Admin is in ADMIN_ROLES (client-side) but not in canViewAllData() (server-side) ❌`);
    console.log(`   3. The server-side API protection only allows 'System Administrator' and 'Admin' full access`);
    console.log(`   4. Ticketing Admin gets filtered to only their own TRFs, which is none`);
    console.log(`   `);
    console.log(`   SOLUTION: Update canViewAllData() in /lib/api-protection.ts to include 'Ticketing Admin'`);
    console.log(`   OR give Ticketing Admin the 'view_all_trf' permission in canViewDomainData()`);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
    console.log('\nDatabase connection closed');
  }
}

simpleRBACDiagnosis();