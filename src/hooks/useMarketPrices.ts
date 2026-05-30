// src/hooks/useMarketPrices.ts
// TanStack Query hook untuk data harga pasar real-time
// - Cache 20 menit (sinkron dengan Edge Function TTL)
// - Stale-while-revalidate
// - Auto retry 2x dengan exponential backoff
// - Background refetch setiap 25 menit

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import {
  fetchMarketData,
  filterPrices,
  getPricesForCrops,
  getMarketSummary,
  type MarketData,
  type CommodityPrice,
} from "@/services/market/marketService";

// ─── Query Key Factory ────────────────────────────────────────────────────────

export const marketKeys = {
  all: ["market-prices"] as const,
  byRegion: (region: string) => [...marketKeys.all, region] as const,
};

// ─── Cache TTL ─────────────────────────────────────────────────────────────────
// Edge Function cache: 20 menit
// Frontend staleTime: 20 menit (jangan fetch ulang kalau cache masih segar)
// gcTime: 60 menit (simpan di memory walau tidak dipakai)
// refetchInterval: 25 menit (background refresh)

const STALE_TIME = 20 * 60 * 1000;
const GC_TIME = 60 * 60 * 1000;
const REFETCH_INTERVAL = 25 * 60 * 1000;

// ─── Main Hook ────────────────────────────────────────────────────────────────

interface UseMarketPricesOptions {
  region?: string;
  search?: string;
  category?: string;
  cropNames?: string[];
  enabled?: boolean;
}

export function useMarketPrices({
  region = "Nasional",
  search = "",
  category = "all",
  cropNames = [],
  enabled = true,
}: UseMarketPricesOptions = {}) {
  const queryClient = useQueryClient();

  const query = useQuery<MarketData, Error>({
    queryKey: marketKeys.byRegion(region),

    queryFn: () => fetchMarketData(region, false),

    enabled,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,

    // Background auto-refresh setiap 25 menit
    refetchInterval: REFETCH_INTERVAL,
    refetchIntervalInBackground: false,

    // Jangan refetch saat window focus — sudah ada interval
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    // PENTING: harus true agar data di-fetch saat pertama kali halaman dibuka.
    // false menyebabkan halaman kosong jika belum ada cache di query client.
    refetchOnMount: true,

    // Retry 2x dengan exponential backoff
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  });

  // ── Force refresh (bypass cache) ───────────────────────────────────────────
  const forceRefresh = useCallback(async () => {
    // Invalidate cache dulu agar query refetch
    await queryClient.invalidateQueries({ queryKey: marketKeys.byRegion(region) });
    // Fetch dengan forceRefresh=true ke Edge Function
    return queryClient.fetchQuery({
      queryKey: marketKeys.byRegion(region),
      queryFn: () => fetchMarketData(region, true),
      staleTime: 0,
    });
  }, [queryClient, region]);

  // ── Derived data ────────────────────────────────────────────────────────────
  const allPrices = query.data?.prices ?? [];

  const filteredPrices = filterPrices(allPrices, { search, category });

  const myPlantPrices: CommodityPrice[] =
    cropNames.length > 0 ? getPricesForCrops(allPrices, cropNames) : [];

  const trendingUp = allPrices
    .filter((p) => p.trend === "up")
    .sort((a, b) => b.changePercent - a.changePercent)
    .slice(0, 3);

  const trendingDown = allPrices
    .filter((p) => p.trend === "down")
    .sort((a, b) => a.changePercent - b.changePercent)
    .slice(0, 3);

  const summary = getMarketSummary(allPrices);

  // ── Status helpers ──────────────────────────────────────────────────────────
  const isRealtime = query.data?.isRealtime ?? false;
  const fromCache = query.data?.fromCache ?? false;
  const source = query.data?.source ?? "—";
  const lastUpdated = query.data?.lastUpdated ?? null;

  const lastUpdatedLabel = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return {
    // Raw query state
    data: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,

    // Derived data
    allPrices,
    filteredPrices,
    myPlantPrices,
    trendingUp,
    trendingDown,
    summary,

    // Metadata
    isRealtime,
    fromCache,
    source,
    lastUpdated,
    lastUpdatedLabel,

    // Actions
    forceRefresh,
    refetch: query.refetch,
  };
}