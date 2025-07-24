"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { StickyNote, Search, Filter, Upload, CheckCircle, XCircle, Clock, Eye, BarChart2, Loader2 } from 'lucide-react';
import type { VisaApplication, VisaStatus } from '@/types/visa';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

type VisaReportData = {
  summary: {
    totalApplications: number;
    statusCounts: Record<string, number>;
    avgProcessingTime: number;
    destinations: number;
  };
  recentApplications: VisaApplication[];
  destinationStats: Record<string, number>;
  statusOverTime: {
    labels: string[];
    data: number[];
  };
};

export default function VisaAdminPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<VisaReportData | null>(null);
  const [filteredApplications, setFilteredApplications] = useState<VisaApplication[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchVisaReports = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/admin/visa-reports');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setReportData(data);
        setFilteredApplications(data.recentApplications);
      } catch (err) {
        console.error('Failed to fetch visa reports:', err);
        setError('Failed to load visa reports. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchVisaReports();
  }, []);

  useEffect(() => {
    if (!reportData) return;
    
    let filtered = [...reportData.recentApplications];
    
    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(app => app.status === statusFilter);
    }
    
    // Apply search term filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(app => 
        (app.applicantName?.toLowerCase().includes(term) ?? false) ||
        (app.destination?.toLowerCase().includes(term) ?? false) ||
        (app.trfReferenceNumber?.toLowerCase().includes(term) ?? false)
      );
    }
    
    setFilteredApplications(filtered);
  }, [statusFilter, searchTerm, reportData]);

  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const getStatusBadgeVariant = (status: VisaStatus) => {
    switch (status) {
      case 'Approved': return 'default';
      case 'Rejected': return 'destructive';
      case 'Pending Department Focal':
      case 'Pending Line Manager/HOD':
      case 'Pending Visa Clerk':
      case 'Processing with Embassy':
        return 'outline';
      default: return 'secondary';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2">Loading visa reports...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center text-destructive">
        <p>{error}</p>
        <Button 
          variant="outline" 
          className="mt-4"
          onClick={() => window.location.reload()}
        >
          Retry
        </Button>
      </div>
    );
  }

  if (!reportData) {
    return (
      <div className="p-4 text-center">
        <p>No visa data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <StickyNote className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">Visa Administration Dashboard</h1>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Applications</CardTitle>
            <StickyNote className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reportData.summary.totalApplications}</div>
            <p className="text-xs text-muted-foreground">Total visa applications</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Processing Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reportData.summary.avgProcessingTime} days</div>
            <p className="text-xs text-muted-foreground">Average time to process</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Destinations</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reportData.summary.destinations}</div>
            <p className="text-xs text-muted-foreground">Unique destinations</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Approval</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Object.entries(reportData.summary.statusCounts)
                .filter(([status]) => status.includes('Pending'))
                .reduce((sum, [, count]) => sum + count, 0)}
            </div>
            <p className="text-xs text-muted-foreground">Awaiting action</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search */}
      <Card>
        <CardHeader>
          <CardTitle>Filter & Search Applications</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col md:flex-row gap-3">
          <div className="relative w-full md:flex-grow">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              type="search" 
              placeholder="Search by Applicant Name, TSR Ref, Destination..." 
              className="pl-8 w-full" 
              value={searchTerm}
              onChange={handleSearch}
            />
          </div>
          <Select value={statusFilter} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-full md:w-[200px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Filter by Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Applications</SelectItem>
              <SelectItem value="Pending Visa Clerk">Pending Visa Clerk</SelectItem>
              <SelectItem value="Processing with Embassy">Processing with Embassy</SelectItem>
              <SelectItem value="Approved">Approved</SelectItem>
              <SelectItem value="Rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Applications Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Visa Applications</CardTitle>
          <CardDescription>List of visa applications requiring action or tracking by the Visa Clerk.</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredApplications.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Visa ID</TableHead>
                    <TableHead>Applicant</TableHead>
                    <TableHead>Destination</TableHead>
                    <TableHead>TSR Ref.</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredApplications.map((app) => (
                    <TableRow key={app.id}>
                      <TableCell className="font-medium">{app.id}</TableCell>
                      <TableCell>{app.applicantName || 'N/A'}</TableCell>
                      <TableCell>{app.destination || 'N/A'}</TableCell>
                      <TableCell>
                        {app.trfReferenceNumber ? (
                          <Link 
                            href={`/trf/view/${app.trfReferenceNumber}`} 
                            className="text-primary hover:underline"
                          >
                            {app.trfReferenceNumber}
                          </Link>
                        ) : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={getStatusBadgeVariant(app.status)} 
                          className={app.status === "Approved" ? "bg-green-600 text-white" : ""}
                        >
                          {app.status || "Unknown"}
                        </Badge>
                      </TableCell>
                      <TableCell>{app.submittedDate ? format(new Date(app.submittedDate), 'PPP') : 'N/A'}</TableCell>
                      <TableCell className="space-x-1 text-center">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/visa/view/${app.id}`} className="flex items-center">
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        {app.status === 'Pending Visa Clerk' && (
                          <>
                            <Button variant="outline" size="sm" title="Mark as Processing">
                              <Clock className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm" title="Mark Approved">
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button variant="outline" size="sm" title="Mark Rejected">
                              <XCircle className="h-4 w-4 text-red-600" />
                            </Button>
                          </>
                        )}
                        {app.status === 'Processing with Embassy' && (
                          <Button variant="outline" size="sm" title="Upload Visa Copy/Denial">
                            <Upload className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg">
              <StickyNote className="w-16 h-16 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No visa applications found matching your criteria.</p>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Reports Section */}
      <Card>
        <CardHeader>
          <CardTitle>Visa Processing Analytics</CardTitle>
          <CardDescription>Statistics and trends for visa processing</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            {/* Status Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Application Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(reportData.summary.statusCounts).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-3 h-3 rounded-full mr-2 bg-primary" />
                        <span>{status}</span>
                      </div>
                      <span className="font-medium">{count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            
            {/* Top Destinations */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Top Destinations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(reportData.destinationStats)
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, 5)
                    .map(([destination, count]) => (
                      <div key={destination} className="flex items-center justify-between">
                        <span>{destination}</span>
                        <span className="font-medium">{count}</span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

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