require('dotenv').config();
const postgres = require('postgres');

async function fixAccommodationReference() {
  console.log('Fixing accommodation request reference...');
  
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
    // Fix the accommodation request comment to reference the correct TSR
    const result = await sql`
      UPDATE travel_requests 
      SET additional_comments = 'Auto-generated from TSR TSR-20250826-1949-TUR-SQZB: jk;hjkl;j'
      WHERE id = 'ACCOM-202508261442275-KIYAN-M7KH'
    `;
    
    console.log('✅ Fixed accommodation request reference');
    console.log('Updated accommodation request ACCOM-202508261442275-KIYAN-M7KH to reference correct TSR: TSR-20250826-1949-TUR-SQZB');
    
  } catch (error) {
    console.error('Error fixing accommodation reference:', error);
  } finally {
    await sql.end();
    console.log('Database connection closed');
  }
}

// Run the function
fixAccommodationReference().catch(console.error);