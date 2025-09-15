/**
 * Check transport email templates in database to see what variable names are used for purpose
 */

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
    console.log('Connected to database');

    // Check notification templates that might be used for transport
    console.log('\n--- Transport-related email templates ---');
    
    const transportTemplates = await client.query(`
      SELECT 
        name,
        subject,
        body,
        variables_available
      FROM notification_templates 
      WHERE (name LIKE '%transport%' 
        OR body LIKE '%transport%' 
        OR body LIKE '%purpose%'
        OR body LIKE '%entityTitle%'
        OR body LIKE '%transportPurpose%')
        AND is_active = true
      ORDER BY name
    `);

    if (transportTemplates.rows.length > 0) {
      console.log(`Found ${transportTemplates.rows.length} transport-related templates:`);
      
      transportTemplates.rows.forEach((template, index) => {
        console.log(`\n--- Template ${index + 1}: ${template.name} ---`);
        console.log(`Subject: ${template.subject}`);
        console.log(`Body (first 200 chars): ${template.body?.substring(0, 200)}...`);
        console.log(`Variables available: ${template.variables_available}`);
        
        // Look for purpose-related variables in the body
        const purposeMatches = template.body?.match(/\{\{[^}]*purpose[^}]*\}\}/gi);
        if (purposeMatches) {
          console.log(`Purpose variables found: ${purposeMatches.join(', ')}`);
        }
        
        const titleMatches = template.body?.match(/\{\{[^}]*title[^}]*\}\}/gi);
        if (titleMatches) {
          console.log(`Title variables found: ${titleMatches.join(', ')}`);
        }
      });
    } else {
      console.log('No transport-related templates found');
    }

    // Also check for any templates that use purpose variables
    console.log('\n--- Templates using purpose variables ---');
    
    const purposeTemplates = await client.query(`
      SELECT 
        name,
        subject,
        body
      FROM notification_templates 
      WHERE body LIKE '%{{%purpose%}}%'
        OR body LIKE '%{{%Purpose%}}%'
        OR body LIKE '%{purpose}%'
        AND is_active = true
      ORDER BY name
    `);

    if (purposeTemplates.rows.length > 0) {
      purposeTemplates.rows.forEach(template => {
        console.log(`\n${template.name}:`);
        console.log(`Body: ${template.body}`);
      });
    } else {
      console.log('No templates found using purpose variables');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
    console.log('\nDatabase connection closed');
  }
}

main().catch(console.error);