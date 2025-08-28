import { NextRequest, NextResponse } from 'next/server';
import { WorkflowEmailService } from '@/lib/workflow-email-service';

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
        // Test: Initial submission → Department Focal
        result = await WorkflowEmailService.sendSubmissionNotification({
          entityType,
          entityId,
          requestorName,
          requestorEmail,
          department
        });
        break;

      case 'department_focal_approval':
        // Test: Department Focal → Line Manager
        result = await WorkflowEmailService.sendStatusChangeNotification({
          entityType,
          entityId,
          requestorName,
          requestorEmail,
          fromStatus: 'Pending Department Focal',
          toStatus: 'Pending Line Manager',
          department,
          changedBy: 'Department Focal',
          comments: 'Approved by department focal'
        });
        break;

      case 'line_manager_approval':
        // Test: Line Manager → HOD
        result = await WorkflowEmailService.sendStatusChangeNotification({
          entityType,
          entityId,
          requestorName,
          requestorEmail,
          fromStatus: 'Pending Line Manager',
          toStatus: 'Pending HOD',
          department,
          changedBy: 'Line Manager',
          comments: 'Approved by line manager'
        });
        break;

      case 'hod_approval':
        // Test: HOD → Processing
        result = await WorkflowEmailService.sendStatusChangeNotification({
          entityType,
          entityId,
          requestorName,
          requestorEmail,
          fromStatus: 'Pending HOD',
          toStatus: 'Approved',
          department,
          changedBy: 'HOD',
          comments: 'Final approval by HOD'
        });
        break;

      case 'processing':
        // Test: Processing notification
        result = await WorkflowEmailService.sendProcessingNotification({
          entityType,
          entityId,
          requestorName,
          requestorEmail,
          processingAction: 'Flight booking initiated',
          processorName: 'Travel Admin',
          department,
          details: 'Flight booking in progress'
        });
        break;

      case 'completion':
        // Test: Final completion
        result = await WorkflowEmailService.sendCompletionNotification({
          entityType,
          entityId,
          requestorName,
          requestorEmail,
          department,
          completionDetails: 'All bookings completed successfully',
          completedBy: 'Travel Admin'
        });
        break;

      case 'complete_workflow':
        // Test: Complete end-to-end workflow
        console.log(`🔄 WORKFLOW_TEST: Running complete workflow simulation...`);
        
        // Stage 1: Submission
        await WorkflowEmailService.sendSubmissionNotification({
          entityType, entityId, requestorName, requestorEmail, department
        });
        
        // Wait briefly between stages (optional)
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Stage 2: Department Focal Approval
        await WorkflowEmailService.sendStatusChangeNotification({
          entityType, entityId, requestorName, requestorEmail,
          fromStatus: 'Pending Department Focal', toStatus: 'Pending Line Manager',
          department, changedBy: 'Department Focal'
        });
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Stage 3: Line Manager Approval
        await WorkflowEmailService.sendStatusChangeNotification({
          entityType, entityId, requestorName, requestorEmail,
          fromStatus: 'Pending Line Manager', toStatus: 'Pending HOD',
          department, changedBy: 'Line Manager'
        });
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Stage 4: HOD Approval
        await WorkflowEmailService.sendStatusChangeNotification({
          entityType, entityId, requestorName, requestorEmail,
          fromStatus: 'Pending HOD', toStatus: 'Approved',
          department, changedBy: 'HOD'
        });
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Stage 5: Processing
        await WorkflowEmailService.sendProcessingNotification({
          entityType, entityId, requestorName, requestorEmail,
          processingAction: 'Processing started', processorName: 'Processing Admin',
          department
        });
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Stage 6: Completion
        await WorkflowEmailService.sendCompletionNotification({
          entityType, entityId, requestorName, requestorEmail,
          department, completedBy: 'Processing Admin'
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