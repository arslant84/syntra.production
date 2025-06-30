"use client";

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import AccommodationRequestDetailsView from '@/components/accommodation/AccommodationRequestDetailsView';
import type { AccommodationRequestDetails } from '@/types/accommodation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, ArrowLeft, Bed } from 'lucide-react';


export default function ViewAccommodationRequestPage() {
  const params = useParams();
  const router = useRouter();
  const requestId = params.requestId as string;
  const [requestData, setRequestData] = React.useState<AccommodationRequestDetails | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

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
    <div className="container py-8 max-w-5xl">
      <div className="mb-6">
        <Button variant="outline" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Accommodation Request Details</h1>
        <p className="text-muted-foreground mt-1">
          View details for accommodation request <span className="font-medium">{requestData.id}</span>
        </p>
      </div>

      <AccommodationRequestDetailsView requestData={requestData} />
    </div>
  );
}
