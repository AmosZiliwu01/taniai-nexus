import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Leaf, MessageCircle, CloudSun, BarChart3, ShoppingBag, Sparkles, Check, Star } from "lucide-react";
import heroImg from "@/assets/hero-ai-farming.jpg";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TaniAI Nexus — Platform AI Pertanian Indonesia" },
      { name: "description", content: "Diagnosis penyakit tanaman, asisten AI, cuaca, dan marketplace untuk petani Indonesia." },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: Leaf, title: "AI Plant Doctor", desc: "Diagnosis penyakit hanya dari foto daun, batang, atau buah." },
  { icon: MessageCircle, title: "AI Assistant", desc: "Tanya jawab pertanian Indonesia 24/7 dengan AI cerdas." },
  { icon: CloudSun, title: "Cuaca & Peringatan", desc: "Prediksi 7 hari dan peringatan dini risiko penyakit." },
  { icon: Sparkles, title: "Soil Analyzer", desc: "Rekomendasi pupuk dan tanaman dari analisis tanah." },
  { icon: ShoppingBag, title: "Marketplace", desc: "Jual hasil panen langsung ke pasar yang lebih luas." },
  { icon: BarChart3, title: "Analytics", desc: "Lacak kesehatan tanaman dan tren penyakit." },
];

const steps = [
  { n: "01", t: "Daftar gratis", d: "Buat akun TaniAI dalam 30 detik." },
  { n: "02", t: "Foto tanaman", d: "Unggah foto daun/buah untuk diagnosis instan." },
  { n: "03", t: "Aksi AI", d: "Ikuti rekomendasi AI dan jual hasil panen." },
];

const testimonials = [
  { name: "Budi S.", role: "Petani Cabai, Sleman", text: "Diagnosis penyakit super cepat. Panen saya naik 30% musim ini." },
  { name: "Sri W.", role: "Petani Tomat, Magelang", text: "Asisten AI menjawab seperti penyuluh pertanian profesional." },
  { name: "Hadi P.", role: "Petani Padi, Klaten", text: "Marketplace bantu saya menjual langsung tanpa tengkulak." },
];

const faqs = [
  { q: "Apakah TaniAI gratis?", a: "Ya, fitur dasar gratis. Tersedia paket Premium untuk fitur lanjutan." },
  { q: "Apakah AI memahami bahasa Indonesia?", a: "Tentu, semua AI dioptimalkan khusus untuk pertanian Indonesia." },
  { q: "Apakah saya butuh internet stabil?", a: "Hanya saat upload foto dan chat. Data dashboard tetap dapat diakses." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 lg:px-8">
          <Logo />
          <nav className="hidden items-center gap-8 md:flex">
            <a href="#fitur" className="text-sm font-medium text-muted-foreground hover:text-foreground">Fitur</a>
            <a href="#cara" className="text-sm font-medium text-muted-foreground hover:text-foreground">Cara Kerja</a>
            <a href="#testi" className="text-sm font-medium text-muted-foreground hover:text-foreground">Testimoni</a>
            <a href="#faq" className="text-sm font-medium text-muted-foreground hover:text-foreground">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login"><Button variant="ghost" size="sm">Masuk</Button></Link>
            <Link to="/register"><Button size="sm" className="bg-gradient-primary shadow-soft">Mulai Gratis</Button></Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-soft" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 lg:grid-cols-2 lg:px-8 lg:py-24">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Sparkles className="h-3.5 w-3.5" /> Powered by AI
            </div>
            <h1 className="mt-5 text-4xl font-bold tracking-tight text-foreground lg:text-6xl">
              Pertanian Cerdas, <span className="bg-gradient-primary bg-clip-text text-transparent">Panen Maksimal</span>
            </h1>
            <p className="mt-5 max-w-xl text-base text-muted-foreground lg:text-lg">
              TaniAI Nexus adalah platform AI lengkap untuk petani Indonesia. Diagnosis tanaman, asisten pintar, prediksi cuaca, dan marketplace — semuanya dalam satu aplikasi.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/register">
                <Button size="lg" className="bg-gradient-primary shadow-elevated">
                  Mulai Gratis <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
              <a href="#fitur"><Button size="lg" variant="outline">Lihat Fitur</Button></a>
            </div>
            <div className="mt-10 flex flex-wrap gap-8">
              {[["10K+","Petani"],["50K+","Diagnosis AI"],["98%","Akurasi"]].map(([n,l]) => (
                <div key={l}>
                  <p className="text-2xl font-bold lg:text-3xl">{n}</p>
                  <p className="text-xs text-muted-foreground">{l}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="relative">
            <div className="absolute -inset-4 rounded-3xl bg-gradient-primary opacity-20 blur-3xl" />
            <img src={heroImg} alt="AI farming dashboard" width={1536} height={1024}
              className="relative w-full rounded-3xl shadow-elevated" />
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="fitur" className="mx-auto max-w-7xl px-4 py-20 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight lg:text-4xl">Fitur Unggulan</h2>
          <p className="mt-3 text-muted-foreground">Semua yang petani modern butuhkan dalam satu platform.</p>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="group rounded-2xl border border-border bg-card p-6 shadow-card transition-all hover:-translate-y-1 hover:shadow-elevated">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-primary shadow-soft">
                <f.icon className="h-6 w-6 text-primary-foreground" />
              </div>
              <h3 className="mt-5 text-lg font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Steps */}
      <section id="cara" className="bg-gradient-soft py-20">
        <div className="mx-auto max-w-7xl px-4 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight lg:text-4xl">Cara Kerja</h2>
            <p className="mt-3 text-muted-foreground">Tiga langkah sederhana untuk pertanian cerdas.</p>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {steps.map((s) => (
              <div key={s.n} className="rounded-2xl border border-border bg-card p-6 shadow-card">
                <span className="text-3xl font-bold text-primary/30">{s.n}</span>
                <h3 className="mt-3 text-lg font-semibold">{s.t}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testi" className="mx-auto max-w-7xl px-4 py-20 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight lg:text-4xl">Dipercaya Petani Indonesia</h2>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {testimonials.map((t) => (
            <div key={t.name} className="rounded-2xl border border-border bg-card p-6 shadow-card">
              <div className="flex gap-1 text-warning">
                {Array.from({length:5}).map((_,i)=><Star key={i} className="h-4 w-4 fill-current" />)}
              </div>
              <p className="mt-4 text-sm text-foreground">"{t.text}"</p>
              <div className="mt-5">
                <p className="text-sm font-semibold">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.role}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="bg-gradient-soft py-20">
        <div className="mx-auto max-w-3xl px-4 lg:px-8">
          <h2 className="text-center text-3xl font-bold tracking-tight lg:text-4xl">Pertanyaan Umum</h2>
          <div className="mt-10 space-y-3">
            {faqs.map((f) => (
              <details key={f.q} className="group rounded-2xl border border-border bg-card p-5 shadow-card">
                <summary className="flex cursor-pointer items-center justify-between text-sm font-semibold">
                  {f.q}<Check className="h-4 w-4 text-primary transition-transform group-open:rotate-45" />
                </summary>
                <p className="mt-3 text-sm text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 py-20 lg:px-8">
        <div className="overflow-hidden rounded-3xl bg-gradient-primary p-10 shadow-elevated lg:p-16">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight text-primary-foreground lg:text-4xl">
              Siap meningkatkan hasil panen Anda?
            </h2>
            <p className="mt-3 text-primary-foreground/90">Bergabung gratis hari ini. Tidak perlu kartu kredit.</p>
            <Link to="/register" className="mt-8 inline-block">
              <Button size="lg" variant="secondary" className="shadow-elevated">
                Daftar Sekarang <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border bg-background py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:flex-row lg:px-8">
          <Logo />
          <p className="text-xs text-muted-foreground">© 2026 TaniAI Nexus. Dibuat untuk petani Indonesia.</p>
        </div>
      </footer>
    </div>
  );
}
