"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { DateRange } from "react-day-picker";
import { addDays, format, parseISO, isValid, isSameDay } from "date-fns";
import { BedDouble, Eye, CheckCircle, Clock, AlertTriangle, ArrowLeft, Home, Building, CalendarPlus, Loader2, UserCheck, XCircle } from "lucide-react";
import { useSessionPermissions } from '@/hooks/use-session-permissions';
import { StatusBadge } from '@/lib/status-utils';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import type { BookingData } from "@/types/accommodation";

// Types from the main accommodation admin
interface AdminTrfForAccommodation {
  id: string;
  requestorName: string;
  staffId?: string;
  department?: string;
  purpose?: string;
  status: string;
  submittedAt: string;
  checkInDate?: string;
  checkOutDate?: string;
  location?: string;
  accommodationType?: string;
}

interface StaffHouseData {
  id: string;
  name: string;
  location: string;
  rooms: Array<{ id: string; name: string; capacity: number; }>;
}

// Import BookingData from types instead of duplicating

const AccommodationProcessingPage = () => {
  const [pendingAccommodationTRFs, setPendingAccommodationTRFs] = useState<AdminTrfForAccommodation[]>([]);
  const [bookedAccommodations, setBookedAccommodations] = useState<any[]>([]);
  const [staffHouses, setStaffHouses] = useState<StaffHouseData[]>([]);
  const [bookings, setBookings] = useState<BookingData[]>([]);
  const [selectedTRF, setSelectedTRF] = useState<AdminTrfForAccommodation | null>(null);
  const [selectedStaffHouse, setSelectedStaffHouse] = useState<StaffHouseData | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<{ id: string; name: string } | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [activeTab, setActiveTab] = useState<'pending' | 'booked'>('pending');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedLocation, setSelectedLocation] = useState<string>("Ashgabat");
  const [isBookingDialogOpen, setIsBookingDialogOpen] = useState(false);
  const [selectedStaffHouseForBooking, setSelectedStaffHouseForBooking] = useState<string>("");
  const [selectedRoomForBooking, setSelectedRoomForBooking] = useState<string>("");
  
  const { toast } = useToast();
  const { role, userId, isLoading: sessionLoading } = useSessionPermissions();

  // Fetch pending accommodation requests
  const fetchTrfsAwaitingAccommodation = useCallback(async () => {
    if (sessionLoading || !role) return;
    
    setIsLoading(true);
    setError(null);
    try {
      // Try fetching from different endpoints to see what works
      console.log('Attempting to fetch accommodation requests...');
      
      // First try the admin accommodation endpoint
      let response;
      let url;
      
      try {
        // Fetch requests that are ready for accommodation assignment but not yet booked
        // For ad-hoc: "Approved" status, for TSRs: "Approved" or "Pending Accommodation"
        url = '/api/admin/accommodation?statuses=Approved,Pending Accommodation&processing=true';
        console.log('Trying admin accommodation endpoint for pending:', url);
        response = await fetch(url);
        console.log('Admin accommodation response status:', response.status);
        
        if (!response.ok) {
          // Fallback to TRF endpoint
          const statusesToFetch = ["Approved", "Pending Accommodation"].join(',');
          url = `/api/trf?statuses=${encodeURIComponent(statusesToFetch)}&limit=50`;
          console.log('Fallback to TRF endpoint for pending:', url);
          response = await fetch(url);
          console.log('TRF endpoint response status:', response.status);
        }
      } catch (fetchError) {
        console.error('Fetch attempt failed:', fetchError);
        throw new Error(`Network error: ${fetchError.message}`);
      }
      
      // Response is already set above
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('TRF fetch error response:', errorText);
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
        throw new Error(errorData.error || errorData.details || `Failed to fetch TRFs: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Fetch successful, raw data:', data);
      console.log('Raw data keys:', Object.keys(data));
      console.log('Raw data type:', typeof data);
      console.log('Is raw data array:', Array.isArray(data));
      
      // Handle both TRF API format and admin accommodation API format
      let requests = [];
      if (Array.isArray(data)) {
        // Direct array from admin accommodation API
        console.log('Using direct array format');
        requests = data;
      } else if (data.requests && Array.isArray(data.requests)) {
        // Admin accommodation API with requests wrapper
        console.log('Using admin accommodation API with requests wrapper');
        requests = data.requests;
      } else if (data.trfs && Array.isArray(data.trfs)) {
        // TRF API format
        console.log('Using TRF API format');
        requests = data.trfs;
      } else {
        console.warn('Unexpected data format:', data);
        requests = [];
      }
      
      console.log('Extracted requests:', requests);
      console.log('Number of extracted requests:', requests.length);
      if (requests.length > 0) {
        console.log('First request sample:', requests[0]);
      console.log('All requests full details:');
      requests.forEach((req, index) => {
        console.log(`Request ${index + 1}:`, {
          id: req.id,
          status: req.status,
          travelType: req.travelType,
          travel_type: req.travel_type,
          accommodationType: req.accommodationType,
          allProperties: Object.keys(req)
        });
      });
      }
      
      // Filter for requests that need accommodation
      const trfsWithAccommodationNeeds = requests.filter((item: any) => {
        // Handle both accommodation requests and TRFs
        // Handle both camelCase (travelType) and snake_case (travel_type) property names
        const travelType = item.travelType || item.travel_type;
        
        // If the data came from the accommodation API endpoint, these are all accommodation requests
        // Check if it's an accommodation request by: 
        // 1. Has accommodationType field (from accommodation API)
        // 2. Travel type is 'Accommodation' (standalone accommodation requests)
        // 3. ID starts with ACCOM- (auto-generated accommodation requests)
        // 4. TSR with accommodation details (TSR- prefix but has accommodation needs)
        const isAccommodationRequest = item.accommodationType || 
                                     travelType === 'Accommodation' || 
                                     (item.id && item.id.startsWith('ACCOM-')) ||
                                     (item.id && item.id.startsWith('TSR-') && item.accommodationDetails?.length > 0);
        
        // For pending accommodation, only include requests that are ready for assignment but not yet booked
        const isPendingForAssignment = (
          item.status === 'Approved' ||
          item.status === 'Pending Accommodation' ||
          item.status === 'Pending Accommodation Admin'
        );
        
        // TSRs need accommodation if they have accommodation details and are in pending status
        const isTrfNeedingAccommodation = (travelType === 'Domestic' || travelType === 'Overseas') && isPendingForAssignment;
        
        // Only include accommodation requests that are pending assignment (not already booked)
        const shouldInclude = (isAccommodationRequest || isTrfNeedingAccommodation) && isPendingForAssignment;
        
        console.log('Filtering item:', {
          id: item.id,
          resolvedTravelType: travelType,
          status: item.status,
          accommodationType: item.accommodationType,
          isAccommodationRequest,
          isTrfNeedingAccommodation,
          shouldInclude
        });
        
        return shouldInclude;
      }).map((item: any) => {
        // Enrich TRF data with accommodation details if available
        return {
          ...item,
          // Try to extract check-in/out dates from various possible sources
          checkInDate: item.checkInDate || item.requestedCheckInDate || null,
          checkOutDate: item.checkOutDate || item.requestedCheckOutDate || null,
          location: item.location || null,
          accommodationType: item.accommodationType || 'Standard'
        };
      });
      
      console.log('Filtered TRFs needing accommodation:', trfsWithAccommodationNeeds.length);
      
      // Separate pending vs assigned requests
      console.log('All filtered requests before status separation:', trfsWithAccommodationNeeds.map(item => ({
        id: item.id,
        status: item.status,
        statusType: typeof item.status
      })));
      
      const pendingRequests = trfsWithAccommodationNeeds.filter((item: any) => {
        const isPending = item.status === 'Approved' || item.status === 'Processing Accommodation';
        console.log(`Request ${item.id} status "${item.status}" is pending:`, isPending);
        return isPending;
      });
      const assignedRequests = trfsWithAccommodationNeeds.filter((item: any) => {
        const isAssigned = item.status === 'Accommodation Assigned';
        console.log(`Request ${item.id} status "${item.status}" is assigned:`, isAssigned);
        return isAssigned;
      });
      
      console.log('Pending requests:', pendingRequests.length, 'Assigned requests:', assignedRequests.length);
      console.log('Pending request IDs:', pendingRequests.map(r => r.id));
      console.log('Assigned request IDs:', assignedRequests.map(r => r.id));
      setPendingAccommodationTRFs(pendingRequests);
      
      // Update booked accommodations with assigned requests
      setBookedAccommodations(assignedRequests);
    } catch (err: any) {
      console.error("Error fetching TRFs:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [sessionLoading, role]);

  // Fetch staff houses
  const fetchStaffHouses = useCallback(async () => {
    try {
      const response = await fetch('/api/accommodation?dataType=staffHouses');
      if (response.ok) {
        const data = await response.json();
        console.log('Staff houses data:', data);
        setStaffHouses(data.staffHouses || []);
      } else {
        console.error('Failed to fetch staff houses:', response.status);
      }
    } catch (error) {
      console.error('Error fetching staff houses:', error);
    }
  }, []);

  // Fetch bookings for current month
  const fetchBookings = useCallback(async () => {
    try {
      const response = await fetch(`/api/accommodation?dataType=bookings&year=${currentMonth.getFullYear()}&month=${currentMonth.getMonth() + 1}`);
      if (response.ok) {
        const data = await response.json();
        console.log('Bookings data:', data);
        setBookings(data.bookings || []);
      } else {
        console.error('Failed to fetch bookings:', response.status);
      }
    } catch (error) {
      console.error('Error fetching bookings:', error);
    }
  }, [currentMonth]);

  // Fetch booked accommodations
  const fetchBookedAccommodations = useCallback(async () => {
    try {
      // Fetch accommodations that are actually booked:
      // - Ad-hoc accommodations with "Accommodation Assigned" status
      // - TSR accommodations with "TRF Processed" status
      const response = await fetch('/api/admin/accommodation?statuses=Accommodation Assigned,TRF Processed&processing=true');
      if (response.ok) {
        const data = await response.json();
        console.log('Booked accommodations API response:', data);
        
        let bookedData = Array.isArray(data) ? data : data.requests || [];
        
        // Filter to only include requests that have actual booking records (booking_count > 0)
        // This ensures we only show truly "booked" accommodations, not just status changes
        console.log('Raw booked data before filtering:', bookedData);
        
        // Note: The accommodation service should ideally filter this, but we can add client-side verification
        setBookedAccommodations(bookedData);
      } else {
        console.error('Failed to fetch booked accommodations:', response.status, response.statusText);
        // Try to get error details
        try {
          const errorData = await response.json();
          console.error('Booked accommodations API error details:', errorData);
        } catch (parseError) {
          console.error('Could not parse error response');
        }
      }
    } catch (error) {
      console.error('Error fetching booked accommodations:', error);
    }
  }, []);

  // Auto-populate dates when TRF is selected
  const handleTrfSelection = (trf: AdminTrfForAccommodation) => {
    setSelectedTRF(trf);
    
    // Auto-populate dates from accommodation request if available
    if (trf.checkInDate && trf.checkOutDate) {
      try {
        const checkIn = new Date(trf.checkInDate);
        const checkOut = new Date(trf.checkOutDate);
        
        if (!isNaN(checkIn.getTime()) && !isNaN(checkOut.getTime())) {
          setDateRange({
            from: checkIn,
            to: checkOut
          });
          console.log('Auto-populated dates:', { from: checkIn, to: checkOut });
        }
      } catch (error) {
        console.warn('Error parsing accommodation dates:', error);
      }
    }
    
    // Auto-select location if available
    if (trf.location) {
      setSelectedLocation(trf.location);
    }
  };

  useEffect(() => {
    fetchTrfsAwaitingAccommodation();
    fetchBookedAccommodations();
    fetchStaffHouses();
    fetchBookings();
  }, [fetchTrfsAwaitingAccommodation, fetchBookedAccommodations, fetchStaffHouses, fetchBookings]);

  // Get booking info for a specific date and room
  const getDateBookingInfo = (date: Date, roomId?: string) => {
    if (!roomId) return { isOccupied: false, status: null, guestName: null, booking: null };
    
    const targetDateStr = format(date, 'yyyy-MM-dd');
    const allBookingsForDate = bookings.filter(booking => {
      try {
        if (!booking.bookingDate) return false;
        const bookingDate = new Date(booking.bookingDate);
        if (isNaN(bookingDate.getTime())) return false;
        const bookingDateStr = format(bookingDate, 'yyyy-MM-dd');
        return bookingDateStr === targetDateStr && booking.roomId === roomId;
      } catch (error) {
        console.warn('Invalid booking date:', booking.bookingDate);
        return false;
      }
    });
    
    if (allBookingsForDate.length > 0) {
      const priorityBooking = allBookingsForDate.find(b => b.status === 'Active') || allBookingsForDate[0];
      return {
        isOccupied: true,
        status: priorityBooking.status,
        guestName: allBookingsForDate.length > 1 ? `${priorityBooking.guestName} (+${allBookingsForDate.length - 1} more)` : priorityBooking.guestName,
        booking: priorityBooking,
        totalBookings: allBookingsForDate.length
      };
    }
    
    return { isOccupied: false, status: null, guestName: null, booking: null };
  };

  // Check for booking conflicts in selected date range
  const checkBookingConflicts = (dateRange: DateRange, roomId: string) => {
    if (!dateRange?.from || !dateRange?.to || !roomId) return [];
    
    const conflicts: any[] = [];
    const startDate = new Date(dateRange.from);
    const endDate = new Date(dateRange.to);
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      try {
        const bookingInfo = getDateBookingInfo(currentDate, roomId);
        if (bookingInfo.isOccupied) {
          conflicts.push({
            date: new Date(currentDate),
            ...bookingInfo
          });
        }
      } catch (error) {
        console.warn('Error checking booking conflicts for date:', currentDate);
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return conflicts;
  };

  // Handle cancellation of booked accommodation
  const handleCancelAccommodation = async (accommodationId: string) => {
    try {
      const response = await fetch(`/api/accommodation/admin/bookings/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trfId: accommodationId }),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Accommodation booking cancelled successfully",
        });
        // Refresh data
        fetchBookedAccommodations();
        fetchBookings();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to cancel accommodation",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to cancel accommodation",
        variant: "destructive",
      });
    }
  };

  // Handle booking accommodation
  const handleBookAccommodation = async () => {
    if (!selectedTRF || !selectedStaffHouseForBooking || !selectedRoomForBooking || !dateRange?.from || !dateRange?.to) {
      toast({
        title: "Missing information",
        description: "Please select a TRF, staff house, room, and date range",
        variant: "destructive",
      });
      return;
    }

    // Check for conflicts
    const conflicts = checkBookingConflicts(dateRange, selectedRoomForBooking);
    if (conflicts.length > 0) {
      toast({
        title: "Booking conflict",
        description: `Room is already booked for ${conflicts.length} day(s) in the selected range`,
        variant: "destructive",
      });
      return;
    }

    try {
      // Get staff house and room names for the assignment info
      const selectedStaffHouseName = staffHouses.find(h => h.id === selectedStaffHouseForBooking)?.name || selectedStaffHouseForBooking;
      const selectedRoomName = staffHouses.find(h => h.id === selectedStaffHouseForBooking)?.rooms.find(r => r.id === selectedRoomForBooking)?.name || selectedRoomForBooking;
      
      const assignedRoomInfo = `${selectedStaffHouseName} - ${selectedRoomName} (${format(dateRange.from, 'MMM dd')} - ${format(dateRange.to, 'MMM dd, yyyy')})`;
      
      console.log('Booking accommodation with info:', assignedRoomInfo);
      
      const assignmentUrl = '/api/accommodation/admin/assign/' + selectedTRF.id;
      console.log('=== FRONTEND: Making assignment request to URL:', assignmentUrl);
      console.log('=== FRONTEND: Request payload:', {
        assignedRoomInfo: assignedRoomInfo,
        staffHouseId: selectedStaffHouseForBooking,
        roomId: selectedRoomForBooking,
        startDate: format(dateRange.from, 'yyyy-MM-dd'),
        endDate: format(dateRange.to, 'yyyy-MM-dd')
      });
      
      const response = await fetch(assignmentUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignedRoomInfo: assignedRoomInfo,
          staffHouseId: selectedStaffHouseForBooking,
          roomId: selectedRoomForBooking,
          startDate: format(dateRange.from, 'yyyy-MM-dd'),
          endDate: format(dateRange.to, 'yyyy-MM-dd')
        }),
      });

      console.log('Assignment response status:', response.status);
      console.log('Assignment response ok:', response.ok);
      
      if (response.ok) {
        const result = await response.json();
        console.log('Assignment success result:', result);
        
        toast({
          title: "Success",
          description: "Accommodation assigned successfully",
        });
        setIsBookingDialogOpen(false);
        // Reset selections
        setSelectedTRF(null);
        setSelectedStaffHouseForBooking("");
        setSelectedRoomForBooking("");
        setDateRange(undefined);
        // Refresh data
        fetchTrfsAwaitingAccommodation();
        fetchBookedAccommodations();
        fetchBookings();
      } else {
        console.log('Response not ok, status:', response.status);
        const contentType = response.headers.get('content-type');
        console.log('Content type:', contentType);
        
        let error;
        try {
          if (contentType && contentType.includes('application/json')) {
            error = await response.json();
          } else {
            const textResponse = await response.text();
            console.log('Non-JSON response:', textResponse);
            error = { error: textResponse || 'Unknown error occurred' };
          }
        } catch (parseError) {
          console.error('Error parsing response:', parseError);
          error = { error: `Failed to parse error response (Status: ${response.status})` };
        }
        
        console.error('Assignment error:', error);
        console.error('Assignment error JSON:', JSON.stringify(error, null, 2));
        console.error('Assignment error keys:', Object.keys(error));
        
        // Handle specific error cases
        if (error.error && error.error.includes('Processing Accommodation')) {
          // If the request needs to be in Processing Accommodation status first
          toast({
            title: "Status Error",
            description: "Request must be in 'Processing Accommodation' status first. Try updating the request status.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Error",
            description: error.error || error.details || "Failed to assign accommodation",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to book accommodation",
        variant: "destructive",
      });
    }
  };

  if (isLoading || sessionLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Loading accommodation processing...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BedDouble className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Accommodation Processing Dashboard</h1>
            <p className="text-muted-foreground">Process accommodation requests with integrated booking system</p>
          </div>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin/accommodation">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Admin
          </Link>
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab as any} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="pending" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Pending Requests ({pendingAccommodationTRFs.length})
          </TabsTrigger>
          <TabsTrigger value="booked" className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Booked Accommodations ({bookedAccommodations.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {/* Main Layout - Two Column Grid */}
          <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
          {/* Overall Availability Calendar */}
          <Card>
            <CardHeader>
              <CardTitle>Overall Availability Calendar</CardTitle>
              <CardDescription>View room availability and make bookings</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Calendar Navigation */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const prevMonth = new Date(currentMonth);
                      prevMonth.setMonth(prevMonth.getMonth() - 1);
                      setCurrentMonth(prevMonth);
                    }}
                  >
                    ←
                  </Button>
                  <h3 className="text-lg font-medium">
                    {format(currentMonth, 'MMMM yyyy')}
                  </h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const nextMonth = new Date(currentMonth);
                      nextMonth.setMonth(nextMonth.getMonth() + 1);
                      setCurrentMonth(nextMonth);
                    }}
                  >
                    →
                  </Button>
                </div>
                <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ashgabat">Ashgabat</SelectItem>
                    <SelectItem value="Kiyanly">Kiyanly</SelectItem>
                    <SelectItem value="Turkmenbashy">Turkmenbashy</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Calendar Grid */}
              <div className="overflow-x-auto">
                <div className="min-w-[1200px]">
                  {/* Calendar Header */}
                  <div className="grid gap-1 mb-3" style={{gridTemplateColumns: '200px repeat(31, 1fr)'}}>
                    <div className="font-semibold text-sm text-gray-700 bg-gradient-to-r from-gray-100 to-gray-50 p-3 rounded-lg border">
                      Staff House / Room
                    </div>
                    {Array.from({ length: 31 }, (_, i) => {
                      const date = addDays(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1), i);
                      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                      return (
                        <div key={i} className={cn(
                          "text-xs text-center font-medium p-2 rounded border",
                          isWeekend ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-gray-50 text-gray-600 border-gray-200"
                        )}>
                          <div className="font-semibold">{format(date, 'EEE')}</div>
                          <div className="text-xs font-normal">{format(date, 'dd')}</div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Staff House Rows */}
                  {staffHouses
                    .filter(house => house.location === selectedLocation)
                    .map(house => (
                      <div key={house.id} className="space-y-2 mb-4">
                        <div className="font-semibold text-sm text-gray-800 bg-gradient-to-r from-gray-100 to-gray-50 px-3 py-2 rounded-lg border shadow-sm">
                          📍 {house.name}
                        </div>
                        {house.rooms.map(room => (
                          <div key={room.id} className="grid gap-1 items-center hover:bg-gray-50/50 transition-colors rounded" style={{gridTemplateColumns: '200px repeat(31, 1fr)'}}>
                            <div className="text-sm font-medium text-gray-700 px-3 py-2 bg-white border rounded-lg shadow-sm truncate">
                              🚪 {room.name}
                            </div>
                            {Array.from({ length: 31 }, (_, i) => {
                              const date = addDays(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1), i);
                              const bookingInfo = getDateBookingInfo(date, room.id);
                              
                              return (
                                <div
                                  key={i}
                                  className={cn(
                                    "h-8 rounded border text-xs font-medium flex items-center justify-center cursor-pointer transition-colors",
                                    bookingInfo.isOccupied 
                                      ? bookingInfo.status === 'Blocked' 
                                        ? "bg-red-200 text-red-800 border-red-300" 
                                        : "bg-green-200 text-green-800 border-green-300"
                                      : "bg-white border-gray-200 hover:bg-gray-100"
                                  )}
                                  title={bookingInfo.isOccupied ? `${bookingInfo.guestName} (${bookingInfo.status})` : 'Available'}
                                >
                                  {bookingInfo.isOccupied ? '●' : ''}
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pending Accommodation Requests */}
          <Card>
            <CardHeader>
              <CardTitle>Pending Accommodation Requests</CardTitle>
              <CardDescription>Select requests to process and assign accommodation</CardDescription>
            </CardHeader>
            <CardContent>
              {pendingAccommodationTRFs.length === 0 ? (
                <div className="text-center py-8">
                  <Building className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-2 text-lg font-medium">No pending requests</h3>
                  <p className="mt-1 text-sm text-muted-foreground">All approved requests have been processed</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>TSR ID</TableHead>
                      <TableHead>Requestor</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingAccommodationTRFs.map((trf) => (
                      <TableRow key={trf.id} className={selectedTRF?.id === trf.id ? 'bg-blue-50' : ''}>
                        <TableCell className="font-medium">{trf.id}</TableCell>
                        <TableCell>{trf.requestorName}</TableCell>
                        <TableCell>{trf.department || 'N/A'}</TableCell>
                        <TableCell>
                          <StatusBadge status={trf.status} showIcon />
                        </TableCell>
                        <TableCell>{isValid(parseISO(trf.submittedAt)) ? format(parseISO(trf.submittedAt), 'PPP') : 'N/A'}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant={selectedTRF?.id === trf.id ? "default" : "outline"}
                              onClick={() => handleTrfSelection(trf)}
                            >
                              <UserCheck className="h-4 w-4 mr-1" />
                              {selectedTRF?.id === trf.id ? 'Selected' : 'Select'}
                            </Button>
                            <Button size="sm" variant="ghost" asChild>
                              <Link href={`/trf/view/${trf.id}`}>
                                <Eye className="h-4 w-4" />
                              </Link>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
            </div>

            {/* Booking Details Panel */}
            <Card>
          <CardHeader>
            <CardTitle>Booking Details {selectedTRF ? `(${selectedTRF.id})` : ''}</CardTitle>
            <CardDescription>
              {selectedTRF ? 'Assign accommodation for selected request' : 'Select a request to process'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedTRF ? (
              <>
                <div>
                  <h4 className="font-semibold text-sm">Requestor:</h4>
                  <p className="text-sm text-muted-foreground">{selectedTRF.requestorName}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm">Department:</h4>
                  <p className="text-sm text-muted-foreground">{selectedTRF.department || 'N/A'}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm">Status:</h4>
                  <StatusBadge status={selectedTRF.status} showIcon />
                </div>

                <div className="pt-4 border-t">
                  <Label className="text-sm font-semibold">Staff House</Label>
                  <Select value={selectedStaffHouseForBooking} onValueChange={setSelectedStaffHouseForBooking}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select staff house" />
                    </SelectTrigger>
                    <SelectContent>
                      {staffHouses.filter(house => house.location === selectedLocation).map(house => (
                        <SelectItem key={house.id} value={house.id}>{house.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedStaffHouseForBooking && (
                  <div>
                    <Label className="text-sm font-semibold">Room</Label>
                    <Select value={selectedRoomForBooking} onValueChange={setSelectedRoomForBooking}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select room" />
                      </SelectTrigger>
                      <SelectContent>
                        {staffHouses.find(h => h.id === selectedStaffHouseForBooking)?.rooms.map(room => (
                          <SelectItem key={room.id} value={room.id}>{room.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div>
                  <Label className="text-sm font-semibold">Date Range</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="mt-1 w-full justify-start text-left font-normal">
                        <CalendarPlus className="mr-2 h-4 w-4" />
                        {dateRange?.from ? (
                          dateRange.to ? (
                            <>
                              {format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}
                            </>
                          ) : (
                            format(dateRange.from, "LLL dd, y")
                          )
                        ) : (
                          <span>Pick a date range</span>
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
                  className="w-full mt-4"
                  onClick={handleBookAccommodation}
                  disabled={!selectedStaffHouseForBooking || !selectedRoomForBooking || !dateRange?.from || !dateRange?.to}
                >
                  <Home className="mr-2 h-4 w-4" />
                  Book Accommodation
                </Button>
              </>
            ) : (
              <div className="text-center py-8">
                <Building className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">
                  Select a request from the table to process accommodation booking
                </p>
              </div>
            )}
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="booked" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Booked Accommodations</CardTitle>
            <CardDescription>
              View and manage all booked accommodation requests
            </CardDescription>
          </CardHeader>
          <CardContent>
            {bookedAccommodations.length === 0 ? (
              <div className="text-center py-8">
                <Building className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-lg font-medium">No booked accommodations</h3>
                <p className="mt-1 text-sm text-muted-foreground">Booked accommodations will appear here</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Request ID</TableHead>
                    <TableHead>Requestor</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Assigned Room</TableHead>
                    <TableHead>Check-In</TableHead>
                    <TableHead>Check-Out</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bookedAccommodations.map((accommodation) => (
                    <TableRow key={accommodation.id}>
                      <TableCell className="font-medium">{accommodation.id}</TableCell>
                      <TableCell>{accommodation.requestorName}</TableCell>
                      <TableCell>{accommodation.accommodationType || 'Standard'}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {accommodation.assignedRoomInfo || 'Not assigned'}
                          {accommodation.bookingCount > 0 && (
                            <Badge variant="secondary" className="ml-2">
                              {accommodation.bookingCount} days
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {accommodation.checkInDate && isValid(parseISO(accommodation.checkInDate)) 
                          ? format(parseISO(accommodation.checkInDate), 'PPP') : 'N/A'}
                      </TableCell>
                      <TableCell>
                        {accommodation.checkOutDate && isValid(parseISO(accommodation.checkOutDate)) 
                          ? format(parseISO(accommodation.checkOutDate), 'PPP') : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={accommodation.status} showIcon />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleCancelAccommodation(accommodation.id)}
                            disabled={accommodation.status === 'Completed'}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Cancel
                          </Button>
                          <Button size="sm" variant="ghost" asChild>
                            <Link href={`/accommodation/view/${accommodation.id}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
    </div>
  );
};

export default AccommodationProcessingPage;