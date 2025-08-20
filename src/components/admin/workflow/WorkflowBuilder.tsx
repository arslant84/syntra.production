'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Plus, X, AlertCircle, CheckCircle, Move, Save, Eye, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { WorkflowValidator, ValidationResult, WorkflowTemplate, WorkflowStep } from '@/lib/workflow-validation';
import { cn } from '@/lib/utils';

interface WorkflowBuilderProps {
  initialWorkflow?: WorkflowTemplate;
  onSave: (workflow: WorkflowTemplate) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

interface StepFormData extends WorkflowStep {
  tempId: string; // For tracking during editing
}

export function WorkflowBuilder({ initialWorkflow, onSave, onCancel, isLoading }: WorkflowBuilderProps) {
  // Workflow state
  const [workflow, setWorkflow] = useState<WorkflowTemplate>({
    name: '',
    description: '',
    module: 'trf',
    isActive: true,
    steps: [],
    ...initialWorkflow
  });

  // Steps state with temporary IDs for drag-and-drop
  const [steps, setSteps] = useState<StepFormData[]>([]);
  
  // Validation state
  const [validation, setValidation] = useState<ValidationResult>({
    isValid: false,
    errors: [],
    warnings: []
  });
  
  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [availableUsers, setAvailableUsers] = useState<Array<{id: string, name: string, role: string}>>([]);

  // Initialize steps with temp IDs
  useEffect(() => {
    if (workflow.steps.length > 0) {
      setSteps(workflow.steps.map((step, index) => ({
        ...step,
        tempId: step.id || `temp-${index}`
      })));
    } else {
      // Add first step by default
      addStep();
    }
  }, []);

  // Load available roles and users
  useEffect(() => {
    loadRolesAndUsers();
  }, []);

  // Real-time validation
  useEffect(() => {
    validateWorkflow();
  }, [workflow, steps]);

  const loadRolesAndUsers = async () => {
    try {
      // Load roles
      const rolesResponse = await fetch('/api/admin/roles');
      if (rolesResponse.ok) {
        const rolesData = await rolesResponse.json();
        setAvailableRoles(rolesData.map((r: any) => r.name));
      }

      // Load users
      const usersResponse = await fetch('/api/admin/users?status=active');
      if (usersResponse.ok) {
        const usersData = await usersResponse.json();
        setAvailableUsers(usersData.map((u: any) => ({
          id: u.id,
          name: u.name,
          role: u.role
        })));
      }
    } catch (error) {
      console.error('Error loading roles and users:', error);
    }
  };

  const validateWorkflow = useCallback(async () => {
    const workflowToValidate: WorkflowTemplate = {
      ...workflow,
      steps: steps.map(({ tempId, ...step }) => step)
    };

    const result = await WorkflowValidator.validateWorkflow(workflowToValidate);
    setValidation(result);
  }, [workflow, steps]);

  const addStep = () => {
    const newStep: StepFormData = {
      tempId: `temp-${Date.now()}`,
      stepNumber: steps.length + 1,
      stepName: '',
      requiredRole: '',
      assignedUserId: '',
      description: '',
      isMandatory: true,
      canDelegate: false,
      timeoutDays: 7,
      escalationRole: ''
    };

    setSteps([...steps, newStep]);
  };

  const removeStep = (tempId: string) => {
    const newSteps = steps.filter(s => s.tempId !== tempId);
    // Renumber steps
    const renumberedSteps = newSteps.map((step, index) => ({
      ...step,
      stepNumber: index + 1
    }));
    setSteps(renumberedSteps);
  };

  const updateStep = (tempId: string, updates: Partial<StepFormData>) => {
    setSteps(steps.map(step => 
      step.tempId === tempId ? { ...step, ...updates } : step
    ));
  };

  const insertStep = (afterIndex: number) => {
    const newStep: StepFormData = {
      tempId: `temp-${Date.now()}`,
      stepNumber: afterIndex + 2,
      stepName: '',
      requiredRole: '',
      assignedUserId: '',
      description: '',
      isMandatory: true,
      canDelegate: false,
      timeoutDays: 7,
      escalationRole: ''
    };

    const newSteps = [...steps];
    newSteps.splice(afterIndex + 1, 0, newStep);
    
    // Renumber all steps
    const renumberedSteps = newSteps.map((step, index) => ({
      ...step,
      stepNumber: index + 1
    }));
    
    setSteps(renumberedSteps);
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const newSteps = Array.from(steps);
    const [reorderedStep] = newSteps.splice(result.source.index, 1);
    newSteps.splice(result.destination.index, 0, reorderedStep);

    // Renumber steps
    const renumberedSteps = newSteps.map((step, index) => ({
      ...step,
      stepNumber: index + 1
    }));

    setSteps(renumberedSteps);
  };

  const handleSave = async () => {
    if (!validation.isValid) {
      alert('Please fix all validation errors before saving.');
      return;
    }

    setIsSaving(true);
    try {
      const workflowToSave: WorkflowTemplate = {
        ...workflow,
        steps: steps.map(({ tempId, ...step }) => step)
      };

      await onSave(workflowToSave);
    } catch (error) {
      console.error('Error saving workflow:', error);
      alert('Failed to save workflow. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const getStepErrors = (stepIndex: number) => {
    return validation.errors.filter(e => e.stepIndex === stepIndex);
  };

  const getStepWarnings = (stepIndex: number) => {
    return validation.warnings.filter(w => w.stepIndex === stepIndex);
  };

  return (
    <div className="flex h-full">
      {/* Main Builder Panel */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">
                {initialWorkflow ? 'Edit Workflow' : 'Create New Workflow'}
              </h1>
              <p className="text-muted-foreground">
                Design a complete approval workflow with validation
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => setShowPreview(!showPreview)}
                className="flex items-center gap-2"
              >
                <Eye className="h-4 w-4" />
                {showPreview ? 'Hide Preview' : 'Preview'}
              </Button>
              
              <Button
                variant="outline"
                onClick={onCancel}
                disabled={isSaving}
              >
                Cancel
              </Button>
              
              <Button
                onClick={handleSave}
                disabled={!validation.isValid || isSaving}
                className="flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                {isSaving ? 'Saving...' : 'Save Workflow'}
              </Button>
            </div>
          </div>

          {/* Validation Summary */}
          <div className="space-y-2">
            {validation.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>{validation.errors.length} error(s) must be fixed:</strong>
                  <ul className="mt-2 list-disc list-inside space-y-1">
                    {validation.errors.slice(0, 3).map((error, index) => (
                      <li key={index} className="text-sm">{error.message}</li>
                    ))}
                    {validation.errors.length > 3 && (
                      <li className="text-sm">...and {validation.errors.length - 3} more</li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {validation.warnings.length > 0 && validation.errors.length === 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>{validation.warnings.length} warning(s):</strong>
                  <ul className="mt-2 list-disc list-inside space-y-1">
                    {validation.warnings.slice(0, 2).map((warning, index) => (
                      <li key={index} className="text-sm">{warning.message}</li>
                    ))}
                    {validation.warnings.length > 2 && (
                      <li className="text-sm">...and {validation.warnings.length - 2} more</li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {validation.isValid && validation.warnings.length === 0 && (
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  Workflow is valid and ready to save!
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Basic Workflow Info */}
          <Card>
            <CardHeader>
              <CardTitle>Workflow Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Workflow Name *</Label>
                  <Input
                    id="name"
                    value={workflow.name}
                    onChange={(e) => setWorkflow({ ...workflow, name: e.target.value })}
                    placeholder="e.g., Standard TRF Approval"
                    className={cn(
                      validation.errors.some(e => e.message.includes('name')) && 'border-red-500'
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="module">Module *</Label>
                  <Select
                    value={workflow.module}
                    onValueChange={(value: any) => setWorkflow({ ...workflow, module: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select module" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="trf">Travel Requests</SelectItem>
                      <SelectItem value="claims">Expense Claims</SelectItem>
                      <SelectItem value="visa">Visa Applications</SelectItem>
                      <SelectItem value="transport">Transport Requests</SelectItem>
                      <SelectItem value="accommodation">Accommodation Requests</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={workflow.description || ''}
                  onChange={(e) => setWorkflow({ ...workflow, description: e.target.value })}
                  placeholder="Describe when and how this workflow should be used..."
                  rows={3}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="isActive"
                  checked={workflow.isActive}
                  onCheckedChange={(checked) => setWorkflow({ ...workflow, isActive: checked })}
                />
                <Label htmlFor="isActive">Active (workflow will be available for use)</Label>
              </div>
            </CardContent>
          </Card>

          {/* Workflow Steps */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Approval Steps ({steps.length})</CardTitle>
                <Button
                  onClick={addStep}
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Step
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {steps.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No steps defined yet. Click "Add Step" to begin.</p>
                </div>
              ) : (
                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId="workflow-steps">
                    {(provided) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className="space-y-4"
                      >
                        {steps.map((step, index) => (
                          <Draggable
                            key={step.tempId}
                            draggableId={step.tempId}
                            index={index}
                          >
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={cn(
                                  "border rounded-lg p-4 space-y-4 bg-white",
                                  snapshot.isDragging && "shadow-lg",
                                  getStepErrors(index).length > 0 && "border-red-300 bg-red-50",
                                  getStepWarnings(index).length > 0 && getStepErrors(index).length === 0 && "border-yellow-300 bg-yellow-50"
                                )}
                              >
                                {/* Step Header */}
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <div
                                      {...provided.dragHandleProps}
                                      className="cursor-grab p-1 hover:bg-gray-100 rounded"
                                    >
                                      <Move className="h-4 w-4 text-gray-400" />
                                    </div>
                                    <Badge variant="outline">
                                      Step {step.stepNumber}
                                    </Badge>
                                    {getStepErrors(index).length > 0 && (
                                      <Badge variant="destructive" className="text-xs">
                                        {getStepErrors(index).length} Error(s)
                                      </Badge>
                                    )}
                                    {getStepWarnings(index).length > 0 && (
                                      <Badge variant="secondary" className="text-xs">
                                        {getStepWarnings(index).length} Warning(s)
                                      </Badge>
                                    )}
                                  </div>
                                  
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => insertStep(index)}
                                      className="text-xs"
                                    >
                                      <Plus className="h-3 w-3 mr-1" />
                                      Insert After
                                    </Button>
                                    
                                    {steps.length > 1 && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => removeStep(step.tempId)}
                                        className="text-red-600 hover:text-red-800 hover:bg-red-100"
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </div>
                                </div>

                                {/* Step Errors/Warnings */}
                                {getStepErrors(index).length > 0 && (
                                  <div className="text-sm text-red-600 bg-red-100 p-2 rounded border">
                                    <ul className="list-disc list-inside space-y-1">
                                      {getStepErrors(index).map((error, i) => (
                                        <li key={i}>{error.message}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                {/* Step Form */}
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label>Step Name *</Label>
                                    <Input
                                      value={step.stepName}
                                      onChange={(e) => updateStep(step.tempId, { stepName: e.target.value })}
                                      placeholder="e.g., Department Focal Review"
                                      className={cn(
                                        getStepErrors(index).some(e => e.field === 'stepName') && 'border-red-500'
                                      )}
                                    />
                                  </div>

                                  <div className="space-y-2">
                                    <Label>Required Role</Label>
                                    <Select
                                      value={step.requiredRole || ''}
                                      onValueChange={(value) => updateStep(step.tempId, { 
                                        requiredRole: value,
                                        assignedUserId: '' // Clear user if role is selected
                                      })}
                                    >
                                      <SelectTrigger className={cn(
                                        getStepErrors(index).some(e => e.field === 'approver') && 'border-red-500'
                                      )}>
                                        <SelectValue placeholder="Select role" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="">None (select specific user instead)</SelectItem>
                                        {availableRoles.map(role => (
                                          <SelectItem key={role} value={role}>{role}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  {!step.requiredRole && (
                                    <div className="space-y-2">
                                      <Label>Specific User</Label>
                                      <Select
                                        value={step.assignedUserId || ''}
                                        onValueChange={(value) => updateStep(step.tempId, { assignedUserId: value })}
                                      >
                                        <SelectTrigger className={cn(
                                          getStepErrors(index).some(e => e.field === 'approver') && 'border-red-500'
                                        )}>
                                          <SelectValue placeholder="Select user" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="">None</SelectItem>
                                          {availableUsers.map(user => (
                                            <SelectItem key={user.id} value={user.id}>
                                              {user.name} ({user.role})
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  )}

                                  <div className="space-y-2">
                                    <Label>Timeout (Days)</Label>
                                    <Input
                                      type="number"
                                      min="1"
                                      max="90"
                                      value={step.timeoutDays || ''}
                                      onChange={(e) => updateStep(step.tempId, { 
                                        timeoutDays: e.target.value ? parseInt(e.target.value) : undefined 
                                      })}
                                      placeholder="7"
                                    />
                                  </div>
                                </div>

                                <div className="space-y-2">
                                  <Label>Description</Label>
                                  <Textarea
                                    value={step.description || ''}
                                    onChange={(e) => updateStep(step.tempId, { description: e.target.value })}
                                    placeholder="Describe what this step involves..."
                                    rows={2}
                                  />
                                </div>

                                <div className="flex items-center gap-6">
                                  <div className="flex items-center space-x-2">
                                    <Switch
                                      checked={step.isMandatory}
                                      onCheckedChange={(checked) => updateStep(step.tempId, { isMandatory: checked })}
                                    />
                                    <Label>Mandatory Step</Label>
                                  </div>

                                  <div className="flex items-center space-x-2">
                                    <Switch
                                      checked={step.canDelegate}
                                      onCheckedChange={(checked) => updateStep(step.tempId, { canDelegate: checked })}
                                    />
                                    <Label>Can Delegate</Label>
                                  </div>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Preview Panel */}
      {showPreview && (
        <div className="w-80 border-l bg-gray-50 p-4 overflow-y-auto">
          <h3 className="font-semibold mb-4">Workflow Preview</h3>
          
          <div className="space-y-3">
            <div className="bg-white p-3 rounded border">
              <h4 className="font-medium">{workflow.name || 'Untitled Workflow'}</h4>
              <p className="text-sm text-muted-foreground">
                Module: {workflow.module}
              </p>
              {workflow.description && (
                <p className="text-sm mt-2">{workflow.description}</p>
              )}
            </div>

            {steps.map((step, index) => (
              <div key={step.tempId} className="bg-white p-3 rounded border">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-xs">
                    {step.stepNumber}
                  </Badge>
                  <span className="font-medium text-sm">
                    {step.stepName || 'Untitled Step'}
                  </span>
                </div>
                
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>
                    Approver: {step.requiredRole || (step.assignedUserId ? 
                      availableUsers.find(u => u.id === step.assignedUserId)?.name : 'Not assigned'
                    )}
                  </p>
                  {step.timeoutDays && (
                    <p>Timeout: {step.timeoutDays} days</p>
                  )}
                  <div className="flex gap-2">
                    {step.isMandatory && (
                      <Badge variant="secondary" className="text-xs">Mandatory</Badge>
                    )}
                    {step.canDelegate && (
                      <Badge variant="outline" className="text-xs">Can Delegate</Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}