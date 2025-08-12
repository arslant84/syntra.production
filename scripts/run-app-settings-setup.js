const postgres = require('postgres');
const fs = require('fs');
const config = require('./config.js');

const sql = postgres({
  host: config.database.host,
  port: config.database.port,
  database: config.database.database,
  username: config.database.user,
  password: config.database.password,
});

async function setupAppSettings() {
  try {
    console.log('🔧 Setting up application settings table...');

    // Read and execute the SQL script
    const sqlScript = fs.readFileSync('./scripts/create-app-settings-table.sql', 'utf8');
    
    // Split by semicolons and execute each statement
    const statements = sqlScript.split(';').filter(stmt => stmt.trim().length > 0);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim();
      if (statement.length > 0) {
        console.log(`Executing statement ${i + 1}/${statements.length}...`);
        await sql.unsafe(statement);
      }
    }

    console.log('✅ Application settings table created successfully!');
    
    // Verify the settings were inserted
    const settings = await sql`
      SELECT setting_key, setting_value, setting_type, description, is_public 
      FROM application_settings 
      ORDER BY setting_key
    `;
    
    console.log('\n📋 Default Application Settings:');
    settings.forEach(setting => {
      const visibility = setting.is_public ? '🌐 Public' : '🔒 Admin Only';
      console.log(`  ${setting.setting_key}: ${setting.setting_value} (${setting.setting_type}) ${visibility}`);
    });

    await sql.end();
    process.exit(0);

  } catch (error) {
    console.error('❌ Error setting up application settings:', error);
    process.exit(1);
  }
}

setupAppSettings();