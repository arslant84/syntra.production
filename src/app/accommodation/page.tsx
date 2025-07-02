"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BedDouble, PlusCircle, Eye, Loader2 } from 'lucide-react';
import type { AccommodationRequestDetails } from '@/types/accommodation';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { FilterBar } from '@/components/ui/FilterBar';

const getStatusBadgeVariant = (status: AccommodationRequestDetails['status']) => {
  switch (status) {
    case 'Confirmed': return 'default'; // Green
    case 'Rejected': return 'destructive';
    case 'Pending Assignment': return 'outline';
    case 'Blocked': return 'secondary';
    default: return 'secondary';
  }
};

export default function AccommodationRequestsPage() {
  const [accommodationRequests, setAccommodationRequests] = useState<AccommodationRequestDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [locationFilter, setLocationFilter] = useState("ALL");

  useEffect(() => {
    const fetchRequests = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/accommodation/requests');
        if (!response.ok) throw new Error('Failed to fetch accommodation requests');
        const data = await response.json();
        setAccommodationRequests(data.accommodationRequests || []);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch accommodation requests');
        setAccommodationRequests([]);
      } finally {
        setLoading(false);
      }
    };
    fetchRequests();
  }, []);

  // Filtering logic
  const filteredRequests = accommodationRequests.filter((req) => {
    const matchesSearch =
      searchTerm === "" ||
      (req.id && req.id.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (req.location && req.location.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === "ALL" || req.status === statusFilter;
    const matchesLocation = locationFilter === "ALL" || req.location === locationFilter;
    return matchesSearch && matchesStatus && matchesLocation;
  });

  // Collect unique locations for filter dropdown
  const locationOptions = Array.from(new Set(accommodationRequests.map(r => r.location)))
    .map(loc => ({ value: loc, label: loc }));

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BedDouble className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">My Accommodation Requests</h1>
        </div>
        <Link href="/accommodation/request" passHref>
          <Button>
            <PlusCircle className="mr-2 h-5 w-5" /> Request New Accommodation
          </Button>
        </Link>
      </div>

      {/* Filter Bar */}
      <FilterBar
        searchPlaceholder="Search by Request ID, Location..."
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        statusOptions={[
          { value: "ALL", label: "All Statuses" },
          { value: "Confirmed", label: "Confirmed" },
          { value: "Pending Assignment", label: "Pending Assignment" },
          { value: "Rejected", label: "Rejected" },
          { value: "Blocked", label: "Blocked" },
        ]}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        typeOptions={[{ value: "ALL", label: "All Locations" }, ...locationOptions]}
        typeFilter={locationFilter}
        onTypeFilterChange={setLocationFilter}
      />

      {/* Accommodation Requests Card */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BedDouble className="h-5 w-5" />
            Submitted Requests
          </CardTitle>
          <CardDescription>List of your accommodation requests and their current status.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="animate-spin w-12 h-12 text-primary" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-64 text-red-500">
              <p>Error: {error}</p>
            </div>
          ) : filteredRequests.length > 0 ? (
            <div className="overflow-x-auto">
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
                  {filteredRequests.map((req) => (
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
            </div>
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
