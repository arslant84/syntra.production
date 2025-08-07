"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Calendar, MapPin, Clock, Users, FileText, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { TransportRequestForm } from '@/types/transport';

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
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Draft':
        return 'bg-gray-100 text-gray-800';
      case 'Pending Department Focal':
      case 'Pending Line Manager':
      case 'Pending HOD':
        return 'bg-yellow-100 text-yellow-800';
      case 'Approved':
        return 'bg-green-100 text-green-800';
      case 'Rejected':
        return 'bg-red-100 text-red-800';
      case 'Cancelled':
        return 'bg-gray-100 text-gray-800';
      case 'Processing':
        return 'bg-blue-100 text-blue-800';
      case 'Completed':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Approved':
      case 'Completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'Rejected':
      case 'Cancelled':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'Pending Department Focal':
      case 'Pending Line Manager':
      case 'Pending HOD':
      case 'Processing':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />;
    }
  };

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
          <div className="flex items-center gap-2">
            {getStatusIcon(transportRequest.status)}
            <Badge className={getStatusColor(transportRequest.status)}>
              {transportRequest.status}
            </Badge>
          </div>
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
              <p className="text-lg">{transportRequest.position}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Cost Center</p>
              <p className="text-lg">{transportRequest.costCenter}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Contact</p>
              <p className="text-lg">{transportRequest.telEmail}</p>
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
                  <Badge variant="outline">{detail.transportType} - {detail.vehicleType}</Badge>
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

      {/* Approval Workflow */}
      <Card>
        <CardHeader>
          <CardTitle>Approval Workflow</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {transportRequest.approvalWorkflow?.map((step, index) => (
              <div key={index} className="flex items-center gap-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  step.status === 'Approved' ? 'bg-green-100 text-green-600' :
                  step.status === 'Rejected' ? 'bg-red-100 text-red-600' :
                  step.status === 'Current' ? 'bg-blue-100 text-blue-600' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {step.status === 'Approved' ? <CheckCircle className="h-4 w-4" /> :
                   step.status === 'Rejected' ? <XCircle className="h-4 w-4" /> :
                   step.status === 'Current' ? <AlertCircle className="h-4 w-4" /> :
                   <div className="w-2 h-2 rounded-full bg-gray-400" />}
                </div>
                <div className="flex-1">
                  <p className="font-medium">{step.role}</p>
                  <p className="text-sm text-gray-600">{step.name}</p>
                  {step.date && (
                    <p className="text-xs text-gray-500">{formatDate(step.date)}</p>
                  )}
                  {step.comments && (
                    <p className="text-sm text-gray-600 mt-1">{step.comments}</p>
                  )}
                </div>
                <Badge className={getStatusColor(step.status)}>
                  {step.status}
                </Badge>
              </div>
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