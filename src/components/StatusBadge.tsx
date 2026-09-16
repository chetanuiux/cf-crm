import { cn } from "@/lib/utils";
import { titleize, type Tone } from "@/lib/labels";

const toneClass: Record<Tone, string> = {
  neutral: "bg-secondary text-secondary-foreground",
  info: "bg-info/15 text-info border border-info/20",
  success: "bg-success/15 text-success border border-success/20",
  warning: "bg-warning/20 text-warning-foreground border border-warning/30",
  destructive: "bg-destructive/15 text-destructive border border-destructive/20",
  muted: "bg-muted text-muted-foreground border border-border",
};

export function StatusBadge({ value, tone = "neutral", className }: { value: string | null | undefined; tone?: Tone; className?: string }) {
  if (!value) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap", toneClass[tone], className)}>
      {titleize(value)}
    </span>
  );
}
