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

export const Route = createFileRoute("/register")({
  head: () => ({ meta: [{ title: "Daftar — TaniAI Nexus" }] }),
  component: RegisterPage,
});

const schema = z.object({
  full_name: z.string().min(2, "Nama minimal 2 karakter").max(80),
  email: z.string().email("Email tidak valid"),
  password: z.string().min(6, "Password minimal 6 karakter").max(72),
});

function RegisterPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "", password: "" });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { full_name: parsed.data.full_name },
      },
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Akun dibuat! Silakan masuk.");
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden bg-gradient-primary p-12 lg:flex lg:flex-col lg:justify-between">
        <Logo className="[&_span]:text-primary-foreground" />
        <div className="text-primary-foreground">
          <h2 className="text-4xl font-bold leading-tight">Gabung komunitas petani modern.</h2>
          <p className="mt-4 text-primary-foreground/80">Gratis selamanya untuk fitur dasar. Mulai diagnosis tanaman sekarang.</p>
        </div>
        <p className="text-xs text-primary-foreground/70">© 2026 TaniAI Nexus</p>
      </div>
      <div className="flex flex-col justify-center px-6 py-12 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <div className="lg:hidden mb-8"><Logo /></div>
          <h1 className="text-2xl font-bold tracking-tight">Buat akun gratis</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Sudah punya akun? <Link to="/login" className="font-semibold text-primary">Masuk</Link></p>
          <form onSubmit={submit} className="mt-8 space-y-4">
            <div>
              <Label htmlFor="name">Nama lengkap</Label>
              <Input id="name" value={form.full_name} onChange={(e)=>setForm(f=>({...f,full_name:e.target.value}))} placeholder="Petani Nusantara" required />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" value={form.email} onChange={(e)=>setForm(f=>({...f,email:e.target.value}))} placeholder="petani@email.com" required />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" autoComplete="new-password" value={form.password} onChange={(e)=>setForm(f=>({...f,password:e.target.value}))} placeholder="Min 6 karakter" required />
            </div>
            <Button type="submit" className="w-full bg-gradient-primary" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Daftar Gratis
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
