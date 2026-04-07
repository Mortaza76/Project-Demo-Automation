export type WorkflowStatus =
  | 'NEW'
  | 'EMAIL_SENT'
  | 'SLOT_RECEIVED'
  | 'RESCHEDULE_REQUESTED'
  | 'EVENT_CREATED'
  | 'CONFIRMED'
  | 'FAILED';

export type Product = 'CRM' | 'MediFusion' | 'DocuHub' | 'SkyUp';

export interface Lead {
  id: number;
  full_name: string;
  email: string;
  organization: string;
  products_json: string;
  status: WorkflowStatus;
  response_token: string;
  requested_date: string | null;
  requested_time: string | null;
  timezone: string;
  event_idempotency_key: string;
  google_event_id: string | null;
  google_meet_link: string | null;
  created_at: string;
  updated_at: string;
}
