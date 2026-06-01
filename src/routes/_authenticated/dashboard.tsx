import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePlants } from "@/hooks/useUserPlants";
import { useWeather, getWeatherSummary } from "@/hooks/useWeather";
import { conditionToLucideIcon, conditionToColor } from "@/services/weather/weatherService";
import { fetchMarketData, getPricesForCrops } from "@/services/market/marketService";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Leaf, MessageCircle, CloudSun, TrendingUp, TrendingDown, Minus,
  AlertTriangle, Plus, Sprout, ClipboardList, ShoppingCart, Users,
  Sun, Cloud, CloudRain, CloudLightning, Thermometer, Droplets, Wind,
  Eye, Clock, RefreshCw, MapPin, CheckCircle2, WifiOff,
} from "lucide-react";
import { differenceInDays, parseISO, format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Beranda — TaniAI Nexus" }] }),
  component: Dashboard,
});

const WEATHER_ICONS: Record<string, typeof Sun> = {
  "cloud-lightning": CloudLightning,
  "cloud-rain": CloudRain,
  "cloud-drizzle": CloudRain,
  "cloud-fog": Cloud,
  "cloud-sun": CloudSun,
  cloud: Cloud,
  sun: Sun,
};

function WeatherIcon({ condition, className }: { condition: string; className?: string }) {
  const iconName = conditionToLucideIcon(condition);
  const Icon = WEATHER_ICONS[iconName] ?? CloudSun;
  return <Icon className={className} />;
}

// ─── Empty State ─────────────────────────────────────────────────────────────
function EmptyPlants() {
  return (
    <div className="rounded-2xl border-2 border-dashed border-border bg-card/50 p-10 text-center">
      <Sprout className="mx-auto h-12 w-12 text-primary/40" />
      <h3 className="mt-4 font-semibold text-foreground">Belum ada tanaman</h3>
      <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
        Tambahkan tanaman Anda untuk mendapatkan rekomendasi AI, peringatan penyakit, dan harga pasar yang relevan.
      </p>
      <Button asChild className="mt-4 bg-gradient-to-r from-primary to-primary/80">
        <Link to="/plants">
          <Plus className="mr-2 h-4 w-4" /> Tambah Tanaman Pertama
        </Link>
      </Button>
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({
  icon: Icon, label, value, sub, tone = "default", href,
}: {
  icon: typeof Leaf; label: string; value: string | number; sub: string;
  tone?: "default" | "warn" | "success" | "info"; href?: string;
}) {
  const tones = {
    default: "bg-muted text-muted-foreground",
    warn: "bg-warning/10 text-warning",
    success: "bg-success/10 text-success",
    info: "bg-info/10 text-info",
  };
  const card = (
    <div className="group rounded-2xl border border-border bg-card p-5 shadow-card transition-all hover:shadow-elevated hover:-translate-y-0.5">
      <div className="flex items-start gap-4">
        <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", tones[tone])}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-0.5 text-xl font-bold">{value}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
        </div>
      </div>
    </div>
  );
  if (href) return <Link to={href}>{card}</Link>;
  return card;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard() {
  // User profile
  const { data: profile } = useQuery({
    queryKey: ["dashboard-profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("full_name, location").eq("id", user.id).maybeSingle();
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  // User plants
  const { data: plants = [], isLoading: plantsLoading } = usePlants();
  const activePlants = plants.filter((p) => p.status === "Aktif");

  // Weather
  const { weather, weatherLoading, location, isRealtime } = useWeather();

  // Recent diagnoses
  const { data: recentDiagnoses = [] } = useQuery({
    queryKey: ["recent-diagnoses-dashboard"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase
        .from("plant_diagnoses").select("*").eq("user_id", user.id)
        .order("created_at", { ascending: false }).limit(4);
      return data ?? [];
    },
  });

  // Market prices — untuk tanaman user
  const { data: marketData, isError: marketError, refetch: refetchMarket, isFetching: marketFetching } = useQuery({
    queryKey: ["market-dashboard", activePlants.map((p) => p.name).join(",")],
    queryFn: () => fetchMarketData(profile?.location ?? "Nasional"),
    staleTime: 30 * 60 * 1000,
    enabled: activePlants.length > 0,
    retry: 1,
  });

  // Hanya tampilkan jika data real-time dari BPN, bukan fallback/referensi
  const relevantPrices = marketData?.isRealtime
    ? getPricesForCrops(marketData.prices, activePlants.map((p) => p.name)).slice(0, 4)
    : [];
  const showMarketError = !marketData?.isRealtime && (marketError || activePlants.length > 0);

  // Stats
  const diagnosisCount = recentDiagnoses.length;
  const weatherSummary = weather ? `${weather.current.condition} · ${weather.current.temp}°C` : "Memuat...";
  const firstName = profile?.full_name?.split(" ")[0] ?? "Petani";
  const hour = new Date().getHours();
  const greeting = hour < 11 ? "Selamat pagi" : hour < 15 ? "Selamat siang" : hour < 18 ? "Selamat sore" : "Selamat malam";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {greeting}, {firstName}! 🌱
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {format(new Date(), "EEEE, d MMMM yyyy", { locale: idLocale })}
            {location && <> · 📍 {location.displayName}</>}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild size="sm" className="bg-gradient-to-r from-primary to-primary/80 shadow-sm">
            <Link to="/plant-doctor">
              <Leaf className="mr-1.5 h-4 w-4" /> Diagnosa Cepat
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/assistant">
              <MessageCircle className="mr-1.5 h-4 w-4" /> Tanya AI
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Sprout} label="Tanaman Aktif"
          value={plantsLoading ? "..." : activePlants.length}
          sub={activePlants.length === 0 ? "Belum ada tanaman" : `${activePlants.map(p => p.name).slice(0, 2).join(", ")}${activePlants.length > 2 ? ", ..." : ""}`}
          tone="success" href="/plants"
        />
        <StatCard
          icon={Leaf} label="Total Diagnosa"
          value={diagnosisCount}
          sub={diagnosisCount === 0 ? "Belum ada diagnosa" : "Lihat riwayat →"}
          tone="info" href="/plant-doctor"
        />
        <StatCard
          icon={CloudSun} label="Cuaca Sekarang"
          value={weatherLoading ? "..." : `${weather?.current.temp ?? "—"}°C`}
          sub={weatherLoading ? "Memuat..." : weatherSummary}
          tone={weather?.alerts && weather.alerts.length > 0 ? "warn" : "default"}
          href="/weather"
        />
        <StatCard
          icon={AlertTriangle} label="Peringatan Aktif"
          value={weather?.alerts.length ?? 0}
          sub={weather?.alerts[0]?.title ?? "Tidak ada peringatan"}
          tone={weather?.alerts && weather.alerts.length > 0 ? "warn" : "success"}
          href="/weather"
        />
      </div>

      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Plants + Diagnoses */}
        <div className="space-y-6 lg:col-span-2">
          {/* User Plants */}
          <div className="rounded-2xl border border-border bg-card shadow-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="font-semibold flex items-center gap-2">
                <Sprout className="h-4 w-4 text-primary" /> Tanaman Saya
              </h2>
              <Button asChild size="sm" variant="outline" className="h-8 gap-1 text-xs">
                <Link to="/plants"><Plus className="h-3 w-3" /> Tambah</Link>
              </Button>
            </div>
            <div className="p-5">
              {plantsLoading ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
                </div>
              ) : activePlants.length === 0 ? (
                <EmptyPlants />
              ) : (
                <div className="space-y-3">
                  {activePlants.slice(0, 4).map((plant) => {
                    const age = plant.age_days;
                    const phaseLabel = age < 14 ? "Persemaian" : age < 45 ? "Vegetatif" : age < 75 ? "Generatif" : "Panen";
                    return (
                      <div key={plant.id} className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xl">
                          🌱
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-sm">{plant.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {age} HST · {phaseLabel} · Tanah {plant.soil_condition}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className={cn(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
                            plant.soil_condition === "Basah/Becek"
                              ? "bg-blue-100 text-blue-700"
                              : plant.soil_condition === "Kering"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-green-100 text-green-700"
                          )}>
                            {plant.status}
                          </span>
                          {plant.location && (
                            <p className="mt-0.5 text-[10px] text-muted-foreground">📍 {plant.location}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {activePlants.length > 4 && (
                    <Button asChild variant="ghost" size="sm" className="w-full text-xs">
                      <Link to="/plants">Lihat semua {activePlants.length} tanaman →</Link>
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Recent Diagnoses */}
          {recentDiagnoses.length > 0 && (
            <div className="rounded-2xl border border-border bg-card shadow-card">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <h2 className="font-semibold flex items-center gap-2">
                  <Leaf className="h-4 w-4 text-primary" /> Diagnosa Terbaru
                </h2>
                <Link to="/plant-doctor" className="text-xs font-medium text-primary hover:underline">Lihat semua →</Link>
              </div>
              <div className="divide-y divide-border">
                {recentDiagnoses.map((d) => {
                  const sev = d.severity?.toLowerCase() ?? "";
                  return (
                    <div key={d.id} className="flex items-center gap-3 px-5 py-3">
                      {d.image_url ? (
                        <img src={d.image_url} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                          <Leaf className="h-5 w-5 text-primary" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{d.diagnosis}</p>
                        <p className="text-xs text-muted-foreground">
                          {d.plant_type ?? "Tanaman"} · {format(parseISO(d.created_at), "d MMM yyyy", { locale: idLocale })}
                        </p>
                      </div>
                      <span className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        sev === "berat" ? "bg-destructive/10 text-destructive"
                          : sev === "sedang" ? "bg-warning/10 text-warning"
                          : "bg-success/10 text-success"
                      )}>
                        {d.severity ?? "—"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Harga Pasar (jika ada tanaman) */}
          {activePlants.length > 0 && (
            <div className="rounded-2xl border border-border bg-card shadow-card">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <h2 className="font-semibold flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-primary" /> Harga Komoditas
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">Sesuai tanaman Anda</span>
                </h2>
                <Link to="/market" className="text-xs font-medium text-primary hover:underline">Semua harga →</Link>
              </div>
              {/* Loading */}
              {marketFetching && !marketData && (
                <div className="flex items-center justify-center gap-2 px-5 py-8 text-sm text-muted-foreground">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Memuat harga pasar...
                </div>
              )}
              {/* Error / tidak tersedia */}
              {!marketFetching && (marketError || !marketData?.isRealtime) && (
                <div className="flex flex-col items-center gap-2 px-5 py-7 text-center">
                  <WifiOff className="h-6 w-6 text-muted-foreground/50" />
                  <p className="text-sm font-medium text-muted-foreground">Data harga tidak tersedia</p>
                  <p className="text-xs text-muted-foreground/70 max-w-[220px]">Server BPN sedang tidak dapat dijangkau. Data hanya ditampilkan dari sumber resmi.</p>
                  <button
                    onClick={() => refetchMarket()}
                    className="mt-1 flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
                  >
                    <RefreshCw className="h-3 w-3" /> Coba Lagi
                  </button>
                </div>
              )}
              {/* Data */}
              {!marketFetching && marketData?.isRealtime && relevantPrices.length > 0 && (
                <div className="divide-y divide-border">
                  {relevantPrices.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.region}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold">Rp {p.price.toLocaleString("id-ID")}/{p.unit}</p>
                        <span className={cn(
                          "inline-flex items-center gap-0.5 text-[10px] font-semibold",
                          p.trend === "up" ? "text-success" : p.trend === "down" ? "text-destructive" : "text-muted-foreground"
                        )}>
                          {p.trend === "up" ? <TrendingUp className="h-3 w-3" /> : p.trend === "down" ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                          {Math.abs(p.changePercent).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Weather + Quick Actions */}
        <div className="space-y-4">
          {/* Weather Card - Sederhana (Cuaca & Peringatan dari API) */}
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
            {/* Hero Section */}
            <div className="bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-700 p-5 text-white">
              {weatherLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24 bg-white/20" />
                  <Skeleton className="h-10 w-20 bg-white/20" />
                </div>
              ) : weather ? (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-white/80">
                        {location?.displayName ?? "Lokasi Anda"}
                        {!isRealtime && <span className="ml-1 text-[10px] opacity-70">(estimasi)</span>}
                      </p>
                      <div className="mt-2 flex items-end gap-2">
                        <span className="text-5xl font-bold leading-none">{weather.current.temp}°</span>
                        <span className="mb-1 text-lg text-white/80">C</span>
                      </div>
                      <p className="text-base font-medium text-white/90 mt-1">{weather.current.condition}</p>
                    </div>
                    <WeatherIcon
                      condition={weather.current.condition}
                      className={cn("h-16 w-16 opacity-90", conditionToColor(weather.current.condition).replace("text-", "text-white"))}
                    />
                  </div>

                  {/* Weather Details - 3 kolom */}
                  <div className="mt-5 flex flex-wrap gap-3">
                    <div className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 backdrop-blur-sm">
                      <Droplets className="h-3.5 w-3.5 text-white/70" />
                      <div>
                        <p className="text-[9px] text-white/60">Kelembapan</p>
                        <p className="text-xs font-semibold">{weather.current.humidity}%</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 backdrop-blur-sm">
                      <Wind className="h-3.5 w-3.5 text-white/70" />
                      <div>
                        <p className="text-[9px] text-white/60">Angin</p>
                        <p className="text-xs font-semibold">{weather.current.wind_speed} km/j</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 backdrop-blur-sm">
                      <Thermometer className="h-3.5 w-3.5 text-white/70" />
                      <div>
                        <p className="text-[9px] text-white/60">Terasa</p>
                        <p className="text-xs font-semibold">{weather.current.feels_like}°C</p>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center text-white/70 text-sm py-4">
                  Tidak dapat memuat cuaca
                </div>
              )}
            </div>

            {/* 5-day forecast mini */}
            {weather && (
              <div className="grid grid-cols-5 gap-0 divide-x divide-border border-t border-border">
                {weather.forecast.slice(0, 5).map((day, i) => (
                  <div key={day.date} className={cn("flex flex-col items-center py-2 text-center", i === 0 && "bg-muted/30")}>
                    <p className="text-[10px] font-medium text-muted-foreground">
                      {i === 0 ? "Hari" : day.dayName.slice(0, 3)}
                    </p>
                    <WeatherIcon condition={day.condition} className={cn("my-1 h-4 w-4", conditionToColor(day.condition))} />
                    <p className="text-[10px] font-bold">{day.temp_max}°</p>
                    <div className="flex items-center gap-0.5 text-[8px] text-blue-500">
                      <Droplets className="h-2 w-2" />
                      {day.rain_chance}%
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Weather Alerts - HANYA dari API, tanpa peringatan kustom */}
            {weather?.alerts && weather.alerts.length > 0 && (
              <div className="border-t border-border p-3">
                {weather.alerts.slice(0, 2).map((alert, i) => (
                  <div key={i} className={cn(
                    "flex items-start gap-2 rounded-lg p-2 text-xs",
                    alert.severity === "danger" ? "bg-destructive/10 text-destructive"
                      : alert.severity === "warning" ? "bg-warning/10 text-warning"
                      : "bg-info/10 text-info"
                  )}>
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                    <div>
                      <p className="font-semibold">{alert.title}</p>
                      <p className="opacity-80 line-clamp-2">{alert.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Footer Link */}
            <div className="border-t border-border p-3">
              <Button asChild variant="ghost" size="sm" className="h-7 w-full text-xs">
                <Link to="/weather">
                  <MapPin className="h-3 w-3 mr-1" />
                  Lihat prakiraan lengkap →
                </Link>
              </Button>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
            <h3 className="mb-3 text-sm font-semibold">Aksi Cepat</h3>
            <div className="space-y-1.5">
              {[
                { to: "/plant-doctor", icon: Leaf, label: "Diagnosa Tanaman", desc: "Foto & analisa AI", color: "bg-green-100 text-green-700" },
                { to: "/assistant", icon: MessageCircle, label: "Tanya AI", desc: "Konsultasi pertanian", color: "bg-blue-100 text-blue-700" },
                { to: "/plants", icon: ClipboardList, label: "Catat Tanaman", desc: "Tambah/kelola tanaman", color: "bg-purple-100 text-purple-700" },
                { to: "/community", icon: Users, label: "Komunitas", desc: "Diskusi dengan petani", color: "bg-orange-100 text-orange-700" },
                { to: "/market", icon: ShoppingCart, label: "Harga Pasar", desc: "Pantau komoditas", color: "bg-emerald-100 text-emerald-700" },
              ].map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="flex items-center gap-3 rounded-xl p-2.5 hover:bg-muted/50 transition-colors"
                >
                  <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", item.color)}>
                    <item.icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-none">{item.label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}