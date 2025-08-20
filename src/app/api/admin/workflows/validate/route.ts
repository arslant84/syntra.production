import { NextRequest, NextResponse } from 'next/server';
import { WorkflowValidator, WorkflowTemplate } from '@/lib/workflow-validation';

// POST /api/admin/workflows/validate - Validate workflow without saving
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Convert to our enhanced validation format
    const workflowTemplate: WorkflowTemplate = {
      name: body.name || '',
      description: body.description,
      module: body.module || 'trf',
      isActive: body.isActive ?? true,
      steps: body.steps?.map((step: any) => ({
        stepNumber: step.stepNumber || 0,
        stepName: step.stepName || '',
        requiredRole: step.requiredRole,
        assignedUserId: step.assignedUserId,
        description: step.description,
        isMandatory: step.isMandatory ?? true,
        canDelegate: step.canDelegate ?? false,
        timeoutDays: step.timeoutDays,
        escalationRole: step.escalationRole,
        conditions: step.conditions
      })) || []
    };
    
    // Perform comprehensive validation
    const validation = await WorkflowValidator.validateWorkflow(workflowTemplate);
    
    return NextResponse.json({
      success: true,
      validation: {
        isValid: validation.isValid,
        errors: validation.errors,
        warnings: validation.warnings,
        canSave: validation.isValid,
        summary: WorkflowValidator.getValidationSummary(validation)
      }
    });
    
  } catch (error: any) {
    console.error('Error validating workflow:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Validation error occurred',
        message: error.message,
        validation: {
          isValid: false,
          errors: [{ type: 'error', message: 'Internal validation error' }],
          warnings: [],
          canSave: false,
          summary: 'Cannot validate workflow due to internal error'
        }
      },
      { status: 500 }
    );
  }
}

// POST /api/admin/workflows/validate/step - Validate individual step
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { step, stepIndex, allSteps } = body;
    
    if (!step || stepIndex === undefined || !allSteps) {
      return NextResponse.json(
        { error: 'Missing required fields: step, stepIndex, allSteps' },
        { status: 400 }
      );
    }
    
    // Convert step to our format
    const workflowStep = {
      stepNumber: step.stepNumber || stepIndex + 1,
      stepName: step.stepName || '',
      requiredRole: step.requiredRole,
      assignedUserId: step.assignedUserId,
      description: step.description,
      isMandatory: step.isMandatory ?? true,
      canDelegate: step.canDelegate ?? false,
      timeoutDays: step.timeoutDays,
      escalationRole: step.escalationRole,
      conditions: step.conditions
    };
    
    // Convert all steps to our format
    const convertedSteps = allSteps.map((s: any, index: number) => ({
      stepNumber: s.stepNumber || index + 1,
      stepName: s.stepName || '',
      requiredRole: s.requiredRole,
      assignedUserId: s.assignedUserId,
      description: s.description,
      isMandatory: s.isMandatory ?? true,
      canDelegate: s.canDelegate ?? false,
      timeoutDays: s.timeoutDays,
      escalationRole: s.escalationRole,
      conditions: s.conditions
    }));
    
    // Validate the specific step
    const stepErrors = await WorkflowValidator.validateStep(workflowStep, stepIndex, convertedSteps);
    
    return NextResponse.json({
      success: true,
      stepValidation: {
        errors: stepErrors.filter(e => e.type === 'error'),
        warnings: stepErrors.filter(e => e.type === 'warning'),
        isValid: stepErrors.filter(e => e.type === 'error').length === 0
      }
    });
    
  } catch (error: any) {
    console.error('Error validating step:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Step validation error occurred',
        message: error.message
      },
      { status: 500 }
    );
  }
}