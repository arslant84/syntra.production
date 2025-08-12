export interface NotificationTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export type NotificationEventType = 
  | 'new_transport_request'
  | 'transport_request_approved'
  | 'transport_request_rejected'
  | 'new_trf_request'
  | 'trf_request_approved'
  | 'trf_request_rejected'
  | 'new_claim'
  | 'claim_approved'
  | 'claim_rejected'
  | 'new_accommodation_request'
  | 'accommodation_request_approved'
  | 'accommodation_request_rejected';

export interface NotificationTemplateFormValues {
  name: string;
  subject: string;
  body: string;
}