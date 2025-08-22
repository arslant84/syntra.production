"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from '@/lib/utils';
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, AlertTriangle, FileText, Eye, CheckCircle, Clock, ArrowLeft, DollarSign } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSessionPermissions } from '@/hooks/use-session-permissions';
import { shouldShowRequest } from '@/lib/client-rbac-utils';
import { format } from "date-fns";
import type { ClaimStatus, ReimbursementDetails } from '@/types/claims';

// Define interfaces for claims
interface ClaimRequest {
  id: string;
  documentNumber: string;
  requestorName: string;
  department: string;
  purpose: string;
  status: ClaimStatus;
  submittedAt: string;
  expenseItems?: ExpenseItem[];
  reimbursementDetails?: ReimbursementDetails;
  totalAdvanceClaimAmount?: number;
  balanceClaimRepayment?: number;
}

interface ExpenseItem {
  id?: string;
  date: string;
  claimOrTravelDetails: string;
  officialMileageKM?: number;
  transport?: number;
  hotelAccommodationAllowance?: number;
  outStationAllowanceMeal?: number;
  miscellaneousAllowance10Percent?: number;
  otherExpenses?: number;
}

export default function ClaimsProcessingPage() {
  const [approvedClaims, setApprovedClaims] = useState<ClaimRequest[]>([]);
  const [processingClaims, setProcessingClaims] = useState<ClaimRequest[]>([]);
  const [completedClaims, setCompletedClaims] = useState<ClaimRequest[]>([]);
  const [selectedClaim, setSelectedClaim] = useState<ClaimRequest | null>(null);
  const [processingDialog, setProcessingDialog] = useState(false);
  const [completingDialog, setCompletingDialog] = useState(false);
  const [detailsDialog, setDetailsDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("approved");
  
  // Reimbursement details form state
  const [reimbursementForm, setReimbursementForm] = useState<ReimbursementDetails>({
    paymentMethod: '',
    bankTransferReference: '',
    chequeNumber: '',
    paymentDate: '',
    amountPaid: 0,
    taxDeducted: 0,
    netAmount: 0,
    processingNotes: '',
    verifiedBy: '',
    authorizedBy: ''
  });

  const { toast } = useToast();
  const { role, userId, isLoading: sessionLoading } = useSessionPermissions();
  const router = useRouter();

  // Fetch claims by status
  const fetchClaims = useCallback(async () => {
    if (sessionLoading || !role) {
      return;
    }
    
    setIsLoading(true);
    setError(null);
    try {
      // Fetch approved claims (ready for claims admin processing)
      const approvedResponse = await fetch(`/api/admin/claims?statuses=Approved&fullDetails=true&limit=50`);
      if (approvedResponse.ok) {
        const approvedData = await approvedResponse.json();
        console.log('Approved claims data:', approvedData);
        const dataArray = Array.isArray(approvedData) ? approvedData : (approvedData.data || []);
        const filteredApproved = dataArray.filter(req =>
          shouldShowRequest(role, { ...req, itemType: 'claim' }, userId)
        ).map(req => ({
          ...req,
          documentNumber: req.documentNumber || req.document_number,
          requestorName: req.requestorName || req.staff_name,
          department: req.department || req.department_code,
          purpose: req.purpose || req.purpose_of_claim,
          expenseItems: req.expenseItems || req.expense_items || []
        }));
        setApprovedClaims(filteredApproved);
      }

      // Fetch processing claims
      const processingResponse = await fetch(`/api/admin/claims?statuses=Processing with Claims Admin&fullDetails=true&limit=50`);
      if (processingResponse.ok) {
        const processingData = await processingResponse.json();
        console.log('Processing claims data:', processingData);
        const dataArray = Array.isArray(processingData) ? processingData : (processingData.data || []);
        const filteredProcessing = dataArray.filter(req =>
          shouldShowRequest(role, { ...req, itemType: 'claim' }, userId)
        ).map(req => ({
          ...req,
          documentNumber: req.documentNumber || req.document_number,
          requestorName: req.requestorName || req.staff_name,
          department: req.department || req.department_code,
          purpose: req.purpose || req.purpose_of_claim,
          expenseItems: req.expenseItems || req.expense_items || []
        }));
        setProcessingClaims(filteredProcessing);
      }

      // Fetch completed claims
      const completedResponse = await fetch(`/api/admin/claims?statuses=Processed&fullDetails=true&limit=50`);
      if (completedResponse.ok) {
        const completedData = await completedResponse.json();
        console.log('Completed claims data:', completedData);
        const dataArray = Array.isArray(completedData) ? completedData : (completedData.data || []);
        const filteredCompleted = dataArray.filter(req =>
          shouldShowRequest(role, { ...req, itemType: 'claim' }, userId)
        ).map(req => ({
          ...req,
          documentNumber: req.documentNumber || req.document_number,
          requestorName: req.requestorName || req.staff_name,
          department: req.department || req.department_code,
          purpose: req.purpose || req.purpose_of_claim,
          expenseItems: req.expenseItems || req.expense_items || []
        }));
        setCompletedClaims(filteredCompleted);
      }

    } catch (err: any) {
      console.error('Error fetching claims:', err);
      setError(err.message || 'Failed to load claims');
      toast({
        title: 'Error',
        description: err.message || 'Failed to load claims',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast, role, userId, sessionLoading]);

  // Fetch data on component mount
  useEffect(() => {
    fetchClaims();
  }, [fetchClaims]);

  // Handle starting claim processing
  const handleStartProcessing = async () => {
    if (!selectedClaim) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/claims/admin/process/${selectedClaim.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'process',
          comments: 'Claim processing started by Claims Admin'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start processing');
      }

      toast({
        title: "Processing Started",
        description: `Claim ${selectedClaim.id} is now being processed`,
      });

      setProcessingDialog(false);
      setSelectedClaim(null);
      fetchClaims();
    } catch (error: any) {
      console.error('Error starting processing:', error);
      toast({
        title: "Error",
        description: error.message || 'Failed to start processing',
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle completing claim processing with reimbursement details
  const handleCompleteProcessing = async () => {
    if (!selectedClaim) return;

    // Validate required reimbursement details
    if (!reimbursementForm.paymentMethod || !reimbursementForm.amountPaid) {
      toast({
        title: "Missing Information",
        description: "Please fill in payment method and amount paid",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/claims/admin/process/${selectedClaim.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'complete',
          reimbursementDetails: reimbursementForm,
          comments: 'Claim processing completed with reimbursement details'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to complete processing');
      }

      toast({
        title: "Reimbursement Completed",
        description: `Claim ${selectedClaim.id} has been completed with reimbursement details`,
      });

      setCompletingDialog(false);
      setSelectedClaim(null);
      // Reset form
      setReimbursementForm({
        paymentMethod: '',
        bankTransferReference: '',
        chequeNumber: '',
        paymentDate: '',
        amountPaid: 0,
        taxDeducted: 0,
        netAmount: 0,
        processingNotes: '',
        verifiedBy: '',
        authorizedBy: ''
      });
      fetchClaims();
    } catch (error: any) {
      console.error('Error completing processing:', error);
      toast({
        title: "Error",
        description: error.message || 'Failed to complete processing',
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to calculate total expense amount
  const calculateTotalExpenses = (items: ExpenseItem[] | undefined) => {
    if (!items || items.length === 0) return 0;
    
    return items.reduce((total, item) => {
      const itemTotal = (Number(item.officialMileageKM) || 0) + 
                      (Number(item.transport) || 0) + 
                      (Number(item.hotelAccommodationAllowance) || 0) + 
                      (Number(item.outStationAllowanceMeal) || 0) + 
                      (Number(item.miscellaneousAllowance10Percent) || 0) + 
                      (Number(item.otherExpenses) || 0);
      return total + itemTotal;
    }, 0);
  };

  // Helper function to format claim summary
  const formatClaimSummary = (claim: ClaimRequest) => {
    const totalExpenses = calculateTotalExpenses(claim.expenseItems);
    const itemCount = claim.expenseItems?.length || 0;
    
    // Show reimbursement details for completed claims
    if (claim.reimbursementDetails && claim.status === 'Processed') {
      const reimbursement = claim.reimbursementDetails;
      const parts = [];
      if (reimbursement.paymentMethod) parts.push(`Payment: ${reimbursement.paymentMethod}`);
      if (reimbursement.amountPaid) parts.push(`Amount: $${reimbursement.amountPaid.toFixed(2)}`);
      if (reimbursement.paymentDate) parts.push(`Date: ${reimbursement.paymentDate}`);
      return parts.join(' | ') || `${itemCount} items, Total: $${totalExpenses.toFixed(2)}`;
    }
    
    return `${itemCount} items, Total: $${totalExpenses.toFixed(2)}`;
  };

  // Helper function to get status color
  const getStatusColor = (status: ClaimStatus) => {
    switch (status) {
      case 'Approved': return 'bg-blue-100 text-blue-700';
      case 'Processing with Claims Admin': return 'bg-yellow-100 text-yellow-700';
      case 'Processed': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  // Render claim list
  const renderClaimList = (claims: ClaimRequest[], emptyMessage: string, actionButton?: (claim: ClaimRequest) => React.ReactNode) => {
    if (isLoading && claims.length === 0) {
      return (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Loading claims...</span>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center justify-center h-40 text-destructive">
          <AlertTriangle className="h-8 w-8 mr-2" />
          <span>{error}</span>
        </div>
      );
    }

    if (claims.length === 0) {
      return (
        <div className="text-center py-12">
          <FileText className="h-16 w-16 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">{emptyMessage}</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {claims.map((claim) => (
          <div
            key={claim.id}
            className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
          >
            <div className="space-y-1 flex-1">
              <div className="font-medium">{claim.requestorName}</div>
              <div className="text-sm text-muted-foreground">
                {claim.department} • ID: {claim.documentNumber}
              </div>
              <div className="text-sm text-muted-foreground">
                Purpose: {claim.purpose || 'General Claim'}
              </div>
              <div className="text-sm text-muted-foreground">
                {formatClaimSummary(claim)}
              </div>
              <div className="text-sm text-muted-foreground">
                Submitted: {format(new Date(claim.submittedAt), 'MMM dd, yyyy')}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Badge className={getStatusColor(claim.status)}>
                  {claim.status}
                </Badge>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSelectedClaim(claim);
                  setDetailsDialog(true);
                }}
              >
                <Eye className="h-4 w-4 mr-1" />
                View
              </Button>
              {actionButton && actionButton(claim)}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Calculate net amount when gross amount or tax changes
  useEffect(() => {
    if (reimbursementForm.amountPaid && reimbursementForm.taxDeducted) {
      const netAmount = (reimbursementForm.amountPaid || 0) - (reimbursementForm.taxDeducted || 0);
      setReimbursementForm(prev => ({ ...prev, netAmount }));
    }
  }, [reimbursementForm.amountPaid, reimbursementForm.taxDeducted]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/claims">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to Claims Admin
              </Link>
            </Button>
          </div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <DollarSign className="w-8 h-8 text-primary" />
            Claims Processing
          </h1>
          <p className="text-muted-foreground">Process and manage expense claims with reimbursement details.</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="approved">
            Approved Claims ({approvedClaims.length})
          </TabsTrigger>
          <TabsTrigger value="processing">
            Processing ({processingClaims.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed ({completedClaims.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="approved" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-500" />
                Approved Expense Claims
              </CardTitle>
              <CardDescription>
                Expense claims approved by HOD and ready for processing by Claims Admin.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {renderClaimList(
                approvedClaims,
                "No approved expense claims awaiting processing.",
                (claim) => (
                  <Button
                    size="sm"
                    onClick={() => {
                      setSelectedClaim(claim);
                      setProcessingDialog(true);
                    }}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Start Processing
                  </Button>
                )
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="processing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 text-yellow-500" />
                Processing Expense Claims
              </CardTitle>
              <CardDescription>
                Expense claims currently being processed. Complete them with reimbursement details.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {renderClaimList(
                processingClaims,
                "No expense claims currently being processed.",
                (claim) => (
                  <Button
                    size="sm"
                    onClick={() => {
                      setSelectedClaim(claim);
                      setCompletingDialog(true);
                    }}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Complete
                  </Button>
                )
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                Completed Expense Claims
              </CardTitle>
              <CardDescription>
                Expense claims that have been completed with reimbursement details.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {renderClaimList(
                completedClaims,
                "No completed expense claims."
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Start Processing Dialog */}
      <Dialog open={processingDialog} onOpenChange={setProcessingDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Start Claim Processing</DialogTitle>
            <DialogDescription>
              Start processing this expense claim. The claimant will be notified.
            </DialogDescription>
          </DialogHeader>
          
          {selectedClaim && (
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="font-medium">{selectedClaim.requestorName}</div>
                <div className="text-sm text-muted-foreground">ID: {selectedClaim.documentNumber}</div>
                <div className="text-sm text-muted-foreground">Purpose: {selectedClaim.purpose || 'General Claim'}</div>
                <div className="text-sm text-muted-foreground">
                  {formatClaimSummary(selectedClaim)}
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setProcessingDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleStartProcessing} disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Start Processing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete Processing Dialog */}
      <Dialog open={completingDialog} onOpenChange={setCompletingDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Complete Claim Processing</DialogTitle>
            <DialogDescription>
              Provide reimbursement details to complete the expense claim processing.
            </DialogDescription>
          </DialogHeader>
          
          {selectedClaim && (
            <div className="space-y-6">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="font-medium">{selectedClaim.requestorName}</div>
                <div className="text-sm text-muted-foreground">ID: {selectedClaim.documentNumber}</div>
                <div className="text-sm text-muted-foreground">Purpose: {selectedClaim.purpose || 'General Claim'}</div>
                <div className="text-sm text-muted-foreground">
                  Total Claimed: ${(calculateTotalExpenses(selectedClaim.expenseItems) || 0).toFixed(2)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="paymentMethod">Payment Method *</Label>
                  <Select 
                    value={reimbursementForm.paymentMethod} 
                    onValueChange={(value) => setReimbursementForm(prev => ({ ...prev, paymentMethod: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select payment method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                      <SelectItem value="Cheque">Cheque</SelectItem>
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="Direct Deposit">Direct Deposit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="paymentDate">Payment Date</Label>
                  <Input
                    id="paymentDate"
                    type="date"
                    value={reimbursementForm.paymentDate}
                    onChange={(e) => setReimbursementForm(prev => ({ ...prev, paymentDate: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amountPaid">Amount Paid *</Label>
                  <Input
                    id="amountPaid"
                    type="number"
                    step="0.01"
                    value={reimbursementForm.amountPaid}
                    onChange={(e) => setReimbursementForm(prev => ({ ...prev, amountPaid: parseFloat(e.target.value) || 0 }))}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="taxDeducted">Tax Deducted</Label>
                  <Input
                    id="taxDeducted"
                    type="number"
                    step="0.01"
                    value={reimbursementForm.taxDeducted}
                    onChange={(e) => setReimbursementForm(prev => ({ ...prev, taxDeducted: parseFloat(e.target.value) || 0 }))}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="netAmount">Net Amount</Label>
                  <Input
                    id="netAmount"
                    type="number"
                    step="0.01"
                    value={reimbursementForm.netAmount}
                    readOnly
                    className="bg-gray-50"
                  />
                </div>
                {reimbursementForm.paymentMethod === 'Bank Transfer' && (
                  <div className="space-y-2">
                    <Label htmlFor="bankTransferReference">Bank Transfer Reference</Label>
                    <Input
                      id="bankTransferReference"
                      value={reimbursementForm.bankTransferReference}
                      onChange={(e) => setReimbursementForm(prev => ({ ...prev, bankTransferReference: e.target.value }))}
                      placeholder="Transaction reference number"
                    />
                  </div>
                )}
                {reimbursementForm.paymentMethod === 'Cheque' && (
                  <div className="space-y-2">
                    <Label htmlFor="chequeNumber">Cheque Number</Label>
                    <Input
                      id="chequeNumber"
                      value={reimbursementForm.chequeNumber}
                      onChange={(e) => setReimbursementForm(prev => ({ ...prev, chequeNumber: e.target.value }))}
                      placeholder="Cheque number"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="verifiedBy">Verified By</Label>
                  <Input
                    id="verifiedBy"
                    value={reimbursementForm.verifiedBy}
                    onChange={(e) => setReimbursementForm(prev => ({ ...prev, verifiedBy: e.target.value }))}
                    placeholder="Verifier name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="authorizedBy">Authorized By</Label>
                  <Input
                    id="authorizedBy"
                    value={reimbursementForm.authorizedBy}
                    onChange={(e) => setReimbursementForm(prev => ({ ...prev, authorizedBy: e.target.value }))}
                    placeholder="Authorizer name"
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="processingNotes">Processing Notes</Label>
                  <Textarea
                    id="processingNotes"
                    value={reimbursementForm.processingNotes}
                    onChange={(e) => setReimbursementForm(prev => ({ ...prev, processingNotes: e.target.value }))}
                    placeholder="Any additional notes about the processing"
                    rows={3}
                  />
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompletingDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCompleteProcessing} disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Complete Processing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={detailsDialog} onOpenChange={setDetailsDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Expense Claim Details</DialogTitle>
            <DialogDescription>
              Complete information about this expense claim
            </DialogDescription>
          </DialogHeader>
          
          {selectedClaim && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="font-medium text-muted-foreground">Claimant:</span>
                  <p>{selectedClaim.requestorName}</p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Department:</span>
                  <p>{selectedClaim.department}</p>
                </div>
                <div className="col-span-2">
                  <span className="font-medium text-muted-foreground">Purpose:</span>
                  <p>{selectedClaim.purpose || 'General Claim'}</p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Status:</span>
                  <Badge className={getStatusColor(selectedClaim.status)}>
                    {selectedClaim.status}
                  </Badge>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Submitted:</span>
                  <p>{format(new Date(selectedClaim.submittedAt), 'MMM dd, yyyy HH:mm')}</p>
                </div>
              </div>

              <div>
                <span className="font-medium text-muted-foreground">Expense Items:</span>
                <div className="mt-2 space-y-2">
                  {(selectedClaim.expenseItems || []).map((item, index) => (
                    <div key={item.id || index} className="p-3 border rounded-lg">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div><strong>Date:</strong> {item.date || 'N/A'}</div>
                        <div><strong>Details:</strong> {item.claimOrTravelDetails || 'N/A'}</div>
                        <div><strong>Mileage:</strong> {(Number(item.officialMileageKM) || 0).toFixed(2)} km</div>
                        <div><strong>Transport:</strong> ${(Number(item.transport) || 0).toFixed(2)}</div>
                        <div><strong>Accommodation:</strong> ${(Number(item.hotelAccommodationAllowance) || 0).toFixed(2)}</div>
                        <div><strong>Meals:</strong> ${(Number(item.outStationAllowanceMeal) || 0).toFixed(2)}</div>
                        <div><strong>Miscellaneous:</strong> ${(Number(item.miscellaneousAllowance10Percent) || 0).toFixed(2)}</div>
                        <div><strong>Other:</strong> ${(Number(item.otherExpenses) || 0).toFixed(2)}</div>
                      </div>
                    </div>
                  ))}
                  {(!selectedClaim.expenseItems || selectedClaim.expenseItems.length === 0) && (
                    <div className="p-3 border rounded-lg text-center text-muted-foreground">
                      No expense items available
                    </div>
                  )}
                </div>
                <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="font-medium">Total Expenses: ${(calculateTotalExpenses(selectedClaim.expenseItems) || 0).toFixed(2)}</div>
                </div>
              </div>

              {selectedClaim.reimbursementDetails && (
                <div>
                  <span className="font-medium text-muted-foreground">Reimbursement Details:</span>
                  <div className="mt-2 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {selectedClaim.reimbursementDetails.paymentMethod && (
                        <div><strong>Payment Method:</strong> {selectedClaim.reimbursementDetails.paymentMethod}</div>
                      )}
                      {selectedClaim.reimbursementDetails.paymentDate && (
                        <div><strong>Payment Date:</strong> {selectedClaim.reimbursementDetails.paymentDate}</div>
                      )}
                      {selectedClaim.reimbursementDetails.amountPaid && (
                        <div><strong>Amount Paid:</strong> ${selectedClaim.reimbursementDetails.amountPaid.toFixed(2)}</div>
                      )}
                      {selectedClaim.reimbursementDetails.taxDeducted && (
                        <div><strong>Tax Deducted:</strong> ${selectedClaim.reimbursementDetails.taxDeducted.toFixed(2)}</div>
                      )}
                      {selectedClaim.reimbursementDetails.netAmount && (
                        <div><strong>Net Amount:</strong> ${selectedClaim.reimbursementDetails.netAmount.toFixed(2)}</div>
                      )}
                      {selectedClaim.reimbursementDetails.bankTransferReference && (
                        <div className="col-span-2"><strong>Transfer Ref:</strong> {selectedClaim.reimbursementDetails.bankTransferReference}</div>
                      )}
                      {selectedClaim.reimbursementDetails.chequeNumber && (
                        <div className="col-span-2"><strong>Cheque Number:</strong> {selectedClaim.reimbursementDetails.chequeNumber}</div>
                      )}
                      {selectedClaim.reimbursementDetails.verifiedBy && (
                        <div><strong>Verified By:</strong> {selectedClaim.reimbursementDetails.verifiedBy}</div>
                      )}
                      {selectedClaim.reimbursementDetails.authorizedBy && (
                        <div><strong>Authorized By:</strong> {selectedClaim.reimbursementDetails.authorizedBy}</div>
                      )}
                      {selectedClaim.reimbursementDetails.processingNotes && (
                        <div className="col-span-2"><strong>Notes:</strong> {selectedClaim.reimbursementDetails.processingNotes}</div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}