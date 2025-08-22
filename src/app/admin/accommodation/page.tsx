"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { DateRange } from "react-day-picker";
import { addDays, format, isSameDay, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { cn } from '@/lib/utils';
import { StaffHouseData, StaffGuest, BookingData, GuestGender, LocationType, BookingStatus } from '@/types/accommodation';
import Link from 'next/link';
import { CalendarIcon, Loader2, AlertTriangle, BedDouble, CalendarPlus, Eye, UserCheck, UserX } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import LocationManagement from "@/components/accommodation/LocationManagement";
import RoomManagement from "@/components/accommodation/RoomManagement";
import { useSessionPermissions } from '@/hooks/use-session-permissions';
import { shouldShowRequest } from '@/lib/client-rbac-utils';


// Group consecutive blocked bookings for the same room into date ranges
const groupBlockedBookings = (blockedBookings: any[]) => {
  const grouped: { [key: string]: any[] } = {};
  
  // Group by room
  blockedBookings.forEach(booking => {
    const roomKey = `${booking.roomId}`;
    if (!grouped[roomKey]) {
      grouped[roomKey] = [];
    }
    grouped[roomKey].push(booking);
  });

  const result: any[] = [];
  
  // Process each room's bookings
  Object.values(grouped).forEach(roomBookings => {
    // Sort by date
    roomBookings.sort((a, b) => new Date(a.bookingDate || a.date).getTime() - new Date(b.bookingDate || b.date).getTime());
    
    let currentGroup: any[] = [];
    let lastDate: Date | null = null;

    roomBookings.forEach(booking => {
      const bookingDate = new Date(booking.bookingDate || booking.date);
      
      if (!lastDate || (bookingDate.getTime() - lastDate.getTime()) === 24 * 60 * 60 * 1000) {
        // Consecutive day or first booking
        currentGroup.push(booking);
      } else {
        // Gap in dates, finalize current group and start new one
        if (currentGroup.length > 0) {
          result.push({
            ...currentGroup[0],
            startDate: currentGroup[0].bookingDate || currentGroup[0].date,
            endDate: currentGroup[currentGroup.length - 1].bookingDate || currentGroup[currentGroup.length - 1].date,
            bookingIds: currentGroup.map(b => b.id),
            isRange: currentGroup.length > 1
          });
        }
        currentGroup = [booking];
      }
      
      lastDate = bookingDate;
    });

    // Don't forget the last group
    if (currentGroup.length > 0) {
      result.push({
        ...currentGroup[0],
        startDate: currentGroup[0].bookingDate || currentGroup[0].date,
        endDate: currentGroup[currentGroup.length - 1].bookingDate || currentGroup[currentGroup.length - 1].date,
        bookingIds: currentGroup.map(b => b.id),
        isRange: currentGroup.length > 1
      });
    }
  });

  return result;
};

// Define the interface for TRFs that need accommodation assignment
interface AdminTrfForAccommodation {
  id: string;
  accommodationId?: string;
  requestorName: string;
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
  id: string; // Add the missing id property
  status: BookingStatus;
  roomName: string;
  staffHouseName: string;
  bookingDate: string | Date; // The API returns this field
  guestName?: string;
  notes?: string;
  gender?: GuestGender; // Add gender property
  // Properties for grouped bookings
  isRange?: boolean;
  startDate?: string | Date;
  endDate?: string | Date;
  bookingIds?: string[];
}

// Helper function to get proper initials (First + Last name)
const getGuestInitials = (guestName: string | null | undefined): string => {
  if (!guestName) return 'TRF';
  
  const nameParts = guestName.trim().split(' ').filter(part => part.length > 0);
  if (nameParts.length >= 2) {
    // First name initial + Last name initial
    return (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase();
  } else if (nameParts.length === 1) {
    // Just first name, take first two letters
    return nameParts[0].substring(0, 2).toUpperCase();
  }
  return 'TRF';
};

// Helper function to check for gender conflicts in room assignments
const checkGenderConflict = (
  roomId: string, 
  guestGender: GuestGender, 
  bookingDate: Date, 
  existingBookings: ExtendedBookingData[]
): boolean => {
  // Find all confirmed/checked-in bookings for the same room on the same date
  const sameRoomBookings = existingBookings.filter(booking => {
    if (booking.roomId !== roomId || booking.status === 'Cancelled' || booking.status === 'Blocked') {
      return false;
    }
    
    const bookingDateObj = new Date(booking.bookingDate);
    return bookingDateObj.getDate() === bookingDate.getDate() &&
           bookingDateObj.getMonth() === bookingDate.getMonth() &&
           bookingDateObj.getFullYear() === bookingDate.getFullYear();
  });

  // Check if any existing bookings have different gender guests
  return sameRoomBookings.some(booking => {
    return booking.gender && booking.gender !== guestGender;
  });
};

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
  const [roomBookings, setRoomBookings] = useState<ExtendedBookingData[]>([]);
  const [loadingRoomBookings, setLoadingRoomBookings] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedLocation, setSelectedLocation] = useState<string>("Ashgabat");
  const [blockLocation, setBlockLocation] = useState<string>("");
  const [blockRooms, setBlockRooms] = useState<string>("");
  const [blockDates, setBlockDates] = useState<string>("");
  const [blockReasonInput, setBlockReasonInput] = useState<string>("");
  const [selectedBookingDetails, setSelectedBookingDetails] = useState<ExtendedBookingData | null>(null);
  const [bookingDetailsDialog, setBookingDetailsDialog] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedStaffHouseForBooking, setSelectedStaffHouseForBooking] = useState<string>("");
  const [selectedRoomForBooking, setSelectedRoomForBooking] = useState<string>("");
  const { toast } = useToast();
  const { role, userId, isLoading: sessionLoading } = useSessionPermissions();
  const router = useRouter();


  const fetchTrfsAwaitingAccommodation = useCallback(async () => {
    if (sessionLoading || !role) {
      return; // Don't fetch while session is loading or role is not available
    }
    
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
      
      // Apply role-based filtering for personal vs admin view using client-side logic
      const filteredTrfs = (data.trfs || []).filter(trf =>
        shouldShowRequest(role, { ...trf, itemType: 'accommodation' }, userId)
      );
      
      // Transform the TRF data to match our admin interface needs
      const adminTrfs: AdminTrfForAccommodation[] = filteredTrfs.map((trf: any) => {
        // Extract accommodation details if available
        const accommodationDetails = trf.accommodationDetails || {};
        
        return {
          id: trf.id,
          requestorName: trf.requestorName || 'Unknown',
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
  }, [toast, role, userId, sessionLoading]);

  // Separate function to fetch pending accommodation TRFs
  const fetchPendingTRFs = async () => {
    try {
      // Fetch pending accommodation requests from the dedicated API endpoint
      const pendingRequestsResponse = await fetch(`/api/trf/pending-accommodation`);
      if (!pendingRequestsResponse.ok) throw new Error('Failed to fetch pending accommodation requests');
      const pendingRequestsData = await pendingRequestsResponse.json();
      
      // Apply role-based filtering for personal vs admin view using client-side logic
      const filteredRequests = (pendingRequestsData.requests || []).filter(req =>
        shouldShowRequest(role, { ...req, itemType: 'accommodation' }, userId)
      );
      
      // Transform the accommodation requests to match the expected AdminTrfForAccommodation interface
      const transformedRequests = filteredRequests.map((req: any) => ({
        id: req.id,
        accommodationId: req.accommodationId,
        requestorName: req.requestorName,
        staffId: req.staffId,
        department: req.department,
        gender: req.gender || 'Male',
        status: req.status,
        requestedCheckInDate: req.requestedCheckInDate,
        requestedCheckOutDate: req.requestedCheckOutDate,
        requestedRoomType: req.requestedRoomType,
        location: req.location,
        specialRequests: req.specialRequests
      }));
      
      // Ensure uniqueness of TRF IDs to prevent React duplicate key warnings
      const uniquePendingRequests = Array.from(
        new Map(transformedRequests.map((item: AdminTrfForAccommodation) => [item.id, item])).values()
      ) as AdminTrfForAccommodation[];
      
      setPendingAccommodationTRFs(uniquePendingRequests);
    } catch (err: any) {
      console.error('Error fetching accommodation TRFs:', err);
      toast({
        title: 'Error',
        description: err.message || 'Failed to load accommodation requests',
        variant: 'destructive',
      });
    }
  };

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
      
      // Fetch bookings for current and previous month from API to include recent bookings
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth() + 1; // JavaScript months are 0-indexed
      
      // Fetch current month bookings
      const currentMonthResponse = await fetch(`/api/accommodation/admin/bookings?year=${currentYear}&month=${currentMonth}`);
      if (!currentMonthResponse.ok) throw new Error('Failed to fetch current month bookings');
      const currentMonthData = await currentMonthResponse.json();
      
      // Fetch previous month bookings
      const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
      const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
      const prevMonthResponse = await fetch(`/api/accommodation/admin/bookings?year=${prevYear}&month=${prevMonth}`);
      if (!prevMonthResponse.ok) throw new Error('Failed to fetch previous month bookings');
      const prevMonthData = await prevMonthResponse.json();
      
      // Combine both months' bookings
      const allBookings = [...(currentMonthData.bookings || []), ...(prevMonthData.bookings || [])];
      setBookings(allBookings);
      
      // Fetch pending accommodation requests using the dedicated function
      await fetchPendingTRFs();
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

  // Add debugging for bookings
  useEffect(() => {
    if (bookings.length > 0) {
      console.log('=== BOOKINGS DEBUG ===');
      console.log('Total bookings loaded:', bookings.length);
      console.log('Bookings by status:');
      const statusCounts = bookings.reduce((acc, booking) => {
        acc[booking.status] = (acc[booking.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      console.log(statusCounts);
      
      // Show a few sample bookings to verify data structure
      console.log('Sample bookings (first 3):');
      bookings.slice(0, 3).forEach((booking, index) => {
        console.log(`Booking ${index + 1}:`, {
          id: booking.id,
          status: booking.status,
          date: booking.bookingDate,
          guestName: booking.guestName,
          roomName: booking.roomName
        });
      });
      console.log('=====================');
    }
  }, [bookings]);

  const getDisplayLocation = (trf: AdminTrfForAccommodation | null): string => {
    if (!trf) return "N/A";
    // Prefer location derived from itinerary if available, otherwise use the main location field
    if (trf.itinerary && trf.itinerary.length > 0) {
      return trf.itinerary[0].destination || trf.location || "N/A";
    }
    return trf.location || "N/A";
  };

  // Fetch bookings for a specific room
  const fetchRoomBookings = async (roomId: string) => {
    if (!roomId) {
      setRoomBookings([]);
      return;
    }

    setLoadingRoomBookings(true);
    try {
      const year = new Date().getFullYear();
      const month = new Date().getMonth() + 1;
      
      // Fetch bookings for the room for the current and next few months
      const response = await fetch(`/api/accommodation/admin/bookings?year=${year}&month=${month}&roomId=${roomId}`);
      if (!response.ok) throw new Error('Failed to fetch room bookings');
      
      const data = await response.json();
      setRoomBookings(data.bookings || []);
    } catch (error) {
      console.error('Error fetching room bookings:', error);
      setRoomBookings([]);
      toast({
        title: "Warning",
        description: "Could not load room availability. Proceed with caution.",
        variant: "default",
      });
    } finally {
      setLoadingRoomBookings(false);
    }
  };

  // Effect to fetch room bookings when room selection changes
  useEffect(() => {
    if (selectedRoom?.id) {
      fetchRoomBookings(selectedRoom.id);
    } else {
      setRoomBookings([]);
    }
  }, [selectedRoom?.id]);

  // Auto-populate booking dates when TRF is selected
  useEffect(() => {
    if (selectedTRF && selectedTRF.requestedCheckInDate && selectedTRF.requestedCheckOutDate) {
      const checkInDate = new Date(selectedTRF.requestedCheckInDate);
      const checkOutDate = new Date(selectedTRF.requestedCheckOutDate);
      
      setDateRange({
        from: checkInDate,
        to: checkOutDate
      });
    } else {
      // Clear date range if no TRF selected
      setDateRange(undefined);
    }
  }, [selectedTRF]);

  // Function to check if a date is occupied and get booking info for any room
  const getDateBookingInfo = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    
    // If a specific room is selected, check only that room's bookings
    if (selectedRoom) {
      const booking = roomBookings.find(b => {
        const bookingDateStr = new Date(b.bookingDate).toISOString().split('T')[0];
        return bookingDateStr === dateStr;
      });
      
      return booking ? {
        isOccupied: true,
        status: booking.status,
        guestName: booking.guestName,
        booking: booking
      } : {
        isOccupied: false,
        status: null,
        guestName: null,
        booking: null
      };
    }
    
    // If no specific room is selected, check all bookings for visual overview
    const allBookingsForDate = bookings.filter(b => {
      const bookingDateStr = new Date(b.bookingDate).toISOString().split('T')[0];
      return bookingDateStr === dateStr;
    });
    
    if (allBookingsForDate.length > 0) {
      // Show the most "important" booking status (blocked > confirmed > others)
      const priorityOrder = ['Blocked', 'Confirmed', 'Checked-in', 'Checked-out'];
      const priorityBooking = allBookingsForDate.sort((a, b) => {
        const aIndex = priorityOrder.indexOf(a.status);
        const bIndex = priorityOrder.indexOf(b.status);
        return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
      })[0];
      
      return {
        isOccupied: true,
        status: priorityBooking.status,
        guestName: allBookingsForDate.length > 1 ? `${priorityBooking.guestName} (+${allBookingsForDate.length - 1} more)` : priorityBooking.guestName,
        booking: priorityBooking,
        totalBookings: allBookingsForDate.length
      };
    }
    
    return {
      isOccupied: false,
      status: null,
      guestName: null,
      booking: null
    };
  };

  // Function to check for booking conflicts in selected date range
  const checkBookingConflicts = (dateRange: DateRange) => {
    if (!dateRange?.from || !dateRange?.to || !selectedRoom) return [];
    
    const conflicts: any[] = [];
    const startDate = new Date(dateRange.from);
    const endDate = new Date(dateRange.to);
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const bookingInfo = getDateBookingInfo(currentDate);
      if (bookingInfo.isOccupied) {
        conflicts.push({
          date: new Date(currentDate),
          ...bookingInfo
        });
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return conflicts;
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

    // Check for conflicts before blocking
    const conflicts = checkBookingConflicts(dateRange);
    if (conflicts.length > 0) {
      const conflictDetails = conflicts.map(c => {
        const dateStr = c.date.toLocaleDateString();
        const status = c.status;
        const guest = c.guestName || 'Unknown';
        return `${dateStr}: ${status}${status === 'Blocked' ? '' : ` (${guest})`}`;
      }).join('\n');

      const shouldProceed = confirm(
        `This room is already occupied on the following dates:\n\n${conflictDetails}\n\nDo you want to cancel existing bookings and proceed with blocking?\n\nClick OK to cancel existing bookings and block the room, or Cancel to choose different dates.`
      );

      if (!shouldProceed) {
        toast({
          title: "Blocking cancelled",
          description: "Please select different dates to avoid conflicts",
          variant: "default",
        });
        return;
      }
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
          forceBlock: conflicts.length > 0, // Force block if there are conflicts
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.error || 'Failed to block room';
        
        // Handle booking conflicts with option to force block
        if (response.status === 409 && errorData.canForceBlock) {
          const shouldForceBlock = confirm(
            `${errorMessage}\n\nDo you want to cancel the existing bookings and force block this room? This action cannot be undone.`
          );
          
          if (shouldForceBlock) {
            // Retry with forceBlock flag
            const forceResponse = await fetch('/api/accommodation/admin/bookings', {
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
                forceBlock: true,
              }),
            });

            if (!forceResponse.ok) {
              const forceErrorData = await forceResponse.json();
              throw new Error(forceErrorData.error || 'Failed to force block room');
            }

            toast({
              title: "Success",
              description: "Room blocked successfully (existing bookings were cancelled)",
            });

            // Reset form and refresh data
            setSelectedRoom(null);
            setSelectedStaffHouse(null);
            setDateRange(undefined);
            setBlockReason("");
            setBlockRoomDialog(false);
            fetchAccommodationData();
            return;
          } else {
            return; // User cancelled the force block
          }
        } else if (response.status === 409) {
          toast({
            title: "Room Booking Conflict",
            description: `${errorMessage}. Please check the calendar and try selecting a different date range or cancel the existing booking first.`,
            variant: "destructive",
          });
          return;
        }
        
        throw new Error(errorMessage);
      }

      toast({
        title: "Success",
        description: conflicts.length > 0 
          ? "Room blocked successfully (existing bookings were cancelled)"
          : "Room blocked successfully",
      });

      // Reset form and refresh data
      setSelectedRoom(null);
      setSelectedStaffHouse(null);
      setDateRange(undefined);
      setBlockReason("");
      setBlockRoomDialog(false);
      fetchAccommodationData();
      if (selectedRoom?.id) {
        fetchRoomBookings(selectedRoom.id); // Refresh room bookings
      }
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

  // Handler for booking confirmation from the new form
  const handleBookingConfirmation = async () => {
    if (!selectedRoomForBooking || !dateRange?.from || !dateRange?.to || !selectedStaffHouseForBooking || !selectedTRF) {
      toast({
        title: "Missing information",
        description: "Please select a room, date range, and accommodation request",
        variant: "destructive",
      });
      return;
    }

    console.log('Debug - selectedStaffHouseForBooking:', selectedStaffHouseForBooking);
    console.log('Debug - selectedRoomForBooking:', selectedRoomForBooking);
    console.log('Debug - staffHouses:', staffHouses);

    const selectedStaffHouse = staffHouses.find(h => h.id === selectedStaffHouseForBooking || h.id === String(selectedStaffHouseForBooking));
    const selectedRoom = { 
      id: selectedRoomForBooking, 
      name: selectedStaffHouse?.rooms.find(r => r.id === selectedRoomForBooking || r.id === String(selectedRoomForBooking))?.name || '' 
    };

    console.log('Debug - found selectedStaffHouse:', selectedStaffHouse);
    console.log('Debug - found selectedRoom:', selectedRoom);

    if (!selectedRoom || !selectedStaffHouse) {
      toast({
        title: "Error",
        description: `Selected room or staff house not found. StaffHouse: ${selectedStaffHouseForBooking}, Room: ${selectedRoomForBooking}`,
        variant: "destructive",
      });
      return;
    }

    // Use existing handleAssignRoom logic with the new form data
    await handleAssignRoom(false, selectedRoom, selectedStaffHouse);
  };

  // Handler for unable to book
  const handleUnableToBook = async () => {
    if (!selectedTRF) return;

    try {
      setIsLoading(true);
      
      // Update TRF status to indicate accommodation couldn't be assigned
      const response = await fetch(`/api/accommodation/requests/${selectedTRF.id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'unable_to_accommodate',
          notes: 'Unable to provide accommodation - no suitable rooms available'
        })
      });

      if (!response.ok) throw new Error('Failed to update request status');

      toast({
        title: "Request Updated",
        description: "Accommodation request marked as unable to accommodate",
      });

      // Reset form and refresh data
      setSelectedTRF(null);
      setSelectedStaffHouseForBooking('');
      setSelectedRoomForBooking('');
      setDateRange(undefined);
      fetchAccommodationData();
    } catch (error) {
      console.error('Error updating request:', error);
      toast({
        title: "Error",
        description: "Failed to update request status",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssignRoom = async (forceAssignment: boolean = false, roomOverride?: any, staffHouseOverride?: any) => {
    const room = roomOverride || selectedRoom;
    const staffHouse = staffHouseOverride || selectedStaffHouse;
    
    if (!room || !dateRange?.from || !dateRange?.to || !staffHouse || !selectedTRF) {
      toast({
        title: "Missing information",
        description: "Please select a room, date range, and accommodation request",
        variant: "destructive",
      });
      return;
    }

    // Check for conflicts before proceeding (unless forcing)
    if (!forceAssignment) {
      const conflicts = checkBookingConflicts(dateRange);
      if (conflicts.length > 0) {
        const conflictDetails = conflicts.map(c => {
          const dateStr = c.date.toLocaleDateString();
          const status = c.status;
          const guest = c.guestName || 'Unknown';
          return `${dateStr}: ${status}${status === 'Blocked' ? '' : ` (${guest})`}`;
        }).join('\n');

        const shouldProceed = confirm(
          `This room is already occupied on the following dates:\n\n${conflictDetails}\n\nDo you want to:\n- Cancel existing bookings and assign to ${selectedTRF.requestorName}?\n- Or choose different dates/room?\n\nClick OK to cancel existing bookings and proceed, or Cancel to choose different dates.`
        );

        if (shouldProceed) {
          // Proceed with force assignment
          return handleAssignRoom(true);
        } else {
          // User chose to pick different dates
          toast({
            title: "Assignment cancelled",
            description: "Please select different dates or choose another room",
            variant: "default",
          });
          return;
        }
      }
    }

    setIsLoading(true);
    try {
      // Create a booking for the accommodation request
      const bookingData = {
        staffHouseId: String(staffHouse.id),
        roomId: String(room.id),
        staffId: String(selectedTRF.staffId || ''),
        checkInDate: format(dateRange.from, 'yyyy-MM-dd'),
        checkOutDate: format(dateRange.to, 'yyyy-MM-dd'),
        status: "Confirmed",
        notes: `Accommodation for ${String(selectedTRF.requestorName)} (${String(selectedTRF.department || 'N/A')})`,
        trfId: String(selectedTRF.id),
        forceBlock: Boolean(forceAssignment)
      };
      
      console.log('Sending booking request with data:', JSON.stringify(bookingData, null, 2));
      
      const response = await fetch('/api/accommodation/admin/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Ensure cookies are sent with the request
        body: JSON.stringify(bookingData),
      });

      if (!response.ok) {
        const responseText = await response.text();
        console.error('Raw response text:', responseText);
        
        let errorData;
        try {
          errorData = JSON.parse(responseText);
        } catch (parseError) {
          console.error('Failed to parse response as JSON:', parseError);
          errorData = { error: `Invalid JSON response: ${responseText.substring(0, 200)}...` };
        }
        
        console.error('Booking API error response:', JSON.stringify(errorData, null, 2));
        console.error('Response status:', response.status);
        console.error('Response statusText:', response.statusText);
        throw new Error(errorData.error || errorData.details || `Failed to assign room (${response.status})`);
      }

      toast({
        title: "Success",
        description: forceAssignment 
          ? `Room assigned to ${selectedTRF.requestorName} successfully (existing bookings were cancelled)`
          : `Room assigned to ${selectedTRF.requestorName} successfully`,
      });

      // Reset form and refresh data
      setSelectedRoom(null);
      setSelectedStaffHouse(null);
      setSelectedTRF(null);
      setSelectedStaffHouseForBooking('');
      setSelectedRoomForBooking('');
      setDateRange(undefined);
      fetchAccommodationData();
      if (selectedRoom?.id) {
        fetchRoomBookings(selectedRoom.id); // Refresh room bookings
      }
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
      // If it's a grouped booking (range), delete all bookings in the range
      if (selectedBooking.isRange && selectedBooking.bookingIds) {
        // Delete all bookings in the range
        await Promise.all(
          selectedBooking.bookingIds.map(async (bookingId: string) => {
            const response = await fetch(`/api/accommodation/admin/bookings?id=${bookingId}`, {
              method: 'DELETE',
            });
            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || `Failed to unblock booking ${bookingId}`);
            }
          })
        );

        toast({
          title: "Success",
          description: `Room range unblocked successfully (${selectedBooking.bookingIds.length} days)`,
        });
      } else {
        // Single booking
        const response = await fetch(`/api/accommodation/admin/bookings?id=${selectedBooking.id}`, {
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
      }

      // Reset and refresh
      setSelectedBooking(null);
      setDeleteBookingDialog(false);
      fetchAccommodationData();
      
      // Refresh the accommodation TRFs list to show newly available requests
      await fetchPendingTRFs();
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

  // Handler for checking in a guest
  const handleCheckIn = async () => {
    if (!selectedBookingDetails) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/accommodation/admin/bookings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          id: String(selectedBookingDetails.id),
          staffHouseId: String(selectedBookingDetails.staffHouseId),
          roomId: String(selectedBookingDetails.roomId),
          staffId: selectedBookingDetails.staffId ? String(selectedBookingDetails.staffId) : undefined,
          date: typeof selectedBookingDetails.bookingDate === 'string' 
            ? selectedBookingDetails.bookingDate.split('T')[0] 
            : new Date(selectedBookingDetails.bookingDate).toISOString().split('T')[0],
          status: 'Checked-in',
          notes: selectedBookingDetails.notes || undefined,
          trfId: selectedBookingDetails.trfId ? String(selectedBookingDetails.trfId) : undefined
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to check in guest');
      }

      toast({
        title: "Guest Checked In",
        description: `${selectedBookingDetails.guestName || 'Guest'} has been checked in successfully`,
      });

      setBookingDetailsDialog(false);
      await fetchAccommodationData();
    } catch (error: any) {
      console.error('Error checking in guest:', error);
      toast({
        title: "Error",
        description: error.message || 'Failed to check in guest',
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handler for checking out a guest
  const handleCheckOut = async () => {
    if (!selectedBookingDetails) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/accommodation/admin/bookings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          id: String(selectedBookingDetails.id),
          staffHouseId: String(selectedBookingDetails.staffHouseId),
          roomId: String(selectedBookingDetails.roomId),
          staffId: selectedBookingDetails.staffId ? String(selectedBookingDetails.staffId) : undefined,
          date: typeof selectedBookingDetails.bookingDate === 'string' 
            ? selectedBookingDetails.bookingDate.split('T')[0] 
            : new Date(selectedBookingDetails.bookingDate).toISOString().split('T')[0],
          status: 'Checked-out',
          notes: selectedBookingDetails.notes || undefined,
          trfId: selectedBookingDetails.trfId ? String(selectedBookingDetails.trfId) : undefined
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to check out guest');
      }

      toast({
        title: "Guest Checked Out",
        description: `${selectedBookingDetails.guestName || 'Guest'} has been checked out successfully`,
      });

      setBookingDetailsDialog(false);
      await fetchAccommodationData();
    } catch (error: any) {
      console.error('Error checking out guest:', error);
      toast({
        title: "Error",
        description: error.message || 'Failed to check out guest',
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handler for cancelling a booking
  const handleCancelBooking = async () => {
    if (!selectedBookingDetails) return;

    const confirmed = confirm(`Are you sure you want to cancel the booking for ${selectedBookingDetails.guestName || 'this guest'}? This action cannot be undone.`);
    if (!confirmed) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/accommodation/admin/bookings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          id: String(selectedBookingDetails.id),
          staffHouseId: String(selectedBookingDetails.staffHouseId),
          roomId: String(selectedBookingDetails.roomId),
          staffId: selectedBookingDetails.staffId ? String(selectedBookingDetails.staffId) : undefined,
          date: typeof selectedBookingDetails.bookingDate === 'string' 
            ? selectedBookingDetails.bookingDate.split('T')[0] 
            : new Date(selectedBookingDetails.bookingDate).toISOString().split('T')[0],
          status: 'Cancelled',
          notes: selectedBookingDetails.notes ? selectedBookingDetails.notes + ' [CANCELLED BY ADMIN]' : '[CANCELLED BY ADMIN]',
          trfId: selectedBookingDetails.trfId ? String(selectedBookingDetails.trfId) : undefined
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to cancel booking');
      }

      toast({
        title: "Booking Cancelled",
        description: `Booking for ${selectedBookingDetails.guestName || 'guest'} has been cancelled successfully`,
      });

      setBookingDetailsDialog(false);
      await fetchAccommodationData();
    } catch (error: any) {
      console.error('Error cancelling booking:', error);
      toast({
        title: "Error",
        description: error.message || 'Failed to cancel booking',
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handler for cancelling all bookings for a specific guest/TRF
  const handleCancelAllBookings = async () => {
    if (!selectedBookingDetails) return;

    const guestName = selectedBookingDetails.guestName || 'this guest';
    const hasStaffId = selectedBookingDetails.staffId && String(selectedBookingDetails.staffId).trim();
    const hasTrfId = selectedBookingDetails.trfId && String(selectedBookingDetails.trfId).trim();
    
    let confirmMessage = `Are you sure you want to cancel ALL bookings for ${guestName}? This will:

• Cancel all accommodation bookings for this person
• Revert the accommodation request back to pending status
• This action cannot be undone

Do you want to continue?`;
    
    const confirmed = confirm(confirmMessage);
    if (!confirmed) return;

    setIsLoading(true);
    try {
      const requestBody: any = {};
      
      // Use TRF ID if available, otherwise use staff ID
      if (hasTrfId) {
        requestBody.trfId = String(selectedBookingDetails.trfId);
      } else if (hasStaffId) {
        requestBody.staffId = String(selectedBookingDetails.staffId);
      } else {
        throw new Error('No staff ID or TRF ID available for batch cancellation');
      }

      const response = await fetch('/api/accommodation/admin/bookings/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to cancel all bookings');
      }

      const result = await response.json();

      toast({
        title: "All Bookings Cancelled",
        description: `Successfully cancelled ${result.cancelledCount} booking(s) for ${guestName}. ${
          result.revertedTrfIds && result.revertedTrfIds.length > 0 
            ? 'Accommodation request has been reverted to pending status.' 
            : ''
        }`,
      });

      setBookingDetailsDialog(false);
      await fetchAccommodationData();
      await fetchTrfsAwaitingAccommodation(); // Refresh pending TRFs list
    } catch (error: any) {
      console.error('Error cancelling all bookings:', error);
      toast({
        title: "Error",
        description: error.message || 'Failed to cancel all bookings',
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handler for unblocking a room from the booking details modal
  const handleUnblockFromModal = async () => {
    if (!selectedBookingDetails) return;

    const confirmed = confirm(`Are you sure you want to unblock this room? This will remove the room blocking.`);
    if (!confirmed) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/accommodation/admin/bookings?id=${selectedBookingDetails.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to unblock room');
      }

      toast({
        title: "Room Unblocked",
        description: "Room has been unblocked successfully",
      });

      setBookingDetailsDialog(false);
      await fetchAccommodationData();
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
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2"><BedDouble className="w-8 h-8 text-primary" />Accommodation Administration</h1>
          <p className="text-muted-foreground">Manage staff house and camp bookings.</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="assigned">Assigned Accommodations</TabsTrigger>
          <TabsTrigger value="locations">Locations</TabsTrigger>
          <TabsTrigger value="rooms">Rooms</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">

      {/* Dashboard Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
            <BedDouble className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{bookings?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              Current month: {bookings?.filter(b => {
                const bookingDate = new Date(b.bookingDate || b.date);
                const currentDate = new Date();
                return bookingDate.getMonth() === currentDate.getMonth() && 
                       bookingDate.getFullYear() === currentDate.getFullYear();
              }).length || 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Bookings</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {bookings?.filter(b => b.status === 'Confirmed' || b.status === 'Active').length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Confirmed accommodations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
            <CalendarPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingAccommodationTRFs?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              Awaiting assignment
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Occupancy Rate</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(() => {
                const totalRooms = staffHouses?.reduce((sum, house) => sum + (house.rooms?.length || 0), 0) || 1;
                const occupiedRooms = bookings?.filter(b => 
                  b.status === 'Confirmed' || b.status === 'Active'
                ).length || 0;
                return Math.round((occupiedRooms / totalRooms) * 100);
              })()}%
            </div>
            <p className="text-xs text-muted-foreground">
              Current utilization
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Layout - Two Column Grid */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Overall Availability Calendar</CardTitle>
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
                              const booking = bookings.find(b => {
                                const bookingDate = new Date(b.bookingDate);
                                return bookingDate.getDate() === date.getDate() && 
                                       bookingDate.getMonth() === date.getMonth() &&
                                       bookingDate.getFullYear() === date.getFullYear() &&
                                       b.roomId === room.id &&
                                       b.status !== 'Cancelled'; // Exclude cancelled bookings
                              });
                              
                              const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                              
                              return (
                                <div key={i} className={cn("flex items-center justify-center p-1", isWeekend && "bg-blue-50/30")}>
                                  {booking ? (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <div 
                                            className={cn(
                                              "w-full h-8 rounded-lg text-xs font-bold text-white flex items-center justify-center cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-105 border-2 border-white shadow-sm",
                                              booking.status === 'Blocked' ? 'bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700' : 
                                              booking.status === 'Confirmed' ? 'bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700' : 
                                              booking.status === 'Checked-in' ? 'bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700' : 
                                              booking.status === 'Checked-out' ? 'bg-gradient-to-br from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700' : 'bg-gradient-to-br from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700'
                                            )}
                                            onDoubleClick={() => {
                                              setSelectedBookingDetails(booking);
                                              setBookingDetailsDialog(true);
                                            }}
                                          >
                                            {booking.status === 'Blocked' ? 'BLK' : getGuestInitials(booking.guestName)}
                                          </div>
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="max-w-xs">
                                          <div className="space-y-1">
                                            <div className="font-semibold">
                                              {booking.guestName || 'TRF Guest'}
                                            </div>
                                            <div className="text-sm">
                                              <span className="font-medium">Room:</span> {room.name}
                                            </div>
                                            <div className="text-sm">
                                              <span className="font-medium">Date:</span> {format(date, 'MMM dd, yyyy')}
                                            </div>
                                            <div className="text-sm">
                                              <span className="font-medium">Status:</span> 
                                              <Badge variant="outline" className={cn("ml-1 text-xs",
                                                booking.status === 'Blocked' ? 'bg-red-100 text-red-700' :
                                                booking.status === 'Confirmed' ? 'bg-blue-100 text-blue-700' :
                                                booking.status === 'Checked-in' ? 'bg-green-100 text-green-700' :
                                                booking.status === 'Checked-out' ? 'bg-gray-100 text-gray-700' : 
                                                'bg-orange-100 text-orange-700'
                                              )}>
                                                {booking.status}
                                              </Badge>
                                            </div>
                                            {booking.notes && (
                                              <div className="text-sm">
                                                <span className="font-medium">Notes:</span> {booking.notes}
                                              </div>
                                            )}
                                            <div className="text-xs text-muted-foreground pt-1 border-t">
                                              Double-click to view full details
                                            </div>
                                          </div>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  ) : (
                                    <div className={cn(
                                      "w-full h-8 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer shadow-sm",
                                      isWeekend ? "bg-blue-50/50 border-blue-200" : "bg-gray-50/80"
                                    )}></div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    ))}
                </div>
              </div>

              {/* Legend */}
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <div className="font-medium text-sm mb-2">Legend:</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-gray-50 border border-gray-200 rounded"></div>
                    <span>Available</span>
                  </div>
                  {bookings.filter(b => b.status !== 'Cancelled').slice(0, 8).map(booking => (
                    <TooltipProvider key={booking.id}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-2 cursor-pointer hover:bg-white hover:shadow-sm rounded p-1 transition-all">
                            <div className={cn(
                              "w-4 h-4 rounded text-white text-xs flex items-center justify-center font-medium",
                              booking.status === 'Blocked' ? 'bg-red-500' : 
                              booking.status === 'Confirmed' ? 'bg-blue-500' : 
                              booking.status === 'Checked-in' ? 'bg-green-500' : 
                              booking.status === 'Checked-out' ? 'bg-gray-500' : 'bg-orange-500'
                            )}>
                              {booking.status === 'Blocked' ? 'BLK' : getGuestInitials(booking.guestName)}
                            </div>
                            <span className="text-xs">
                              {booking.status === 'Blocked' ? 'Blocked Room' :
                               booking.guestName ? 
                                `${getGuestInitials(booking.guestName)} - ${booking.guestName}` : 
                                'TRF Guest'
                              }
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          <div className="space-y-1">
                            <div className="font-semibold">
                              {booking.guestName || 'TRF Guest'}
                            </div>
                            <div className="text-sm">
                              <span className="font-medium">Room:</span> {booking.roomName}
                            </div>
                            <div className="text-sm">
                              <span className="font-medium">Staff House:</span> {booking.staffHouseName}
                            </div>
                            <div className="text-sm">
                              <span className="font-medium">Date:</span> {format(new Date(booking.bookingDate), 'MMM dd, yyyy')}
                            </div>
                            <div className="text-sm">
                              <span className="font-medium">Status:</span> 
                              <Badge variant="outline" className={cn("ml-1 text-xs",
                                booking.status === 'Blocked' ? 'bg-red-100 text-red-700' :
                                booking.status === 'Confirmed' ? 'bg-blue-100 text-blue-700' :
                                booking.status === 'Checked-in' ? 'bg-green-100 text-green-700' :
                                booking.status === 'Checked-out' ? 'bg-gray-100 text-gray-700' : 
                                'bg-orange-100 text-orange-700'
                              )}>
                                {booking.status}
                              </Badge>
                            </div>
                            {booking.notes && (
                              <div className="text-sm">
                                <span className="font-medium">Notes:</span> {booking.notes}
                              </div>
                            )}
                            <div className="text-xs text-muted-foreground pt-1 border-t">
                              Click legend item to view in calendar
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pending Accommodation Requests */}
          <Card>
            <CardHeader>
              <CardTitle>Pending Accommodation Requests</CardTitle>
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
                <div className="text-center py-12">
                  <BedDouble className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500">No pending accommodation requests.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingAccommodationTRFs.map((trf) => (
                    <div
                      key={trf.id}
                      className={cn(
                        "flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 cursor-pointer",
                        selectedTRF?.id === trf.id ? "border-primary bg-primary/5" : ""
                      )}
                      onClick={() => setSelectedTRF(trf)}
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
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTRF(trf);
                        }}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Booking Details {selectedTRF ? `(${selectedTRF.id})` : ''}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
            {selectedTRF ? (
              <>
                <div>
                  <h4 className="font-semibold text-sm">Requestor:</h4>
                  <p className="text-sm text-muted-foreground">{selectedTRF.requestorName} (Staff ID: {selectedTRF.staffId || 'N/A'})</p>
                  <p className="text-sm text-muted-foreground">Dept: {selectedTRF.department || 'N/A'}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm">Trip:</h4>
                  <p className="text-sm text-muted-foreground">{getDisplayLocation(selectedTRF)}</p>
                  <p className="text-sm text-muted-foreground">Date: {formatDateRange(selectedTRF.requestedCheckInDate, selectedTRF.requestedCheckOutDate)}</p>
                  <p className="text-sm text-muted-foreground">Status: <span className="font-medium">{selectedTRF.status}</span></p>
                </div>
                
                

                {selectedTRF.status === 'Approved' && (
                    <div className="space-y-4 pt-4 border-t">
                        <div className="bg-blue-50 p-3 rounded-lg">
                            <h4 className="font-semibold text-sm text-blue-800 mb-2">📍 Accommodation Assignment</h4>
                            <p className="text-xs text-blue-600">Select location, staff house, and room for this guest</p>
                        </div>
                        
                        <div className="space-y-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="bookingLocation">Location</Label>
                                <Select 
                                    value={selectedLocation} 
                                    onValueChange={(value) => {
                                        setSelectedLocation(value);
                                        // Auto-update calendar when location changes
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select location" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Ashgabat">🏢 Ashgabat</SelectItem>
                                        <SelectItem value="Kiyanly">🏭 Kiyanly</SelectItem>
                                        <SelectItem value="Turkmenbashy">⚓ Turkmenbashy</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="staffHouse">Staff House</Label>
                                <Select 
                                    value={selectedStaffHouseForBooking} 
                                    onValueChange={(value) => {
                                        setSelectedStaffHouseForBooking(value);
                                        setSelectedRoomForBooking(""); // Reset room when house changes
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select staff house" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {staffHouses
                                            .filter(house => house.location === selectedLocation)
                                            .map(house => (
                                                <SelectItem key={house.id} value={house.id}>
                                                    🏠 {house.name}
                                                </SelectItem>
                                            ))
                                        }
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="room">Room</Label>
                                <Select 
                                    value={selectedRoomForBooking} 
                                    onValueChange={setSelectedRoomForBooking}
                                    disabled={!selectedStaffHouseForBooking}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder={!selectedStaffHouseForBooking ? "Select staff house first" : "Select room"} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {selectedStaffHouseForBooking && staffHouses
                                            .find(house => house.id === selectedStaffHouseForBooking)
                                            ?.rooms.map(room => {
                                                // Check if there would be gender conflicts for this room
                                                const hasGenderConflict = selectedTRF && dateRange?.from && checkGenderConflict(
                                                    room.id, 
                                                    selectedTRF.gender || 'Male',
                                                    dateRange.from,
                                                    bookings
                                                );
                                                
                                                return (
                                                    <SelectItem 
                                                        key={room.id} 
                                                        value={room.id}
                                                        disabled={hasGenderConflict}
                                                    >
                                                        <div className="flex items-center justify-between w-full">
                                                            <span>🚪 {room.name}</span>
                                                            {hasGenderConflict && (
                                                                <span className="text-xs text-red-500 ml-2">
                                                                    ⚠️ Gender conflict
                                                                </span>
                                                            )}
                                                        </div>
                                                    </SelectItem>
                                                );
                                            })
                                        }
                                    </SelectContent>
                                </Select>
                                {selectedRoomForBooking && selectedTRF && dateRange?.from && checkGenderConflict(
                                    selectedRoomForBooking,
                                    selectedTRF.gender || 'Male',
                                    dateRange.from,
                                    bookings
                                ) && (
                                    <p className="text-xs text-red-600 bg-red-50 p-2 rounded">
                                        ⚠️ Warning: This room has occupants of different gender on the selected date
                                    </p>
                                )}
                            </div>

                            <div className="space-y-3">
                                {selectedTRF && dateRange?.from && dateRange?.to && (
                                    <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded flex items-center">
                                        📅 Using requested dates: {format(new Date(selectedTRF.requestedCheckInDate), "MMM dd")} - {format(new Date(selectedTRF.requestedCheckOutDate), "MMM dd, yyyy")}
                                    </div>
                                )}
                                
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="checkInDate">Check-in Date</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dateRange?.from && "text-muted-foreground")}>
                                                    {dateRange?.from ? format(dateRange.from, "PPP") : <span>Pick date</span>}
                                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0">
                                                <Calendar 
                                                    mode="single" 
                                                    selected={dateRange?.from} 
                                                    onSelect={(day) => setDateRange(prev => ({from: day, to: prev?.to}))} 
                                                    initialFocus 
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="checkOutDate">Check-out Date</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dateRange?.to && "text-muted-foreground")}>
                                                    {dateRange?.to ? format(dateRange.to, "PPP") : <span>Pick date</span>}
                                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0">
                                                <Calendar 
                                                    mode="single" 
                                                    selected={dateRange?.to} 
                                                    onSelect={(day) => setDateRange(prev => ({from: prev?.from, to: day}))} 
                                                    disabled={(date) => dateRange?.from ? date < dateRange.from : false}
                                                    initialFocus 
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="accommodationNotes">Accommodation Notes</Label>
                                <Textarea 
                                    id="accommodationNotes" 
                                    placeholder="Add any special accommodation requirements or notes..."
                                    rows={2}
                                />
                            </div>
                        </div>
                    </div>
                )}

                <div className="space-y-2 pt-2">
                    <Button 
                        className="w-full" 
                        onClick={() => handleBookingConfirmation()} 
                        disabled={isLoading || selectedTRF.status !== 'Approved' || !selectedStaffHouseForBooking || !selectedRoomForBooking || !dateRange?.from || !dateRange?.to}
                    >
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserCheck className="mr-2 h-4 w-4" />}
                        Confirm Accommodation Booking
                    </Button>
                    <Button 
                        variant="outline" 
                        className="w-full" 
                        onClick={() => handleUnableToBook()} 
                        disabled={isLoading}
                    >
                        <UserX className="mr-2 h-4 w-4" /> Unable to Book
                    </Button>
                </div>
              </>
            ) : (
                <div className="text-center text-muted-foreground py-8">Select a TRF from the list to view its booking details here.</div>
            )}
          </CardContent>
          </Card>
      </div>

        </TabsContent>

        <TabsContent value="assigned" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BedDouble className="h-5 w-5 text-primary" />
                Assigned Accommodations
              </CardTitle>
              <CardDescription>
                View and manage all assigned accommodation bookings. You can cancel entire bookings or individual dates.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {!bookings || bookings.filter(booking => booking.status === 'Confirmed' || booking.status === 'Checked-in').length === 0 ? (
                  <div className="text-center py-12">
                    <BedDouble className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500 mb-2">No assigned accommodations found.</p>
                    <p className="text-sm text-gray-400">Use the Overview tab to assign accommodations to pending requests.</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {Object.entries(
                      (bookings || [])
                        .filter(booking => booking.status === 'Confirmed' || booking.status === 'Checked-in')
                        .reduce((acc, booking) => {
                          const key = booking.staffId || booking.trfId || 'unknown';
                          if (!acc[key]) {
                            acc[key] = [];
                          }
                          acc[key].push(booking);
                          return acc;
                        }, {} as Record<string, any[]>)
                    ).map(([guestKey, bookings]) => {
                      const firstBooking = bookings[0];
                      const sortedBookings = bookings.sort((a, b) => {
                        // Handle both bookingDate and date properties, and both string/Date types
                        const getDateValue = (booking: any) => {
                          const dateValue = booking.bookingDate || booking.date;
                          if (!dateValue) return new Date(0); // fallback to epoch
                          
                          if (typeof dateValue === 'string') {
                            // Handle different string formats
                            if (dateValue.includes('T')) {
                              return new Date(dateValue.split('T')[0]);
                            }
                            return new Date(dateValue);
                          }
                          return new Date(dateValue);
                        };
                        
                        const dateA = getDateValue(a);
                        const dateB = getDateValue(b);
                        return dateA.getTime() - dateB.getTime();
                      });
                      
                      const getBookingDate = (booking: any) => {
                        const dateValue = booking.bookingDate || booking.date;
                        if (!dateValue) return null;
                        
                        if (typeof dateValue === 'string') {
                          if (dateValue.includes('T')) {
                            return dateValue.split('T')[0];
                          }
                          return dateValue;
                        }
                        return dateValue;
                      };
                      
                      const startDateRaw = getBookingDate(sortedBookings[0]);
                      const endDateRaw = getBookingDate(sortedBookings[sortedBookings.length - 1]);
                      const roomInfo = `${firstBooking.staffHouseName} - ${firstBooking.roomName}`;
                      
                      return (
                        <div key={guestKey} className="border rounded-lg p-4 hover:bg-gray-50">
                          <div className="flex items-start justify-between">
                            <div className="space-y-2">
                              <div className="font-semibold text-lg">{firstBooking.guestName || 'Unknown Guest'}</div>
                              <div className="text-sm text-gray-600">
                                <strong>Room:</strong> {roomInfo}
                              </div>
                              <div className="text-sm text-gray-600">
                                <strong>Dates:</strong> {
                                  (() => {
                                    try {
                                      if (!startDateRaw || !endDateRaw) {
                                        return 'Date not available';
                                      }
                                      
                                      const startDate = new Date(startDateRaw);
                                      const endDate = new Date(endDateRaw);
                                      
                                      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                                        return 'Invalid date range';
                                      }
                                      
                                      if (startDate.getTime() === endDate.getTime()) {
                                        return format(startDate, 'MMM dd, yyyy');
                                      }
                                      
                                      return `${format(startDate, 'MMM dd, yyyy')} - ${format(endDate, 'MMM dd, yyyy')}`;
                                    } catch (error) {
                                      console.error('Date formatting error:', error, { startDateRaw, endDateRaw });
                                      return 'Date formatting error';
                                    }
                                  })()
                                }
                              </div>
                              <div className="text-sm text-gray-600">
                                <strong>Duration:</strong> {bookings.length} night{bookings.length > 1 ? 's' : ''}
                              </div>
                              {firstBooking.trfId && (
                                <div className="text-sm text-gray-600">
                                  <strong>TRF ID:</strong> {firstBooking.trfId}
                                </div>
                              )}
                              <div className="flex gap-2">
                                <Badge variant={firstBooking.status === 'Confirmed' ? 'default' : 'outline'}>
                                  {firstBooking.status}
                                </Badge>
                                {firstBooking.staffId && (
                                  <Badge variant="outline">
                                    Staff ID: {firstBooking.staffId}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col gap-2">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => {
                                  setSelectedBookingDetails(firstBooking);
                                  setBookingDetailsDialog(true);
                                }}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                View Details
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button 
                                    variant="destructive" 
                                    size="sm"
                                  >
                                    <UserX className="h-4 w-4 mr-1" />
                                    Cancel Booking
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Cancel Accommodation Booking</AlertDialogTitle>
                                    <AlertDialogDescription asChild>
                                      <div>
                                        <p>
                                          Are you sure you want to cancel the entire accommodation booking for <strong>{firstBooking.guestName || 'this guest'}</strong>?
                                        </p>
                                        <p className="mt-4">This will:</p>
                                        <ul className="list-disc list-inside mt-2 space-y-1">
                                          <li>Cancel all {bookings.length} night{bookings.length > 1 ? 's' : ''} of accommodation</li>
                                          <li>Free up the room for other bookings</li>
                                          {firstBooking.trfId && <li>Revert the accommodation request status to pending</li>}
                                          <li>Send a notification to the requestor</li>
                                        </ul>
                                        <p className="mt-4">
                                          <strong>This action cannot be undone.</strong>
                                        </p>
                                      </div>
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={async () => {
                                        setIsLoading(true);
                                        try {
                                          const response = await fetch('/api/accommodation/admin/bookings/cancel', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify((() => {
                                              const payload: any = {};
                                              
                                              // Try to use TRF ID first, then staff ID, then booking IDs as fallback
                                              if (firstBooking.trfId && String(firstBooking.trfId).trim()) {
                                                payload.trfId = String(firstBooking.trfId).trim();
                                              } else if (firstBooking.staffId && String(firstBooking.staffId).trim()) {
                                                payload.staffId = String(firstBooking.staffId).trim();
                                              } else {
                                                // If no TRF ID or staff ID, use booking IDs as fallback
                                                payload.bookingIds = bookings.map(b => String(b.id));
                                              }
                                              
                                              return payload;
                                            })()),
                                          });

                                          if (!response.ok) {
                                            const errorData = await response.json();
                                            throw new Error(errorData.error || 'Failed to cancel booking');
                                          }

                                          const result = await response.json();
                                          toast({
                                            title: "Booking Cancelled Successfully",
                                            description: `Cancelled ${result.cancelledCount} booking(s) for ${firstBooking.guestName}. Notification sent to requestor.`,
                                          });

                                          // Refresh data
                                          fetchAccommodationData();
                                        } catch (error: any) {
                                          toast({
                                            title: "Error",
                                            description: error.message || 'Failed to cancel booking',
                                            variant: "destructive",
                                          });
                                        } finally {
                                          setIsLoading(false);
                                        }
                                      }}
                                      className="bg-destructive hover:bg-destructive/90"
                                    >
                                      Yes, Cancel Booking
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="locations" className="space-y-4">
          <LocationManagement onLocationChange={() => fetchTrfsAwaitingAccommodation()} />
        </TabsContent>

        <TabsContent value="rooms" className="space-y-4">
          <RoomManagement onRoomChange={() => fetchTrfsAwaitingAccommodation()} />
        </TabsContent>

      </Tabs>

      {/* Booking Details Dialog */}
      <Dialog open={bookingDetailsDialog} onOpenChange={setBookingDetailsDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Booking Details</DialogTitle>
            <DialogDescription>
              Complete information about this accommodation booking
            </DialogDescription>
          </DialogHeader>
          
          {selectedBookingDetails && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">
                  {selectedBookingDetails.guestName || 'TRF Guest'}
                </h3>
                <Badge 
                  variant="outline" 
                  className={cn(
                    selectedBookingDetails.status === 'Blocked' ? 'bg-red-100 text-red-700' :
                    selectedBookingDetails.status === 'Confirmed' ? 'bg-blue-100 text-blue-700' :
                    selectedBookingDetails.status === 'Checked-in' ? 'bg-green-100 text-green-700' :
                    selectedBookingDetails.status === 'Checked-out' ? 'bg-gray-100 text-gray-700' : 
                    'bg-orange-100 text-orange-700'
                  )}
                >
                  {selectedBookingDetails.status}
                </Badge>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-muted-foreground">Room:</span>
                  <p>{selectedBookingDetails.roomName}</p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Staff House:</span>
                  <p>{selectedBookingDetails.staffHouseName}</p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Date:</span>
                  <p>{format(new Date(selectedBookingDetails.bookingDate), 'MMM dd, yyyy')}</p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Gender:</span>
                  <p>{selectedBookingDetails.gender || 'N/A'}</p>
                </div>
              </div>

              {selectedBookingDetails.notes && (
                <div>
                  <span className="font-medium text-muted-foreground">Notes:</span>
                  <p className="mt-1 p-2 bg-gray-50 rounded text-sm">{selectedBookingDetails.notes}</p>
                </div>
              )}

              <div className="flex flex-col gap-2 pt-4 border-t">
                <div className="flex gap-2">
                  {selectedBookingDetails.status === 'Confirmed' && (
                    <>
                      <Button variant="outline" size="sm" className="flex-1" onClick={handleCheckIn} disabled={isLoading}>
                        <UserCheck className="h-4 w-4 mr-1" />
                        Check In
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1" onClick={handleCancelBooking} disabled={isLoading}>
                        <UserX className="h-4 w-4 mr-1" />
                        Cancel
                      </Button>
                    </>
                  )}
                  {selectedBookingDetails.status === 'Checked-in' && (
                    <Button variant="outline" size="sm" className="flex-1" onClick={handleCheckOut} disabled={isLoading}>
                      <UserX className="h-4 w-4 mr-1" />
                      Check Out
                    </Button>
                  )}
                  {selectedBookingDetails.status === 'Blocked' && (
                    <Button variant="outline" size="sm" className="flex-1" onClick={handleUnblockFromModal} disabled={isLoading}>
                      <AlertTriangle className="h-4 w-4 mr-1" />
                      Unblock Room
                    </Button>
                  )}
                </div>
                
                {/* Show Cancel All Bookings button for confirmed bookings or any booking with TRF/staff ID */}
                {(selectedBookingDetails.status === 'Confirmed' || 
                  selectedBookingDetails.status === 'Checked-in' || 
                  selectedBookingDetails.status === 'Checked-out') && 
                 (selectedBookingDetails.staffId || selectedBookingDetails.trfId) && (
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    className="w-full" 
                    onClick={handleCancelAllBookings} 
                    disabled={isLoading}
                  >
                    <UserX className="h-4 w-4 mr-1" />
                    Cancel All Bookings for {selectedBookingDetails.guestName || 'This Guest'}
                  </Button>
                )}
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setBookingDetailsDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
    </div>
  );
}
