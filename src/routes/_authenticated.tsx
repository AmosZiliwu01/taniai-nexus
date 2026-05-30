import { useEffect, useState } from "react";
import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
  component: AuthLayout,
});

function AuthLayout() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{
    email?: string | null;
    full_name?: string | null;
    avatar_url?: string | null;
  }>({});
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          navigate({ to: "/login" });
          return;
        }

        // Fetch profile and role in parallel — handle 403 gracefully
        const [profileRes, roleRes] = await Promise.allSettled([
          supabase
            .from("profiles")
            .select("full_name, avatar_url")
            .eq("id", session.user.id)
            .maybeSingle(),
          supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", session.user.id)
            .eq("role", "admin")
            .maybeSingle(),
        ]);

        if (cancelled) return;

        const prof =
          profileRes.status === "fulfilled" && !profileRes.value.error
            ? profileRes.value.data
            : null;

        const role =
          roleRes.status === "fulfilled" && !roleRes.value.error
            ? roleRes.value.data
            : null;

        setUser({
          email: session.user.email,
          full_name: prof?.full_name ?? null,
          avatar_url: prof?.avatar_url ?? null,
        });
        setIsAdmin(Boolean(role));
      } catch (e) {
        console.error("[AuthLayout] Error loading user data:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AppShell user={user} isAdmin={isAdmin}>
      <Outlet />
    </AppShell>
  );
}
