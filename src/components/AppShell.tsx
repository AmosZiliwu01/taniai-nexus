import { useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Leaf,
  MessageCircle,
  CloudSun,
  ShoppingCart,
  BookOpen,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  Bell,
  Search,
  Shield,
  User as UserIcon,
  Users,
  ClipboardList,
  X,
  CheckCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useNotifications, getNotificationLink } from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";
import { id } from "date-fns/locale";
import { formatNotificationBody } from "@/hooks/useNotifications";
// ─── Desktop sidebar nav links ───────────────────────────────────────────────
const navGroups = [
  {
    label: "Utama",
    items: [
      { to: "/dashboard", icon: LayoutDashboard, label: "Beranda" },
      { to: "/plant-doctor", icon: Leaf, label: "Diagnosa Tanaman" },
      { to: "/assistant", icon: MessageCircle, label: "AI Assistant" },
    ],
  },
  {
    label: "Informasi",
    items: [
      { to: "/weather", icon: CloudSun, label: "Cuaca & Peringatan" },
      { to: "/marketplace", icon: ShoppingCart, label: "Harga Pasar" },
      { to: "/articles", icon: BookOpen, label: "Edukasi" },
    ],
  },
  {
    label: "Aktivitas",
    items: [
      { to: "/plants", icon: ClipboardList, label: "Tanaman Saya" },
      { to: "/community", icon: Users, label: "Komunitas" },
      { to: "/analytics", icon: BarChart3, label: "Analytics" },
    ],
  },
] as const;

const mobileNav = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Beranda" },
  { to: "/plant-doctor", icon: Leaf, label: "Tanaman" },
  { to: "/assistant", icon: MessageCircle, label: "AI Chat" },
  { to: "/community", icon: Users, label: "Komunitas" },
  { to: "/profile", icon: UserIcon, label: "Akun" },
] as const;

// ─── NavList (sidebar) ────────────────────────────────────────────────────────
function NavList({
  pathname,
  onClick,
  isAdmin,
}: {
  pathname: string;
  onClick?: () => void;
  isAdmin?: boolean;
}) {
  return (
    <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 py-3 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      {navGroups.map((group) => (
        <div key={group.label}>
          <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
            {group.label}
          </p>
          <div className="space-y-0.5">
            {group.items.map((n) => {
              const active = pathname === n.to || pathname.startsWith(n.to + "/");
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  onClick={onClick}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                  )}
                >
                  <n.icon className="h-[17px] w-[17px] shrink-0" />
                  {n.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}

      {isAdmin && (
        <div>
          <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
            Admin
          </p>
          <Link
            to="/admin"
            onClick={onClick}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              pathname.startsWith("/admin")
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
            )}
          >
            <Shield className="h-[17px] w-[17px] shrink-0" /> Admin Panel
          </Link>
        </div>
      )}
    </nav>
  );
}

// ─── Global Search ────────────────────────────────────────────────────────────
const searchItems = [
  {
    label: "Diagnosa Tanaman",
    desc: "Analisa penyakit dari foto",
    url: "/plant-doctor",
    icon: "🌿",
  },
  { label: "AI Assistant", desc: "Tanya seputar pertanian", url: "/assistant", icon: "🤖" },
  { label: "Cuaca & Peringatan", desc: "Info cuaca real-time", url: "/weather", icon: "🌤️" },
  { label: "Harga Pasar", desc: "Harga komoditas terkini", url: "/marketplace", icon: "📊" },
  { label: "Tanaman Saya", desc: "Manajemen tanaman", url: "/plants", icon: "🪴" },
  { label: "Komunitas Petani", desc: "Diskusi dan berbagi", url: "/community", icon: "👥" },
  { label: "Edukasi", desc: "Artikel pertanian", url: "/articles", icon: "📖" },
  { label: "Analytics", desc: "Statistik pertanian Anda", url: "/analytics", icon: "📈" },
  { label: "Pengaturan", desc: "Profil dan preferensi", url: "/profile", icon: "⚙️" },
];

function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const results =
    query.length >= 1
      ? searchItems
          .filter(
            (i) =>
              i.label.toLowerCase().includes(query.toLowerCase()) ||
              i.desc.toLowerCase().includes(query.toLowerCase()),
          )
          .slice(0, 6)
      : [];

  const handleSelect = (url: string) => {
    navigate({ to: url });
    setQuery("");
    setOpen(false);
  };

  return (
    <div className="relative hidden max-w-xs flex-1 md:block">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(e.target.value.length > 0);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onFocus={() => query.length > 0 && setOpen(true)}
        placeholder="Cari fitur, tanaman, artikel..."
        className="h-9 w-full rounded-xl border border-input bg-card pl-9 pr-3 text-sm shadow-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
      {open && results.length > 0 && (
        <div className="absolute left-0 top-11 z-50 w-72 overflow-hidden rounded-xl border border-border bg-card shadow-elevated">
          {results.map((item) => (
            <button
              key={item.url}
              onMouseDown={() => handleSelect(item.url)}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/50 transition-colors"
            >
              <span className="text-lg">{item.icon}</span>
              <div>
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Notification Dropdown ────────────────────────────────────────────────────
function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();

  const typeIcon: Record<string, string> = {
    warning: "🌧️",
    success: "✅",
    community: "💬",
    diagnosis: "🌿",
    weather: "⛅",
    info: "ℹ️",
  };

  const handleNotificationClick = (notif: any) => {
    const link = getNotificationLink(notif);
    markRead.mutate(notif.id);
    setOpen(false);

    // Ekstrak postId dari body JSON
    let postId = null;
    try {
      const parsed = JSON.parse(notif.body || "{}");
      postId = parsed.post_id || null;
    } catch {
      const match = (notif.body || "").match(/POST_ID:([a-f0-9-]+)/);
      postId = match ? match[1] : null;
    }

    if (
      (notif.type === "community" || notif.type === "warning" || notif.type === "success") &&
      postId
    ) {
      navigate({ to: "/community", search: { post: postId } } as any);
    } else {
      navigate({ to: link as any });
    }
  };

  const cleanBody = (body: string | null) => {
    return formatNotificationBody(body);
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="relative h-9 w-9"
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="h-[18px] w-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-2xl border border-border bg-card shadow-elevated">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="font-semibold text-sm">Notifikasi</span>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 px-2 text-xs"
                    onClick={() => markAllRead.mutate()}
                  >
                    <CheckCheck className="h-3 w-3" /> Tandai semua
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setOpen(false)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  <Bell className="mx-auto mb-2 h-8 w-8 opacity-30" />
                  Belum ada notifikasi
                </div>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={cn(
                      "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50",
                      !n.is_read && "bg-primary/5",
                    )}
                  >
                    <span className="mt-0.5 text-base shrink-0">
                      {typeIcon[n.type ?? "info"] ?? "ℹ️"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-sm leading-snug", !n.is_read && "font-semibold")}>
                        {n.title}
                      </p>
                      {n.body && (
                        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                          {cleanBody(n.body)}
                        </p>
                      )}
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(n.created_at), {
                          addSuffix: true,
                          locale: id,
                        })}
                      </p>
                    </div>
                    {!n.is_read && (
                      <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── UserAvatar: avatar kecil di topbar dengan fallback inisial yang benar ───
// Menggantikan shadcn Avatar agar onError tidak menyembunyikan img secara paksa
// dan fallback inisial selalu tampil saat foto belum/tidak bisa dimuat.
function UserAvatarButton({
  name,
  email,
  avatarUrl,
}: {
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
}) {
  const [imgFailed, setImgFailed] = useState(false);

  // Hitung ulang saat avatarUrl berubah (login dengan akun berbeda)
  // dengan mereset imgFailed
  const [currentSrc, setCurrentSrc] = useState(avatarUrl);
  if (avatarUrl !== currentSrc) {
    setCurrentSrc(avatarUrl);
    setImgFailed(false);
  }

  const displayName = name?.trim() || email?.split("@")[0] || "User";
  const initials = displayName.slice(0, 2).toUpperCase();
  const subLabel = email?.split("@")[0] ?? "";

  return (
    <div className="flex items-center gap-2 rounded-xl p-1 pr-2 hover:bg-muted/50 transition-colors cursor-pointer">
      {/* Avatar dengan fallback inisial */}
      <div className="relative h-8 w-8 shrink-0">
        {avatarUrl && !imgFailed ? (
          <img
            src={avatarUrl}
            alt={displayName}
            className="h-8 w-8 rounded-full object-cover ring-2 ring-primary/20"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="h-8 w-8 rounded-full ring-2 ring-primary/20 bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">
            {initials}
          </div>
        )}
      </div>
      {/* Nama & email — hanya tampil di sm ke atas */}
      <div className="hidden sm:block text-left">
        <p className="text-xs font-semibold leading-none">{displayName}</p>
        {subLabel && <p className="mt-0.5 text-[10px] text-muted-foreground">{subLabel}</p>}
      </div>
    </div>
  );
}

// ─── Main AppShell ────────────────────────────────────────────────────────────
export function AppShell({
  children,
  user,
  isAdmin,
}: {
  children: ReactNode;
  user: { email?: string | null; full_name?: string | null; avatar_url?: string | null };
  isAdmin: boolean;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Anda telah keluar");
    navigate({ to: "/" });
  };

  const Sidebar = (
    <aside className="flex h-full w-64 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex h-16 shrink-0 items-center px-5">
        <Logo />
      </div>
      <div className="flex flex-1 flex-col overflow-hidden">
        <NavList pathname={pathname} onClick={() => setSidebarOpen(false)} isAdmin={isAdmin} />
      </div>
      <div className="shrink-0 border-t border-sidebar-border p-3">
        <Link
          to="/profile"
          onClick={() => setSidebarOpen(false)}
          className={cn(
            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
            pathname === "/profile"
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
          )}
        >
          <Settings className="h-[17px] w-[17px] shrink-0" /> Pengaturan
        </Link>
        <button
          onClick={handleSignOut}
          className="mt-0.5 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut className="h-[17px] w-[17px] shrink-0" /> Keluar
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 h-full">{Sidebar}</div>

      <div className="flex min-w-0 flex-1 flex-col h-full overflow-hidden">
        {/* Topbar */}
        <header className="shrink-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md lg:px-6">
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 lg:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              {Sidebar}
            </SheetContent>
          </Sheet>

          <GlobalSearch />

          <div className="ml-auto flex items-center gap-1.5">
            <NotificationDropdown />
            {/* ── Ganti komponen Avatar lama dengan UserAvatarButton ─────── */}
            {/* Komponen baru ini menangani fallback dengan benar untuk semua
                role user (bukan hanya admin) dan tidak menyembunyikan gambar
                saat error tanpa memunculkan fallback inisial. */}
            <Link to="/profile">
              <UserAvatarButton
                name={user.full_name ?? null}
                email={user.email ?? null}
                avatarUrl={user.avatar_url ?? null}
              />
            </Link>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 pb-24 pt-6 lg:px-8 lg:pb-10">{children}</main>

        <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur-lg lg:hidden">
          <div className="grid grid-cols-5">
            {mobileNav.map((n) => {
              const active = pathname === n.to || pathname.startsWith(n.to + "/");
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={cn(
                    "flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors",
                    active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <n.icon className={cn("h-5 w-5", active && "scale-110 transition-transform")} />
                  {n.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
