"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BedDouble, FileText, CheckCircle, XCircle, Clock, Settings } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import LocationManagement from "@/components/accommodation/LocationManagement";
import RoomManagement from "@/components/accommodation/RoomManagement";
import { useSessionPermissions } from '@/hooks/use-session-permissions';
import { shouldShowRequest } from '@/lib/client-rbac-utils';

export default function AccommodationAdminPage() {
  const [activeTab, setActiveTab] = useState("locations");
  const { role, userId, isLoading: sessionLoading } = useSessionPermissions();
  const [accommodationRequests, setAccommodationRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState<number>(0);
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    processing: 0,
    completed: 0,
    rejected: 0
  });

  const fetchAccommodationRequests = useCallback(async (forceRefresh = false) => {
    if (sessionLoading || !role) {
      return;
    }
    
    // Check cache validity
    const now = Date.now();
    if (!forceRefresh && accommodationRequests.length > 0 && (now - lastFetch) < CACHE_DURATION) {
      console.log('Using cached accommodation requests');
      return;
    }
    
    try {
      setIsLoading(true);
      // Reduced limit for faster initial load
      const response = await fetch('/api/admin/accommodation?limit=25&processing=false');
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Accommodation requests fetch failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });
        
        // If it's an authentication error, don't spam the console
        if (response.status === 401 || response.status === 403) {
          console.warn('Authentication required for accommodation requests');
          return;
        }
        
        throw new Error(`Failed to fetch accommodation requests: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Handle API errors gracefully
      if (data.error) {
        console.warn('API returned error:', data.error, data.details || '');
        // Still continue with empty data rather than throwing
      }
      
      let requests = [];
      
      // Handle both paginated and direct array responses
      if (Array.isArray(data)) {
        requests = data;
      } else if (data.requests && Array.isArray(data.requests)) {
        requests = data.requests;
      } else {
        requests = [];
      }
      
      // Apply role-based filtering
      const filteredRequests = requests.filter(request =>
        shouldShowRequest(role, { ...request, itemType: 'accommodation' }, userId)
      );
      
      setAccommodationRequests(filteredRequests);
      setLastFetch(now);
      
      // Calculate statistics using useMemo for performance
      const newStats = {
        total: filteredRequests.length,
        pending: filteredRequests.filter(req => 
          ['Pending Department Focal', 'Pending Line Manager/HOD', 'Pending Accommodation Admin'].includes(req.status)
        ).length,
        approved: filteredRequests.filter(req => req.status === 'Approved').length,
        processing: filteredRequests.filter(req => 
          ['Processing', 'Processing Accommodation', 'Room Assigned'].includes(req.status)
        ).length,
        completed: filteredRequests.filter(req => 
          ['Completed', 'Check-out Completed'].includes(req.status)
        ).length,
        rejected: filteredRequests.filter(req => 
          ['Rejected', 'Cancelled'].includes(req.status)
        ).length,
      };
      setStats(newStats);
    } catch (error: any) {
      console.error('Failed to fetch accommodation requests:', {
        message: error.message,
        stack: error.stack
      });
      
      // Set fallback stats and empty requests
      setStats({ total: 0, pending: 0, approved: 0, processing: 0, completed: 0, rejected: 0 });
      setAccommodationRequests([]);
    } finally {
      setIsLoading(false);
    }
  }, [role, userId, sessionLoading, accommodationRequests.length, lastFetch]);

  const handleDataRefresh = useCallback(() => {
    fetchAccommodationRequests(true); // Force refresh
  }, [fetchAccommodationRequests]);

  useEffect(() => {
    fetchAccommodationRequests();
  }, [fetchAccommodationRequests]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <BedDouble className="w-8 h-8 text-primary" />
            Accommodation Administration
          </h1>
          <p className="text-muted-foreground">Manage accommodation locations, rooms, and processing.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/admin/accommodation/processing">
              <FileText className="mr-2 h-4 w-4" />
              Processing Dashboard
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <BedDouble className="h-4 w-4 text-muted-foreground" />
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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="locations">Locations</TabsTrigger>
          <TabsTrigger value="rooms">Rooms</TabsTrigger>
        </TabsList>

        <TabsContent value="locations" className="space-y-4">
          <LocationManagement onLocationChange={handleDataRefresh} />
        </TabsContent>

        <TabsContent value="rooms" className="space-y-4">
          <RoomManagement onRoomChange={handleDataRefresh} />
        </TabsContent>
      </Tabs>
    </div>
  );
}