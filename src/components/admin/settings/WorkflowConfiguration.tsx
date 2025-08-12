"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  WorkflowIcon, 
  Plus, 
  Edit, 
  Trash2, 
  ArrowRight, 
  Settings, 
  Clock, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Users
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface WorkflowTemplate {
  id: string;
  name: string;
  description?: string;
  module: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  steps: WorkflowStep[];
}

interface WorkflowStep {
  id: string;
  name: string;
  order: number;
  role: string;
  description?: string;
  is_mandatory: boolean;
  can_delegate: boolean;
  timeout_days?: number;
  escalation_role?: string;
}

interface WorkflowStepForm {
  name: string;
  role: string;
  description: string;
  is_mandatory: boolean;
  can_delegate: boolean;
  timeout_days: string;
  escalation_role: string;
}

const AVAILABLE_ROLES = [
  'Department Focal',
  'Line Manager', 
  'HOD',
  'HR Admin',
  'HR Manager',
  'Finance Manager',
  'Transport Admin',
  'Transport Manager',
  'Accommodation Admin',
  'Accommodation Manager',
  'Admin',
  'System Admin'
];

const MODULES = [
  { value: 'trf', label: 'Travel Requests (TRF)' },
  { value: 'visa', label: 'Visa Applications' },
  { value: 'transport', label: 'Transport Requests' },
  { value: 'accommodation', label: 'Accommodation Requests' },
  { value: 'claims', label: 'Expense Claims' }
];

export default function WorkflowConfiguration() {
  const [workflows, setWorkflows] = useState<WorkflowTemplate[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isStepDialogOpen, setIsStepDialogOpen] = useState(false);
  const [editingStep, setEditingStep] = useState<WorkflowStep | null>(null);
  const [stepForm, setStepForm] = useState<WorkflowStepForm>({
    name: '',
    role: '',
    description: '',
    is_mandatory: true,
    can_delegate: false,
    timeout_days: '',
    escalation_role: ''
  });

  const { toast } = useToast();

  // Fetch workflows from API
  const fetchWorkflows = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/admin/workflows');
      if (!response.ok) throw new Error('Failed to fetch workflows');
      
      const result = await response.json();
      console.log('Fetched workflows:', result);
      
      if (result.success) {
        setWorkflows(result.data || []);
      } else {
        throw new Error(result.error || 'Failed to fetch workflows');
      }
    } catch (error: any) {
      console.error('Error fetching workflows:', error);
      toast({
        title: 'Error',
        description: 'Failed to load workflow configurations',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const handleSelectWorkflow = (workflow: WorkflowTemplate) => {
    setSelectedWorkflow(workflow);
    setIsDialogOpen(true);
  };

  const handleAddStep = () => {
    setEditingStep(null);
    setStepForm({
      name: '',
      role: '',
      description: '',
      is_mandatory: true,
      can_delegate: false,
      timeout_days: '',
      escalation_role: ''
    });
    setIsStepDialogOpen(true);
  };

  const handleEditStep = (step: WorkflowStep) => {
    setEditingStep(step);
    setStepForm({
      name: step.name,
      role: step.role,
      description: step.description || '',
      is_mandatory: step.is_mandatory,
      can_delegate: step.can_delegate,
      timeout_days: step.timeout_days ? step.timeout_days.toString() : '',
      escalation_role: step.escalation_role || ''
    });
    setIsStepDialogOpen(true);
  };

  const handleSaveStep = async () => {
    try {
      if (!selectedWorkflow) return;

      const stepData = {
        step_number: editingStep ? editingStep.order : (selectedWorkflow.steps.length + 1),
        step_name: stepForm.name,
        required_role: stepForm.role,
        description: stepForm.description || null,
        is_mandatory: stepForm.is_mandatory,
        can_delegate: stepForm.can_delegate,
        timeout_days: stepForm.timeout_days ? parseInt(stepForm.timeout_days) : null,
        escalation_role: stepForm.escalation_role || null
      };

      let response;
      if (editingStep) {
        // Update existing step - we'll need to implement this
        response = await fetch('/api/admin/workflows', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: selectedWorkflow.id,
            steps: selectedWorkflow.steps.map(s => 
              s.id === editingStep.id ? stepData : {
                step_number: s.order,
                step_name: s.name,
                required_role: s.role,
                description: s.description,
                is_mandatory: s.is_mandatory,
                can_delegate: s.can_delegate,
                timeout_days: s.timeout_days,
                escalation_role: s.escalation_role
              }
            )
          })
        });
      } else {
        // Add new step
        response = await fetch('/api/admin/workflows', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: selectedWorkflow.id,
            steps: [...selectedWorkflow.steps.map(s => ({
              step_number: s.order,
              step_name: s.name,
              required_role: s.role,
              description: s.description,
              is_mandatory: s.is_mandatory,
              can_delegate: s.can_delegate,
              timeout_days: s.timeout_days,
              escalation_role: s.escalation_role
            })), stepData]
          })
        });
      }

      if (!response.ok) throw new Error('Failed to save step');

      toast({
        title: 'Success',
        description: `Workflow step ${editingStep ? 'updated' : 'added'} successfully`
      });

      setIsStepDialogOpen(false);
      await fetchWorkflows();
      
      // Update selected workflow
      const updatedWorkflow = workflows.find(w => w.id === selectedWorkflow.id);
      if (updatedWorkflow) {
        setSelectedWorkflow(updatedWorkflow);
      }

    } catch (error: any) {
      console.error('Error saving step:', error);
      toast({
        title: 'Error',
        description: 'Failed to save workflow step',
        variant: 'destructive'
      });
    }
  };

  const handleDeleteStep = async (step: WorkflowStep) => {
    if (!selectedWorkflow) return;
    
    if (!confirm(`Are you sure you want to delete the step "${step.name}"?`)) return;

    try {
      // Remove the step and reorder remaining steps
      const updatedSteps = selectedWorkflow.steps
        .filter(s => s.id !== step.id)
        .map((s, index) => ({
          step_number: index + 1,
          step_name: s.name,
          required_role: s.role,
          description: s.description,
          is_mandatory: s.is_mandatory,
          can_delegate: s.can_delegate,
          timeout_days: s.timeout_days,
          escalation_role: s.escalation_role
        }));

      const response = await fetch('/api/admin/workflows', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedWorkflow.id,
          steps: updatedSteps
        })
      });

      if (!response.ok) throw new Error('Failed to delete step');

      toast({
        title: 'Success',
        description: 'Workflow step deleted successfully'
      });

      await fetchWorkflows();
      
      // Update selected workflow
      const updatedWorkflow = workflows.find(w => w.id === selectedWorkflow.id);
      if (updatedWorkflow) {
        setSelectedWorkflow(updatedWorkflow);
      }

    } catch (error: any) {
      console.error('Error deleting step:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete workflow step',
        variant: 'destructive'
      });
    }
  };

  const getModuleLabel = (module: string) => {
    const found = MODULES.find(m => m.value === module);
    return found ? found.label : module.toUpperCase();
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <WorkflowIcon className="h-5 w-5" />
            Approval Workflow Configuration
          </CardTitle>
          <CardDescription>Loading workflow configurations...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <WorkflowIcon className="h-5 w-5 text-primary" />
            Approval Workflow Configuration
          </CardTitle>
          <CardDescription>
            Customize approval steps, escalation rules, and conditions for different modules.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {workflows.length === 0 ? (
            <div className="text-center py-8">
              <WorkflowIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No workflow configurations found</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {workflows.map((workflow) => (
                <Card key={workflow.id} className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold">{workflow.name}</h4>
                          <Badge variant={workflow.is_active ? "default" : "secondary"}>
                            {workflow.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {getModuleLabel(workflow.module)} • {workflow.steps.length} steps
                        </p>
                        {workflow.description && (
                          <p className="text-sm text-muted-foreground">{workflow.description}</p>
                        )}
                        
                        {/* Workflow Steps Preview */}
                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                          {workflow.steps.map((step, index) => (
                            <React.Fragment key={step.id}>
                              <span className="px-2 py-1 bg-muted rounded">{step.role}</span>
                              {index < workflow.steps.length - 1 && <ArrowRight className="h-3 w-3" />}
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                      
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleSelectWorkflow(workflow)}
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        Configure
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Workflow Detail Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <WorkflowIcon className="h-5 w-5" />
              {selectedWorkflow?.name}
            </DialogTitle>
            <DialogDescription>
              Configure approval steps for {selectedWorkflow ? getModuleLabel(selectedWorkflow.module) : ''}
            </DialogDescription>
          </DialogHeader>

          {selectedWorkflow && (
            <div className="space-y-6">
              {/* Workflow Info */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Module</Label>
                  <p className="font-medium">{getModuleLabel(selectedWorkflow.module)}</p>
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Status</Label>
                  <Badge variant={selectedWorkflow.is_active ? "default" : "secondary"}>
                    {selectedWorkflow.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>

              {/* Workflow Steps */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold">Approval Steps</h4>
                  <Button onClick={handleAddStep} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Step
                  </Button>
                </div>

                <div className="space-y-3">
                  {selectedWorkflow.steps.map((step, index) => (
                    <Card key={step.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-medium">
                              {step.order}
                            </div>
                            <div>
                              <h5 className="font-medium">{step.name}</h5>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Users className="h-3 w-3" />
                                <span>{step.role}</span>
                                {step.timeout_days && (
                                  <>
                                    <Clock className="h-3 w-3 ml-2" />
                                    <span>{step.timeout_days} days</span>
                                  </>
                                )}
                                {!step.is_mandatory && (
                                  <Badge variant="outline" className="ml-2">Optional</Badge>
                                )}
                              </div>
                              {step.description && (
                                <p className="text-sm text-muted-foreground mt-1">{step.description}</p>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditStep(step)}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteStep(step)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {selectedWorkflow.steps.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <WorkflowIcon className="h-8 w-8 mx-auto mb-2" />
                      <p>No workflow steps configured</p>
                      <p className="text-sm">Add your first approval step to get started</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add/Edit Step Dialog */}
      <Dialog open={isStepDialogOpen} onOpenChange={setIsStepDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingStep ? 'Edit Workflow Step' : 'Add Workflow Step'}
            </DialogTitle>
            <DialogDescription>
              Configure the approval step details and requirements
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="stepName">Step Name</Label>
                <Input
                  id="stepName"
                  value={stepForm.name}
                  onChange={(e) => setStepForm({ ...stepForm, name: e.target.value })}
                  placeholder="e.g., Department Focal Review"
                />
              </div>
              
              <div>
                <Label htmlFor="role">Required Role</Label>
                <Select value={stepForm.role} onValueChange={(value) => setStepForm({ ...stepForm, role: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_ROLES.map(role => (
                      <SelectItem key={role} value={role}>{role}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={stepForm.description}
                onChange={(e) => setStepForm({ ...stepForm, description: e.target.value })}
                placeholder="Describe what happens in this step..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="timeoutDays">Timeout (Days)</Label>
                <Input
                  id="timeoutDays"
                  type="number"
                  value={stepForm.timeout_days}
                  onChange={(e) => setStepForm({ 
                    ...stepForm, 
                    timeout_days: e.target.value 
                  })}
                  placeholder="Auto-escalation timeout"
                />
              </div>

              <div>
                <Label htmlFor="escalationRole">Escalation Role</Label>
                <Select 
                  value={stepForm.escalation_role} 
                  onValueChange={(value) => setStepForm({ ...stepForm, escalation_role: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select escalation role" />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_ROLES.map(role => (
                      <SelectItem key={role} value={role}>{role}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center space-x-2">
                <Switch
                  id="mandatory"
                  checked={stepForm.is_mandatory}
                  onCheckedChange={(checked) => setStepForm({ ...stepForm, is_mandatory: checked })}
                />
                <Label htmlFor="mandatory">Mandatory Step</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="delegate"
                  checked={stepForm.can_delegate}
                  onCheckedChange={(checked) => setStepForm({ ...stepForm, can_delegate: checked })}
                />
                <Label htmlFor="delegate">Allow Delegation</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsStepDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveStep} disabled={!stepForm.name || !stepForm.role}>
              {editingStep ? 'Update Step' : 'Add Step'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}