#!/usr/bin/env node

/**
 * Final cleanup of previousApprover field from notification templates
 * This script will thoroughly remove any remaining previousApprover references
 */

const postgres = require('postgres');

async function finalCleanupPreviousApprover() {
  console.log('🔧 Starting final cleanup of previousApprover field from notification templates...');
  
  const sql = postgres({
    host: process.env.DATABASE_HOST || 'localhost',
    database: process.env.DATABASE_NAME || 'syntra',
    username: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD,
    ssl: process.env.NODE_ENV === 'production'
  });

  try {
    console.log('✅ Connected to database');

    // First, let's see exactly what's still in the templates
    console.log('🔍 Checking templates that still have previousApprover references...');
    const problematicTemplates = await sql`
      SELECT name, body, variables_available
      FROM notification_templates 
      WHERE body LIKE '%{previousApprover}%'
      ORDER BY name
    `;
    
    console.log(`📋 Found ${problematicTemplates.length} templates still with previousApprover in body:`);
    
    for (const template of problematicTemplates) {
      console.log(`\n📄 Template: ${template.name}`);
      
      // Find the specific line(s) with previousApprover
      const bodyLines = template.body.split('\n');
      const problemLines = bodyLines.filter(line => line.includes('{previousApprover}'));
      
      console.log(`  Problem lines found: ${problemLines.length}`);
      problemLines.forEach((line, index) => {
        console.log(`    ${index + 1}: ${line.trim()}`);
      });
      
      // Remove all lines containing {previousApprover}
      const cleanedBody = bodyLines
        .filter(line => !line.includes('{previousApprover}'))
        .join('\n');
        
      // Update the template
      const updateResult = await sql`
        UPDATE notification_templates 
        SET body = ${cleanedBody}
        WHERE name = ${template.name}
      `;
      
      console.log(`  ✅ Updated ${template.name} - removed ${problemLines.length} line(s)`);
    }

    // Final verification
    console.log('\n🔍 Final verification...');
    const remainingIssues = await sql`
      SELECT name, 
             CASE 
               WHEN body LIKE '%{previousApprover}%' THEN 'YES' 
               ELSE 'NO' 
             END as has_in_body,
             CASE 
               WHEN 'previousApprover' = ANY(variables_available) THEN 'YES'
               ELSE 'NO'
             END as has_in_variables
      FROM notification_templates 
      WHERE body LIKE '%{previousApprover}%' OR 'previousApprover' = ANY(variables_available)
      ORDER BY name
    `;

    if (remainingIssues.length > 0) {
      console.log('❌ Still have issues:');
      remainingIssues.forEach(template => {
        console.log(`  - ${template.name}: Body=${template.has_in_body} Variables=${template.has_in_variables}`);
      });
    } else {
      console.log('✅ Perfect! All previousApprover references have been completely removed');
    }

    console.log('\n🎉 Final cleanup completed!');

  } catch (error) {
    console.error('❌ Error during final cleanup:', error);
    process.exit(1);
  } finally {
    await sql.end();
    console.log('🔌 Database connection closed');
  }
}

// Run the cleanup
if (require.main === module) {
  require('dotenv').config();
  finalCleanupPreviousApprover()
    .then(() => {
      console.log('✅ Final cleanup completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Final cleanup failed:', error);
      process.exit(1);
    });
}

module.exports = { finalCleanupPreviousApprover };