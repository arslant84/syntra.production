'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { AccommodationRequestDetails, LocationType } from '@/types/accommodation';

export default function EditAccommodationRequestPage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = use(params);
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [accommodationRequest, setAccommodationRequest] = useState<AccommodationRequestDetails | null>(null);

  const locations: LocationType[] = ['Ashgabat', 'Kiyanly', 'Turkmenbashy'];
  const roomTypes = ['Single Room', 'Shared - Male', 'Shared - Female', 'Other'];

  useEffect(() => {
    fetchAccommodationRequest();
  }, [requestId]);

  const fetchAccommodationRequest = async () => {
    try {
      const response = await fetch(`/api/accommodation/requests/${requestId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch accommodation request');
      }
      const data = await response.json();
      setAccommodationRequest(data.accommodationRequest);
    } catch (error) {
      console.error('Error fetching accommodation request:', error);
      toast({
        title: 'Error',
        description: 'Failed to load accommodation request',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accommodationRequest) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/accommodation/requests/${requestId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          location: accommodationRequest.location,
          requestedCheckInDate: accommodationRequest.requestedCheckInDate,
          requestedCheckOutDate: accommodationRequest.requestedCheckOutDate,
          requestedRoomType: accommodationRequest.requestedRoomType,
          specialRequests: accommodationRequest.specialRequests,
          flightArrivalTime: accommodationRequest.flightArrivalTime,
          flightDepartureTime: accommodationRequest.flightDepartureTime,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update accommodation request');
      }

      toast({
        title: 'Success',
        description: 'Accommodation request updated successfully',
      });

      router.push('/accommodation');
    } catch (error) {
      console.error('Error updating accommodation request:', error);
      toast({
        title: 'Error',
        description: 'Failed to update accommodation request',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof AccommodationRequestDetails, value: any) => {
    if (!accommodationRequest) return;
    setAccommodationRequest({ ...accommodationRequest, [field]: value });
  };

  const formatDateForInput = (date: Date | string) => {
    if (!date) return '';
    const dateObj = date instanceof Date ? date : new Date(date);
    if (isNaN(dateObj.getTime())) return '';
    return dateObj.toISOString().split('T')[0];
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center space-x-2 mb-6">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">Loading...</h1>
        </div>
      </div>
    );
  }

  if (!accommodationRequest) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center space-x-2 mb-6">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">Accommodation Request Not Found</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center space-x-2 mb-6">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">Edit Accommodation Request</h1>
        <Badge variant="outline">{accommodationRequest.status}</Badge>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Requestor Information */}
        <Card>
          <CardHeader>
            <CardTitle>Requestor Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Full Name</Label>
                <Input
                  value={accommodationRequest.requestorName}
                  disabled
                  className="bg-gray-50"
                />
              </div>
              <div>
                <Label>Staff ID</Label>
                <Input
                  value={accommodationRequest.requestorId}
                  disabled
                  className="bg-gray-50"
                />
              </div>
              <div>
                <Label>Department</Label>
                <Input
                  value={accommodationRequest.department}
                  disabled
                  className="bg-gray-50"
                />
              </div>
              <div>
                <Label>Gender</Label>
                <Input
                  value={accommodationRequest.requestorGender}
                  disabled
                  className="bg-gray-50"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Accommodation Details */}
        <Card>
          <CardHeader>
            <CardTitle>Accommodation Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="location">Location</Label>
                  <Select
                    value={accommodationRequest.location}
                    onValueChange={(value) => updateField('location', value as LocationType)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map((location) => (
                        <SelectItem key={location} value={location}>
                          {location}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="requestedRoomType">Room Type</Label>
                  <Select
                    value={accommodationRequest.requestedRoomType || ''}
                    onValueChange={(value) => updateField('requestedRoomType', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select room type" />
                    </SelectTrigger>
                    <SelectContent>
                      {roomTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="checkInDate">Check-In Date</Label>
                  <Input
                    id="checkInDate"
                    type="date"
                    value={formatDateForInput(accommodationRequest.requestedCheckInDate)}
                    onChange={(e) => updateField('requestedCheckInDate', new Date(e.target.value))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="checkOutDate">Check-Out Date</Label>
                  <Input
                    id="checkOutDate"
                    type="date"
                    value={formatDateForInput(accommodationRequest.requestedCheckOutDate)}
                    onChange={(e) => updateField('requestedCheckOutDate', new Date(e.target.value))}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="arrivalTime">Flight Arrival Time</Label>
                  <Input
                    id="arrivalTime"
                    type="time"
                    value={accommodationRequest.flightArrivalTime || ''}
                    onChange={(e) => updateField('flightArrivalTime', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="departureTime">Flight Departure Time</Label>
                  <Input
                    id="departureTime"
                    type="time"
                    value={accommodationRequest.flightDepartureTime || ''}
                    onChange={(e) => updateField('flightDepartureTime', e.target.value)}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Special Requests */}
        <Card>
          <CardHeader>
            <CardTitle>Special Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={accommodationRequest.specialRequests || ''}
              onChange={(e) => updateField('specialRequests', e.target.value)}
              placeholder="Any special requests or requirements..."
            />
          </CardContent>
        </Card>

        {/* Submit Button */}
        <div className="flex justify-end space-x-4">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Update Accommodation Request'}
          </Button>
        </div>
      </form>
    </div>
  );
} 