#!/usr/bin/env node

/**
 * Remove previousApprover field from notification templates
 * This script removes the unnecessary previousApprover field from email templates
 */

const postgres = require('postgres');

async function removePreviousApproverField() {
  console.log('🔧 Starting removal of previousApprover field from notification templates...');
  
  const sql = postgres({
    host: process.env.DATABASE_HOST || 'localhost',
    database: process.env.DATABASE_NAME || 'syntra',
    username: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD,
    ssl: process.env.NODE_ENV === 'production'
  });

  try {
    console.log('✅ Connected to database');

    // First, let's see what templates currently have previousApprover
    console.log('🔍 Checking current templates with previousApprover...');
    const currentTemplates = await sql`
      SELECT name, variables_available, 
             CASE 
               WHEN body LIKE '%{previousApprover}%' THEN 'YES' 
               ELSE 'NO' 
             END as has_previous_approver
      FROM notification_templates 
      WHERE body LIKE '%{previousApprover}%' OR 'previousApprover' = ANY(variables_available)
      ORDER BY name
    `;
    
    console.log(`📋 Found ${currentTemplates.length} templates with previousApprover field:`);
    currentTemplates.forEach(template => {
      console.log(`  - ${template.name}: ${template.has_previous_approver}`);
    });

    // Update templates to remove previousApprover references
    console.log('🔄 Removing previousApprover from template bodies...');
    
    // Remove the HTML line containing previousApprover
    const bodyUpdateResult = await sql`
      UPDATE notification_templates 
      SET body = REGEXP_REPLACE(body, '<p><strong>Previous Approver:</strong> \{previousApprover\}</p>\s*', '', 'g')
      WHERE body LIKE '%{previousApprover}%'
    `;
    console.log(`✅ Updated ${bodyUpdateResult.count} template bodies`);

    // Remove previousApprover from variables_available arrays
    console.log('🔄 Removing previousApprover from variables_available arrays...');
    const variablesUpdateResult = await sql`
      UPDATE notification_templates 
      SET variables_available = ARRAY_REMOVE(variables_available, 'previousApprover')
      WHERE 'previousApprover' = ANY(variables_available)
    `;
    console.log(`✅ Updated ${variablesUpdateResult.count} template variable arrays`);

    // Verify the updates
    console.log('🔍 Verifying updates...');
    const verification = await sql`
      SELECT name, subject, 
             CASE 
               WHEN LENGTH(body) > 200 THEN SUBSTRING(body, 1, 200) || '...'
               ELSE body 
             END as body_preview,
             variables_available,
             CASE 
               WHEN body LIKE '%{previousApprover}%' THEN 'YES' 
               ELSE 'NO' 
             END as still_has_previous_approver
      FROM notification_templates 
      WHERE name IN ('trf_focal_approved_to_manager', 'visa_focal_approved_to_manager', 'trf_manager_approved_to_hod')
         OR 'previousApprover' = ANY(variables_available)
         OR body LIKE '%{previousApprover}%'
      ORDER BY name
    `;

    if (verification.length > 0) {
      console.log('⚠️ Templates that still have previousApprover references:');
      verification.forEach(row => {
        const hasInVariables = row.variables_available?.includes('previousApprover');
        const hasInBody = row.still_has_previous_approver === 'YES';
        console.log(`  - ${row.name}: Variables=${hasInVariables ? '❌' : '✅'} Body=${hasInBody ? '❌' : '✅'}`);
      });
    } else {
      console.log('✅ All templates updated successfully - no previousApprover fields remain');
    }

    console.log('🎉 Successfully removed previousApprover field from notification templates!');

  } catch (error) {
    console.error('❌ Error updating notification templates:', error);
    process.exit(1);
  } finally {
    await sql.end();
    console.log('🔌 Database connection closed');
  }
}

// Run the migration
if (require.main === module) {
  require('dotenv').config();
  removePreviousApproverField()
    .then(() => {
      console.log('✅ Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { removePreviousApproverField };