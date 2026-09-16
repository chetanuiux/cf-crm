import type { CalendarAPI, CalendarEvent, ListParams } from '../contracts/calendar';
import { supabase } from '@/integrations/supabase/client';
import {
  formatApplicationRef,
  rowToCalendarEvent,
  type CalendarEventRow,
} from '@/lib/calendar-db';
import { excludeDemoRecords } from '@/lib/demo-data';

async function requireUserId(): Promise<string> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Not authenticated');
  return user.id;
}

async function resolveDenormalized(
  firmId: string | null | undefined,
  applicationId: string | null | undefined,
  existing?: { firm_name?: string | null; application_ref?: string | null },
) {
  let firm_name = existing?.firm_name ?? null;
  let application_ref = existing?.application_ref ?? null;

  if (firmId) {
    const { data } = await supabase.from('firms').select('name').eq('id', firmId).maybeSingle();
    firm_name = data?.name ?? firm_name;
  } else if (firmId === null) {
    firm_name = null;
  }

  if (applicationId) {
    application_ref = formatApplicationRef(applicationId);
  } else if (applicationId === null) {
    application_ref = null;
  }

  return { firm_name, application_ref };
}

function throwIfError(error: { message: string } | null, context: string) {
  if (error) throw new Error(`${context}: ${error.message}`);
}

export const calendarReal: CalendarAPI = {
  async list({ start, end, user_id, firm_id, event_type }: ListParams) {
    let query = supabase
      .from('calendar_events')
      .select('*')
      .gte('start_at', start)
      .lte('start_at', end)
      .order('start_at', { ascending: true });

    if (user_id) query = query.eq('user_id', user_id);
    if (firm_id) query = query.eq('firm_id', firm_id);
    if (event_type) query = query.eq('event_type', event_type);

    const { data, error } = await query;
    throwIfError(error, 'list');
    return excludeDemoRecords(data ?? []).map(row => rowToCalendarEvent(row as CalendarEventRow));
  },

  async get(id: string) {
    const { data, error } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('id', id)
      .single();
    throwIfError(error, 'get');
    return rowToCalendarEvent(data as CalendarEventRow);
  },

  async create(event) {
    const userId = await requireUserId();
    const { firm_name, application_ref } = await resolveDenormalized(
      event.firm_id,
      event.application_id,
      { firm_name: event.firm_name, application_ref: event.application_ref },
    );

    const row = {
      ...event,
      user_id: userId,
      firm_name,
      application_ref,
      attendees: event.attendees as unknown as CalendarEventRow['attendees'],
    };

    const { data, error } = await supabase
      .from('calendar_events')
      .insert(row)
      .select()
      .single();
    throwIfError(error, 'create');
    return rowToCalendarEvent(data as CalendarEventRow);
  },

  async update(id: string, patch: Partial<CalendarEvent>) {
    const { firm_name, application_ref } = await resolveDenormalized(
      patch.firm_id,
      patch.application_id,
      { firm_name: patch.firm_name, application_ref: patch.application_ref },
    );

    const updatePayload: Record<string, unknown> = { ...patch };
    if (patch.firm_id !== undefined || patch.application_id !== undefined) {
      updatePayload.firm_name = firm_name;
      updatePayload.application_ref = application_ref;
    }
    if (patch.attendees) {
      updatePayload.attendees = patch.attendees;
    }
    delete updatePayload.id;
    delete updatePayload.created_at;
    delete updatePayload.google_event_id;

    const { data, error } = await supabase
      .from('calendar_events')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();
    throwIfError(error, 'update');
    return rowToCalendarEvent(data as CalendarEventRow);
  },

  async delete(id: string) {
    const { error } = await supabase.from('calendar_events').delete().eq('id', id);
    throwIfError(error, 'delete');
  },

  async checkConflicts(start: string, end: string, user_ids: string[]) {
    if (user_ids.length === 0) return [];

    const { data, error } = await supabase
      .from('calendar_events')
      .select('*')
      .in('user_id', user_ids)
      .neq('status', 'cancelled')
      .lt('start_at', end)
      .gt('end_at', start);
    throwIfError(error, 'checkConflicts');
    return excludeDemoRecords(data ?? []).map(row => rowToCalendarEvent(row as CalendarEventRow));
  },

  async connectGoogle() {
    await requireUserId();
    const { data, error } = await supabase.functions.invoke('google-calendar-connect', {
      method: 'POST',
    });
    if (error) throw error;
    const body = data as { auth_url?: string; error?: string };
    if (body?.error) throw new Error(body.error);
    if (!body?.auth_url) throw new Error('No authorization URL returned');
    return { auth_url: body.auth_url };
  },

  async disconnectGoogle() {
    await requireUserId();
    const { error } = await supabase.functions.invoke('google-calendar-disconnect', {
      method: 'POST',
    });
    if (error) throw error;
  },

  async syncStatus() {
    const userId = await requireUserId();
    const { data, error } = await supabase
      .from('google_calendar_connections')
      .select('email, last_sync')
      .eq('user_id', userId)
      .maybeSingle();
    throwIfError(error, 'syncStatus');
    if (!data) {
      return { connected: false, last_sync: null, email: null };
    }
    return {
      connected: true,
      last_sync: data.last_sync,
      email: data.email,
    };
  },
};
