import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { supabase } from '@/integrations/supabase/client';
import { formatApplicationRef } from '@/lib/calendar-db';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertTriangle, X, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { CalendarEvent, EventType } from '@/api/contracts/calendar';
import { EVENT_TYPE_LABELS } from '../utils';
import { useCreateEvent, useUpdateEvent, useCheckConflicts } from '../hooks/useCalendarEvents';
import { useAuth } from '@/lib/auth';
import { excludeDemoRecords } from '@/lib/demo-data';

const TIMEZONES = [
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'America/Phoenix',
];

const schema = z.object({
  title: z.string().min(1, 'Title is required'),
  event_type: z.enum(['demo', 'discovery', 'follow_up', 'underwriting', 'signing', 'internal'] as const),
  start_at: z.string().min(1, 'Start time required'),
  end_at: z.string().min(1, 'End time required'),
  timezone: z.string().min(1),
  is_all_day: z.boolean(),
  firm_id: z.string().nullable(),
  application_id: z.string().nullable(),
  location: z.string().nullable(),
  meeting_url: z.string().nullable(),
  description: z.string(),
  is_recurring: z.boolean(),
}).refine(d => new Date(d.end_at) > new Date(d.start_at), {
  message: 'End time must be after start time',
  path: ['end_at'],
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  initialDate?: Date;
  editEvent?: CalendarEvent | null;
}

const localDatetimeValue = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function CreateEventModal({ open, onClose, initialDate, editEvent }: Props) {
  const { user } = useAuth();
  const { data: firms = [] } = useQuery({
    queryKey: ['calendar-firms'],
    queryFn: async () =>
      excludeDemoRecords(
        (await supabase.from('firms').select('id, name').eq('archived', false).order('name')).data,
      ),
    enabled: open,
  });
  const { data: applications = [] } = useQuery({
    queryKey: ['calendar-applications'],
    queryFn: async () =>
      excludeDemoRecords(
        (await supabase
          .from('client_applications')
          .select('id, client_name')
          .eq('archived', false)
          .order('updated_at', { ascending: false })
          .limit(200)).data,
      ),
    enabled: open,
  });
  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();
  const checkConflicts = useCheckConflicts();
  const [attendeeInput, setAttendeeInput] = useState('');
  const [attendees, setAttendees] = useState<{ email: string; name: string }[]>([]);
  const [conflicts, setConflicts] = useState<CalendarEvent[]>([]);
  const [showConflictWarning, setShowConflictWarning] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState<FormData | null>(null);

  const defaultStart = initialDate ?? new Date();
  if (!initialDate) { defaultStart.setHours(9, 0, 0, 0); }
  const defaultEnd = new Date(defaultStart);
  defaultEnd.setHours(defaultStart.getHours() + 1);

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: editEvent ? {
      title: editEvent.title,
      event_type: editEvent.event_type,
      start_at: localDatetimeValue(editEvent.start_at),
      end_at: localDatetimeValue(editEvent.end_at),
      timezone: editEvent.timezone,
      is_all_day: false,
      firm_id: editEvent.firm_id,
      application_id: editEvent.application_id,
      location: editEvent.location,
      meeting_url: editEvent.meeting_url,
      description: editEvent.description,
      is_recurring: editEvent.is_recurring,
    } : {
      title: '',
      event_type: 'demo' as EventType,
      start_at: localDatetimeValue(defaultStart.toISOString()),
      end_at: localDatetimeValue(defaultEnd.toISOString()),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Los_Angeles',
      is_all_day: false,
      firm_id: null,
      application_id: null,
      location: null,
      meeting_url: null,
      description: '',
      is_recurring: false,
    },
  });

  useEffect(() => {
    if (open) {
      setAttendees(editEvent ? editEvent.attendees.map(a => ({ email: a.email, name: a.name })) : []);
      setConflicts([]);
      setShowConflictWarning(false);
      setPendingSubmit(null);
    }
  }, [open, editEvent]);

  const addAttendee = () => {
    const val = attendeeInput.trim();
    if (!val || attendees.some(a => a.email === val)) return;
    setAttendees(prev => [...prev, { email: val, name: val.split('@')[0] }]);
    setAttendeeInput('');
  };

  const removeAttendee = (email: string) => setAttendees(prev => prev.filter(a => a.email !== email));

  const doSubmit = async (data: FormData) => {
    if (!user?.id) {
      toast.error('You must be signed in to save events.');
      return;
    }
    const firmInfo = firms.find(f => f.id === data.firm_id);
    const appInfo = applications.find(a => a.id === data.application_id);
    const payload = {
      user_id: user.id,
      title: data.title,
      event_type: data.event_type,
      start_at: new Date(data.start_at).toISOString(),
      end_at: new Date(data.end_at).toISOString(),
      timezone: data.timezone,
      firm_id: data.firm_id ?? null,
      firm_name: firmInfo?.name ?? null,
      application_id: data.application_id ?? null,
      application_ref: appInfo ? formatApplicationRef(appInfo.id) : null,
      location: data.location || null,
      meeting_url: data.meeting_url || null,
      description: data.description,
      status: 'confirmed' as const,
      is_recurring: data.is_recurring,
      recurrence_rule: null,
      attendees: attendees.map(a => ({ ...a, response_status: 'pending' as const })),
    };

    try {
      if (editEvent) {
        await updateEvent.mutateAsync({ id: editEvent.id, patch: payload });
        toast.success('Event updated.');
      } else {
        await createEvent.mutateAsync(payload);
        toast.success('Event created.');
      }
      onClose();
    } catch {
      toast.error('Failed to save event.');
    }
  };

  const onSubmit = async (data: FormData) => {
    if (user?.id) {
      const found = await checkConflicts.mutateAsync({
        start: new Date(data.start_at).toISOString(),
        end: new Date(data.end_at).toISOString(),
        user_ids: [user.id],
      });
      const relevant = editEvent ? found.filter(e => e.id !== editEvent.id) : found;
      if (relevant.length > 0) {
        setConflicts(relevant);
        setPendingSubmit(data);
        setShowConflictWarning(true);
        return;
      }
    }
    await doSubmit(data);
  };

  const isLoading = createEvent.isPending || updateEvent.isPending;

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editEvent ? 'Edit Event' : 'New Event'}</DialogTitle>
        </DialogHeader>

        {showConflictWarning && conflicts.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1 text-sm">
              <div className="font-medium text-amber-800 mb-1">
                {conflicts.length} conflict{conflicts.length > 1 ? 's' : ''} at this time
              </div>
              {conflicts.slice(0, 2).map(c => (
                <div key={c.id} className="text-amber-700 text-xs">{c.title}</div>
              ))}
              <div className="flex gap-2 mt-2">
                <Button size="sm" variant="outline" onClick={() => setShowConflictWarning(false)} className="h-7 text-xs">
                  Go back
                </Button>
                <Button size="sm" onClick={() => pendingSubmit && doSubmit(pendingSubmit)} className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white">
                  Schedule anyway
                </Button>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="title">Title *</Label>
            <Input id="title" {...register('title')} placeholder="Event title" className="mt-1" />
            {errors.title && <p className="text-xs text-destructive mt-1">{errors.title.message}</p>}
          </div>

          <div>
            <Label>Event Type *</Label>
            <Controller name="event_type" control={control} render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(EVENT_TYPE_LABELS) as EventType[]).map(t => (
                    <SelectItem key={t} value={t}>{EVENT_TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="start_at">Start *</Label>
              <Input id="start_at" type="datetime-local" {...register('start_at')} className="mt-1" />
              {errors.start_at && <p className="text-xs text-destructive mt-1">{errors.start_at.message}</p>}
            </div>
            <div>
              <Label htmlFor="end_at">End *</Label>
              <Input id="end_at" type="datetime-local" {...register('end_at')} className="mt-1" />
              {errors.end_at && <p className="text-xs text-destructive mt-1">{errors.end_at.message}</p>}
            </div>
          </div>

          <div>
            <Label>Timezone</Label>
            <Controller name="timezone" control={control} render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map(tz => (
                    <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Firm</Label>
              <Controller name="firm_id" control={control} render={({ field }) => (
                <Select value={field.value ?? 'none'} onValueChange={v => field.onChange(v === 'none' ? null : v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select firm" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {firms.map(f => (
                      <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )} />
            </div>
            <div>
              <Label>Application</Label>
              <Controller name="application_id" control={control} render={({ field }) => (
                <Select value={field.value ?? 'none'} onValueChange={v => field.onChange(v === 'none' ? null : v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select app" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {applications.map(a => (
                      <SelectItem key={a.id} value={a.id}>
                        {formatApplicationRef(a.id)} — {a.client_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )} />
            </div>
          </div>

          {/* Attendees */}
          <div>
            <Label>Attendees</Label>
            <div className="flex gap-2 mt-1">
              <Input
                value={attendeeInput}
                onChange={e => setAttendeeInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addAttendee(); } }}
                placeholder="email@example.com"
              />
              <Button type="button" variant="outline" size="icon" onClick={addAttendee}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {attendees.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {attendees.map(a => (
                  <span key={a.email} className="flex items-center gap-1 bg-muted text-xs px-2 py-1 rounded-full">
                    {a.email}
                    <button type="button" onClick={() => removeAttendee(a.email)}>
                      <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="location">Location</Label>
            <Input id="location" {...register('location')} placeholder="Address or room" className="mt-1" />
          </div>

          <div>
            <Label htmlFor="meeting_url">Meeting URL</Label>
            <Input id="meeting_url" {...register('meeting_url')} placeholder="https://zoom.us/j/..." className="mt-1" />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" {...register('description')} placeholder="Optional notes..." className="mt-1 resize-none" rows={3} />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Controller name="is_recurring" control={control} render={({ field }) => (
                <Switch checked={field.value} onCheckedChange={field.onChange} id="recurring" />
              )} />
              <Label htmlFor="recurring" className="cursor-pointer text-sm">
                Recurring event <span className="text-muted-foreground">(RRULE — coming soon)</span>
              </Label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={() => { reset(); onClose(); }}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="bg-primary text-primary-foreground">
              {isLoading ? 'Saving…' : editEvent ? 'Save Changes' : 'Create Event'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
