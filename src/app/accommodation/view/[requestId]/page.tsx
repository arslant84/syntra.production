"use client";

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import AccommodationRequestDetailsView from '@/components/accommodation/AccommodationRequestDetailsView';
import type { AccommodationRequestDetails, BookingStatus } from '@/types/accommodation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertTriangle, ArrowLeft, Bed, Edit, Ban, Printer, Trash2 } from 'lucide-react';


const EDITABLE_STATUSES: BookingStatus[] = ["Pending Department Focal", "Rejected", "Draft", "Pending Assignment"];
const CANCELLABLE_STATUSES: BookingStatus[] = ["Pending Department Focal", "Pending Line Manager", "Pending HOD", "Pending Assignment"];
const DELETABLE_STATUSES: BookingStatus[] = ["Pending Department Focal", "Rejected", "Draft", "Pending Assignment"];
const TERMINAL_STATUSES: BookingStatus[] = ["Approved", "Cancelled", "Processing", "Completed", "Confirmed", "Blocked"];

export default function ViewAccommodationRequestPage() {
  const params = useParams();
  const router = useRouter();
  const requestId = params.requestId as string;
  const [requestData, setRequestData] = React.useState<AccommodationRequestDetails | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isActionPending, setIsActionPending] = React.useState(false);
  const { toast } = useToast();

  React.useEffect(() => {
    setIsLoading(true);
    setError(null);
    
    // Fetch data from the API
    const fetchAccommodationRequest = async () => {
      try {
        const response = await fetch(`/api/accommodation/requests/${requestId}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(`Accommodation Request with ID ${requestId} not found.`);
          }
          throw new Error('Failed to fetch accommodation request details');
        }
        
        const data = await response.json();
        // Check if the data is wrapped in an accommodationRequest property
        const requestData = data.accommodationRequest || data;
        setRequestData(requestData);
      } catch (err: any) {
        console.error('Error fetching accommodation request:', err);
        setError(err.message || 'An unexpected error occurred');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchAccommodationRequest();
  }, [requestId]);

  const handleCancelRequest = async () => {
    if (!requestData) return;
    setIsActionPending(true);
    try {
      const response = await fetch(`/api/accommodation/requests/${requestId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to cancel accommodation request.");
      }
      setRequestData({ ...requestData, status: "Cancelled" });
      toast({ title: "Accommodation Request Cancelled", description: `Accommodation request ID ${requestId} has been cancelled.` });
    } catch (err: any) {
      toast({ title: "Error Cancelling Request", description: err.message, variant: "destructive" });
    } finally {
      setIsActionPending(false);
    }
  };

  const handleDeleteRequest = async () => {
    if (!requestData) return;
    setIsActionPending(true);
    try {
      const response = await fetch(`/api/accommodation/requests/${requestId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to delete accommodation request.");
      }
      toast({ title: "Accommodation Request Deleted", description: `Accommodation request ID ${requestId} has been permanently deleted.` });
      router.push("/accommodation");
    } catch (err: any) {
      toast({ title: "Error Deleting Request", description: err.message, variant: "destructive" });
      setIsActionPending(false);
    }
  };

  const canEdit = requestData && EDITABLE_STATUSES.includes(requestData.status) && !TERMINAL_STATUSES.includes(requestData.status);
  const canCancel = requestData && CANCELLABLE_STATUSES.includes(requestData.status) && !TERMINAL_STATUSES.includes(requestData.status);
  const canDelete = requestData && DELETABLE_STATUSES.includes(requestData.status) && !TERMINAL_STATUSES.includes(requestData.status);

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-6">
        <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading accommodation request details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="max-w-4xl mx-auto my-8">
        <CardHeader>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <CardTitle>Error</CardTitle>
          </div>
          <CardDescription>
            There was a problem loading the accommodation request details.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-destructive mb-4">{error}</p>
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!requestData) {
    return (
      <Card className="max-w-4xl mx-auto my-8">
        <CardHeader>
          <div className="flex items-center gap-2 mb-2">
            <Bed className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Accommodation Request Not Found</CardTitle>
          </div>
          <CardDescription>
            The accommodation request you're looking for could not be found.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => router.push('/accommodation')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Accommodation Dashboard
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full min-h-screen bg-muted/50 py-2 px-2 print:py-0 print:px-0">
      <Card className="w-full shadow print:shadow-none print:border-none">
        <CardHeader className="w-full bg-muted/30 print:bg-transparent print:p-0 px-2 py-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:flex-row print:items-start w-full">
            <div className="w-full">
              <CardTitle className="flex items-center gap-2 text-xl print:text-2xl">
                <Bed className="w-6 h-6 text-primary print:text-black" />
                Accommodation Request Details
              </CardTitle>
              <CardDescription className="print:text-sm">
                Viewing Accommodation Request ID: {requestData.id} - Status: <span className="font-semibold">{requestData.status}</span>
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2 print:hidden w-full sm:w-auto justify-end">
              <Button variant="outline" onClick={() => router.back()}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              {canEdit && (
                <Button variant="outline" onClick={() => router.push(`/accommodation/edit/${requestId}`)}>
                  <Edit className="mr-2 h-4 w-4" /> Edit Request
                </Button>
              )}
              {canCancel && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={isActionPending}>
                      <Ban className="mr-2 h-4 w-4" /> Cancel Request
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirm Cancellation</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to cancel accommodation request {requestId}? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={isActionPending}>Back</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={handleCancelRequest} 
                        disabled={isActionPending} 
                        className="bg-destructive hover:bg-destructive/90"
                      >
                        {isActionPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Confirm Cancel
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              {canDelete && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={isActionPending}>
                      <Trash2 className="mr-2 h-4 w-4" /> Delete Request
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete accommodation request {requestId}? This action is permanent and cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={isActionPending}>Back</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={handleDeleteRequest} 
                        disabled={isActionPending} 
                        className="bg-destructive hover:bg-destructive/90"
                      >
                        {isActionPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Confirm Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              <Button onClick={handlePrint}>
                <Printer className="mr-2 h-4 w-4" /> Print / Save as PDF
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>
      <div className="w-full mt-2">
        <AccommodationRequestDetailsView requestData={requestData} />
      </div>
    </div>
  );
}
