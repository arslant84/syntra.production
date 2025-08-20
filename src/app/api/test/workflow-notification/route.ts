// Test API endpoint for workflow notification system
import { NextRequest, NextResponse } from 'next/server';
import { WorkflowEmailService } from '@/lib/workflow-email-service';
import { NotificationService } from '@/lib/notification-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      testType,
      entityType = 'transport',
      entityId = 'TEST-001',
      requestorName = 'John Doe',
      requestorEmail = 'test@example.com',
      department = 'IT',
      status = 'Pending Department Focal'
    } = body;

    let result;

    switch (testType) {
      case 'submission':
        // Test submission notification
        console.log('Testing submission notification with params:', {
          entityType,
          entityId,
          requestorName,
          requestorEmail,
          department
        });
        
        result = await WorkflowEmailService.sendSubmissionNotification({
          entityType,
          entityId,
          requestorName,
          requestorEmail,
          department
        });
        
        console.log('Submission notification completed');
        break;

      case 'approval':
        // Test approval notification
        result = await WorkflowEmailService.sendApprovalNotification({
          entityType,
          entityId,
          requestorName,
          requestorEmail,
          newStatus: 'Approved',
          approverName: 'Manager Smith',
          comments: 'Approved for business travel'
        });
        break;

      case 'rejection':
        // Test rejection notification
        result = await WorkflowEmailService.sendApprovalNotification({
          entityType,
          entityId,
          requestorName,
          requestorEmail,
          newStatus: 'Rejected',
          approverName: 'Manager Smith',
          comments: 'Insufficient justification provided'
        });
        break;

      default:
        return NextResponse.json({ error: 'Invalid test type' }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true, 
      message: `${testType} notification sent successfully`,
      testData: {
        testType,
        entityType,
        entityId,
        requestorName,
        requestorEmail,
        department,
        status
      }
    });

  } catch (error) {
    console.error('Test workflow notification error:', error);
    return NextResponse.json({ 
      error: 'Failed to send test notification',
      details: error.message 
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Workflow Notification Test Endpoint',
    usage: 'POST with body: { testType: "submission|approval|rejection", entityType?: string, entityId?: string, requestorName?: string, requestorEmail?: string, department?: string }',
    examples: [
      {
        testType: 'submission',
        description: 'Test submission notification to approvers'
      },
      {
        testType: 'approval', 
        description: 'Test approval notification to requestor'
      },
      {
        testType: 'rejection',
        description: 'Test rejection notification to requestor'
      }
    ]
  });
}