const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  database: 'syntra',
  user: 'postgres',
  password: '221202',
});

async function main() {
  try {
    await client.connect();
    
    // Get the schema of travel_requests table
    const schemaQuery = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'travel_requests'
      ORDER BY ordinal_position
    `);
    
    console.log('travel_requests table schema:');
    console.table(schemaQuery.rows);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

main();