import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import {
  Shield, Users, Leaf, MessageCircle, BarChart3,
  Flag, Trash2, CheckCircle, XCircle, AlertTriangle,
  ExternalLink, RefreshCw, Search, Loader2,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin Panel — TaniAI Nexus" }] }),
  component: Admin,
});

type AdminTab = "dashboard" | "users" | "moderation" | "reports" | "diagnoses";

function StatCard({ icon: Icon, label, value, color = "bg-primary/10 text-primary" }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl", color)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}

function Admin() {
  const qc = useQueryClient();
  const [adminVerified, setAdminVerified] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");
  const [userSearch, setUserSearch] = useState("");
  const [moderationFilter, setModerationFilter] = useState<"all" | "flagged">("all");

  // Cek status admin
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setAdminVerified(false); return; }
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      setAdminVerified(!!data);
    });
  }, []);

  // ─── Statistics ──────────────────────────────────────────────────────────
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      try {
        const [users, diagnoses, chats, posts, reports] = await Promise.all([
          supabase.from("profiles").select("*", { count: "exact", head: true }),
          supabase.from("plant_diagnoses").select("*", { count: "exact", head: true }),
          supabase.from("ai_conversations").select("*", { count: "exact", head: true }),
          supabase.from("community_posts").select("*", { count: "exact", head: true }),
          supabase.from("content_reports").select("*", { count: "exact", head: true }).eq("status", "pending"),
        ]);
        return {
          users: users.count ?? 0,
          diagnoses: diagnoses.count ?? 0,
          chats: chats.count ?? 0,
          posts: posts.count ?? 0,
          reports: reports.count ?? 0,
        };
      } catch (err) {
        console.error("Stats error:", err);
        return { users: 0, diagnoses: 0, chats: 0, posts: 0, reports: 0 };
      }
    },
    enabled: adminVerified === true,
  });

  // ─── Users ───────────────────────────────────────────────────────────────
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["admin-users", userSearch],
    queryFn: async () => {
      try {
        let q = supabase.from("profiles").select("id, full_name, location, created_at, avatar_url").order("created_at", { ascending: false }).limit(30);
        if (userSearch) q = q.ilike("full_name", `%${userSearch}%`);
        const { data, error } = await q;
        if (error) throw error;
        return data ?? [];
      } catch (err) {
        console.error("Users error:", err);
        return [];
      }
    },
    enabled: adminVerified === true && activeTab === "users",
  });

  // ─── Community Posts ─────────────────────────────────────────────────────
  const { data: posts = [], isLoading: postsLoading } = useQuery({
    queryKey: ["admin-posts", moderationFilter],
    queryFn: async () => {
      try {
        let q = supabase.from("community_posts").select("*").order("created_at", { ascending: false }).limit(30);
        if (moderationFilter === "flagged") q = q.eq("is_flagged", true);
        const { data, error } = await q;
        if (error) throw error;
        return data ?? [];
      } catch (err) {
        console.error("Posts error:", err);
        return [];
      }
    },
    enabled: adminVerified === true && activeTab === "moderation",
  });

  // ─── Reports ─────────────────────────────────────────────────────────────
  const { data: reports = [], isLoading: reportsLoading } = useQuery({
    queryKey: ["admin-reports"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.from("content_reports").select("*").order("created_at", { ascending: false }).limit(30);
        if (error) throw error;
        return data ?? [];
      } catch (err) {
        console.error("Reports error:", err);
        return [];
      }
    },
    enabled: adminVerified === true && activeTab === "reports",
  });

  // ─── Diagnoses ───────────────────────────────────────────────────────────
  const { data: diagLogs = [], isLoading: diagLoading } = useQuery({
    queryKey: ["admin-diagnoses"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.from("plant_diagnoses").select("*").order("created_at", { ascending: false }).limit(30);
        if (error) throw error;
        return data ?? [];
      } catch (err) {
        console.error("Diagnoses error:", err);
        return [];
      }
    },
    enabled: adminVerified === true && activeTab === "diagnoses",
  });

  // ─── Mutations ───────────────────────────────────────────────────────────
  const deletePost = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("community_posts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-posts"] }); toast.success("Postingan dihapus"); },
    onError: (e) => toast.error(e.message),
  });

  const flagPost = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("community_posts").update({ is_flagged: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-posts"] }); toast.success("Postingan ditandai"); },
    onError: (e) => toast.error(e.message),
  });

  const resolveReport = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "resolved" | "rejected" }) => {
      const { error } = await supabase.from("content_reports").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-reports"] }); qc.invalidateQueries({ queryKey: ["admin-stats"] }); toast.success("Laporan diperbarui"); },
    onError: (e) => toast.error(e.message),
  });

  // ─── Conditional render setelah semua hooks ─────────────────────────────
  if (adminVerified === null) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (!adminVerified) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
        <Shield className="h-12 w-12 text-muted-foreground/30" />
        <p className="font-semibold">Akses Ditolak</p>
        <p className="text-sm text-muted-foreground">Halaman ini hanya untuk administrator.</p>
      </div>
    );
  }

  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: BarChart3 },
    { id: "users", label: "Pengguna", icon: Users },
    { id: "moderation", label: "Moderasi", icon: Flag, badge: stats?.reports },
    { id: "reports", label: "Laporan", icon: AlertTriangle, badge: stats?.reports },
    { id: "diagnoses", label: "Diagnosa", icon: Leaf },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" /> Admin Panel
          </h1>
          <p className="text-sm text-muted-foreground">Kelola aplikasi TaniAI Nexus</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link to="/dashboard"><ExternalLink className="h-3.5 w-3.5" /> Buka App</Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries()} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-muted/30 p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as AdminTab)}
            className={cn(
              "relative flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors",
              activeTab === t.id ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
            {t.badge ? <span className="flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white">{t.badge > 9 ? "9+" : t.badge}</span> : null}
          </button>
        ))}
      </div>

      {/* Konten sesuai tab (sama seperti sebelumnya, sudah saya sertakan) */}
      {/* ... silakan gunakan kode dari pesan sebelumnya untuk bagian konten, atau lanjutkan dengan di bawah ini - saya akan tulis singkat agar tidak terlalu panjang */}

      {/* Dashboard Tab */}
      {activeTab === "dashboard" && (
        <div className="space-y-6">
          {statsLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <StatCard icon={Users} label="Total Pengguna" value={stats?.users} color="bg-blue-100 text-blue-700" />
              <StatCard icon={Leaf} label="Total Diagnosa" value={stats?.diagnoses} color="bg-green-100 text-green-700" />
              <StatCard icon={MessageCircle} label="AI Conversations" value={stats?.chats} color="bg-purple-100 text-purple-700" />
              <StatCard icon={Users} label="Postingan Komunitas" value={stats?.posts} color="bg-orange-100 text-orange-700" />
              <StatCard icon={Flag} label="Laporan Pending" value={stats?.reports} color={stats?.reports ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"} />
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { tab: "users" as AdminTab, icon: Users, label: "Manajemen Pengguna", desc: "Lihat dan kelola akun pengguna" },
              { tab: "moderation" as AdminTab, icon: Flag, label: "Moderasi Konten", desc: "Tinjau postingan komunitas" },
              { tab: "reports" as AdminTab, icon: AlertTriangle, label: "Laporan User", desc: `${stats?.reports ?? 0} laporan menunggu` },
            ].map((item) => (
              <button key={item.tab} onClick={() => setActiveTab(item.tab)} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-5 text-left shadow-card hover:shadow-elevated transition-all hover:-translate-y-0.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <item.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{item.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === "users" && (
        <div className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={userSearch} onChange={(e) => setUserSearch(e.target.value)} placeholder="Cari pengguna..." className="h-9 w-full rounded-xl border border-input bg-card pl-9 pr-3 text-sm outline-none focus:border-primary" />
          </div>
          <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-border bg-muted/30">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pengguna</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lokasi</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bergabung</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {usersLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}><td colSpan={4} className="px-4 py-3"><Skeleton className="h-8 w-full rounded-lg" /></td></tr>
                    ))
                  ) : users.length === 0 ? (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Tidak ada data pengguna</td></tr>
                  ) : (
                    users.map((u) => (
                      <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                              {(u.full_name || "?").slice(0, 2).toUpperCase()}
                            </div>
                            <span className="font-medium">{u.full_name ?? "Tanpa Nama"}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{u.location ?? "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {u.created_at ? format(parseISO(u.created_at), "d MMM yyyy", { locale: idLocale }) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">Aktif</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Moderation Tab */}
      {activeTab === "moderation" && (
        <div className="space-y-4">
          <div className="flex gap-2">
            {(["all", "flagged"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setModerationFilter(f)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                  moderationFilter === f ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
                )}
              >
                {f === "all" ? "Semua Postingan" : "Dilaporkan"}
              </button>
            ))}
          </div>
          <div className="space-y-3">
            {postsLoading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)
            ) : posts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card/50 py-10 text-center">
                <CheckCircle className="mx-auto h-10 w-10 text-success/40" />
                <p className="mt-3 font-semibold">Tidak ada postingan yang perlu ditinjau</p>
              </div>
            ) : (
              posts.map((post) => (
                <div key={post.id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-semibold text-sm">{post.title}</span>
                        {post.is_flagged && (
                          <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">Ditandai</span>
                        )}
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{post.category}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mb-1">
                        User ID: {post.user_id} · {post.created_at ? format(parseISO(post.created_at), "d MMM yyyy HH:mm", { locale: idLocale }) : "—"}
                      </p>
                      <p className="text-sm text-muted-foreground line-clamp-2">{post.content}</p>
                    </div>
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 px-2 text-xs"
                        onClick={() => flagPost.mutate(post.id)}
                        disabled={post.is_flagged}
                      >
                        <Flag className="h-3 w-3" /> Tandai
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 px-2 text-xs text-destructive hover:bg-destructive/10"
                        onClick={() => { if (confirm("Hapus postingan ini?")) deletePost.mutate(post.id); }}
                      >
                        <Trash2 className="h-3 w-3" /> Hapus
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Reports Tab */}
      {activeTab === "reports" && (
        <div className="space-y-3">
          {reportsLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)
          ) : reports.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/50 py-10 text-center">
              <CheckCircle className="mx-auto h-10 w-10 text-success/40" />
              <p className="mt-3 font-semibold">Tidak ada laporan pending</p>
            </div>
          ) : (
            reports.map((r) => (
              <div
                key={r.id}
                className={cn(
                  "rounded-2xl border bg-card p-4 shadow-card",
                  r.status === "pending" ? "border-warning/30 bg-warning/5" : "border-border opacity-70"
                )}
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className={cn("mt-0.5 h-5 w-5 shrink-0", r.status === "pending" ? "text-warning" : "text-muted-foreground")} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">Laporan dari User ID: {r.reporter_id}</span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          r.status === "pending"
                            ? "bg-warning/20 text-warning"
                            : r.status === "resolved"
                            ? "bg-success/10 text-success"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {r.status === "pending" ? "Menunggu" : r.status === "resolved" ? "Diselesaikan" : "Ditolak"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Alasan: {r.reason} · {r.created_at ? format(parseISO(r.created_at), "d MMM yyyy HH:mm", { locale: idLocale }) : "—"}
                    </p>
                    {r.post_id && <p className="text-xs text-muted-foreground">Post ID: {r.post_id}</p>}
                  </div>
                  {r.status === "pending" && (
                    <div className="flex gap-1.5 shrink-0">
                      <Button
                        size="sm"
                        className="h-7 gap-1 px-2 text-xs bg-success hover:bg-success/90"
                        onClick={() => resolveReport.mutate({ id: r.id, status: "resolved" })}
                      >
                        <CheckCircle className="h-3 w-3" /> Setuju
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 px-2 text-xs"
                        onClick={() => resolveReport.mutate({ id: r.id, status: "rejected" })}
                      >
                        <XCircle className="h-3 w-3" /> Tolak
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Diagnoses Tab */}
      {activeTab === "diagnoses" && (
        <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-border bg-muted/30">
                <tr>
                  {["Pengguna", "Tanaman", "Diagnosis", "Keparahan", "Keyakinan", "Tanggal"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {diagLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}><td colSpan={6} className="px-4 py-3"><Skeleton className="h-6 w-full rounded" /></td></tr>
                  ))
                ) : diagLogs.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Tidak ada data diagnosa</td></tr>
                ) : (
                  diagLogs.map((d) => (
                    <tr key={d.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-xs">User ID: {d.user_id}</td>
                      <td className="px-4 py-3 text-xs">{d.plant_type ?? "—"}</td>
                      <td className="px-4 py-3 text-xs max-w-[200px] truncate">{d.diagnosis}</td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                            d.severity === "Berat"
                              ? "bg-destructive/10 text-destructive"
                              : d.severity === "Sedang"
                              ? "bg-warning/10 text-warning"
                              : d.severity === "Ringan"
                              ? "bg-success/10 text-success"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          {d.severity ?? "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{d.confidence_score ?? "—"}%</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {d.created_at ? format(parseISO(d.created_at), "d MMM yyyy", { locale: idLocale }) : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}