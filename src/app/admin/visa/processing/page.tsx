"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { format, parseISO, isValid } from "date-fns";
import { FileCheck, Eye, Search, Upload, CheckCircle, XCircle, Clock, AlertTriangle, FileText, Loader2, Globe } from "lucide-react";
import { useSessionPermissions } from '@/hooks/use-session-permissions';
import { StatusBadge } from '@/lib/status-utils';
import { useToast } from '@/hooks/use-toast';

interface VisaListItem {
  id: string;
  requestorName: string; 
  staffId?: string;
  purpose: string;
  destination: string;
  status: string;
  submittedAt: string;
  tsrReference?: string;
  processingDetails?: VisaProcessingDetails;
}

interface VisaProcessingDetails {
  paymentMethod?: string;
  bankTransferReference?: string;
  chequeNumber?: string;
  paymentDate?: string;
  applicationFee?: number;
  processingFee?: number;
  totalFee?: number;
  visaNumber?: string;
  visaValidFrom?: string;
  visaValidTo?: string;
  processingNotes?: string;
  verifiedBy?: string;
  authorizedBy?: string;
}

interface VisaDetails extends VisaListItem {
  applicantName?: string;
  employeeId?: string;
  travelPurpose?: string;
  tripStartDate?: string;
  tripEndDate?: string;
  passportNumber?: string;
  passportExpiryDate?: string;
  itineraryDetails?: string;
  processingDetails?: VisaProcessingDetails;
}

const VisaProcessingPage = () => {
  const [approvedVisas, setApprovedVisas] = useState<VisaListItem[]>([]);
  const [processingVisas, setProcessingVisas] = useState<VisaListItem[]>([]);
  const [completedVisas, setCompletedVisas] = useState<VisaListItem[]>([]);
  const [activeTab, setActiveTab] = useState<'approved' | 'processing' | 'completed'>('approved');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedVisa, setSelectedVisa] = useState<VisaDetails | null>(null);
  const [isProcessingDialogOpen, setIsProcessingDialogOpen] = useState(false);
  const [processingAction, setProcessingAction] = useState<'process' | 'complete'>('process');
  const [processingLoading, setProcessingLoading] = useState(false);
  
  // Processing form state
  const [processingDetails, setProcessingDetails] = useState<VisaProcessingDetails>({
    paymentMethod: 'Bank Transfer',
    applicationFee: 0,
    processingFee: 0,
    totalFee: 0,
    verifiedBy: '',
    authorizedBy: ''
  });
  
  const { toast } = useToast();
  
  const fetchVisas = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch approved visas (ready for processing) - these are HOD approved applications
      const approvedResponse = await fetch(`/api/admin/visa?statuses=Processing with Visa Admin`);
      if (approvedResponse.ok) {
        const approvedData = await approvedResponse.json();
        setApprovedVisas(approvedData);
      }
      
      // Fetch processing visas (this will be empty now as we removed the intermediate processing status)
      // Keep for future use if needed, but set to empty for now
      setProcessingVisas([]);
      
      // Fetch completed visas
      const completedResponse = await fetch(`/api/admin/visa?statuses=Processed,Rejected`);
      if (completedResponse.ok) {
        const completedData = await completedResponse.json();
        setCompletedVisas(completedData);
      }
      
    } catch (error) {
      console.error('Error fetching visas:', error);
      toast({
        title: "Error",
        description: "Failed to fetch visa applications",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);
  
  useEffect(() => {
    fetchVisas();
  }, [fetchVisas]);
  
  const getCurrentTabData = () => {
    switch (activeTab) {
      case 'approved': return approvedVisas;
      case 'processing': return processingVisas;
      case 'completed': return completedVisas;
      default: return [];
    }
  };
  
  const getTabCounts = () => ({
    approved: approvedVisas.length,
    processing: processingVisas.length,
    completed: completedVisas.length
  });
  
  const openProcessingDialog = async (visa: VisaListItem) => {
    try {
      // Fetch full visa details
      const response = await fetch(`/api/visa/${visa.id}`);
      if (response.ok) {
        const visaData = await response.json();
        console.log('Visa data from API:', visaData);
        console.log('Visa application:', visaData.visaApplication);
        console.log('Visa application ID:', visaData.visaApplication?.id);
        setSelectedVisa(visaData.visaApplication);
        setProcessingAction('complete'); // Visa admin always completes processing directly
        
        // Reset processing details
        setProcessingDetails({
          paymentMethod: 'Bank Transfer',
          applicationFee: 0,
          processingFee: 0,
          totalFee: 0,
          verifiedBy: '',
          authorizedBy: ''
        });
        
        setIsProcessingDialogOpen(true);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch visa details",
        variant: "destructive",
      });
    }
  };
  
  const handleProcessVisa = async () => {
    if (!selectedVisa) return;
    
    console.log('handleProcessVisa called with selectedVisa:', selectedVisa);
    console.log('selectedVisa.id:', selectedVisa.id);
    
    setProcessingLoading(true);
    try {
      const response = await fetch(`/api/visa/${selectedVisa.id}/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: processingAction,
          processingDetails: processingAction === 'complete' ? processingDetails : undefined,
          comments: `Visa processing completed. ${processingDetails.processingNotes || ''}`
        }),
      });
      
      if (response.ok) {
        toast({
          title: "Success", 
          description: "Visa processing completed successfully",
        });
        setIsProcessingDialogOpen(false);
        fetchVisas(); // Refresh the data
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to process visa",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process visa application",
        variant: "destructive",
      });
    } finally {
      setProcessingLoading(false);
    }
  };
  
  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = parseISO(dateString);
    return isValid(date) ? format(date, 'MMM dd, yyyy') : 'Invalid Date';
  };

  // Format visa summary with processing details for completed visas
  const formatVisaSummary = (visa: VisaListItem) => {
    // Show processing details for completed visas (similar to claims processing)
    if (visa.processingDetails && (visa.status === 'Processed')) {
      const processing = visa.processingDetails;
      const parts = [];
      if (processing.paymentMethod) parts.push(`Payment: ${processing.paymentMethod}`);
      if (processing.totalFee) parts.push(`Total: $${processing.totalFee.toFixed(2)}`);
      if (processing.visaNumber) parts.push(`Visa: ${processing.visaNumber}`);
      if (processing.paymentDate) parts.push(`Date: ${processing.paymentDate}`);
      return parts.join(' | ') || visa.purpose;
    }
    
    return visa.purpose;
  };
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Processing with Visa Admin': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'Processed': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'Rejected': return <XCircle className="h-4 w-4 text-red-600" />;
      default: return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    }
  };
  
  const tabCounts = getTabCounts();
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileCheck className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">Visa Processing</h1>
        </div>
      </div>
      
      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ready for Processing</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tabCounts.approved}</div>
            <p className="text-xs text-muted-foreground">Approved visa applications</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processing</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tabCounts.processing}</div>
            <p className="text-xs text-muted-foreground">Currently being processed</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tabCounts.completed}</div>
            <p className="text-xs text-muted-foreground">Visas issued or rejected</p>
          </CardContent>
        </Card>
      </div>
      
      {/* Tabs */}
      <Card>
        <CardHeader>
          <div className="flex space-x-4 border-b">
            <button
              className={`pb-2 px-4 font-medium transition-colors ${
                activeTab === 'approved' 
                  ? 'border-b-2 border-primary text-primary' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveTab('approved')}
            >
              Ready for Processing ({tabCounts.approved})
            </button>
            <button
              className={`pb-2 px-4 font-medium transition-colors ${
                activeTab === 'processing' 
                  ? 'border-b-2 border-primary text-primary' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveTab('processing')}
            >
              Processing ({tabCounts.processing})
            </button>
            <button
              className={`pb-2 px-4 font-medium transition-colors ${
                activeTab === 'completed' 
                  ? 'border-b-2 border-primary text-primary' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveTab('completed')}
            >
              Completed ({tabCounts.completed})
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Visa ID</TableHead>
                <TableHead>Applicant</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Purpose</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {getCurrentTabData().map((visa) => (
                <TableRow key={visa.id}>
                  <TableCell className="font-medium">{visa.id}</TableCell>
                  <TableCell>{visa.requestorName}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      {visa.destination}
                    </div>
                  </TableCell>
                  <TableCell>{formatVisaSummary(visa)}</TableCell>
                  <TableCell>
                    <StatusBadge status={visa.status} showIcon />
                  </TableCell>
                  <TableCell>{formatDate(visa.submittedAt)}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/visa/view/${visa.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                      {visa.status === 'Processing with Visa Admin' && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => openProcessingDialog(visa)}
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {getCurrentTabData().length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No visa applications in this status
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Processing Dialog */}
      <Dialog open={isProcessingDialogOpen} onOpenChange={setIsProcessingDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Complete Visa Processing
            </DialogTitle>
            <DialogDescription>
              {selectedVisa && `Processing visa application ${selectedVisa.id} for ${selectedVisa.requestorName}`}
            </DialogDescription>
          </DialogHeader>
          
          {selectedVisa && (
            <div className="space-y-6">
              {/* Visa Information */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <Label className="text-sm font-medium">Applicant</Label>
                  <p className="text-sm">{selectedVisa.requestorName}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Destination</Label>
                  <p className="text-sm">{selectedVisa.destination}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Purpose</Label>
                  <p className="text-sm">{selectedVisa.purpose}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Submitted</Label>
                  <p className="text-sm">{formatDate(selectedVisa.submittedAt)}</p>
                </div>
              </div>

              {/* Display existing processing details for completed visas */}
              {selectedVisa.processingDetails && (
                <div>
                  <span className="font-medium text-muted-foreground">Processing Details:</span>
                  <div className="mt-2 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {selectedVisa.processingDetails.paymentMethod && (
                        <div><strong>Payment Method:</strong> {selectedVisa.processingDetails.paymentMethod}</div>
                      )}
                      {selectedVisa.processingDetails.paymentDate && (
                        <div><strong>Payment Date:</strong> {selectedVisa.processingDetails.paymentDate}</div>
                      )}
                      {selectedVisa.processingDetails.applicationFee && (
                        <div><strong>Application Fee:</strong> ${selectedVisa.processingDetails.applicationFee.toFixed(2)}</div>
                      )}
                      {selectedVisa.processingDetails.processingFee && (
                        <div><strong>Processing Fee:</strong> ${selectedVisa.processingDetails.processingFee.toFixed(2)}</div>
                      )}
                      {selectedVisa.processingDetails.totalFee && (
                        <div><strong>Total Fee:</strong> ${selectedVisa.processingDetails.totalFee.toFixed(2)}</div>
                      )}
                      {selectedVisa.processingDetails.visaNumber && (
                        <div><strong>Visa Number:</strong> {selectedVisa.processingDetails.visaNumber}</div>
                      )}
                      {selectedVisa.processingDetails.visaValidFrom && (
                        <div><strong>Visa Valid From:</strong> {selectedVisa.processingDetails.visaValidFrom}</div>
                      )}
                      {selectedVisa.processingDetails.visaValidTo && (
                        <div><strong>Visa Valid To:</strong> {selectedVisa.processingDetails.visaValidTo}</div>
                      )}
                      {selectedVisa.processingDetails.bankTransferReference && (
                        <div className="col-span-2"><strong>Transfer Ref:</strong> {selectedVisa.processingDetails.bankTransferReference}</div>
                      )}
                      {selectedVisa.processingDetails.chequeNumber && (
                        <div className="col-span-2"><strong>Cheque Number:</strong> {selectedVisa.processingDetails.chequeNumber}</div>
                      )}
                      {selectedVisa.processingDetails.verifiedBy && (
                        <div><strong>Verified By:</strong> {selectedVisa.processingDetails.verifiedBy}</div>
                      )}
                      {selectedVisa.processingDetails.authorizedBy && (
                        <div><strong>Authorized By:</strong> {selectedVisa.processingDetails.authorizedBy}</div>
                      )}
                      {selectedVisa.processingDetails.processingNotes && (
                        <div className="col-span-2"><strong>Notes:</strong> {selectedVisa.processingDetails.processingNotes}</div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              {processingAction === 'complete' && (
                <>
                  <div className="space-y-4">
                    <h4 className="font-medium">Processing Details</h4>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="paymentMethod">Payment Method</Label>
                        <Select 
                          value={processingDetails.paymentMethod} 
                          onValueChange={(value) => setProcessingDetails(prev => ({ ...prev, paymentMethod: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                            <SelectItem value="Cheque">Cheque</SelectItem>
                            <SelectItem value="Cash">Cash</SelectItem>
                            <SelectItem value="Credit Card">Credit Card</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      {processingDetails.paymentMethod === 'Bank Transfer' && (
                        <div>
                          <Label htmlFor="bankTransferRef">Bank Transfer Reference</Label>
                          <Input
                            id="bankTransferRef"
                            value={processingDetails.bankTransferReference || ''}
                            onChange={(e) => setProcessingDetails(prev => ({ ...prev, bankTransferReference: e.target.value }))}
                            placeholder="Enter reference number"
                          />
                        </div>
                      )}
                      
                      {processingDetails.paymentMethod === 'Cheque' && (
                        <div>
                          <Label htmlFor="chequeNumber">Cheque Number</Label>
                          <Input
                            id="chequeNumber"
                            value={processingDetails.chequeNumber || ''}
                            onChange={(e) => setProcessingDetails(prev => ({ ...prev, chequeNumber: e.target.value }))}
                            placeholder="Enter cheque number"
                          />
                        </div>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="applicationFee">Application Fee</Label>
                        <Input
                          id="applicationFee"
                          type="number"
                          value={processingDetails.applicationFee || 0}
                          onChange={(e) => {
                            const fee = Number(e.target.value) || 0;
                            setProcessingDetails(prev => ({ 
                              ...prev, 
                              applicationFee: fee,
                              totalFee: fee + (prev.processingFee || 0)
                            }));
                          }}
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <Label htmlFor="processingFee">Processing Fee</Label>
                        <Input
                          id="processingFee"
                          type="number"
                          value={processingDetails.processingFee || 0}
                          onChange={(e) => {
                            const fee = Number(e.target.value) || 0;
                            setProcessingDetails(prev => ({ 
                              ...prev, 
                              processingFee: fee,
                              totalFee: (prev.applicationFee || 0) + fee
                            }));
                          }}
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <Label htmlFor="totalFee">Total Fee</Label>
                        <Input
                          id="totalFee"
                          type="number"
                          value={processingDetails.totalFee || 0}
                          readOnly
                          className="bg-muted"
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="visaNumber">Visa Number</Label>
                        <Input
                          id="visaNumber"
                          value={processingDetails.visaNumber || ''}
                          onChange={(e) => setProcessingDetails(prev => ({ ...prev, visaNumber: e.target.value }))}
                          placeholder="Enter visa number"
                        />
                      </div>
                      <div>
                        <Label htmlFor="paymentDate">Payment Date</Label>
                        <Input
                          id="paymentDate"
                          type="date"
                          value={processingDetails.paymentDate || ''}
                          onChange={(e) => setProcessingDetails(prev => ({ ...prev, paymentDate: e.target.value }))}
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="visaValidFrom">Visa Valid From</Label>
                        <Input
                          id="visaValidFrom"
                          type="date"
                          value={processingDetails.visaValidFrom || ''}
                          onChange={(e) => setProcessingDetails(prev => ({ ...prev, visaValidFrom: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="visaValidTo">Visa Valid To</Label>
                        <Input
                          id="visaValidTo"
                          type="date"
                          value={processingDetails.visaValidTo || ''}
                          onChange={(e) => setProcessingDetails(prev => ({ ...prev, visaValidTo: e.target.value }))}
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="verifiedBy">Verified By</Label>
                        <Input
                          id="verifiedBy"
                          value={processingDetails.verifiedBy || ''}
                          onChange={(e) => setProcessingDetails(prev => ({ ...prev, verifiedBy: e.target.value }))}
                          placeholder="Enter name"
                        />
                      </div>
                      <div>
                        <Label htmlFor="authorizedBy">Authorized By</Label>
                        <Input
                          id="authorizedBy"
                          value={processingDetails.authorizedBy || ''}
                          onChange={(e) => setProcessingDetails(prev => ({ ...prev, authorizedBy: e.target.value }))}
                          placeholder="Enter name"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="processingNotes">Processing Notes</Label>
                      <Textarea
                        id="processingNotes"
                        value={processingDetails.processingNotes || ''}
                        onChange={(e) => setProcessingDetails(prev => ({ ...prev, processingNotes: e.target.value }))}
                        placeholder="Enter any processing notes or comments"
                        rows={3}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsProcessingDialogOpen(false)}
              disabled={processingLoading}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleProcessVisa}
              disabled={processingLoading}
            >
              {processingLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {processingAction === 'complete' ? 'Complete Processing' : 'Start Processing'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Globe icon component
function Globe(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="2" x2="22" y1="12" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

export default VisaProcessingPage;