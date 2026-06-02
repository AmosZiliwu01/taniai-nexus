// src/routes/login.tsx
import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import Swal from "sweetalert2";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Masuk — TaniAI Nexus" }] }),
  component: LoginPage,
});

const schema = z.object({
  email: z.string().email("Email tidak valid"),
  password: z.string().min(6, "Min 6 karakter"),
});

function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);

    // 1. Login ke Supabase Auth
    const { data: authData, error: loginError } = await supabase.auth.signInWithPassword(
      parsed.data,
    );
    if (loginError) {
      setLoading(false);
      toast.error(loginError.message);
      return;
    }

    const userId = authData.user?.id;
    if (!userId) {
      setLoading(false);
      toast.error("Gagal memuat data user");
      await supabase.auth.signOut();
      return;
    }

    // 2. Cek apakah user diblokir
    const { data: blockedRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "blocked")
      .maybeSingle();

    if (blockedRole) {
      await supabase.auth.signOut();
      setLoading(false);
      await Swal.fire({
        icon: "error",
        title: "Akun Diblokir",
        text: "Akun Anda telah diblokir oleh admin. Silakan hubungi administrator untuk informasi lebih lanjut.",
        confirmButtonText: "Mengerti",
        confirmButtonColor: "#d33",
      });
      return;
    }

    // 3. Cek apakah profil user masih ada (akun tidak dihapus)
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (profileError || !profile) {
      await supabase.auth.signOut();
      setLoading(false);
      await Swal.fire({
        icon: "error",
        title: "Akun Tidak Ditemukan",
        text: "Akun Anda sudah tidak aktif atau telah dihapus. Silakan hubungi admin atau daftar ulang.",
        confirmButtonText: "Mengerti",
        confirmButtonColor: "#d33",
      });
      return;
    }

    // 4. Login berhasil, tidak ada blokir/penghapusan
    setLoading(false);
    toast.success("Selamat datang kembali!");
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden bg-gradient-primary p-12 lg:flex lg:flex-col lg:justify-between">
        <Logo className="[&_span]:text-primary-foreground" />
        <div className="text-primary-foreground">
          <h2 className="text-4xl font-bold leading-tight">Pertanian cerdas dimulai di sini.</h2>
          <p className="mt-4 text-primary-foreground/80">
            Gabung ribuan petani Indonesia yang sudah meningkatkan panen dengan AI.
          </p>
        </div>
        <p className="text-xs text-primary-foreground/70">© 2026 TaniAI Nexus</p>
      </div>
      <div className="flex flex-col justify-center px-6 py-12 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <div className="lg:hidden mb-8">
            <Logo />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Masuk ke akun</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Belum punya akun?{" "}
            <Link to="/register" className="font-semibold text-primary">
              Daftar gratis
            </Link>
          </p>
          <form onSubmit={submit} className="mt-8 space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="petani@taniai.com"
                required
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="••••••••"
                required
              />
            </div>
            <Button type="submit" className="w-full bg-gradient-primary" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Masuk
            </Button>
          </form>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            <Link to="/" className="hover:text-foreground">
              ← Kembali ke beranda
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
