
"use client";

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import TrfView from '@/components/trf/TrfView';
import type { TravelRequestForm } from '@/types/trf';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileSpreadsheet, Loader2, AlertTriangle, ArrowLeft, Edit, Ban, Printer } from 'lucide-react';
import React, { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

const EDITABLE_STATUSES: TravelRequestForm['status'][] = ["Pending Department Focal", "Rejected", "Draft"];
const CANCELLABLE_STATUSES: TravelRequestForm['status'][] = ["Pending Department Focal", "Pending Line Manager", "Pending HOD"];
const TERMINAL_OR_PROCESSING_STATUSES: TravelRequestForm['status'][] = ["Approved", "Cancelled", "TRF Processed", "Processing Flights", "Processing Accommodation", "Awaiting Visa"];


export default function ViewTRFPage() {
  const params = useParams();
  const router = useRouter();
  const trfId = params.trfId as string;
  
  const [trfData, setTrfData] = useState<TravelRequestForm | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isActionPending, setIsActionPending] = React.useState(false);
  const { toast } = useToast();

  const fetchTrfDetails = useCallback(async () => {
    if (!trfId) return;
    console.log(`ViewTRFPage: Fetching TRF details for ${trfId}.`);
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/trf/${trfId}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.details || `Failed to fetch TRF ${trfId}: ${response.statusText}`);
      }
      const result = await response.json();
      setTrfData(result.trf as TravelRequestForm);
    } catch (err: any) {
      console.error("Error fetching TRF details:", err);
      setError(err.message);
      setTrfData(null);
    } finally {
      setIsLoading(false);
    }
  }, [trfId]);

  useEffect(() => {
    fetchTrfDetails();
  }, [fetchTrfDetails]);

  const handleCancelTRF = async () => {
    if (!trfData) return;
    setIsActionPending(true);
    try {
      const response = await fetch(`/api/trf/${trfId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: "cancel", 
          comments: "Cancelled by user.",
          approverRole: "Requestor", // Or get actual user role if available
          approverName: trfData.requestorName || "User" // Or get actual user name
        }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.details || "Failed to cancel TRF.");
      }
      const updatedTrf = await response.json();
      setTrfData(updatedTrf.trf as TravelRequestForm);
      toast({ title: "TRF Cancelled", description: `TRF ID ${trfId} has been cancelled.` });
    } catch (err: any) {
      toast({ title: "Error Cancelling TRF", description: err.message, variant: "destructive" });
    } finally {
      setIsActionPending(false);
    }
  };
  
  const canEdit = trfData && trfData.status && EDITABLE_STATUSES.includes(trfData.status) && !TERMINAL_OR_PROCESSING_STATUSES.includes(trfData.status);
  const canCancel = trfData && trfData.status && CANCELLABLE_STATUSES.includes(trfData.status) && !TERMINAL_OR_PROCESSING_STATUSES.includes(trfData.status);

  const getEditLink = () => {
    if (!trfData) return "/trf";
    switch (trfData.travelType) {
      case "Domestic": return `/trf/new/domestic?editId=${trfId}`;
      case "Overseas": return `/trf/new/overseas?editId=${trfId}`;
      case "Home Leave Passage": return `/trf/new/home-leave?editId=${trfId}`;
      case "External Parties": return `/trf/new/external-parties?editId=${trfId}`;
      default: return "/trf";
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (<div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]"><Loader2 className="w-12 h-12 text-primary animate-spin mb-4" /><p className="text-muted-foreground">Loading TRF Details...</p></div>);
  }
  if (error) {
    return (<div className="container mx-auto py-8 px-4 text-center"><Card className="max-w-lg mx-auto shadow-lg"><CardHeader><CardTitle className="flex items-center justify-center gap-2 text-destructive"><AlertTriangle className="w-6 h-6" /> Error Loading TRF</CardTitle></CardHeader><CardContent><p>{error}</p><Button onClick={() => router.back()} className="mt-4"><ArrowLeft className="mr-2 h-4 w-4" /> Go Back</Button></CardContent></Card></div>);
  }
  if (!trfData) {
     return (<div className="container mx-auto py-8 px-4 text-center"><Card className="max-w-lg mx-auto shadow-lg"><CardHeader><CardTitle>TRF Not Found</CardTitle></CardHeader><CardContent><p>The requested TRF (ID: {trfId}) could not be found or loaded.</p><Button onClick={() => router.back()} className="mt-4"><ArrowLeft className="mr-2 h-4 w-4" /> Go Back</Button></CardContent></Card></div>);
  }
  
  return (
    <div className="container mx-auto py-8 px-4 space-y-8 print:py-0 print:px-0 print:space-y-4">
      <Card className="shadow-xl print:shadow-none print:border-none">
        <CardHeader className="bg-muted/30 print:bg-transparent print:p-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:flex-row print:items-start">
            <div><CardTitle className="flex items-center gap-2 text-xl print:text-2xl"><FileSpreadsheet className="w-6 h-6 text-primary print:text-black" />Travel Request Form Details</CardTitle><CardDescription className="print:text-sm">Viewing TRF ID: {trfData.id} - Status: <span className="font-semibold">{trfData.status}</span></CardDescription></div>
            <div className="flex flex-wrap gap-2 print:hidden">
                <Button variant="outline" onClick={() => router.back()}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
                {canEdit && (<Button variant="outline" onClick={() => router.push(getEditLink())}><Edit className="mr-2 h-4 w-4" /> Edit TRF</Button>)}
                {canCancel && (
                  <AlertDialog><AlertDialogTrigger asChild><Button variant="destructive" disabled={isActionPending}><Ban className="mr-2 h-4 w-4" /> Cancel TRF</Button></AlertDialogTrigger>
                    <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Confirm Cancellation</AlertDialogTitle><AlertDialogDescription>Are you sure you want to cancel TRF {trfId}? This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={isActionPending}>Back</AlertDialogCancel><AlertDialogAction onClick={handleCancelTRF} disabled={isActionPending} className="bg-destructive hover:bg-destructive/90">{isActionPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Confirm Cancel</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                  </AlertDialog>
                )}
                <Button onClick={handlePrint}><Printer className="mr-2 h-4 w-4" /> Print / Save as PDF</Button>
            </div>
          </div>
        </CardHeader>
      </Card>
      <TrfView trfData={trfData} />
    </div>
  );
}
