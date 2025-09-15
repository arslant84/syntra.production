const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  database: 'syntra',
  user: 'postgres',
  password: '221202',
});

// Simulate different user sessions to test RBAC
const testUsers = [
  {
    id: 'test-ticketing-admin',
    email: 'ticketing@example.com', 
    name: 'Ticketing Admin User',
    role: 'Ticketing Admin',
    staffId: 'TA001'
  },
  {
    id: 'test-system-admin',
    email: 'system@example.com',
    name: 'System Admin User', 
    role: 'System Administrator',
    staffId: 'SA001'
  }
];

async function testRBACFiltering() {
  try {
    await client.connect();
    console.log('Connected to database successfully\n');
    
    console.log('=== TESTING RBAC FILTERING LOGIC ===\n');
    
    // Test the query that the flight processing page uses
    for (const user of testUsers) {
      console.log(`--- Testing as ${user.role} (${user.name}) ---`);
      
      // Simulate the exact query conditions from the flight processing page
      // This is the key query that filters TRFs based on RBAC
      
      console.log('User session details:');
      console.log(`  ID: ${user.id}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Name: ${user.name}`);
      console.log(`  Role: ${user.role}`);
      console.log(`  Staff ID: ${user.staffId}`);
      
      // Determine if this user should bypass user filtering (admin view)
      const adminRoles = ['System Administrator', 'Admin'];
      const domainAdminRoles = ['Ticketing Admin'];
      const shouldBypassFilter = adminRoles.includes(user.role) || domainAdminRoles.includes(user.role);
      
      console.log(`\nFiltering logic for ${user.role}:`);
      console.log(`  Should bypass user filter: ${shouldBypassFilter}`);
      
      if (shouldBypassFilter) {
        // Admin query - should see all approved TRFs
        const adminQuery = await client.query(`
          SELECT 
            id, 
            requestor_name AS "requestorName", 
            travel_type AS "travelType", 
            purpose, 
            status, 
            submitted_at AS "submittedAt",
            staff_id AS "staffId",
            department
          FROM travel_requests 
          WHERE status = 'Approved'
          ORDER BY submitted_at DESC
        `);
        
        console.log(`  Admin query results: ${adminQuery.rows.length} TRFs found`);
        adminQuery.rows.forEach(trf => {
          console.log(`    ${trf.id} | ${trf.requestorName} | ${trf.travelType} | ${trf.status}`);
        });
      } else {
        // Regular user query - should see only their own TRFs
        console.log('  This would use universal user filtering to show only user\'s own requests');
        
        // Simulate universal user filtering
        const userSpecificQuery = await client.query(`
          SELECT 
            id, 
            requestor_name AS "requestorName", 
            travel_type AS "travelType", 
            purpose, 
            status, 
            submitted_at AS "submittedAt",
            staff_id AS "staffId",
            department
          FROM travel_requests 
          WHERE status = 'Approved'
            AND (
              staff_id = $1 
              OR requestor_name = $2
              OR requestor_name ILIKE $3
            )
          ORDER BY submitted_at DESC
        `, [user.staffId, user.name, `%${user.name}%`]);
        
        console.log(`  User-specific query results: ${userSpecificQuery.rows.length} TRFs found`);
        userSpecificQuery.rows.forEach(trf => {
          console.log(`    ${trf.id} | ${trf.requestorName} | ${trf.travelType} | ${trf.status}`);
        });
      }
      
      console.log('');
    }
    
    // Check user permissions in the database
    console.log('\n=== CHECKING USER PERMISSIONS ===\n');
    
    const permissionsQuery = await client.query(`
      SELECT 
        u.id,
        u.name, 
        u.email,
        u.role,
        u.staff_id,
        array_agg(p.permission_name) as permissions
      FROM users u
      LEFT JOIN user_permissions up ON u.id = up.user_id
      LEFT JOIN permissions p ON up.permission_id = p.id
      WHERE u.role IN ('Ticketing Admin', 'System Administrator')
      GROUP BY u.id, u.name, u.email, u.role, u.staff_id
      ORDER BY u.role
    `);
    
    console.log(`Found ${permissionsQuery.rows.length} users with admin roles:`);
    permissionsQuery.rows.forEach(user => {
      console.log(`\n${user.name} (${user.role}):`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Staff ID: ${user.staff_id}`);
      console.log(`  Permissions: ${user.permissions.filter(p => p).join(', ') || 'None'}`);
    });
    
    // Check if the view_all_trf permission exists
    console.log('\n=== CHECKING TRF-RELATED PERMISSIONS ===\n');
    
    const trfPermissions = await client.query(`
      SELECT * FROM permissions WHERE permission_name ILIKE '%trf%' OR permission_name ILIKE '%flight%'
      ORDER BY permission_name
    `);
    
    console.log(`TRF/Flight-related permissions in system:`);
    trfPermissions.rows.forEach(perm => {
      console.log(`  - ${perm.permission_name}: ${perm.description || 'No description'}`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await client.end();
    console.log('\nDatabase connection closed');
  }
}

testRBACFiltering();