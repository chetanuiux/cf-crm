import { Check, Circle, AlertCircle, Lock, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type StepState = "complete" | "current" | "upcoming" | "warning" | "locked" | "failed";

export interface Step {
  key: string;
  label: string;
  state: StepState;
  sublabel?: string;
}

const stateStyles: Record<StepState, { circle: string; line: string; label: string; icon: typeof Check }> = {
  complete: { circle: "bg-success text-success-foreground border-success", line: "bg-success", label: "text-foreground", icon: Check },
  current:  { circle: "bg-primary text-primary-foreground border-primary ring-4 ring-primary/20 animate-pulse", line: "bg-border", label: "text-foreground font-semibold", icon: Circle },
  upcoming: { circle: "bg-background text-muted-foreground border-border", line: "bg-border", label: "text-muted-foreground", icon: Circle },
  warning:  { circle: "bg-warning text-warning-foreground border-warning ring-4 ring-warning/20", line: "bg-border", label: "text-foreground font-semibold", icon: AlertCircle },
  locked:   { circle: "bg-muted text-muted-foreground border-border", line: "bg-border", label: "text-muted-foreground/60", icon: Lock },
  failed:   { circle: "bg-destructive text-destructive-foreground border-destructive", line: "bg-border", label: "text-foreground", icon: XCircle },
};

export function FlowStepper({ title, steps, locked, lockedMessage }: { title: string; steps: Step[]; locked?: boolean; lockedMessage?: string }) {
  return (
    <div className={cn("space-y-3", locked && "opacity-50")}>
      {(title || locked) && (
        <div className="flex items-center justify-between">
          {title && <h3 className="text-sm font-semibold tracking-tight">{title}</h3>}
          {locked && <span className="text-xs text-muted-foreground flex items-center gap-1"><Lock className="h-3 w-3" /> {lockedMessage}</span>}
        </div>
      )}
      <div className="flex items-start gap-0 overflow-x-auto pb-2">
        {steps.map((s, i) => {
          const style = stateStyles[s.state];
          const Icon = style.icon;
          const isLast = i === steps.length - 1;
          return (
            <div key={s.key} className="flex items-start flex-1 min-w-[80px]">
              <div className="flex flex-col items-center flex-1">
                <div className={cn("h-8 w-8 rounded-full border-2 flex items-center justify-center transition-all", style.circle)}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="mt-2 text-center px-1">
                  <div className={cn("text-xs leading-tight", style.label)}>{s.label}</div>
                  {s.sublabel && <div className="text-[10px] text-muted-foreground mt-0.5">{s.sublabel}</div>}
                </div>
              </div>
              {!isLast && (
                <div className="flex-shrink-0 w-full max-w-[40px] h-0.5 mt-4 mx-1 transition-colors" style={{ background: "" }}>
                  <div className={cn("h-full w-full rounded", style.line)} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
