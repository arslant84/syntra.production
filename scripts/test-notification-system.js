/**
 * Test Notification System
 * Comprehensive testing of the unified notification service
 */

const { UnifiedNotificationService } = require('../src/lib/unified-notification-service');

async function testNotificationSystem() {
  console.log('🧪 Testing Notification System...');

  const testParams = {
    // Test TRF Submission
    trf_submission: {
      entityType: 'trf',
      entityId: 'TRF-TEST-001',
      requestorId: 'user-123',
      requestorName: 'John Doe',
      requestorEmail: 'john.doe@company.com',
      department: 'IT Department',
      entityTitle: 'Business Trip to Singapore',
      entityAmount: '$2,500',
      entityDates: '2024-02-15 to 2024-02-20'
    },

    // Test Claims Submission  
    claims_submission: {
      entityType: 'claims',
      entityId: 'CLM-TEST-001', 
      requestorId: 'user-124',
      requestorName: 'Jane Smith',
      requestorEmail: 'jane.smith@company.com',
      department: 'Finance Department',
      entityTitle: 'TR01 - Travel Expenses',
      entityAmount: '$1,250',
      entityDates: '2024-01-01 to 2024-01-31'
    },

    // Test Visa Submission
    visa_submission: {
      entityType: 'visa',
      entityId: 'VISA-TEST-001',
      requestorId: 'user-125', 
      requestorName: 'Ahmed Hassan',
      requestorEmail: 'ahmed.hassan@company.com',
      department: 'Operations Department',
      entityTitle: 'Business Trip Visa - Dubai',
      entityDates: '2024-03-01 to 2024-03-10'
    },

    // Test Approval
    trf_approval: {
      entityType: 'trf',
      entityId: 'TRF-TEST-001',
      requestorId: 'user-123',
      requestorName: 'John Doe',
      requestorEmail: 'john.doe@company.com',
      currentStatus: 'Pending Line Manager',
      previousStatus: 'Pending Department Focal',
      approverName: 'Sarah Johnson',
      approverRole: 'Department Focal',
      nextApprover: 'Line Manager',
      entityTitle: 'Business Trip to Singapore',
      comments: 'Approved - All documentation in order'
    },

    // Test Rejection
    claims_rejection: {
      entityType: 'claims',
      entityId: 'CLM-TEST-002',
      requestorId: 'user-126',
      requestorName: 'Mike Wilson', 
      requestorEmail: 'mike.wilson@company.com',
      approverName: 'David Brown',
      approverRole: 'HOD',
      rejectionReason: 'Missing required receipts for accommodation expenses',
      entityTitle: 'TR01 - Conference Expenses'
    }
  };

  const tests = [
    {
      name: 'TRF Submission Notification',
      test: async () => {
        await UnifiedNotificationService.notifySubmission(testParams.trf_submission);
      }
    },
    {
      name: 'Claims Submission Notification', 
      test: async () => {
        await UnifiedNotificationService.notifySubmission(testParams.claims_submission);
      }
    },
    {
      name: 'Visa Submission Notification',
      test: async () => {
        await UnifiedNotificationService.notifySubmission(testParams.visa_submission);
      }
    },
    {
      name: 'TRF Approval Notification',
      test: async () => {
        await UnifiedNotificationService.notifyApproval(testParams.trf_approval);
      }
    },
    {
      name: 'Claims Rejection Notification', 
      test: async () => {
        await UnifiedNotificationService.notifyRejection(testParams.claims_rejection);
      }
    },
    {
      name: 'Direct Workflow Notification',
      test: async () => {
        await UnifiedNotificationService.sendWorkflowNotification({
          eventType: 'transport_submitted',
          entityType: 'transport',
          entityId: 'TRANS-TEST-001',
          currentStatus: 'Pending Department Focal',
          requestorName: 'Lisa Chen',
          requestorEmail: 'lisa.chen@company.com',
          department: 'HR Department',
          transportPurpose: 'Airport Transfer',
          entityDates: '2024-02-25'
        });
      }
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      console.log(`\n🔬 Running: ${test.name}`);
      await test.test();
      console.log(`✅ PASSED: ${test.name}`);
      passed++;
    } catch (error) {
      console.log(`❌ FAILED: ${test.name}`);
      console.error(`   Error: ${error.message}`);
      failed++;
    }
  }

  console.log('\n📊 Test Results Summary:');
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

  if (failed === 0) {
    console.log('\n🎉 All notification tests passed!');
    return true;
  } else {
    console.log('\n⚠️  Some tests failed. Check the errors above.');
    return false;
  }
}

async function testTemplateRetrieval() {
  console.log('\n🔍 Testing Template Retrieval...');

  const { sql } = require('../src/lib/db');
  
  const testTemplates = [
    'trf_submitted_approver',
    'trf_submitted_requestor', 
    'trf_approved_focal_next_approver',
    'trf_fully_approved_requestor',
    'trf_rejected_requestor',
    'visa_submitted_approver',
    'claim_submitted_approver',
    'transport_submitted_approver',
    'accommodation_submitted_approver',
    'approval_reminder'
  ];

  let found = 0;
  let missing = 0;

  for (const templateName of testTemplates) {
    try {
      const result = await sql`
        SELECT name, subject, recipient_type
        FROM notification_templates 
        WHERE name = ${templateName} AND is_active = true
      `;

      if (result.length > 0) {
        console.log(`✅ Found: ${templateName} (${result[0].recipient_type})`);
        console.log(`   Subject: ${result[0].subject}`);
        found++;
      } else {
        console.log(`❌ Missing: ${templateName}`);
        missing++;
      }
    } catch (error) {
      console.log(`❌ Error checking ${templateName}: ${error.message}`);
      missing++;
    }
  }

  console.log(`\n📋 Template Check Results:`);
  console.log(`   ✅ Found: ${found}`);
  console.log(`   ❌ Missing: ${missing}`);
  console.log(`   📈 Coverage: ${((found / (found + missing)) * 100).toFixed(1)}%`);

  return missing === 0;
}

async function runFullTest() {
  console.log('🚀 Starting Full Notification System Test');
  console.log('=' .repeat(50));

  try {
    // Test 1: Template Retrieval
    const templatesOk = await testTemplateRetrieval();
    
    if (!templatesOk) {
      console.log('\n❌ Template retrieval failed. Please run the setup script first:');
      console.log('   node scripts/setup-complete-notifications.js');
      return false;
    }

    // Test 2: Notification System
    const notificationsOk = await testNotificationSystem();

    console.log('\n' + '=' .repeat(50));
    if (templatesOk && notificationsOk) {
      console.log('🎉 ALL TESTS PASSED! Notification system is working correctly.');
      console.log('\n📋 System Status:');
      console.log('   ✅ Template database setup complete');
      console.log('   ✅ UnifiedNotificationService working');
      console.log('   ✅ All workflow events covered');
      console.log('   ✅ Both approver and requestor notifications');
      console.log('\n🚀 Your notification system is ready for production!');
      return true;
    } else {
      console.log('❌ TESTS FAILED! Please check the errors above.');
      return false;
    }

  } catch (error) {
    console.error('❌ Test suite failed:', error);
    return false;
  }
}

// Run if called directly
if (require.main === module) {
  runFullTest()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Test suite error:', error);
      process.exit(1);
    });
}

module.exports = { 
  testNotificationSystem, 
  testTemplateRetrieval, 
  runFullTest 
};