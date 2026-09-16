import { useState, useMemo, useEffect } from 'react';
import { CalendarOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import type { CalendarEvent, EventType } from '@/api/contracts/calendar';
import { CalendarHeader, type CalendarView } from './components/CalendarHeader';
import { MonthView } from './components/MonthView';
import { WeekView } from './components/WeekView';
import { DayView } from './components/DayView';
import { AgendaView } from './components/AgendaView';
import { EventDetailDrawer } from './components/EventDetailDrawer';
import { CreateEventModal } from './components/CreateEventModal';
import { ConnectGoogleBanner } from './components/ConnectGoogleBanner';
import {
  calendarKeys,
  useCalendarEvents,
  useCalendarSyncStatus,
} from './hooks/useCalendarEvents';
import {
  startOfMonth, endOfMonth, startOfWeek, addDays,
  addWeeks, addMonths,
} from './utils';
import { Skeleton } from '@/components/ui/skeleton';

function getQueryRange(view: CalendarView, date: Date): { start: string; end: string } {
  if (view === 'month' || view === 'agenda') {
    const s = startOfMonth(date);
    const e = endOfMonth(date);
    s.setDate(s.getDate() - 7); // include leading days
    e.setDate(e.getDate() + 7); // include trailing days
    return { start: s.toISOString(), end: e.toISOString() };
  }
  if (view === 'week') {
    const s = startOfWeek(date);
    return { start: s.toISOString(), end: addDays(s, 6).toISOString() };
  }
  // day
  const s = new Date(date);
  s.setHours(0, 0, 0, 0);
  const e = new Date(date);
  e.setHours(23, 59, 59, 999);
  return { start: s.toISOString(), end: e.toISOString() };
}

export function CalendarPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [view, setView] = useState<CalendarView>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filterType, setFilterType] = useState<EventType | 'all'>('all');
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null);
  const [initialDate, setInitialDate] = useState<Date | undefined>();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const google = params.get('google');
    if (google === 'connected') {
      toast.success('Google Calendar connected.');
      qc.invalidateQueries({ queryKey: calendarKeys.syncStatus });
      window.history.replaceState({}, '', '/calendar');
    } else if (google === 'error') {
      toast.error('Google Calendar connection failed.', {
        description: params.get('message') ?? undefined,
      });
      window.history.replaceState({}, '', '/calendar');
    }
  }, [qc]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('calendar-events')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'calendar_events' },
        () => {
          qc.invalidateQueries({ queryKey: calendarKeys.all });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, qc]);

  const range = useMemo(() => getQueryRange(view, currentDate), [view, currentDate]);
  const params = useMemo(() => ({
    ...range,
    ...(filterType !== 'all' ? { event_type: filterType } : {}),
  }), [range, filterType]);

  const { data: events = [], isLoading } = useCalendarEvents(params);
  const { data: syncStatus } = useCalendarSyncStatus();

  const handlePrev = () => {
    if (view === 'month' || view === 'agenda') setCurrentDate(d => addMonths(d, -1));
    else if (view === 'week') setCurrentDate(d => addWeeks(d, -1));
    else setCurrentDate(d => addDays(d, -1));
  };

  const handleNext = () => {
    if (view === 'month' || view === 'agenda') setCurrentDate(d => addMonths(d, 1));
    else if (view === 'week') setCurrentDate(d => addWeeks(d, 1));
    else setCurrentDate(d => addDays(d, 1));
  };

  const openCreate = (date?: Date) => {
    setEditEvent(null);
    setInitialDate(date);
    setModalOpen(true);
  };

  const openEdit = (ev: CalendarEvent) => {
    setSelectedEvent(null);
    setEditEvent(ev);
    setModalOpen(true);
  };

  const openDuplicate = (ev: CalendarEvent) => {
    setSelectedEvent(null);
    setEditEvent(null);
    setInitialDate(new Date(ev.start_at));
    setModalOpen(true);
  };

  const handleDayClick = (date: Date) => {
    if (view === 'month') {
      setCurrentDate(date);
      setView('day');
    } else {
      openCreate(date);
    }
  };

  return (
    <div className="p-6 max-w-[1600px] flex flex-col h-full" style={{ minHeight: 'calc(100vh - 0px)' }}>
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">Calendar</h1>
        <p className="text-sm text-muted-foreground">Schedule and manage meetings for your firms and team.</p>
      </div>

      <ConnectGoogleBanner
        syncStatus={syncStatus}
        onDisconnected={() => qc.invalidateQueries({ queryKey: calendarKeys.syncStatus })}
      />

      <CalendarHeader
        view={view}
        onViewChange={setView}
        currentDate={currentDate}
        onPrev={handlePrev}
        onNext={handleNext}
        onToday={() => setCurrentDate(new Date())}
        onNewEvent={() => openCreate()}
        filterType={filterType}
        onFilterType={setFilterType}
      />

      {isLoading ? (
        <div className="space-y-2 flex-1">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
        </div>
      ) : events.length === 0 && view !== 'month' ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground border rounded-lg">
          <CalendarOff className="h-12 w-12" />
          <p className="text-sm font-medium">No events scheduled</p>
          <Button size="sm" onClick={() => openCreate(currentDate)}>Create your first event</Button>
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          {view === 'month' && (
            <MonthView
              currentDate={currentDate}
              events={events}
              onEventClick={setSelectedEvent}
              onDayClick={handleDayClick}
            />
          )}
          {view === 'week' && (
            <WeekView
              currentDate={currentDate}
              events={events}
              onEventClick={setSelectedEvent}
              onSlotClick={openCreate}
            />
          )}
          {view === 'day' && (
            <DayView
              currentDate={currentDate}
              events={events}
              onEventClick={setSelectedEvent}
              onSlotClick={openCreate}
            />
          )}
          {view === 'agenda' && (
            <AgendaView events={events} onEventClick={setSelectedEvent} />
          )}
        </div>
      )}

      <EventDetailDrawer
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        onEdit={openEdit}
        onDuplicate={openDuplicate}
      />

      <CreateEventModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditEvent(null); }}
        initialDate={initialDate}
        editEvent={editEvent}
      />
    </div>
  );
}
