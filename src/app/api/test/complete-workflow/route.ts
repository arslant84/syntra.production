import { NextRequest, NextResponse } from 'next/server';
import { UnifiedNotificationService } from '@/lib/unified-notification-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      testType, 
      entityType = 'trf',
      entityId = 'TEST_001',
      requestorName = 'John Doe',
      requestorEmail = 'john.doe@test.com',
      department = 'IT'
    } = body;

    console.log(`🧪 WORKFLOW_TEST: Starting ${testType} test for ${entityType} ${entityId}`);

    let result;
    
    switch (testType) {
      case 'submission':
        // Test: Initial submission → Department Focal ONLY
        console.log(`🧪 CORRECTED_WORKFLOW_TEST: Testing submission routing`);
        console.log(`🧪 Expected: TO = Department Focal (${department}), CC = ${requestorEmail}`);
        result = await UnifiedNotificationService.notifySubmission({
          entityType,
          entityId,
          requestorId: 'test-user-id',
          requestorName,
          requestorEmail,
          department,
          entityTitle: `Test ${entityType} - ${entityId}`
        });
        break;

      case 'department_focal_approval':
        // Test: Department Focal → Line Manager
        result = await UnifiedNotificationService.notifyApproval({
          entityType,
          entityId,
          requestorId: 'test-user-id',
          requestorName,
          requestorEmail,
          currentStatus: 'Pending Line Manager',
          previousStatus: 'Pending Department Focal',
          approverName: 'Department Focal',
          approverRole: 'Department Focal',
          entityTitle: `Test ${entityType} - ${entityId}`,
          comments: 'Approved by department focal'
        });
        break;

      case 'line_manager_approval':
        // Test: Line Manager → HOD
        result = await UnifiedNotificationService.notifyApproval({
          entityType,
          entityId,
          requestorId: 'test-user-id',
          requestorName,
          requestorEmail,
          currentStatus: 'Pending HOD',
          previousStatus: 'Pending Line Manager',
          approverName: 'Line Manager',
          approverRole: 'Line Manager',
          entityTitle: `Test ${entityType} - ${entityId}`,
          comments: 'Approved by line manager'
        });
        break;

      case 'hod_approval':
        // Test: HOD → Processing
        result = await UnifiedNotificationService.notifyApproval({
          entityType,
          entityId,
          requestorId: 'test-user-id',
          requestorName,
          requestorEmail,
          currentStatus: 'Approved',
          previousStatus: 'Pending HOD',
          approverName: 'HOD',
          approverRole: 'HOD',
          entityTitle: `Test ${entityType} - ${entityId}`,
          comments: 'Final approval by HOD'
        });
        break;

      case 'processing':
        // Test: Processing notification
        result = await UnifiedNotificationService.notifyStatusUpdate({
          entityType,
          entityId,
          requestorId: 'test-user-id',
          requestorName,
          requestorEmail,
          newStatus: 'Processing',
          previousStatus: 'Approved',
          updateReason: 'Flight booking initiated - Flight booking in progress',
          entityTitle: `Test ${entityType} - ${entityId}`
        });
        break;

      case 'completion':
        // Test: Final completion
        result = await UnifiedNotificationService.notifyAdminCompletion({
          entityType,
          entityId,
          requestorId: 'test-user-id',
          requestorName,
          requestorEmail,
          adminName: 'Travel Admin',
          entityTitle: `Test ${entityType} - ${entityId}`,
          completionDetails: 'All bookings completed successfully'
        });
        break;

      case 'complete_workflow':
        // Test: Complete end-to-end workflow
        console.log(`🔄 WORKFLOW_TEST: Running complete workflow simulation...`);
        
        // Stage 1: Submission
        await UnifiedNotificationService.notifySubmission({
          entityType, entityId, requestorId: 'test-user-id', requestorName, requestorEmail, department,
          entityTitle: `Test ${entityType} - ${entityId}`
        });
        
        // Wait briefly between stages (optional)
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Stage 2: Department Focal Approval
        await UnifiedNotificationService.notifyApproval({
          entityType, entityId, requestorId: 'test-user-id', requestorName, requestorEmail,
          currentStatus: 'Pending Line Manager', previousStatus: 'Pending Department Focal',
          approverName: 'Department Focal', approverRole: 'Department Focal',
          entityTitle: `Test ${entityType} - ${entityId}`
        });
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Stage 3: Line Manager Approval
        await UnifiedNotificationService.notifyApproval({
          entityType, entityId, requestorId: 'test-user-id', requestorName, requestorEmail,
          currentStatus: 'Pending HOD', previousStatus: 'Pending Line Manager',
          approverName: 'Line Manager', approverRole: 'Line Manager',
          entityTitle: `Test ${entityType} - ${entityId}`
        });
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Stage 4: HOD Approval
        await UnifiedNotificationService.notifyApproval({
          entityType, entityId, requestorId: 'test-user-id', requestorName, requestorEmail,
          currentStatus: 'Approved', previousStatus: 'Pending HOD',
          approverName: 'HOD', approverRole: 'HOD',
          entityTitle: `Test ${entityType} - ${entityId}`
        });
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Stage 5: Processing
        await UnifiedNotificationService.notifyStatusUpdate({
          entityType, entityId, requestorId: 'test-user-id', requestorName, requestorEmail,
          newStatus: 'Processing', previousStatus: 'Approved',
          updateReason: 'Processing started by Processing Admin',
          entityTitle: `Test ${entityType} - ${entityId}`
        });
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Stage 6: Completion
        await UnifiedNotificationService.notifyAdminCompletion({
          entityType, entityId, requestorId: 'test-user-id', requestorName, requestorEmail,
          adminName: 'Processing Admin', entityTitle: `Test ${entityType} - ${entityId}`,
          completionDetails: 'Complete workflow simulation completed'
        });
        
        result = { message: 'Complete workflow simulation completed successfully' };
        break;

      default:
        return NextResponse.json({ error: 'Invalid test type' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `Workflow test "${testType}" completed successfully`,
      testType,
      entityType,
      entityId,
      requestorEmail,
      department,
      result,
      timestamp: new Date().toISOString(),
      expectedEmailFlow: {
        'submission': 'TO: Department Focal, CC: Requestor',
        'department_focal_approval': 'TO: Line Manager, CC: Requestor',
        'line_manager_approval': 'TO: HOD, CC: Requestor', 
        'hod_approval': 'TO: Processing Admin, CC: Requestor',
        'processing': 'TO: Requestor, CC: Processing Admin',
        'completion': 'TO: Requestor, CC: Processing Admin'
      }[testType] || 'Workflow notification sent'
    });

  } catch (error: any) {
    console.error('🚫 WORKFLOW_TEST: Test failed:', error);
    return NextResponse.json({
      error: 'Workflow test failed',
      details: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/test/complete-workflow',
    method: 'POST',
    description: 'Test complete workflow notification system',
    testTypes: [
      'submission',
      'department_focal_approval',
      'line_manager_approval', 
      'hod_approval',
      'processing',
      'completion',
      'complete_workflow'
    ],
    usage: {
      testType: 'submission|department_focal_approval|line_manager_approval|hod_approval|processing|completion|complete_workflow',
      entityType: 'trf|claim|visa|transport|accommodation',
      entityId: 'TEST_001',
      requestorName: 'John Doe',
      requestorEmail: 'john.doe@test.com',
      department: 'IT'
    },
    expectedWorkflow: {
      1: 'Submission → TO: Department Focal, CC: Requestor',
      2: 'Department Focal Approval → TO: Line Manager, CC: Requestor',
      3: 'Line Manager Approval → TO: HOD, CC: Requestor',
      4: 'HOD Approval → TO: Processing Admin, CC: Requestor',
      5: 'Processing → TO: Requestor + Processing Admin',
      6: 'Completion → TO: Requestor, CC: All stakeholders'
    }
  });
}