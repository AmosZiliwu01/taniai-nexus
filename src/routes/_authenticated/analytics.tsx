// src/routes/_authenticated/analytics.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePlants } from "@/hooks/useUserPlants";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { BarChart3, Leaf, MessageCircle, Sprout, AlertTriangle, Calendar, Plus } from "lucide-react";
import { format, parseISO, subDays, eachDayOfInterval } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({ meta: [{ title: "Analytics — TaniAI Nexus" }] }),
  component: Analytics,
});

const COLORS = ["#16a34a", "#f59e0b", "#ef4444", "#3b82f6", "#8b5cf6", "#ec4899"];

function StatCard({ icon: Icon, label, value, sub, tone = "default" }: {
  icon: typeof Leaf; label: string; value: string | number; sub: string; tone?: string;
}) {
  const tones: Record<string, string> = {
    default: "bg-muted text-muted-foreground",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    info: "bg-primary/10 text-primary",
  };
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl", tones[tone] ?? tones.default)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

function Analytics() {
  const { data: plants = [], isLoading: plantsLoading } = usePlants();

  const { data: diagnoses = [], isLoading: diagLoading } = useQuery({
    queryKey: ["analytics-diagnoses"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase
        .from("plant_diagnoses")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: aiChats = [] } = useQuery({
    queryKey: ["analytics-ai-chats"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase
        .from("ai_conversations")
        .select("id, created_at")
        .eq("user_id", user.id);
      return data ?? [];
    },
  });

  const isLoading = plantsLoading || diagLoading;

  // Filter diagnosis yang valid: is_plant_image = true, severity bukan "Tidak Diketahui", dan bukan diagnosis sampah
  const validDiagnoses = diagnoses.filter(d => 
    d.is_plant_image === true && 
    d.severity !== "Tidak Diketahui" &&
    d.diagnosis !== "Tidak pasti" &&
    d.diagnosis !== "Analisis Tidak Dapat Diproses" &&
    d.diagnosis !== "Gambar bukan tanaman" &&
    d.diagnosis !== "Analisis Tidak Pasti"
  );

  const totalDiagnoses = diagnoses.length;
  const activePlants = plants.filter((p) => p.status === "Aktif");
  const heavyDiag = validDiagnoses.filter((d) => d.severity === "Berat").length;
  const healthyCount = validDiagnoses.filter((d) => d.severity === "Ringan").length;
  const healthyRate = validDiagnoses.length > 0
    ? Math.round((healthyCount / validDiagnoses.length) * 100)
    : 0;

  const hasData = plants.length > 0 || totalDiagnoses > 0;

  if (!isLoading && !hasData) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground">Statistik dan aktivitas pertanian Anda</p>
        </div>
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-border bg-card/50 py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <BarChart3 className="h-8 w-8 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-lg">Belum ada data</p>
            <p className="mt-1 text-sm text-muted-foreground max-w-sm">
              Tambahkan tanaman dan lakukan diagnosa untuk melihat statistik pertanian Anda di sini.
            </p>
          </div>
          <div className="flex gap-3">
            <Button asChild className="gap-2">
              <Link to="/plants"><Plus className="h-4 w-4" /> Tambah Tanaman</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/plant-doctor"><Leaf className="h-4 w-4" /> Diagnosa Sekarang</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Diagnoses per day (last 14 days) — tetap semua diagnosa
  const last14Days = eachDayOfInterval({ start: subDays(new Date(), 13), end: new Date() });
  const diagByDay = last14Days.map((day) => {
    const label = format(day, "d/M");
    const count = diagnoses.filter((d) => format(parseISO(d.created_at), "yyyy-MM-dd") === format(day, "yyyy-MM-dd")).length;
    return { label, count };
  });

  // Diseases frequency — HANYA validDiagnoses
  const diseaseMap: Record<string, number> = {};
  validDiagnoses.forEach((d) => {
    const key = d.diagnosis || "Unknown";
    diseaseMap[key] = (diseaseMap[key] || 0) + 1;
  });
  const diseaseData = Object.entries(diseaseMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, value]) => ({ name: name.length > 20 ? name.slice(0, 20) + "..." : name, value }));

  // Severity distribution — hanya validDiagnoses
  const sevMap: Record<string, number> = { Ringan: 0, Sedang: 0, Berat: 0 };
  validDiagnoses.forEach((d) => { if (d.severity && sevMap[d.severity] !== undefined) sevMap[d.severity]++; });
  const sevData = Object.entries(sevMap).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">Statistik dan aktivitas pertanian Anda</p>
      </div>

      {/* Stat cards */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1,2,3,4].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={Sprout} label="Tanaman Aktif" value={activePlants.length}
            sub={activePlants.slice(0, 2).map((p) => p.name).join(", ") || "Tidak ada"} tone="success" />
          <StatCard icon={Leaf} label="Total Diagnosa" value={totalDiagnoses}
            sub={`${heavyDiag} kasus berat`} tone={heavyDiag > 0 ? "warning" : "info"} />
          <StatCard icon={MessageCircle} label="AI Conversations" value={aiChats.length}
            sub="Total sesi tanya AI" tone="info" />
          <StatCard icon={AlertTriangle} label="Tingkat Sehat" value={`${healthyRate}%`}
            sub={`${healthyCount} diagnosa ringan`}
            tone={healthyRate > 60 ? "success" : "warning"} />
        </div>
      )}

      {/* Charts Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Diagnoses over time */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Leaf className="h-4 w-4 text-primary" /> Diagnosa 14 Hari Terakhir
          </h2>
          {diagByDay.every((d) => d.count === 0) ? (
            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
              Belum ada data diagnosa
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={diagByDay} barSize={16}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: "12px", border: "1px solid hsl(var(--border))", fontSize: "12px" }}
                  formatter={(v) => [v, "Diagnosa"]}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Disease frequency — hanya penyakit valid */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" /> Penyakit Terbanyak
          </h2>
          {diseaseData.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
              Belum ada data penyakit yang terkonfirmasi
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={diseaseData} layout="vertical" barSize={14}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={100} />
                <Tooltip
                  contentStyle={{ borderRadius: "12px", border: "1px solid hsl(var(--border))", fontSize: "12px" }}
                  formatter={(v) => [v, "Kasus"]}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {diseaseData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Severity pie — dengan warna yang benar */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" /> Distribusi Keparahan
          </h2>
          {sevData.every((s) => s.value === 0) ? (
            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
              Belum ada data diagnosa valid
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={160}>
                <PieChart>
                  <Pie data={sevData} cx="50%" cy="50%" outerRadius={65} dataKey="value" label={false}>
                    {sevData.map((entry) => {
                      let color = "#16a34a"; // Ringan hijau
                      if (entry.name === "Sedang") color = "#f59e0b";
                      if (entry.name === "Berat") color = "#ef4444";
                      return <Cell key={entry.name} fill={color} />;
                    })}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, n]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 flex-1">
                {sevData.map((s) => {
                  let color = "#16a34a";
                  if (s.name === "Sedang") color = "#f59e0b";
                  if (s.name === "Berat") color = "#ef4444";
                  return (
                    <div key={s.name} className="flex items-center gap-2 text-sm">
                      <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <span className="flex-1">{s.name}</span>
                      <span className="font-bold">{s.value}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Plants list */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <h2 className="font-semibold mb-4 flex items-center justify-between">
            <span className="flex items-center gap-2"><Sprout className="h-4 w-4 text-primary" /> Tanaman Terdaftar</span>
            <Button asChild size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs">
              <Link to="/plants"><Plus className="h-3 w-3" /> Tambah</Link>
            </Button>
          </h2>
          {plants.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
              <Sprout className="h-8 w-8 opacity-30" />
              <p>Belum ada tanaman</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {plants.slice(0, 6).map((p) => (
                <div key={p.id} className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-3 py-2.5">
                  <div className="text-xl shrink-0">
                    {p.name.toLowerCase().includes("padi") ? "🌾" : p.name.toLowerCase().includes("cabai") ? "🌶️" : p.name.toLowerCase().includes("tomat") ? "🍅" : "🌱"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.age_days} HST · {p.soil_condition}</p>
                  </div>
                  <span className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    p.status === "Aktif" ? "bg-success/10 text-success"
                      : p.status === "Panen" ? "bg-blue-100 text-blue-700"
                      : "bg-muted text-muted-foreground"
                  )}>
                    {p.status}
                  </span>
                </div>
              ))}
              {plants.length > 6 && (
                <Button asChild variant="ghost" size="sm" className="w-full text-xs">
                  <Link to="/plants">Lihat semua {plants.length} tanaman →</Link>
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Recent diagnoses — tampilkan semua dengan label tidak valid */}
      {totalDiagnoses > 0 && (
        <div className="rounded-2xl border border-border bg-card shadow-card">
          <div className="border-b border-border px-5 py-4 flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" /> Catatan Diagnosa
            </h2>
            <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
              <Link to="/plant-doctor">Diagnosa baru →</Link>
            </Button>
          </div>
          <div className="divide-y divide-border">
            {diagnoses.slice(0, 5).map((d) => {
              const isValid = d.is_plant_image === true && d.severity !== "Tidak Diketahui";
              return (
                <div key={d.id} className="flex items-center gap-3 px-5 py-3">
                  {d.image_url ? (
                    <img src={d.image_url} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Leaf className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="truncate text-sm font-semibold">{d.diagnosis}</p>
                      {!isValid && (
                        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">
                          Tidak valid
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {d.plant_type} · {format(parseISO(d.created_at), "d MMM yyyy", { locale: idLocale })}
                      {d.location && ` · 📍 ${d.location}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {d.confidence_score && (
                      <span className="text-xs text-muted-foreground">{d.confidence_score}%</span>
                    )}
                    <span className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      d.severity === "Berat" ? "bg-destructive/10 text-destructive"
                        : d.severity === "Sedang" ? "bg-warning/10 text-warning"
                        : d.severity === "Ringan" ? "bg-success/10 text-success"
                        : "bg-muted text-muted-foreground"
                    )}>{d.severity ?? "—"}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}