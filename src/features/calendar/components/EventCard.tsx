import type { CalendarEvent } from '@/api/contracts/calendar';
import { EVENT_TYPE_COLORS, formatEventTime } from '../utils';
import { cn } from '@/lib/utils';

interface Props {
  event: CalendarEvent;
  onClick: (e: CalendarEvent) => void;
  compact?: boolean;
}

export function EventCard({ event, onClick, compact = false }: Props) {
  const colors = EVENT_TYPE_COLORS[event.event_type];

  if (compact) {
    return (
      <button
        onClick={(ev) => { ev.stopPropagation(); onClick(event); }}
        className={cn(
          'w-full text-left px-1.5 py-0.5 rounded text-[11px] font-medium truncate leading-5 transition-opacity hover:opacity-80',
          colors.bg, colors.text, `border-l-2 ${colors.border}`
        )}
        title={event.title}
      >
        {event.title}
      </button>
    );
  }

  return (
    <button
      onClick={(ev) => { ev.stopPropagation(); onClick(event); }}
      className={cn(
        'w-full text-left px-2 py-1 rounded-md text-xs font-medium border transition-opacity hover:opacity-80',
        colors.bg, colors.text, colors.border
      )}
    >
      <div className="font-semibold truncate">{event.title}</div>
      <div className="text-[10px] opacity-75 mt-0.5">
        {formatEventTime(event.start_at, event.end_at, event.timezone)}
      </div>
    </button>
  );
}
