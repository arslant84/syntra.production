"use client";

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, X, MapPin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { TransportRequestForm, TransportDetails, TransportType, VehicleType } from '@/types/transport';

export default function NewTransportRequestPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const [formData, setFormData] = useState<Partial<TransportRequestForm>>({
    purpose: '',
    transportDetails: [],
    additionalComments: '',
    confirmPolicy: false,
    confirmManagerApproval: false,
    confirmTermsAndConditions: false,
    requestorName: '',
    staffId: '',
    department: '',
    position: ''
  });

  const transportTypes: TransportType[] = ['Local', 'Intercity', 'Airport Transfer', 'Charter', 'Other'];

  // Fetch user details when component mounts
  useEffect(() => {
    const fetchUserDetails = async () => {
      if (!session?.user) {
        console.log('No session or user available');
        return;
      }

      console.log('Fetching user details, session:', session);

      try {
        const response = await fetch('/api/user-details');
        console.log('User details response status:', response.status);
        
        if (response.ok) {
          const userDetails = await response.json();
          console.log('User details received:', userDetails);
          
          setFormData(prev => ({
            ...prev,
            requestorName: userDetails.requestorName || '',
            staffId: userDetails.staffId || '',
            department: userDetails.department || '',
            position: userDetails.position || ''
          }));
        } else {
          const errorData = await response.json();
          console.error('Error response from user-details API:', errorData);
        }
      } catch (error) {
        console.error('Error fetching user details:', error);
      }
    };

    fetchUserDetails();
  }, [session]);

  const addTransportDetail = () => {
    const newDetail: TransportDetails = {
      date: null,
      day: '',
      from: '',
      to: '',
      departureTime: '',
      transportType: 'Local',
      numberOfPassengers: 1,
    };

    setFormData(prev => ({
      ...prev,
      transportDetails: [...(prev.transportDetails || []), newDetail]
    }));
  };

  const removeTransportDetail = (index: number) => {
    setFormData(prev => ({
      ...prev,
      transportDetails: prev.transportDetails?.filter((_, i) => i !== index) || []
    }));
  };

  const updateTransportDetail = (index: number, field: keyof TransportDetails, value: any) => {
    setFormData(prev => ({
      ...prev,
      transportDetails: prev.transportDetails?.map((detail, i) => {
        if (i === index) {
          const updatedDetail = { ...detail, [field]: value };
          if (field === 'date' && value) {
            const date = new Date(value);
            updatedDetail.day = date.toLocaleDateString('en-US', { weekday: 'long' });
          }
          return updatedDetail;
        }
        return detail;
      })
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const userId = session?.user?.id || session?.user?.email;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Basic validation
      if (!formData.purpose?.trim()) {
        throw new Error('Purpose is required');
      }

      if (!formData.transportDetails || formData.transportDetails.length === 0) {
        throw new Error('At least one transport detail is required');
      }

      const requestPayload = { 
        ...formData, 
        userId
      };
      const response = await fetch('/api/transport', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('API Error Response:', {
          status: response.status,
          statusText: response.statusText,
          body: errorData
        });
        throw new Error(`Failed to create transport request: ${response.status} - ${errorData}`);
      }

      const result = await response.json();
      // Add success toast
      toast({
        title: "Transport Request Submitted!",
        description: `Transport Request ID ${result.id} processed successfully.`,
        variant: "default",
      });
      router.push(`/transport/view/${result.id}`);
    } catch (error: any) { // Add : any for type safety
      console.error('Error creating transport request:', error);
      // Refined error toast
      toast({
        title: "Error Submitting Transport Request",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  

  return (
    <div className="container mx-auto p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900">New Transport Request</h1>
          <Button variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-6">
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
                      value={formData.requestorName}
                      onChange={(e) => setFormData(prev => ({ ...prev, requestorName: e.target.value }))}
                      placeholder="Enter your full name"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="staffId">Staff ID</Label>
                    <Input
                      id="staffId"
                      value={formData.staffId}
                      onChange={(e) => setFormData(prev => ({ ...prev, staffId: e.target.value }))}
                      placeholder="Enter your staff ID"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="department">Department</Label>
                    <Input
                      id="department"
                      value={formData.department}
                      onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
                      placeholder="Enter your department"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="position">Position</Label>
                    <Input
                      id="position"
                      value={formData.position}
                      onChange={(e) => setFormData(prev => ({ ...prev, position: e.target.value }))}
                      placeholder="Enter your position"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Purpose */}
            <Card>
              <CardHeader>
                <CardTitle>Request Purpose</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="purpose">Purpose of Transport Request</Label>
                    <Textarea
                      id="purpose"
                      value={formData.purpose}
                      onChange={(e) => setFormData(prev => ({ ...prev, purpose: e.target.value }))}
                      placeholder="Describe the purpose of this transport request..."
                      required
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Transport Details */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Transport Details</CardTitle>
                  <Button type="button" onClick={addTransportDetail} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Transport Detail
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {formData.transportDetails?.map((detail, index) => (
                    <div key={index} className="border rounded-lg p-4 space-y-4">
                      <div className="flex justify-between items-center">
                        <h4 className="font-semibold">Transport Detail #{index + 1}</h4>
                        <Button
                          type="button"
                          variant="outline"
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
                        <div>
                          <Label>From</Label>
                          <Input
                            value={detail.from}
                            onChange={(e) => updateTransportDetail(index, 'from', e.target.value)}
                            placeholder="Departure location"
                            required
                          />
                        </div>
                        <div>
                          <Label>To</Label>
                          <Input
                            value={detail.to}
                            onChange={(e) => updateTransportDetail(index, 'to', e.target.value)}
                            placeholder="Destination location"
                            required
                          />
                        </div>
                        <div>
                          <Label>Departure Time</Label>
                          <Input
                            type="time"
                            value={detail.departureTime}
                            onChange={(e) => updateTransportDetail(index, 'departureTime', e.target.value)}
                          />
                        </div>
                        
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
                              {transportTypes.map(type => (
                                <SelectItem key={type} value={type}>{type}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
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

                  {formData.transportDetails?.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <MapPin className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p>No transport details added yet.</p>
                      <p className="text-sm">Click "Add Transport Detail" to get started.</p>
                    </div>
                  )}
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
                  value={formData.additionalComments}
                  onChange={(e) => setFormData(prev => ({ ...prev, additionalComments: e.target.value }))}
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
                      checked={formData.confirmPolicy}
                      onChange={(e) => setFormData(prev => ({ ...prev, confirmPolicy: e.target.checked }))}
                      className="rounded"
                    />
                    <Label htmlFor="confirmPolicy">I confirm that this request complies with company transport policy</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="confirmManagerApproval"
                      checked={formData.confirmManagerApproval}
                      onChange={(e) => setFormData(prev => ({ ...prev, confirmManagerApproval: e.target.checked }))}
                      className="rounded"
                    />
                    <Label htmlFor="confirmManagerApproval">I confirm that my line manager has approved this request</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="confirmTermsAndConditions"
                      checked={formData.confirmTermsAndConditions}
                      onChange={(e) => setFormData(prev => ({ ...prev, confirmTermsAndConditions: e.target.checked }))}
                      className="rounded"
                    />
                    <Label htmlFor="confirmTermsAndConditions">I agree to the terms and conditions</Label>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Submit Button */}
            <div className="flex justify-end gap-4">
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Creating...' : 'Create Transport Request'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
} 