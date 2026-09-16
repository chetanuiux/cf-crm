import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/index';
import type { CalendarEvent, ListParams } from '@/api/contracts/calendar';

export const calendarKeys = {
  all: ['calendar-events'] as const,
  list: (params: ListParams) => [...calendarKeys.all, 'list', params] as const,
  detail: (id: string) => [...calendarKeys.all, 'detail', id] as const,
  syncStatus: ['calendar-sync-status'] as const,
};

export function useCalendarEvents(params: ListParams) {
  return useQuery({
    queryKey: calendarKeys.list(params),
    queryFn: () => api.calendar.list(params),
    staleTime: 30_000,
  });
}

export function useCalendarEvent(id: string) {
  return useQuery({
    queryKey: calendarKeys.detail(id),
    queryFn: () => api.calendar.get(id),
    enabled: !!id,
  });
}

export function useCalendarSyncStatus() {
  return useQuery({
    queryKey: calendarKeys.syncStatus,
    queryFn: () => api.calendar.syncStatus(),
    staleTime: 60_000,
  });
}

export function useCreateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (event: Parameters<typeof api.calendar.create>[0]) =>
      api.calendar.create(event),
    onSuccess: () => { qc.invalidateQueries({ queryKey: calendarKeys.all }); },
  });
}

export function useUpdateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<CalendarEvent> }) =>
      api.calendar.update(id, patch),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: calendarKeys.all });
      qc.setQueryData(calendarKeys.detail(updated.id), updated);
    },
  });
}

export function useDeleteEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.calendar.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: calendarKeys.all }); },
  });
}

export function useCheckConflicts() {
  return useMutation({
    mutationFn: ({ start, end, user_ids }: { start: string; end: string; user_ids: string[] }) =>
      api.calendar.checkConflicts(start, end, user_ids),
  });
}
