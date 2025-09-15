const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  database: 'syntra',
  user: 'postgres',
  password: '221202',
});

async function diagnoseFilteringIssue() {
  try {
    await client.connect();
    console.log('Connected to database successfully\n');
    
    console.log('=== DIAGNOSIS: WHY TICKETING ADMIN CANNOT SEE APPROVED TRFs ===\n');
    
    // First, check if there are any users with Ticketing Admin role
    const ticketingAdmins = await client.query(`
      SELECT id, name, email, role, staff_id, department
      FROM users 
      WHERE role = 'Ticketing Admin'
    `);
    
    console.log(`Found ${ticketingAdmins.rows.length} Ticketing Admin users:`);
    ticketingAdmins.rows.forEach(user => {
      console.log(`  - ${user.name} (${user.email}) | Staff ID: ${user.staff_id} | Dept: ${user.department}`);
    });
    
    if (ticketingAdmins.rows.length === 0) {
      console.log('❌ NO TICKETING ADMIN USERS FOUND - This is the problem!');
      console.log('   The Ticketing Admin role exists in code but no users have this role assigned.');
      return;
    }
    
    // Get the first Ticketing Admin for testing
    const testUser = ticketingAdmins.rows[0];
    console.log(`\nTesting with Ticketing Admin: ${testUser.name} (${testUser.email})`);
    
    // Check user permissions
    const userPermissions = await client.query(`
      SELECT p.permission_name, p.description
      FROM users u
      LEFT JOIN user_permissions up ON u.id = up.user_id  
      LEFT JOIN permissions p ON up.permission_id = p.id
      WHERE u.id = $1
    `, [testUser.id]);
    
    console.log(`\nTicketing Admin permissions:`);
    if (userPermissions.rows.length === 0 || !userPermissions.rows[0].permission_name) {
      console.log('  ❌ NO PERMISSIONS FOUND - This might be the issue!');
    } else {
      userPermissions.rows.forEach(perm => {
        console.log(`  - ${perm.permission_name}: ${perm.description || 'No description'}`);
      });
    }
    
    // Test the actual filtering logic that would be applied
    console.log(`\nTesting RBAC filtering logic for Ticketing Admin:`);
    
    // Check which TRFs this user would see with universal filtering
    const universalFilterQuery = await client.query(`
      SELECT 
        id,
        requestor_name,
        travel_type, 
        status,
        staff_id,
        department,
        submitted_at
      FROM travel_requests 
      WHERE status = 'Approved'
        AND (
          staff_id = $1 
          OR requestor_name = $2
          OR requestor_name ILIKE $3
          OR requestor_name ILIKE $4
        )
      ORDER BY submitted_at DESC
    `, [
      testUser.staff_id, 
      testUser.name,
      `%${testUser.name}%`,
      `%${testUser.email}%`
    ]);
    
    console.log(`Universal user filtering results: ${universalFilterQuery.rows.length} TRFs`);
    universalFilterQuery.rows.forEach(trf => {
      console.log(`  ${trf.id} | ${trf.requestor_name} | ${trf.travel_type} | ${trf.status}`);
    });
    
    // This is what System Admin would see (all approved TRFs)
    const adminViewQuery = await client.query(`
      SELECT 
        id,
        requestor_name,
        travel_type,
        status,
        staff_id,
        department,
        submitted_at
      FROM travel_requests 
      WHERE status = 'Approved'
      ORDER BY submitted_at DESC
    `);
    
    console.log(`\nAdmin view (what System Admin sees): ${adminViewQuery.rows.length} TRFs`);
    adminViewQuery.rows.forEach(trf => {
      console.log(`  ${trf.id} | ${trf.requestor_name} | ${trf.travel_type} | ${trf.status}`);
    });
    
    // Check the shouldBypassUserFilter logic
    console.log(`\nAnalyzing shouldBypassUserFilter logic:`);
    console.log(`  Ticketing Admin role: 'Ticketing Admin'`);
    console.log(`  Is in ADMIN_ROLES: ${['Admin', 'System Administrator', 'Ticketing Admin'].includes('Ticketing Admin')}`);
    console.log(`  Status parameter present (statuses=Approved): true`);
    console.log(`  Should bypass filter: true (if permissions are correct)`);
    
    // The key issue: Check if canViewDomainData works for Ticketing Admin
    console.log(`\nKey permission check:`);
    console.log(`  For Ticketing Admin to bypass filtering, they need:`);
    console.log(`    1. canViewAllData() -> role must be 'Admin' or 'System Administrator' (❌ Ticketing Admin doesn't qualify)`);
    console.log(`    2. canViewDomainData(session, 'trf') -> needs 'view_all_trf' permission`);
    console.log(`    3. canViewApprovalData() -> needs TRF approval permissions`);
    
    // Check if this user has view_all_trf permission
    const viewAllTrfPerm = await client.query(`
      SELECT 1 FROM users u
      JOIN user_permissions up ON u.id = up.user_id
      JOIN permissions p ON up.permission_id = p.id
      WHERE u.id = $1 AND p.permission_name = 'view_all_trf'
    `, [testUser.id]);
    
    console.log(`  Has 'view_all_trf' permission: ${viewAllTrfPerm.rows.length > 0 ? '✅ Yes' : '❌ No'}`);
    
    if (viewAllTrfPerm.rows.length === 0) {
      console.log(`\n🎯 ROOT CAUSE IDENTIFIED:`);
      console.log(`   Ticketing Admin users exist but they lack the 'view_all_trf' permission.`);
      console.log(`   Without this permission, they cannot bypass user filtering and only see their own TRFs.`);
      console.log(`   Since none of the approved TRFs belong to the Ticketing Admin user, they see none.`);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await client.end();
    console.log('\nDatabase connection closed');
  }
}

diagnoseFilteringIssue();