import type { CalendarEvent } from '@/api/contracts/calendar';
import { HOURS, isSameDay, hourToTopPercent, durationPercent, formatEventTime } from '../utils';
import { EVENT_TYPE_COLORS } from '../utils';
import { cn } from '@/lib/utils';

interface Props {
  days: Date[];
  events: CalendarEvent[];
  onEventClick: (e: CalendarEvent) => void;
  onSlotClick: (date: Date) => void;
}

export function TimeGrid({ days, events, onEventClick, onSlotClick }: Props) {
  const today = new Date();

  const eventsForDay = (day: Date) =>
    events.filter(e => isSameDay(new Date(e.start_at), day));

  const handleSlotClick = (day: Date, hour: number) => {
    const d = new Date(day);
    d.setHours(hour, 0, 0, 0);
    onSlotClick(d);
  };

  return (
    <div className="flex border rounded-lg overflow-hidden bg-background flex-1">
      {/* Hour labels column */}
      <div className="w-14 shrink-0 border-r">
        <div className="h-10 border-b" />
        <div className="relative">
          {HOURS.map(h => (
            <div key={h} className="h-14 border-b last:border-b-0 flex items-start justify-end pr-2 pt-0.5">
              <span className="text-[10px] text-muted-foreground">
                {h === 12 ? '12pm' : h > 12 ? `${h - 12}pm` : `${h}am`}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Day columns */}
      <div className="flex flex-1 overflow-x-auto">
        {days.map((day, di) => {
          const isToday = isSameDay(day, today);
          const dayEvents = eventsForDay(day);

          return (
            <div key={di} className="flex-1 min-w-[80px] border-r last:border-r-0 flex flex-col">
              {/* Day header */}
              <div className={cn(
                'h-10 border-b flex flex-col items-center justify-center sticky top-0 bg-background z-10',
                isToday && 'bg-primary/5'
              )}>
                <span className="text-[10px] text-muted-foreground uppercase">
                  {day.toLocaleDateString('en-US', { weekday: 'short' })}
                </span>
                <span className={cn(
                  'text-sm font-semibold leading-none',
                  isToday && 'text-primary'
                )}>
                  {day.getDate()}
                </span>
              </div>

              {/* Time slots */}
              <div
                className="relative flex-1"
                style={{ height: `${HOURS.length * 56}px` }}
              >
                {HOURS.map(h => (
                  <div
                    key={h}
                    className="h-14 border-b last:border-b-0 hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => handleSlotClick(day, h)}
                  />
                ))}

                {/* Events overlay */}
                {dayEvents.map(ev => {
                  const top = hourToTopPercent(ev.start_at);
                  const height = Math.max(durationPercent(ev.start_at, ev.end_at), 2);
                  const colors = EVENT_TYPE_COLORS[ev.event_type];

                  return (
                    <button
                      key={ev.id}
                      onClick={e => { e.stopPropagation(); onEventClick(ev); }}
                      className={cn(
                        'absolute left-0.5 right-0.5 rounded px-1.5 py-0.5 text-left overflow-hidden border-l-2 transition-opacity hover:opacity-80',
                        colors.bg, colors.text, colors.border
                      )}
                      style={{
                        top: `${top}%`,
                        height: `${height}%`,
                        minHeight: '20px',
                        zIndex: 10,
                      }}
                    >
                      <div className="text-[11px] font-semibold truncate leading-4">{ev.title}</div>
                      {height > 4 && (
                        <div className="text-[10px] opacity-75 truncate">
                          {formatEventTime(ev.start_at, ev.end_at, ev.timezone)}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
