import type { Attendee, CalendarEvent } from '@/api/contracts/calendar';
import type { Database } from '@/integrations/supabase/types';

export type CalendarEventRow = Database['public']['Tables']['calendar_events']['Row'];

export function formatApplicationRef(applicationId: string): string {
  return `APP-${applicationId.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

export function rowToCalendarEvent(row: CalendarEventRow): CalendarEvent {
  const attendees = Array.isArray(row.attendees)
    ? (row.attendees as Attendee[])
    : [];

  return {
    id: row.id,
    google_event_id: row.google_event_id,
    user_id: row.user_id,
    firm_id: row.firm_id,
    firm_name: row.firm_name,
    application_id: row.application_id,
    application_ref: row.application_ref,
    title: row.title,
    description: row.description,
    event_type: row.event_type as CalendarEvent['event_type'],
    start_at: row.start_at,
    end_at: row.end_at,
    timezone: row.timezone,
    attendees,
    status: row.status as CalendarEvent['status'],
    is_recurring: row.is_recurring,
    recurrence_rule: row.recurrence_rule,
    location: row.location,
    meeting_url: row.meeting_url,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
