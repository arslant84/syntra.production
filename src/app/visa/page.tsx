"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StickyNote, PlusCircle, Eye, Loader2 } from 'lucide-react';
import type { VisaApplication, VisaStatus } from '@/types/visa';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';

// Helper function to determine badge variant based on visa status
const getStatusBadgeVariant = (status: VisaStatus) => {
  switch (status) {
    case 'Approved': return 'default'; // Green
    case 'Rejected': return 'destructive';
    case 'Pending Department Focal':
    case 'Pending Line Manager/HOD':
    case 'Pending Visa Clerk':
    case 'Processing with Embassy':
      return 'outline'; // Yellowish/Orange outline
    default: return 'secondary';
  }
};

export default function VisaApplicationsPage() {
  const [visaApplications, setVisaApplications] = useState<VisaApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Fetch visa applications from the API
  useEffect(() => {
    const fetchVisaApplications = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const response = await fetch('/api/visa');
        
        if (!response.ok) {
          let errorMessage = `Failed to fetch visa applications: ${response.status}`;
          try {
            const errorData = await response.json();
            errorMessage = errorData.details || errorData.error || errorMessage;
          } catch (e) { /* Use default error message if parsing fails */ }
          throw new Error(errorMessage);
        }
        
        const data = await response.json();
        console.log('Fetched visa applications:', data);
        
        // Transform the data to match the VisaApplication type
        const formattedApps = data.visaApplications.map((app: any) => ({
          ...app,
          tripStartDate: app.tripStartDate ? new Date(app.tripStartDate) : null,
          tripEndDate: app.tripEndDate ? new Date(app.tripEndDate) : null,
          submittedDate: app.submittedDate ? new Date(app.submittedDate) : new Date(),
          lastUpdatedDate: app.lastUpdatedDate ? new Date(app.lastUpdatedDate) : new Date()
        }));
        
        setVisaApplications(formattedApps);
      } catch (err: any) {
        console.error('Error fetching visa applications:', err);
        setError(err.message || 'Failed to load visa applications');
        toast({
          title: 'Error',
          description: err.message || 'Failed to load visa applications',
          variant: 'destructive'
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchVisaApplications();
  }, [toast]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <StickyNote className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">My Visa Applications</h1>
        </div>
        <Link href="/visa/new" passHref>
          <Button>
            <PlusCircle className="mr-2 h-5 w-5" /> Apply for New Visa
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Submitted Applications</CardTitle>
          <CardDescription>List of your visa applications and their current status.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2">Loading visa applications...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg border-destructive/30">
              <p className="text-destructive">Error loading visa applications</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          ) : visaApplications.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Visa ID</TableHead>
                  <TableHead>Purpose</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead>Trip Dates</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visaApplications.map((app) => (
                  <TableRow key={app.id}>
                    <TableCell className="font-medium">{app.id}</TableCell>
                    <TableCell>{app.travelPurpose}</TableCell>
                    <TableCell>{app.destination || 'N/A'}</TableCell>
                    <TableCell>
                      {app.tripStartDate ? format(app.tripStartDate, 'PPP') : 'N/A'} - {app.tripEndDate ? format(app.tripEndDate, 'PPP') : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(app.status as VisaStatus)} className={app.status === "Approved" ? "bg-green-600 text-white" : ""}>
                        {app.status || "Unknown"}
                      </Badge>
                    </TableCell>
                    <TableCell>{app.submittedDate ? format(app.submittedDate, 'PPP') : 'N/A'}</TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/visa/view/${app.id}`} className="flex items-center">
                           <Eye className="mr-1.5 h-4 w-4" /> View
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg">
              <StickyNote className="w-16 h-16 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No visa applications found.</p>
              <p className="text-sm text-muted-foreground">Click "Apply for New Visa" to get started.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

