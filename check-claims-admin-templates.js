#!/usr/bin/env node

require('dotenv').config();
const postgres = require('postgres');

async function checkClaimsAdminTemplates() {
  const sql = postgres({
    host: process.env.DATABASE_HOST || 'localhost',
    database: process.env.DATABASE_NAME || 'syntra',
    username: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD,
    ssl: process.env.NODE_ENV === 'production'
  });

  try {
    console.log('🔍 Checking claims admin notification templates...');
    
    const templates = await sql`
      SELECT name, subject 
      FROM notification_templates 
      WHERE name LIKE '%claims%admin%' OR name LIKE '%hod_approved_to_admin%'
      ORDER BY name
    `;
    
    console.log('📋 Claims admin notification templates:');
    if (templates.length === 0) {
      console.log('   ❌ No claims admin templates found');
      console.log('   ℹ️  Need to create: claims_hod_approved_to_admin');
    } else {
      templates.forEach(t => console.log(`   ✅ ${t.name}: ${t.subject}`));
    }

    // Also check transport admin template for comparison
    console.log('\n🚗 Transport admin templates for comparison:');
    const transportTemplates = await sql`
      SELECT name, subject 
      FROM notification_templates 
      WHERE name LIKE '%transport%admin%' 
      ORDER BY name
    `;
    
    transportTemplates.forEach(t => console.log(`   📋 ${t.name}: ${t.subject}`));
    
    await sql.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkClaimsAdminTemplates();