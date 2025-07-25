
"use client";

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import VisaApplicationView from '@/components/visa/VisaApplicationView';
import type { VisaApplication } from '@/types/visa';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, ArrowLeft, FileText } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';

export default function ViewVisaApplicationDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const visaId = params.visaId as string;
  const [visaData, setVisaData] = React.useState<VisaApplication | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const { toast } = useToast();
  const [isActionPending, setIsActionPending] = React.useState(false);

  React.useEffect(() => {
    setIsLoading(true);
    setError(null);
    
    const fetchVisaData = async () => {
      try {
        const response = await fetch(`/api/visa/${visaId}`);
        
        if (!response.ok) {
          let errorMessage = `Failed to fetch visa application: ${response.status}`;
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.details || errorMessage;
          } catch (e) { /* Use default error message if parsing fails */ }
          throw new Error(errorMessage);
        }
        
        const data = await response.json();
        console.log('Fetched visa application:', data);
        
        if (data.visaApplication) {
          // Transform dates to Date objects
          const formattedApp = {
            ...data.visaApplication,
            tripStartDate: data.visaApplication.tripStartDate ? new Date(data.visaApplication.tripStartDate) : null,
            tripEndDate: data.visaApplication.tripEndDate ? new Date(data.visaApplication.tripEndDate) : null,
            submittedDate: data.visaApplication.submittedDate ? new Date(data.visaApplication.submittedDate) : new Date(),
            lastUpdatedDate: data.visaApplication.lastUpdatedDate ? new Date(data.visaApplication.lastUpdatedDate) : new Date(),
            approvalHistory: data.visaApplication.approvalHistory?.map((step: any) => ({
              ...step,
              date: step.date ? new Date(step.date) : undefined
            })) || []
          };
          
          setVisaData(formattedApp);
        } else {
          throw new Error(`Visa Application with ID ${visaId} not found.`);
        }
      } catch (err: any) {
        console.error('Error fetching visa application:', err);
        setError(err.message || `Failed to load visa application with ID ${visaId}`);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchVisaData();
  }, [visaId]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground">Loading Visa Application Details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 px-4 text-center">
        <Card className="max-w-lg mx-auto shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center justify-center gap-2 text-destructive">
              <AlertTriangle className="w-6 h-6" /> Error Loading Application
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
            <Button onClick={() => router.back()} className="mt-4">
              <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (!visaData) {
     return ( // Should be caught by error state, but as a fallback
      <div className="container mx-auto py-8 px-4 text-center">
        <Card className="max-w-lg mx-auto shadow-lg">
          <CardHeader>
            <CardTitle>Visa Application Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p>The requested Visa Application (ID: {visaId}) could not be found or loaded.</p>
            <Button onClick={() => router.back()} className="mt-4">
               <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  const handleEditVisa = () => {
    router.push(`/visa/edit/${visaData.id}`);
  };

  const handleCancelVisa = async () => {
    setIsActionPending(true);
    try {
      const response = await fetch(`/api/visa/${visaId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: "cancel", comments: "Cancelled by user." }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.details || "Failed to cancel visa application.");
      }
      toast({ title: "Visa Cancelled", description: `Visa Application ${visaId} has been cancelled.` });
      router.refresh();
    } catch (err: any) {
      toast({ title: "Error Cancelling Visa", description: err.message, variant: "destructive" });
    } finally {
      setIsActionPending(false);
    }
  };

  const handleDeleteVisa = async () => {
    setIsActionPending(true);
    try {
      const response = await fetch(`/api/visa/${visaId}`, { method: 'DELETE' });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.details || "Failed to delete visa application.");
      }
      toast({ title: "Visa Deleted", description: `Visa Application ${visaId} has been permanently deleted.` });
      router.push("/visa");
    } catch (err: any) {
      toast({ title: "Error Deleting Visa", description: err.message, variant: "destructive" });
      setIsActionPending(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="w-full min-h-screen bg-transparent py-2 px-2 space-y-6">
      <Card className="shadow-xl print:shadow-none mb-4">
        <CardContent className="flex flex-wrap gap-2 justify-end items-center p-4">
          <Button variant="outline" onClick={() => router.back()}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
          <Button variant="outline" onClick={handleEditVisa}><FileText className="mr-2 h-4 w-4" /> Edit Visa</Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={isActionPending}><span className="mr-2">🚫</span> Cancel Visa</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirm Cancellation</AlertDialogTitle>
                <AlertDialogDescription>Are you sure you want to cancel Visa Application {visaId}? This action cannot be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isActionPending}>Back</AlertDialogCancel>
                <AlertDialogAction onClick={handleCancelVisa} disabled={isActionPending} className="bg-destructive hover:bg-destructive/90">
                  {isActionPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Confirm Cancel
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={isActionPending}><span className="mr-2">🗑️</span> Delete Visa</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
                <AlertDialogDescription>Are you sure you want to delete Visa Application {visaId}? This action is permanent and cannot be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isActionPending}>Back</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteVisa} disabled={isActionPending} className="bg-destructive hover:bg-destructive/90">
                  {isActionPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Confirm Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button className="bg-teal-500 hover:bg-teal-600 text-white" onClick={handlePrint}><span className="mr-2">🖨️</span> Print / Save as PDF</Button>
        </CardContent>
      </Card>
      <Card className="shadow-xl print:shadow-none">
        <CardHeader className="bg-muted/30 print:bg-transparent">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl print:text-2xl">
                <FileText className="w-6 h-6 text-primary print:text-black" />
                Visa Application Details
              </CardTitle>
              <CardDescription className="print:text-sm">Viewing Application ID: {visaData.id} - Status: <span className="font-semibold">{visaData.status}</span></CardDescription>
            </div>
            <div className="flex gap-2">
                <Button variant="outline" onClick={() => router.back()} className="print:hidden">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <Button 
                onClick={() => alert('PDF export functionality to be implemented.')}
                className="print:hidden"
                disabled={visaData.status !== 'Approved'}
                >
                Export to PDF (Placeholder)
                </Button>
            </div>
          </div>
        </CardHeader>
      </Card>
      <div className="mt-6">
        <VisaApplicationView visaData={visaData} />
      </div>
    </div>
  );
}

