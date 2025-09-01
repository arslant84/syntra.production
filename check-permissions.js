const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  database: 'syntra', 
  user: 'postgres',
  password: '221202'
});

async function checkAllPermissions() {
  try {
    await client.connect();
    
    // Get all permissions
    const allPerms = await client.query(`
      SELECT name, description FROM permissions 
      ORDER BY name
    `);
    
    console.log('All available permissions:');
    allPerms.rows.forEach(row => {
      console.log(`- ${row.name}: ${row.description || 'No description'}`);
    });
    
    // Check if there are any admins at all
    const admins = await client.query(`
      SELECT DISTINCT u.name, u.email, u.role
      FROM users u
      WHERE u.role ILIKE '%admin%'
      ORDER BY u.name
    `);
    
    console.log('\nUsers with admin roles:');
    admins.rows.forEach(row => {
      console.log(`- ${row.name} (${row.email}) - Role: ${row.role}`);
    });
    
    // Check flight-related permissions specifically
    const flightPerms = await client.query(`
      SELECT name, description FROM permissions 
      WHERE name ILIKE '%flight%' OR name ILIKE '%manage%'
      ORDER BY name
    `);
    
    console.log('\nFlight/Management permissions:');
    flightPerms.rows.forEach(row => {
      console.log(`- ${row.name}: ${row.description || 'No description'}`);
    });
    
  } catch (error) {
    console.error('Database error:', error.message);
  } finally {
    await client.end();
  }
}

checkAllPermissions();