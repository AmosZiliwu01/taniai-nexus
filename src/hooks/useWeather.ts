// src/hooks/useWeather.ts
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import {
  fetchWeather, getMockWeather, type WeatherData,
} from "@/services/weather/weatherService";
import {
  autoDetectLocation, saveLocation, geocodeCity,
  getSavedLocation, type UserLocation,
} from "@/services/location/locationService";
import { supabase } from "@/integrations/supabase/client";

export function useWeather() {
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);

  // Detect location on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLocationLoading(true);
      try {
        // 1. Cek cache dulu
        const cached = getSavedLocation();
        if (cached && !cancelled) { setLocation(cached); setLocationLoading(false); return; }

        // 2. Coba dari profile user
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: prof } = await supabase
            .from("profiles").select("location").eq("id", user.id).maybeSingle();
          if (prof?.location) {
            const loc = await geocodeCity(prof.location);
            if (loc && !cancelled) { saveLocation(loc); setLocation(loc); setLocationLoading(false); return; }
          }
        }

        // 3. Auto-detect dari browser
        const detected = await autoDetectLocation();
        if (!cancelled) setLocation(detected);
      } catch {
        if (!cancelled) setLocation(null);
      } finally {
        if (!cancelled) setLocationLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const weatherQuery = useQuery<WeatherData>({
    queryKey: ["weather", location?.lat, location?.lon],

    queryFn: async () => {
      if (!location) return getMockWeather("Indonesia");

      const apiKey = import.meta.env.VITE_OPENWEATHER_API_KEY;

      if (!apiKey) {
        return getMockWeather(location.displayName);
      }

      return fetchWeather(location.lat, location.lon);
    },

    enabled: !locationLoading,

    // cache 30 menit
    staleTime: 30 * 60 * 1000,

    // simpan cache 1 jam
    gcTime: 60 * 60 * 1000,

    // JANGAN auto refresh saat pindah halaman / focus
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,

  retry: 1,
});

  const changeLocation = async (cityName: string) => {
    const loc = await geocodeCity(cityName);
    if (loc) { saveLocation(loc); setLocation(loc); }
    else {
      const fallback: UserLocation = { lat: -6.2, lon: 106.8, city: cityName, province: "", displayName: cityName };
      saveLocation(fallback);
      setLocation(fallback);
    }
  };

  // Set lokasi langsung dari koordinat (untuk map picker)
  const setLocationByCoords = (loc: UserLocation) => {
    saveLocation(loc);
    setLocation(loc);
  };

  return {
    weather: weatherQuery.data ?? null,
    weatherLoading: weatherQuery.isLoading || locationLoading,
    weatherError: weatherQuery.error as Error | null,
    location,
    locationLoading,
    changeLocation,
    setLocationByCoords,
    refetch: weatherQuery.refetch,
    isRealtime: !!(import.meta.env.VITE_OPENWEATHER_API_KEY && location),
    lastUpdated: weatherQuery.dataUpdatedAt,
  };
}

// Compact weather summary string untuk AI context
export function getWeatherSummary(weather: WeatherData | null): string {
  if (!weather) return "tidak diketahui";
  const c = weather.current;
  return `${c.condition}, ${c.temp}°C, kelembapan ${c.humidity}%, angin ${c.wind_speed} km/jam`;
}