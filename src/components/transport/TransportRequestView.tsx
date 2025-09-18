"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Calendar, MapPin, Clock, Users, FileText, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { TransportRequestForm } from '@/types/transport';
import { StatusBadge, WorkflowStep } from '@/lib/status-utils';

interface TransportRequestViewProps {
  transportRequest: TransportRequestForm;
  showActions?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

export default function TransportRequestView({ 
  transportRequest, 
  showActions = false, 
  onEdit, 
  onDelete 
}: TransportRequestViewProps) {
  // Removed getStatusColor and getStatusIcon functions - now using standardized StatusBadge component

  const formatDate = (dateString: string | Date) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (timeString: string) => {
    if (!timeString) return 'N/A';
    return timeString;
  };


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Transport Request</h1>
          <p className="text-gray-600 mt-2">ID: {transportRequest.id}</p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={transportRequest.status} showIcon />
          {showActions && (
            <div className="flex gap-2">
              {onEdit && (
                <Button variant="outline" onClick={onEdit}>
                  Edit
                </Button>
              )}
              {onDelete && (
                <Button variant="outline" className="text-red-600 hover:text-red-700" onClick={onDelete}>
                  Delete
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Requestor Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Requestor Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-600">Requestor Name</p>
              <p className="text-lg">{transportRequest.requestorName}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Staff ID</p>
              <p className="text-lg">{transportRequest.staffId || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Department</p>
              <p className="text-lg">{transportRequest.department}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Position</p>
              <p className="text-lg">{transportRequest.position || 'N/A'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Purpose */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Purpose
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-lg">{transportRequest.purpose}</p>
        </CardContent>
      </Card>

      {/* TSR Reference */}
      {transportRequest.tsrReference && (
        <Card>
          <CardHeader>
            <CardTitle>TSR Reference</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-medium">{transportRequest.tsrReference}</p>
          </CardContent>
        </Card>
      )}

      {/* Transport Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Transport Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {transportRequest.transportDetails?.map((detail, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-4">
                  <h4 className="text-lg font-semibold">Transport Detail #{index + 1}</h4>
                  <Badge variant="outline">{detail.transportType}</Badge>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-600">Date</p>
                      <p>{detail.date ? formatDate(detail.date) : 'N/A'}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-600">From</p>
                      <p>{detail.from}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-600">To</p>
                      <p>{detail.to}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-600">Departure Time</p>
                      <p>{formatTime(detail.departureTime)}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-600">Passengers</p>
                      <p>{detail.numberOfPassengers}</p>
                    </div>
                  </div>
                </div>
                
              </div>
            ))}
          </div>
        </CardContent>
      </Card>


      {/* Additional Comments */}
      {transportRequest.additionalComments && (
        <Card>
          <CardHeader>
            <CardTitle>Additional Comments</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{transportRequest.additionalComments}</p>
          </CardContent>
        </Card>
      )}

      {/* Transport Processing Details (for completed transport requests) */}
      {(transportRequest.status === 'Completed' || transportRequest.status === 'Processing with Transport Admin') && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-primary" />
              Transport Processing Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            {transportRequest.bookingDetails ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 p-4 rounded-lg bg-green-50 border border-green-200">
                {transportRequest.bookingDetails.vehicleType && (
                  <div>
                    <p className="text-sm font-medium text-gray-600">Vehicle Type</p>
                    <p className="text-sm">{transportRequest.bookingDetails.vehicleType}</p>
                  </div>
                )}
                {transportRequest.bookingDetails.vehicleNumber && (
                  <div>
                    <p className="text-sm font-medium text-gray-600">Vehicle Number</p>
                    <p className="text-sm">{transportRequest.bookingDetails.vehicleNumber}</p>
                  </div>
                )}
                {transportRequest.bookingDetails.driverName && (
                  <div>
                    <p className="text-sm font-medium text-gray-600">Driver Name</p>
                    <p className="text-sm">{transportRequest.bookingDetails.driverName}</p>
                  </div>
                )}
                {transportRequest.bookingDetails.driverContact && (
                  <div>
                    <p className="text-sm font-medium text-gray-600">Driver Contact</p>
                    <p className="text-sm">{transportRequest.bookingDetails.driverContact}</p>
                  </div>
                )}
                {transportRequest.bookingDetails.pickupTime && (
                  <div>
                    <p className="text-sm font-medium text-gray-600">Pickup Time</p>
                    <p className="text-sm">{formatTime(transportRequest.bookingDetails.pickupTime)}</p>
                  </div>
                )}
                {transportRequest.bookingDetails.dropoffTime && (
                  <div>
                    <p className="text-sm font-medium text-gray-600">Dropoff Time</p>
                    <p className="text-sm">{formatTime(transportRequest.bookingDetails.dropoffTime)}</p>
                  </div>
                )}
                {transportRequest.bookingDetails.actualRoute && (
                  <div className="sm:col-span-2 md:col-span-3">
                    <p className="text-sm font-medium text-gray-600">Actual Route</p>
                    <p className="text-sm">{transportRequest.bookingDetails.actualRoute}</p>
                  </div>
                )}
                {transportRequest.bookingDetails.bookingReference && (
                  <div>
                    <p className="text-sm font-medium text-gray-600">Booking Reference</p>
                    <p className="text-sm">{transportRequest.bookingDetails.bookingReference}</p>
                  </div>
                )}
                {transportRequest.bookingDetails.additionalNotes && (
                  <div className="sm:col-span-2 md:col-span-3">
                    <p className="text-sm font-medium text-gray-600">Transport Admin Notes</p>
                    <p className="text-sm">{transportRequest.bookingDetails.additionalNotes}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className={`p-4 rounded-lg border ${transportRequest.status === 'Completed' ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}`}>
                <p className={`text-sm font-medium ${transportRequest.status === 'Completed' ? 'text-green-700' : 'text-blue-700'}`}>
                  {transportRequest.status === 'Completed'
                    ? '✅ This transport request has been processed and completed.'
                    : '🔄 This transport request is currently being processed by the Transport Administrator.'}
                </p>
                <p className={`text-xs mt-1 ${transportRequest.status === 'Completed' ? 'text-green-600' : 'text-blue-600'}`}>
                  {transportRequest.status === 'Completed'
                    ? 'Transport arrangements have been finalized. Please contact the Transport Administrator for specific vehicle and driver information.'
                    : 'Transport booking is in progress. Vehicle and driver details will be updated once arrangements are confirmed.'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Approval Workflow */}
      <Card>
        <CardHeader>
          <CardTitle>Approval Workflow</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {transportRequest.approvalWorkflow?.map((step, index) => (
              <WorkflowStep 
                key={index} 
                step={step} 
                index={index} 
                formatDateSafe={formatDate}
                showStatusBadge={true}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Confirmations */}
      <Card>
        <CardHeader>
          <CardTitle>Confirmations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {transportRequest.confirmPolicy ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600" />
              )}
              <span>Policy compliance confirmed</span>
            </div>
            <div className="flex items-center gap-2">
              {transportRequest.confirmManagerApproval ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600" />
              )}
              <span>Manager approval confirmed</span>
            </div>
            <div className="flex items-center gap-2">
              {transportRequest.confirmTermsAndConditions ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600" />
              )}
              <span>Terms and conditions agreed</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timestamps */}
      <Card>
        <CardHeader>
          <CardTitle>Timestamps</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-600">Submitted</p>
              <p>{transportRequest.submittedAt ? formatDate(transportRequest.submittedAt) : 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Last Updated</p>
              <p>{transportRequest.updatedAt ? formatDate(transportRequest.updatedAt) : 'N/A'}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 