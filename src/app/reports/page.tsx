
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart2, FileText, ReceiptText, BedDouble, Users2, Filter, CalendarDays, StickyNote, Activity, Loader2 } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltipContent,
  type ChartConfig
} from "@/components/ui/chart";
import { useState, useEffect } from 'react';
import { format, subMonths } from 'date-fns';

// Define the type for TRF status data
interface TrfStatusData {
  month: string;
  pending: number;
  approved: number;
  rejected: number;
}

const trfChartConfig = {
  pending: { label: "Pending", color: "hsl(var(--chart-1))" },
  approved: { label: "Approved", color: "hsl(var(--chart-2))" },
  rejected: { label: "Rejected", color: "hsl(var(--chart-3))" },
} satisfies ChartConfig;


export default function ReportsPage() {
  const [trfStatusData, setTrfStatusData] = useState<TrfStatusData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [year, setYear] = useState<string>(new Date().getFullYear().toString());
  
  // Fetch TRF status data
  useEffect(() => {
    async function fetchTrfStatusData() {
      setIsLoading(true);
      setError(null);
      try {
        // Fetch TRF data from the API
        const response = await fetch('/api/trf/status-summary');
        
        if (!response.ok) {
          throw new Error(`Failed to fetch TRF status data: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // If API returns formatted data, use it directly
        if (data.statusByMonth && Array.isArray(data.statusByMonth)) {
          setTrfStatusData(data.statusByMonth);
        } else {
          // If API returns raw TRFs, process them to get monthly stats
          // This is a fallback if the status-summary endpoint doesn't exist
          const trfs = data.trfs || [];
          
          // Generate last 6 months
          const months = Array.from({length: 6}, (_, i) => {
            const date = subMonths(new Date(), i);
            return {
              month: format(date, 'MMM'),
              date: date,
              pending: 0,
              approved: 0,
              rejected: 0
            };
          }).reverse();
          
          // Count TRFs by status for each month
          trfs.forEach((trf: any) => {
            const trfDate = new Date(trf.submittedAt);
            const monthIndex = months.findIndex(m => 
              m.date.getMonth() === trfDate.getMonth() && 
              m.date.getFullYear() === trfDate.getFullYear()
            );
            
            if (monthIndex !== -1) {
              if (trf.status.includes('Pending')) {
                months[monthIndex].pending++;
              } else if (trf.status.includes('Approved')) {
                months[monthIndex].approved++;
              } else if (trf.status.includes('Rejected')) {
                months[monthIndex].rejected++;
              }
            }
          });
          
          // Format the data for the chart
          setTrfStatusData(months.map(m => ({
            month: m.month,
            pending: m.pending,
            approved: m.approved,
            rejected: m.rejected
          })));
        }
      } catch (err: any) {
        console.error('Error fetching TRF status data:', err);
        setError(err.message || 'Failed to fetch TRF status data');
        
        // Provide fallback data if fetch fails
        setTrfStatusData([
          { month: "Jan", pending: 0, approved: 0, rejected: 0 },
          { month: "Feb", pending: 0, approved: 0, rejected: 0 },
          { month: "Mar", pending: 0, approved: 0, rejected: 0 },
          { month: "Apr", pending: 0, approved: 0, rejected: 0 },
          { month: "May", pending: 0, approved: 0, rejected: 0 },
          { month: "Jun", pending: 0, approved: 0, rejected: 0 },
        ]);
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchTrfStatusData();
  }, [year]); // Re-fetch when year changes
  
  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <BarChart2 className="w-8 h-8 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight">Travel Reports</h1>
      </div>
      <CardDescription>
        View reports and analytics on travel expenses and trends. Report visibility may depend on your access level.
      </CardDescription>

      {/* General Filters - Conceptual */}
      <Card>
        <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><Filter className="h-5 w-5"/> General Report Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-3">
             <div className="flex items-center gap-2 w-full sm:w-auto">
                <CalendarDays className="h-5 w-5 text-muted-foreground" />
                <Input type="text" placeholder="Select Date Range (e.g., Last 30 Days)" className="w-full sm:w-[250px]" disabled />
            </div>
            <Button disabled className="w-full sm:w-auto">Apply General Filters</Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* TRF Reports Card */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileText /> TRF Reports</CardTitle>
            <CardDescription>Analyze Travel Request Form trends, statuses, and processing times.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <Select disabled>
                <SelectTrigger className="w-full sm:flex-1">
                  <SelectValue placeholder="Filter by Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ict">ICT</SelectItem>
                  <SelectItem value="finance">Finance</SelectItem>
                  <SelectItem value="exploration">Exploration</SelectItem>
                </SelectContent>
              </Select>
               <Select disabled>
                <SelectTrigger className="w-full sm:flex-1">
                  <SelectValue placeholder="Filter by TRF Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="pending_hod">Pending HOD</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="h-[250px] w-full pt-4">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Loading data...</span>
                </div>
              ) : error ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-destructive">{error}</p>
                </div>
              ) : (
                <ChartContainer config={trfChartConfig} className="h-full w-full">
                  <BarChart accessibilityLayer data={trfStatusData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis tickLine={false} axisLine={false} tickMargin={8} />
                    <Tooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="pending" fill="var(--color-pending)" radius={4} />
                    <Bar dataKey="approved" fill="var(--color-approved)" radius={4} />
                    <Bar dataKey="rejected" fill="var(--color-rejected)" radius={4} />
                  </BarChart>
                </ChartContainer>
              )}
            </div>
            <Button variant="outline" className="w-full" disabled>View Detailed TRF Report</Button>
          </CardContent>
        </Card>

        {/* Expense Claim Reports Card */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ReceiptText /> Expense Claim Reports</CardTitle>
            <CardDescription>Track submitted claims, average amounts, and processing efficiency.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <Input type="text" placeholder="Search by Claimant / TRF ID" className="w-full sm:flex-1" disabled/>
              <Select disabled>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Filter by Status" />
                </SelectTrigger>
                 <SelectContent>
                  <SelectItem value="pending_verification">Pending Verification</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="h-[250px] border-2 border-dashed rounded-lg flex items-center justify-center">
              <p className="text-muted-foreground">Claim Summary Chart Placeholder</p>
            </div>
            <Button variant="outline" className="w-full" disabled>View Detailed Claim Report</Button>
          </CardContent>
        </Card>

        {/* Accommodation Reports Card */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BedDouble /> Accommodation Reports</CardTitle>
            <CardDescription>View occupancy rates, booking patterns, and location demand.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-2">
                <Select disabled>
                    <SelectTrigger className="w-full sm:flex-1">
                    <SelectValue placeholder="Filter by Location" />
                    </SelectTrigger>
                    <SelectContent>
                    <SelectItem value="ashgabat">Ashgabat Staff Houses</SelectItem>
                    <SelectItem value="kiyanly">Kiyanly Camps</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="h-[250px] border-2 border-dashed rounded-lg flex items-center justify-center">
              <p className="text-muted-foreground">Occupancy Rate Chart Placeholder</p>
            </div>
            <Button variant="outline" className="w-full" disabled>View Detailed Accommodation Report</Button>
          </CardContent>
        </Card>

        {/* Visa Application Reports Card */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><StickyNote /> Visa Application Reports</CardTitle>
            <CardDescription>Track visa application statuses, processing times, and submissions by destination.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <Input type="text" placeholder="Search by Applicant/Destination" className="w-full sm:flex-1" disabled/>
              <Select disabled>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Filter by Status" />
                </SelectTrigger>
                 <SelectContent>
                  <SelectItem value="pending_visa_clerk">Pending Visa Clerk</SelectItem>
                  <SelectItem value="processing_embassy">Processing with Embassy</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="h-[250px] border-2 border-dashed rounded-lg flex items-center justify-center">
              <p className="text-muted-foreground">Visa Status Distribution Chart Placeholder</p>
            </div>
            <Button variant="outline" className="w-full" disabled>View Detailed Visa Report</Button>
          </CardContent>
        </Card>
        
        {/* User Activity Reports Card */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Activity /> User Activity Reports</CardTitle>
            <CardDescription>Monitor user actions, form submissions, and system access patterns.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="flex flex-col sm:flex-row gap-2">
              <Input type="text" placeholder="Search by User / Action" className="w-full sm:flex-1" disabled/>
              <Select disabled>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Filter by Activity Type" />
                </SelectTrigger>
                 <SelectContent>
                  <SelectItem value="trf_submitted">TRF Submitted</SelectItem>
                  <SelectItem value="claim_created">Claim Created</SelectItem>
                  <SelectItem value="user_login">User Login</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="h-[250px] border-2 border-dashed rounded-lg flex items-center justify-center">
              <p className="text-muted-foreground">User Activity Volume Chart Placeholder</p>
            </div>
            <Button variant="outline" className="w-full" disabled>View User Activity Report</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
