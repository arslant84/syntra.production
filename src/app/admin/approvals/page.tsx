"use client";

import React, { useState, useEffect, useCallback, useTransition, useMemo } from 'react';
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
  Truck,
  Search,
  ListFilter,
  X,
  Calendar
} from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import Link from 'next/link';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import type { TravelRequestForm, TrfStatus } from '@/types/trf';
import { getApprovalQueueFilters } from '@/lib/client-rbac-utils';
import { useSessionPermissions } from '@/hooks/use-session-permissions';
import { StatusBadge } from '@/lib/status-utils';
import { useDebounce } from "@/hooks/use-debounce"; 

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
  const [lastFetch, setLastFetch] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasInitialRefresh, setHasInitialRefresh] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const CACHE_DURATION = 3 * 60 * 1000; // 3 minutes cache
  const PAGE_SIZE = 20;
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [dateRangeFilter, setDateRangeFilter] = useState<string>("all"); // all, today, week, month

  const { toast } = useToast();
  const { user, role, isLoading: sessionLoading, isAuthenticated } = useSessionPermissions();

  const fetchPendingItems = useCallback(async (forceRefresh = false, pageNum = 1) => {
    if (sessionLoading || !role) {
      return; // Don't fetch while session is loading or role is not available
    }
    
    // Check cache validity
    const now = Date.now();
    const cacheIsValid = (now - lastFetch) < CACHE_DURATION;

    // Force refresh if cache is stale or we haven't done initial refresh
    if (!forceRefresh && pendingItems.length > 0 && cacheIsValid && hasInitialRefresh && pageNum === 1) {
      console.log('Using cached approval items');
      return;
    }

    // Mark that we're doing initial refresh
    if (!hasInitialRefresh) {
      setHasInitialRefresh(true);
    }
    
    setIsLoading(true);
    setError(null);
    try {
      // Get role-based approval filters using client-side role
      const { roleSpecificStatuses, canApprove, roleContext } = getApprovalQueueFilters(role);
      
      if (!canApprove || roleSpecificStatuses.length === 0) {
        console.log(`User role '${roleContext}' has no approval rights or no items to approve`);
        setPendingItems([]);
        return;
      }
      
      console.log(`Loading approval items for role: ${roleContext}, statuses: [${roleSpecificStatuses.join(', ')}]`);
      
      // Create an array to hold all approvable items
      let allPendingItems: ApprovableItem[] = [];
      
      console.log(`AdminApprovalsPage: Using unified API endpoint for page ${pageNum}`);
      
      // Use the new unified approvals endpoint - temporarily increase page size for debugging
      const typeFilter = activeTab === 'all' ? '' : `&type=${activeTab === 'trf' ? 'trf' : activeTab}`;
      const debugPageSize = activeTab === 'accommodation' ? 50 : PAGE_SIZE; // Larger page size for accommodation debugging
      const response = await fetch(`/api/admin/approvals?page=${pageNum}&limit=${debugPageSize}${typeFilter}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch approval items: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      // Map the unified response to ApprovableItem format
      allPendingItems = (data.items || []).map((item: any) => ({
        id: item.id,
        requestorName: item.requestorName,
        itemType: item.itemType as 'TSR' | 'Claim' | 'Visa' | 'Accommodation' | 'Transport',
        purpose: item.purpose,
        status: item.status,
        submittedAt: item.submittedAt,
        // Type-specific fields
        ...(item.travelType && { travelType: item.travelType }),
        ...(item.destination && { destination: item.destination }),
        ...(item.amount !== null && item.amount !== undefined && { amount: item.amount }),
        ...(item.documentNumber && { documentNumber: item.documentNumber }),
        ...(item.visaType && { visaType: item.visaType }),
        ...(item.location && { location: item.location }),
        ...(item.checkInDate && { checkInDate: item.checkInDate }),
        ...(item.checkOutDate && { checkOutDate: item.checkOutDate }),
        ...(item.department && { department: item.department })
      }));
      
      setPendingItems(pageNum === 1 ? allPendingItems : [...pendingItems, ...allPendingItems]);
      setTotalCount(data.totalCount || allPendingItems.length);
      setTotalPages(data.totalPages || 1);
      setLastFetch(now);
      setCurrentPage(pageNum);
      
      if (allPendingItems.length === 0) {
        console.log("AdminApprovalsPage: No pending items found.");
      } else {
        console.log(`AdminApprovalsPage: Found ${allPendingItems.length} total pending items.`);

        // Debug: Log breakdown by item type
        const itemsByType = allPendingItems.reduce((acc, item) => {
          acc[item.itemType] = (acc[item.itemType] || 0) + 1;
          return acc;
        }, {});
        console.log('🔍 DEBUG - Items by type:', itemsByType);

        // Debug: Show accommodation items specifically
        const accommodationItems = allPendingItems.filter(item => item.itemType === 'Accommodation');
        console.log(`🏠 DEBUG - Accommodation items found: ${accommodationItems.length}`);
        if (accommodationItems.length > 0) {
          console.log('🏠 DEBUG - Accommodation items:', accommodationItems.map(item => ({
            id: item.id,
            status: item.status,
            requestorName: item.requestorName
          })));
        }
      }
      
    } catch (err: any) {
      console.error("AdminApprovalsPage: Error fetching pending items:", err);
      setError(err.message || "An unknown error occurred while fetching approval items.");
    } finally {
      setIsLoading(false);
    }
  }, [role, sessionLoading]);

  useEffect(() => {
    fetchPendingItems();
  }, [fetchPendingItems]);
  
  const handleRefresh = useCallback(() => {
    setCurrentPage(1);
    fetchPendingItems(true, 1);
  }, [fetchPendingItems]);
  
  const loadMore = useCallback(() => {
    if (!isLoading) {
      fetchPendingItems(false, currentPage + 1);
    }
  }, [fetchPendingItems, currentPage, isLoading]);

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
        handleRefresh(); // Re-fetch the list to reflect changes
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

  // Using unified status badge system

  // Memoized filtering for performance
  const filteredItems = useMemo(() => {
    const filtered = pendingItems.filter(item => {
      // Tab filter
      if (activeTab !== 'all') {
        if (activeTab === 'trf' && item.itemType !== 'TSR') return false;
        if (activeTab === 'transport' && item.itemType !== 'Transport') return false;
        if (activeTab !== 'trf' && activeTab !== 'transport' && item.itemType.toLowerCase() !== activeTab) return false;
      }
      
      // Search filter
      if (debouncedSearchTerm) {
        const query = debouncedSearchTerm.toLowerCase();
        const matchesSearch = 
          item.id.toLowerCase().includes(query) ||
          item.requestorName.toLowerCase().includes(query) ||
          item.purpose.toLowerCase().includes(query) ||
          (item.documentNumber && item.documentNumber.toLowerCase().includes(query)) ||
          (item.destination && item.destination.toLowerCase().includes(query)) ||
          (item.location && item.location.toLowerCase().includes(query));
        if (!matchesSearch) return false;
      }
      
      // Status filter
      if (statusFilter !== "all" && item.status.toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }
      
      // Department filter
      if (departmentFilter !== "all" && item.department && item.department.toLowerCase() !== departmentFilter.toLowerCase()) {
        return false;
      }
      
      // Date range filter
      if (dateRangeFilter !== "all") {
        const itemDate = new Date(item.submittedAt);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - itemDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (dateRangeFilter === "today" && diffDays > 1) return false;
        if (dateRangeFilter === "week" && diffDays > 7) return false;
        if (dateRangeFilter === "month" && diffDays > 30) return false;
      }
      
      return true;
    });

    return filtered;
  }, [pendingItems, activeTab, debouncedSearchTerm, statusFilter, departmentFilter, dateRangeFilter]);
  
  // Memoized counts for performance - use total count from API, not just loaded items
  const itemCounts = useMemo(() => {
    const counts = {
      all: totalCount, // Use total count from API instead of just loaded items
      trf: pendingItems.filter(i => i.itemType === 'TSR').length,
      claim: pendingItems.filter(i => i.itemType === 'Claim').length,
      visa: pendingItems.filter(i => i.itemType === 'Visa').length,
      accommodation: pendingItems.filter(i => i.itemType === 'Accommodation').length,
      transport: pendingItems.filter(i => i.itemType === 'Transport').length
    };
    return counts;
  }, [totalCount, pendingItems]);

  // Helper functions for filters
  const handleClearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setDepartmentFilter("all");
    setDateRangeFilter("all");
  };

  const hasActiveFilters = useMemo(() => {
    return searchTerm !== "" || 
           statusFilter !== "all" || 
           departmentFilter !== "all" || 
           dateRangeFilter !== "all";
  }, [searchTerm, statusFilter, departmentFilter, dateRangeFilter]);

  // Get unique departments and statuses for filter dropdowns
  const uniqueDepartments = useMemo(() => {
    const departments = new Set<string>();
    pendingItems.forEach(item => {
      if (item.department) departments.add(item.department);
    });
    return Array.from(departments).sort();
  }, [pendingItems]);

  const uniqueStatuses = useMemo(() => {
    const statuses = new Set<string>();
    pendingItems.forEach(item => {
      statuses.add(item.status);
    });
    return Array.from(statuses).sort();
  }, [pendingItems]);

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
          All Items ({itemCounts.all})
        </Button>
        <Button 
          variant={activeTab === 'trf' ? "default" : "outline"} 
          size="sm" 
          onClick={() => setActiveTab('trf')}
          className="rounded-full"
        >
          <Eye className="mr-1 h-4 w-4" />
          TSRs ({itemCounts.trf})
        </Button>
        <Button 
          variant={activeTab === 'claim' ? "default" : "outline"} 
          size="sm" 
          onClick={() => setActiveTab('claim')}
          className="rounded-full"
        >
          <ReceiptText className="mr-1 h-4 w-4" />
          Claims ({itemCounts.claim})
        </Button>
        <Button 
          variant={activeTab === 'visa' ? "default" : "outline"} 
          size="sm" 
          onClick={() => setActiveTab('visa')}
          className="rounded-full"
        >
          <FileText className="mr-1 h-4 w-4" />
          Visas ({itemCounts.visa})
        </Button>
        <Button 
          variant={activeTab === 'accommodation' ? "default" : "outline"} 
          size="sm" 
          onClick={() => setActiveTab('accommodation')}
          className="rounded-full"
        >
          <Home className="mr-1 h-4 w-4" />
          Accommodation ({itemCounts.accommodation})
        </Button>
        <Button 
          variant={activeTab === 'transport' ? "default" : "outline"} 
          size="sm" 
          onClick={() => setActiveTab('transport')}
          className="rounded-full"
        >
          <Truck className="mr-1 h-4 w-4" />
          Transport ({itemCounts.transport})
        </Button>
      </div>
      
      {/* Filters Card */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListFilter className="h-5 w-5" />
            Filter & Search Requests
          </CardTitle>
          <CardDescription>
            Search and filter approval requests by various criteria.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 items-end">
          {/* Search Input */}
          <div className="relative lg:col-span-2">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search by ID, Requestor, Purpose..." 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
              className="pl-8"
            />
          </div>
          
          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <ListFilter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Filter by Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {uniqueStatuses.map(status => (
                <SelectItem key={status} value={status}>{status}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {/* Department Filter */}
          <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {uniqueDepartments.map(dept => (
                <SelectItem key={dept} value={dept}>{dept}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {/* Date Range Filter */}
          <Select value={dateRangeFilter} onValueChange={setDateRangeFilter}>
            <SelectTrigger>
              <Calendar className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Date Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
        
        
        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <CardContent className="pt-0">
            <Button variant="outline" size="sm" onClick={handleClearFilters} className="text-xs">
              <X className="mr-1.5 h-3 w-3"/> Clear All Filters
            </Button>
          </CardContent>
        )}
      </Card>
      
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Pending Approvals</CardTitle>
              <CardDescription>
                Items awaiting your verification or approval.
                {hasActiveFilters && (
                  <span className="ml-2 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                    Filtered ({filteredItems.length} of {totalCount} total)
                  </span>
                )}
                {!hasActiveFilters && totalCount > 0 && (
                  <span className="ml-2 text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-1 rounded">
                    Showing {pendingItems.length} of {totalCount} requests (Page {currentPage} of {totalPages})
                  </span>
                )}
              </CardDescription>
            </div>
            <Button variant="outline" onClick={handleRefresh} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-40"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2 text-muted-foreground">Loading pending items...</p></div>
          ) : error ? (
            <div className="text-center py-8"><AlertTriangleIcon className="mx-auto h-12 w-12 text-destructive" /><h3 className="mt-2 text-lg font-medium text-destructive">Error Loading Items</h3><p className="mt-1 text-sm text-muted-foreground">{error}</p><Button onClick={fetchPendingItems} className="mt-4">Try Again</Button></div>
          ) : filteredItems.length > 0 ? (
            <div>
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
                      {item.itemType === 'Claim' && (
                        <div className="text-xs text-muted-foreground mt-1">
                          <span className="font-medium">Amount:</span> ${(item.amount || 0).toFixed(2)}
                          {item.department && (
                            <span className="ml-2">
                              <span className="font-medium">Dept:</span> {item.department}
                            </span>
                          )}
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
                    <TableCell><StatusBadge status={item.status} showIcon={true} /></TableCell>
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
              
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    Showing {((currentPage - 1) * PAGE_SIZE) + 1} to {Math.min(currentPage * PAGE_SIZE, totalCount)} of {totalCount} results
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchPendingItems(true, currentPage - 1)}
                      disabled={isLoading || currentPage <= 1}
                    >
                      Previous
                    </Button>
                    <div className="flex items-center space-x-1">
                      {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }

                        return (
                          <Button
                            key={pageNum}
                            variant={pageNum === currentPage ? "default" : "outline"}
                            size="sm"
                            onClick={() => fetchPendingItems(true, pageNum)}
                            disabled={isLoading}
                            className="w-8 h-8 p-0"
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchPendingItems(true, currentPage + 1)}
                      disabled={isLoading || currentPage >= totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg">
              <CheckSquare className="w-16 h-16 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {hasActiveFilters 
                  ? 'No requests found matching your criteria.' 
                  : activeTab === 'all' 
                    ? 'No items currently pending your approval.' 
                    : `No ${activeTab === 'trf' ? 'TSRs' : activeTab === 'claim' ? 'Claims' : activeTab === 'visa' ? 'Visa Applications' : activeTab === 'accommodation' ? 'Accommodation Requests' : 'Transport Requests'} currently pending your approval.`}
              </p>
              <p className="text-sm text-muted-foreground">
                {hasActiveFilters ? 'Try adjusting your filters to see more results.' : 'Check back later or adjust filters if applicable.'}
              </p>
              {hasActiveFilters && (
                <Button variant="link" onClick={handleClearFilters} className="mt-2">
                  Clear Filters
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
