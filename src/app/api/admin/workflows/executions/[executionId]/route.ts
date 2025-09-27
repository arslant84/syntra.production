import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { WorkflowEngine } from '@/lib/workflow-engine';

// POST /api/admin/workflows/executions/[executionId] - Process step action
export async function POST(
  request: NextRequest,
  { params }: { params: { executionId: string } }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { executionId } = params;
    const body = await request.json();
    const { stepNumber, action, comments, delegatedTo } = body;

    if (!stepNumber || !action) {
      return NextResponse.json(
        { error: 'Missing required fields: stepNumber, action' },
        { status: 400 }
      );
    }

    if (!['approve', 'reject', 'delegate'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be approve, reject, or delegate' },
        { status: 400 }
      );
    }

    if (action === 'delegate' && !delegatedTo) {
      return NextResponse.json(
        { error: 'delegatedTo is required when action is delegate' },
        { status: 400 }
      );
    }

    const actionData = {
      userId: session.user.id,
      comments,
      delegatedTo
    };

    // Process the step action
    await WorkflowEngine.processStepAction(executionId, stepNumber, action, actionData);

    return NextResponse.json({
      success: true,
      message: `Step ${action}${action === 'approve' ? 'd' : action === 'reject' ? 'ed' : 'd'} successfully`
    });

  } catch (error: any) {
    console.error('Error processing step action:', error);
    
    if (error.message.includes('not authorized') || error.message.includes('permission')) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Unauthorized to perform this action',
          message: error.message 
        },
        { status: 403 }
      );
    }

    if (error.message.includes('not found')) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Workflow execution or step not found',
          message: error.message 
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process step action',
        message: error.message
      },
      { status: 500 }
    );
  }
}

// GET /api/admin/workflows/executions/[executionId] - Get execution details
export async function GET(
  request: NextRequest,
  { params }: { params: { executionId: string } }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { executionId } = params;

    // This would require implementing getExecutionById in the WorkflowEngine
    // For now, return a placeholder response
    return NextResponse.json({
      success: true,
      execution: {
        id: executionId,
        status: 'active',
        message: 'Execution details endpoint - to be implemented'
      }
    });

  } catch (error: any) {
    console.error('Error fetching execution details:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch execution details',
        message: error.message
      },
      { status: 500 }
    );
  }
}