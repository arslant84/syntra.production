
"use client";

import React from 'react';
import { useParams } from 'next/navigation';
import ClaimView from '@/components/claims/ClaimView';
import type { ExpenseClaim } from '@/types/claims';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, FileSpreadsheet, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { parseISO } from 'date-fns';



export default function ViewClaimPage() {
  const params = useParams();
  const claimId = params.claimId as string;
  const [claimData, setClaimData] = React.useState<ExpenseClaim | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchClaimData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        console.log(`Fetching claim details for ID: ${claimId}`);
        
        // Use the claimId parameter to fetch from the API
        const response = await fetch(`/api/claims/${claimId}`);
        console.log('API response status:', response.status);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch claim: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Claim details:', data);
        
        // Process the claim data
        let claimData: ExpenseClaim;
        
        // Check if the data is wrapped in a claimData property
        if (data.claimData) {
          console.log('Found claim data in response:', data.claimData);
          claimData = data.claimData;
        } else {
          console.log('No claim data wrapper found, using response directly');
          claimData = data;
        }
        
        // Process dates in the claim data
        if (claimData.headerDetails?.claimForMonthOf && typeof claimData.headerDetails.claimForMonthOf === 'string') {
          claimData.headerDetails.claimForMonthOf = parseISO(claimData.headerDetails.claimForMonthOf);
        }
        
        if (claimData.declaration?.date && typeof claimData.declaration.date === 'string') {
          claimData.declaration.date = parseISO(claimData.declaration.date);
        }
        
        // Process expense items dates
        if (claimData.expenseItems && Array.isArray(claimData.expenseItems)) {
          claimData.expenseItems = claimData.expenseItems.map(item => ({
            ...item,
            date: item.date && typeof item.date === 'string' ? parseISO(item.date) : item.date
          }));
        }
        
        // Process foreign exchange rate dates
        if (claimData.informationOnForeignExchangeRate && Array.isArray(claimData.informationOnForeignExchangeRate)) {
          claimData.informationOnForeignExchangeRate = claimData.informationOnForeignExchangeRate.map(fx => ({
            ...fx,
            date: fx.date && typeof fx.date === 'string' ? parseISO(fx.date) : fx.date
          }));
        }
        
        setClaimData(claimData);
      } catch (err) {
        console.error('Failed to fetch claim details:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch claim details');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchClaimData();
  }, [claimId]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground">Loading Claim Details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 px-4 text-center">
        <Card className="max-w-lg mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center justify-center gap-2 text-destructive">
              <AlertTriangle className="w-6 h-6" /> Error Loading Claim
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (!claimData) {
     return (
      <div className="container mx-auto py-8 px-4 text-center">
        <Card className="max-w-lg mx-auto">
          <CardHeader>
            <CardTitle>Claim Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p>The requested Claim (ID: {claimId}) could not be found or loaded.</p>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      <Card className="shadow-xl print:shadow-none">
        <CardHeader className="bg-muted/30 print:bg-transparent">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl print:text-2xl">
                <FileSpreadsheet className="w-6 h-6 text-primary print:text-black" />
                Staff Expense Claim Details
              </CardTitle>
              <CardDescription className="print:text-sm">Viewing Claim ID: {claimData.id}</CardDescription>
            </div>
            <Button 
              onClick={() => alert('PDF export functionality to be implemented.')}
              className="print:hidden"
            >
              Print to PDF (Placeholder)
            </Button>
          </div>
        </CardHeader>
      </Card>
      <ClaimView claimData={claimData} />
    </div>
  );
}
