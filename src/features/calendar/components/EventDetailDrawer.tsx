import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { X, Clock, MapPin, Link2, Users, Building2, FileText, Calendar, Pencil, Trash2, Copy, RefreshCw, CheckCircle2, XCircle, HelpCircle, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader } from '@/components/ui/sheet';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import type { CalendarEvent, ResponseStatus } from '@/api/contracts/calendar';
import { EVENT_TYPE_COLORS, EVENT_TYPE_LABELS, formatEventTime, formatDuration } from '../utils';
import { useDeleteEvent } from '../hooks/useCalendarEvents';
import { cn } from '@/lib/utils';

interface Props {
  event: CalendarEvent | null;
  onClose: () => void;
  onEdit: (e: CalendarEvent) => void;
  onDuplicate: (e: CalendarEvent) => void;
}

const RESPONSE_ICON: Record<ResponseStatus, React.ReactNode> = {
  accepted:  <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />,
  declined:  <XCircle className="h-3.5 w-3.5 text-red-500" />,
  tentative: <HelpCircle className="h-3.5 w-3.5 text-amber-500" />,
  pending:   <Mail className="h-3.5 w-3.5 text-muted-foreground" />,
};

export function EventDetailDrawer({ event, onClose, onEdit, onDuplicate }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteEvent = useDeleteEvent();

  if (!event) return null;

  const colors = EVENT_TYPE_COLORS[event.event_type];

  const handleDelete = async () => {
    try {
      await deleteEvent.mutateAsync(event.id);
      toast.success('Event deleted.');
      onClose();
    } catch {
      toast.error('Failed to delete event.');
    }
    setConfirmDelete(false);
  };

  return (
    <>
      <Sheet open={!!event} onOpenChange={open => { if (!open) onClose(); }}>
        <SheetContent className="w-[400px] sm:w-[480px] overflow-y-auto p-0">
          <div className={cn('px-5 py-4 border-b', colors.bg)}>
            <SheetHeader>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className={cn('text-[10px] font-semibold uppercase tracking-wide', colors.text)}>
                    {EVENT_TYPE_LABELS[event.event_type]}
                  </span>
                  <h2 className={cn('text-base font-semibold mt-0.5 leading-snug', colors.text)}>{event.title}</h2>
                </div>
                <button onClick={onClose} className="text-muted-foreground hover:text-foreground mt-0.5">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </SheetHeader>
          </div>

          <div className="px-5 py-4 space-y-4">
            {/* Time */}
            <div className="flex items-start gap-2.5">
              <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="text-sm">
                <div>{new Date(event.start_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</div>
                <div className="text-muted-foreground">
                  {formatEventTime(event.start_at, event.end_at, event.timezone)} · {formatDuration(event.start_at, event.end_at)} · {event.timezone}
                </div>
                {event.is_recurring && (
                  <div className="flex items-center gap-1 text-muted-foreground mt-0.5">
                    <RefreshCw className="h-3 w-3" /> <span className="text-xs">Recurring event</span>
                  </div>
                )}
              </div>
            </div>

            {/* Location */}
            {event.location && (
              <div className="flex items-start gap-2.5">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <span className="text-sm">{event.location}</span>
              </div>
            )}

            {/* Meeting URL */}
            {event.meeting_url && (
              <div className="flex items-start gap-2.5">
                <Link2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <a href={event.meeting_url} target="_blank" rel="noopener noreferrer"
                  className="text-sm text-primary underline underline-offset-2 hover:opacity-80 break-all">
                  Join meeting
                </a>
              </div>
            )}

            {/* Related firm */}
            {event.firm_id && event.firm_name && (
              <div className="flex items-start gap-2.5">
                <Building2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5">Firm</div>
                  <Link
                    to="/firms/$firmId"
                    params={{ firmId: event.firm_id }}
                    onClick={onClose}
                    className="text-sm text-primary hover:underline"
                  >
                    {event.firm_name}
                  </Link>
                </div>
              </div>
            )}

            {/* Related application */}
            {event.application_id && event.application_ref && (
              <div className="flex items-start gap-2.5">
                <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5">Application</div>
                  <Link
                    to="/applications/$applicationId"
                    params={{ applicationId: event.application_id }}
                    onClick={onClose}
                    className="text-sm text-primary hover:underline"
                  >
                    {event.application_ref}
                  </Link>
                </div>
              </div>
            )}

            {/* Attendees */}
            {event.attendees.length > 0 && (
              <div className="flex items-start gap-2.5">
                <Users className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex-1">
                  <div className="text-xs text-muted-foreground mb-1.5">Attendees</div>
                  <div className="space-y-1.5">
                    {event.attendees.map((a, i) => (
                      <div key={i} className="flex items-center gap-2">
                        {RESPONSE_ICON[a.response_status]}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{a.name}</div>
                          <div className="text-[11px] text-muted-foreground truncate">{a.email}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Description */}
            {event.description && (
              <div className="flex items-start gap-2.5">
                <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5">Description</div>
                  <p className="text-sm whitespace-pre-wrap">{event.description}</p>
                </div>
              </div>
            )}

            {/* Timestamps */}
            <div className="text-[11px] text-muted-foreground pt-2 border-t space-y-0.5">
              <div>Created {new Date(event.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
              <div>Updated {new Date(event.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
            </div>
          </div>

          {/* Actions */}
          <div className="px-5 py-3 border-t flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => onEdit(event)} className="gap-1.5">
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
            <Button size="sm" variant="outline" onClick={() => onDuplicate(event)} className="gap-1.5">
              <Copy className="h-3.5 w-3.5" /> Duplicate
            </Button>
            <Button size="sm" variant="outline"
              onClick={() => setConfirmDelete(true)}
              className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10 ml-auto"
              disabled={deleteEvent.isPending}
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete event?</AlertDialogTitle>
            <AlertDialogDescription>
              "{event.title}" will be permanently deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
