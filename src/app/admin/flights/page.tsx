"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plane, FileText, CheckCircle, XCircle, Clock, Settings, Ticket } from "lucide-react";
import { useSessionPermissions } from '@/hooks/use-session-permissions';
import { shouldShowRequest } from '@/lib/client-rbac-utils';

interface FlightApplication {
  id: string;
  requestorName: string;
  department: string;
  purpose: string;
  status: string;
  travelType: string;
  submittedAt: string;
  destinationSummary?: string;
}

export default function FlightsAdminPage() {
  const { role, userId, isLoading: sessionLoading } = useSessionPermissions();
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [applications, setApplications] = useState<FlightApplication[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [travelTypeFilter, setTravelTypeFilter] = useState("all");
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    booked: 0,
    completed: 0,
    rejected: 0
  });

  const fetchFlightStats = useCallback(async () => {
    if (sessionLoading || !role) {
      return;
    }
    
    try {
      const response = await fetch('/api/admin/flights?stats=true');
      if (!response.ok) {
        throw new Error('Failed to fetch flight statistics');
      }
      
      const data = await response.json();
      const apiStats = data.stats;
      
      // Calculate statistics from API response
      const newStats = {
        total: apiStats.total_flight_requests || 0,
        pending: apiStats.pending_bookings || 0,
        booked: apiStats.booked_flights || 0,
        completed: apiStats.completed || 0,
        rejected: apiStats.rejected || 0
      };
      setStats(newStats);
    } catch (error) {
      console.error('Failed to fetch flight statistics:', error);
      setStats({ total: 0, pending: 0, booked: 0, completed: 0, rejected: 0 });
    }
  }, [role, userId, sessionLoading]);

  const fetchFlightApplications = useCallback(async () => {
    if (sessionLoading || !role) {
      return;
    }
    
    try {
      setIsLoading(true);
      // Fetch TRFs that require flights (Overseas, Home Leave Passage)
      const statusesToFetch = ["Approved", "Awaiting Visa", "TRF Processed", "Rejected"].join(',');
      const response = await fetch(`/api/trf?statuses=${encodeURIComponent(statusesToFetch)}&limit=50`);
      if (!response.ok) {
        throw new Error('Failed to fetch flight applications');
      }
      
      const data = await response.json();
      
      // Apply role-based filtering and filter for flight-required travel types
      // Only show actual TSRs (not auto-generated accommodation requests)
      const flightRequiredTrfs = (data.trfs || [])
        .filter(trf => trf.id && trf.id.startsWith('TSR-')) // Only TSR-prefixed requests
        .filter(trf => ['Overseas', 'Home Leave Passage'].includes(trf.travelType))
        .filter(trf => shouldShowRequest(role, { ...trf, itemType: 'trf' }, userId));
      
      const formattedApplications = flightRequiredTrfs.map((trf: any) => {
        let destinationSummary = '';
        
        if (trf.overseasTravelDetails?.itinerary?.length) {
          destinationSummary = trf.overseasTravelDetails.itinerary
            .map((s: any) => `${s.from_location || s.from} > ${s.to_location || s.to}`)
            .join(', ');
        } else if (trf.externalPartiesTravelDetails?.itinerary?.length) {
          destinationSummary = trf.externalPartiesTravelDetails.itinerary
            .map((s: any) => `${s.from_location || s.from} > ${s.to_location || s.to}`)
            .join(', ');
        }
        
        return {
          id: trf.id,
          requestorName: trf.requestorName || trf.externalPartyRequestorInfo?.externalFullName || 'N/A',
          department: trf.department || 'N/A',
          purpose: trf.purpose || 'N/A',
          status: trf.status,
          travelType: trf.travelType,
          submittedAt: trf.submittedAt,
          destinationSummary
        };
      });
      
      setApplications(formattedApplications);
    } catch (error) {
      console.error('Failed to fetch flight applications:', error);
      setApplications([]);
    } finally {
      setIsLoading(false);
    }
  }, [role, userId, sessionLoading]);

  // Filter applications based on search and filters
  const filteredApplications = applications.filter(app => {
    const matchesSearch = !searchTerm || 
      app.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.requestorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.purpose.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (app.destinationSummary && app.destinationSummary.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || app.status === statusFilter;
    const matchesType = travelTypeFilter === 'all' || app.travelType === travelTypeFilter;
    
    return matchesSearch && matchesStatus && matchesType;
  });

  const loadMoreApplications = async () => {
    // Placeholder for loading more applications
    setIsLoadingMore(true);
    // In a real implementation, you would fetch more data here
    setTimeout(() => setIsLoadingMore(false), 1000);
  };

  useEffect(() => {
    fetchFlightStats();
    fetchFlightApplications();
  }, [fetchFlightStats, fetchFlightApplications]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Plane className="w-8 h-8 text-primary" />
            Flight Administration
          </h1>
          <p className="text-muted-foreground">Manage flight bookings and processing for overseas travel requests.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/admin/flights/processing">
              <FileText className="mr-2 h-4 w-4" />
              Processing Dashboard
            </Link>
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <Plane className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">All flight requests</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Booking</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
            <p className="text-xs text-muted-foreground">Awaiting flight booking</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Booked</CardTitle>
            <Ticket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.booked}</div>
            <p className="text-xs text-muted-foreground">Flights confirmed</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completed}</div>
            <p className="text-xs text-muted-foreground">Processing complete</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.rejected}</div>
            <p className="text-xs text-muted-foreground">Declined requests</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter & Search Applications */}
      <Card>
        <CardHeader>
          <CardTitle>Filter & Search Applications</CardTitle>
          <CardDescription>Find and manage flight-related travel requests</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search by TRF ID, requestor name, destination..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Approved">Approved</SelectItem>
                <SelectItem value="Awaiting Visa">Awaiting Visa</SelectItem>
                <SelectItem value="TRF Processed">TRF Processed</SelectItem>
                <SelectItem value="Rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Select value={travelTypeFilter} onValueChange={setTravelTypeFilter}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Filter by travel type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="Overseas">Overseas</SelectItem>
                <SelectItem value="Home Leave Passage">Home Leave Passage</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* TSR Applications List */}
      <Card>
        <CardHeader>
          <CardTitle>Flight-Related Travel Requests</CardTitle>
          <CardDescription>
            Travel requests requiring flight bookings (Overseas and Home Leave Passage)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                <span>Loading applications...</span>
              </div>
            </div>
          ) : filteredApplications.length > 0 ? (
            <div className="space-y-4">
              <div className="grid gap-4">
                {filteredApplications.map((application) => (
                  <div
                    key={application.id}
                    className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{application.id}</span>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            application.status === 'Approved' ? 'bg-green-100 text-green-700' :
                            application.status === 'Awaiting Visa' ? 'bg-blue-100 text-blue-700' :
                            application.status === 'TRF Processed' ? 'bg-purple-100 text-purple-700' :
                            application.status === 'Rejected' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {application.status}
                          </span>
                          <span className="px-2 py-1 text-xs rounded-full bg-blue-50 text-blue-700">
                            {application.travelType}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium">{application.requestorName}</p>
                          <p className="text-sm text-muted-foreground">{application.department}</p>
                        </div>
                        <div>
                          <p className="text-sm">{application.purpose}</p>
                          {application.destinationSummary && (
                            <p className="text-xs text-muted-foreground">
                              Route: {application.destinationSummary}
                            </p>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Submitted: {new Date(application.submittedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/trf/view/${application.id}`}>
                            View Details
                          </Link>
                        </Button>
                        <Button 
                          size="sm" 
                          asChild
                          disabled={application.status !== 'Approved'}
                        >
                          <Link href="/admin/flights/processing">
                            Process Flight
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Pagination or Load More */}
              <div className="flex justify-center pt-4">
                <Button variant="outline" onClick={loadMoreApplications} disabled={isLoadingMore}>
                  {isLoadingMore ? 'Loading...' : 'Load More'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Plane className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No flight applications found</h3>
              <p className="text-muted-foreground">
                {searchTerm || statusFilter !== 'all' || travelTypeFilter !== 'all'
                  ? 'Try adjusting your search criteria'
                  : 'No travel requests requiring flights at this time'
                }
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}