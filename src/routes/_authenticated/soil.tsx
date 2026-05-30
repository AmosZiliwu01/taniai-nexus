import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/_authenticated/soil" as any)({
  beforeLoad: () => { throw redirect({ to: "/plants" as any }); },
  component: () => null,
});
