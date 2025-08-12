// API endpoints for workflow instance management (approvals, processing)
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import {
  startWorkflowInstance,
  getWorkflowInstancesForUser,
  processWorkflowStep
} from '@/lib/workflow-service';

// Validation schemas
const startWorkflowSchema = z.object({
  templateId: z.string().uuid('Invalid template ID'),
  entityId: z.string().min(1, 'Entity ID is required'),
  entityType: z.string().min(1, 'Entity type is required'),
  initiatedBy: z.string().uuid('Invalid user ID').optional(),
  metadata: z.any().optional()
});

const processStepSchema = z.object({
  executionId: z.string().uuid('Invalid execution ID'),
  action: z.enum(['approve', 'reject']),
  actionTakenBy: z.string().uuid('Invalid user ID').optional(),
  comments: z.string().optional()
});

// GET /api/workflows/instances - Get workflow instances for current user
export async function GET(request: NextRequest) {
  try {
    // TEMPORARILY DISABLED: Authentication for testing
    console.log('Workflow Instances: Authentication bypassed for testing');
    
    const url = new URL(request.url);
    const userRole = url.searchParams.get('role') || 'Department Focal'; // Default for testing
    const status = url.searchParams.get('status') || undefined;
    
    console.log(`Fetching workflow instances for role: ${userRole}, status: ${status}`);
    
    const instances = await getWorkflowInstancesForUser(userRole, status);
    
    return NextResponse.json({
      success: true,
      data: instances,
      count: instances.length
    });
  } catch (error: any) {
    console.error('Error fetching workflow instances:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch workflow instances',
        message: error.message
      },
      { status: 500 }
    );
  }
}

// POST /api/workflows/instances - Start new workflow instance
export async function POST(request: NextRequest) {
  try {
    // TEMPORARILY DISABLED: Authentication for testing
    console.log('Start Workflow: Authentication bypassed for testing');
    
    const body = await request.json();
    console.log('Starting workflow with data:', body);
    
    // Validate input
    const validationResult = startWorkflowSchema.safeParse(body);
    if (!validationResult.success) {
      console.error('Validation error:', validationResult.error.flatten());
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: validationResult.error.flatten()
        },
        { status: 400 }
      );
    }
    
    const { templateId, entityId, entityType, initiatedBy, metadata } = validationResult.data;
    
    // Start workflow instance
    const instance = await startWorkflowInstance(
      templateId,
      entityId,
      entityType,
      initiatedBy || 'system', // Default for testing
      metadata
    );
    
    console.log('Started workflow instance:', instance.id);
    
    return NextResponse.json({
      success: true,
      data: instance,
      message: 'Workflow started successfully'
    }, { status: 201 });
    
  } catch (error: any) {
    console.error('Error starting workflow instance:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to start workflow instance',
        message: error.message
      },
      { status: 500 }
    );
  }
}

// PUT /api/workflows/instances - Process workflow step (approve/reject)
export async function PUT(request: NextRequest) {
  try {
    // TEMPORARILY DISABLED: Authentication for testing
    console.log('Process Workflow Step: Authentication bypassed for testing');
    
    const body = await request.json();
    console.log('Processing workflow step with data:', body);
    
    // Validate input
    const validationResult = processStepSchema.safeParse(body);
    if (!validationResult.success) {
      console.error('Validation error:', validationResult.error.flatten());
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: validationResult.error.flatten()
        },
        { status: 400 }
      );
    }
    
    const { executionId, action, actionTakenBy, comments } = validationResult.data;
    
    // Process workflow step
    await processWorkflowStep(
      executionId,
      action,
      actionTakenBy || 'test-user', // Default for testing
      comments
    );
    
    console.log(`Workflow step ${action}ed:`, executionId);
    
    return NextResponse.json({
      success: true,
      message: `Workflow step ${action}ed successfully`
    });
    
  } catch (error: any) {
    console.error('Error processing workflow step:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process workflow step',
        message: error.message
      },
      { status: 500 }
    );
  }
}