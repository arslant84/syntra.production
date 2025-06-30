// src/app/api/admin/settings/workflows/route.ts
import { NextResponse } from 'next/server';
import { 
  getAllWorkflowModules,
  createWorkflowStep,
  updateWorkflowStep,
  deleteWorkflowStep
} from '@/lib/system-settings-service';
import { hasPermission } from '@/lib/auth-service';
import { WorkflowStepFormValues } from '@/types/workflows';

// GET handler to fetch all workflow modules with their steps
export async function GET() {
  try {
    // Check if user has permission
    if (!await hasPermission('manage_workflows')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const workflowModules = await getAllWorkflowModules();
    return NextResponse.json(workflowModules);
  } catch (error) {
    console.error('Error fetching workflow modules:', error);
    return NextResponse.json(
      { error: 'Failed to fetch workflow modules' },
      { status: 500 }
    );
  }
}

// POST handler to create a new workflow step
export async function POST(request: Request) {
  try {
    // Check if user has permission
    if (!await hasPermission('manage_workflows')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { moduleId, stepData } = body;

    if (!moduleId || !stepData) {
      return NextResponse.json(
        { error: 'Missing required fields: moduleId or stepData' },
        { status: 400 }
      );
    }

    const newStep = await createWorkflowStep(moduleId, stepData as WorkflowStepFormValues);
    return NextResponse.json(newStep);
  } catch (error) {
    console.error('Error creating workflow step:', error);
    return NextResponse.json(
      { error: 'Failed to create workflow step' },
      { status: 500 }
    );
  }
}

// PUT handler to update a workflow step
export async function PUT(request: Request) {
  try {
    // Check if user has permission
    if (!await hasPermission('manage_workflows')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { stepId, stepData } = body;

    if (!stepId || !stepData) {
      return NextResponse.json(
        { error: 'Missing required fields: stepId or stepData' },
        { status: 400 }
      );
    }

    const updatedStep = await updateWorkflowStep(stepId, stepData as WorkflowStepFormValues);
    return NextResponse.json(updatedStep);
  } catch (error) {
    console.error('Error updating workflow step:', error);
    return NextResponse.json(
      { error: 'Failed to update workflow step' },
      { status: 500 }
    );
  }
}

// DELETE handler to delete a workflow step
export async function DELETE(request: Request) {
  try {
    // Check if user has permission
    if (!await hasPermission('manage_workflows')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const url = new URL(request.url);
    const stepId = url.searchParams.get('stepId');

    if (!stepId) {
      return NextResponse.json(
        { error: 'Missing required parameter: stepId' },
        { status: 400 }
      );
    }

    const success = await deleteWorkflowStep(stepId);
    return NextResponse.json({ success });
  } catch (error) {
    console.error('Error deleting workflow step:', error);
    return NextResponse.json(
      { error: 'Failed to delete workflow step' },
      { status: 500 }
    );
  }
}
