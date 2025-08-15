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
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

// Define types for our data
type SummaryData = {
  pendingTsrs: number;
  visaUpdates: number;
  draftClaims: number;
  pendingAccommodation: number;
  pendingTransport: number;
};

type ActivityItem = {
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

export default function HomePage() {
  const [summaryData, setSummaryData] = useState<SummaryData>({
    pendingTsrs: 0,
    visaUpdates: 0,
    draftClaims: 0,
    pendingAccommodation: 0,
    pendingTransport: 0,
  });
  
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<ActivityItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      try {
        // Parallel data fetching for 2x faster loading
        console.log('Starting parallel dashboard data fetch...');
        const startTime = performance.now();
        
        const [summaryResponse, activitiesResponse] = await Promise.all([
          fetch('/api/dashboard/summary'),
          fetch('/api/dashboard/activities')
        ]);

        // Check responses in parallel
        if (!summaryResponse.ok) throw new Error('Failed to fetch summary data');
        if (!activitiesResponse.ok) throw new Error('Failed to fetch activities');

        // Parse JSON in parallel
        const [summaryData, activitiesData] = await Promise.all([
          summaryResponse.json(),
          activitiesResponse.json()
        ]);

        const endTime = performance.now();
        console.log(`Dashboard data loaded in ${Math.round(endTime - startTime)}ms`);

        const transformedActivities = activitiesData.map(activity => ({
          ...activity,
          title: activity.title.replace(/TRF/g, 'TSR'),
          type: activity.type.replace(/TRF/g, 'TSR'),
        }));

        setSummaryData(summaryData);
        setActivities(transformedActivities);
        setFilteredActivities(transformedActivities);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError('Failed to load dashboard data. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

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
            <Link href="/tsr/new" passHref>
              <Button size="lg" variant="default" className="w-48 whitespace-normal text-center">
                <PlusCircle className="mr-2 h-5 w-5" /> Create New TSR
              </Button>
            </Link>
            <Link href="/claims/new" passHref>
              <Button size="lg" variant="default" className="w-48 whitespace-normal text-center">
                <PlusCircle className="mr-2 h-5 w-5" /> Submit New Claim
              </Button>
            </Link>
            <Link href="/accommodation" passHref>
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
          value={(summaryData.pendingTsrs || 0).toString()} 
          icon={ClipboardList}
          description="Requests awaiting approval"
          iconBgColor="bg-yellow-100 dark:bg-yellow-800/30"
          iconColor="text-yellow-600 dark:text-yellow-400"
        />
        <SummaryCard 
          title="Visa Application Updates" 
          value={(summaryData.visaUpdates || 0).toString()}
          icon={StickyNote}
          description="Pending visa applications"
          iconColor="text-blue-600 dark:text-blue-400"
          iconBgColor="bg-blue-100 dark:bg-blue-800/30"
        />
        <SummaryCard 
          title="My Draft Claims" 
          value={(summaryData.draftClaims || 0).toString()} 
          icon={ReceiptText}
          description="Saved but not yet submitted"
          iconBgColor="bg-amber-100 dark:bg-amber-800/30"
          iconColor="text-amber-600 dark:text-amber-400"
        />
        <SummaryCard 
          title="Book Accommodation" 
          value={(summaryData.pendingAccommodation || 0).toString()}
          icon={BedDouble} 
          description="Available locations / new requests" 
          iconBgColor="bg-indigo-100 dark:bg-indigo-800/30"
          iconColor="text-indigo-600 dark:text-indigo-400"
        />
        <SummaryCard 
          title="Book Transport" 
          value={(summaryData.pendingTransport || 0).toString()}
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
          <div className="relative w-full md:w-auto md:min-w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search activities..."
              className="pl-10 pr-4 py-2 h-10 text-sm rounded-lg shadow-sm"
              value={searchQuery}
              onChange={(e) => {
                const query = e.target.value;
                setSearchQuery(query);
                if (query.trim() === '') {
                  setFilteredActivities(activities);
                } else {
                  const filtered = activities.filter(item => 
                    item.title.toLowerCase().includes(query.toLowerCase()) || 
                    item.type.toLowerCase().includes(query.toLowerCase()) || 
                    item.status.toLowerCase().includes(query.toLowerCase()) ||
                    item.dateInfo.toLowerCase().includes(query.toLowerCase())
                  );
                  setFilteredActivities(filtered);
                }
              }}
            />
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
                         <Badge variant={item.statusVariant} className={cn(
                          "text-xs mb-1",
                          item.status === "Approved" && "bg-green-600 text-white dark:bg-green-500 dark:text-white",
                          item.status === "Draft" && "bg-amber-500 text-white dark:bg-amber-600 dark:text-white",
                          item.status.includes("Pending") && "bg-blue-500 text-white dark:bg-blue-600 dark:text-white"
                         )}>
                          {item.status}
                        </Badge>
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
            <div className="py-10 text-center text-muted-foreground">
              No recent activity to display.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
