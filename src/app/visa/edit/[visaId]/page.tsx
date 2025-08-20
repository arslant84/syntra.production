"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import VisaApplicationForm from "@/components/visa/VisaApplicationForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { VisaApplication } from "@/types/visa";
import { StickyNote, Loader2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatISO } from 'date-fns';

export default function EditVisaApplicationPage() {
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const visaId = params.visaId as string;

  const [initialVisaData, setInitialVisaData] = useState<VisaApplication | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchVisaData = async () => {
      if (!visaId) return;
      setIsLoading(true);
      setError(null);
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
        
        if (data.visaApplication) {
          // Transform dates to Date objects for the form
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
          setInitialVisaData(formattedApp);
        } else {
          throw new Error(`Visa Application with ID ${visaId} not found.`);
        }
      } catch (err: any) {
        console.error('Error fetching visa application for edit:', err);
        setError(err.message || `Failed to load visa application with ID ${visaId}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchVisaData();
  }, [visaId]);

  const handleSubmitVisaApplication = async (data: Omit<VisaApplication, 'id' | 'userId' | 'submittedDate' | 'lastUpdatedDate' | 'status'>) => {
    try {
      const apiData = {
        applicantName: 'Test User',
        travelPurpose: data.travelPurpose,
        destination: data.destination || '',
        employeeId: data.employeeId,
        // nationality field removed since it doesn't exist in database
        visaType: data.travelPurpose === 'Business Trip' ? 'Business Visa' : 'Work Visa',
        tripStartDate: data.tripStartDate ? formatISO(data.tripStartDate) : null,
        tripEndDate: data.tripEndDate ? formatISO(data.tripEndDate) : null,
        passportNumber: data.passportNumber,
        passportExpiryDate: data.passportExpiryDate ? formatISO(data.passportExpiryDate, { representation: 'date' }) : null,
        itineraryDetails: data.itineraryDetails,
        supportingDocumentsNotes: data.supportingDocumentsNotes
      };

      console.log('Updating visa application via API:', apiData);
      
      const response = await fetch(`/api/visa/${visaId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(apiData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update visa application');
      }

      const result = await response.json();
      console.log('API Response:', result);

      toast({
        title: 'Visa Application Updated!',
        description: 'Your visa application has been successfully updated.',
        variant: 'default',
      });
      
      router.push(`/visa/view/${visaId}`);
    } catch (error) {
      console.error('Error updating visa application:', error);
      toast({
        title: 'Update Failed',
        description: error instanceof Error ? error.message : 'Failed to update visa application',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground">Loading Visa Application for Edit...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-8">
        <Card className="max-w-lg mx-auto shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center justify-center gap-2 text-destructive">
              <AlertTriangle className="w-6 h-6" /> Error Loading Application
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
            <Button onClick={() => router.back()} className="mt-4">
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!initialVisaData) {
    return (
      <div className="space-y-8">
        <Card className="max-w-lg mx-auto shadow-lg">
          <CardHeader>
            <CardTitle>Visa Application Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p>The requested Visa Application (ID: {visaId}) could not be found or loaded.</p>
            <Button onClick={() => router.back()} className="mt-4">
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full px-2 md:px-6 py-8 space-y-8">
      <Card className="w-full shadow-lg">
        <CardHeader className="bg-muted/30">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <StickyNote className="w-7 h-7 text-primary" />
                Edit Visa Application
              </CardTitle>
              <CardDescription>
                Modify the details of your visa application.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>
      <VisaApplicationForm
        initialData={initialVisaData}
        onSubmit={handleSubmitVisaApplication}
      />
    </div>
  );
}