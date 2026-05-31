// src/routes/_authenticated/weather.tsx

import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useWeather } from "@/hooks/useWeather";
import { usePlants } from "@/hooks/useUserPlants";
import { conditionToLucideIcon } from "@/services/weather/weatherService";
import {
  reverseGeocode,
  type UserLocation,
} from "@/services/location/locationService";
import { getDiseaseWarnings } from "@/lib/ai.functions";
import { useQuery } from "@tanstack/react-query";

import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  Sun,
  Cloud,
  CloudRain,
  CloudLightning,
  CloudDrizzle,
  MapPin,
  Wind,
  Droplets,
  Thermometer,
  Eye,
  AlertTriangle,
  RefreshCw,
  Leaf,
  X,
  Search,
  Loader2,
  Clock,
  CheckCircle2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/weather")({
  head: () => ({
    meta: [{ title: "Cuaca & Peringatan — TaniAI Nexus" }],
  }),
  component: WeatherPage,
});

// ─────────────────────────────────────────────────────────────
// ICON MAP
// ─────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, typeof Sun> = {
  "cloud-lightning": CloudLightning,
  "cloud-rain": CloudRain,
  "cloud-drizzle": CloudDrizzle,
  "cloud-fog": Cloud,
  "cloud-sun": Cloud,
  cloud: Cloud,
  sun: Sun,
};

function WIcon({
  condition,
  className,
}: {
  condition: string;
  className?: string;
}) {
  const name = conditionToLucideIcon(condition);
  const Icon = ICON_MAP[name] ?? Sun;
  return <Icon className={className} />;
}

// ─────────────────────────────────────────────────────────────
// LEAFLET CSS
// ─────────────────────────────────────────────────────────────

let leafletCssInjected = false;

function ensureLeafletCss() {
  if (leafletCssInjected) return;
  leafletCssInjected = true;

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
  document.head.appendChild(link);

  const style = document.createElement("style");
  style.textContent = `
    .leaflet-default-icon-path {
      background-image: none !important;
    }

    .taniai-marker {
      width: 32px;
      height: 40px;
      background: #16a34a;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      border: 3px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,.35);
      position: relative;
    }

    .taniai-marker::after {
      content: '';
      position: absolute;
      inset: 5px;
      border-radius: 9999px;
      background: white;
    }

    .scrollbar-none::-webkit-scrollbar {
      display: none;
    }

    .scrollbar-none {
      -ms-overflow-style: none;
      scrollbar-width: none;
    }
  `;
  document.head.appendChild(style);
}

// ─────────────────────────────────────────────────────────────
// SUGGESTION ITEM TYPE
// ─────────────────────────────────────────────────────────────

interface SuggestionItem {
  name: string;
  province: string;
  lat: number;
  lon: number;
}

// ─────────────────────────────────────────────────────────────
// MAP MODAL
// ─────────────────────────────────────────────────────────────

interface MapModalProps {
  initialLat: number;
  initialLon: number;
  onConfirm: (loc: UserLocation) => void;
  onClose: () => void;
}

function MapModal({
  initialLat,
  initialLon,
  onConfirm,
  onClose,
}: MapModalProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const selectedLocRef = useRef<UserLocation | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [search, setSearch] = useState("");
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const [selectedName, setSelectedName] = useState(
    "Pilih lokasi di peta atau cari kota"
  );

  // ── click outside closes dropdown ────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── search location ───────────────────────────────────────
  const searchLocation = useCallback(async (value: string) => {
    setSearchLoading(true);
    setNoResults(false);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          value
        )}&countrycodes=id&addressdetails=1&namedetails=1&limit=10&accept-language=id&dedupe=1`,
        { headers: { Accept: "application/json" } }
      );
      const data = await res.json();
      const query = value.toLowerCase().trim();

      type RawItem = SuggestionItem & { _score: number };

      const mapped: RawItem[] = data.map((item: any) => {
        const addr = item.address ?? {};
        const namedetails = item.namedetails ?? {};

        // Nama lokal dari namedetails jika tersedia
        const localName: string | null =
          namedetails["name:id"] || namedetails["name"] || null;

        // Nama paling spesifik dari address fields
        // Jalan/road ditaruh paling atas agar ketik nama jalan langsung ketemu
        const addrName: string | null =
          addr.road ||
          addr.pedestrian ||
          addr.footway ||
          addr.path ||
          addr.village ||
          addr.hamlet ||
          addr.neighbourhood ||
          addr.quarter ||
          addr.suburb ||
          addr.town ||
          addr.city_district ||
          addr.city ||
          addr.county ||
          null;

        const firstName = (item.display_name ?? "").split(",")[0]?.trim() || "Lokasi ditemukan";
        const specificName: string = localName || addrName || firstName;

        // Konteks: kecamatan → kabupaten → provinsi, hindari duplikat dengan specificName
        const contextParts = [
          addr.municipality || addr.district || addr.regency || addr.county,
          addr.state,
        ].filter((p): p is string => !!p && p.toLowerCase() !== specificName.toLowerCase());

        const context = contextParts.join(", ");

        return {
          name: specificName,
          province: context,
          lat: parseFloat(item.lat),
          lon: parseFloat(item.lon),
          _score: specificName.toLowerCase().includes(query) ? 1 : 0,
        };
      });

      // Sort: hasil yang namanya mengandung query keyword duluan
      mapped.sort((a, b) => b._score - a._score);

      // Deduplicate by name+province
      const seen = new Set<string>();
      const deduped: SuggestionItem[] = mapped
        .filter((item) => {
          const key = `${item.name.toLowerCase()}|${item.province.toLowerCase()}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .map(({ name, province, lat, lon }) => ({ name, province, lat, lon }));

      setSuggestions(deduped);
      setNoResults(deduped.length === 0);
      setShowDropdown(true);
    } catch {
      setSuggestions([]);
      setNoResults(true);
      setShowDropdown(true);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  // ── debounce search ───────────────────────────────────────
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (search.trim().length >= 2) {
        searchLocation(search);
      } else {
        setSuggestions([]);
        setShowDropdown(false);
        setNoResults(false);
      }
    }, 450);
    return () => clearTimeout(timeout);
  }, [search, searchLocation]);

  // ── move marker ───────────────────────────────────────────
  const moveMarker = useCallback(
    async (lat: number, lon: number, knownName?: string) => {
      if (!markerRef.current) return;
      markerRef.current.setLatLng([lat, lon]);

      if (knownName) {
        setSelectedName(knownName);
        selectedLocRef.current = {
          lat,
          lon,
          city: knownName.split(",")[0].trim(),
          province: knownName.split(",")[1]?.trim() ?? "",
          displayName: knownName,
        };
        return;
      }

      setIsGeocoding(true);
      try {
        const loc = await reverseGeocode(lat, lon);
        const name =
          loc?.displayName ?? `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
        setSelectedName(name);
        selectedLocRef.current = loc ?? {
          lat,
          lon,
          city: name,
          province: "",
          displayName: name,
        };
      } catch {
        const fallback = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
        setSelectedName(fallback);
        selectedLocRef.current = {
          lat,
          lon,
          city: fallback,
          province: "",
          displayName: fallback,
        };
      } finally {
        setIsGeocoding(false);
      }
    },
    []
  );

  // ── fly to city ───────────────────────────────────────────
  const flyToCity = useCallback(
    (city: SuggestionItem) => {
      if (mapRef.current) {
        mapRef.current.flyTo([city.lat, city.lon], 13, { duration: 1.2 });
      }
      const name = city.province
        ? `${city.name}, ${city.province}`
        : city.name;
      moveMarker(city.lat, city.lon, name);
      setSearch("");
      setSuggestions([]);
      setShowDropdown(false);
      setNoResults(false);
    },
    [moveMarker]
  );

  // ── init leaflet ──────────────────────────────────────────
  useEffect(() => {
    ensureLeafletCss();
    let cancelled = false;

    const loadLeaflet = (): Promise<any> => {
      if ((window as any).L?.map) return Promise.resolve((window as any).L);
      return new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
        script.onload = () => {
          const L = (window as any).L;
          if (L) resolve(L);
          else reject(new Error("Leaflet failed"));
        };
        script.onerror = () => reject(new Error("Load failed"));
        document.head.appendChild(script);
      });
    };

    loadLeaflet()
      .then((L) => {
        if (cancelled || !mapContainerRef.current || mapRef.current) return;

        const map = L.map(mapContainerRef.current, {
          center: [initialLat, initialLon],
          zoom: 12,
          attributionControl: false,
        });

        L.tileLayer(
          "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
          { maxZoom: 19 }
        ).addTo(map);

        const customIcon = L.divIcon({
          className: "",
          html: '<div class="taniai-marker"></div>',
          iconSize: [32, 40],
          iconAnchor: [16, 40],
        });

        const marker = L.marker([initialLat, initialLon], {
          icon: customIcon,
          draggable: true,
        }).addTo(map);

        marker.on("dragend", (e: any) => {
          const { lat, lng } = e.target.getLatLng();
          moveMarker(lat, lng);
        });

        map.on("click", (e: any) => {
          moveMarker(e.latlng.lat, e.latlng.lng);
          map.panTo([e.latlng.lat, e.latlng.lng]);
        });

        mapRef.current = map;
        markerRef.current = marker;

        setTimeout(() => {
          if (!cancelled) {
            setMapReady(true);
            moveMarker(initialLat, initialLon);
          }
        }, 300);
      })
      .catch(() => setSelectedName("Gagal memuat peta"));

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [initialLat, initialLon, moveMarker]);

  // ── confirm ───────────────────────────────────────────────
  const handleConfirm = () => {
    if (!selectedLocRef.current) return;
    setIsConfirming(true);
    onConfirm(selectedLocRef.current);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        className="relative flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-card shadow-2xl"
        style={{ height: "min(90vh, 640px)" }}
      >
        {/* HEADER */}
        <div className="flex items-center gap-3 border-b px-5 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <MapPin className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-semibold">Pilih Lokasi</h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Klik map atau cari kota
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* SEARCH — wrapper is dropdown anchor */}
        <div className="relative px-4 pb-2 pt-3" ref={dropdownRef}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => {
                if (suggestions.length > 0 || noResults) setShowDropdown(true);
              }}
              placeholder="Cari kota atau alamat..."
              className="pl-9 pr-8"
            />
            {/* right-side indicator */}
            {searchLoading ? (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            ) : search.length > 0 ? (
              <button
                onClick={() => {
                  setSearch("");
                  setSuggestions([]);
                  setShowDropdown(false);
                  setNoResults(false);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 hover:bg-muted"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            ) : null}
          </div>

          {/* DROPDOWN — z-[9999] busts Leaflet map stacking context */}
          {showDropdown && (
            <div
              className="absolute left-4 right-4 top-[calc(100%-4px)] z-[9999] overflow-y-auto rounded-xl border bg-background/95 shadow-xl backdrop-blur-sm"
              style={{ maxHeight: "220px" }}
            >
              {searchLoading && suggestions.length === 0 ? (
                <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Mencari lokasi...
                </div>
              ) : noResults && !searchLoading ? (
                <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  Lokasi tidak ditemukan
                </div>
              ) : (
                suggestions.map((city, index) => (
                  <button
                    key={index}
                    // mousedown fires before blur — prevents dropdown closing before click lands
                    onMouseDown={(e) => {
                      e.preventDefault();
                      flyToCity(city);
                    }}
                    className="flex w-full items-start gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-muted/60 active:bg-muted"
                  >
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="truncate font-medium leading-snug">
                        {city.name}
                      </p>
                      {city.province && (
                        <p className="truncate text-xs text-muted-foreground">
                          {city.province}
                        </p>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* MAP */}
        <div className="relative flex-1">
          {!mapReady && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-muted/60">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Memuat peta...</p>
            </div>
          )}
          <div ref={mapContainerRef} className="h-full w-full" />
        </div>

        {/* FOOTER */}
        <div className="border-t px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Lokasi dipilih
              </p>
              <div className="mt-1 flex items-center gap-1.5">
                {isGeocoding && (
                  <Loader2 className="h-3 w-3 animate-spin" />
                )}
                <p className="truncate text-sm font-medium">{selectedName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={onClose}>
                Batal
              </Button>
              <Button
                size="sm"
                onClick={handleConfirm}
                disabled={
                  isConfirming ||
                  isGeocoding ||
                  selectedName.startsWith("Pilih")
                }
                className="gap-1.5"
              >
                {isConfirming ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                Gunakan Lokasi
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// WEATHER PAGE
// ─────────────────────────────────────────────────────────────

function WeatherPage() {
  const {
    weather,
    weatherLoading,
    location,
    setLocationByCoords,
    refetch,
    isRealtime,
    lastUpdated,
  } = useWeather();

  const { data: plants = [] } = usePlants();

  const [showMapModal, setShowMapModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: diseaseWarnings } = useQuery({
    queryKey: [
      "disease-warnings",
      weather?.current.humidity,
      plants.map((p) => p.name).join(","),
    ],
    queryFn: async () => {
      if (!weather || plants.length === 0) {
        return { warnings: [] };
      }
      return getDiseaseWarnings({
        plants: plants
          .filter((p) => p.status === "Aktif")
          .map((p) => ({
            name: p.name,
            type: p.type,
            ageDays: p.age_days,
            soilCondition: p.soil_condition,
            location: p.location ?? undefined,
          })),
        humidity: weather.current.humidity,
        rainfall: weather.forecast[0]?.rainfall ?? 0,
        weatherCondition: weather.current.condition,
      });
    },
    enabled: !!weather && plants.length > 0,
    staleTime: 1000 * 60 * 60,
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setTimeout(() => setIsRefreshing(false), 700);
  };

  const handleMapConfirm = useCallback(
    (loc: UserLocation) => {
      setLocationByCoords(loc);
      setShowMapModal(false);
    },
    [setLocationByCoords]
  );

  const lastUpdatedLabel = lastUpdated
    ? format(new Date(lastUpdated), "HH:mm", { locale: idLocale })
    : null;

  return (
    <>
      {showMapModal && (
        <MapModal
          initialLat={location?.lat ?? -7.797}
          initialLon={location?.lon ?? 110.37}
          onConfirm={handleMapConfirm}
          onClose={() => setShowMapModal(false)}
        />
      )}

      <div className="space-y-6">
        {/* HEADER */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Cuaca & Peringatan
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {location?.displayName ?? "Mendeteksi lokasi..."}
              </span>
              {isRealtime && (
                <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-600">
                  Real-time
                </span>
              )}
              {lastUpdatedLabel && (
                <span className="flex items-center gap-1 text-[11px]">
                  <Clock className="h-3 w-3" />
                  Diperbarui {lastUpdatedLabel}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowMapModal(true)}
              className="gap-1.5"
            >
              <MapPin className="h-3.5 w-3.5" />
              Ganti Lokasi
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="gap-1.5"
            >
              <RefreshCw
                className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")}
              />
              {isRefreshing ? "Memperbarui..." : "Perbarui"}
            </Button>
          </div>
        </div>

        {/* LOADING */}
        {(weatherLoading || isRefreshing) && (
          <div className="space-y-4 animate-pulse">
            <Skeleton className="h-64 w-full rounded-2xl" />
            <div className="grid grid-cols-6 gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-40 rounded-2xl" />
          </div>
        )}

        {/* CONTENT */}
        {!weatherLoading && !isRefreshing && weather && (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* HERO */}
            <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-700 text-white shadow-xl">
              <div className="p-6 sm:p-8">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-white/70">
                      {format(new Date(), "EEEE, d MMMM yyyy", {
                        locale: idLocale,
                      })}
                    </p>
                    <div className="mt-2 flex items-end gap-3">
                      <span className="text-7xl font-bold leading-none">
                        {weather.current.temp}°
                      </span>
                      <div className="mb-2">
                        <p className="text-xl font-semibold">
                          {weather.current.condition}
                        </p>
                        <p className="text-sm capitalize text-white/70">
                          {weather.current.description}
                        </p>
                      </div>
                    </div>
                    <p className="mt-1 text-sm text-white/70">
                      Terasa seperti {weather.current.feels_like}°C
                    </p>
                  </div>
                  <WIcon
                    condition={weather.current.condition}
                    className="h-20 w-20 text-white/80 sm:h-24 sm:w-24"
                  />
                </div>

                {/* DETAIL */}
                <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    {
                      icon: Droplets,
                      label: "Kelembapan",
                      value: `${weather.current.humidity}%`,
                    },
                    {
                      icon: Wind,
                      label: "Angin",
                      value: `${weather.current.wind_speed} km/j`,
                    },
                    {
                      icon: Thermometer,
                      label: "Terasa",
                      value: `${weather.current.feels_like}°C`,
                    },
                    {
                      icon: Eye,
                      label: "Hujan 1j",
                      value: `${weather.current.rainfall_1h} mm`,
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2.5 backdrop-blur-sm"
                    >
                      <item.icon className="h-4 w-4 text-white/70" />
                      <div>
                        <p className="text-[10px] text-white/60">{item.label}</p>
                        <p className="text-sm font-semibold">{item.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* FORECAST */}
              <div className="border-t border-white/20 bg-white/5 backdrop-blur-sm">
                <div className="flex overflow-x-auto scrollbar-none sm:grid sm:grid-cols-6">
                  {(weather.forecast.length > 0
                    ? weather.forecast.slice(0, 6)
                    : Array.from({ length: 6 })
                  ).map((day: any, i: number) => (
                    <div
                      key={day?.date ?? i}
                      className={cn(
                        "flex min-w-[75px] flex-shrink-0 flex-col items-center py-3 text-center text-xs sm:min-w-0",
                        i < 5 && "border-r border-white/10",
                        i === 0 && "bg-white/10"
                      )}
                    >
                      <p className="text-[11px] font-medium text-white/70">
                        {i === 0 ? "Hari ini" : day?.dayName?.slice(0, 3)}
                      </p>
                      {day ? (
                        <WIcon
                          condition={day.condition}
                          className="my-2 h-5 w-5 text-white/80"
                        />
                      ) : (
                        <div className="my-2 h-5 w-5 rounded-full bg-white/20" />
                      )}
                      <p className="font-bold">{day?.temp_max ?? "--"}°</p>
                      <p className="text-white/60">{day?.temp_min ?? "--"}°</p>
                      <div className="mt-1 flex items-center gap-0.5 text-[9px] text-blue-200">
                        <Droplets className="h-2.5 w-2.5" />
                        {day?.rain_chance ?? 0}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* WEATHER ALERTS */}
            {weather.alerts.length > 0 && (
              <div className="space-y-3">
                <h2 className="flex items-center gap-2 font-semibold">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  Peringatan Cuaca
                </h2>
                {weather.alerts.map((alert, i) => (
                  <div key={i} className="rounded-2xl border p-4">
                    <div className="flex gap-3">
                      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-yellow-500" />
                      <div>
                        <p className="text-sm font-semibold">{alert.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {alert.message}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* EMPTY */}
        {!weatherLoading && !weather && (
          <div className="rounded-2xl border bg-card p-12 text-center shadow-sm">
            <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground/30" />
            <p className="mt-4 font-semibold">Tidak dapat memuat cuaca</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Pastikan API cuaca sudah benar
            </p>
            <Button className="mt-4 gap-1.5" onClick={handleRefresh}>
              <RefreshCw className="h-3.5 w-3.5" />
              Coba Lagi
            </Button>
          </div>
        )}
      </div>
    </>
  );
}