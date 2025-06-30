import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BedDouble, PlusCircle, Eye, Loader2 } from 'lucide-react';
import type { AccommodationRequestDetails } from '@/types/accommodation';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { getAccommodationRequests } from '@/lib/accommodation-service';

const getStatusBadgeVariant = (status: AccommodationRequestDetails['status']) => {
  switch (status) {
    case 'Confirmed': return 'default'; // Green
    case 'Rejected': return 'destructive';
    case 'Pending Assignment': return 'outline';
    case 'Blocked': return 'secondary';
    default: return 'secondary';
  }
};


export default async function AccommodationRequestsPage() {
  // Fetch accommodation requests from the database
  // Note: In a real app with authentication, you would filter by user ID
  const accommodationRequests = await getAccommodationRequests();
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BedDouble className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">My Accommodation Requests</h1>
        </div>
        <Link href="/accommodation/request" passHref> {/* Placeholder link for new request */}
          <Button>
            <PlusCircle className="mr-2 h-5 w-5" /> Request New Accommodation
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Submitted Requests</CardTitle>
          <CardDescription>List of your accommodation requests and their current status.</CardDescription>
        </CardHeader>
        <CardContent>
          {accommodationRequests.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Request ID</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accommodationRequests.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell className="font-medium">{req.id}</TableCell>
                    <TableCell>{req.location}</TableCell>
                    <TableCell>
                      {format(req.requestedCheckInDate, 'PPP')} - {format(req.requestedCheckOutDate, 'PPP')}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(req.status)} className={req.status === "Confirmed" ? "bg-green-600 text-white" : ""}>
                        {req.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{format(req.submittedDate, 'PPP')}</TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/accommodation/view/${req.id}`} className="flex items-center">
                           <Eye className="mr-1.5 h-4 w-4" /> View Details
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg">
              <BedDouble className="w-16 h-16 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No accommodation requests found.</p>
              <p className="text-sm text-muted-foreground">Click "Request New Accommodation" to get started.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
