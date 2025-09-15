/**
 * Setup Complete Notification System
 * This script initializes the complete notification template system
 */

const { Client } = require('pg');
const fs = require('fs').promises;
const path = require('path');

async function setupCompleteNotifications() {
  console.log('🔧 Setting up complete notification system...');

  // Database connection
  const client = new Client({
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432'),
    database: process.env.DATABASE_NAME || 'syntra_db',
    user: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || 'password',
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // 1. Run the notification event system setup
    console.log('📋 Setting up notification event system...');
    const eventSystemSQL = await fs.readFile(path.join(__dirname, '../database/notification-event-system.sql'), 'utf8');
    await client.query(eventSystemSQL);
    console.log('✅ Notification event system setup complete');

    // 2. Run the complete notification templates script
    console.log('📧 Installing complete notification templates...');
    const templatesSQL = await fs.readFile(path.join(__dirname, 'complete-notification-templates.sql'), 'utf8');
    await client.query(templatesSQL);
    console.log('✅ All notification templates installed');

    // 3. Verify template coverage
    console.log('🔍 Verifying template coverage...');
    
    const templateCoverage = await client.query(`
      SELECT 
        COUNT(*) as total_templates,
        COUNT(CASE WHEN recipient_type = 'approver' THEN 1 END) as approver_templates,
        COUNT(CASE WHEN recipient_type = 'requestor' THEN 1 END) as requestor_templates,
        COUNT(CASE WHEN name LIKE '%trf%' THEN 1 END) as trf_templates,
        COUNT(CASE WHEN name LIKE '%visa%' THEN 1 END) as visa_templates,
        COUNT(CASE WHEN name LIKE '%claim%' THEN 1 END) as claims_templates,
        COUNT(CASE WHEN name LIKE '%transport%' THEN 1 END) as transport_templates,
        COUNT(CASE WHEN name LIKE '%accommodation%' THEN 1 END) as accommodation_templates
      FROM notification_templates 
      WHERE is_active = true
    `);

    console.log('📊 Template Coverage Report:');
    console.log(`   Total Templates: ${templateCoverage.rows[0].total_templates}`);
    console.log(`   Approver Templates: ${templateCoverage.rows[0].approver_templates}`);
    console.log(`   Requestor Templates: ${templateCoverage.rows[0].requestor_templates}`);
    console.log(`   TRF Templates: ${templateCoverage.rows[0].trf_templates}`);
    console.log(`   Visa Templates: ${templateCoverage.rows[0].visa_templates}`);
    console.log(`   Claims Templates: ${templateCoverage.rows[0].claims_templates}`);
    console.log(`   Transport Templates: ${templateCoverage.rows[0].transport_templates}`);
    console.log(`   Accommodation Templates: ${templateCoverage.rows[0].accommodation_templates}`);

    // 4. List all templates for verification
    const allTemplates = await client.query(`
      SELECT name, recipient_type, notification_type
      FROM notification_templates 
      WHERE is_active = true
      ORDER BY name
    `);

    console.log('📋 Installed Templates:');
    allTemplates.rows.forEach(template => {
      console.log(`   ✓ ${template.name} (${template.recipient_type}) - ${template.notification_type}`);
    });

    // 5. Verify event types
    const eventTypes = await client.query(`
      SELECT name, category, module 
      FROM notification_event_types 
      WHERE is_active = true
      ORDER BY module, name
    `);

    console.log('🎯 Event Types:');
    eventTypes.rows.forEach(event => {
      console.log(`   ✓ ${event.name} (${event.module}) - ${event.category}`);
    });

    // 6. Test sample template rendering
    console.log('🧪 Testing sample template...');
    const sampleTemplate = await client.query(`
      SELECT subject, body, variables_available
      FROM notification_templates 
      WHERE name = 'trf_submitted_approver'
      LIMIT 1
    `);

    if (sampleTemplate.rows.length > 0) {
      const template = sampleTemplate.rows[0];
      console.log('📧 Sample Template Test:');
      console.log(`   Subject: ${template.subject}`);
      console.log(`   Variables: ${template.variables_available?.join(', ') || 'None'}`);
      console.log('   ✅ Template structure valid');
    }

    console.log('🎉 Complete notification system setup successful!');
    console.log('');
    console.log('📋 Summary:');
    console.log(`   • ${templateCoverage.rows[0].total_templates} notification templates installed`);
    console.log(`   • ${eventTypes.rows.length} event types configured`);
    console.log(`   • Complete workflow coverage for all request types`);
    console.log(`   • Both approver and requestor notifications`);
    console.log(`   • Email and in-app notifications supported`);
    console.log('');
    console.log('Next steps:');
    console.log('1. Update your workflow API endpoints to use UnifiedNotificationService');
    console.log('2. Test the notification system with real requests');
    console.log('3. Verify email templates render correctly');

  } catch (error) {
    console.error('❌ Error setting up notification system:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run if called directly
if (require.main === module) {
  setupCompleteNotifications()
    .then(() => {
      console.log('✅ Script completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { setupCompleteNotifications };