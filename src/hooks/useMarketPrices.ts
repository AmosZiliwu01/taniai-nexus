// src/hooks/useMarketPrices.ts

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

// Query Key Factory
export const marketKeys = {
  all: ["market-prices"] as const,
  byRegion: (region: string) => [...marketKeys.all, region] as const,
};

// Cache TTL
const STALE_TIME = 20 * 60 * 1000;
const GC_TIME = 60 * 60 * 1000;
const REFETCH_INTERVAL = 25 * 60 * 1000;

// Main Hook
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

    refetchInterval: REFETCH_INTERVAL,
    refetchIntervalInBackground: false,

    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    // Harus true agar data di-fetch saat pertama kali halaman dibuka
    refetchOnMount: true,

    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  });

  // Force refresh (bypass cache)
  const forceRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: marketKeys.byRegion(region) });
    return queryClient.fetchQuery({
      queryKey: marketKeys.byRegion(region),
      queryFn: () => fetchMarketData(region, true),
      staleTime: 0,
    });
  }, [queryClient, region]);

  // Derived data
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

  // Status helpers
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
    data: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,

    allPrices,
    filteredPrices,
    myPlantPrices,
    trendingUp,
    trendingDown,
    summary,

    isRealtime,
    fromCache,
    source,
    lastUpdated,
    lastUpdatedLabel,

    forceRefresh,
    refetch: query.refetch,
  };
}
