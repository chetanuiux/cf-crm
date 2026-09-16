export type EventType = 'demo' | 'discovery' | 'follow_up' | 'underwriting' | 'signing' | 'internal';
export type EventStatus = 'confirmed' | 'tentative' | 'cancelled';
export type ResponseStatus = 'accepted' | 'declined' | 'tentative' | 'pending';

export interface Attendee {
  email: string;
  name: string;
  response_status: ResponseStatus;
}

export interface CalendarEvent {
  id: string;
  google_event_id: string | null;
  user_id: string;
  firm_id: string | null;
  firm_name: string | null;
  application_id: string | null;
  application_ref: string | null;
  title: string;
  description: string;
  event_type: EventType;
  start_at: string;   // ISO 8601 UTC
  end_at: string;
  timezone: string;   // IANA
  attendees: Attendee[];
  status: EventStatus;
  is_recurring: boolean;
  recurrence_rule: string | null;
  location: string | null;
  meeting_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface ListParams {
  start: string;
  end: string;
  user_id?: string;
  firm_id?: string;
  event_type?: EventType;
}

export interface CalendarAPI {
  list(params: ListParams): Promise<CalendarEvent[]>;
  get(id: string): Promise<CalendarEvent>;
  create(event: Omit<CalendarEvent, 'id' | 'created_at' | 'updated_at' | 'google_event_id'>): Promise<CalendarEvent>;
  update(id: string, patch: Partial<CalendarEvent>): Promise<CalendarEvent>;
  delete(id: string): Promise<void>;
  checkConflicts(start: string, end: string, user_ids: string[]): Promise<CalendarEvent[]>;
  connectGoogle(): Promise<{ auth_url: string }>;
  disconnectGoogle(): Promise<void>;
  syncStatus(): Promise<{ connected: boolean; last_sync: string | null; email: string | null }>;
}
