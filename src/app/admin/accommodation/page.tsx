"use client";

import React, { useState, useEffect, useCallback } from 'react';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { DateRange } from "react-day-picker";
import { addDays, format, isSameDay, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { cn } from '@/lib/utils';
import { StaffHouseData, StaffGuest, BookingData, GuestGender, LocationType, BookingStatus } from '@/types/accommodation';
import Link from 'next/link';
import { CalendarIcon, Loader2, AlertTriangle, BedDouble, CalendarPlus, Eye, UserCheck, UserX } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import LocationManagement from "@/components/accommodation/LocationManagement";
import RoomManagement from "@/components/accommodation/RoomManagement";

// Define the interface for TRFs that need accommodation assignment
interface AdminTrfForAccommodation {
  id: string;
  accommodationId?: string;
  requestorName: string;
  requestorId?: string;
  staffId?: string;
  location?: string;
  department?: string;
  gender?: GuestGender;
  status: string;
  requestedCheckInDate: string | Date;
  requestedCheckOutDate: string | Date;
  itinerary?: any[];
  specialRequests?: string;
  notes?: string;
}

// Define extended BookingData interface to match our needs
interface ExtendedBookingData extends BookingData {
  status: BookingStatus;
  roomName: string;
  staffHouseName: string;
  checkInDate: string | Date;
  checkOutDate: string | Date;
  notes?: string;
}

// Helper function to format date ranges
const formatDateRange = (startDate: string | Date | null | undefined, endDate: string | Date | null | undefined) => {
  if (!startDate || !endDate) return 'Dates not specified';
  
  try {
    const start = typeof startDate === 'string' ? parseISO(startDate) : startDate;
    const end = typeof endDate === 'string' ? parseISO(endDate) : endDate;
    
    // Check if dates are valid
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return 'Invalid date format';
    }
    
    return `${format(start, 'MMM d, yyyy')} - ${format(end, 'MMM d, yyyy')}`;
  } catch (error) {
    console.error('Error formatting date range:', error);
    return 'Invalid date format';
  }
};

export default function AccommodationAdminPage() {
  const [pendingAccommodationTRFs, setPendingAccommodationTRFs] = useState<AdminTrfForAccommodation[]>([]);
  const [staffHouses, setStaffHouses] = useState<StaffHouseData[]>([]);
  const [bookings, setBookings] = useState<ExtendedBookingData[]>([]);
  const [selectedTRF, setSelectedTRF] = useState<AdminTrfForAccommodation | null>(null);
  const [selectedStaffHouse, setSelectedStaffHouse] = useState<StaffHouseData | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<{ id: string; name: string } | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<ExtendedBookingData | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [blockRoomDialog, setBlockRoomDialog] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [deleteBookingDialog, setDeleteBookingDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("assignment");
  const { toast } = useToast();
  const router = useRouter();

  const fetchTrfsAwaitingAccommodation = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Fetch TRFs that are 'Approved' (need flight then accommodation) or 'Processing Accommodation' (flights done, need accommodation)
      const statusesToFetch = ["Approved", "Processing Accommodation"].join(',');
      const response = await fetch(`/api/trf?statuses=${encodeURIComponent(statusesToFetch)}&limit=50`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.details || `Failed to fetch TRFs: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Transform the TRF data to match our admin interface needs
      const adminTrfs: AdminTrfForAccommodation[] = data.trfs.map((trf: any) => {
        // Extract accommodation details if available
        const accommodationDetails = trf.accommodationDetails || {};
        
        return {
          id: trf.id,
          requestorName: trf.requestorName || 'Unknown',
          requestorId: trf.requestorId,
          staffId: trf.staffId,
          location: trf.destination || accommodationDetails.location,
          department: trf.department,
          gender: trf.gender || 'Male',
          status: trf.status,
          requestedCheckInDate: accommodationDetails.checkInDate || trf.startDate,
          requestedCheckOutDate: accommodationDetails.checkOutDate || trf.endDate,
          specialRequests: accommodationDetails.specialRequests || '',
          notes: trf.notes || ''
        };
      });
      
      setPendingAccommodationTRFs(adminTrfs);
    } catch (err: any) {
      console.error('Error fetching TRFs:', err);
      setError(err.message || 'Failed to load accommodation requests');
      toast({
        title: 'Error',
        description: err.message || 'Failed to load accommodation requests',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const fetchAccommodationData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Fetch staff houses from API
      const housesResponse = await fetch(`/api/accommodation/admin/locations`);
      if (!housesResponse.ok) throw new Error('Failed to fetch staff houses');
      const housesData = await housesResponse.json();
      const staffHousesData = housesData.locations || [];
      
      // Fetch rooms for each staff house
      const staffHousesWithRooms = await Promise.all(staffHousesData.map(async (house: StaffHouseData) => {
        const roomsResponse = await fetch(`/api/accommodation/admin/rooms?staffHouseId=${house.id}`);
        if (roomsResponse.ok) {
          const roomsData = await roomsResponse.json();
          return {
            ...house,
            rooms: roomsData.rooms || []
          };
        }
        return {
          ...house,
          rooms: []
        };
      }));
      
      setStaffHouses(staffHousesWithRooms);
      
      // Fetch bookings for the current month from API
      const year = new Date().getFullYear();
      const month = new Date().getMonth() + 1; // JavaScript months are 0-indexed
      const bookingsResponse = await fetch(`/api/accommodation/admin/bookings?year=${year}&month=${month}`);
      if (!bookingsResponse.ok) throw new Error('Failed to fetch bookings');
      const bookingsData = await bookingsResponse.json();
      setBookings(bookingsData.bookings || []);
      
      // Fetch pending accommodation requests from the dedicated API endpoint
      // Use /api/trf/pending-accommodation which specifically handles accommodation assignment
      const pendingRequestsResponse = await fetch(`/api/trf/pending-accommodation`);
      if (!pendingRequestsResponse.ok) throw new Error('Failed to fetch pending accommodation requests');
      const pendingRequestsData = await pendingRequestsResponse.json();
      
      // Transform the accommodation requests to match the expected AdminTrfForAccommodation interface
      const transformedRequests = (pendingRequestsData.requests || []).map((req: any) => ({
        id: req.id, // This is the travel request ID
        accommodationId: req.accommodationId, // Keep track of the accommodation detail ID
        requestorName: req.requestorName,
        staffId: req.staffId,
        department: req.department,
        location: req.location,
        gender: req.gender || 'Male',
        status: req.status,
        requestedCheckInDate: req.requestedCheckInDate,
        requestedCheckOutDate: req.requestedCheckOutDate,
        specialRequests: req.specialRequests
      }));
      
      // The /api/trf/pending-accommodation endpoint already filters out requests that have bookings
      // So we can use the requests directly without additional filtering
      // Ensure uniqueness of TRF IDs to prevent React duplicate key warnings
      const uniquePendingRequests = Array.from(
        new Map(transformedRequests.map((item: AdminTrfForAccommodation) => [item.id, item])).values()
      ) as AdminTrfForAccommodation[];
      
      setPendingAccommodationTRFs(uniquePendingRequests);
    } catch (err: any) {
      console.error('Error fetching accommodation data:', err);
      setError(err.message || 'Failed to load accommodation data');
      toast({
        title: 'Error',
        description: err.message || 'Failed to load accommodation data',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch data on component mount
  useEffect(() => {
    // Only fetch accommodation data, which will handle all TRFs
    fetchAccommodationData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getDisplayLocation = (trf: AdminTrfForAccommodation | null): string => {
    if (!trf) return "N/A";
    // Prefer location derived from itinerary if available, otherwise use the main location field
    if (trf.itinerary && trf.itinerary.length > 0) {
      return trf.itinerary[0].destination || trf.location || "N/A";
    }
    return trf.location || "N/A";
  };

  const handleBlockRoom = async () => {
    if (!selectedRoom || !dateRange?.from || !dateRange?.to || !selectedStaffHouse) {
      toast({
        title: "Missing information",
        description: "Please select a room and date range",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/accommodation/admin/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomId: selectedRoom.id,
          checkInDate: format(dateRange.from, 'yyyy-MM-dd'),
          checkOutDate: format(dateRange.to, 'yyyy-MM-dd'),
          status: "Blocked" as BookingStatus,
          notes: blockReason,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to block room');
      }

      toast({
        title: "Success",
        description: "Room blocked successfully",
      });

      // Reset form and refresh data
      setSelectedRoom(null);
      setSelectedStaffHouse(null);
      setDateRange(undefined);
      setBlockReason("");
      setBlockRoomDialog(false);
      fetchAccommodationData();
    } catch (error: any) {
      console.error('Error blocking room:', error);
      toast({
        title: "Error",
        description: error.message || 'Failed to block room',
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssignRoom = async () => {
    if (!selectedRoom || !dateRange?.from || !dateRange?.to || !selectedStaffHouse || !selectedTRF) {
      toast({
        title: "Missing information",
        description: "Please select a room, date range, and accommodation request",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // Create a booking for the accommodation request
      const response = await fetch('/api/accommodation/admin/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          staffHouseId: selectedStaffHouse.id,
          roomId: selectedRoom.id,
          staffId: selectedTRF.requestorId, // Use requestorId instead of staffId
          date: format(dateRange.from, 'yyyy-MM-dd'), // API expects 'date' field
          status: "Confirmed", // Using 'Confirmed' which is now valid in both API and database
          notes: blockReason || `Accommodation for ${selectedTRF.requestorName} (${selectedTRF.department || 'N/A'})`,
          trfId: selectedTRF.id // API expects 'trfId' field
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to assign room');
      }

      toast({
        title: "Success",
        description: `Room assigned to ${selectedTRF.requestorName} successfully`,
      });

      // Reset form and refresh data
      setSelectedRoom(null);
      setSelectedStaffHouse(null);
      setDateRange(undefined);
      setSelectedTRF(null);
      fetchAccommodationData();
    } catch (error: any) {
      console.error('Error assigning room:', error);
      toast({
        title: "Error",
        description: error.message || 'Failed to assign room',
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnblockRoom = async () => {
    if (!selectedBooking) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/accommodation/admin/bookings/${selectedBooking.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to unblock room');
      }

      toast({
        title: "Success",
        description: "Room unblocked successfully",
      });

      // Reset and refresh
      setSelectedBooking(null);
      setDeleteBookingDialog(false);
      fetchAccommodationData();
    } catch (error: any) {
      console.error('Error unblocking room:', error);
      toast({
        title: "Error",
        description: error.message || 'Failed to unblock room',
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-3xl font-bold">Accommodation Admin</h1>
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="assignment">Assignment</TabsTrigger>
          <TabsTrigger value="blocking">Room Blocking</TabsTrigger>
          <TabsTrigger value="locations">Locations</TabsTrigger>
          <TabsTrigger value="rooms">Rooms</TabsTrigger>
        </TabsList>
        
        <TabsContent value="assignment" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Pending Accommodation Requests</CardTitle>
                  <CardDescription>TRFs awaiting room assignment</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="flex items-center justify-center h-40">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <span className="ml-2">Loading requests...</span>
                    </div>
                  ) : error ? (
                    <div className="flex items-center justify-center h-40 text-destructive">
                      <AlertTriangle className="h-8 w-8 mr-2" />
                      <span>{error}</span>
                    </div>
                  ) : pendingAccommodationTRFs.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No pending accommodation requests found
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {pendingAccommodationTRFs.map((trf) => (
                        <div
                          key={trf.id}
                          className={cn(
                            "flex flex-col md:flex-row md:items-center justify-between p-4 border rounded-lg",
                            selectedTRF?.id === trf.id ? "border-primary bg-primary/5" : ""
                          )}
                        >
                          <div className="space-y-1">
                            <div className="font-medium">{trf.requestorName}</div>
                            <div className="text-sm text-muted-foreground">
                              {trf.department} • {getDisplayLocation(trf)}
                            </div>
                            <div className="text-sm">
                              {formatDateRange(
                                trf.requestedCheckInDate,
                                trf.requestedCheckOutDate
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant={trf.status === "Approved" ? "outline" : "default"}>
                                {trf.status}
                              </Badge>
                              {trf.gender && (
                                <Badge variant="outline" className="bg-secondary/30">
                                  {trf.gender}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-4 md:mt-0">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedTRF(trf)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedTRF(trf);
                                // Automatically populate date range when assigning room
                                if (trf.requestedCheckInDate && trf.requestedCheckOutDate) {
                                  const checkInDate = typeof trf.requestedCheckInDate === 'string' 
                                    ? parseISO(trf.requestedCheckInDate) 
                                    : trf.requestedCheckInDate;
                                  const checkOutDate = typeof trf.requestedCheckOutDate === 'string' 
                                    ? parseISO(trf.requestedCheckOutDate) 
                                    : trf.requestedCheckOutDate;
                                  
                                  if (!isNaN(checkInDate.getTime()) && !isNaN(checkOutDate.getTime())) {
                                    setDateRange({ from: checkInDate, to: checkOutDate });
                                  }
                                }
                                // Set block reason based on the accommodation request
                                setBlockReason(`Accommodation for ${trf.requestorName} (${trf.department || 'N/A'})`);
                                setActiveTab("blocking");
                              }}
                            >
                              <BedDouble className="h-4 w-4 mr-1" />
                              Assign Room
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div>
              <Card>
                <CardHeader>
                  <CardTitle>Request Details</CardTitle>
                  <CardDescription>
                    {selectedTRF ? `TRF #${selectedTRF.id}` : "Select a request to view details"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!selectedTRF ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No request selected
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <h3 className="font-medium">Requestor</h3>
                        <p>{selectedTRF.requestorName}</p>
                        <p className="text-sm text-muted-foreground">
                          Staff ID: {selectedTRF.staffId || "N/A"}
                        </p>
                      </div>
                      <Separator />
                      <div>
                        <h3 className="font-medium">Location</h3>
                        <p>{getDisplayLocation(selectedTRF)}</p>
                      </div>
                      <Separator />
                      <div>
                        <h3 className="font-medium">Date Range</h3>
                        <p>
                          {formatDateRange(
                            selectedTRF.requestedCheckInDate,
                            selectedTRF.requestedCheckOutDate
                          )}
                        </p>
                      </div>
                      {selectedTRF.specialRequests && (
                        <>
                          <Separator />
                          <div>
                            <h3 className="font-medium">Special Requests</h3>
                            <p className="text-sm">{selectedTRF.specialRequests}</p>
                          </div>
                        </>
                      )}
                      <Separator />
                      <div className="pt-2">
                        <Button
                          className="w-full"
                          onClick={() => {
                            // First switch to the blocking tab to select a room
                            // Automatically populate date range when assigning room
                            if (selectedTRF?.requestedCheckInDate && selectedTRF?.requestedCheckOutDate) {
                              const checkInDate = typeof selectedTRF.requestedCheckInDate === 'string' 
                                ? parseISO(selectedTRF.requestedCheckInDate) 
                                : selectedTRF.requestedCheckInDate;
                              const checkOutDate = typeof selectedTRF.requestedCheckOutDate === 'string' 
                                ? parseISO(selectedTRF.requestedCheckOutDate) 
                                : selectedTRF.requestedCheckOutDate;
                              
                              if (!isNaN(checkInDate.getTime()) && !isNaN(checkOutDate.getTime())) {
                                setDateRange({ from: checkInDate, to: checkOutDate });
                              }
                            }
                            // Set block reason based on the accommodation request
                            if (selectedTRF) {
                              setBlockReason(`Accommodation for ${selectedTRF.requestorName} (${selectedTRF.department || 'N/A'})`);
                            }
                            setActiveTab("blocking");
                          }}
                        >
                          <BedDouble className="h-4 w-4 mr-2" />
                          Assign Accommodation
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="blocking" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle>Select Room to Block</CardTitle>
                <CardDescription>
                  Choose a staff house and room to block for maintenance or other reasons
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Staff House</Label>
                  <Select
                    value={selectedStaffHouse?.id || ""}
                    onValueChange={(value) => {
                      const house = staffHouses.find((h) => h.id === value);
                      setSelectedStaffHouse(house || null);
                      setSelectedRoom(null);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select staff house" />
                    </SelectTrigger>
                    <SelectContent>
                      {staffHouses.map((house) => (
                        <SelectItem key={house.id} value={house.id}>
                          {house.name} ({house.location})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Room</Label>
                  <Select
                    value={selectedRoom?.id || ""}
                    onValueChange={(value) => {
                      if (!selectedStaffHouse) return;
                      const room = selectedStaffHouse.rooms.find((r) => r.id === value);
                      setSelectedRoom(room || null);
                    }}
                    disabled={!selectedStaffHouse}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select room" />
                    </SelectTrigger>
                    <SelectContent>
                      {(selectedStaffHouse?.rooms || []).map((room) => (
                        <SelectItem key={room.id} value={room.id}>
                          {room.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Date Range</Label>
                  <div className="border rounded-md p-2 overflow-x-auto">
                    <div className="min-w-[600px]">
                      <Calendar
                        mode="range"
                        selected={dateRange}
                        onSelect={setDateRange}
                        numberOfMonths={2}
                        disabled={[{ before: new Date() }]}
                        className="mx-auto"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Reason for Blocking</Label>
                  <Textarea
                    value={blockReason}
                    onChange={(e) => setBlockReason(e.target.value)}
                    placeholder="e.g., Maintenance, VIP visit, etc."
                  />
                </div>

                {/* Show different buttons based on whether an accommodation request is selected */}
                {selectedTRF ? (
                  <div className="space-y-2">
                    <Button
                      onClick={handleAssignRoom}
                      disabled={!selectedRoom || !dateRange?.from || !dateRange?.to}
                      className="w-full"
                    >
                      <BedDouble className="h-4 w-4 mr-2" />
                      Assign Room to {selectedTRF.requestorName}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setSelectedTRF(null)}
                      className="w-full"
                    >
                      Cancel Assignment
                    </Button>
                  </div>
                ) : (
                  <Button
                    onClick={() => {
                      if (selectedRoom && dateRange?.from && dateRange?.to) {
                        setBlockRoomDialog(true);
                      } else {
                        toast({
                          title: "Missing information",
                          description: "Please select a room and date range",
                          variant: "destructive",
                        });
                      }
                    }}
                    disabled={!selectedRoom || !dateRange?.from || !dateRange?.to}
                    className="w-full"
                  >
                    Block Room
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card className="col-span-1 md:col-span-2">
              <CardHeader>
                <CardTitle>Current Room Blocks</CardTitle>
                <CardDescription>
                  View and manage current room blocks for maintenance
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {bookings
                    .filter((booking) => booking.status === "Blocked" as BookingStatus)
                    .map((booking) => (
                      <div
                        key={booking.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div>
                          <div className="font-medium">
                            {booking.roomName} at {booking.staffHouseName}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {formatDateRange(booking.checkInDate, booking.checkOutDate)}
                          </div>
                          <div className="text-sm mt-1">
                            <Badge variant="outline">Blocked</Badge>
                          </div>
                          {booking.notes && (
                            <div className="text-sm mt-2">
                              <span className="font-medium">Reason:</span> {booking.notes}
                            </div>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedBooking(booking);
                            setDeleteBookingDialog(true);
                          }}
                        >
                          Unblock
                        </Button>
                      </div>
                    ))}

                  {bookings.filter((booking) => booking.status === "Blocked" as BookingStatus).length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No rooms are currently blocked
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="locations" className="space-y-4">
          <LocationManagement onLocationChange={fetchAccommodationData} />
        </TabsContent>
        
        <TabsContent value="rooms" className="space-y-4">
          <RoomManagement onRoomChange={fetchAccommodationData} />
        </TabsContent>
      </Tabs>

      {/* Block Room Confirmation Dialog */}
      <Dialog open={blockRoomDialog} onOpenChange={setBlockRoomDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Block Room</DialogTitle>
            <DialogDescription>
              Are you sure you want to block {selectedRoom?.name} at{" "}
              {selectedStaffHouse?.name} from{" "}
              {dateRange?.from && format(dateRange.from, "MMM d, yyyy")} to{" "}
              {dateRange?.to && format(dateRange.to, "MMM d, yyyy")}?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Reason</Label>
            <Textarea
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              placeholder="e.g., Maintenance, VIP visit, etc."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockRoomDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleBlockRoom} disabled={isLoading}>
              {isLoading ? "Blocking..." : "Block Room"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Booking Confirmation Dialog */}
      <AlertDialog open={deleteBookingDialog} onOpenChange={setDeleteBookingDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unblock Room</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to unblock {selectedBooking?.roomName} at{" "}
              {selectedBooking?.staffHouseName}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnblockRoom} disabled={isLoading}>
              {isLoading ? "Unblocking..." : "Unblock Room"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
