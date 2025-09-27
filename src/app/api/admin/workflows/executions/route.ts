import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { sql } from '@/lib/db';
import { WorkflowEngine } from '@/lib/workflow-engine';

// GET /api/admin/workflows/executions - Get workflow executions
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const requestId = searchParams.get('requestId');
    const requestType = searchParams.get('requestType');
    const status = searchParams.get('status');

    if (requestId && requestType) {
      // Get specific execution status
      const execution = await WorkflowEngine.getExecutionStatus(requestId, requestType);
      return NextResponse.json({ 
        success: true,
        execution 
      });
    }

    // For now, return empty array - could be extended to list all executions
    return NextResponse.json({ 
      success: true,
      executions: [] 
    });

  } catch (error: any) {
    console.error('Error fetching executions:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch executions',
        message: error.message 
      },
      { status: 500 }
    );
  }
}

// POST /api/admin/workflows/executions - Start new workflow execution
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { requestId, requestType, requestData, department } = body;

    if (!requestId || !requestType) {
      return NextResponse.json(
        { error: 'Missing required fields: requestId, requestType' },
        { status: 400 }
      );
    }

    // Get user role for context
    const userResult = await sql`
      SELECT u.role, r.name as role_name, u.department
      FROM users u 
      JOIN roles r ON u.role_id = r.id 
      WHERE u.id = ${session.user.id}
    `;

    if (userResult.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const context = {
      requestId,
      requestType,
      requestData: requestData || {},
      userId: session.user.id,
      userRole: userResult[0].role_name,
      department: department || userResult[0].department
    };

    // Start workflow execution
    const executionId = await WorkflowEngine.startWorkflow(context);

    return NextResponse.json({
      success: true,
      executionId,
      message: 'Workflow started successfully'
    }, { status: 201 });

  } catch (error: any) {
    console.error('Error starting workflow:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to start workflow',
        message: error.message
      },
      { status: 500 }
    );
  }
}