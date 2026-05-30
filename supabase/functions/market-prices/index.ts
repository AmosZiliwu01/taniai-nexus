// supabase/functions/market-prices/index.ts
// Edge Function: Proxy ke Panel Harga Pangan Badan Pangan Nasional
// Cache 20 menit di KV store untuk hemat quota dan latency

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Commodity map: BPN commodity_id → normalized id kita ────────────────────
// Sumber: https://panelharga.badanpangan.go.id
// Level 1 = harga konsumen nasional
const COMMODITY_MAP: Record<number, {
  id: string;
  name: string;
  nameEn: string;
  category: "padi_jagung" | "hortikultura" | "perkebunan" | "protein";
  unit: string;
}> = {
  1:  { id: "beras-medium",    name: "Beras Medium",         nameEn: "medium_rice",    category: "padi_jagung",  unit: "kg" },
  2:  { id: "beras-premium",   name: "Beras Premium",        nameEn: "premium_rice",   category: "padi_jagung",  unit: "kg" },
  3:  { id: "jagung-pipil",    name: "Jagung Pipil",         nameEn: "corn",           category: "padi_jagung",  unit: "kg" },
  4:  { id: "kedelai-biji",    name: "Kedelai Biji Kering",  nameEn: "soybean",        category: "padi_jagung",  unit: "kg" },
  5:  { id: "bawang-merah",    name: "Bawang Merah",         nameEn: "shallot",        category: "hortikultura", unit: "kg" },
  6:  { id: "bawang-putih",    name: "Bawang Putih Impor",   nameEn: "garlic",         category: "hortikultura", unit: "kg" },
  7:  { id: "cabai-merah",     name: "Cabai Merah Keriting", nameEn: "red_chili",      category: "hortikultura", unit: "kg" },
  8:  { id: "cabai-rawit",     name: "Cabai Rawit Merah",    nameEn: "bird_eye_chili", category: "hortikultura", unit: "kg" },
  9:  { id: "daging-sapi",     name: "Daging Sapi Murni",    nameEn: "beef",           category: "protein",      unit: "kg" },
  10: { id: "daging-ayam",     name: "Daging Ayam Ras",      nameEn: "chicken",        category: "protein",      unit: "kg" },
  11: { id: "telur-ayam",      name: "Telur Ayam Ras",       nameEn: "egg",            category: "protein",      unit: "kg" },
  12: { id: "gula-konsumsi",   name: "Gula Konsumsi",        nameEn: "sugar",          category: "perkebunan",   unit: "kg" },
  13: { id: "minyak-goreng",   name: "Minyak Goreng Curah",  nameEn: "palm_oil",       category: "perkebunan",   unit: "liter" },
  14: { id: "tepung-terigu",   name: "Tepung Terigu",        nameEn: "wheat_flour",    category: "padi_jagung",  unit: "kg" },
  15: { id: "tomat",           name: "Tomat",                nameEn: "tomato",         category: "hortikultura", unit: "kg" },
  // Tambahan komoditas perkebunan (tidak selalu dari BPN, gabung data)
};

// ─── Province/region code map ─────────────────────────────────────────────────
const PROVINCE_MAP: Record<string, number> = {
  "Nasional": 0,
  "DKI Jakarta": 31,
  "Jawa Barat": 32,
  "Jawa Tengah": 33,
  "DIY": 34,
  "Jawa Timur": 35,
  "Sumatera Utara": 12,
  "Sumatera Barat": 13,
  "Sumatera Selatan": 16,
  "Kalimantan Barat": 61,
  "Kalimantan Timur": 64,
  "Sulawesi Selatan": 73,
  "Bali": 51,
  "NTB": 52,
};

// ─── Sell recommendation logic ────────────────────────────────────────────────
function getSellRecommendation(
  price: number,
  weekHigh: number,
  weekLow: number,
  changePercent: number
): { recommendation: "sekarang" | "tunggu" | "jual_cepat"; reason: string } {
  const range = weekHigh - weekLow;
  const positionInRange = range > 0 ? (price - weekLow) / range : 0.5;

  if (changePercent > 5 && positionInRange > 0.75) {
    return {
      recommendation: "jual_cepat",
      reason: `Harga naik ${changePercent.toFixed(1)}% dan mendekati harga tertinggi minggu ini. Segera jual sebelum koreksi.`,
    };
  }
  if (positionInRange > 0.6 && changePercent >= 0) {
    return {
      recommendation: "sekarang",
      reason: `Harga berada di posisi atas kisaran minggu ini. Waktu yang baik untuk menjual.`,
    };
  }
  if (positionInRange < 0.35 || changePercent < -3) {
    return {
      recommendation: "tunggu",
      reason: `Harga sedang di bawah rata-rata. Tahan dulu dan pantau pergerakan dalam 2-3 hari ke depan.`,
    };
  }
  return {
    recommendation: "sekarang",
    reason: `Harga stabil dalam kisaran normal. Aman untuk dijual sekarang.`,
  };
}

// ─── Fetch dari Panel Harga Pangan BPN ───────────────────────────────────────
async function fetchFromBPN(provinceCode: number): Promise<any[]> {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 7);

  const fmt = (d: Date) =>
    `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;

  const startDate = fmt(weekAgo);
  const endDate = fmt(today);

  // Level 1 = harga konsumen (eceran), level 2 = harga produsen
  const level = provinceCode === 0 ? 1 : 2;
  const url = `https://panelharga.badanpangan.go.id/data/kabupaten-range-by-level?level=${level}&start-date=${startDate}&end-date=${endDate}`;

  const res = await fetch(url, {
    headers: {
      "Accept": "application/json",
      "Referer": "https://panelharga.badanpangan.go.id/",
      "User-Agent": "TaniAI-Nexus/1.0 (agritech platform)",
    },
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) throw new Error(`BPN API returned ${res.status}`);

  const json = await res.json();
  return json?.data ?? [];
}

// ─── Parse BPN response → normalized CommodityPrice[] ─────────────────────────
function parseBPNData(
  rawData: any[],
  region: string
): Array<{
  id: string; name: string; nameEn: string; category: string;
  price: number; priceChange: number; changePercent: number;
  trend: "up" | "down" | "stable"; unit: string; region: string;
  weekHigh: number; weekLow: number; lastUpdated: string;
  sellRecommendation: "sekarang" | "tunggu" | "jual_cepat"; sellReason: string;
  source: string;
}> {
  const results = [];
  const today = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

  for (const item of rawData) {
    const meta = COMMODITY_MAP[item.komoditas_id];
    if (!meta) continue;

    const prices: number[] = (item.values ?? [])
      .map((v: any) => parseFloat(v?.value ?? "0"))
      .filter((v: number) => v > 0);

    if (prices.length === 0) continue;

    const latestPrice = prices[prices.length - 1];
    const prevPrice = prices.length > 1 ? prices[prices.length - 2] : latestPrice;
    const weekHigh = Math.max(...prices);
    const weekLow = Math.min(...prices);

    const priceChange = latestPrice - prevPrice;
    const changePercent = prevPrice > 0 ? (priceChange / prevPrice) * 100 : 0;
    const trend: "up" | "down" | "stable" =
      priceChange > 0 ? "up" : priceChange < 0 ? "down" : "stable";

    const { recommendation, reason } = getSellRecommendation(
      latestPrice, weekHigh, weekLow, changePercent
    );

    results.push({
      ...meta,
      price: Math.round(latestPrice),
      priceChange: Math.round(priceChange),
      changePercent: parseFloat(changePercent.toFixed(2)),
      trend,
      region,
      weekHigh: Math.round(weekHigh),
      weekLow: Math.round(weekLow),
      lastUpdated: today,
      sellRecommendation: recommendation,
      sellReason: reason,
      source: "Panel Harga Pangan — Badan Pangan Nasional",
    });
  }

  return results;
}

// ─── Fallback data referensi (digunakan jika BPN API down) ───────────────────
// Ini data REFERENSI statis — hanya digunakan sebagai last-resort fallback
// Selalu ditandai isRealtime: false dan source: "Referensi (BPN offline)"
function getFallbackData(region: string) {
  const today = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  const seed = new Date().getDate();
  const f = (base: number, pct: number) => Math.round(base * (1 + ((((seed * 7) % 10) / 10) - 0.5) * pct / 100));

  const items = [
    { id: "beras-medium",   name: "Beras Medium",         nameEn: "medium_rice",    category: "padi_jagung",  price: f(13500, 6),  wh: 14000, wl: 13000, unit: "kg" },
    { id: "jagung-pipil",   name: "Jagung Pipil",         nameEn: "corn",           category: "padi_jagung",  price: f(5200, 10),  wh: 5600,  wl: 4800,  unit: "kg" },
    { id: "kedelai-biji",   name: "Kedelai Biji Kering",  nameEn: "soybean",        category: "padi_jagung",  price: f(10500, 7),  wh: 11000, wl: 10000, unit: "kg" },
    { id: "cabai-merah",    name: "Cabai Merah Keriting", nameEn: "red_chili",      category: "hortikultura", price: f(35000, 25), wh: 45000, wl: 28000, unit: "kg" },
    { id: "cabai-rawit",    name: "Cabai Rawit Merah",    nameEn: "bird_eye_chili", category: "hortikultura", price: f(52000, 30), wh: 65000, wl: 40000, unit: "kg" },
    { id: "bawang-merah",   name: "Bawang Merah",         nameEn: "shallot",        category: "hortikultura", price: f(30000, 15), wh: 35000, wl: 25000, unit: "kg" },
    { id: "bawang-putih",   name: "Bawang Putih Impor",   nameEn: "garlic",         category: "hortikultura", price: f(38000, 8),  wh: 40000, wl: 36000, unit: "kg" },
    { id: "tomat",          name: "Tomat",                nameEn: "tomato",         category: "hortikultura", price: f(12000, 20), wh: 16000, wl: 8000,  unit: "kg" },
    { id: "daging-ayam",    name: "Daging Ayam Ras",      nameEn: "chicken",        category: "protein",      price: f(36000, 8),  wh: 38000, wl: 34000, unit: "kg" },
    { id: "telur-ayam",     name: "Telur Ayam Ras",       nameEn: "egg",            category: "protein",      price: f(28000, 6),  wh: 30000, wl: 26000, unit: "kg" },
    { id: "gula-konsumsi",  name: "Gula Konsumsi",        nameEn: "sugar",          category: "perkebunan",   price: f(17000, 5),  wh: 18000, wl: 16000, unit: "kg" },
    { id: "minyak-goreng",  name: "Minyak Goreng Curah",  nameEn: "palm_oil",       category: "perkebunan",   price: f(16000, 5),  wh: 17000, wl: 15000, unit: "liter" },
  ];

  return items.map((item) => {
    const priceChange = seed % 2 === 0 ? Math.round(item.price * 0.015) : -Math.round(item.price * 0.01);
    const changePercent = parseFloat(((priceChange / item.price) * 100).toFixed(2));
    const trend: "up" | "down" | "stable" = priceChange > 0 ? "up" : priceChange < 0 ? "down" : "stable";
    const { recommendation, reason } = getSellRecommendation(item.price, item.wh, item.wl, changePercent);
    return {
      id: item.id, name: item.name, nameEn: item.nameEn, category: item.category,
      price: item.price, priceChange, changePercent, trend,
      unit: item.unit, region,
      weekHigh: item.wh, weekLow: item.wl, lastUpdated: today,
      sellRecommendation: recommendation, sellReason: reason,
      source: "Referensi (BPN sedang tidak tersedia)",
    };
  });
}

// ─── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const region = url.searchParams.get("region") ?? "Nasional";
    const forceRefresh = url.searchParams.get("refresh") === "1";

    // Init Supabase admin client (untuk cache di database)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const cacheKey = `market_prices_${region.replace(/\s+/g, "_").toLowerCase()}`;
    const CACHE_TTL_MINUTES = 20;

    // ── 1. Cek cache di Supabase ──────────────────────────────────────────────
    if (!forceRefresh) {
      const { data: cached } = await supabaseAdmin
        .from("market_price_cache")
        .select("*")
        .eq("cache_key", cacheKey)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (cached?.payload) {
        return new Response(
          JSON.stringify({
            ...cached.payload,
            cachedAt: cached.updated_at,
            fromCache: true,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // ── 2. Fetch dari BPN ─────────────────────────────────────────────────────
    let prices;
    let isRealtime = false;
    let source = "Referensi (BPN sedang tidak tersedia)";

    try {
      const provinceCode = PROVINCE_MAP[region] ?? 0;
      const rawData = await fetchFromBPN(provinceCode);

      if (rawData.length > 0) {
        prices = parseBPNData(rawData, region);
        isRealtime = true;
        source = "Panel Harga Pangan — Badan Pangan Nasional";
      } else {
        prices = getFallbackData(region);
      }
    } catch (fetchError) {
      console.error("BPN fetch failed:", fetchError);
      prices = getFallbackData(region);
    }

    const payload = {
      prices,
      lastUpdated: new Date().toISOString(),
      source,
      isRealtime,
      region,
      fromCache: false,
    };

    // ── 3. Simpan ke cache ────────────────────────────────────────────────────
    try {
      const expiresAt = new Date(Date.now() + CACHE_TTL_MINUTES * 60 * 1000).toISOString();
      await supabaseAdmin
        .from("market_price_cache")
        .upsert({
          cache_key: cacheKey,
          payload,
          region,
          expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        }, { onConflict: "cache_key" });
    } catch (cacheError) {
      // Cache gagal tidak fatal — tetap return data
      console.warn("Cache write failed:", cacheError);
    }

    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("market-prices error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", message: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
