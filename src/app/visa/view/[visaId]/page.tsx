'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, AlertTriangle, ArrowLeft, Edit, Ban, Trash2, FileText, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { type VisaApplication } from '@/types/visa';
import VisaApplicationView from '@/components/visa/VisaApplicationView';

const EDITABLE_STATUSES: VisaApplication['status'][] = ["Pending Department Focal", "Rejected", "Draft"];
const CANCELLABLE_STATUSES: VisaApplication['status'][] = ["Pending Department Focal"];
const DELETABLE_STATUSES: VisaApplication['status'][] = ["Pending Department Focal", "Rejected", "Draft"];

export default function ViewVisaPage() {
  const params = useParams();
  const router = useRouter();
  const visaId = params.visaId as string;
  
  const [visaData, setVisaData] = useState<VisaApplication | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isActionPending, setIsActionPending] = useState(false);
  const [canManageDocuments, setCanManageDocuments] = useState(false);
  const { toast } = useToast();

  const fetchVisaDetails = useCallback(async () => {
    if (!visaId) return;
    console.log(`ViewVisaPage: Fetching visa details for ${visaId}.`);
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/visa/${visaId}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.details || `Failed to fetch visa application ${visaId}: ${response.statusText}`);
      }
      const result = await response.json();
      console.log('Fetched visa data:', result);
      // Handle both direct response and wrapped response
      const visaApplication = result.visaApplication || result;
      setVisaData(visaApplication as VisaApplication);
    } catch (err: any) {
      console.error("Error fetching visa details:", err);
      setError(err.message);
      setVisaData(null);
    } finally {
      setIsLoading(false);
    }
  }, [visaId]);

  const checkPermissions = useCallback(async () => {
    try {
      // Check if user has permission to manage visa documents
      const response = await fetch('/api/user/permissions');
      if (response.ok) {
        const data = await response.json();
        const permissions = data.permissions || [];
        const canManage = permissions.includes('process_visa_applications') || 
                         permissions.includes('manage_visa_documents');
        setCanManageDocuments(canManage);
      }
    } catch (error) {
      console.error('Error checking permissions:', error);
      // Default to false if permission check fails
      setCanManageDocuments(false);
    }
  }, []);

  useEffect(() => {
    fetchVisaDetails();
    checkPermissions();
  }, [fetchVisaDetails, checkPermissions]);

  const handleCancelVisa = async () => {
    if (!visaData) return;
    setIsActionPending(true);
    try {
      const response = await fetch(`/api/visa/${visaId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: "cancel" }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.details || "Failed to cancel visa application.");
      }
      const updatedVisa = await response.json();
      setVisaData(updatedVisa as VisaApplication);
      toast({ title: "Visa Application Cancelled", description: `Visa Application ID ${visaId} has been cancelled.` });
    } catch (err: any) {
      toast({ title: "Error Cancelling Visa Application", description: err.message, variant: "destructive" });
    } finally {
      setIsActionPending(false);
    }
  };

  const handleDeleteVisa = async () => {
    if (!visaData) return;
    setIsActionPending(true);
    try {
      const response = await fetch(`/api/visa/${visaId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.details || "Failed to delete visa application.");
      }
      toast({ title: "Visa Application Deleted", description: `Visa Application ID ${visaId} has been permanently deleted.` });
      router.push("/visa");
    } catch (err: any) {
      toast({ title: "Error Deleting Visa Application", description: err.message, variant: "destructive" });
      setIsActionPending(false);
    }
  };
  
  const canEdit = visaData && visaData.status && EDITABLE_STATUSES.includes(visaData.status);
  const canCancel = visaData && visaData.status && CANCELLABLE_STATUSES.includes(visaData.status);
  const canDelete = visaData && visaData.status && DELETABLE_STATUSES.includes(visaData.status);

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (<div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]"><Loader2 className="w-12 h-12 text-primary animate-spin mb-4" /><p className="text-muted-foreground">Loading Visa Application Details...</p></div>);
  }
  if (error) {
    return (<div className="space-y-8"><Card className="max-w-lg mx-auto shadow-lg"><CardHeader><CardTitle className="flex items-center justify-center gap-2 text-destructive"><AlertTriangle className="w-6 h-6" /> Error Loading Visa Application</CardTitle></CardHeader><CardContent><p>{error}</p><Button onClick={() => router.back()} className="mt-4"><ArrowLeft className="mr-2 h-4 w-4" /> Go Back</Button></CardContent></Card></div>);
  }
  if (!visaData) {
     return (<div className="space-y-8"><Card className="max-w-lg mx-auto shadow-lg"><CardHeader><CardTitle>Visa Application Not Found</CardTitle></CardHeader><CardContent><p>The requested visa application (ID: {visaId}) could not be found or loaded.</p><Button onClick={() => router.back()} className="mt-4"><ArrowLeft className="mr-2 h-4 w-4" /> Go Back</Button></CardContent></Card></div>);
  }
  
  return (
    <div className="w-full min-h-screen bg-muted/50 py-2 px-2 print:py-0 print:px-0">
      <Card className="w-full shadow print:shadow-none print:border-none">
        <CardHeader className="w-full bg-muted/30 print:bg-transparent print:p-0 px-2 py-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:flex-row print:items-start w-full">
            <div className="w-full">
              <CardTitle className="flex items-center gap-2 text-xl print:text-2xl">
                <FileText className="w-6 h-6 text-primary print:text-black" />Visa Application Details
              </CardTitle>
              <CardDescription className="print:text-sm">Viewing Visa Application ID: {visaData.id} - Status: <span className="font-semibold">{visaData.status}</span></CardDescription>
            </div>
            <div className="flex flex-wrap gap-2 print:hidden w-full sm:w-auto justify-end">
                <Button variant="outline" onClick={() => router.back()}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
                {canEdit && (<Button variant="outline" onClick={() => router.push(`/visa/edit/${visaId}`)}><Edit className="mr-2 h-4 w-4" /> Edit Visa</Button>)}
                {canCancel && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" disabled={isActionPending}><Ban className="mr-2 h-4 w-4" /> Cancel Visa</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Cancellation</AlertDialogTitle>
                        <AlertDialogDescription>Are you sure you want to cancel this visa application? This action cannot be undone.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={isActionPending}>Back</AlertDialogCancel>
                        <AlertDialogAction onClick={handleCancelVisa} disabled={isActionPending} className="bg-destructive hover:bg-destructive/90">
                          {isActionPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Confirm Cancel
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
                {canDelete && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" disabled={isActionPending}><Trash2 className="mr-2 h-4 w-4" /> Delete Visa</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
                        <AlertDialogDescription>Are you sure you want to delete this visa application? This action is permanent and cannot be undone.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={isActionPending}>Back</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteVisa} disabled={isActionPending} className="bg-destructive hover:bg-destructive/90">
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
        <VisaApplicationView visaData={visaData} canManageDocuments={canManageDocuments} />
      </div>
    </div>
  );
}