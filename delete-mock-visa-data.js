const { Client } = require('pg');
require('dotenv').config();

async function deleteMockVisaData() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    
    console.log('Deleting mock visa data...');
    
    // First delete related records in visa_approval_steps and visa_documents
    const deleteApprovalStepsResult = await client.query(`
      DELETE FROM visa_approval_steps 
      WHERE visa_application_id IN (
        SELECT id FROM visa_applications 
        WHERE requestor_name IN ('Test Requestor', 'System Admin')
      )
    `);
    console.log(`Deleted ${deleteApprovalStepsResult.rowCount} visa approval steps`);
    
    const deleteDocumentsResult = await client.query(`
      DELETE FROM visa_documents 
      WHERE visa_application_id IN (
        SELECT id FROM visa_applications 
        WHERE requestor_name IN ('Test Requestor', 'System Admin')
      )
    `);
    console.log(`Deleted ${deleteDocumentsResult.rowCount} visa documents`);
    
    // Then delete the visa applications
    const deleteVisaResult = await client.query(`
      DELETE FROM visa_applications 
      WHERE requestor_name IN ('Test Requestor', 'System Admin')
    `);
    console.log(`Deleted ${deleteVisaResult.rowCount} mock visa applications`);
    
    console.log('Mock visa data deletion completed successfully.');
  } catch (err) {
    console.error('Error deleting mock visa data:', err);
  } finally {
    await client.end();
    console.log('Database connection closed.');
  }
}

deleteMockVisaData();
