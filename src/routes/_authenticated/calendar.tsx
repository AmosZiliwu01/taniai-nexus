import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/_authenticated/calendar" as any)({
  beforeLoad: () => { throw redirect({ to: "/analytics" as any }); },
  component: () => null,
});
