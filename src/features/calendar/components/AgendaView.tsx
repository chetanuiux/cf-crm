import type { CalendarEvent } from '@/api/contracts/calendar';
import { CalendarOff } from 'lucide-react';
import { isSameDay, formatEventTime, formatDuration } from '../utils';
import { EVENT_TYPE_COLORS, EVENT_TYPE_LABELS } from '../utils';
import { cn } from '@/lib/utils';

interface Props {
  events: CalendarEvent[];
  onEventClick: (e: CalendarEvent) => void;
}

function groupByDay(events: CalendarEvent[]): { day: Date; events: CalendarEvent[] }[] {
  const map = new Map<string, { day: Date; events: CalendarEvent[] }>();
  for (const ev of events) {
    const day = new Date(ev.start_at);
    day.setHours(0, 0, 0, 0);
    const key = day.toISOString();
    if (!map.has(key)) map.set(key, { day, events: [] });
    map.get(key)!.events.push(ev);
  }
  return Array.from(map.values()).sort((a, b) => a.day.getTime() - b.day.getTime());
}

export function AgendaView({ events, onEventClick }: Props) {
  const today = new Date();
  const sorted = [...events].sort((a, b) => a.start_at.localeCompare(b.start_at));
  const groups = groupByDay(sorted);

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-60 gap-3 text-muted-foreground">
        <CalendarOff className="h-10 w-10" />
        <p className="text-sm font-medium">No events scheduled</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map(({ day, events: dayEvents }) => {
        const isToday = isSameDay(day, today);
        const label = day.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

        return (
          <div key={day.toISOString()}>
            <div className={cn(
              'flex items-center gap-2 mb-2 pb-1 border-b',
              isToday ? 'border-primary/40' : 'border-border'
            )}>
              <span className={cn(
                'text-sm font-semibold',
                isToday ? 'text-primary' : 'text-foreground'
              )}>
                {isToday ? `Today — ${label}` : label}
              </span>
              <span className="text-xs text-muted-foreground ml-auto">{dayEvents.length} event{dayEvents.length > 1 ? 's' : ''}</span>
            </div>

            <div className="space-y-2">
              {dayEvents.map(ev => {
                const colors = EVENT_TYPE_COLORS[ev.event_type];
                return (
                  <button
                    key={ev.id}
                    onClick={() => onEventClick(ev)}
                    className={cn(
                      'w-full text-left flex items-start gap-3 px-3 py-2.5 rounded-lg border transition-opacity hover:opacity-80',
                      colors.bg, colors.border
                    )}
                  >
                    <div className={cn('w-1 rounded-full mt-1 shrink-0 self-stretch', colors.dot)} />
                    <div className="flex-1 min-w-0">
                      <div className={cn('font-medium text-sm truncate', colors.text)}>{ev.title}</div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs text-muted-foreground">
                          {formatEventTime(ev.start_at, ev.end_at, ev.timezone)}
                        </span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground">{formatDuration(ev.start_at, ev.end_at)}</span>
                        {ev.firm_name && (
                          <>
                            <span className="text-xs text-muted-foreground">·</span>
                            <span className="text-xs text-muted-foreground truncate">{ev.firm_name}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <span className={cn(
                      'text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0',
                      colors.bg, colors.text
                    )}>
                      {EVENT_TYPE_LABELS[ev.event_type]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
