import { ChevronLeft, ChevronRight, Plus, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatMonthLabel, formatWeekLabel, formatDayLabel } from '../utils';
import { EVENT_TYPE_LABELS } from '../utils';
import type { EventType } from '@/api/contracts/calendar';

export type CalendarView = 'month' | 'week' | 'day' | 'agenda';

interface Props {
  view: CalendarView;
  onViewChange: (v: CalendarView) => void;
  currentDate: Date;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onNewEvent: () => void;
  filterType: EventType | 'all';
  onFilterType: (v: EventType | 'all') => void;
}

function getRangeLabel(view: CalendarView, date: Date): string {
  if (view === 'month' || view === 'agenda') return formatMonthLabel(date);
  if (view === 'week') {
    const sunday = new Date(date);
    sunday.setDate(date.getDate() - date.getDay());
    return formatWeekLabel(sunday);
  }
  return formatDayLabel(date);
}

const VIEWS: { value: CalendarView; label: string }[] = [
  { value: 'month', label: 'Month' },
  { value: 'week', label: 'Week' },
  { value: 'day', label: 'Day' },
  { value: 'agenda', label: 'Agenda' },
];

export function CalendarHeader({ view, onViewChange, currentDate, onPrev, onNext, onToday, onNewEvent, filterType, onFilterType }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" onClick={onPrev} className="h-8 w-8">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={onToday} className="h-8 px-3 text-xs">
          Today
        </Button>
        <Button variant="outline" size="icon" onClick={onNext} className="h-8 w-8">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <span className="text-base font-semibold flex-1 min-w-[160px]">
        {getRangeLabel(view, currentDate)}
      </span>

      <div className="flex items-center gap-2">
        <div className="flex border rounded-md overflow-hidden">
          {VIEWS.map(v => (
            <button
              key={v.value}
              onClick={() => onViewChange(v.value)}
              className={`px-3 py-1 text-xs font-medium transition-colors ${
                view === v.value
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        <Select value={filterType} onValueChange={v => onFilterType(v as EventType | 'all')}>
          <SelectTrigger className="h-8 w-[160px] text-xs">
            <Filter className="h-3 w-3 mr-1.5 shrink-0" />
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {(Object.keys(EVENT_TYPE_LABELS) as EventType[]).map(t => (
              <SelectItem key={t} value={t}>{EVENT_TYPE_LABELS[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button size="sm" onClick={onNewEvent} className="h-8 bg-primary hover:bg-primary/90 text-primary-foreground">
          <Plus className="h-3.5 w-3.5 mr-1" /> New Event
        </Button>
      </div>
    </div>
  );
}
