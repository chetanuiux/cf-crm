import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Bell, CheckCheck, ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { fmtLocalDateTime } from "@/lib/labels";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import {
  useNotificationsPage,
  useMarkRead,
  useMarkAllRead,
  useUnreadCount,
} from "@/hooks/useNotifications";

const PAGE_SIZES = [10, 25, 50] as const;
type PageSize = (typeof PAGE_SIZES)[number];

export const Route = createFileRoute("/_authenticated/notifications")({
  component: NotificationsPage,
  validateSearch: (raw: Record<string, unknown>) => ({
    page: Math.max(1, Number(raw.page) || 1),
    limit: (PAGE_SIZES as readonly number[]).includes(Number(raw.limit))
      ? (Number(raw.limit) as PageSize)
      : 25,
  }),
});

function getPageNumbers(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, "…", total];
  if (current >= total - 3) return [1, "…", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "…", current - 1, current, current + 1, "…", total];
}

function NotificationsPage() {
  const { page, limit } = Route.useSearch();
  const navigate = Route.useNavigate();
  const navigateGlobal = useNavigate();

  const { data, isLoading, isPlaceholderData, isError, refetch } =
    useNotificationsPage(page, limit);
  const { data: unreadCount = 0 } = useUnreadCount();
  const { mutate: markRead } = useMarkRead();
  const { mutate: markAllRead, isPending: markingAll } = useMarkAllRead();

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  const goTo = (p: number) =>
    navigate({ search: (prev) => ({ ...prev, page: p }) });
  const setLimit = (val: string) =>
    navigate({ search: (prev) => ({ ...prev, limit: Number(val) as PageSize, page: 1 }) });

  // Clamp to last valid page when limit changes shrink the result set
  useEffect(() => {
    if (data?.totalPages && page > data.totalPages) {
      navigate({ search: (prev) => ({ ...prev, page: data.totalPages }) });
    }
  }, [data?.totalPages, page]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="p-6 space-y-4 max-w-[900px]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
          </h1>
          <p className="text-sm text-muted-foreground">
            Alerts for new leads, sales follow-ups, and application follow-ups.
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 shrink-0"
            onClick={() => markAllRead()}
            disabled={markingAll}
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Mark all read
          </Button>
        )}
      </div>

      <Card className={cn(isPlaceholderData && "opacity-60 pointer-events-none")}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-2" />
              <TableHead>Notification</TableHead>
              <TableHead className="w-48">Time</TableHead>
              <TableHead className="w-24 text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: limit }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 4 }).map((__, j) => (
                    <TableCell key={j}>
                      <div className="h-4 bg-muted rounded animate-pulse" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8">
                  <p className="text-muted-foreground mb-2">Failed to load notifications.</p>
                  <Button size="sm" variant="outline" onClick={() => refetch()}>
                    Retry
                  </Button>
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12">
                  <Inbox className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">No notifications yet.</p>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((n) => (
                <TableRow
                  key={n.id}
                  className={cn(
                    "cursor-pointer transition-colors",
                    !n.read && "bg-primary/5 hover:bg-primary/10",
                  )}
                  onClick={() => {
                    if (!n.read) markRead(n.id);
                    if (n.firm_id) navigateGlobal({ to: "/firms/$firmId", params: { firmId: n.firm_id } });
                    else if (n.platform_session_id) navigateGlobal({ to: "/applications" });
                    else if (n.lead_id) navigateGlobal({ to: "/leads", search: { page: 1, limit: DEFAULT_PAGE_SIZE, channel: "all", status: "new", q: "" } });
                  }}
                >
                  {/* Unread dot */}
                  <TableCell className="pr-0">
                    <span
                      className={cn(
                        "block h-2 w-2 rounded-full",
                        n.read ? "bg-transparent" : "bg-primary",
                      )}
                    />
                  </TableCell>

                  <TableCell>
                    <p className={cn("text-sm", !n.read && "font-medium")}>{n.title}</p>
                    {n.message && (
                      <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                    )}
                  </TableCell>

                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {fmtLocalDateTime(n.created_at)}
                  </TableCell>

                  <TableCell className="text-right">
                    {!n.read && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          markRead(n.id);
                        }}
                      >
                        Mark read
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Pagination — only when there are results */}
      {!isLoading && !isError && total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Showing {from}–{to} of {total} notifications
          </p>

          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => goTo(page - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>

            {getPageNumbers(page, totalPages).map((n, i) =>
              n === "…" ? (
                <span key={`ellipsis-${i}`} className="px-2 text-muted-foreground select-none">
                  …
                </span>
              ) : (
                <Button
                  key={n}
                  size="sm"
                  variant={n === page ? "default" : "outline"}
                  onClick={() => goTo(n)}
                  className={n === page ? "bg-primary text-primary-foreground" : ""}
                >
                  {n}
                </Button>
              ),
            )}

            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => goTo(page + 1)}
              aria-label="Next page"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <Select value={String(limit)} onValueChange={setLimit}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((s) => (
                <SelectItem key={s} value={String(s)}>
                  {s} per page
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
