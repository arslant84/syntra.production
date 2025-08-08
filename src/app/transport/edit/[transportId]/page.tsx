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
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Plus, X, MapPin, DollarSign, Users, Calendar, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { TransportRequestForm, TransportDetails, TransportType } from '@/types/transport';

export default function EditTransportRequestPage({ params }: { params: Promise<{ transportId: string }> }) {
  const { transportId } = use(params);
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [transportRequest, setTransportRequest] = useState<TransportRequestForm | null>(null);

  const transportTypes: TransportType[] = ['Local', 'Intercity', 'Airport Transfer', 'Charter', 'Other'];

  useEffect(() => {
    fetchTransportRequest();
  }, [transportId]);

  const fetchTransportRequest = async () => {
    try {
      const response = await fetch(`/api/transport/${transportId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch transport request');
      }
      const data = await response.json();
      setTransportRequest(data);
    } catch (error) {
      console.error('Error fetching transport request:', error);
      toast({
        title: 'Error',
        description: 'Failed to load transport request',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transportRequest) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/transport/${transportId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(transportRequest),
      });

      if (!response.ok) {
        throw new Error('Failed to update transport request');
      }

      toast({
        title: 'Success',
        description: 'Transport request updated successfully',
      });

      router.push('/transport');
    } catch (error) {
      console.error('Error updating transport request:', error);
      toast({
        title: 'Error',
        description: 'Failed to update transport request',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const addTransportDetail = () => {
    if (!transportRequest) return;

    const newDetail: TransportDetails = {
      date: null,
      day: '',
      from: '',
      to: '',
      departureTime: '',
      transportType: 'Local',
      numberOfPassengers: 1,
    };

    setTransportRequest({
      ...transportRequest,
      transportDetails: [...transportRequest.transportDetails, newDetail],
    });
  };

  const updateTransportDetail = (index: number, field: keyof TransportDetails, value: any) => {
    if (!transportRequest) return;

    const updatedDetails = [...transportRequest.transportDetails];
    updatedDetails[index] = { ...updatedDetails[index], [field]: value };

    setTransportRequest({
      ...transportRequest,
      transportDetails: updatedDetails,
    });
  };

  const removeTransportDetail = (index: number) => {
    if (!transportRequest) return;

    const updatedDetails = transportRequest.transportDetails.filter((_, i) => i !== index);
    setTransportRequest({
      ...transportRequest,
      transportDetails: updatedDetails,
    });
  };

  const updateField = (field: keyof TransportRequestForm, value: any) => {
    if (!transportRequest) return;
    setTransportRequest({ ...transportRequest, [field]: value });
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

  if (!transportRequest) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center space-x-2 mb-6">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">Transport Request Not Found</h1>
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
        <h1 className="text-2xl font-bold">Edit Transport Request</h1>
        <Badge variant="outline">{transportRequest.status}</Badge>
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
                <Label htmlFor="requestorName">Full Name</Label>
                <Input
                  id="requestorName"
                  value={transportRequest.requestorName || ''}
                  onChange={(e) => updateField('requestorName', e.target.value)}
                  placeholder="Enter your full name"
                  required
                />
              </div>
              <div>
                <Label htmlFor="staffId">Staff ID</Label>
                <Input
                  id="staffId"
                  value={transportRequest.staffId || ''}
                  onChange={(e) => updateField('staffId', e.target.value)}
                  placeholder="Enter your staff ID"
                  required
                />
              </div>
              <div>
                <Label htmlFor="department">Department</Label>
                <Input
                  id="department"
                  value={transportRequest.department || ''}
                  onChange={(e) => updateField('department', e.target.value)}
                  placeholder="Enter your department"
                  required
                />
              </div>
              <div>
                <Label htmlFor="position">Position</Label>
                <Input
                  id="position"
                  value={transportRequest.position || ''}
                  onChange={(e) => updateField('position', e.target.value)}
                  placeholder="Enter your position"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Purpose */}
        <Card>
          <CardHeader>
            <CardTitle>Purpose</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="purpose">Purpose of Transport Request</Label>
                <Textarea
                  id="purpose"
                  value={transportRequest.purpose}
                  onChange={(e) => updateField('purpose', e.target.value)}
                  placeholder="Describe the purpose of this transport request..."
                  className="mt-1"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Transport Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Transport Details
              <Button type="button" onClick={addTransportDetail} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Detail
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {transportRequest.transportDetails.map((detail, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Transport Detail #{index + 1}</h4>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeTransportDetail(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Date</Label>
                      <Input
                        type="date"
                        value={detail.date ? new Date(detail.date).toISOString().split('T')[0] : ''}
                        onChange={(e) => updateTransportDetail(index, 'date', e.target.value ? new Date(e.target.value) : null)}
                      />
                    </div>
                    <div>
                      <Label>Day</Label>
                      <Input
                        value={detail.day}
                        onChange={(e) => updateTransportDetail(index, 'day', e.target.value)}
                        placeholder="e.g., Monday"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>From</Label>
                      <Input
                        value={detail.from}
                        onChange={(e) => updateTransportDetail(index, 'from', e.target.value)}
                        placeholder="Departure location"
                      />
                    </div>
                    <div>
                      <Label>To</Label>
                      <Input
                        value={detail.to}
                        onChange={(e) => updateTransportDetail(index, 'to', e.target.value)}
                        placeholder="Destination location"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Departure Time</Label>
                      <Input
                        type="time"
                        value={detail.departureTime}
                        onChange={(e) => updateTransportDetail(index, 'departureTime', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Transport Type</Label>
                      <Select
                        value={detail.transportType}
                        onValueChange={(value) => updateTransportDetail(index, 'transportType', value as TransportType)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {transportTypes.map((type) => (
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
                      <Label>Number of Passengers</Label>
                      <Input
                        type="number"
                        min="1"
                        value={detail.numberOfPassengers}
                        onChange={(e) => updateTransportDetail(index, 'numberOfPassengers', parseInt(e.target.value))}
                      />
                    </div>
                  </div>

                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Additional Comments */}
        <Card>
          <CardHeader>
            <CardTitle>Additional Comments</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={transportRequest.additionalComments || ''}
              onChange={(e) => updateField('additionalComments', e.target.value)}
              placeholder="Any additional comments or special requirements..."
            />
          </CardContent>
        </Card>

        {/* Confirmations */}
        <Card>
          <CardHeader>
            <CardTitle>Confirmations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="confirmPolicy"
                  checked={transportRequest.confirmPolicy || false}
                  onChange={(e) => updateField('confirmPolicy', e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="confirmPolicy">I confirm that this request complies with company transport policy</Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="confirmManagerApproval"
                  checked={transportRequest.confirmManagerApproval || false}
                  onChange={(e) => updateField('confirmManagerApproval', e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="confirmManagerApproval">I confirm that my line manager has approved this request</Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Submit Button */}
        <div className="flex justify-end space-x-4">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Update Transport Request'}
          </Button>
        </div>
      </form>
    </div>
  );
} 