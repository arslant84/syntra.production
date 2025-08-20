// Test API endpoint to create a notification for testing purposes
import { NextRequest, NextResponse } from 'next/server';
import { NotificationService } from '@/lib/notification-service';

export async function GET(request: NextRequest) {
  try {
    // Create a test notification for the HOD user
    const notificationId = await NotificationService.createNotification({
      userId: '9a07790e-dd9c-445a-8361-784c29a2f079', // HOD user ID
      title: 'New Expense Claim Approval Required',
      message: 'Arslan Tekayev submitted Expense Claim e8633cc5-a5be-44d4-91ab-94e94cc27039 for your approval',
      type: 'approval_request',
      category: 'workflow_approval',
      priority: 'high',
      relatedEntityType: 'claim',
      relatedEntityId: 'e8633cc5-a5be-44d4-91ab-94e94cc27039',
      actionRequired: true,
      actionUrl: '/claims/view/e8633cc5-a5be-44d4-91ab-94e94cc27039'
    });

    return NextResponse.json({ 
      success: true,
      message: 'Test notification created successfully',
      notificationId
    });

  } catch (error) {
    console.error('Error creating test notification:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Failed to create test notification',
      details: error.message 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Create a test notification for the HOD user
    const notificationId = await NotificationService.createNotification({
      userId: '9a07790e-dd9c-445a-8361-784c29a2f079', // HOD user ID
      title: 'New Expense Claim Approval Required',
      message: 'Arslan Tekayev submitted Expense Claim e8633cc5-a5be-44d4-91ab-94e94cc27039 for your approval',
      type: 'approval_request',
      category: 'workflow_approval',
      priority: 'high',
      relatedEntityType: 'claim',
      relatedEntityId: 'e8633cc5-a5be-44d4-91ab-94e94cc27039',
      actionRequired: true,
      actionUrl: '/claims/view/e8633cc5-a5be-44d4-91ab-94e94cc27039'
    });

    return NextResponse.json({ 
      success: true,
      message: 'Test notification created successfully',
      notificationId
    });

  } catch (error) {
    console.error('Error creating test notification:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Failed to create test notification',
      details: error.message 
    }, { status: 500 });
  }
}