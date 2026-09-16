import { type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ComingSoonProps {
  icon: LucideIcon;
  title: string;
  description: string;
  bullets: string[];
}

export function ComingSoon({ icon: Icon, title, description, bullets }: ComingSoonProps) {
  return (
    <Card className="border-dashed">
      <CardContent className="p-14 flex flex-col items-center justify-center text-center min-h-[480px]">
        <div className="relative mb-6">
          <div className="h-20 w-20 rounded-2xl bg-primary/8 border border-primary/15 grid place-items-center shadow-sm">
            <Icon className="h-10 w-10 text-primary/60" strokeWidth={1.5} />
          </div>
          <Badge
            variant="secondary"
            className="absolute -top-2 -right-3 text-[10px] px-1.5 py-0 bg-amber-100 text-amber-700 border border-amber-200"
          >
            Soon
          </Badge>
        </div>

        <h2 className="text-xl font-semibold mb-2">{title}</h2>
        <p className="text-sm text-muted-foreground max-w-sm mb-6 leading-relaxed">{description}</p>

        <ul className="text-sm text-muted-foreground space-y-2 max-w-xs text-left">
          {bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-0.5 h-4 w-4 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
                {i + 1}
              </span>
              {b}
            </li>
          ))}
        </ul>

        <p className="mt-8 text-xs text-muted-foreground/60 italic">
          We're working hard — this feature will be available soon.
        </p>
      </CardContent>
    </Card>
  );
}
