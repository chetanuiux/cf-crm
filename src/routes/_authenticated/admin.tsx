import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    throw redirect({ to: "/settings" });
  },
});
