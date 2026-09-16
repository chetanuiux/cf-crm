import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { taskTone, priorityTone, fmtDate, titleize } from "@/lib/labels";
import { excludeDemoRecords } from "@/lib/demo-data";

export const Route = createFileRoute("/_authenticated/tasks")({ component: TasksPage });

function TasksPage() {
  const { data: rows = [] } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () =>
      excludeDemoRecords(
        (await supabase
          .from("tasks")
          .select("*, firms(id,name), client_applications(id, client_name)")
          .order("due_date", { ascending: true })).data,
      ),
  });

  const { open, completed } = useMemo(() => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const open: any[] = [];
    const completed: any[] = [];
    for (const t of rows as any[]) {
      if (t.status === "completed") {
        if (t.completed_at && new Date(t.completed_at) >= sevenDaysAgo) completed.push(t);
      } else {
        open.push(t);
      }
    }
    completed.sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime());
    return { open, completed };
  }, [rows]);

  const renderRow = (t: any, showCompleted = false) => (
    <TableRow key={t.id}>
      <TableCell className="font-medium">{t.title}</TableCell>
      <TableCell className="text-sm">
        {t.firms && <Link to="/firms/$firmId" params={{ firmId: t.firms.id }} className="hover:text-primary">{t.firms.name}</Link>}
        {t.client_applications && <Link to="/applications/$applicationId" params={{ applicationId: t.client_applications.id }} className="hover:text-primary">{t.client_applications.client_name}</Link>}
      </TableCell>
      <TableCell>{showCompleted ? fmtDate(t.completed_at) : fmtDate(t.due_date)}</TableCell>
      <TableCell><StatusBadge value={t.priority} tone={priorityTone(t.priority)} /></TableCell>
      <TableCell className="text-sm">{titleize(t.task_type)}</TableCell>
      <TableCell><StatusBadge value={t.status} tone={taskTone(t.status)} /></TableCell>
    </TableRow>
  );

  return (
    <div className="p-6 space-y-6 max-w-[1600px]">
      <div>
        <h1 className="text-2xl font-semibold">Tasks</h1>
        <p className="text-sm text-muted-foreground">{open.length} open · {completed.length} completed in last 7 days</p>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Open</h2>
        <Card><Table>
          <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Related</TableHead><TableHead>Due</TableHead><TableHead>Priority</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>
            {open.map((t) => renderRow(t))}
            {!open.length && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No open tasks.</TableCell></TableRow>}
          </TableBody>
        </Table></Card>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Recently Completed</h2>
        <p className="text-xs text-muted-foreground">Completed tasks are kept here for 7 days.</p>
        <Card><Table>
          <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Related</TableHead><TableHead>Completed</TableHead><TableHead>Priority</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>
            {completed.map((t) => renderRow(t, true))}
            {!completed.length && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No tasks completed in the last 7 days.</TableCell></TableRow>}
          </TableBody>
        </Table></Card>
      </section>
    </div>
  );
}
