"use client";

import { useParams, useRouter } from 'next/navigation';
import TransportRequestView from '@/components/transport/TransportRequestView';
import type { TransportRequestForm } from '@/types/transport';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Truck, Loader2, AlertTriangle, ArrowLeft, Edit, Ban, Printer, Trash2 } from 'lucide-react';
import React, { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

const EDITABLE_STATUSES: TransportRequestForm['status'][] = ["Pending Department Focal", "Rejected", "Draft"];
const CANCELLABLE_STATUSES: TransportRequestForm['status'][] = ["Pending Department Focal", "Pending Line Manager", "Pending HOD"];
const DELETABLE_STATUSES: TransportRequestForm['status'][] = ["Pending Department Focal", "Rejected", "Draft"];
const TERMINAL_OR_PROCESSING_STATUSES: TransportRequestForm['status'][] = ["Approved", "Cancelled", "Processing", "Completed"];

export default function ViewTransportRequestPage() {
  const params = useParams();
  const router = useRouter();
  const transportId = params.transportId as string;
  
  const [transportData, setTransportData] = useState<TransportRequestForm | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isActionPending, setIsActionPending] = React.useState(false);
  const { toast } = useToast();

  const fetchTransportDetails = useCallback(async () => {
    if (!transportId) return;
    console.log(`ViewTransportRequestPage: Fetching transport request details for ${transportId}.`);
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/transport/${transportId}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.details || `Failed to fetch transport request ${transportId}: ${response.statusText}`);
      }
      const result = await response.json();
      console.log('Transport API Response:', result);
      console.log('Transport Booking Details:', result.bookingDetails);
      setTransportData(result as TransportRequestForm);
    } catch (err: any) {
      console.error("Error fetching transport request details:", err);
      setError(err.message);
      setTransportData(null);
    } finally {
      setIsLoading(false);
    }
  }, [transportId]);

  useEffect(() => {
    fetchTransportDetails();
  }, [fetchTransportDetails]);

  const handleCancelTransportRequest = async () => {
    if (!transportData) return;
    setIsActionPending(true);
    try {
      const response = await fetch(`/api/transport/${transportId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...transportData,
          status: "Cancelled"
        }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.details || "Failed to cancel transport request.");
      }
      const updatedRequest = await response.json();
      setTransportData(updatedRequest as TransportRequestForm);
      toast({ title: "Transport Request Cancelled", description: `Transport request ID ${transportId} has been cancelled.` });
    } catch (err: any) {
      toast({ title: "Error Cancelling Transport Request", description: err.message, variant: "destructive" });
    } finally {
      setIsActionPending(false);
    }
  };

  const handleDeleteTransportRequest = async () => {
    if (!transportData) return;
    setIsActionPending(true);
    try {
      const response = await fetch(`/api/transport/${transportId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.details || "Failed to delete transport request.");
      }
      toast({ title: "Transport Request Deleted", description: `Transport request ID ${transportId} has been permanently deleted.` });
      router.push("/transport"); // Redirect to the transport list page
    } catch (err: any) {
      toast({ title: "Error Deleting Transport Request", description: err.message, variant: "destructive" });
      setIsActionPending(false);
    }
  };
  
  const canEdit = transportData && transportData.status && EDITABLE_STATUSES.includes(transportData.status) && !TERMINAL_OR_PROCESSING_STATUSES.includes(transportData.status);
  const canCancel = transportData && transportData.status && CANCELLABLE_STATUSES.includes(transportData.status) && !TERMINAL_OR_PROCESSING_STATUSES.includes(transportData.status);
  const canDelete = transportData && transportData.status && DELETABLE_STATUSES.includes(transportData.status) && !TERMINAL_OR_PROCESSING_STATUSES.includes(transportData.status);

  const getEditLink = () => {
    if (!transportData) return "/transport";
    return `/transport/edit/${transportId}`;
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (<div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]"><Loader2 className="w-12 h-12 text-primary animate-spin mb-4" /><p className="text-muted-foreground">Loading Transport Request Details...</p></div>);
  }
  if (error) {
    return (<div className="space-y-8"><Card className="max-w-lg mx-auto shadow-lg"><CardHeader><CardTitle className="flex items-center justify-center gap-2 text-destructive"><AlertTriangle className="w-6 h-6" /> Error Loading Transport Request</CardTitle></CardHeader><CardContent><p>{error}</p><Button onClick={() => router.back()} className="mt-4"><ArrowLeft className="mr-2 h-4 w-4" /> Go Back</Button></CardContent></Card></div>);
  }
  if (!transportData) {
     return (<div className="space-y-8"><Card className="max-w-lg mx-auto shadow-lg"><CardHeader><CardTitle>Transport Request Not Found</CardTitle></CardHeader><CardContent><p>The requested transport request (ID: {transportId}) could not be found or loaded.</p><Button onClick={() => router.back()} className="mt-4"><ArrowLeft className="mr-2 h-4 w-4" /> Go Back</Button></CardContent></Card></div>);
  }
  
  return (
    <div className="w-full min-h-screen bg-muted/50 py-2 px-2 print:py-0 print:px-0">
      <Card className="w-full shadow print:shadow-none print:border-none">
        <CardHeader className="w-full bg-muted/30 print:bg-transparent print:p-0 px-2 py-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:flex-row print:items-start w-full">
            <div className="w-full"><CardTitle className="flex items-center gap-2 text-xl print:text-2xl">
              <Truck className="w-6 h-6 text-primary print:text-black" />Transport Request Details</CardTitle>
            <CardDescription className="print:text-sm">Viewing Transport Request ID: {transportData.id} - Status: <span className="font-semibold">{transportData.status}</span></CardDescription></div>
            <div className="flex flex-wrap gap-2 print:hidden w-full sm:w-auto justify-end">
                <Button variant="outline" onClick={() => router.back()}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
                {canEdit && (<Button variant="outline" onClick={() => router.push(getEditLink())}><Edit className="mr-2 h-4 w-4" /> Edit Request</Button>)}
                {canCancel && (
                  <AlertDialog><AlertDialogTrigger asChild><Button variant="destructive" disabled={isActionPending}><Ban className="mr-2 h-4 w-4" /> Cancel Request</Button></AlertDialogTrigger>
                    <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Confirm Cancellation</AlertDialogTitle><AlertDialogDescription>Are you sure you want to cancel transport request {transportId}? This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={isActionPending}>Back</AlertDialogCancel><AlertDialogAction onClick={handleCancelTransportRequest} disabled={isActionPending} className="bg-destructive hover:bg-destructive/90">{isActionPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Confirm Cancel</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                  </AlertDialog>
                )}
                {canDelete && (
                  <AlertDialog><AlertDialogTrigger asChild><Button variant="destructive" disabled={isActionPending}><Trash2 className="mr-2 h-4 w-4" /> Delete Request</Button></AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
                        <AlertDialogDescription>Are you sure you want to delete transport request {transportId}? This action is permanent and cannot be undone.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={isActionPending}>Back</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteTransportRequest} disabled={isActionPending} className="bg-destructive hover:bg-destructive/90">
                          {isActionPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Confirm Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
                <Button onClick={handlePrint}><Printer className="mr-2 h-4 w-4" /> Print / Save as PDF</Button>
            </div>
          </div>
        </CardHeader>
      </Card>
      <div className="w-full mt-2">
        <TransportRequestView transportRequest={transportData} />
      </div>
    </div>
  );
}