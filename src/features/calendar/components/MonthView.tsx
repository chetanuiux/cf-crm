import { useMemo } from 'react';
import type { CalendarEvent } from '@/api/contracts/calendar';
import { getMonthGrid, isSameDay } from '../utils';
import { EventCard } from './EventCard';
import { cn } from '@/lib/utils';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_VISIBLE = 3;

interface Props {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (e: CalendarEvent) => void;
  onDayClick: (date: Date) => void;
}

export function MonthView({ currentDate, events, onEventClick, onDayClick }: Props) {
  const today = new Date();
  const grid = useMemo(() => getMonthGrid(currentDate), [currentDate]);

  const eventsForDay = (day: Date) =>
    events
      .filter(e => isSameDay(new Date(e.start_at), day))
      .sort((a, b) => a.start_at.localeCompare(b.start_at));

  return (
    <div className="flex flex-col h-full border rounded-lg overflow-hidden bg-background">
      <div className="grid grid-cols-7 border-b">
        {DAY_NAMES.map(d => (
          <div key={d} className="py-2 text-center text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
            {d}
          </div>
        ))}
      </div>

      <div className="flex-1 grid grid-rows-[repeat(auto-fit,minmax(0,1fr))]">
        {grid.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 border-b last:border-b-0 min-h-[110px]">
            {week.map((day, di) => {
              const isCurrentMonth = day.getMonth() === currentDate.getMonth();
              const isToday = isSameDay(day, today);
              const dayEvents = eventsForDay(day);
              const overflow = dayEvents.length - MAX_VISIBLE;

              return (
                <div
                  key={di}
                  onClick={() => onDayClick(day)}
                  className={cn(
                    'border-r last:border-r-0 p-1.5 cursor-pointer hover:bg-muted/40 transition-colors flex flex-col gap-0.5',
                    !isCurrentMonth && 'bg-muted/20'
                  )}
                >
                  <span className={cn(
                    'text-xs font-medium self-start leading-5 w-6 h-6 flex items-center justify-center rounded-full mb-0.5',
                    isToday && 'bg-primary text-primary-foreground font-bold',
                    !isToday && !isCurrentMonth && 'text-muted-foreground',
                    !isToday && isCurrentMonth && 'text-foreground',
                  )}>
                    {day.getDate()}
                  </span>

                  {dayEvents.slice(0, MAX_VISIBLE).map(ev => (
                    <EventCard key={ev.id} event={ev} onClick={onEventClick} compact />
                  ))}

                  {overflow > 0 && (
                    <button
                      onClick={e => { e.stopPropagation(); onDayClick(day); }}
                      className="text-[10px] text-muted-foreground hover:text-foreground px-1 text-left"
                    >
                      +{overflow} more
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
