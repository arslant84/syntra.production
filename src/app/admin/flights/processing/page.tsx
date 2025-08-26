"use client"; 

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plane, Search, Filter, Ticket, UserCheck, AlertCircle, Loader2, AlertTriangleIcon, Eye, CalendarIcon, ArrowLeft, XCircle, Trash2 } from "lucide-react";
import Link from "next/link";
import type { TravelRequestForm, TrfStatus, TravelType, ItinerarySegment } from '@/types/trf';
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, isValid } from 'date-fns';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { useSessionPermissions } from '@/hooks/use-session-permissions';
import { shouldShowRequest } from '@/lib/client-rbac-utils';
import { LoadingPage, LoadingSpinner } from '@/components/ui/loading';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AdminTrfListItemForFlights {
  id: string;
  requestorName: string;
  travelType: TravelType;
  destinationSummary: string; 
  requestedDate: string; // Main travel start date for display
  status: TrfStatus;
  staffId?: string;
  department?: string;
  purpose?: string;
  itinerary?: ItinerarySegment[];
  // Fields for storing input when booking
  pnr?: string;
  airline?: string;
  flightNumber?: string;
  departureAirport?: string;
  arrivalAirport?: string;
  departureDate?: Date | null;
  departureTime?: string;
  arrivalDate?: Date | null;
  arrivalTime?: string;
  cost?: string; // Using string to accommodate currency symbols if needed by input
  flightNotes?: string;
}

interface FlightBookingData {
  id: string;
  trfId: string;
  flightNumber: string;
  departureLocation: string;
  arrivalLocation: string;
  departureDate: string;
  arrivalDate: string;
  bookingReference: string;
  status: string;
  remarks?: string;
  requestorName: string;
  travelType: string;
  department: string;
}

export default function FlightsProcessingPage() {
  const [pendingTrfs, setPendingTrfs] = useState<AdminTrfListItemForFlights[]>([]);
  const [bookedFlights, setBookedFlights] = useState<FlightBookingData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { role, userId, isLoading: sessionLoading } = useSessionPermissions();
  const [selectedTrf, setSelectedTrf] = useState<AdminTrfListItemForFlights | null>(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const { toast } = useToast();

  // State for flight booking form inputs
  const [pnr, setPnr] = useState("");
  const [airline, setAirline] = useState("");
  const [flightNumberInput, setFlightNumberInput] = useState("");
  const [departureAirport, setDepartureAirport] = useState("");
  const [arrivalAirport, setArrivalAirport] = useState("");
  const [departureDate, setDepartureDate] = useState<Date | null>(null);
  const [departureTime, setDepartureTime] = useState("");
  const [arrivalDate, setArrivalDate] = useState<Date | null>(null);
  const [arrivalTime, setArrivalTime] = useState("");
  const [cost, setCost] = useState("");
  const [flightNotes, setFlightNotes] = useState("");

  const fetchPendingTrfs = useCallback(async () => {
    if (sessionLoading || !role) {
      return; // Don't fetch while session is loading or role is not available
    }
    
    setIsLoading(true);
    setError(null);
    try {
      const statusesToFetch = ["Approved"].join(',');
      const response = await fetch(`/api/trf?statuses=${encodeURIComponent(statusesToFetch)}&limit=50`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.details || `Failed to fetch TRFs: ${response.status}`);
      }
      const data = await response.json();
      
      // Apply role-based filtering for personal vs admin view using client-side logic
      const filteredTrfs = (data.trfs || []).filter(trf =>
        shouldShowRequest(role, { ...trf, itemType: 'trf' }, userId)
      );
      
      // All approved TSRs require flight processing - flight admin handles all flight ticket bookings
      // regardless of travel type (Domestic, Overseas, Home Leave Passage, External Parties)
      const flightRequiredTrfs = filteredTrfs;
      
      setPendingTrfs(flightRequiredTrfs.map((trf: any) => {
        let destinationSummary = 'N/A';
        let requestedDate = trf.submittedAt; // Fallback
        if (trf.domesticTravelDetails?.itinerary?.length) {
            destinationSummary = trf.domesticTravelDetails.itinerary.map((s: ItinerarySegment) => `${s.from_location || s.from} > ${s.to_location || s.to}`).join(', ');
            requestedDate = trf.domesticTravelDetails.itinerary[0].date || requestedDate;
        } else if (trf.overseasTravelDetails?.itinerary?.length) {
            destinationSummary = trf.overseasTravelDetails.itinerary.map((s: ItinerarySegment) => `${s.from_location || s.from} > ${s.to_location || s.to}`).join(', ');
            requestedDate = trf.overseasTravelDetails.itinerary[0].date || requestedDate;
        } else if (trf.externalPartiesTravelDetails?.itinerary?.length) {
            destinationSummary = trf.externalPartiesTravelDetails.itinerary.map((s: ItinerarySegment) => `${s.from_location || s.from} > ${s.to_location || s.to}`).join(', ');
            requestedDate = trf.externalPartiesTravelDetails.itinerary[0].date || requestedDate;
        } else {
            destinationSummary = trf.purpose?.substring(0,50) + '...' || "N/A";
        }
        return {
            ...trf,
            destinationSummary,
            requestedDate: requestedDate, // Ensure requestedDate is always a string or Date
        };
      }) || []);
    } catch (err: any) {
      setError(err.message);
      setPendingTrfs([]);
    } finally {
      setIsLoading(false);
    }
  }, [role, userId, sessionLoading]);

  const fetchBookedFlights = useCallback(async () => {
    if (sessionLoading || !role) {
      return;
    }
    
    try {
      // Fetch flight bookings from the database
      const response = await fetch('/api/admin/flights?limit=50');
      if (response.ok) {
        const data = await response.json();
        // Filter TSRs that have flight bookings and format for booked flights display
        const bookedFlightsData = (data.trfs || [])
          .filter((trf: any) => trf.hasFlightBooking && trf.flightDetails)
          .map((trf: any) => ({
            id: trf.flightDetails.id,
            trfId: trf.id,
            flightNumber: trf.flightDetails.flightNumber,
            departureLocation: trf.flightDetails.departureLocation,
            arrivalLocation: trf.flightDetails.arrivalLocation,
            departureDate: trf.flightDetails.departureDate,
            arrivalDate: trf.flightDetails.arrivalDate,
            bookingReference: trf.flightDetails.bookingReference,
            status: trf.flightDetails.status,
            remarks: trf.flightDetails.remarks,
            requestorName: trf.requestorName,
            travelType: trf.travelType,
            department: trf.department
          }));
        setBookedFlights(bookedFlightsData);
      }
    } catch (err: any) {
      console.error('Failed to fetch booked flights:', err);
    }
  }, [role, sessionLoading]);

  useEffect(() => {
    fetchPendingTrfs();
    fetchBookedFlights();
  }, [fetchPendingTrfs, fetchBookedFlights]);

  const resetFormFields = () => {
    setPnr("");
    setAirline("");
    setFlightNumberInput("");
    setDepartureAirport("");
    setArrivalAirport("");
    setDepartureDate(null);
    setDepartureTime("");
    setArrivalDate(null);
    setArrivalTime("");
    setCost("");
    setFlightNotes("");
  };

  const handleProcessFlightBooking = async (trfId: string) => {
    if (!selectedTrf || selectedTrf.id !== trfId || selectedTrf.status !== 'Approved') {
        toast({ title: "Action Not Allowed", description: "Flights can only be booked for 'Approved' TRFs.", variant: "destructive" });
        return;
    }
    setIsProcessingAction(true);
    try {
      const payload = {
        pnr: pnr,
        airline: airline,
        flightNumber: flightNumberInput,
        departureAirport: departureAirport,
        arrivalAirport: arrivalAirport,
        departureDateTime: departureDate ? `${format(departureDate, 'yyyy-MM-dd')}T${departureTime || '00:00'}` : undefined,
        arrivalDateTime: arrivalDate ? `${format(arrivalDate, 'yyyy-MM-dd')}T${arrivalTime || '00:00'}` : undefined,
        cost: cost ? parseFloat(cost) : undefined,
        flightNotes: flightNotes,
      };
      const response = await fetch(`/api/trf/${trfId}/admin/book-flight`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.details || "Failed to process flight booking.");
      }
      const updatedTrf = await response.json();
      toast({
        title: "Flights Booked Successfully",
        description: `TRF ${trfId} flights marked as booked. New status: ${updatedTrf.trf.status}`,
      });
      fetchPendingTrfs(); 
      fetchBookedFlights();
      setSelectedTrf(null); 
      resetFormFields();
    } catch (err: any) {
      toast({ title: "Error Booking Flights", description: err.message, variant: "destructive" });
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleNoFlightsAvailable = async (trfId: string) => {
    if (!selectedTrf || selectedTrf.id !== trfId || selectedTrf.status !== 'Approved') {
      toast({ 
        title: "Action Not Allowed", 
        description: "This action can only be performed on 'Approved' TRFs.", 
        variant: "destructive" 
      });
      return;
    }
    
    setIsProcessingAction(true);
    try {
      const response = await fetch(`/api/trf/${trfId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject',
          approverRole: 'Flight Admin',
          approverName: 'Flight Administrator',
          comments: 'No flights available for requested travel dates and destinations. Request cancelled by Flight Admin.'
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.details || "Failed to cancel request.");
      }
      
      toast({
        title: "Request Cancelled",
        description: `TRF ${trfId} has been cancelled due to no available flights.`,
      });
      
      fetchPendingTrfs(); 
      fetchBookedFlights();
      setSelectedTrf(null); 
      resetFormFields();
    } catch (err: any) {
      toast({ 
        title: "Error Cancelling Request", 
        description: err.message, 
        variant: "destructive" 
      });
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleCancelBooking = async (flightId: string, trfId: string) => {
    setIsProcessingAction(true);
    try {
      const response = await fetch(`/api/flights/bookings/${flightId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: 'Booking cancelled by Flight Admin'
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.details || "Failed to cancel booking.");
      }
      
      toast({
        title: "Booking Cancelled",
        description: `Flight booking for TRF ${trfId} has been cancelled successfully.`,
      });
      
      fetchPendingTrfs(); 
      fetchBookedFlights();
    } catch (err: any) {
      toast({ 
        title: "Error Cancelling Booking", 
        description: err.message, 
        variant: "destructive" 
      });
    } finally {
      setIsProcessingAction(false);
    }
  };
  
  const loadTrfDetailsForView = async (trfItem: AdminTrfListItemForFlights) => {
      if (trfItem.id) {
        try {
            const res = await fetch(`/api/trf/${trfItem.id}`);
            if (!res.ok) throw new Error('Failed to fetch full TRF details');
            const fullTrfData = await res.json();
            const fetchedTrf = fullTrfData.trf as TravelRequestForm;

            // Map to AdminTrfListItemForFlights structure for consistency
            let destinationSummary = 'N/A';
            let mainRequestedDate = fetchedTrf.submittedAt; // Fallback
            let itinerary = undefined;
            let purpose = 'N/A';

            if (fetchedTrf.domesticTravelDetails?.itinerary?.length) {
                destinationSummary = fetchedTrf.domesticTravelDetails.itinerary.map(s => `${s.from_location || s.from} > ${s.to_location || s.to}`).join(', ');
                mainRequestedDate = fetchedTrf.domesticTravelDetails.itinerary[0].date || mainRequestedDate;
                itinerary = fetchedTrf.domesticTravelDetails.itinerary;
                purpose = fetchedTrf.domesticTravelDetails.purpose;
            } else if (fetchedTrf.overseasTravelDetails?.itinerary?.length) {
                destinationSummary = fetchedTrf.overseasTravelDetails.itinerary.map(s => `${s.from_location || s.from} > ${s.to_location || s.to}`).join(', ');
                mainRequestedDate = fetchedTrf.overseasTravelDetails.itinerary[0].date || mainRequestedDate;
                itinerary = fetchedTrf.overseasTravelDetails.itinerary;
                purpose = fetchedTrf.overseasTravelDetails.purpose;
            } else if (fetchedTrf.externalPartiesTravelDetails?.itinerary?.length) {
                destinationSummary = fetchedTrf.externalPartiesTravelDetails.itinerary.map(s => `${s.from_location || s.from} > ${s.to_location || s.to}`).join(', ');
                mainRequestedDate = fetchedTrf.externalPartiesTravelDetails.itinerary[0].date || mainRequestedDate;
                itinerary = fetchedTrf.externalPartiesTravelDetails.itinerary;
                purpose = fetchedTrf.externalPartiesTravelDetails.purpose;
            } else {
                 destinationSummary = fetchedTrf.purpose?.substring(0,50) + '...' || "N/A";
                 purpose = fetchedTrf.purpose || 'N/A';
            }

            setSelectedTrf({
                id: fetchedTrf.id,
                requestorName: fetchedTrf.requestorName || fetchedTrf.externalPartyRequestorInfo?.externalFullName || 'N/A',
                travelType: fetchedTrf.travelType,
                destinationSummary: destinationSummary,
                requestedDate: mainRequestedDate ? format(parseISO(String(mainRequestedDate)), 'PPP') : 'N/A',
                status: fetchedTrf.status,
                staffId: fetchedTrf.staffId || 'N/A',
                department: fetchedTrf.department || 'N/A',
                purpose: purpose,
                itinerary: itinerary,
            });

            // Auto-populate flight dates from TSR itinerary
            if (itinerary && itinerary.length > 0) {
                const firstSegment = itinerary[0];
                const lastSegment = itinerary[itinerary.length - 1];
                
                // Set departure location and date from first segment
                if (firstSegment.from_location || firstSegment.from) {
                    setDepartureAirport(firstSegment.from_location || firstSegment.from);
                }
                if (firstSegment.departure_date || firstSegment.date) {
                    const departureDate = parseISO(firstSegment.departure_date || firstSegment.date);
                    if (isValid(departureDate)) {
                        setDepartureDate(departureDate);
                    }
                }
                
                // Set arrival location and date from last segment  
                if (lastSegment.to_location || lastSegment.to) {
                    setArrivalAirport(lastSegment.to_location || lastSegment.to);
                }
                if (lastSegment.arrival_date || lastSegment.date) {
                    const arrivalDate = parseISO(lastSegment.arrival_date || lastSegment.date);
                    if (isValid(arrivalDate)) {
                        setArrivalDate(arrivalDate);
                    }
                }
            }
        } catch (err) {
            toast({title: "Error", description: "Could not load full TRF details.", variant: "destructive"});
            setSelectedTrf(trfItem); // Fallback to list item data
        }
      } else {
          setSelectedTrf(trfItem);
          // Auto-populate from list item if available
          if (trfItem.itinerary && trfItem.itinerary.length > 0) {
              const firstSegment = trfItem.itinerary[0];
              const lastSegment = trfItem.itinerary[trfItem.itinerary.length - 1];
              
              if (firstSegment.from_location || firstSegment.from) {
                  setDepartureAirport(firstSegment.from_location || firstSegment.from);
              }
              if (firstSegment.departure_date || firstSegment.date) {
                  const departureDate = parseISO(firstSegment.departure_date || firstSegment.date);
                  if (isValid(departureDate)) {
                      setDepartureDate(departureDate);
                  }
              }
              
              if (lastSegment.to_location || lastSegment.to) {
                  setArrivalAirport(lastSegment.to_location || lastSegment.to);
              }
              if (lastSegment.arrival_date || lastSegment.date) {
                  const arrivalDate = parseISO(lastSegment.arrival_date || lastSegment.date);
                  if (isValid(arrivalDate)) {
                      setArrivalDate(arrivalDate);
                  }
              }
          }
      }
      // Don't reset form fields since we want to keep auto-populated data
      // resetFormFields();
  };

  const getDestinationSummaryDisplay = (trf: AdminTrfListItemForFlights | TravelRequestForm | null): string => {
    if (!trf) return "N/A";
    if ('destinationSummary' in trf && trf.destinationSummary) return trf.destinationSummary;

    if ('domesticTravelDetails' in trf && trf.domesticTravelDetails?.itinerary?.length) {
        return trf.domesticTravelDetails.itinerary.map(s => `${s.from_location || s.from} > ${s.to_location || s.to}`).join('; ');
    }
    if ('overseasTravelDetails' in trf && trf.overseasTravelDetails?.itinerary?.length) {
        return trf.overseasTravelDetails.itinerary.map(s => `${s.from_location || s.from} > ${s.to_location || s.to}`).join('; ');
    }
     if ('externalPartiesTravelDetails' in trf && trf.externalPartiesTravelDetails?.itinerary?.length) {
        return trf.externalPartiesTravelDetails.itinerary.map(s => `${s.from_location || s.from} > ${s.to_location || s.to}`).join('; ');
    }
    return trf.purpose?.substring(0,50) + '...' || "N/A";
  }

  const getMainTravelDate = (trf: AdminTrfListItemForFlights | TravelRequestForm | null): string => {
    if (!trf) return "N/A";
    let dateToFormat: string | Date | null | undefined = trf.requestedDate || ('submittedAt' in trf ? trf.submittedAt : undefined);

    if ('itinerary' in trf && trf.itinerary?.length && trf.itinerary[0].date) {
        dateToFormat = trf.itinerary[0].date;
    } else if ('domesticTravelDetails' in trf && trf.domesticTravelDetails?.itinerary?.[0]?.date) {
        dateToFormat = trf.domesticTravelDetails.itinerary[0].date;
    } else if ('overseasTravelDetails' in trf && trf.overseasTravelDetails?.itinerary?.[0]?.date) {
        dateToFormat = trf.overseasTravelDetails.itinerary[0].date;
    } else if ('externalPartiesTravelDetails' in trf && trf.externalPartiesTravelDetails?.itinerary?.[0]?.date) {
        dateToFormat = trf.externalPartiesTravelDetails.itinerary[0].date;
    }
    
    if (dateToFormat) {
      const parsed = typeof dateToFormat === 'string' ? parseISO(dateToFormat) : dateToFormat;
      if (isValid(parsed)) {
        return format(parsed, 'PPP');
      }
    }
    return 'N/A';
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/flights">
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back to Overview
              </Link>
            </Button>
          </div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Plane className="w-8 h-8 text-primary" />
            Flights Processing Dashboard
          </h1>
          <p className="text-muted-foreground">Process flight ticket bookings for all approved travel requests.</p>
        </div>
      </div>

      <Tabs defaultValue="pending" className="space-y-6">
        <TabsList>
          <TabsTrigger value="pending">Pending Bookings</TabsTrigger>
          <TabsTrigger value="booked">Booked Flights</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Search & Filter Approved TRFs</CardTitle>
              <CardDescription>Find TRFs awaiting flight booking.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col md:flex-row gap-3">
              <div className="relative w-full md:flex-grow">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input type="search" placeholder="Search by TRF ID, Name, Destination..." className="pl-8 w-full" />
              </div>
              <Select defaultValue="Approved">
                <SelectTrigger className="w-full md:w-[180px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Filter by Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Approved">Status: Approved</SelectItem>
                </SelectContent>
              </Select>
              <Button className="w-full md:w-auto">Apply Filters</Button>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-3 gap-6">
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>TRFs Awaiting Flight Booking</CardTitle>
                <CardDescription>All approved travel requests requiring flight ticket booking and arrangements.</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <LoadingPage message="Loading TRFs..." />
                ) : error ? (
                  <div className="text-center py-8">
                    <AlertTriangleIcon className="mx-auto h-12 w-12 text-destructive" />
                    <h3 className="mt-2 text-lg font-medium text-destructive">Error Loading TRFs</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{error}</p>
                    <Button onClick={fetchPendingTrfs} className="mt-4">Try Again</Button>
                  </div>
                ) : pendingTrfs.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>TRF ID</TableHead>
                        <TableHead>Requestor</TableHead>
                        <TableHead>Destination</TableHead>
                        <TableHead>Travel Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingTrfs.map((trf) => (
                        <TableRow key={trf.id} onClick={() => loadTrfDetailsForView(trf)} className="cursor-pointer hover:bg-muted/50">
                          <TableCell className="font-medium">{trf.id}</TableCell>
                          <TableCell>{trf.requestorName}</TableCell>
                          <TableCell>{getDestinationSummaryDisplay(trf)}</TableCell>
                          <TableCell>{getMainTravelDate(trf)}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              trf.status === "Approved" ? "bg-green-100 text-green-700" : 
                              "bg-gray-100 text-gray-700"
                            }`}>
                              {trf.status}
                            </span>
                          </TableCell>
                          <TableCell className="text-center space-x-1">
                            <Button variant="outline" size="icon" asChild className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                              <Link href={`/trf/view/${trf.id}`} title="View Full TRF Details">
                                <Eye className="h-4 w-4" />
                              </Link>
                            </Button>
                            <Button 
                              variant="default" 
                              size="sm" 
                              onClick={(e) => { e.stopPropagation(); loadTrfDetailsForView(trf);}} 
                              disabled={trf.status !== 'Approved'} 
                              className="h-8"
                            >
                              Book Flight
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="flex flex-col items-center justify-center h-40 border-2 border-dashed rounded-lg">
                    <Ticket className="w-12 h-12 text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">No TRFs currently awaiting flight booking.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Booking Details {selectedTrf ? `(${selectedTrf.id})` : ''}</CardTitle>
                <CardDescription>
                  {selectedTrf ? `Enter booking details for TRF: ${selectedTrf.id}` : "Select a TRF from the list to book flights."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedTrf ? (
                  <>
                    <div>
                      <h4 className="font-semibold text-sm">Requestor:</h4>
                      <p className="text-sm text-muted-foreground">{selectedTrf.requestorName} (Staff ID: {selectedTrf.staffId || 'N/A'})</p>
                      <p className="text-sm text-muted-foreground">Dept: {selectedTrf.department || 'N/A'}</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm">Trip:</h4>
                      <p className="text-sm text-muted-foreground">{selectedTrf.travelType} - {selectedTrf.purpose || 'N/A'}</p>
                      <p className="text-sm text-muted-foreground">Destination: {getDestinationSummaryDisplay(selectedTrf)}</p>
                      <p className="text-sm text-muted-foreground">Date: {getMainTravelDate(selectedTrf)}</p>
                      <p className="text-sm text-muted-foreground">Status: <span className="font-medium">{selectedTrf.status}</span></p>
                    </div>
                    
                    {selectedTrf.status === 'Approved' && (
                        <div className="space-y-3 pt-2 border-t">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                  <Label htmlFor="pnr">PNR / Booking Ref.</Label>
                                  <Input id="pnr" value={pnr} onChange={(e) => setPnr(e.target.value)} placeholder="e.g., XYZ123"/>
                                </div>
                                <div className="space-y-1.5">
                                  <Label htmlFor="airline">Airline</Label>
                                  <Input id="airline" value={airline} onChange={(e) => setAirline(e.target.value)} placeholder="e.g., MH / AK"/>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                              <Label htmlFor="flightNumberInput">Flight Number</Label>
                              <Input id="flightNumberInput" value={flightNumberInput} onChange={(e) => setFlightNumberInput(e.target.value)} placeholder="e.g., MH123 / AK456"/>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                  <Label htmlFor="departureAirport">Departure Airport</Label>
                                  <Input id="departureAirport" value={departureAirport} onChange={(e) => setDepartureAirport(e.target.value)} placeholder="e.g., KUL"/>
                                </div>
                                <div className="space-y-1.5">
                                  <Label htmlFor="arrivalAirport">Arrival Airport</Label>
                                  <Input id="arrivalAirport" value={arrivalAirport} onChange={(e) => setArrivalAirport(e.target.value)} placeholder="e.g., LHR"/>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label htmlFor="departureDate">Departure Date</Label>
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !departureDate && "text-muted-foreground")}>
                                          {departureDate ? format(departureDate, "PPP") : <span>Pick date</span>}
                                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-auto p-0">
                                        <Calendar mode="single" selected={departureDate} onSelect={setDepartureDate} initialFocus />
                                      </PopoverContent>
                                    </Popover>
                                </div>
                                <div className="space-y-1.5">
                                  <Label htmlFor="departureTime">Departure Time (HH:MM)</Label>
                                  <Input id="departureTime" type="time" step="900" value={departureTime} onChange={(e) => setDepartureTime(e.target.value)} />
                                </div>
                            </div>
                             <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label htmlFor="arrivalDate">Arrival Date</Label>
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !arrivalDate && "text-muted-foreground")}>
                                          {arrivalDate ? format(arrivalDate, "PPP") : <span>Pick date</span>}
                                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-auto p-0">
                                        <Calendar mode="single" selected={arrivalDate} onSelect={setArrivalDate} disabled={(date) => departureDate ? date < departureDate : false} initialFocus />
                                      </PopoverContent>
                                    </Popover>
                                </div>
                                <div className="space-y-1.5">
                                  <Label htmlFor="arrivalTime">Arrival Time (HH:MM)</Label>
                                  <Input id="arrivalTime" type="time" step="900" value={arrivalTime} onChange={(e) => setArrivalTime(e.target.value)} />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                              <Label htmlFor="cost">Cost (e.g., 1250.75)</Label>
                              <Input id="cost" type="number" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="Enter total cost"/>
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="flightNotes">Flight Booking Notes</Label>
                                <Textarea id="flightNotes" value={flightNotes} onChange={(e) => setFlightNotes(e.target.value)} placeholder="Add any relevant flight booking notes..."/>
                            </div>
                        </div>
                    )}

                    <div className="space-y-2 pt-2">
                        <Button 
                          className="w-full" 
                          onClick={() => handleProcessFlightBooking(selectedTrf.id)} 
                          disabled={isProcessingAction || selectedTrf.status !== 'Approved'}
                        >
                          {isProcessingAction ? <LoadingSpinner size="sm" className="mr-2" /> : <UserCheck className="mr-2 h-4 w-4" />}
                          Confirm Flight Booking
                        </Button>
                        <Button 
                          variant="destructive" 
                          className="w-full" 
                          onClick={() => handleNoFlightsAvailable(selectedTrf.id)} 
                          disabled={isProcessingAction || selectedTrf.status !== 'Approved'}
                        >
                          {isProcessingAction ? <LoadingSpinner size="sm" className="mr-2" /> : <XCircle className="mr-2 h-4 w-4" />}
                          No Flights Available - Cancel Request
                        </Button>
                    </div>
                  </>
                ) : (
                    <div className="text-center text-muted-foreground py-8">
                      Select a TRF from the list to view its booking details here.
                    </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="booked" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Booked Flights</CardTitle>
              <CardDescription>List of all booked flight arrangements.</CardDescription>
            </CardHeader>
            <CardContent>
              {bookedFlights.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>TRF ID</TableHead>
                      <TableHead>Requestor</TableHead>
                      <TableHead>Flight</TableHead>
                      <TableHead>Route</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>PNR</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bookedFlights.map((flight) => (
                      <TableRow key={flight.id}>
                        <TableCell className="font-medium">{flight.trfId}</TableCell>
                        <TableCell>{flight.requestorName}</TableCell>
                        <TableCell>{flight.flightNumber}</TableCell>
                        <TableCell>{flight.departureLocation} → {flight.arrivalLocation}</TableCell>
                        <TableCell>
                          {isValid(parseISO(flight.departureDate)) ? format(parseISO(flight.departureDate), 'PPP') : 'N/A'}
                        </TableCell>
                        <TableCell>{flight.bookingReference}</TableCell>
                        <TableCell>
                          <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">
                            {flight.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex gap-2 justify-center">
                            <Button variant="outline" size="icon" asChild className="h-8 w-8">
                              <Link href={`/trf/view/${flight.trfId}`} title="View TRF Details">
                                <Eye className="h-4 w-4" />
                              </Link>
                            </Button>
                            <Button 
                              variant="outline" 
                              size="icon" 
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleCancelBooking(flight.id, flight.trfId)}
                              disabled={isProcessingAction}
                              title="Cancel Booking"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex flex-col items-center justify-center h-40 border-2 border-dashed rounded-lg">
                  <Plane className="w-12 h-12 text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No flight bookings found.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}