"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from '@/lib/utils';
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, AlertTriangle, Truck, Eye, CheckCircle, Clock, ArrowLeft } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSessionPermissions } from '@/hooks/use-session-permissions';
import { shouldShowRequest } from '@/lib/client-rbac-utils';
import { format } from "date-fns";

// Define interfaces for transport requests
interface TransportRequest {
  id: string;
  requestorName: string;
  department: string;
  purpose: string;
  status: string;
  submittedAt: string;
  transportDetails: TransportDetails[];
  bookingDetails?: TransportBookingDetails;
}

interface TransportDetails {
  id: string;
  date: string;
  day: string;
  from: string;
  to: string;
  departureTime: string;
  transportType: string;
  numberOfPassengers: number;
}

interface TransportBookingDetails {
  vehicleType?: string;
  vehicleNumber?: string;
  driverName?: string;
  driverContact?: string;
  pickupTime?: string;
  dropoffTime?: string;
  actualRoute?: string;
  bookingReference?: string;
  additionalNotes?: string;
}

export default function TransportProcessingPage() {
  const [approvedTransportRequests, setApprovedTransportRequests] = useState<TransportRequest[]>([]);
  const [processingTransportRequests, setProcessingTransportRequests] = useState<TransportRequest[]>([]);
  const [completedTransportRequests, setCompletedTransportRequests] = useState<TransportRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<TransportRequest | null>(null);
  const [processingDialog, setProcessingDialog] = useState(false);
  const [completingDialog, setCompletingDialog] = useState(false);
  const [detailsDialog, setDetailsDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("approved");
  
  // Booking details form state
  const [bookingForm, setBookingForm] = useState<TransportBookingDetails>({
    vehicleType: '',
    vehicleNumber: '',
    driverName: '',
    driverContact: '',
    pickupTime: '',
    dropoffTime: '',
    actualRoute: '',
    bookingReference: '',
    additionalNotes: ''
  });

  const { toast } = useToast();
  const { role, userId, isLoading: sessionLoading } = useSessionPermissions();
  const router = useRouter();

  // Fetch transport requests by status
  const fetchTransportRequests = useCallback(async () => {
    if (sessionLoading || !role) {
      return;
    }
    
    setIsLoading(true);
    setError(null);
    try {
      const fetchByStatus = async (status: string) => {
        const response = await fetch(`/api/admin/transport?statuses=${status}&fullDetails=true&limit=50`);
        if (!response.ok) {
          const contentType = response.headers.get('content-type') || '';
          let errorMessage = `Failed to fetch ${status} transport requests: ${response.status} ${response.statusText}`;
          if (contentType.includes('application/json')) {
            const errorData = await response.json().catch(() => null);
            errorMessage = errorData?.error || errorMessage;
          }
          throw new Error(errorMessage);
        }
        const data = await response.json();
        const dataArray = Array.isArray(data) ? data : (data.data || []);
        return dataArray.filter((req: any) =>
          shouldShowRequest(role, { ...req, itemType: 'transport' }, userId)
        ).map((req: any) => ({
          ...req,
          transportDetails: req.transportDetails || [],
          bookingDetails: req.bookingDetails || null
        }));
      };

      const [approved, processing, completed] = await Promise.all([
        fetchByStatus('Approved'),
        fetchByStatus('Processing with Transport Admin'),
        fetchByStatus('Completed'),
      ]);

      setApprovedTransportRequests(approved);
      setProcessingTransportRequests(processing);
      setCompletedTransportRequests(completed);

    } catch (err: any) {
      console.error('Error fetching transport requests:', err);
      setError(err.message || 'Failed to load transport requests');
      toast({
        title: 'Error',
        description: err.message || 'Failed to load transport requests',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast, role, userId, sessionLoading]);

  // Fetch data on component mount
  useEffect(() => {
    fetchTransportRequests();
  }, [fetchTransportRequests]);

  // Handle starting transport processing
  const handleStartProcessing = async () => {
    if (!selectedRequest) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/transport/admin/process/${selectedRequest.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'process',
          comments: 'Transport processing started by Transport Admin'
        }),
      });

      if (!response.ok) {
        const contentType = response.headers.get('content-type') || '';
        let errorMessage = `Failed to start processing: ${response.status} ${response.statusText}`;
        if (contentType.includes('application/json')) {
          const errorData = await response.json().catch(() => null);
          errorMessage = errorData?.error || errorMessage;
        }
        throw new Error(errorMessage);
      }

      toast({
        title: "Processing Started",
        description: `Transport request ${selectedRequest.id} is now being processed`,
      });

      setProcessingDialog(false);
      setSelectedRequest(null);
      fetchTransportRequests();
    } catch (error: any) {
      console.error('Error starting processing:', error);
      toast({
        title: "Error",
        description: error.message || 'Failed to start processing',
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle completing transport processing with booking details
  const handleCompleteProcessing = async () => {
    if (!selectedRequest) return;

    // Validate required booking details
    if (!bookingForm.vehicleType || !bookingForm.vehicleNumber || !bookingForm.driverName) {
      toast({
        title: "Missing Information",
        description: "Please fill in vehicle type, vehicle number, and driver name",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/transport/admin/process/${selectedRequest.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'complete',
          bookingDetails: bookingForm,
          comments: 'Transport processing completed with booking details'
        }),
      });

      if (!response.ok) {
        const contentType = response.headers.get('content-type') || '';
        let errorMessage = `Failed to complete processing: ${response.status} ${response.statusText}`;
        if (contentType.includes('application/json')) {
          const errorData = await response.json().catch(() => null);
          errorMessage = errorData?.error || errorMessage;
        }
        throw new Error(errorMessage);
      }

      toast({
        title: "Transport Completed",
        description: `Transport request ${selectedRequest.id} has been completed with booking details`,
      });

      setCompletingDialog(false);
      setSelectedRequest(null);
      // Reset form
      setBookingForm({
        vehicleType: '',
        vehicleNumber: '',
        driverName: '',
        driverContact: '',
        pickupTime: '',
        dropoffTime: '',
        actualRoute: '',
        bookingReference: '',
        additionalNotes: ''
      });
      fetchTransportRequests();
    } catch (error: any) {
      console.error('Error completing processing:', error);
      toast({
        title: "Error",
        description: error.message || 'Failed to complete processing',
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to format transport details
  const formatTransportDetails = (details: TransportDetails[] | undefined, bookingDetails?: TransportBookingDetails) => {
    console.log('formatTransportDetails called with:', { details, bookingDetails });
    
    // If booking details are available (for completed requests), show booking info
    if (bookingDetails && (bookingDetails.vehicleType || bookingDetails.vehicleNumber)) {
      const bookingInfo = [];
      if (bookingDetails.vehicleType) bookingInfo.push(`Vehicle: ${bookingDetails.vehicleType}`);
      if (bookingDetails.vehicleNumber) bookingInfo.push(`#${bookingDetails.vehicleNumber}`);
      if (bookingDetails.driverName) bookingInfo.push(`Driver: ${bookingDetails.driverName}`);
      if (bookingDetails.pickupTime) bookingInfo.push(`Pickup: ${bookingDetails.pickupTime}`);
      const result = bookingInfo.join(' | ');
      console.log('Returning booking details:', result);
      return result;
    }
    
    // Otherwise show original request details
    if (!details || details.length === 0) {
      console.log('No transport details available');
      return 'No details available';
    }
    
    const result = details.map(detail => 
      `${detail.from || 'N/A'} → ${detail.to || 'N/A'} (${detail.departureTime || 'N/A'}, ${detail.numberOfPassengers || 0} pax)`
    ).join('; ');
    console.log('Returning transport details:', result);
    return result;
  };

  // Helper function to get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Approved': return 'bg-blue-100 text-blue-700';
      case 'Processing with Transport Admin': return 'bg-yellow-100 text-yellow-700';
      case 'Completed': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  // Render transport request list
  const renderRequestList = (requests: TransportRequest[], emptyMessage: string, actionButton?: (request: TransportRequest) => React.ReactNode) => {
    if (isLoading && requests.length === 0) {
      return (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Loading requests...</span>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center justify-center h-40 text-destructive">
          <AlertTriangle className="h-8 w-8 mr-2" />
          <span>{error}</span>
        </div>
      );
    }

    if (requests.length === 0) {
      return (
        <div className="text-center py-12">
          <Truck className="h-16 w-16 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">{emptyMessage}</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {requests.map((request) => (
          <div
            key={request.id}
            className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
          >
            <div className="space-y-1 flex-1">
              <div className="font-medium">{request.requestorName}</div>
              <div className="text-sm text-muted-foreground">
                {request.department} • ID: {request.id}
              </div>
              <div className="text-sm text-muted-foreground">
                Purpose: {request.purpose}
              </div>
              <div className="text-sm text-muted-foreground">
                {formatTransportDetails(request.transportDetails, request.bookingDetails)}
              </div>
              <div className="text-sm text-muted-foreground">
                Submitted: {format(new Date(request.submittedAt), 'MMM dd, yyyy')}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Badge className={getStatusColor(request.status)}>
                  {request.status}
                </Badge>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSelectedRequest(request);
                  setDetailsDialog(true);
                }}
              >
                <Eye className="h-4 w-4 mr-1" />
                View
              </Button>
              {actionButton && actionButton(request)}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/transport">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to Transport Admin
              </Link>
            </Button>
          </div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Truck className="w-8 h-8 text-primary" />
            Transport Processing
          </h1>
          <p className="text-muted-foreground">Process and manage transport requests with booking details.</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="approved">
            Approved Requests ({approvedTransportRequests.length})
          </TabsTrigger>
          <TabsTrigger value="processing">
            Processing ({processingTransportRequests.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed ({completedTransportRequests.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="approved" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-500" />
                Approved Transport Requests
              </CardTitle>
              <CardDescription>
                Transport requests approved by HOD and ready for processing by Transport Admin.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {renderRequestList(
                approvedTransportRequests,
                "No approved transport requests awaiting processing.",
                (request) => (
                  <Button
                    size="sm"
                    onClick={() => {
                      setSelectedRequest(request);
                      setProcessingDialog(true);
                    }}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Start Processing
                  </Button>
                )
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="processing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 text-yellow-500" />
                Processing Transport Requests
              </CardTitle>
              <CardDescription>
                Transport requests currently being processed. Complete them with booking details.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {renderRequestList(
                processingTransportRequests,
                "No transport requests currently being processed.",
                (request) => (
                  <Button
                    size="sm"
                    onClick={() => {
                      setSelectedRequest(request);
                      setCompletingDialog(true);
                    }}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Complete
                  </Button>
                )
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                Completed Transport Requests
              </CardTitle>
              <CardDescription>
                Transport requests that have been completed with booking details.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {renderRequestList(
                completedTransportRequests,
                "No completed transport requests."
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Start Processing Dialog */}
      <Dialog open={processingDialog} onOpenChange={setProcessingDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Start Transport Processing</DialogTitle>
            <DialogDescription>
              Start processing this transport request. The requestor will be notified.
            </DialogDescription>
          </DialogHeader>
          
          {selectedRequest && (
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="font-medium">{selectedRequest.requestorName}</div>
                <div className="text-sm text-muted-foreground">ID: {selectedRequest.id}</div>
                <div className="text-sm text-muted-foreground">Purpose: {selectedRequest.purpose}</div>
                <div className="text-sm text-muted-foreground">
                  {formatTransportDetails(selectedRequest.transportDetails, selectedRequest.bookingDetails)}
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setProcessingDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleStartProcessing} disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Start Processing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete Processing Dialog */}
      <Dialog open={completingDialog} onOpenChange={setCompletingDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Complete Transport Processing</DialogTitle>
            <DialogDescription>
              Provide booking details to complete the transport request processing.
            </DialogDescription>
          </DialogHeader>
          
          {selectedRequest && (
            <div className="space-y-6">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="font-medium">{selectedRequest.requestorName}</div>
                <div className="text-sm text-muted-foreground">ID: {selectedRequest.id}</div>
                <div className="text-sm text-muted-foreground">Purpose: {selectedRequest.purpose}</div>
                <div className="text-sm text-muted-foreground">
                  {formatTransportDetails(selectedRequest.transportDetails, selectedRequest.bookingDetails)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="vehicleType">Vehicle Type *</Label>
                  <Input
                    id="vehicleType"
                    value={bookingForm.vehicleType}
                    onChange={(e) => setBookingForm(prev => ({ ...prev, vehicleType: e.target.value }))}
                    placeholder="e.g., Van, Bus, Car"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vehicleNumber">Vehicle Number *</Label>
                  <Input
                    id="vehicleNumber"
                    value={bookingForm.vehicleNumber}
                    onChange={(e) => setBookingForm(prev => ({ ...prev, vehicleNumber: e.target.value }))}
                    placeholder="e.g., ABC-123"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="driverName">Driver Name *</Label>
                  <Input
                    id="driverName"
                    value={bookingForm.driverName}
                    onChange={(e) => setBookingForm(prev => ({ ...prev, driverName: e.target.value }))}
                    placeholder="Driver's full name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="driverContact">Driver Contact</Label>
                  <Input
                    id="driverContact"
                    value={bookingForm.driverContact}
                    onChange={(e) => setBookingForm(prev => ({ ...prev, driverContact: e.target.value }))}
                    placeholder="Phone number"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pickupTime">Pickup Time</Label>
                  <Input
                    id="pickupTime"
                    value={bookingForm.pickupTime}
                    onChange={(e) => setBookingForm(prev => ({ ...prev, pickupTime: e.target.value }))}
                    placeholder="e.g., 09:00 AM"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dropoffTime">Dropoff Time</Label>
                  <Input
                    id="dropoffTime"
                    value={bookingForm.dropoffTime}
                    onChange={(e) => setBookingForm(prev => ({ ...prev, dropoffTime: e.target.value }))}
                    placeholder="e.g., 05:00 PM"
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="actualRoute">Actual Route</Label>
                  <Input
                    id="actualRoute"
                    value={bookingForm.actualRoute}
                    onChange={(e) => setBookingForm(prev => ({ ...prev, actualRoute: e.target.value }))}
                    placeholder="Actual route taken"
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="bookingReference">Booking Reference</Label>
                  <Input
                    id="bookingReference"
                    value={bookingForm.bookingReference}
                    onChange={(e) => setBookingForm(prev => ({ ...prev, bookingReference: e.target.value }))}
                    placeholder="Internal booking reference"
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="additionalNotes">Additional Notes</Label>
                  <Textarea
                    id="additionalNotes"
                    value={bookingForm.additionalNotes}
                    onChange={(e) => setBookingForm(prev => ({ ...prev, additionalNotes: e.target.value }))}
                    placeholder="Any additional notes or special instructions"
                    rows={3}
                  />
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompletingDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCompleteProcessing} disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Complete Processing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={detailsDialog} onOpenChange={setDetailsDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Transport Request Details</DialogTitle>
            <DialogDescription>
              Complete information about this transport request
            </DialogDescription>
          </DialogHeader>
          
          {selectedRequest && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="font-medium text-muted-foreground">Requestor:</span>
                  <p>{selectedRequest.requestorName}</p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Department:</span>
                  <p>{selectedRequest.department}</p>
                </div>
                <div className="col-span-2">
                  <span className="font-medium text-muted-foreground">Purpose:</span>
                  <p>{selectedRequest.purpose}</p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Status:</span>
                  <Badge className={getStatusColor(selectedRequest.status)}>
                    {selectedRequest.status}
                  </Badge>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Submitted:</span>
                  <p>{format(new Date(selectedRequest.submittedAt), 'MMM dd, yyyy HH:mm')}</p>
                </div>
              </div>

              <div>
                <span className="font-medium text-muted-foreground">Transport Details:</span>
                <div className="mt-2 space-y-2">
                  {(selectedRequest.transportDetails || []).map((detail, index) => (
                    <div key={detail.id || index} className="p-3 border rounded-lg">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div><strong>From:</strong> {detail.from || 'N/A'}</div>
                        <div><strong>To:</strong> {detail.to || 'N/A'}</div>
                        <div><strong>Date:</strong> {detail.date || 'N/A'}</div>
                        <div><strong>Time:</strong> {detail.departureTime || 'N/A'}</div>
                        <div><strong>Passengers:</strong> {detail.numberOfPassengers || 0}</div>
                        <div><strong>Type:</strong> {detail.transportType || 'N/A'}</div>
                      </div>
                    </div>
                  ))}
                  {(!selectedRequest.transportDetails || selectedRequest.transportDetails.length === 0) && (
                    <div className="p-3 border rounded-lg text-center text-muted-foreground">
                      No transport details available
                    </div>
                  )}
                </div>
              </div>

              {selectedRequest.bookingDetails && (
                <div>
                  <span className="font-medium text-muted-foreground">Booking Details:</span>
                  <div className="mt-2 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {selectedRequest.bookingDetails.vehicleType && (
                        <div><strong>Vehicle Type:</strong> {selectedRequest.bookingDetails.vehicleType}</div>
                      )}
                      {selectedRequest.bookingDetails.vehicleNumber && (
                        <div><strong>Vehicle Number:</strong> {selectedRequest.bookingDetails.vehicleNumber}</div>
                      )}
                      {selectedRequest.bookingDetails.driverName && (
                        <div><strong>Driver Name:</strong> {selectedRequest.bookingDetails.driverName}</div>
                      )}
                      {selectedRequest.bookingDetails.driverContact && (
                        <div><strong>Driver Contact:</strong> {selectedRequest.bookingDetails.driverContact}</div>
                      )}
                      {selectedRequest.bookingDetails.pickupTime && (
                        <div><strong>Pickup Time:</strong> {selectedRequest.bookingDetails.pickupTime}</div>
                      )}
                      {selectedRequest.bookingDetails.dropoffTime && (
                        <div><strong>Dropoff Time:</strong> {selectedRequest.bookingDetails.dropoffTime}</div>
                      )}
                      {selectedRequest.bookingDetails.actualRoute && (
                        <div className="col-span-2"><strong>Route:</strong> {selectedRequest.bookingDetails.actualRoute}</div>
                      )}
                      {selectedRequest.bookingDetails.bookingReference && (
                        <div className="col-span-2"><strong>Reference:</strong> {selectedRequest.bookingDetails.bookingReference}</div>
                      )}
                      {selectedRequest.bookingDetails.additionalNotes && (
                        <div className="col-span-2"><strong>Notes:</strong> {selectedRequest.bookingDetails.additionalNotes}</div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}