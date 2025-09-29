"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { format, parseISO, isValid } from "date-fns";
import { FileCheck, Eye, Search, ArrowUpDown, X, ListFilter, Loader2, AlertTriangle, Plane, FileText, CheckCircle, XCircle, Clock, Settings } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import { useSessionPermissions } from '@/hooks/use-session-permissions';
import { canViewAllRequests, shouldShowRequest } from '@/lib/client-rbac-utils';
import { StatusBadge } from '@/lib/status-utils';

interface VisaApplication {
  id: string;
  requestorName: string;
  destination: string;
  purpose: string;
  status: string;
  submittedAt: string;
}

type SortConfig = {
  key: 'id' | 'requestorName' | 'destination' | 'purpose' | 'status' | 'submittedAt' | null;
  direction: 'ascending' | 'descending' | null;
};

const ALL_STATUSES_VALUE = "__ALL_STATUSES__";
const visaStatusesList = ['Pending Department Focal', 'Pending Line Manager/HOD', 'Pending Visa Clerk', 'Approved', 'Processing with Visa Admin', 'Visa Issued', 'Visa Rejected', 'Rejected', 'Cancelled'];

export default function AdminVisaPage() {
  const [visaApplications, setVisaApplications] = useState<VisaApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { role, userId, isLoading: sessionLoading } = useSessionPermissions();

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalApplications, setTotalApplications] = useState(0);
  const limit = 10;

  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [statusFilter, setStatusFilter] = useState<string>(ALL_STATUSES_VALUE);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'submittedAt', direction: 'descending' });

  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, processing: 0, completed: 0, rejected: 0 });

  const fetchVisaApplications = useCallback(async (page = 1) => {
    if (sessionLoading || !role) return;

    setIsLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (debouncedSearchTerm) params.append('search', debouncedSearchTerm);
    if (statusFilter !== ALL_STATUSES_VALUE) params.append('status', statusFilter);
    if (sortConfig.key) params.append('sortBy', sortConfig.key);
    if (sortConfig.direction) params.append('sortOrder', sortConfig.direction);

    try {
      const response = await fetch(`/api/admin/visa?${params.toString()}`);
      const contentType = response.headers.get('content-type') || '';

      if (!response.ok) {
        let errorMessage = `Failed to fetch visa applications: ${response.status} ${response.statusText}`;
        if (contentType.includes('application/json')) {
          const errorData = await response.json().catch(() => ({}));
          errorMessage = errorData.error || errorData.message || errorMessage;
        }
        throw new Error(errorMessage);
      }

      if (!contentType.includes('application/json')) {
        throw new Error('Invalid response from server: Expected JSON but received HTML/text.');
      }

      const data = await response.json();
      const items = Array.isArray(data) ? data : data.applications || [];
      const filtered = items.filter((app: any) => shouldShowRequest(role, { ...app, itemType: 'visa' }, userId));

      setVisaApplications(filtered);
      setTotalApplications(Array.isArray(data) ? filtered.length : data.totalCount || 0);
      setTotalPages(Array.isArray(data) ? 1 : data.totalPages || 1);
      setCurrentPage(Array.isArray(data) ? 1 : data.currentPage || 1);

      const newStats = {
        total: filtered.length,
        pending: filtered.filter((app: any) => ['Pending Department Focal', 'Pending Line Manager/HOD', 'Pending Visa Clerk'].includes(app.status)).length,
        approved: filtered.filter((app: any) => app.status === 'Approved').length,
        processing: filtered.filter((app: any) => app.status === 'Processing with Visa Admin').length,
        completed: filtered.filter((app: any) => ['Visa Issued', 'Visa Rejected'].includes(app.status)).length,
        rejected: filtered.filter((app: any) => ['Rejected', 'Cancelled'].includes(app.status)).length,
      };
      setStats(newStats);

    } catch (err: any) {
      console.error("AdminVisaPage: Error fetching visa applications:", err.message);
      setError(err.message);
      setVisaApplications([]);
      setTotalApplications(0);
      setTotalPages(1);
      setStats({ total: 0, pending: 0, approved: 0, processing: 0, completed: 0, rejected: 0 });
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearchTerm, statusFilter, sortConfig, limit, role, userId, sessionLoading]);

  useEffect(() => {
    fetchVisaApplications(currentPage);
  }, [currentPage, fetchVisaApplications]);

  const handleSort = (key: SortConfig['key']) => {
    if (!key) return;
    setSortConfig(prevSort => {
      if (prevSort.key === key) {
        const direction = prevSort.direction === 'ascending' ? 'descending' : 'ascending';
        return { key, direction };
      } else {
        return { key, direction: 'ascending' };
      }
    });
  };

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter(ALL_STATUSES_VALUE);
    setSortConfig({ key: 'submittedAt', direction: 'descending' });
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = parseISO(dateString);
    return isValid(date) ? format(date, 'MMM dd, yyyy') : 'Invalid Date';
  };

  const getSortIcon = (columnKey: SortConfig['key']) => {
    if (sortConfig.key !== columnKey) return <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />;
    return <ArrowUpDown className={`ml-2 h-4 w-4 ${sortConfig.direction === 'ascending' ? 'rotate-180' : ''}`} />;
  };

  if (isLoading && sessionLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground">Loading Visa Administration...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileCheck className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">Visa Administration</h1>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/admin/visa/processing">
              <FileText className="mr-2 h-4 w-4" />
              Processing Dashboard
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <FileCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">All submitted requests</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
            <p className="text-xs text-muted-foreground">Awaiting approval</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.approved}</div>
            <p className="text-xs text-muted-foreground">Approved requests</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processing</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.processing + stats.completed}</div>
            <p className="text-xs text-muted-foreground">In progress</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filter & Search Applications</CardTitle>
          <CardDescription>Use filters to find specific visa applications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search by applicant name, destination, or purpose..."
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[200px]">
                  <ListFilter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Filter by Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_STATUSES_VALUE}>All Statuses</SelectItem>
                  {visaStatusesList.map(status => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(searchTerm || statusFilter !== ALL_STATUSES_VALUE || sortConfig.key !== 'submittedAt') && (
                <Button variant="outline" onClick={clearFilters}>
                  <X className="mr-2 h-4 w-4" />
                  Clear
                </Button>
              )}
                          </div>
          </div>
        </CardContent>
      </Card>

      {/* Applications Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Visa Applications
            {totalApplications > 0 && (
              <Badge variant="secondary" className="ml-2">
                {totalApplications} total
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            {canViewAllRequests(role) 
              ? "All visa applications in the system" 
              : "Your visa applications and those you can manage"
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <AlertTriangle className="w-12 h-12 text-destructive mb-4" />
              <h3 className="text-lg font-semibold text-destructive mb-2">Error Loading Applications</h3>
              <p className="text-muted-foreground mb-4">{error}</p>
              <Button onClick={() => fetchVisaApplications(currentPage)}>Try Again</Button>
            </div>
          ) : isLoading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="w-8 h-8 animate-spin" />
              <span className="ml-2">Loading applications...</span>
            </div>
          ) : visaApplications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <FileCheck className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Applications Found</h3>
              <p className="text-muted-foreground">
                {searchTerm || statusFilter !== ALL_STATUSES_VALUE
                  ? "Try adjusting your search or filter criteria"
                  : "No visa applications have been submitted yet"
                }
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead 
                        className="cursor-pointer select-none hover:bg-muted/50"
                        onClick={() => handleSort('id')}
                      >
                        <div className="flex items-center">
                          Visa ID
                          {getSortIcon('id')}
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer select-none hover:bg-muted/50"
                        onClick={() => handleSort('requestorName')}
                      >
                        <div className="flex items-center">
                          Applicant
                          {getSortIcon('requestorName')}
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer select-none hover:bg-muted/50"
                        onClick={() => handleSort('destination')}
                      >
                        <div className="flex items-center">
                          Destination
                          {getSortIcon('destination')}
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer select-none hover:bg-muted/50"
                        onClick={() => handleSort('purpose')}
                      >
                        <div className="flex items-center">
                          Purpose
                          {getSortIcon('purpose')}
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer select-none hover:bg-muted/50"
                        onClick={() => handleSort('status')}
                      >
                        <div className="flex items-center">
                          Status
                          {getSortIcon('status')}
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer select-none hover:bg-muted/50"
                        onClick={() => handleSort('submittedAt')}
                      >
                        <div className="flex items-center">
                          Submitted
                          {getSortIcon('submittedAt')}
                        </div>
                      </TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visaApplications.map((application) => (
                      <TableRow key={application.id}>
                        <TableCell className="font-medium">{application.id}</TableCell>
                        <TableCell>{application.requestorName}</TableCell>
                        <TableCell>{application.destination}</TableCell>
                        <TableCell>{application.purpose}</TableCell>
                        <TableCell>
                          <StatusBadge status={application.status} showIcon />
                        </TableCell>
                        <TableCell>{formatDate(application.submittedAt)}</TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/visa/view/${application.id}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}