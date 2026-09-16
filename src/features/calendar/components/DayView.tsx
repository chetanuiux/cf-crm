import type { CalendarEvent } from '@/api/contracts/calendar';
import { TimeGrid } from './TimeGrid';

interface Props {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (e: CalendarEvent) => void;
  onSlotClick: (date: Date) => void;
}

export function DayView({ currentDate, events, onEventClick, onSlotClick }: Props) {
  return (
    <div className="flex flex-col h-full overflow-auto">
      <TimeGrid days={[currentDate]} events={events} onEventClick={onEventClick} onSlotClick={onSlotClick} />
    </div>
  );
}
