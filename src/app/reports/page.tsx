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
import { format, subMonths, addMonths, isWithinInterval, parseISO } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";


// Define the type for TRF status data
interface TrfStatusData {
  month: string;
  pending: number;
  approved: number;
  rejected: number;
}

// Define types for other report data
interface ExpenseClaimData {
  month: string;
  submitted: number;
  approved: number;
  rejected: number;
}

interface AccommodationData {
  month: string;
  occupied: number;
  available: number;
}

interface VisaData {
  month: string;
  pending: number;
  approved: number;
  rejected: number;
}

interface UserActivityData {
  month: string;
  logins: number;
  trf_submitted: number;
  claim_created: number;
}

const trfChartConfig = {
  pending: { label: "Pending", color: "hsl(var(--chart-1))" },
  approved: { label: "Approved", color: "hsl(var(--chart-2))" },
  rejected: { label: "Rejected", color: "hsl(var(--chart-3))" },
} satisfies ChartConfig;

const expenseClaimChartConfig = {
  submitted: { label: "Submitted", color: "hsl(var(--chart-1))" },
  approved: { label: "Approved", color: "hsl(var(--chart-2))" },
  rejected: { label: "Rejected", color: "hsl(var(--chart-3))" },
} satisfies ChartConfig;

const accommodationChartConfig = {
  occupied: { label: "Occupied", color: "hsl(var(--chart-1))" },
  available: { label: "Available", color: "hsl(var(--chart-2))" },
} satisfies ChartConfig;

const visaChartConfig = {
  pending: { label: "Pending", color: "hsl(var(--chart-1))" },
  approved: { label: "Approved", color: "hsl(var(--chart-2))" },
  rejected: { label: "Rejected", color: "hsl(var(--chart-3))" },
} satisfies ChartConfig;

const userActivityChartConfig = {
  logins: { label: "Logins", color: "hsl(var(--chart-1))" },
  trf_submitted: { label: "TRF Submitted", color: "hsl(var(--chart-2))" },
  claim_created: { label: "Claim Created", color: "hsl(var(--chart-3))" },
} satisfies ChartConfig;


export default function ReportsPage() {
  const [trfStatusData, setTrfStatusData] = useState<TrfStatusData[]>([]);
  const [expenseClaimData, setExpenseClaimData] = useState<ExpenseClaimData[]>([]);
  const [accommodationData, setAccommodationData] = useState<AccommodationData[]>([]);
  const [visaData, setVisaData] = useState<VisaData[]>([]);
  const [userActivityData, setUserActivityData] = useState<UserActivityData[]>([]);

  const [isLoadingTrf, setIsLoadingTrf] = useState(false);
  const [errorTrf, setErrorTrf] = useState<string | null>(null);
  
  const [isLoadingExpense, setIsLoadingExpense] = useState(false);
  const [errorExpense, setErrorExpense] = useState<string | null>(null);

  const [isLoadingAccommodation, setIsLoadingAccommodation] = useState(false);
  const [errorAccommodation, setErrorAccommodation] = useState<string | null>(null);

  const [isLoadingVisa, setIsLoadingVisa] = useState(false);
  const [errorVisa, setErrorVisa] = useState<string | null>(null);

  const [isLoadingUserActivity, setIsLoadingUserActivity] = useState(false);
  const [errorUserActivity, setErrorUserActivity] = useState<string | null>(null);

  const [year, setYear] = useState<string>(new Date().getFullYear().toString());
  
  // Date range filter state
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subMonths(new Date(), 6),
    to: new Date(),
  });
  const [isApplyingFilters, setIsApplyingFilters] = useState(false);
  
  // Helper function to generate months data structure based on date range
  const generateMonthsFromDateRange = () => {
    if (!dateRange?.from || !dateRange?.to) {
      // Default to last 6 months if no date range is selected
      return Array.from({length: 6}, (_, i) => {
        const date = subMonths(new Date(), i);
        return { month: format(date, 'MMM'), date: date };
      }).reverse();
    }
    
    // Calculate the number of months between the from and to dates
    let months = [];
    let currentDate = new Date(dateRange.from);
    
    // Set to first day of month for consistent comparison
    currentDate.setDate(1);
    
    // Create a copy of the end date and set to last day of its month
    const endDate = new Date(dateRange.to);
    endDate.setDate(1); // First set to first day of month
    
    // Add each month in the range
    while (currentDate <= endDate) {
      months.push({
        month: format(currentDate, 'MMM'),
        date: new Date(currentDate)
      });
      currentDate = addMonths(currentDate, 1);
    }
    
    return months;
  };
  
  // Helper function to check if a date is within the selected date range
  const isDateInRange = (date: Date | string | number) => {
    if (!dateRange?.from || !dateRange?.to) return true; // No filter if no range
    
    let dateObj: Date;
    try {
      if (date instanceof Date) {
        dateObj = date;
      } else if (typeof date === 'string') {
        dateObj = new Date(date);
      } else if (typeof date === 'number') {
        dateObj = new Date(date);
      } else {
        return false;
      }
      
      // Check if the date is within the range
      return isWithinInterval(dateObj, { 
        start: dateRange.from, 
        end: dateRange.to 
      });
    } catch (error) {
      console.error('Error parsing date for range check:', error);
      return false;
    }
  };

  // Fetch TRF status data
  useEffect(() => {
    async function fetchTrfStatusData() {
      setIsLoadingTrf(true);
      setErrorTrf(null);
      try {
        // Include date range in query if available
        let url = '/api/trf/status-summary';
        const params = new URLSearchParams();
        params.append('year', year);
        
        if (dateRange?.from && dateRange?.to) {
          params.append('fromDate', dateRange.from.toISOString());
          params.append('toDate', dateRange.to.toISOString());
        }
        
        url += `?${params.toString()}`;
        console.log('Fetching TRF data with URL:', url);
        
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch TRF status data: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        if (data.statusByMonth && Array.isArray(data.statusByMonth)) {
          setTrfStatusData(data.statusByMonth);
        } else {
          const trfs = data.trfs || [];
          
          // Filter TRFs by date range if applicable
          const filteredTrfs = dateRange?.from && dateRange?.to
            ? trfs.filter((trf: any) => isDateInRange(trf.submittedAt))
            : trfs;
            
          console.log(`Filtered ${trfs.length} TRFs to ${filteredTrfs.length} based on date range`);
          
          // Generate months based on date range
          const months = generateMonthsFromDateRange().map(m => ({ ...m, pending: 0, approved: 0, rejected: 0 }));
          
          filteredTrfs.forEach((trf: any) => {
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
          
          setTrfStatusData(months.map(m => ({ 
            month: m.month, 
            pending: m.pending, 
            approved: m.approved, 
            rejected: m.rejected 
          })));
        }
      } catch (err: any) {
        console.error('Error fetching TRF status data:', err);
        setErrorTrf(err.message || 'Failed to fetch TRF status data');
        
        // Generate fallback data based on date range
        const fallbackMonths = generateMonthsFromDateRange();
        const fallbackData = fallbackMonths.map(m => ({
          month: m.month,
          pending: 0,
          approved: 0,
          rejected: 0
        }));
        
        setTrfStatusData(fallbackData);
      } finally {
        setIsLoadingTrf(false);
      }
    }
    fetchTrfStatusData();
  }, [year, dateRange, isApplyingFilters]);

  // Fetch Expense Claim data
  useEffect(() => {
    const fetchExpenseClaimData = async () => {
      setIsLoadingExpense(true);
      setErrorExpense(null);
      try {
        // Include date range in query if available
        let url = '/api/expense-claim/summary';
        const params = new URLSearchParams();
        params.append('year', year);
        
        if (dateRange?.from && dateRange?.to) {
          params.append('fromDate', dateRange.from.toISOString());
          params.append('toDate', dateRange.to.toISOString());
        }
        
        url += `?${params.toString()}`;
        console.log('Fetching expense claim data with URL:', url);
        
        const response = await fetch(url);
        
        // Always try to parse the response, even if status is not OK
        const data = await response.json();
        
        if (data.statusByMonth && Array.isArray(data.statusByMonth)) {
          console.log('Received expense claim data:', data.statusByMonth);
          setExpenseClaimData(data.statusByMonth);
        } else if (data.error) {
          // API returned an error message
          console.warn('API returned error:', data.error, data.details || '');
          throw new Error(data.error);
        } else {
          // Unexpected data format
          console.warn('Unexpected data format from API:', data);
          throw new Error('Invalid data format received');
        }
      } catch (err: any) {
        console.error('Error handling expense claim data:', err);
        setErrorExpense('Could not load expense claim data');
        
        // Generate fallback data based on date range
        const fallbackMonths = generateMonthsFromDateRange();
        const fallbackData = fallbackMonths.map((monthObj: {month: string}) => ({
          month: monthObj.month,
          submitted: 0,
          approved: 0,
          rejected: 0
        }));
        
        setExpenseClaimData(fallbackData);
      } finally {
        setIsLoadingExpense(false);
      }
    };
    fetchExpenseClaimData();
  }, [year, dateRange, isApplyingFilters]);

  // Fetch Accommodation data
  useEffect(() => {
    const fetchAccommodationData = async () => {
      setIsLoadingAccommodation(true);
      setErrorAccommodation(null);
      try {
        // Include date range in query if available
        let url = '/api/accommodation/summary';
        const params = new URLSearchParams();
        params.append('year', year);
        
        if (dateRange?.from && dateRange?.to) {
          params.append('fromDate', dateRange.from.toISOString());
          params.append('toDate', dateRange.to.toISOString());
        }
        
        url += `?${params.toString()}`;
        console.log('Fetching accommodation data with URL:', url);
        
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch accommodation data: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.bookingsByMonth && Array.isArray(data.bookingsByMonth)) {
          console.log('Received accommodation data:', data.bookingsByMonth);
          setAccommodationData(data.bookingsByMonth);
        } else {
          throw new Error('Invalid accommodation data format');
        }
      } catch (err: any) {
        console.error('Error fetching accommodation data:', err);
        setErrorAccommodation(err.message || 'Failed to fetch accommodation data');
        
        // Generate fallback data based on date range
        const fallbackMonths = generateMonthsFromDateRange();
        const fallbackData = fallbackMonths.map((monthObj: {month: string}) => ({
          month: monthObj.month,
          occupied: 0,
          available: 0
        }));
        
        setAccommodationData(fallbackData);
      } finally {
        setIsLoadingAccommodation(false);
      }
    };
    fetchAccommodationData();
  }, [year, dateRange, isApplyingFilters]);

  // Fetch Visa data
  useEffect(() => {
    const fetchVisaData = async () => {
      setIsLoadingVisa(true);
      setErrorVisa(null);
      try {
        // Include date range in query if available
        let url = '/api/visa/summary';
        const params = new URLSearchParams();
        params.append('year', year);
        
        if (dateRange?.from && dateRange?.to) {
          params.append('fromDate', dateRange.from.toISOString());
          params.append('toDate', dateRange.to.toISOString());
        }
        
        url += `?${params.toString()}`;
        console.log('Fetching visa data with URL:', url);
        
        const response = await fetch(url);
        
        // Always try to parse the response, even if status is not OK
        const data = await response.json();
        
        if (data.statusByMonth && Array.isArray(data.statusByMonth)) {
          console.log('Received visa data:', data.statusByMonth);
          setVisaData(data.statusByMonth.map((item: any) => ({
            month: item.month,
            pending: item.pending || 0,
            approved: item.approved || 0,
            rejected: item.rejected || 0,
          })));
        } else if (data.error) {
          // API returned an error message
          console.warn('Visa API returned error:', data.error, data.details || '');
          throw new Error(data.error);
        } else {
          // Unexpected data format
          console.warn('Unexpected data format from Visa API:', data);
          throw new Error('Invalid data format received');
        }
      } catch (err: any) {
        console.error('Error handling visa data:', err);
        setErrorVisa(err.message || 'Failed to load visa data');
        
        // Generate fallback data based on date range
        const fallbackMonths = generateMonthsFromDateRange();
        const fallbackData = fallbackMonths.map((monthObj: {month: string}) => ({
          month: monthObj.month,
          pending: 0,
          approved: 0,
          rejected: 0
        }));
        
        setVisaData(fallbackData);
      } finally {
        setIsLoadingVisa(false);
      }
    };
    fetchVisaData();
  }, [year, dateRange, isApplyingFilters]);

  // Fetch User Activity data
  useEffect(() => {
    const fetchUserActivityData = async () => {
      setIsLoadingUserActivity(true);
      setErrorUserActivity(null);
      try {
        // Include date range in query if available
        let url = '/api/user-activity/summary';
        const params = new URLSearchParams();
        params.append('year', year);
        
        if (dateRange?.from && dateRange?.to) {
          params.append('fromDate', dateRange.from.toISOString());
          params.append('toDate', dateRange.to.toISOString());
        }
        
        url += `?${params.toString()}`;
        console.log('Fetching user activity data with URL:', url);
        
        const response = await fetch(url);
        
        // Always try to parse the response, even if status is not OK
        const data = await response.json();
        
        if (data.activityByMonth && Array.isArray(data.activityByMonth)) {
          console.log('Received user activity data:', data.activityByMonth);
          setUserActivityData(data.activityByMonth.map((item: any) => ({
            month: item.month,
            logins: item.logins || 0,
            trf_submitted: item.trf_submitted || 0,
            claim_created: item.claim_created || 0,
          })));
        } else if (data.error) {
          // API returned an error message
          console.warn('User Activity API returned error:', data.error, data.details || '');
          throw new Error(data.error);
        } else {
          // Unexpected data format
          console.warn('Unexpected data format from User Activity API:', data);
          throw new Error('Invalid data format received');
        }
      } catch (err: any) {
        console.error('Error handling user activity data:', err);
        setErrorUserActivity(err.message || 'Failed to load user activity data');
        
        // Generate fallback data based on date range
        const fallbackMonths = generateMonthsFromDateRange();
        const fallbackData = fallbackMonths.map((monthObj: {month: string}) => ({
          month: monthObj.month,
          logins: 0,
          trf_submitted: 0,
          claim_created: 0
        }));
        
        setUserActivityData(fallbackData);
      } finally {
        setIsLoadingUserActivity(false);
      }
    };
    fetchUserActivityData();
  }, [year, dateRange, isApplyingFilters]);
  
  return (
    <div className="w-full px-2 py-8 space-y-8">
      <div className="flex items-center gap-3">
        <BarChart2 className="w-8 h-8 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight">Travel Reports</h1>
      </div>
      <CardDescription>
        View reports and analytics on travel expenses and trends. Report visibility may depend on your access level.
      </CardDescription>

      {/* General Filters */}
      <Card className="w-full">
        <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><Filter className="h-5 w-5"/> General Report Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-3">
            <div className="flex items-center gap-2 w-full sm:w-auto">
                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            variant={"outline"}
                            className={cn(
                                "w-full sm:w-[300px] justify-start text-left font-normal",
                                !dateRange && "text-muted-foreground"
                            )}
                        >
                            <CalendarDays className="mr-2 h-4 w-4" />
                            {dateRange?.from ? (
                                dateRange.to ? (
                                    <>
                                        {format(dateRange.from, "LLL dd, y")} -{" "}
                                        {format(dateRange.to, "LLL dd, y")}
                                    </>
                                ) : (
                                    format(dateRange.from, "LLL dd, y")
                                )
                            ) : (
                                <span>Select date range</span>
                            )}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                            initialFocus
                            mode="range"
                            defaultMonth={dateRange?.from}
                            selected={dateRange}
                            onSelect={setDateRange}
                            numberOfMonths={2}
                        />
                    </PopoverContent>
                </Popover>
            </div>
            <Button 
                onClick={() => {
                    setIsApplyingFilters(true);
                    // Refresh all data with the new date range
                    // This will trigger all useEffects
                    setTimeout(() => setIsApplyingFilters(false), 100);
                }}
                disabled={isApplyingFilters}
                className="w-full sm:w-auto"
            >
                {isApplyingFilters ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Applying...
                    </>
                ) : (
                    "Apply General Filters"
                )}
            </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* TRF Reports Card */}
        <Card className="shadow-lg w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileText /> TRF Reports</CardTitle>
            <CardDescription>Analyze Travel Request Form trends, statuses, and processing times.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <Select 
                onValueChange={(value) => {
                  console.log('Department filter changed:', value);
                  // Add your department filter logic here
                }}
                aria-label="Department filter"
              >
                <SelectTrigger className="w-full sm:flex-1" aria-label="Filter by Department">
                  <SelectValue placeholder="Filter by Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ict">ICT</SelectItem>
                  <SelectItem value="finance">Finance</SelectItem>
                  <SelectItem value="exploration">Exploration</SelectItem>
                </SelectContent>
              </Select>
               <Select 
                onValueChange={(value) => {
                  console.log('TRF Status filter changed:', value);
                  // Add your status filter logic here
                }}
                aria-label="TRF Status filter"
              >
                <SelectTrigger className="w-full sm:flex-1" aria-label="Filter by TRF Status">
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
              {isLoadingTrf ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Loading data...</span>
                </div>
              ) : errorTrf ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-destructive">{errorTrf}</p>
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
        <Card className="shadow-lg w-full">
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
            <div className="h-[250px] w-full pt-4">
              {isLoadingExpense ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Loading data...</span>
                </div>
              ) : errorExpense ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-destructive">{errorExpense}</p>
                </div>
              ) : (
                <ChartContainer config={expenseClaimChartConfig} className="h-full w-full">
                  <BarChart accessibilityLayer data={expenseClaimData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis tickLine={false} axisLine={false} tickMargin={8} />
                    <Tooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="submitted" fill="var(--color-submitted)" radius={4} />
                    <Bar dataKey="approved" fill="var(--color-approved)" radius={4} />
                    <Bar dataKey="rejected" fill="var(--color-rejected)" radius={4} />
                  </BarChart>
                </ChartContainer>
              )}
            </div>
            <Button variant="outline" className="w-full" disabled>View Detailed Claim Report</Button>
          </CardContent>
        </Card>

        {/* Accommodation Reports Card */}
        <Card className="shadow-lg w-full">
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
            <div className="h-[250px] w-full pt-4">
              {isLoadingAccommodation ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Loading data...</span>
                </div>
              ) : errorAccommodation ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-destructive">{errorAccommodation}</p>
                </div>
              ) : (
                <ChartContainer config={accommodationChartConfig} className="h-full w-full">
                  <BarChart accessibilityLayer data={accommodationData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis tickLine={false} axisLine={false} tickMargin={8} />
                    <Tooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="occupied" fill="var(--color-occupied)" radius={4} />
                    <Bar dataKey="available" fill="var(--color-available)" radius={4} />
                  </BarChart>
                </ChartContainer>
              )}
            </div>
            <Button variant="outline" className="w-full" disabled>View Detailed Accommodation Report</Button>
          </CardContent>
        </Card>

        {/* Visa Application Reports Card */}
        <Card className="shadow-lg w-full">
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
            <div className="h-[250px] w-full pt-4">
              {isLoadingVisa ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Loading data...</span>
                </div>
              ) : errorVisa ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-destructive">{errorVisa}</p>
                </div>
              ) : (
                <ChartContainer config={visaChartConfig} className="h-full w-full">
                  <BarChart accessibilityLayer data={visaData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
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
            <Button variant="outline" className="w-full" disabled>View Detailed Visa Report</Button>
          </CardContent>
        </Card>
        
        {/* User Activity Reports Card */}
        <Card className="shadow-lg w-full">
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
            <div className="h-[250px] w-full pt-4">
              {isLoadingUserActivity ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Loading data...</span>
                </div>
              ) : errorUserActivity ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-destructive">{errorUserActivity}</p>
                </div>
              ) : (
                <ChartContainer config={userActivityChartConfig} className="h-full w-full">
                  <BarChart accessibilityLayer data={userActivityData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis tickLine={false} axisLine={false} tickMargin={8} />
                    <Tooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="logins" fill="var(--color-logins)" radius={4} />
                    <Bar dataKey="trf_submitted" fill="var(--color-trf_submitted)" radius={4} />
                    <Bar dataKey="claim_created" fill="var(--color-claim_created)" radius={4} />
                  </BarChart>
                </ChartContainer>
              )}
            </div>
            <Button variant="outline" className="w-full" disabled>View User Activity Report</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
