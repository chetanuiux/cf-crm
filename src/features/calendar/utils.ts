import type { EventType } from '@/api/contracts/calendar';

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  demo: 'Demo',
  discovery: 'Discovery Call',
  follow_up: 'Follow-up',
  underwriting: 'Underwriting Review',
  signing: 'Signing',
  internal: 'Internal',
};

export const EVENT_TYPE_COLORS: Record<EventType, { bg: string; text: string; border: string; dot: string }> = {
  demo:         { bg: 'bg-green-100',  text: 'text-green-800',  border: 'border-green-300',  dot: 'bg-green-500' },
  discovery:    { bg: 'bg-blue-100',   text: 'text-blue-800',   border: 'border-blue-300',   dot: 'bg-blue-500' },
  follow_up:    { bg: 'bg-amber-100',  text: 'text-amber-800',  border: 'border-amber-300',  dot: 'bg-amber-500' },
  underwriting: { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300', dot: 'bg-purple-500' },
  signing:      { bg: 'bg-red-100',    text: 'text-red-800',    border: 'border-red-300',    dot: 'bg-red-500' },
  internal:     { bg: 'bg-gray-100',   text: 'text-gray-700',   border: 'border-gray-300',   dot: 'bg-gray-400' },
};

export function formatEventTime(start: string, end: string, tz: string): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz, hour12: true });
  return `${fmt(start)} – ${fmt(end)}`;
}

export function formatDuration(start: string, end: string): string {
  const mins = (new Date(end).getTime() - new Date(start).getTime()) / 60000;
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
}

export function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function addWeeks(date: Date, n: number): Date {
  return addDays(date, n * 7);
}

export function addMonths(date: Date, n: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + n, 1);
}

export function getMonthGrid(month: Date): Date[][] {
  const first = startOfMonth(month);
  const last = endOfMonth(month);
  const startDay = first.getDay();
  const rows: Date[][] = [];
  let current = addDays(first, -startDay);
  while (current <= last || rows.length < 6) {
    const row: Date[] = [];
    for (let i = 0; i < 7; i++) { row.push(new Date(current)); current = addDays(current, 1); }
    rows.push(row);
    if (current > last && rows.length >= 4) break;
  }
  return rows;
}

export function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function formatMonthLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function formatWeekLabel(start: Date): string {
  const end = addDays(start, 6);
  if (start.getMonth() === end.getMonth()) {
    return `${start.toLocaleDateString('en-US', { month: 'long' })} ${start.getDate()}–${end.getDate()}, ${start.getFullYear()}`;
  }
  return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

export function formatDayLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

export const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 6am–10pm

export function hourToTopPercent(iso: string): number {
  const d = new Date(iso);
  const mins = d.getHours() * 60 + d.getMinutes();
  const startMin = 6 * 60;
  const totalMins = 16 * 60;
  return Math.max(0, ((mins - startMin) / totalMins) * 100);
}

export function durationPercent(start: string, end: string): number {
  const mins = (new Date(end).getTime() - new Date(start).getTime()) / 60000;
  return (mins / (16 * 60)) * 100;
}
