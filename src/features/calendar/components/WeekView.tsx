import type { CalendarEvent } from '@/api/contracts/calendar';
import { getWeekDays, startOfWeek } from '../utils';
import { TimeGrid } from './TimeGrid';

interface Props {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (e: CalendarEvent) => void;
  onSlotClick: (date: Date) => void;
}

export function WeekView({ currentDate, events, onEventClick, onSlotClick }: Props) {
  const days = getWeekDays(startOfWeek(currentDate));
  return (
    <div className="flex flex-col h-full overflow-auto">
      <TimeGrid days={days} events={events} onEventClick={onEventClick} onSlotClick={onSlotClick} />
    </div>
  );
}
