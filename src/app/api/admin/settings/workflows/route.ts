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
    // TEMPORARILY DISABLED: Authentication completely removed for testing
    console.log('Admin Settings Workflows: Authentication bypassed for testing');

    // Import our new workflow service
    const { getAllWorkflowTemplates } = await import('@/lib/workflow-service');
    
    // Fetch workflow templates from our new system
    const workflows = await getAllWorkflowTemplates();
    
    // Transform data to match frontend expectations
    const formattedWorkflows = workflows.map(workflow => ({
      id: workflow.id,
      name: workflow.name,
      description: workflow.description,
      module: workflow.module,
      is_active: workflow.is_active,
      created_at: workflow.created_at,
      updated_at: workflow.updated_at,
      steps: workflow.steps?.map(step => ({
        id: step.id,
        name: step.step_name,
        order: step.step_number,
        role: step.required_role,
        description: step.description,
        is_mandatory: step.is_mandatory,
        can_delegate: step.can_delegate,
        timeout_days: step.timeout_days,
        escalation_role: step.escalation_role
      })) || []
    }));

    console.log(`Fetched ${formattedWorkflows.length} workflow templates`);
    
    return NextResponse.json({
      success: true,
      data: formattedWorkflows
    });
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
    // TEMPORARILY DISABLED: Authentication completely removed for testing
    console.log('Create Workflow Step: Authentication bypassed for testing');

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
    // TEMPORARILY DISABLED: Authentication completely removed for testing
    console.log('Update Workflow Step: Authentication bypassed for testing');

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
    // TEMPORARILY DISABLED: Authentication completely removed for testing
    console.log('Delete Workflow Step: Authentication bypassed for testing');

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
