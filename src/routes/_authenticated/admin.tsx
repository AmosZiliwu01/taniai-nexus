import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import Swal from "sweetalert2";
import {
  Shield, Users, Leaf, MessageCircle, BarChart3,
  Flag, Trash2, CheckCircle, XCircle, AlertTriangle,
  ExternalLink, RefreshCw, Search, Loader2,
  UserX, UserCheck, FlagOff, ChevronDown, ChevronUp,
  ExternalLink as OpenIcon,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin Panel — TaniAI Nexus" }] }),
  component: Admin,
});

type AdminTab = "dashboard" | "users" | "moderation" | "reports" | "diagnoses";

// ─── Helpers ─────────────────────────────────────────────────
function stripHtml(html: string): string {
  if (!html) return "";
  return html.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]*>/g, "").trim();
}

async function pushNotification(userId: string, opts: { title: string; body?: string; type?: string }) {
  await supabase.from("notifications").insert({
    user_id: userId,
    title: opts.title,
    body: opts.body ?? null,
    type: opts.type ?? "info",
  });
}

// ─── SweetAlert2 helpers ─────────────────────────────────────
const Swal2 = Swal.mixin({
  confirmButtonColor: "#16a34a",
  cancelButtonColor: "#6b7280",
  reverseButtons: true,
  customClass: {
    popup: "!rounded-2xl !font-sans",
    confirmButton: "!rounded-xl !px-5 !py-2 !text-sm !font-semibold",
    cancelButton: "!rounded-xl !px-5 !py-2 !text-sm !font-semibold",
  },
});

const SwalDanger = Swal.mixin({
  confirmButtonColor: "#dc2626",
  cancelButtonColor: "#6b7280",
  reverseButtons: true,
  customClass: {
    popup: "!rounded-2xl !font-sans",
    confirmButton: "!rounded-xl !px-5 !py-2 !text-sm !font-semibold",
    cancelButton: "!rounded-xl !px-5 !py-2 !text-sm !font-semibold",
  },
});

const SwalWarning = Swal.mixin({
  confirmButtonColor: "#d97706",
  cancelButtonColor: "#6b7280",
  reverseButtons: true,
  customClass: {
    popup: "!rounded-2xl !font-sans",
    confirmButton: "!rounded-xl !px-5 !py-2 !text-sm !font-semibold",
    cancelButton: "!rounded-xl !px-5 !py-2 !text-sm !font-semibold",
  },
});

// ─── StatCard ────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, color = "bg-primary/10 text-primary" }: any) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl", color)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-2 text-2xl font-bold">{value ?? 0}</p>
    </div>
  );
}

// ─── Main Admin ──────────────────────────────────────────────
function Admin() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [adminVerified, setAdminVerified] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");
  const [userSearch, setUserSearch] = useState("");
  const [moderationFilter, setModerationFilter] = useState<"all" | "flagged">("all");
  const [selectedDiagIds, setSelectedDiagIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setAdminVerified(false); return; }
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      setAdminVerified(!!data);
    });
  }, []);

  // ── Stats ─────────────────────────────────────────────────
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [users, diagnoses, chats, posts, reports] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("plant_diagnoses").select("*", { count: "exact", head: true }),
        supabase.from("ai_conversations").select("*", { count: "exact", head: true }),
        supabase.from("community_posts").select("*", { count: "exact", head: true }),
        supabase.from("content_reports").select("*", { count: "exact", head: true }).eq("status", "pending"),
      ]);
      return { users: users.count ?? 0, diagnoses: diagnoses.count ?? 0, chats: chats.count ?? 0, posts: posts.count ?? 0, reports: reports.count ?? 0 };
    },
    enabled: adminVerified === true,
  });

  // ── Users ─────────────────────────────────────────────────
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["admin-users", userSearch],
    queryFn: async () => {
      let q = supabase.from("profiles").select("id, full_name, location, created_at, avatar_url, phone, farmer_type, updated_at").order("created_at", { ascending: false }).limit(50);
      if (userSearch) q = q.ilike("full_name", `%${userSearch}%`);
      const { data } = await q;
      if (!data?.length) return [];
      const ids = data.map((u: any) => u.id);
      const { data: blocked } = await supabase.from("user_roles").select("user_id").eq("role", "blocked").in("user_id", ids);
      const blockedSet = new Set((blocked ?? []).map((r: any) => r.user_id));
      return (data ?? []).map((u: any) => ({ ...u, is_blocked: blockedSet.has(u.id) }));
    },
    enabled: adminVerified === true && activeTab === "users",
  });

  // ── Posts (with author name) ───────────────────────────────
  const { data: posts = [], isLoading: postsLoading } = useQuery({
    queryKey: ["admin-posts", moderationFilter],
    queryFn: async () => {
      let q = supabase.from("community_posts").select("*").order("created_at", { ascending: false }).limit(50);
      if (moderationFilter === "flagged") q = q.eq("is_flagged", true);
      const { data: rawPosts } = await q;
      if (!rawPosts?.length) return [];
      const userIds = [...new Set(rawPosts.map((p: any) => p.user_id))];
      const { data: profilesData } = await supabase.from("profiles").select("id, full_name, avatar_url").in("id", userIds);
      const profileMap: Record<string, { full_name: string | null; avatar_url: string | null }> = {};
      (profilesData ?? []).forEach((p: any) => { profileMap[p.id] = { full_name: p.full_name, avatar_url: p.avatar_url }; });
      return rawPosts.map((p: any) => ({
        ...p,
        author_name: profileMap[p.user_id]?.full_name ?? "Pengguna",
        author_avatar: profileMap[p.user_id]?.avatar_url ?? null,
      }));
    },
    enabled: adminVerified === true && activeTab === "moderation",
  });

  // ── Reports (with author names) ────────────────────────────
  const { data: reports = [], isLoading: reportsLoading } = useQuery({
    queryKey: ["admin-reports"],
    queryFn: async () => {
      const { data } = await supabase.from("content_reports").select("*").order("created_at", { ascending: false }).limit(50);
      if (!data?.length) return [];
      const postIds = [...new Set(data.filter((r: any) => r.post_id).map((r: any) => r.post_id))];
      const reporterIds = [...new Set(data.map((r: any) => r.reporter_id))];
      const [postsRes, profilesRes] = await Promise.all([
        postIds.length ? supabase.from("community_posts").select("id, title, user_id").in("id", postIds) : Promise.resolve({ data: [] }),
        supabase.from("profiles").select("id, full_name").in("id", reporterIds),
      ]);
      const postMap: Record<string, { title: string; user_id: string }> = {};
      (postsRes.data ?? []).forEach((p: any) => { postMap[p.id] = { title: p.title, user_id: p.user_id }; });
      const postAuthorIds = [...new Set(Object.values(postMap).map((p) => p.user_id))];
      const { data: authorProfiles } = postAuthorIds.length
        ? await supabase.from("profiles").select("id, full_name").in("id", postAuthorIds)
        : { data: [] };
      const authorMap: Record<string, string> = {};
      (authorProfiles ?? []).forEach((p: any) => { authorMap[p.id] = p.full_name ?? "Pengguna"; });
      const reporterMap: Record<string, string> = {};
      (profilesRes.data ?? []).forEach((p: any) => { reporterMap[p.id] = p.full_name ?? "Pengguna"; });
      return data.map((r: any) => ({
        ...r,
        post_title: postMap[r.post_id]?.title ?? null,
        post_author_id: postMap[r.post_id]?.user_id ?? null,
        post_author_name: authorMap[postMap[r.post_id]?.user_id ?? ""] ?? "Pengguna",
        reporter_name: reporterMap[r.reporter_id] ?? "Pengguna",
      }));
    },
    enabled: adminVerified === true && activeTab === "reports",
  });

  // ── Diagnoses ──────────────────────────────────────────────
  const { data: diagLogs = [], isLoading: diagLoading } = useQuery({
    queryKey: ["admin-diagnoses"],
    queryFn: async () => {
      const { data } = await supabase.from("plant_diagnoses").select("id, user_id, plant_type, diagnosis, severity, confidence_score, created_at").order("created_at", { ascending: false }).limit(100);
      if (!data?.length) return [];
      const userIds = [...new Set(data.map((d: any) => d.user_id))];
      const { data: profilesData } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
      const profileMap: Record<string, string> = {};
      (profilesData ?? []).forEach((p: any) => { profileMap[p.id] = p.full_name?.trim() || "Tanpa Nama"; });
      return data.map((d: any) => ({
        ...d,
        user_name: profileMap[d.user_id] || `User ${d.user_id.slice(0, 8)}`,
      }));
    },
    enabled: adminVerified === true && activeTab === "diagnoses",
  });

  // ── Mutations ──────────────────────────────────────────────

  const deletePost = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("community_posts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-posts"] }); qc.invalidateQueries({ queryKey: ["admin-stats"] }); toast.success("Postingan dihapus"); },
    onError: (e: any) => toast.error(e.message),
  });

  // PERUBAHAN: flagPost menggunakan type "community" dan menyertakan POST_ID di body
  const flagPost = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await supabase.from("community_posts").update({ is_flagged: true, flagged_reason: reason }).eq("id", id);
      if (error) throw error;
      const { data: post } = await supabase.from("community_posts").select("id, user_id, title").eq("id", id).maybeSingle();
      if (post) {
        await pushNotification(post.user_id, {
          title: "⚠️ Postingan Anda Ditandai",
          body: `POST_ID:${post.id}\nPostingan "${post.title}" ditandai oleh admin. Alasan: ${reason}. Harap perbarui konten Anda agar tanda dihapus.`,
          type: "community",
        });
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-posts"] }); toast.success("Postingan ditandai — pemilik telah dinotifikasi"); },
    onError: (e: any) => toast.error(e.message),
  });

  const unflagPost = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("community_posts").update({ is_flagged: false, flagged_reason: null }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-posts"] }); toast.success("Tanda peringatan dihapus"); },
    onError: (e: any) => toast.error(e.message),
  });

  // PERUBAHAN: approveReport juga menggunakan type "community" dan POST_ID
  // Jika pelapor adalah admin, flagPost sudah mengirim notifikasi — skip agar tidak double
  const approveReport = useMutation({
    mutationFn: async (report: any) => {
      await supabase.from("content_reports").update({ status: "resolved" }).eq("id", report.id);
      if (report.post_id) {
        // Cek apakah pelapor adalah admin
        const { data: reporterRole } = await supabase.from("user_roles").select("role").eq("user_id", report.reporter_id).eq("role", "admin").maybeSingle();
        const reporterIsAdmin = !!reporterRole;

        await supabase.from("community_posts").update({ is_flagged: true, flagged_reason: report.reason }).eq("id", report.post_id);

        // Hanya kirim notifikasi jika pelapor bukan admin (admin sudah langsung notif via flagPost)
        if (!reporterIsAdmin) {
          const { data: post } = await supabase.from("community_posts").select("id, user_id, title").eq("id", report.post_id).maybeSingle();
          if (post) {
            await pushNotification(post.user_id, {
              title: "🚨 Postingan Dilaporkan",
              body: `POST_ID:${report.post_id}\nPostingan Anda "${post.title}" dilaporkan karena: ${report.reason}. Postingan ditandai — perbarui konten untuk menghapus tanda.`,
              type: "community",
            });
          }
        }
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-reports"] }); qc.invalidateQueries({ queryKey: ["admin-posts"] }); qc.invalidateQueries({ queryKey: ["admin-stats"] }); toast.success("Laporan disetujui — postingan ditandai & user dinotifikasi"); },
    onError: (e: any) => toast.error(e.message),
  });

  const rejectReport = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("content_reports").update({ status: "rejected" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-reports"] }); qc.invalidateQueries({ queryKey: ["admin-stats"] }); toast.success("Laporan ditolak"); },
    onError: (e: any) => toast.error(e.message),
  });

  const blockUser = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from("user_roles").upsert({ user_id: userId, role: "blocked" }, { onConflict: "user_id,role" } as any);
      if (error) throw error;
      await pushNotification(userId, {
        title: "🚫 Akun Anda Diblokir",
        body: "Akun Anda telah diblokir oleh admin. Hubungi administrator untuk informasi lebih lanjut.",
        type: "warning",
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); toast.success("User diblokir"); },
    onError: (e: any) => toast.error(e.message),
  });

  const unblockUser = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "blocked");
      if (error) throw error;
      await pushNotification(userId, {
        title: "✅ Akun Anda Diaktifkan Kembali",
        body: "Blokir akun Anda telah dicabut oleh admin. Anda sekarang dapat login kembali.",
        type: "success",
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); toast.success("User diaktifkan kembali"); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteUser = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from("profiles").delete().eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); qc.invalidateQueries({ queryKey: ["admin-stats"] }); toast.success("Akun pengguna dihapus"); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteDiagnoses = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("plant_diagnoses").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-diagnoses"] }); qc.invalidateQueries({ queryKey: ["admin-stats"] }); setSelectedDiagIds(new Set()); toast.success("Data diagnosa dihapus"); },
    onError: (e: any) => toast.error(e.message),
  });

  // ── SweetAlert action handlers ─────────────────────────────
  // (tidak berubah, tetap seperti kode Anda)
  const handleDeletePost = async (post: any) => {
    const result = await SwalDanger.fire({
      title: "Hapus Postingan?",
      html: `Postingan <strong>"${post.title}"</strong> oleh <strong>${post.author_name}</strong> akan dihapus secara permanen.<br/><br/><span style="color:#6b7280;font-size:13px">Tindakan ini tidak bisa dibatalkan.</span>`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Ya, Hapus",
      cancelButtonText: "Batal",
    });
    if (result.isConfirmed) deletePost.mutate(post.id);
  };

  const handleFlagPost = async (post: any) => {
    const { value: reason, isConfirmed } = await SwalWarning.fire({
      title: "Tandai Postingan",
      html: `Beri peringatan pada postingan <strong>"${post.title}"</strong> oleh <strong>${post.author_name}</strong>.<br/><br/>Pemilik akan mendapat notifikasi dan tanda hilang otomatis saat ia memperbarui postingan.`,
      input: "select",
      inputOptions: {
        "Konten tidak pantas": "Konten tidak pantas",
        "Informasi menyesatkan": "Informasi menyesatkan",
        "Spam / Iklan": "Spam / Iklan",
        "Hoaks / Berita palsu": "Hoaks / Berita palsu",
        "Melanggar aturan komunitas": "Melanggar aturan komunitas",
        "Lainnya": "Lainnya",
      },
      inputPlaceholder: "Pilih alasan...",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Tandai",
      cancelButtonText: "Batal",
      inputValidator: (v) => !v ? "Pilih alasan terlebih dahulu" : undefined,
    });
    if (isConfirmed && reason) flagPost.mutate({ id: post.id, reason });
  };

  const handleUnflagPost = async (post: any) => {
    const result = await Swal2.fire({
      title: "Hapus Tanda Peringatan?",
      html: `Tanda peringatan pada postingan <strong>"${post.title}"</strong> akan dihapus.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Ya, Hapus Tanda",
      cancelButtonText: "Batal",
    });
    if (result.isConfirmed) unflagPost.mutate(post.id);
  };

  const handleBlockUser = async (u: any) => {
    const result = await SwalWarning.fire({
      title: "Blokir Pengguna?",
      html: `<strong>${u.full_name ?? "Pengguna ini"}</strong> tidak akan bisa login hingga diaktifkan kembali.<br/><br/>Mereka akan mendapat notifikasi pemblokiran.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Blokir",
      cancelButtonText: "Batal",
    });
    if (result.isConfirmed) blockUser.mutate(u.id);
  };

  const handleUnblockUser = async (u: any) => {
    const result = await Swal2.fire({
      title: "Aktifkan Kembali?",
      html: `<strong>${u.full_name ?? "Pengguna ini"}</strong> akan dapat login kembali ke aplikasi.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Aktifkan",
      cancelButtonText: "Batal",
    });
    if (result.isConfirmed) unblockUser.mutate(u.id);
  };

  const handleDeleteUser = async (u: any) => {
    const result = await SwalDanger.fire({
      title: "Hapus Akun Permanen?",
      html: `Akun <strong>${u.full_name ?? "Pengguna ini"}</strong> akan dihapus secara permanen dari sistem.<br/><br/><span style="color:#dc2626;font-size:13px">⚠️ Semua data terkait akan terhapus dan tidak bisa dipulihkan.</span>`,
      icon: "error",
      showCancelButton: true,
      confirmButtonText: "Hapus Permanen",
      cancelButtonText: "Batal",
    });
    if (result.isConfirmed) deleteUser.mutate(u.id);
  };

  const handleApproveReport = async (r: any) => {
    const result = await SwalWarning.fire({
      title: "Setujui Laporan?",
      html: `Laporan terhadap postingan <strong>"${r.post_title ?? "—"}"</strong> milik <strong>${r.post_author_name}</strong> akan disetujui.<br/><br/>
      <div style="background:#fef3c7;border-radius:8px;padding:10px 12px;margin-top:8px;text-align:left;font-size:13px">
        📝 Alasan: <strong>${r.reason}</strong><br/>
        👤 Dilaporkan oleh: <strong>${r.reporter_name}</strong>
      </div><br/>
      Postingan akan <strong>ditandai</strong> dan pemilik mendapat <strong>notifikasi</strong>.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Setuju & Tandai",
      cancelButtonText: "Batal",
    });
    if (result.isConfirmed) approveReport.mutate(r);
  };

  const handleRejectReport = async (r: any) => {
    const result = await Swal2.fire({
      title: "Tolak Laporan?",
      html: `Laporan terhadap postingan <strong>"${r.post_title ?? "—"}"</strong> akan ditolak tanpa tindakan apapun.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Tolak Laporan",
      cancelButtonText: "Batal",
    });
    if (result.isConfirmed) rejectReport.mutate(r.id);
  };

  const handleDeleteDiagnoses = async (ids: string[], label?: string) => {
    const result = await SwalDanger.fire({
      title: ids.length > 1 ? `Hapus ${ids.length} Data Diagnosa?` : "Hapus Data Diagnosa?",
      html: ids.length > 1
        ? `<strong>${ids.length} data diagnosa</strong> akan dihapus permanen dari sistem dan akun pengguna terkait.`
        : `Data diagnosa ${label ? `<strong>${label}</strong>` : "ini"} akan dihapus permanen.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Ya, Hapus",
      cancelButtonText: "Batal",
    });
    if (result.isConfirmed) deleteDiagnoses.mutate(ids);
  };

  // ── Render guard ───────────────────────────────────────────
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
    { id: "moderation", label: "Moderasi", icon: Flag },
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
            <t.icon className="h-3.5 w-3.5" /> {t.label}
            {(t as any).badge ? (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white">
                {(t as any).badge > 9 ? "9+" : (t as any).badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* ── Dashboard ─────────────────────────────────── */}
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
              { tab: "users" as AdminTab, icon: Users, label: "Manajemen Pengguna", desc: "Blokir, aktifkan, atau hapus akun pengguna" },
              { tab: "moderation" as AdminTab, icon: Flag, label: "Moderasi Konten", desc: "Tandai atau hapus postingan komunitas" },
              { tab: "reports" as AdminTab, icon: AlertTriangle, label: "Laporan User", desc: `${stats?.reports ?? 0} laporan menunggu persetujuan` },
            ].map((item) => (
              <button
                key={item.tab}
                onClick={() => setActiveTab(item.tab)}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-5 text-left shadow-card hover:shadow-elevated transition-all hover:-translate-y-0.5"
              >
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

      {/* ── Users ─────────────────────────────────────── */}
      {activeTab === "users" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Cari nama pengguna..."
                className="h-9 w-full rounded-xl border border-input bg-card pl-9 pr-3 text-sm outline-none focus:border-primary"
              />
            </div>
            <p className="text-xs text-muted-foreground">{users.length} pengguna</p>
          </div>
          <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-border bg-muted/30">
                  <tr>
                    {["Pengguna", "Info", "Lokasi", "Bergabung", "Status", "Aksi"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {usersLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}><td colSpan={6} className="px-4 py-3"><Skeleton className="h-8 w-full rounded-lg" /></td></tr>
                    ))
                  ) : users.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Tidak ada data pengguna</td></tr>
                  ) : (
                    users.map((u: any) => (
                      <tr key={u.id} className={cn("hover:bg-muted/30 transition-colors", u.is_blocked && "opacity-60 bg-destructive/5")}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="shrink-0">
                              {u.avatar_url ? (
                                <img
                                  src={`${u.avatar_url}?t=${u.updated_at ?? ""}`}
                                  alt=""
                                  className="h-8 w-8 rounded-full object-cover"
                                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                                />
                              ) : (
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                                  {(u.full_name || "?").slice(0, 2).toUpperCase()}
                                </div>
                              )}
                            </div>
                            <div>
                              <p className="font-semibold text-sm">{u.full_name ?? "Tanpa Nama"}</p>
                              <p className="text-[10px] text-muted-foreground font-mono">{u.id.slice(0, 8)}…</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {u.farmer_type && <p>{u.farmer_type}</p>}
                          {u.phone && <p>{u.phone}</p>}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{u.location ?? "—"}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {u.created_at ? format(parseISO(u.created_at), "d MMM yyyy", { locale: idLocale }) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          {u.is_blocked ? (
                            <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">Diblokir</span>
                          ) : (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Aktif</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {u.is_blocked ? (
                              <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs text-emerald-700 hover:bg-emerald-50" onClick={() => handleUnblockUser(u)}>
                                <UserCheck className="h-3 w-3" /> Aktifkan
                              </Button>
                            ) : (
                              <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs text-amber-700 hover:bg-amber-50" onClick={() => handleBlockUser(u)}>
                                <UserX className="h-3 w-3" /> Blokir
                              </Button>
                            )}
                            <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs text-destructive hover:bg-destructive/10" onClick={() => handleDeleteUser(u)}>
                              <Trash2 className="h-3 w-3" /> Hapus
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-xs text-muted-foreground px-1">
            💡 Memblokir mencegah user login sementara. Menghapus permanen tidak bisa dipulihkan. Keduanya mengirim notifikasi ke user.
          </p>
        </div>
      )}

      {/* ── Moderation ────────────────────────────────── */}
      {activeTab === "moderation" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
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
                  {f === "all" ? "Semua Postingan" : `⚠️ Ditandai (${posts.filter((p: any) => p.is_flagged).length})`}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground ml-auto">{posts.length} postingan</p>
          </div>

          <div className="rounded-xl bg-muted/30 border border-border px-4 py-3 text-xs text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground mb-1">Keterangan fitur:</p>
            <p>🚩 <strong>Tandai</strong> — Beri peringatan ke pemilik. Tanda otomatis hilang saat pemilik memperbarui postingan.</p>
            <p>✅ <strong>Hapus Tanda</strong> — Hapus status peringatan tanpa menghapus postingan.</p>
            <p>🗑️ <strong>Hapus</strong> — Hapus postingan permanen (tidak bisa dibatalkan).</p>
            <p>🔗 <strong>Lihat Postingan</strong> — Buka langsung di halaman komunitas.</p>
          </div>

          <div className="space-y-3">
            {postsLoading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)
            ) : posts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card/50 py-10 text-center">
                <CheckCircle className="mx-auto h-10 w-10 text-emerald-400/60" />
                <p className="mt-3 font-semibold">Tidak ada postingan yang perlu ditinjau</p>
              </div>
            ) : (
              posts.map((post: any) => (
                <div
                  key={post.id}
                  className={cn(
                    "rounded-2xl border bg-card shadow-card overflow-hidden",
                    post.is_flagged ? "border-amber-300/60 bg-amber-50/30 dark:bg-amber-950/10" : "border-border"
                  )}
                >
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        {/* Author + meta */}
                        <div className="flex items-center gap-2 mb-2">
                          {post.author_avatar ? (
                            <img
                              src={post.author_avatar}
                              alt=""
                              className="h-7 w-7 rounded-full object-cover shrink-0"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                            />
                          ) : (
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                              {(post.author_name || "?").slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="text-xs font-semibold">{post.author_name}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {post.created_at ? format(parseISO(post.created_at), "d MMM yyyy HH:mm", { locale: idLocale }) : "—"}
                            </p>
                          </div>
                          {post.is_flagged && (
                            <span className="ml-1 rounded-full bg-amber-100 border border-amber-300/60 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                              ⚠️ Ditandai
                            </span>
                          )}
                          {post.category && (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                              {post.category}
                            </span>
                          )}
                        </div>

                        {/* Title */}
                        <p className="font-semibold text-sm mb-1">{post.title}</p>

                        {/* Flagged reason */}
                        {post.is_flagged && post.flagged_reason && (
                          <p className="text-xs text-amber-700 mb-1.5">
                            📋 Alasan tanda: <strong>{post.flagged_reason}</strong>
                          </p>
                        )}

                        {/* Content preview — plain text, no expand */}
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {stripHtml(post.content)}
                        </p>

                        {/* Image thumb */}
                        {post.image_url && (
                          <img
                            src={post.image_url}
                            alt=""
                            className="mt-2 h-16 w-16 rounded-lg object-cover border border-border"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                          />
                        )}

                        {/* Link ke postingan asli */}
                        <Link
                          to="/community"
                          search={{ post: post.id }}
                          className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <OpenIcon className="h-3 w-3" /> Buka di Komunitas
                        </Link>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-1.5 shrink-0">
                        {post.is_flagged ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1 px-2 text-xs text-emerald-700 hover:bg-emerald-50"
                            onClick={() => handleUnflagPost(post)}
                          >
                            <FlagOff className="h-3 w-3" /> Hapus Tanda
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1 px-2 text-xs text-amber-700 hover:bg-amber-50"
                            onClick={() => handleFlagPost(post)}
                          >
                            <Flag className="h-3 w-3" /> Tandai
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 px-2 text-xs text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeletePost(post)}
                        >
                          <Trash2 className="h-3 w-3" /> Hapus
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── Reports ───────────────────────────────────── */}
      {activeTab === "reports" && (
        <div className="space-y-4">
          <div className="rounded-xl bg-muted/30 border border-border px-4 py-3 text-xs text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground mb-1">Alur laporan user:</p>
            <p>1. User melaporkan postingan dari tombol 🚩 di komunitas (dengan memilih alasan).</p>
            <p>2. Laporan masuk ke sini dengan status <strong>Menunggu</strong>.</p>
            <p>3. <strong>Setuju</strong> → postingan ditandai + pemilik mendapat notifikasi.</p>
            <p>4. <strong>Tolak</strong> → laporan ditutup tanpa aksi apapun.</p>
            <p>5. Tanda hilang otomatis saat pemilik postingan memperbaruinya.</p>
          </div>

          {reportsLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)
          ) : reports.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/50 py-10 text-center">
              <CheckCircle className="mx-auto h-10 w-10 text-emerald-400/60" />
              <p className="mt-3 font-semibold">Tidak ada laporan</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map((r: any) => (
                <div
                  key={r.id}
                  className={cn(
                    "rounded-2xl border bg-card p-4 shadow-card",
                    r.status === "pending"
                      ? "border-amber-300/40 bg-amber-50/20 dark:bg-amber-950/10"
                      : "border-border opacity-60"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle className={cn("mt-0.5 h-5 w-5 shrink-0", r.status === "pending" ? "text-amber-500" : "text-muted-foreground")} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className="font-semibold text-sm">Laporan #{r.id.slice(0, 6)}</span>
                        <span className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          r.status === "pending" ? "bg-amber-100 text-amber-700" :
                          r.status === "resolved" ? "bg-emerald-100 text-emerald-700" :
                          "bg-muted text-muted-foreground"
                        )}>
                          {r.status === "pending" ? "Menunggu" : r.status === "resolved" ? "Disetujui" : "Ditolak"}
                        </span>
                      </div>

                      <div className="rounded-lg bg-muted/50 p-3 space-y-1.5 text-xs text-muted-foreground mb-2">
                        <div className="flex gap-2">
                          <span className="w-28 shrink-0 font-semibold text-foreground/70">Alasan</span>
                          <span className="font-semibold text-foreground">{r.reason}</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="w-28 shrink-0 font-semibold text-foreground/70">Dilaporkan oleh</span>
                          <span>{r.reporter_name}</span>
                        </div>
                        {r.post_title && (
                          <div className="flex gap-2">
                            <span className="w-28 shrink-0 font-semibold text-foreground/70">Postingan</span>
                            <span>"{r.post_title}" — oleh {r.post_author_name}</span>
                          </div>
                        )}
                        <div className="flex gap-2">
                          <span className="w-28 shrink-0 font-semibold text-foreground/70">Waktu</span>
                          <span>{r.created_at ? format(parseISO(r.created_at), "d MMM yyyy HH:mm", { locale: idLocale }) : "—"}</span>
                        </div>
                      </div>

                      {r.post_id && (
                        <Link to="/community" search={{ post: r.post_id }} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                          <OpenIcon className="h-3 w-3" /> Lihat postingan di Komunitas
                        </Link>
                      )}
                    </div>

                    {r.status === "pending" && (
                      <div className="flex flex-col gap-1.5 shrink-0">
                        <Button
                          size="sm"
                          className="h-7 gap-1 px-2 text-xs bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => handleApproveReport(r)}
                        >
                          <CheckCircle className="h-3 w-3" /> Setuju
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 px-2 text-xs"
                          onClick={() => handleRejectReport(r)}
                        >
                          <XCircle className="h-3 w-3" /> Tolak
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Diagnoses ─────────────────────────────────── */}
      {activeTab === "diagnoses" && (
        <div className="space-y-3">
          {selectedDiagIds.size > 0 && (
            <div className="flex items-center gap-3 rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-2.5">
              <p className="text-sm font-semibold text-destructive flex-1">{selectedDiagIds.size} item dipilih</p>
              <Button size="sm" variant="outline" className="h-7 gap-1 px-3 text-xs" onClick={() => setSelectedDiagIds(new Set())}>
                Batal
              </Button>
              <Button
                size="sm"
                className="h-7 gap-1 px-3 text-xs bg-destructive hover:bg-destructive/90"
                onClick={() => handleDeleteDiagnoses([...selectedDiagIds])}
              >
                <Trash2 className="h-3 w-3" /> Hapus {selectedDiagIds.size} item
              </Button>
            </div>
          )}
          <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-border bg-muted/30">
                  <tr>
                    <th className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedDiagIds.size === diagLogs.length && diagLogs.length > 0}
                        onChange={(e) => setSelectedDiagIds(e.target.checked ? new Set(diagLogs.map((d: any) => d.id)) : new Set())}
                        className="rounded border-border"
                      />
                    </th>
                    {["Pengguna", "Tanaman", "Diagnosis", "Keparahan", "Keyakinan", "Tanggal", "Aksi"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {diagLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}><td colSpan={8} className="px-4 py-3"><Skeleton className="h-6 w-full rounded" /></td></tr>
                    ))
                  ) : diagLogs.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Tidak ada data diagnosa</td></tr>
                  ) : (
                    diagLogs.map((d: any) => (
                      <tr key={d.id} className={cn("hover:bg-muted/30 transition-colors", selectedDiagIds.has(d.id) && "bg-primary/5")}>
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedDiagIds.has(d.id)}
                            onChange={(e) => {
                              setSelectedDiagIds((prev) => {
                                const s = new Set(prev);
                                e.target.checked ? s.add(d.id) : s.delete(d.id);
                                return s;
                              });
                            }}
                            className="rounded border-border"
                          />
                        </td>
                        <td className="px-4 py-3 text-xs font-semibold">{d.user_name}</td>
                        <td className="px-4 py-3 text-xs">{d.plant_type ?? "—"}</td>
                        <td className="px-4 py-3 text-xs max-w-[180px] truncate" title={d.diagnosis}>{d.diagnosis}</td>
                        <td className="px-4 py-3">
                          <span className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                            d.severity === "Berat" ? "bg-destructive/10 text-destructive" :
                            d.severity === "Sedang" ? "bg-amber-100 text-amber-700" :
                            d.severity === "Ringan" ? "bg-emerald-100 text-emerald-700" :
                            "bg-muted text-muted-foreground"
                          )}>
                            {d.severity ?? "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{d.confidence_score ?? "—"}%</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {d.created_at ? format(parseISO(d.created_at), "d MMM yyyy", { locale: idLocale }) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1 px-2 text-xs text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteDiagnoses([d.id], d.diagnosis)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-xs text-muted-foreground px-1">
            Menghapus diagnosa di sini juga akan menghapusnya dari akun pengguna yang bersangkutan.
          </p>
        </div>
      )}
    </div>
  );
}