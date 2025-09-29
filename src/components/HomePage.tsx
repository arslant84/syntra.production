"use client";

import React from 'react';
import SummaryCard from "@/components/dashboard/SummaryCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { 
  FileText, 
  Plane,
  ReceiptText, 
  PlusCircle,
  BedDouble,
  Search,
  StickyNote,
  ClipboardList,
  CarFront,
  Loader2
} from "@/components/ui/icons";
import { RefreshCw } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { StatusBadge } from "@/lib/status-utils";

export type ActivityItem = {
  id: string;
  type: string;
  title: string;
  status: string;
  dateInfo: string;
  link: string;
  statusVariant: 'default' | 'outline';
  icon: string;
};

// Icon mapping for dynamic icon rendering
const iconMap: Record<string, React.ComponentType<any>> = {
  FileText,
  ReceiptText,
  StickyNote,
  Plane,
  BedDouble,
  ClipboardList
};

export default function HomePageContent() {
  const [mounted, setMounted] = useState(false);
  const [summary, setSummary] = useState({
    pendingTsrs: 0,
    visaUpdates: 0,
    draftClaims: 0,
    pendingAccommodation: 0,
    pendingTransport: 0,
  });
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<ActivityItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState('');

  const fetchDashboardData = async () => {
    if (isFetching) {
      console.log('⏸️ Skipping fetch - already fetching');
      return;
    }
    
    setIsLoading(true);
    setIsFetching(true);
    setError('');
    
    try {
      const startTime = performance.now();
      console.log('🚀 Fetching dashboard data...');

      const [summaryResponse, activitiesResponse] = await Promise.all([
        fetch('/api/dashboard/summary'),
        fetch('/api/dashboard/activities')
      ]);

      // Check summary response
      if (!summaryResponse.ok) {
        const contentType = summaryResponse.headers.get('content-type') || '';
        let errorMessage = `Failed to fetch summary data: ${summaryResponse.status} ${summaryResponse.statusText}`;
        
        if (contentType.includes('application/json')) {
          try {
            const errorData = await summaryResponse.json();
            errorMessage = errorData?.error || errorData?.message || errorMessage;
          } catch {
            // If JSON parsing fails, use the default error message
          }
        } else {
          // For non-JSON responses (like HTML 503 pages), use status text
          errorMessage = `Failed to fetch summary data: ${summaryResponse.status}`;
        }
        
        throw new Error(errorMessage);
      }

      // Check activities response
      if (!activitiesResponse.ok) {
        const contentType = activitiesResponse.headers.get('content-type') || '';
        let errorMessage = `Failed to fetch activities: ${activitiesResponse.status} ${activitiesResponse.statusText}`;
        
        if (contentType.includes('application/json')) {
          try {
            const errorData = await activitiesResponse.json();
            errorMessage = errorData?.error || errorData?.message || errorMessage;
          } catch {
            // If JSON parsing fails, use the default error message
          }
        } else {
          // For non-JSON responses (like HTML 503 pages), use status text
          errorMessage = `Failed to fetch activities: ${activitiesResponse.status}`;
        }
        
        throw new Error(errorMessage);
      }

      const [summaryData, activitiesData] = await Promise.all([
        summaryResponse.json(),
        activitiesResponse.json(),
      ]);

      const endTime = performance.now();
      console.log(`✅ Dashboard data loaded in ${Math.round(endTime - startTime)}ms`);

      const safeActivities = Array.isArray(activitiesData) ? activitiesData : (activitiesData.activities || []);

      setSummary(summaryData);
      setActivities(safeActivities);
      setError('');
    } catch (error: any) {
      console.error('❌ Error fetching dashboard data:', error.message);
      setError(error.message || 'An unexpected error occurred.');
      setSummary({ pendingTsrs: 0, visaUpdates: 0, draftClaims: 0, pendingAccommodation: 0, pendingTransport: 0 });
      setActivities([]);
    } finally {
      setIsLoading(false);
      setIsFetching(false);
    }
  };

  const refresh = () => {
    fetchDashboardData();
  };

  useEffect(() => {
    setMounted(true);
    // Add delay to ensure hydration is complete
    const timer = setTimeout(() => {
      fetchDashboardData();
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  // Update filtered activities when activities change
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredActivities(activities);
    } else {
      const filtered = activities.filter(item => 
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        item.type.toLowerCase().includes(searchQuery.toLowerCase()) || 
        item.status.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.dateInfo.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredActivities(filtered);
    }
  }, [activities, searchQuery]);

  // Show loading state until fully mounted and data loaded
  if (!mounted) {
    return (
      <div className="space-y-8">
        <div className="text-center py-8 md:py-12">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-800 dark:text-white">
            Welcome to <span className="text-primary">SynTra</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mt-4">
            Travel is Synchronised
          </p>
        </div>
        <div className="flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="text-center py-8 md:py-12">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-800 dark:text-white">
          Welcome to <span className="text-primary">SynTra</span>
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground mt-4">
          Travel is Synchronised
        </p>
      </div>

      {/* Quick Actions */}
      <Card className="bg-transparent shadow-none border-none">
        <CardContent>
          <div className="flex flex-wrap justify-center items-center gap-3 md:gap-4 border-none shadow-none">
            <Link href="/trf/new" passHref>
              <Button size="lg" variant="default" className="w-48 whitespace-normal text-center">
                <PlusCircle className="mr-2 h-5 w-5" /> Create New TSR
              </Button>
            </Link>
            <Link href="/claims/new" passHref>
              <Button size="lg" variant="default" className="w-48 whitespace-normal text-center">
                <PlusCircle className="mr-2 h-5 w-5" /> Submit New Claim
              </Button>
            </Link>
            <Link href="/accommodation/request" passHref>
              <Button size="lg" variant="default" className="w-48 whitespace-normal text-center">
                <PlusCircle className="mr-2 h-5 w-5" /> Book Accommodation
              </Button>
            </Link>
            <Link href="/visa/new" passHref>
              <Button size="lg" variant="default" className="w-48 whitespace-normal text-center">
                <PlusCircle className="mr-2 h-5 w-5" /> Process Visa
              </Button>
            </Link>
            <Link href="/transport/new" passHref>
              <Button size="lg" variant="default" className="w-48 whitespace-normal text-center">
                <PlusCircle className="mr-2 h-5 w-5" /> New Transport Request
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        <SummaryCard 
          title="My Pending TSRs" 
          value={(summary.pendingTsrs || 0).toString()} 
          icon={ClipboardList}
          description="Requests awaiting approval"
          iconBgColor="bg-yellow-100 dark:bg-yellow-800/30"
          iconColor="text-yellow-600 dark:text-yellow-400"
        />
        <SummaryCard 
          title="Visa Application Updates" 
          value={(summary.visaUpdates || 0).toString()}
          icon={StickyNote}
          description="Pending visa applications"
          iconColor="text-blue-600 dark:text-blue-400"
          iconBgColor="bg-blue-100 dark:bg-blue-800/30"
        />
        <SummaryCard 
          title="My Draft Claims" 
          value={(summary.draftClaims || 0).toString()} 
          icon={ReceiptText}
          description="Saved but not yet submitted"
          iconBgColor="bg-amber-100 dark:bg-amber-800/30"
          iconColor="text-amber-600 dark:text-amber-400"
        />
        <SummaryCard 
          title="Book Accommodation" 
          value={(summary.pendingAccommodation || 0).toString()}
          icon={BedDouble} 
          description="Available locations / new requests" 
          iconBgColor="bg-indigo-100 dark:bg-indigo-800/30"
          iconColor="text-indigo-600 dark:text-indigo-400"
        />
        <SummaryCard 
          title="Book Transport" 
          value={(summary.pendingTransport || 0).toString()}
          icon={CarFront} 
          description="Available locations / new requests" 
          iconBgColor="bg-green-100 dark:bg-green-800/30"
          iconColor="text-green-600 dark:text-green-400"
        />
      </div>
      
      {/* Recent Activity */}
      <Card className="shadow-lg">
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <CardTitle className="text-2xl font-semibold tracking-tight">Recent Activity</CardTitle>
            <CardDescription className="mt-1">Overview of your latest travel-related actions.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={refresh}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
              Refresh
            </Button>
            <div className="relative w-full md:w-auto md:min-w-[300px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search activities..."
                className="pl-10 pr-4 py-2 h-10 text-sm rounded-lg shadow-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          {isLoading ? (
            <div className="py-10 flex justify-center items-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="py-10 text-center text-red-500">
              {error}
            </div>
          ) : filteredActivities.length > 0 ? (
            <div className="space-y-6">
              {filteredActivities.map((item) => {
                // Get the icon component from the icon map
                const IconComponent = iconMap[item.icon as keyof typeof iconMap] || FileText;
                
                return (
                  <Card key={`${item.type}-${item.id}`} className="hover:bg-accent hover:text-accent-foreground">
                    <CardContent className="p-4 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 flex-grow">
                        <div className={cn(
                          "p-3 rounded-full flex items-center justify-center",
                          item.status === "Approved" ? "bg-green-100 dark:bg-green-800/30" : "bg-muted/50 dark:bg-muted/30"
                        )}>
                          <IconComponent className={cn(
                            "h-6 w-6",
                            item.status === "Approved" ? "text-green-600 dark:text-green-400" : "text-primary"
                          )} />
                        </div>
                        <div className="flex-grow">
                          <CardTitle className="text-md font-semibold leading-snug">{item.title}</CardTitle>
                          <p className="text-xs text-muted-foreground">{item.type} - {item.dateInfo}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                         <StatusBadge status={item.status} className="text-xs mb-1" />
                        <Link href={item.link} passHref>
                          <Button variant="ghost" className="p-0 h-auto text-sm text-primary">
                            View Details &rarr;
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : searchQuery.trim() !== '' ? (
            <div className="py-10 text-center text-muted-foreground">
              No activities match your search.
            </div>
          ) : (
            <div className="py-10 text-center">
              <div className="text-muted-foreground mb-4">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No recent activity found</p>
                <p className="text-sm">Your travel requests, claims, and applications will appear here once created.</p>
              </div>
              {error && (
                <div className="mt-4 text-sm text-red-500 bg-red-50 dark:bg-red-900/20 px-4 py-2 rounded">
                  {error}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}