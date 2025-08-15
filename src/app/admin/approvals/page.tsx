"use client";

import React, { useState, useEffect, useCallback, useTransition } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  AlertTriangle as AlertTriangleIcon, 
  CheckSquare, 
  Eye, 
  FileText, 
  Home, 
  Loader2, 
  ReceiptText, 
  ThumbsDown, 
  ThumbsUp, 
  Truck 
} from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import Link from 'next/link';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import type { TravelRequestForm, TrfStatus } from '@/types/trf';
import { getApprovalQueueFilters } from '@/lib/rbac-utils'; 

// Define a common interface for all approvable items
interface ApprovableItem {
  id: string;
  requestorName: string;
  itemType: 'TSR' | 'Claim' | 'Visa' | 'Accommodation' | 'Transport';
  purpose: string;
  status: string;
  submittedAt: string;
  amount?: number;
  destination?: string;
  travelType?: string;
  visaType?: string;
  checkInDate?: string;
  checkOutDate?: string;
  location?: string;
  department?: string;
  transportType?: string;
  documentNumber?: string; // For claims and other items that have user-friendly identifiers
}

// We'll fetch real data from the API instead of using mock data

export default function AdminApprovalsPage() {
  const [pendingItems, setPendingItems] = useState<ApprovableItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isActionPending, startActionTransition] = useTransition();
  const [rejectionComments, setRejectionComments] = useState("");
  const [approvalComments, setApprovalComments] = useState(""); 
  const [selectedItemForAction, setSelectedItemForAction] = useState<ApprovableItem | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'trf' | 'claim' | 'visa' | 'accommodation' | 'transport'>('all');

  const { toast } = useToast();

  const fetchPendingItems = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Get role-based approval filters
      const { roleSpecificStatuses, canApprove, roleContext } = await getApprovalQueueFilters();
      
      if (!canApprove || roleSpecificStatuses.length === 0) {
        console.log(`User role '${roleContext}' has no approval rights or no items to approve`);
        setPendingItems([]);
        return;
      }
      
      console.log(`Loading approval items for role: ${roleContext}, statuses: [${roleSpecificStatuses.join(', ')}]`);
      
      // Create an array to hold all approvable items
      let allPendingItems: ApprovableItem[] = [];
      
      // 1. Fetch pending TRFs (filter by role-specific statuses)
      const trfStatusesToFetch = roleSpecificStatuses.join(',');
      
      if (trfStatusesToFetch) {
        console.log(`AdminApprovalsPage: Fetching TRFs with statuses: ${trfStatusesToFetch}`);
        const trfResponse = await fetch(`/api/trf?statuses=${encodeURIComponent(trfStatusesToFetch)}&limit=50&excludeTravelType=Accommodation`);
        
        if (trfResponse.ok) {
        const trfData = await trfResponse.json();
        console.log("AdminApprovalsPage: Fetched TRFs data:", trfData);
        
        // Map TRF data to the common ApprovableItem format
        const trfItems = (trfData.trfs || []).map((trf: any) => ({
          id: trf.id,
          requestorName: trf.requestorName,
          itemType: 'TSR' as const,
          purpose: trf.purpose,
          status: trf.status,
          submittedAt: trf.submittedAt,
          travelType: trf.travelType,
          destination: trf.destination || trf.country
        }));
        
          allPendingItems = [...allPendingItems, ...trfItems];
        }
      }
      
      // 2. Fetch pending claims (filter by role-specific statuses)
      const claimStatusesToFetch = roleSpecificStatuses.join(',');
      
      if (claimStatusesToFetch) {
        console.log(`AdminApprovalsPage: Fetching Claims with statuses: ${claimStatusesToFetch}`);
        
        const claimResponse = await fetch(`/api/claims?statuses=${encodeURIComponent(claimStatusesToFetch)}&limit=50`);
        
        if (claimResponse.ok) {
        const claimData = await claimResponse.json();
        console.log("AdminApprovalsPage: Fetched Claims data:", claimData);
        
        // Map Claim data to the common ApprovableItem format
        const claimItems = (Array.isArray(claimData) ? claimData : claimData.claims || []).map((claim: any) => ({
          id: claim.id,
          requestorName: claim.requestor,
          itemType: 'Claim' as const,
          purpose: claim.purpose,
          status: claim.status,
          submittedAt: claim.submittedDate,
          amount: claim.amount,
          documentNumber: claim.document_number || claim.documentNumber
        }));
        
          allPendingItems = [...allPendingItems, ...claimItems];
        }
      }
      
      // 3. Fetch pending visa applications (filter by role-specific statuses) 
      if (roleSpecificStatuses.length > 0) {
        console.log(`AdminApprovalsPage: Fetching Visa applications with statuses: ${roleSpecificStatuses.join(',')}`);
        
        const visaResponse = await fetch(`/api/visa?statuses=${encodeURIComponent(roleSpecificStatuses.join(','))}&limit=50`);
        
        if (visaResponse.ok) {
          const visaData = await visaResponse.json();
          console.log("AdminApprovalsPage: Fetched Visa applications data:", visaData);
          
          // Map Visa data to the common ApprovableItem format
          const visaItems = (visaData.visaApplications || []).map((visa: any) => ({
            id: visa.id,
            requestorName: visa.applicantName,
            itemType: 'Visa' as const,
            purpose: visa.travelPurpose || 'Visa Application',
            status: visa.status,
            submittedAt: visa.submittedDate,
            visaType: visa.visaType,
            destination: visa.destination
          }));
          
          allPendingItems = [...allPendingItems, ...visaItems];
        }
      }
      
      // 4. Fetch pending accommodation requests
      try {
        const accommodationStatusesToFetch = ["Pending Department Focal", "Pending Line Manager", "Pending HOD"].join(',');
        console.log(`AdminApprovalsPage: Fetching Accommodation requests with statuses: ${accommodationStatusesToFetch}`);
        
        const accommodationResponse = await fetch(`/api/accommodation/requests?statuses=${encodeURIComponent(accommodationStatusesToFetch)}&limit=50`);
        
        if (accommodationResponse.ok) {
          const accommodationData = await accommodationResponse.json();
          console.log("AdminApprovalsPage: Fetched Accommodation requests data:", accommodationData);
          
          // Get already fetched TRF IDs to avoid duplicates
          const existingTrfIds = new Set(allPendingItems.map(item => item.id));
          
          // Map Accommodation data to the common ApprovableItem format, but exclude items already fetched as TRFs
          const accommodationItems = (accommodationData.accommodationRequests || [])
            .filter((accommodation: any) => !existingTrfIds.has(accommodation.id))
            .map((accommodation: any) => ({
              id: accommodation.id,
              requestorName: accommodation.requestorName,
              itemType: 'Accommodation' as const,
              purpose: accommodation.specialRequests || 'Accommodation Request',
              status: accommodation.status,
              submittedAt: accommodation.submittedDate,
              location: accommodation.location,
              checkInDate: accommodation.requestedCheckInDate,
              checkOutDate: accommodation.requestedCheckOutDate
            }));
          
          allPendingItems = [...allPendingItems, ...accommodationItems];
        } else {
          console.error("AdminApprovalsPage: Error fetching accommodation requests:", accommodationResponse.status, accommodationResponse.statusText);
        }
      } catch (err: any) {
        console.error("AdminApprovalsPage: Exception fetching accommodation requests:", err);
      }

      // 5. Fetch pending transport requests
      try {
        const transportStatusesToFetch = ["Pending Department Focal", "Pending Line Manager", "Pending HOD"].join(',');
        console.log(`AdminApprovalsPage: Fetching Transport requests with statuses: ${transportStatusesToFetch}`);
        
        const transportResponse = await fetch(`/api/transport?statuses=${encodeURIComponent(transportStatusesToFetch)}&limit=50`);
        
        if (transportResponse.ok) {
          const transportData = await transportResponse.json();
          console.log("AdminApprovalsPage: Fetched Transport requests data:", transportData);
          
          // Get already fetched IDs to avoid duplicates
          const existingItemIds = new Set(allPendingItems.map(item => item.id));
          
          // Handle both array and object responses, but exclude items already fetched
          const transportItems = (Array.isArray(transportData) ? transportData : transportData.transportRequests || [])
            .filter((transport: any) => !existingItemIds.has(transport.id))
            .map((transport: any) => ({
              id: transport.id,
              requestorName: transport.requestorName,
              itemType: 'Transport' as const,
              purpose: transport.purpose,
              status: transport.status,
              submittedAt: transport.submittedAt || transport.submitted_at || transport.createdAt,
              department: transport.department
            }));
          
          allPendingItems = [...allPendingItems, ...transportItems];
        } else {
          console.error("AdminApprovalsPage: Error fetching transport requests:", transportResponse.status, transportResponse.statusText);
        }
      } catch (err: any) {
        console.error("AdminApprovalsPage: Exception fetching transport requests:", err);
      }
      
      // Sort all items by submission date (newest first)
      allPendingItems.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
      
      setPendingItems(allPendingItems);
      
      if (allPendingItems.length === 0) {
        console.log("AdminApprovalsPage: No pending items found.");
      } else {
        console.log(`AdminApprovalsPage: Found ${allPendingItems.length} total pending items.`);
      }
      
    } catch (err: any) {
      console.error("AdminApprovalsPage: Error fetching pending items:", err);
      setError(err.message || "An unknown error occurred while fetching approval items.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPendingItems();
  }, [fetchPendingItems]);

  const handleAction = async (itemId: string, itemType: 'TSR' | 'Claim' | 'Visa' | 'Accommodation' | 'Transport', action: "approve" | "reject", comments?: string) => {
    if (!selectedItemForAction || selectedItemForAction.id !== itemId) {
        toast({ title: "Error", description: `No ${itemType} selected for action.`, variant: "destructive" });
        return;
    }
    
    startActionTransition(async () => {
      try {
        // Determine the correct approver role based on current status and item type
        let approverRole = "System";
        
        // Common patterns for most systems
        if (selectedItemForAction.status === 'Pending Department Focal') {
          approverRole = 'Department Focal';
        } else if (selectedItemForAction.status === 'Pending Line Manager') {
          approverRole = 'Line Manager';
        } else if (selectedItemForAction.status === 'Pending HOD') {
          approverRole = 'HOD';
        }
        
        // System-specific status patterns
        if (itemType === 'Visa') {
          if (selectedItemForAction.status === 'Pending Line Manager/HOD') {
            approverRole = 'Line Manager/HOD';
          } else if (selectedItemForAction.status === 'Pending Visa Clerk') {
            approverRole = 'Visa Clerk';
          }
        } else if (itemType === 'Claim') {
          if (selectedItemForAction.status === 'Pending Verification') {
            approverRole = 'Verifier';
          } else if (selectedItemForAction.status === 'Pending HOD Approval') {
            approverRole = 'HOD';
          } else if (selectedItemForAction.status === 'Pending Finance Approval') {
            approverRole = 'Finance';
          }
        }
        // Note: Accommodation uses TRF workflow, so it follows the common pattern above
        
        const payload = {
          action,
          comments: comments || (action === 'approve' ? "Approved by Admin." : "Rejected by Admin."),
          approverRole: approverRole, // Use dynamic role based on status
          approverName: "System Admin", // This would come from the logged-in user's session
        };

        // Determine the API endpoint based on item type
        let endpoint = '';
        switch (itemType) {
          case 'TSR':
            endpoint = `/api/trf/${itemId}/action`;
            break;
          case 'Claim':
            endpoint = `/api/claims/${itemId}/action`;
            break;
          case 'Visa':
            endpoint = `/api/visa/${itemId}/action`;
            break;
          case 'Accommodation':
            endpoint = `/api/accommodation/requests/${itemId}/action`;
            break;
          case 'Transport':
            endpoint = `/api/transport/${itemId}/action`;
            break;
        }

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || errorData.details || `Failed to ${action} ${itemType} ${itemId}.`);
        }

        toast({
          title: `${itemType} ${action === 'approve' ? 'Approved' : 'Rejected'}`,
          description: `${itemType} ID ${itemId} has been ${action === 'approve' ? 'approved' : 'rejected'}.`,
        });
        fetchPendingItems(); // Re-fetch the list to reflect changes
        setSelectedItemForAction(null);
        setRejectionComments("");
        setApprovalComments("");

      } catch (err: any) {
        toast({
          title: `Error ${action === 'approve' ? 'Approving' : 'Rejecting'} ${itemType}`,
          description: err.message || "An unexpected error occurred.",
          variant: "destructive",
        });
      }
    });
  };

  const getStatusBadgeVariant = (status: string) => {
    if (status?.toLowerCase().includes('approved')) return 'default';
    if (status?.toLowerCase().includes('rejected') || status?.toLowerCase().includes('cancelled')) return 'destructive';
    if (status?.toLowerCase().includes('pending')) return 'outline';
    if (["Processing Flights", "Processing Accommodation", "Awaiting Visa", "TRF Processed"].includes(status)) return 'default';
    return 'secondary';
  };

  // Filter items based on the active tab
  const filteredItems = pendingItems.filter(item => {
    if (activeTab === 'all') return true;
    if (activeTab === 'trf') return item.itemType === 'TSR';
    if (activeTab === 'transport') return item.itemType === 'Transport';
    return item.itemType.toLowerCase() === activeTab;
  });

  // Get the appropriate icon for each item type
  const getItemTypeIcon = (itemType: 'TSR' | 'Claim' | 'Visa' | 'Accommodation' | 'Transport') => {
    switch (itemType) {
      case 'TSR':
        return <Eye className="h-4 w-4 text-blue-500" />;
      case 'Claim':
        return <ReceiptText className="h-4 w-4 text-green-500" />;
      case 'Visa':
        return <FileText className="h-4 w-4 text-purple-500" />;
      case 'Accommodation':
        return <Home className="h-4 w-4 text-amber-500" />;
      case 'Transport':
        return <Truck className="h-4 w-4 text-orange-500" />;
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Unified Approval Queue</h1>
          <p className="text-muted-foreground">
            Review and process pending requests across all systems.
          </p>
        </div>
      </div>
      
      <div className="flex space-x-2 border-b pb-2 flex-wrap gap-y-2">
        <Button 
          variant={activeTab === 'all' ? "default" : "outline"} 
          size="sm" 
          onClick={() => setActiveTab('all')}
          className="rounded-full"
        >
          All Items ({pendingItems.length})
        </Button>
        <Button 
          variant={activeTab === 'trf' ? "default" : "outline"} 
          size="sm" 
          onClick={() => setActiveTab('trf')}
          className="rounded-full"
        >
          <Eye className="mr-1 h-4 w-4" />
          TSRs ({pendingItems.filter(i => i.itemType === 'TSR').length})
        </Button>
        <Button 
          variant={activeTab === 'claim' ? "default" : "outline"} 
          size="sm" 
          onClick={() => setActiveTab('claim')}
          className="rounded-full"
        >
          <ReceiptText className="mr-1 h-4 w-4" />
          Claims ({pendingItems.filter(i => i.itemType === 'Claim').length})
        </Button>
        <Button 
          variant={activeTab === 'visa' ? "default" : "outline"} 
          size="sm" 
          onClick={() => setActiveTab('visa')}
          className="rounded-full"
        >
          <FileText className="mr-1 h-4 w-4" />
          Visas ({pendingItems.filter(i => i.itemType === 'Visa').length})
        </Button>
        <Button 
          variant={activeTab === 'accommodation' ? "default" : "outline"} 
          size="sm" 
          onClick={() => setActiveTab('accommodation')}
          className="rounded-full"
        >
          <Home className="mr-1 h-4 w-4" />
          Accommodation ({pendingItems.filter(i => i.itemType === 'Accommodation').length})
        </Button>
        <Button 
          variant={activeTab === 'transport' ? "default" : "outline"} 
          size="sm" 
          onClick={() => setActiveTab('transport')}
          className="rounded-full"
        >
          <Truck className="mr-1 h-4 w-4" />
          Transport ({pendingItems.filter(i => i.itemType === 'Transport').length})
        </Button>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Pending Approvals</CardTitle>
          <CardDescription>Items awaiting your verification or approval.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-40"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2 text-muted-foreground">Loading pending items...</p></div>
          ) : error ? (
            <div className="text-center py-8"><AlertTriangleIcon className="mx-auto h-12 w-12 text-destructive" /><h3 className="mt-2 text-lg font-medium text-destructive">Error Loading Items</h3><p className="mt-1 text-sm text-muted-foreground">{error}</p><Button onClick={fetchPendingItems} className="mt-4">Try Again</Button></div>
          ) : filteredItems.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Requestor</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Purpose</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Badge variant="outline" className="flex items-center gap-1">
                        {getItemTypeIcon(item.itemType)}
                        {item.itemType}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {item.itemType === 'Claim' && item.documentNumber ? item.documentNumber : item.id}
                    </TableCell>
                    <TableCell>{item.requestorName}</TableCell>
                    <TableCell>
                      {item.itemType === 'TSR' && (
                        <div className="text-xs text-muted-foreground mt-1">
                          <span className="font-medium">Travel:</span> {item.travelType} {item.destination && `to ${item.destination}`}
                        </div>
                      )}
                      {item.itemType === 'Claim' && item.amount && (
                        <div className="text-xs text-muted-foreground mt-1">
                          <span className="font-medium">Amount:</span> ${item.amount.toFixed(2)}
                        </div>
                      )}
                      {item.itemType === 'Visa' && (
                        <div className="text-xs text-muted-foreground mt-1">
                          <span className="font-medium">Type:</span> {item.visaType} {item.destination && `for ${item.destination}`}
                        </div>
                      )}
                      {item.itemType === 'Accommodation' && (
                        <div className="text-xs text-muted-foreground mt-1">
                          <span className="font-medium">Location:</span> {item.location}
                          {item.checkInDate && item.checkOutDate && (
                            <span className="ml-2">
                              <span className="font-medium">Period:</span> {new Date(item.checkInDate).toLocaleDateString()} - {new Date(item.checkOutDate).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      )}
                      {item.itemType === 'Transport' && (
                        <div className="text-xs text-muted-foreground mt-1">
                          <span className="font-medium">Department:</span> {item.department || 'N/A'}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{item.purpose}</TableCell>
                    <TableCell><Badge variant={getStatusBadgeVariant(item.status as TrfStatus)} className={item.status === "Approved" ? "bg-green-600 text-white" : ""}>{item.status}</Badge></TableCell>
                    <TableCell>{format(parseISO(item.submittedAt), 'PPP p')}</TableCell>
                    <TableCell className="space-x-1 text-center">
                      {/* View button with appropriate link based on item type */}
                      <Button variant="outline" size="icon" asChild className="h-8 w-8">
                        <Link 
                          href={
                            item.itemType === 'TSR' ? `/trf/view/${item.id}` : 
                            item.itemType === 'Claim' ? `/claims/view/${item.id}` : 
                            item.itemType === 'Accommodation' ? `/accommodation/view/${item.id}` :
                            item.itemType === 'Transport' ? `/transport/view/${item.id}` :
                            `/visa/view/${item.id}`
                          } 
                          title={`View ${item.itemType} Details`}
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                      
                      {/* Approve button */}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="icon" 
                            className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-600/10" 
                            title={`Approve ${item.itemType}`} 
                            onClick={() => setSelectedItemForAction(item)} 
                            disabled={isActionPending}
                          >
                            <ThumbsUp className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Approve {selectedItemForAction?.itemType} {selectedItemForAction?.id}?</AlertDialogTitle>
                            <AlertDialogDescription>Confirm approval for {selectedItemForAction?.itemType} submitted by {selectedItemForAction?.requestorName}.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <div className="space-y-2">
                            <Label htmlFor="approveComments">Optional Comments:</Label>
                            <Textarea id="approveComments" placeholder="Add any comments for approval..." value={approvalComments} onChange={(e) => setApprovalComments(e.target.value)} />
                          </div>
                          <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => { setSelectedItemForAction(null); setApprovalComments(""); }} disabled={isActionPending}>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => selectedItemForAction && handleAction(selectedItemForAction.id, selectedItemForAction.itemType, 'approve', approvalComments)} disabled={isActionPending} className="bg-green-600 hover:bg-green-700">{isActionPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Approve</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      
                      {/* Reject button */}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="icon" 
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" 
                            title={`Reject ${item.itemType}`} 
                            onClick={() => setSelectedItemForAction(item)} 
                            disabled={isActionPending}
                          >
                            <ThumbsDown className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Reject {selectedItemForAction?.itemType} {selectedItemForAction?.id}?</AlertDialogTitle>
                            <AlertDialogDescription>Provide a reason for rejecting {selectedItemForAction?.itemType} submitted by {selectedItemForAction?.requestorName}.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <div className="space-y-2">
                            <Label htmlFor="rejectionReason">Reason for Rejection (Required)</Label>
                            <Textarea id="rejectionReason" placeholder="Enter rejection comments..." value={rejectionComments} onChange={(e) => setRejectionComments(e.target.value)} />
                          </div>
                          <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => { setSelectedItemForAction(null); setRejectionComments(""); }} disabled={isActionPending}>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => selectedItemForAction && handleAction(selectedItemForAction.id, selectedItemForAction.itemType, 'reject', rejectionComments)} disabled={isActionPending || !rejectionComments.trim()} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">{isActionPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Reject</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg">
              <CheckSquare className="w-16 h-16 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {activeTab === 'all' 
                  ? 'No items currently pending your approval.' 
                  : `No ${activeTab === 'trf' ? 'TSRs' : activeTab === 'claim' ? 'Claims' : 'Visa Applications'} currently pending your approval.`}
              </p>
              <p className="text-sm text-muted-foreground">Check back later or adjust filters if applicable.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
