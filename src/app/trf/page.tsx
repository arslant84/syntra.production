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
import { FileText, PlusCircle, Eye, Search, ArrowUpDown, X, ListFilter, Loader2, AlertTriangle } from "lucide-react";
import type { TravelType, TrfStatus } from '@/types/trf';
import { useDebounce } from "@/hooks/use-debounce";
import { StatusBadge } from "@/lib/status-utils";
import { ProtectedComponent, usePermissions } from "@/components/ProtectedComponent";

interface TrfListItem {
  id: string;
  requestorName: string; 
  travelType: string;
  purpose: string;
  status: string;
  submittedAt: string;
}

type SortConfig = {
  key: 'id' | 'requestorName' | 'travelType' | 'purpose' | 'status' | 'submitted_at' | null;
  direction: 'ascending' | 'descending' | null;
};

const ALL_STATUSES_VALUE = "__ALL_STATUSES__";
const ALL_TRAVEL_TYPES_VALUE = "__ALL_TRAVEL_TYPES__";

const trfStatusesList: TrfStatus[] = ["Draft", "Pending Department Focal", "Pending Line Manager", "Pending HOD", "Approved", "Rejected", "Cancelled", "Processing Flights", "Processing Accommodation", "Awaiting Visa", "TRF Processed"];
const travelTypesList: Exclude<TravelType, "">[] = ["Domestic", "Overseas", "Home Leave Passage", "External Parties"];

export default function TSRPage() {
  const { isAdmin, session } = usePermissions();
  const [trfs, setTrfs] = useState<TrfListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalTrfs, setTotalTrfs] = useState(0);
  const limit = 10;

  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [statusFilter, setStatusFilter] = useState<string>(ALL_STATUSES_VALUE);
  const [travelTypeFilter, setTravelTypeFilter] = useState<string>(ALL_TRAVEL_TYPES_VALUE);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'submitted_at', direction: 'descending' });

  const fetchTrfs = useCallback(async (page = 1) => {
    setIsLoading(true);
    setError(null);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    if (debouncedSearchTerm) params.append('search', debouncedSearchTerm);
    if (statusFilter !== ALL_STATUSES_VALUE) params.append('status', statusFilter);
    if (travelTypeFilter !== ALL_TRAVEL_TYPES_VALUE) params.append('travelType', travelTypeFilter);
    if (sortConfig.key && sortConfig.direction) {
      params.append('sortBy', sortConfig.key);
      params.append('sortOrder', sortConfig.direction);
    }

    try {
      // Exclude accommodation requests from TSR list
      params.append('excludeTravelType', 'Accommodation');
      console.log(`TSRPage: Fetching TSRs with params: ${params.toString()}`);
      const response = await fetch(`/api/trf?${params.toString()}`);
      if (!response.ok) {
        const contentType = response.headers.get('content-type') || '';
        let errorMessage = `Failed to fetch TSRs: ${response.status} ${response.statusText}`;
        
        if (contentType.includes('application/json')) {
          try {
            const errorData = await response.json();
            errorMessage = errorData?.error || errorData?.message || errorData?.details || errorMessage;
          } catch {
            // If JSON parsing fails, use the default error message
          }
        } else {
          // For non-JSON responses (like HTML 503 pages), use status text
          errorMessage = `Failed to fetch TSRs: ${response.status}`;
        }
        
        throw new Error(errorMessage);
      }
      const data = await response.json();
      console.log("TSRPage: Fetched TSRs data:", data);
      setTrfs(data.trfs || []);
      setTotalTrfs(data.totalCount || 0);
      setTotalPages(data.totalPages || 1);
      setCurrentPage(data.currentPage || 1);
    } catch (err: any) {
      console.error("TSRPage: Error fetching TSRs:", err);
      setError(err.message);
      setTrfs([]);
      setTotalTrfs(0);
      setTotalPages(1);
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearchTerm, statusFilter, travelTypeFilter, sortConfig, limit]);


  useEffect(() => {
    fetchTrfs(currentPage);
  }, [currentPage, fetchTrfs]);

  useEffect(() => {
    if (currentPage !== 1) setCurrentPage(1);
    else fetchTrfs(1); 
  }, [debouncedSearchTerm, statusFilter, travelTypeFilter, sortConfig]);


  // Removed getStatusBadgeVariant function - now using standardized StatusBadge component

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
    setTravelTypeFilter(ALL_TRAVEL_TYPES_VALUE);
    setSortConfig({ key: 'submitted_at', direction: 'descending' });
  };

  const hasActiveFilters = searchTerm !== "" || statusFilter !== ALL_STATUSES_VALUE || travelTypeFilter !== ALL_TRAVEL_TYPES_VALUE;

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <FileText className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">Travel & Service Requests (TSR)</h1>
          </div>
          
          {/* Role-based messaging */}
          <div className="ml-11">
            <ProtectedComponent 
              permissions={['view_all_trf']}
              fallback={
                <p className="text-sm text-muted-foreground">
                  Viewing your travel requests only
                </p>
              }
            >
              <p className="text-sm text-muted-foreground">
                Viewing all travel requests
              </p>
            </ProtectedComponent>
          </div>
        </div>
        
        <Link href="/trf/new" passHref>
          <Button>
            <PlusCircle className="mr-2 h-5 w-5" /> Create New TSR
          </Button>
        </Link>
      </div>

      {/* Filters Card */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListFilter className="h-5 w-5" />
            Filter & Search TSRs
          </CardTitle>
          <CardDescription>
            Search and filter your travel requests by various criteria.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
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
              {trfStatusesList.map(status => (
                <SelectItem key={status} value={status}>{status}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={travelTypeFilter} onValueChange={setTravelTypeFilter}>
            <SelectTrigger>
              <ListFilter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Filter by Travel Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_TRAVEL_TYPES_VALUE}>All Travel Types</SelectItem>
              {travelTypesList.map(type => (
                <SelectItem key={type} value={type}>{type}</SelectItem>
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

      {/* TSR List Card */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            My TSRs
          </CardTitle>
          <CardDescription>
            List of your submitted travel requests. Total: {isLoading && totalTrfs === 0 ? <Loader2 className="h-4 w-4 animate-spin inline-block" /> : totalTrfs}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && trfs.length === 0 ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Loading TSRs...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
              <h3 className="mt-2 text-lg font-medium text-destructive">Error Loading TSRs</h3>
              <p className="mt-1 text-sm text-muted-foreground">{error}</p>
              <Button onClick={() => fetchTrfs(1)} className="mt-4">Try Again</Button>
            </div>
          ) : trfs.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableHeader columnKey="id" label="TSR ID" />
                      <SortableHeader columnKey="requestorName" label="Requestor" />
                      <SortableHeader columnKey="travelType" label="Type" />
                      <SortableHeader columnKey="purpose" label="Purpose" />
                      <SortableHeader columnKey="status" label="Status" />
                      <SortableHeader columnKey="submitted_at" label="Submitted" />
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trfs.map((trf) => (
                      <TableRow key={trf.id}>
                        <TableCell className="font-medium">{trf.id}</TableCell>
                        <TableCell>{trf.requestorName || 'N/A'}</TableCell>
                        <TableCell>{trf.travelType}</TableCell>
                        <TableCell className="max-w-xs truncate">{trf.purpose || 'N/A'}</TableCell>
                        <TableCell>
                          <StatusBadge status={trf.status} showIcon />
                        </TableCell>
                        <TableCell>
                          {trf.submittedAt && isValid(parseISO(trf.submittedAt)) ? format(parseISO(trf.submittedAt), 'PPP') : 'N/A'}
                        </TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/trf/view/${trf.id}`} className="flex items-center">
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
              <FileText className="w-16 h-16 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {hasActiveFilters ? "No TSRs found matching your criteria." : "No TSRs found."}
              </p>
              <p className="text-sm text-muted-foreground">Click "Create New TSR" to get started.</p>
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