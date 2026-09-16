import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PAGE_SIZES, getPageNumbers } from "@/lib/pagination";

export function PaginationBar({
  page,
  totalPages,
  total,
  from,
  to,
  limit,
  entityLabel,
  onPageChange,
  onLimitChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  from: number;
  to: number;
  limit: number;
  entityLabel: string;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">
        Showing {from}–{to} of {total} {entityLabel}
      </p>

      <div className="flex items-center gap-1">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Previous page">
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
              onClick={() => onPageChange(n)}
              className={n === page ? "bg-primary text-primary-foreground" : ""}
            >
              {n}
            </Button>
          ),
        )}

        <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} aria-label="Next page">
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <Select value={String(limit)} onValueChange={(v) => onLimitChange(Number(v))}>
        <SelectTrigger className="w-27.5">
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
  );
}
