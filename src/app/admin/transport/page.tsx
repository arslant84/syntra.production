"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format, parseISO, isValid } from "date-fns";
import { Truck, Eye, Search, ArrowUpDown, X, ListFilter, Loader2, AlertTriangle, Settings, CheckCircle, XCircle, Clock } from "lucide-react";
import type { TransportRequestStatus } from '@/types/transport';
import { useDebounce } from "@/hooks/use-debounce";
import { useSessionPermissions } from '@/hooks/use-session-permissions';
import { canViewAllRequests, shouldShowRequest } from '@/lib/client-rbac-utils';
import { StatusBadge } from '@/lib/status-utils';

interface TransportListItem {
  id: string;
  requestorName: string; 
  department: string;
  purpose: string;
  status: string;
  submittedAt: string;
  tsrReference?: string;
}

type SortConfig = {
  key: 'id' | 'requestorName' | 'department' | 'purpose' | 'status' | 'submittedAt' | null;
  direction: 'ascending' | 'descending' | null;
};

const ALL_STATUSES_VALUE = "__ALL_STATUSES__";

const transportStatusesList: TransportRequestStatus[] = ["Draft", "Pending Department Focal", "Pending Line Manager", "Pending HOD", "Approved", "Rejected", "Cancelled", "Processing", "Completed"];

export default function AdminTransportRequestsPage() {
  const [transportRequests, setTransportRequests] = useState<TransportListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { role, userId, isLoading: sessionLoading } = useSessionPermissions();
  
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRequests, setTotalRequests] = useState(0);
  const limit = 10;

  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [statusFilter, setStatusFilter] = useState<string>(ALL_STATUSES_VALUE);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'submittedAt', direction: 'descending' });

  const fetchTransportRequests = useCallback(async (page = 1) => {
    if (sessionLoading || !role) {
      return; // Don't fetch while session is loading or role is not available
    }
    
    setIsLoading(true);
    setError(null);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      admin: "true", // Admin flag to get all transport requests
    });
    if (debouncedSearchTerm) params.append('search', debouncedSearchTerm);
    if (statusFilter !== ALL_STATUSES_VALUE) params.append('status', statusFilter);
    if (sortConfig.key && sortConfig.direction) {
      params.append('sortBy', sortConfig.key);
      params.append('sortOrder', sortConfig.direction);
    }

    try {
      console.log(`AdminTransportRequestsPage: Fetching transport requests with params: ${params.toString()}`);
      const response = await fetch(`/api/admin/transport?${params.toString()}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ details: "Failed to parse error response." }));
        let errorMessage = errorData.details || errorData.error || `Failed to fetch transport requests. Server responded with status ${response.status}.`;
        if (typeof errorData.details === 'object') {
            errorMessage = Object.values(errorData.details).flat().join(' ');
        }
        throw new Error(errorMessage);
      }
      const data = await response.json();
      console.log("AdminTransportRequestsPage: Fetched transport requests data:", data);
      
      // Handle both paginated and non-paginated responses
      if (Array.isArray(data)) {
        // Non-paginated response (current format)
        // Apply role-based filtering for personal vs admin view using client-side logic
        const filteredRequests = data.filter(request => 
          shouldShowRequest(role, { ...request, itemType: 'transport' }, userId)
        );
        setTransportRequests(filteredRequests);
        setTotalRequests(filteredRequests.length);
        setTotalPages(1);
        setCurrentPage(1);
      } else {
        // Paginated response (future format)
        // Apply role-based filtering for personal vs admin view using client-side logic
        const filteredRequests = (data.transportRequests || []).filter(request =>
          shouldShowRequest(role, { ...request, itemType: 'transport' }, userId)
        );
        setTransportRequests(filteredRequests);
        setTotalRequests(data.totalCount || 0);
        setTotalPages(data.totalPages || 1);
        setCurrentPage(data.currentPage || 1);
      }
    } catch (err: any) {
      console.error("AdminTransportRequestsPage: Error fetching transport requests:", err);
      setError(err.message);
      setTransportRequests([]);
      setTotalRequests(0);
      setTotalPages(1);
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearchTerm, statusFilter, sortConfig, limit, role, userId, sessionLoading]);

  useEffect(() => {
    fetchTransportRequests(currentPage);
  }, [currentPage, fetchTransportRequests]);

  useEffect(() => {
    if (currentPage !== 1) setCurrentPage(1);
    else fetchTransportRequests(1); 
  }, [debouncedSearchTerm, statusFilter, sortConfig]);

  // Using unified status badge system


  const handleSort = (key: SortConfig['key']) => {
    if (!key) return;
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const SortableHeader: React.FC<{ columnKey: SortConfig['key']; label: string; className?: string }> = ({ columnKey, label, className }) => (
    <TableHead className={className}>
      <Button variant="ghost" onClick={() => handleSort(columnKey)} className="px-1 hover:bg-muted/80">
        {label}
        {sortConfig.key === columnKey && (
          <ArrowUpDown className={`ml-2 h-3 w-3 ${sortConfig.direction === 'descending' ? 'rotate-180' : ''}`} />
        )}
      </Button>
    </TableHead>
  );
  
  const handleClearFilters = () => {
    setSearchTerm("");
    setStatusFilter(ALL_STATUSES_VALUE);
    setSortConfig({ key: 'submittedAt', direction: 'descending' });
  };

  const hasActiveFilters = searchTerm !== "" || statusFilter !== ALL_STATUSES_VALUE;

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Transport Request Management</h1>
            <p className="text-muted-foreground">Manage and review all transport requests</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/admin/transport/processing">
              <Truck className="h-4 w-4 mr-2" />
              Transport Processing
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRequests}</div>
            <p className="text-xs text-muted-foreground">All submitted requests</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {transportRequests.filter(req => req.status.toLowerCase().includes('pending')).length}
            </div>
            <p className="text-xs text-muted-foreground">Awaiting approval</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {transportRequests.filter(req => req.status.toLowerCase().includes('approved')).length}
            </div>
            <p className="text-xs text-muted-foreground">Approved requests</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processing</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {transportRequests.filter(req => ['Processing', 'Completed'].includes(req.status)).length}
            </div>
            <p className="text-xs text-muted-foreground">In progress</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters Card */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListFilter className="h-5 w-5" />
            Filter & Search Transport Requests
          </CardTitle>
          <CardDescription>
            Search and filter transport requests by various criteria.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
          <Input 
            placeholder="Search by ID, Requestor, Purpose..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            className="lg:col-span-2"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <ListFilter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Filter by Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_STATUSES_VALUE}>All Statuses</SelectItem>
              {transportStatusesList.map(status => (
                <SelectItem key={status} value={status}>{status}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
        {hasActiveFilters && (
          <CardContent className="pt-0">
            <Button variant="outline" size="sm" onClick={handleClearFilters} className="text-xs">
              <X className="mr-1.5 h-3 w-3"/> Clear All Filters
            </Button>
          </CardContent>
        )}
      </Card>

      {/* Transport Requests List Card */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            All Transport Requests
          </CardTitle>
          <CardDescription>
            Complete list of transport requests from all users. Total: {isLoading && totalRequests === 0 ? <Loader2 className="h-4 w-4 animate-spin inline-block" /> : totalRequests}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && transportRequests.length === 0 ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Loading transport requests...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
              <h3 className="mt-2 text-lg font-medium text-destructive">Error Loading Transport Requests</h3>
              <p className="mt-1 text-sm text-muted-foreground">{error}</p>
              <Button onClick={() => fetchTransportRequests(1)} className="mt-4">Try Again</Button>
            </div>
          ) : transportRequests.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableHeader columnKey="id" label="Request ID" />
                      <SortableHeader columnKey="requestorName" label="Requestor" />
                      <SortableHeader columnKey="department" label="Department" />
                      <SortableHeader columnKey="purpose" label="Purpose" />
                      <SortableHeader columnKey="status" label="Status" />
                      <SortableHeader columnKey="submittedAt" label="Submitted" />
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transportRequests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell className="font-medium">{request.id}</TableCell>
                        <TableCell>{request.requestorName || 'N/A'}</TableCell>
                        <TableCell>{request.department || 'N/A'}</TableCell>
                        <TableCell className="max-w-xs truncate">{request.purpose || 'N/A'}</TableCell>
                        <TableCell>
                          <StatusBadge status={request.status} showIcon={true} />
                        </TableCell>
                        <TableCell>
                          {request.submittedAt && isValid(parseISO(request.submittedAt)) ? format(parseISO(request.submittedAt), 'PPP') : 'N/A'}
                        </TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/transport/view/${request.id}`} className="flex items-center">
                              <Eye className="mr-1.5 h-4 w-4" /> View
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-end space-x-2 py-4">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} 
                    disabled={currentPage <= 1 || isLoading}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} 
                    disabled={currentPage >= totalPages || isLoading}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg">
              <Truck className="w-16 h-16 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {hasActiveFilters ? "No transport requests found matching your criteria." : "No transport requests found."}
              </p>
              <p className="text-sm text-muted-foreground">Transport requests will appear here once submitted.</p>
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