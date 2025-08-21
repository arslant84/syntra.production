"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { StickyNote, Search, Filter, Upload, CheckCircle, XCircle, Clock, Eye, BarChart2, Loader2 } from 'lucide-react';
import type { VisaApplication, VisaStatus } from '@/types/visa';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { useSessionPermissions } from '@/hooks/use-session-permissions';
import { shouldShowRequest } from '@/lib/client-rbac-utils';
import { useToast } from '@/hooks/use-toast';
import { LoadingPage, LoadingSpinner } from '@/components/ui/loading';
import { StatusBadge } from '@/lib/status-utils';

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
  
  // Processing dialog state
  const [processingDialogOpen, setProcessingDialogOpen] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<VisaApplication | null>(null);
  const [processingAction, setProcessingAction] = useState<'approve' | 'reject' | 'complete'>('approve');
  const [processingComments, setProcessingComments] = useState('');
  const [processingLoading, setProcessingLoading] = useState(false);
  const [visaOutcome, setVisaOutcome] = useState<'approved' | 'rejected'>('approved');
  const [visaNumber, setVisaNumber] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  
  const { role, userId, isLoading: sessionLoading } = useSessionPermissions();
  const { toast } = useToast();

  useEffect(() => {
    const fetchVisaReports = async () => {
      if (sessionLoading || !role) {
        return; // Don't fetch while session is loading or role is not available
      }
      
      try {
        setLoading(true);
        const response = await fetch('/api/admin/visa-reports');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        // Apply role-based filtering for personal vs admin view using client-side logic
        const filteredApplications = (data.recentApplications || []).filter(application =>
          shouldShowRequest(role, { ...application, itemType: 'visa' }, userId)
        );
        
        setReportData({
          ...data,
          recentApplications: filteredApplications
        });
        setFilteredApplications(filteredApplications);
      } catch (err) {
        console.error('Failed to fetch visa reports:', err);
        setError('Failed to load visa reports. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchVisaReports();
  }, [role, userId, sessionLoading]);

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

  // Using unified status badge system

  const openProcessingDialog = (application: VisaApplication) => {
    setSelectedApplication(application);
    setProcessingAction(application.status === 'Processing with Embassy' ? 'complete' : 'approve');
    setProcessingComments('');
    setVisaOutcome('approved');
    setVisaNumber('');
    setRejectionReason('');
    setProcessingDialogOpen(true);
  };

  const handleVisaAction = async (visaId: string, action: string, newStatus?: string) => {
    setProcessingLoading(true);
    try {
      const response = await fetch(`/api/visa/${visaId}/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          approverRole: 'Visa Clerk',
          approverName: 'Visa Administrator',
          comments: `Marked as ${newStatus || action} by Visa Administrator`
        }),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: `Visa application ${action}ed successfully`,
        });
        // Refresh the data
        window.location.reload();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || `Failed to ${action} visa application`,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process visa action",
        variant: "destructive",
      });
    } finally {
      setProcessingLoading(false);
    }
  };

  const handleProcessingSubmit = async () => {
    if (!selectedApplication) return;

    setProcessingLoading(true);
    try {
      let requestBody: any = {
        approverRole: 'Visa Clerk',
        approverName: 'Visa Administrator',
      };

      if (processingAction === 'complete') {
        // Processing completion - either approved with visa or rejected
        if (visaOutcome === 'approved') {
          requestBody.action = 'upload_visa';
          requestBody.visaCopyFilename = `visa_${selectedApplication.id}_${visaNumber}.pdf`;
          requestBody.comments = `Visa processing completed successfully. Visa Number: ${visaNumber}. ${processingComments}`;
        } else {
          requestBody.action = 'reject';
          requestBody.comments = `Visa application rejected by embassy. Reason: ${rejectionReason}. ${processingComments}`;
        }
      } else if (processingAction === 'approve') {
        // Direct approval (skip embassy processing)
        requestBody.action = 'approve';
        requestBody.comments = `Visa approved directly by Visa Clerk. ${processingComments}`;
      } else {
        // Reject
        requestBody.action = 'reject';
        requestBody.comments = `Visa rejected by Visa Clerk. Reason: ${processingComments}`;
      }

      const response = await fetch(`/api/visa/${selectedApplication.id}/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Visa processing completed successfully",
        });
        setProcessingDialogOpen(false);
        // Refresh the data
        window.location.reload();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to process visa application",
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

  if (loading) {
    return <LoadingPage message="Loading visa reports..." />;
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
                        <StatusBadge status={app.status || "Unknown"} showIcon={true} />
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
                            <Button 
                              variant="outline" 
                              size="sm" 
                              title="Mark as Processing with Embassy"
                              onClick={() => handleVisaAction(app.id, 'mark_processing', 'Processing with Embassy')}
                            >
                              <Clock className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              title="Process Visa Request"
                              onClick={() => openProcessingDialog(app)}
                            >
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            </Button>
                          </>
                        )}
                        {app.status === 'Processing with Embassy' && (
                          <>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              title="Complete Processing - Upload Result"
                              onClick={() => openProcessingDialog(app)}
                            >
                              <Upload className="h-4 w-4" />
                            </Button>
                          </>
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

      {/* Visa Processing Dialog */}
      <Dialog open={processingDialogOpen} onOpenChange={setProcessingDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {processingAction === 'complete' ? 'Complete Visa Processing' : 
               processingAction === 'approve' ? 'Process Visa Application' : 'Reject Visa Application'}
            </DialogTitle>
            <DialogDescription>
              {selectedApplication && (
                <>
                  Processing visa application {selectedApplication.id} for {selectedApplication.applicantName}
                  {processingAction === 'complete' && 
                    ' - Enter the final outcome from embassy processing'}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {processingAction === 'complete' && (
              <>
                <div>
                  <Label htmlFor="visa-outcome">Visa Outcome</Label>
                  <Select value={visaOutcome} onValueChange={(value: 'approved' | 'rejected') => setVisaOutcome(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="approved">Visa Approved</SelectItem>
                      <SelectItem value="rejected">Visa Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {visaOutcome === 'approved' && (
                  <div>
                    <Label htmlFor="visa-number">Visa Number</Label>
                    <Input
                      id="visa-number"
                      placeholder="Enter visa number"
                      value={visaNumber}
                      onChange={(e) => setVisaNumber(e.target.value)}
                    />
                  </div>
                )}

                {visaOutcome === 'rejected' && (
                  <div>
                    <Label htmlFor="rejection-reason">Rejection Reason</Label>
                    <Textarea
                      id="rejection-reason"
                      placeholder="Enter rejection reason from embassy"
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                    />
                  </div>
                )}
              </>
            )}

            {processingAction === 'reject' && (
              <div>
                <Label htmlFor="processing-comments">Rejection Reason</Label>
                <Textarea
                  id="processing-comments"
                  placeholder="Enter reason for rejection"
                  value={processingComments}
                  onChange={(e) => setProcessingComments(e.target.value)}
                />
              </div>
            )}

            {processingAction === 'approve' && (
              <>
                <div className="space-y-2">
                  <Label>Processing Options</Label>
                  <div className="flex gap-2">
                    <Button
                      variant={processingAction === 'approve' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setProcessingAction('approve')}
                    >
                      Direct Approval
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
              </>
            )}

            <div>
              <Label htmlFor="additional-comments">Additional Comments</Label>
              <Textarea
                id="additional-comments"
                placeholder="Enter any additional comments or notes"
                value={processingComments}
                onChange={(e) => setProcessingComments(e.target.value)}
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
                (processingAction === 'complete' && visaOutcome === 'approved' && !visaNumber) ||
                (processingAction === 'complete' && visaOutcome === 'rejected' && !rejectionReason) ||
                (processingAction === 'reject' && !processingComments)
              }
            >
              {processingLoading && <LoadingSpinner size="sm" className="mr-2" />}
              {processingAction === 'complete' ? 'Complete Processing' : 
               processingAction === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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