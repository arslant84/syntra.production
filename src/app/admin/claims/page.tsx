
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ReceiptText, ListFilter, Search, AlertCircle, CheckCircle, XCircle, Clock, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { useState, useEffect } from "react";
import { format } from "date-fns";

type Claim = {
  id: string;
  requestor: string;
  purpose: string;
  amount: number;
  status: string;
  submittedDate: string;
  trfId?: string;
};


export default function AdminClaimsPage() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  useEffect(() => {
    const fetchClaims = async () => {
      try {
        setLoading(true);
        console.log('Fetching claims from API for admin...');
        const response = await fetch('/api/claims');
        
        if (!response.ok) {
          throw new Error(`Error fetching claims: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Fetched claims data:', data);
        
        // Handle both array response and nested claims property
        const claimsData = Array.isArray(data) ? data : data.claims;
        
        if (claimsData && Array.isArray(claimsData)) {
          setClaims(claimsData);
        } else {
          console.warn('No valid claims data found');
          setClaims([]);
        }
      } catch (err) {
        console.error('Failed to fetch claims:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch claims');
      } finally {
        setLoading(false);
      }
    };

    fetchClaims();
  }, []);

  // Filter claims based on status and search query
  const filteredClaims = claims.filter(claim => {
    // Status filter
    if (statusFilter && statusFilter !== 'all' && claim.status.toLowerCase() !== statusFilter.toLowerCase()) {
      return false;
    }
    
    // Search query filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        claim.id.toLowerCase().includes(query) ||
        claim.requestor.toLowerCase().includes(query) ||
        claim.purpose.toLowerCase().includes(query) ||
        (claim.trfId && claim.trfId.toLowerCase().includes(query))
      );
    }
    
    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'approved':
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" /> {status}</Badge>;
      case 'rejected':
        return <Badge className="bg-red-500"><XCircle className="w-3 h-3 mr-1" /> {status}</Badge>;
      case 'pending verification':
      case 'pending approval':
        return <Badge className="bg-yellow-500"><Clock className="w-3 h-3 mr-1" /> {status}</Badge>;
      default:
        return <Badge className="bg-gray-500">{status}</Badge>;
    }
  };
  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <ReceiptText className="w-8 h-8 text-primary" />
            Claims Administration
          </h1>
          <p className="text-muted-foreground">
            Review, verify, and process staff expense claims.
          </p>
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Search & Filter Claims</CardTitle>
          <CardDescription>Find specific claims or filter by status, department, etc.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col md:flex-row gap-3">
            <div className="relative w-full md:flex-grow">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                type="search" 
                placeholder="Search by Claim ID, TRF ID, Name..." 
                className="pl-8 w-full" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <ListFilter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Filter by Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending verification">Pending Verification</SelectItem>
                <SelectItem value="pending approval">Pending Approval</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              className="w-full md:w-auto"
              onClick={() => {
                setStatusFilter("");
                setSearchQuery("");
              }}
              variant="outline"
            >
              Clear Filters
            </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Submitted Claims</CardTitle>
          <CardDescription>List of expense claims submitted for processing.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-40 text-red-500">
              <AlertCircle className="w-12 h-12 mb-3" />
              <p>Error: {error}</p>
            </div>
          ) : filteredClaims.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Claim ID</TableHead>
                  <TableHead>TRF ID</TableHead>
                  <TableHead>Requestor</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClaims.map((claim) => (
                  <TableRow key={claim.id}>
                    <TableCell className="font-medium">{claim.id.substring(0, 8)}</TableCell>
                    <TableCell>
                      {claim.trfId ? (
                        <Link href={`/trf/view/${claim.trfId}`} className="text-primary hover:underline">
                          {claim.trfId}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">N/A</span>
                      )}
                    </TableCell>
                    <TableCell>{claim.requestor}</TableCell>
                    <TableCell>RM {claim.amount.toFixed(2)}</TableCell>
                    <TableCell>
                      {claim.submittedDate ? format(new Date(claim.submittedDate), 'dd MMM yyyy') : '-'}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(claim.status)}
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/admin/claims/view/${claim.id}`}>
                          <FileText className="w-4 h-4 mr-1" /> View Details
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center h-40 border-2 border-dashed rounded-lg">
              <ReceiptText className="w-12 h-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No claims found based on current filters.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
