import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LifeBuoy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/support-tickets")({ component: SupportTicketsPage });

function SupportTicketsPage() {
  return (
    <div className="p-6 max-w-[1600px]">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Support Tickets</h1>
        <p className="text-sm text-muted-foreground">Connect Crisp to manage support tickets directly from CaseFunders.</p>
      </div>

      <Card>
        <CardContent className="p-12 flex flex-col items-center justify-center text-center min-h-[400px]">
          <div className="h-14 w-14 rounded-full bg-muted grid place-items-center mb-4">
            <LifeBuoy className="h-7 w-7 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold mb-1">Connect Crisp</h2>
          <p className="text-sm text-muted-foreground max-w-md mb-4">
            Sync with Crisp to triage and respond to customer support tickets without leaving CaseFunders. Integration coming soon.
          </p>
          <Button disabled>Connect Crisp</Button>
        </CardContent>
      </Card>
    </div>
  );
}
