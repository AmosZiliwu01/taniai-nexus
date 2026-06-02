// src/services/market/marketService.ts
export interface CommodityPrice {
  id: string;
  name: string;
  nameEn: string;
  category: "padi_jagung" | "hortikultura" | "perkebunan" | "protein";
  price: number;
  priceChange: number;
  changePercent: number;
  trend: "up" | "down" | "stable";
  region: string;
  unit: string;
  lastUpdated: string;
  weekHigh: number;
  weekLow: number;
  sellRecommendation: "sekarang" | "tunggu" | "jual_cepat";
  sellReason: string;
  source: string;
}

export interface MarketData {
  prices: CommodityPrice[];
  lastUpdated: string;
  source: string;
  isRealtime: boolean;
  region: string;
  fromCache: boolean;
  cachedAt?: string;
}

export type MarketError = "network_error" | "api_unavailable" | "parse_error" | "unknown";

export interface MarketResult {
  data: MarketData | null;
  error: MarketError | null;
  errorMessage?: string;
}

// Constants

export const MARKET_REGIONS = [
  "Nasional",
  "Jawa Barat",
  "Jawa Tengah",
  "Jawa Timur",
  "DKI Jakarta",
  "DIY",
  "Sumatera Utara",
  "Sumatera Barat",
  "Sumatera Selatan",
  "Kalimantan Barat",
  "Kalimantan Timur",
  "Sulawesi Selatan",
  "Bali",
  "NTB",
] as const;

export type MarketRegion = (typeof MARKET_REGIONS)[number];

// Edge Function URL

function getEdgeFunctionUrl(region: string, forceRefresh = false): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) throw new Error("VITE_SUPABASE_URL not set");

  const params = new URLSearchParams({ region });
  if (forceRefresh) params.set("refresh", "1");

  return `${supabaseUrl}/functions/v1/market-prices?${params.toString()}`;
}

export async function fetchMarketData(
  region: string = "Nasional",
  forceRefresh = false,
): Promise<MarketData> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Konfigurasi Supabase tidak lengkap.");
  }

  const url = getEdgeFunctionUrl(region, forceRefresh);

  const res = await fetch(url, {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Server tidak tersedia (${res.status}). ${text}`.trim());
  }

  const data = (await res.json()) as MarketData;

  if (!data.prices || !Array.isArray(data.prices) || data.prices.length === 0) {
    throw new Error("Data dari server kosong atau tidak valid.");
  }

  return data;
}

// Filter & Search
export function filterPrices(
  prices: CommodityPrice[],
  {
    search,
    category,
    region,
  }: {
    search?: string;
    category?: string;
    region?: string;
  },
): CommodityPrice[] {
  return prices.filter((p) => {
    if (search && search.trim().length > 0) {
      const q = search.toLowerCase().trim();
      const matches =
        p.name.toLowerCase().includes(q) ||
        p.nameEn.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q);
      if (!matches) return false;
    }

    if (category && category !== "all") {
      if (p.category !== category) return false;
    }

    if (region && region !== "all" && region !== "Nasional") {
      if (!p.region.toLowerCase().includes(region.toLowerCase())) return false;
    }

    return true;
  });
}

// Get prices relevant to user's crops
export function getPricesForCrops(prices: CommodityPrice[], cropNames: string[]): CommodityPrice[] {
  if (cropNames.length === 0) return prices.slice(0, 4);

  const cropKeywords: Record<string, string[]> = {
    padi: ["beras", "gabah"],
    jagung: ["jagung"],
    cabai: ["cabai"],
    tomat: ["tomat"],
    bawang: ["bawang"],
    kedelai: ["kedelai"],
    kentang: ["kentang"],
    kopi: ["kopi"],
    kakao: ["kakao"],
    singkong: ["singkong", "ubi kayu"],
    pisang: ["pisang"],
    sawi: ["sawi"],
    kangkung: ["kangkung"],
    bayam: ["bayam"],
    terong: ["terong"],
    wortel: ["wortel"],
    semangka: ["semangka"],
    melon: ["melon"],
    ayam: ["ayam"],
    sapi: ["sapi"],
    kambing: ["kambing"],
  };

  const relevant = new Set<string>();
  for (const crop of cropNames) {
    const lower = crop.toLowerCase();
    for (const [key, keywords] of Object.entries(cropKeywords)) {
      if (lower.includes(key) || keywords.some((k) => lower.includes(k))) {
        keywords.forEach((k) => relevant.add(k));
      }
    }
  }

  if (relevant.size === 0) return prices.slice(0, 4);

  const matched = prices.filter((p) =>
    Array.from(relevant).some((k) => p.name.toLowerCase().includes(k)),
  );

  return matched.length > 0 ? matched.slice(0, 4) : prices.slice(0, 4);
}

// Summary stats
export interface MarketSummary {
  totalCommodities: number;
  risingCount: number;
  fallingCount: number;
  stableCount: number;
  avgChangePercent: number;
  topGainer: CommodityPrice | null;
  topLoser: CommodityPrice | null;
}

export function getMarketSummary(prices: CommodityPrice[]): MarketSummary {
  if (prices.length === 0) {
    return {
      totalCommodities: 0,
      risingCount: 0,
      fallingCount: 0,
      stableCount: 0,
      avgChangePercent: 0,
      topGainer: null,
      topLoser: null,
    };
  }

  const rising = prices.filter((p) => p.trend === "up");
  const falling = prices.filter((p) => p.trend === "down");
  const stable = prices.filter((p) => p.trend === "stable");
  const avgChange = prices.reduce((sum, p) => sum + p.changePercent, 0) / prices.length;

  const topGainer =
    rising.length > 0
      ? rising.reduce((best, p) => (p.changePercent > best.changePercent ? p : best), rising[0])
      : null;

  const topLoser =
    falling.length > 0
      ? falling.reduce(
          (worst, p) => (p.changePercent < worst.changePercent ? p : worst),
          falling[0],
        )
      : null;

  return {
    totalCommodities: prices.length,
    risingCount: rising.length,
    fallingCount: falling.length,
    stableCount: stable.length,
    avgChangePercent: parseFloat(avgChange.toFixed(2)),
    topGainer,
    topLoser,
  };
}
