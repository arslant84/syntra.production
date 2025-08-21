
"use client";

export const dynamic = 'force-dynamic';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ReceiptText, ListFilter, Search, AlertCircle, CheckCircle, XCircle, Clock, FileText, Eye, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { useSessionPermissions } from '@/hooks/use-session-permissions';
import { shouldShowRequest } from '@/lib/client-rbac-utils';
import { useToast } from '@/hooks/use-toast';
import { LoadingPage, LoadingSpinner } from '@/components/ui/loading';
import { StatusBadge } from '@/lib/status-utils';

type Claim = {
  id: string;
  requestor: string;
  purpose: string;
  amount: number;
  status: string;
  submittedDate: string;
  trfId?: string;
};


export default function AdminClaimsPage() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  
  // Processing dialog state
  const [processingDialogOpen, setProcessingDialogOpen] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [processingAction, setProcessingAction] = useState<'approve' | 'reject' | 'verify'>('verify');
  const [processingComments, setProcessingComments] = useState('');
  const [processingLoading, setProcessingLoading] = useState(false);
  const [verificationAmount, setVerificationAmount] = useState<string>('');
  
  const { role, userId, isLoading: sessionLoading } = useSessionPermissions();
  const { toast } = useToast();

  useEffect(() => {
    const fetchClaims = async () => {
      if (sessionLoading || !role) {
        return; // Don't fetch while session is loading or role is not available
      }
      
      try {
        setLoading(true);
        console.log('Fetching claims from API for admin...');
        const response = await fetch('/api/claims');
        
        if (!response.ok) {
          throw new Error(`Error fetching claims: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Fetched claims data:', data);
        
        // Handle both array response and nested claims property
        const claimsData = Array.isArray(data) ? data : data.claims;
        
        if (claimsData && Array.isArray(claimsData)) {
          // Apply role-based filtering for personal vs admin view using client-side logic
          const filteredClaims = claimsData.filter(claim =>
            shouldShowRequest(role, { ...claim, itemType: 'claim' }, userId)
          );
          setClaims(filteredClaims);
        } else {
          console.warn('No valid claims data found');
          setClaims([]);
        }
      } catch (err) {
        console.error('Failed to fetch claims:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch claims');
      } finally {
        setLoading(false);
      }
    };

    fetchClaims();
  }, [role, userId, sessionLoading]);

  // Filter claims based on status and search query
  const filteredClaims = claims.filter(claim => {
    // Status filter
    if (statusFilter && statusFilter !== 'all' && claim.status.toLowerCase() !== statusFilter.toLowerCase()) {
      return false;
    }
    
    // Search query filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        claim.id.toLowerCase().includes(query) ||
        claim.requestor.toLowerCase().includes(query) ||
        claim.purpose.toLowerCase().includes(query) ||
        (claim.trfId && claim.trfId.toLowerCase().includes(query))
      );
    }
    
    return true;
  });

  // Using unified status badge system

  const openProcessingDialog = (claim: Claim) => {
    setSelectedClaim(claim);
    setProcessingAction(claim.status.toLowerCase() === 'pending verification' ? 'verify' : 'approve');
    setProcessingComments('');
    setVerificationAmount(claim.amount.toString());
    setProcessingDialogOpen(true);
  };

  const handleClaimAction = async (claimId: string, action: string, comments?: string) => {
    setProcessingLoading(true);
    try {
      const response = await fetch(`/api/claims/${claimId}/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          approverRole: 'Claims Administrator',
          approverName: 'Claims Admin',
          comments: comments || `Claim ${action}ed by Claims Administrator`
        }),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: `Claim ${action}ed successfully`,
        });
        // Refresh the data
        window.location.reload();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || `Failed to ${action} claim`,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process claim action",
        variant: "destructive",
      });
    } finally {
      setProcessingLoading(false);
    }
  };

  const handleProcessingSubmit = async () => {
    if (!selectedClaim) return;

    setProcessingLoading(true);
    try {
      let requestBody: any = {
        approverRole: 'Claims Administrator',
        approverName: 'Claims Admin',
      };

      if (processingAction === 'verify') {
        requestBody.action = 'verify';
        requestBody.verifiedAmount = parseFloat(verificationAmount);
        requestBody.comments = `Claim verified. Amount: $${verificationAmount} USD. ${processingComments}`;
      } else if (processingAction === 'approve') {
        requestBody.action = 'approve';
        requestBody.comments = `Claim approved by Claims Administrator. ${processingComments}`;
      } else {
        requestBody.action = 'reject';
        requestBody.comments = `Claim rejected by Claims Administrator. Reason: ${processingComments}`;
      }

      const response = await fetch(`/api/claims/${selectedClaim.id}/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Claim processing completed successfully",
        });
        setProcessingDialogOpen(false);
        // Refresh the data
        window.location.reload();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to process claim",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process claim",
        variant: "destructive",
      });
    } finally {
      setProcessingLoading(false);
    }
  };
  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <ReceiptText className="w-8 h-8 text-primary" />
            Claims Administration
          </h1>
          <p className="text-muted-foreground">
            Review, verify, and process staff expense claims.
          </p>
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Search & Filter Claims</CardTitle>
          <CardDescription>Find specific claims or filter by status, department, etc.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col md:flex-row gap-3">
            <div className="relative w-full md:flex-grow">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                type="search" 
                placeholder="Search by Claim ID, TRF ID, Name..." 
                className="pl-8 w-full" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <ListFilter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Filter by Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending verification">Pending Verification</SelectItem>
                <SelectItem value="pending approval">Pending Approval</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              className="w-full md:w-auto"
              onClick={() => {
                setStatusFilter("");
                setSearchQuery("");
              }}
              variant="outline"
            >
              Clear Filters
            </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Submitted Claims</CardTitle>
          <CardDescription>List of expense claims submitted for processing.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingPage message="Loading claims..." />
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-40 text-red-500">
              <AlertCircle className="w-12 h-12 mb-3" />
              <p>Error: {error}</p>
            </div>
          ) : filteredClaims.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Claim ID</TableHead>
                  <TableHead>TRF ID</TableHead>
                  <TableHead>Requestor</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClaims.map((claim) => (
                  <TableRow key={claim.id}>
                    <TableCell className="font-medium">{claim.id.substring(0, 8)}</TableCell>
                    <TableCell>
                      {claim.trfId ? (
                        <Link href={`/trf/view/${claim.trfId}`} className="text-primary hover:underline">
                          {claim.trfId}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">N/A</span>
                      )}
                    </TableCell>
                    <TableCell>{claim.requestor}</TableCell>
                    <TableCell>${claim.amount.toFixed(2)} USD</TableCell>
                    <TableCell>
                      {claim.submittedDate ? format(new Date(claim.submittedDate), 'dd MMM yyyy') : '-'}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={claim.status} showIcon={true} />
                    </TableCell>
                    <TableCell className="space-x-1 text-center">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/admin/claims/view/${claim.id}`}>
                          <Eye className="w-4 h-4" />
                        </Link>
                      </Button>
                      {claim.status.toLowerCase() === 'pending verification' && (
                        <>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            title="Verify Claim"
                            onClick={() => openProcessingDialog(claim)}
                          >
                            <Upload className="h-4 w-4 text-blue-600" />
                          </Button>
                        </>
                      )}
                      {claim.status.toLowerCase() === 'pending approval' && (
                        <>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            title="Process Claim"
                            onClick={() => openProcessingDialog(claim)}
                          >
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          </Button>
                        </>
                      )}
                      {(claim.status.toLowerCase() === 'pending verification' || claim.status.toLowerCase() === 'pending approval') && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          title="Reject Claim"
                          onClick={() => {
                            setSelectedClaim(claim);
                            setProcessingAction('reject');
                            setProcessingComments('');
                            setProcessingDialogOpen(true);
                          }}
                        >
                          <XCircle className="h-4 w-4 text-red-600" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center h-40 border-2 border-dashed rounded-lg">
              <ReceiptText className="w-12 h-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No claims found based on current filters.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Claims Processing Dialog */}
      <Dialog open={processingDialogOpen} onOpenChange={setProcessingDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {processingAction === 'verify' ? 'Verify Claim' :
               processingAction === 'approve' ? 'Approve Claim' : 'Reject Claim'}
            </DialogTitle>
            <DialogDescription>
              {selectedClaim && (
                <>
                  Processing claim {selectedClaim.id} from {selectedClaim.requestor}
                  {processingAction === 'verify' && ' - Verify claim details and amount'}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {processingAction === 'verify' && selectedClaim && (
              <>
                <div>
                  <Label htmlFor="original-amount">Original Amount</Label>
                  <Input
                    id="original-amount"
                    value={`$${selectedClaim.amount.toFixed(2)} USD`}
                    disabled
                    className="bg-muted"
                  />
                </div>
                <div>
                  <Label htmlFor="verified-amount">Verified Amount</Label>
                  <Input
                    id="verified-amount"
                    type="number"
                    step="0.01"
                    placeholder="Enter verified amount"
                    value={verificationAmount}
                    onChange={(e) => setVerificationAmount(e.target.value)}
                  />
                </div>
              </>
            )}

            {processingAction === 'approve' && (
              <div className="space-y-2">
                <Label>Processing Options</Label>
                <div className="flex gap-2">
                  <Button
                    variant={processingAction === 'approve' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setProcessingAction('approve')}
                  >
                    Approve
                  </Button>
                  <Button
                    variant={processingAction === 'reject' ? 'destructive' : 'outline'}
                    size="sm"
                    onClick={() => setProcessingAction('reject')}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="processing-comments">
                {processingAction === 'reject' ? 'Rejection Reason' : 'Comments'}
              </Label>
              <Textarea
                id="processing-comments"
                placeholder={
                  processingAction === 'reject' 
                    ? "Enter reason for rejection" 
                    : "Enter any additional comments or notes"
                }
                value={processingComments}
                onChange={(e) => setProcessingComments(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setProcessingDialogOpen(false)}
              disabled={processingLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleProcessingSubmit}
              disabled={processingLoading || 
                (processingAction === 'verify' && !verificationAmount) ||
                (processingAction === 'reject' && !processingComments)
              }
            >
              {processingLoading && <LoadingSpinner size="sm" className="mr-2" />}
              {processingAction === 'verify' ? 'Verify' :
               processingAction === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
