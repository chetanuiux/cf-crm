import { Bell, CheckCheck, Inbox } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fmtDateTime } from "@/lib/labels";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import {
  useUnreadCount,
  useRecentNotifications,
  useMarkRead,
  useMarkAllRead,
} from "@/hooks/useNotifications";

export function NotificationBell() {
  const { data: unreadCount = 0 } = useUnreadCount();
  const { data: recent = [] } = useRecentNotifications();
  const { mutate: markRead } = useMarkRead();
  const { mutate: markAllRead, isPending: markingAll } = useMarkAllRead();
  const navigate = useNavigate();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Notifications"
          className="relative h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute top-0.5 right-0.5 h-[14px] min-w-[14px] rounded-full bg-destructive text-[9px] font-bold text-white flex items-center justify-center px-0.5 leading-none">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent side="bottom" align="end" sideOffset={6} className="w-80 p-0 shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <span className="text-sm font-semibold">Notifications</span>
          {unreadCount > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-xs px-2 gap-1"
              onClick={() => markAllRead()}
              disabled={markingAll}
            >
              <CheckCheck className="h-3 w-3" />
              Mark all read
            </Button>
          )}
        </div>

        {/* Notification items */}
        <div className="divide-y max-h-[280px] overflow-y-auto">
          {recent.length === 0 ? (
            <div className="px-3 py-8 flex flex-col items-center gap-2">
              <Inbox className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No notifications yet</p>
            </div>
          ) : (
            recent.map((n) => (
              <button
                key={n.id}
                type="button"
                className={cn(
                  "w-full text-left px-3 py-2.5 hover:bg-muted/60 transition-colors flex items-start gap-2.5",
                  !n.read && "bg-primary/5",
                )}
                onClick={() => {
                  if (!n.read) markRead(n.id);
                  navigate({ to: "/leads", search: { page: 1, limit: DEFAULT_PAGE_SIZE, channel: "all", status: "new", q: "" } });
                }}
              >
                {/* Unread dot */}
                <span
                  className={cn(
                    "mt-1.5 h-2 w-2 rounded-full shrink-0 transition-colors",
                    n.read ? "bg-transparent" : "bg-primary",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className={cn("text-xs leading-snug truncate", !n.read && "font-medium")}>
                    {n.title}
                  </p>
                  {n.message && (
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{n.message}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                    {fmtDateTime(n.created_at)}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer link */}
        <div className="border-t px-3 py-2">
          <Link
            to="/notifications"
            search={{ page: 1, limit: 25 }}
            className="block text-center text-xs text-primary hover:underline"
          >
            View all notifications
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
