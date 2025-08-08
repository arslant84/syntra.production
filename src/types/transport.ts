export type TransportRequestStatus = 
  | 'Draft' 
  | 'Pending Department Focal' 
  | 'Pending Line Manager' 
  | 'Pending HOD' 
  | 'Approved' 
  | 'Rejected' 
  | 'Cancelled'
  | 'Processing'
  | 'Completed';

export type TransportType = 'Local' | 'Intercity' | 'Airport Transfer' | 'Charter' | 'Other';



export interface TransportRequestorInformation {
  requestorName: string;
  staffId: string;
  department: string;
  position: string;
}

export interface TransportDetails {
  id?: string;
  date: Date | null;
  day: string;
  from: string;
  to: string;
  departureTime: string;
  transportType: TransportType;
  numberOfPassengers: number;
}

export interface TransportRequestData {
  requestorName?: string;
  staffId?: string;
  department?: string;
  position?: string;
  
  purpose: string;
  transportDetails: TransportDetails[];
  tsrReference?: string; // Reference to TSR if created from TSR
}

export interface TransportApprovalSubmissionData {
  additionalComments: string;
  confirmPolicy: boolean;
  confirmManagerApproval: boolean;
  confirmTermsAndConditions?: boolean;
}

export interface TransportRequestForm extends TransportRequestData, TransportApprovalSubmissionData {
  id: string;
  status: TransportRequestStatus;
  approvalWorkflow: TransportApprovalStep[];
  submittedAt?: Date | string;
  updatedAt?: Date | string;
  createdBy?: string;
  updatedBy?: string;
}

export interface TransportApprovalStep {
  role: string; // e.g., 'Requestor', 'Line Manager', 'Department Focal', 'HOD'
  name: string;
  status: 'Current' | 'Pending' | 'Approved' | 'Rejected' | 'Not Started' | 'Cancelled' | 'Submitted';
  date?: Date | string;
  comments?: string;
}

export interface TransportRequestSummary {
  id: string;
  requestorName: string;
  department: string;
  purpose: string;
  status: TransportRequestStatus;
  submittedAt?: Date | string;
  tsrReference?: string;
} 