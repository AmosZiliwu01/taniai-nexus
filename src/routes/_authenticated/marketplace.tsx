// src/routes/_authenticated/marketplace.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useMarketPrices } from "@/hooks/useMarketPrices";
import { MARKET_REGIONS, type CommodityPrice } from "@/services/market/marketService";
import { usePlants } from "@/hooks/useUserPlants";
import { useWeather } from "@/hooks/useWeather";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  TrendingUp, TrendingDown, Minus, Search, RefreshCw,
  MapPin, Clock, ChevronUp, ChevronDown, Info, Wifi, WifiOff,
  AlertCircle,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/marketplace")({
  head: () => ({ meta: [{ title: "Harga Pasar — TaniAI Nexus" }] }),
  component: HargaPasar,
});

const CATEGORIES = [
  { value: "all",          label: "Semua" },
  { value: "padi_jagung",  label: "Padi & Palawija" },
  { value: "hortikultura", label: "Hortikultura" },
  { value: "perkebunan",   label: "Perkebunan" },
  { value: "protein",      label: "Protein & Ternak" },
];

// ─────────────────────────────────────────────────────────────
// PRICE CARD
// ─────────────────────────────────────────────────────────────

function PriceCard({ price }: { price: CommodityPrice }) {
  const [expanded, setExpanded] = useState(false);
  const TrendIcon =
    price.trend === "up" ? TrendingUp : price.trend === "down" ? TrendingDown : Minus;

  return (
    <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm leading-tight">{price.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {price.region}
            </p>
          </div>

          <div className="text-right shrink-0">
            <p className="font-bold text-base">
              Rp {price.price.toLocaleString("id-ID")}
              <span className="text-xs font-normal text-muted-foreground">
                /{price.unit}
              </span>
            </p>
            <div
              className={cn(
                "flex items-center justify-end gap-0.5 text-xs font-semibold",
                price.trend === "up"
                  ? "text-success"
                  : price.trend === "down"
                  ? "text-destructive"
                  : "text-muted-foreground"
              )}
            >
              <TrendIcon className="h-3 w-3" />
              {Math.abs(price.changePercent).toFixed(1)}%
              <span className="font-normal text-muted-foreground ml-1">
                ({price.priceChange > 0 ? "+" : ""}
                {price.priceChange.toLocaleString("id-ID")})
              </span>
            </div>
          </div>
        </div>

        {/* Range bar */}
        <div className="mt-3">
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary/50"
              style={{
                width: `${Math.max(
                  5,
                  Math.min(
                    95,
                    ((price.price - price.weekLow) /
                      (price.weekHigh - price.weekLow || 1)) *
                      100
                  )
                )}%`,
              }}
            />
          </div>
          <div className="flex justify-between mt-0.5 text-[9px] text-muted-foreground">
            <span>Min: Rp {price.weekLow.toLocaleString("id-ID")}</span>
            <span>Max: Rp {price.weekHigh.toLocaleString("id-ID")}</span>
          </div>
        </div>

        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 flex w-full items-center justify-between text-xs text-primary font-medium"
        >
          <span>Rekomendasi jual</span>
          {expanded ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {expanded && (
        <div
          className={cn(
            "border-t border-border px-4 py-3",
            price.sellRecommendation === "sekarang"
              ? "bg-success/5"
              : price.sellRecommendation === "jual_cepat"
              ? "bg-destructive/5"
              : "bg-warning/5"
          )}
        >
          <div className="flex items-start gap-2">
            <span
              className={cn(
                "mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase shrink-0",
                price.sellRecommendation === "sekarang"
                  ? "bg-success/20 text-success"
                  : price.sellRecommendation === "jual_cepat"
                  ? "bg-destructive/20 text-destructive"
                  : "bg-warning/20 text-warning"
              )}
            >
              {price.sellRecommendation === "sekarang"
                ? "Jual Sekarang"
                : price.sellRecommendation === "jual_cepat"
                ? "Jual Cepat!"
                : "Tunggu Dulu"}
            </span>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">{price.sellReason}</p>
          <p className="mt-1 text-[10px] text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" /> Update: {price.lastUpdated}
          </p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ERROR STATE
// ─────────────────────────────────────────────────────────────

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-12 text-center shadow-card">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <WifiOff className="h-7 w-7 text-muted-foreground/60" />
      </div>
      <p className="font-semibold text-base">Data harga tidak tersedia</p>
      <p className="mt-2 text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">
        Server harga pasar (Panel Harga Pangan BPN) sedang tidak dapat dijangkau.
        Data hanya ditampilkan jika berasal dari sumber resmi yang terverifikasi.
      </p>
      <Button onClick={onRetry} className="mt-5 gap-1.5" size="sm" variant="outline">
        <RefreshCw className="h-3.5 w-3.5" />
        Coba Lagi
      </Button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────

function HargaPasar() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [region, setRegion] = useState("Nasional");
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  const { data: plants = [] } = usePlants();
  const { location } = useWeather();

  // Auto-set region dari lokasi user
  useMemo(() => {
    if (location?.province) {
      const match = MARKET_REGIONS.find((r) =>
        location.province
          .toLowerCase()
          .includes(r.toLowerCase().split(" ").pop() ?? "")
      );
      if (match && match !== "Nasional") setRegion(match);
    }
  }, [location?.province]);

  const activePlantNames = plants
    .filter((p) => p.status === "Aktif")
    .map((p) => p.name);

  const {
    filteredPrices,
    myPlantPrices,
    trendingUp,
    summary,
    isLoading,
    isFetching,
    isError,
    isRealtime,
    fromCache,
    source,
    lastUpdatedLabel,
    forceRefresh,
  } = useMarketPrices({
    region,
    search,
    category,
    cropNames: activePlantNames,
  });

  const handleRefresh = async () => {
    setIsManualRefreshing(true);
    try {
      await forceRefresh();
    } finally {
      setTimeout(() => setIsManualRefreshing(false), 600);
    }
  };

  const showRefreshing = isFetching || isManualRefreshing;

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Harga Pasar</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>Data harga komoditas pertanian Indonesia</span>
            {/* Badge hanya tampil saat data real-time berhasil dimuat */}
            {isRealtime && (
              <span className="flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-600">
                <Wifi className="h-2.5 w-2.5" />
                Real-time BPN
              </span>
            )}
            {isRealtime && fromCache && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                Cache
              </span>
            )}
            {isRealtime && lastUpdatedLabel && (
              <span className="flex items-center gap-1 text-[11px]">
                <Clock className="h-3 w-3" />
                Diperbarui {lastUpdatedLabel}
              </span>
            )}
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={showRefreshing}
          className="gap-1.5 self-start"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", showRefreshing && "animate-spin")} />
          {showRefreshing ? "Memperbarui..." : "Perbarui"}
        </Button>
      </div>

      {/* ── Filter bar ─────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
        <div className="flex flex-wrap gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari komoditas..."
              className="h-9 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Region */}
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="h-9 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary min-w-[160px]"
          >
            {MARKET_REGIONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </div>

        {/* Category tabs */}
        <div className="mt-3 flex gap-2 flex-wrap">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setCategory(cat.value)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                category === cat.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80"
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Loading skeleton ────────────────────────────────────── */}
      {isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-12 w-48 rounded-xl" />
          <div className="grid gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-8 w-40 rounded-xl" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-36 rounded-2xl" />
            ))}
          </div>
        </div>
      )}

      {/* ── Error state ─────────────────────────────────────────── */}
      {!isLoading && (isError || (!isRealtime && !isFetching)) && (
        <ErrorState onRetry={handleRefresh} />
      )}

      {/* ── Content — hanya tampil jika data real-time dari BPN ─── */}
      {!isLoading && !isError && isRealtime && (
        <>
          {/* Summary bar */}
          {summary.totalCommodities > 0 && (
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-success/20 bg-success/5 px-4 py-3 text-center">
                <p className="text-xl font-bold text-success">{summary.risingCount}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Harga Naik</p>
              </div>
              <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-center">
                <p className="text-xl font-bold text-destructive">{summary.fallingCount}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Harga Turun</p>
              </div>
              <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-center">
                <p className="text-xl font-bold">{summary.stableCount}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Stabil</p>
              </div>
            </div>
          )}

          {/* Trending up */}
          {trendingUp.length > 0 && (
            <div>
              <h2 className="mb-3 font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-success" />
                Harga Naik Hari Ini
              </h2>
              <div className="grid gap-3 sm:grid-cols-3">
                {trendingUp.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 rounded-xl border border-success/20 bg-success/5 px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Rp {p.price.toLocaleString("id-ID")}/{p.unit}
                      </p>
                    </div>
                    <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-bold text-success shrink-0">
                      +{p.changePercent.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* My plant prices */}
          {myPlantPrices.length > 0 && (
            <div>
              <h2 className="mb-3 font-semibold flex items-center gap-2">
                🌱 Harga Sesuai Tanaman Anda
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {myPlantPrices.map((p) => (
                  <PriceCard key={p.id} price={p} />
                ))}
              </div>
            </div>
          )}

          {/* All prices */}
          <div>
            <h2 className="mb-3 font-semibold flex items-center justify-between">
              <span>Semua Komoditas</span>
              <span className="text-xs font-normal text-muted-foreground">
                {filteredPrices.length} komoditas
              </span>
            </h2>

            {filteredPrices.length === 0 ? (
              <div className="rounded-2xl border border-border bg-card py-12 text-center">
                <Search className="mx-auto h-10 w-10 text-muted-foreground/30" />
                <p className="mt-3 font-semibold">Tidak ditemukan</p>
                <p className="text-sm text-muted-foreground">Coba kata kunci lain</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredPrices.map((p) => (
                  <PriceCard key={p.id} price={p} />
                ))}
              </div>
            )}
          </div>

          {/* Footer info */}
          <div className="flex items-start gap-2 rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              {isRealtime
                ? `Data real-time dari ${source}. `
                : `Data referensi — ${source}. `}
              Harga aktual dapat berbeda di masing-masing daerah dan pasar.
              Gunakan sebagai referensi perencanaan penjualan.
              {fromCache && " • Data dari cache lokal."}
            </p>
          </div>
        </>
      )}
    </div>
  );
}