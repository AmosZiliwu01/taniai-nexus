// src/services/location/locationService.ts
// Centralized location service — reusable untuk weather, market, AI, analytics

export interface UserLocation {
  lat: number;
  lon: number;
  city: string;
  province: string;
  displayName: string;
}

const STORAGE_KEY = "taniai_user_location";
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 menit

interface CachedLocation {
  location: UserLocation;
  timestamp: number;
}

// ─── Simpan & Baca dari localStorage ────────────────────────────────────────

export function saveLocation(loc: UserLocation): void {
  const cached: CachedLocation = { location: loc, timestamp: Date.now() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
}

export function getSavedLocation(): UserLocation | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const cached: CachedLocation = JSON.parse(raw);
    if (Date.now() - cached.timestamp > CACHE_TTL_MS) return null;
    return cached.location;
  } catch {
    return null;
  }
}

export function clearSavedLocation(): void {
  localStorage.removeItem(STORAGE_KEY);
}

// ─── Browser Geolocation ─────────────────────────────────────────────────────

export async function getBrowserLocation(): Promise<{ lat: number; lon: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 8000, maximumAge: 5 * 60 * 1000 }
    );
  });
}

// ─── Reverse Geocode via OpenWeather ────────────────────────────────────────

export async function reverseGeocode(lat: number, lon: number): Promise<UserLocation | null> {
  const apiKey = import.meta.env.VITE_OPENWEATHER_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(
      `https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${apiKey}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data[0]) return null;
    const item = data[0];
    const city = item.local_names?.id ?? item.name ?? "Unknown";
    const province = item.state ?? "";
    return {
      lat, lon,
      city,
      province,
      displayName: province ? `${city}, ${province}` : city,
    };
  } catch {
    return null;
  }
}

// ─── Forward Geocode (cari kota by nama) ────────────────────────────────────

export async function geocodeCity(cityName: string): Promise<UserLocation | null> {
  const apiKey = import.meta.env.VITE_OPENWEATHER_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(
      `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(cityName)},ID&limit=1&appid=${apiKey}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data[0]) return null;
    const item = data[0];
    const city = item.local_names?.id ?? item.name ?? cityName;
    const province = item.state ?? "";
    return {
      lat: item.lat,
      lon: item.lon,
      city,
      province,
      displayName: province ? `${city}, ${province}` : city,
    };
  } catch {
    return null;
  }
}

// ─── Auto-detect lokasi user ─────────────────────────────────────────────────

export async function autoDetectLocation(): Promise<UserLocation | null> {
  // 1. Coba dari cache
  const saved = getSavedLocation();
  if (saved) return saved;

  // 2. Coba dari browser geolocation
  const coords = await getBrowserLocation();
  if (coords) {
    const loc = await reverseGeocode(coords.lat, coords.lon);
    if (loc) {
      saveLocation(loc);
      return loc;
    }
    // Fallback: koordinat saja tanpa nama kota
    const fallback: UserLocation = {
      lat: coords.lat,
      lon: coords.lon,
      city: "Lokasi Anda",
      province: "",
      displayName: "Lokasi Anda",
    };
    saveLocation(fallback);
    return fallback;
  }

  return null;
}

// ─── Daftar kota Indonesia untuk autocomplete ────────────────────────────────

export const INDONESIAN_CITIES: { name: string; lat: number; lon: number; province: string }[] = [
  { name: "Jakarta", lat: -6.2088, lon: 106.8456, province: "DKI Jakarta" },
  { name: "Surabaya", lat: -7.2575, lon: 112.7521, province: "Jawa Timur" },
  { name: "Bandung", lat: -6.9175, lon: 107.6191, province: "Jawa Barat" },
  { name: "Medan", lat: 3.5952, lon: 98.6722, province: "Sumatera Utara" },
  { name: "Semarang", lat: -6.9932, lon: 110.4203, province: "Jawa Tengah" },
  { name: "Makassar", lat: -5.1477, lon: 119.4327, province: "Sulawesi Selatan" },
  { name: "Palembang", lat: -2.9761, lon: 104.7754, province: "Sumatera Selatan" },
  { name: "Yogyakarta", lat: -7.7956, lon: 110.3695, province: "DIY" },
  { name: "Malang", lat: -7.9797, lon: 112.6304, province: "Jawa Timur" },
  { name: "Bogor", lat: -6.5971, lon: 106.806, province: "Jawa Barat" },
  { name: "Denpasar", lat: -8.6705, lon: 115.2126, province: "Bali" },
  { name: "Sleman", lat: -7.7162, lon: 110.3551, province: "DIY" },
  { name: "Bantul", lat: -7.8889, lon: 110.3284, province: "DIY" },
  { name: "Klaten", lat: -7.7063, lon: 110.6013, province: "Jawa Tengah" },
  { name: "Solo", lat: -7.5755, lon: 110.8243, province: "Jawa Tengah" },
  { name: "Purwokerto", lat: -7.4262, lon: 109.2337, province: "Jawa Tengah" },
  { name: "Magelang", lat: -7.4709, lon: 110.2177, province: "Jawa Tengah" },
  { name: "Pekalongan", lat: -6.8886, lon: 109.6753, province: "Jawa Tengah" },
  { name: "Tegal", lat: -6.8797, lon: 109.1256, province: "Jawa Tengah" },
  { name: "Cirebon", lat: -6.7063, lon: 108.557, province: "Jawa Barat" },
  { name: "Tasikmalaya", lat: -7.3274, lon: 108.2207, province: "Jawa Barat" },
  { name: "Sukabumi", lat: -6.9228, lon: 106.9267, province: "Jawa Barat" },
  { name: "Bekasi", lat: -6.2349, lon: 106.9896, province: "Jawa Barat" },
  { name: "Depok", lat: -6.4025, lon: 106.7942, province: "Jawa Barat" },
  { name: "Tangerang", lat: -6.178, lon: 106.63, province: "Banten" },
  { name: "Garut", lat: -7.2167, lon: 107.9, province: "Jawa Barat" },
  { name: "Cianjur", lat: -6.8178, lon: 107.1387, province: "Jawa Barat" },
  { name: "Karawang", lat: -6.3267, lon: 107.3382, province: "Jawa Barat" },
  { name: "Kediri", lat: -7.8169, lon: 112.0181, province: "Jawa Timur" },
  { name: "Jember", lat: -8.1845, lon: 113.6874, province: "Jawa Timur" },
  { name: "Blitar", lat: -8.0956, lon: 112.1683, province: "Jawa Timur" },
  { name: "Madiun", lat: -7.6297, lon: 111.5227, province: "Jawa Timur" },
  { name: "Probolinggo", lat: -7.7543, lon: 113.2159, province: "Jawa Timur" },
  { name: "Pasuruan", lat: -7.6456, lon: 112.9079, province: "Jawa Timur" },
  { name: "Banyuwangi", lat: -8.2193, lon: 114.3691, province: "Jawa Timur" },
  { name: "Sidoarjo", lat: -7.4456, lon: 112.718, province: "Jawa Timur" },
  { name: "Mojokerto", lat: -7.4714, lon: 112.4342, province: "Jawa Timur" },
  { name: "Tulungagung", lat: -8.0653, lon: 111.9014, province: "Jawa Timur" },
  { name: "Pekanbaru", lat: 0.5333, lon: 101.45, province: "Riau" },
  { name: "Batam", lat: 1.0456, lon: 104.0305, province: "Kepulauan Riau" },
  { name: "Padang", lat: -0.9471, lon: 100.4172, province: "Sumatera Barat" },
  { name: "Bukittinggi", lat: -0.3031, lon: 100.3681, province: "Sumatera Barat" },
  { name: "Jambi", lat: -1.6101, lon: 103.6131, province: "Jambi" },
  { name: "Bengkulu", lat: -3.7928, lon: 102.2608, province: "Bengkulu" },
  { name: "Bandar Lampung", lat: -5.4292, lon: 105.2613, province: "Lampung" },
  { name: "Pontianak", lat: -0.0263, lon: 109.3425, province: "Kalimantan Barat" },
  { name: "Samarinda", lat: -0.4948, lon: 117.1436, province: "Kalimantan Timur" },
  { name: "Balikpapan", lat: -1.2675, lon: 116.8289, province: "Kalimantan Timur" },
  { name: "Banjarmasin", lat: -3.3186, lon: 114.5944, province: "Kalimantan Selatan" },
  { name: "Palangkaraya", lat: -2.2161, lon: 113.9135, province: "Kalimantan Tengah" },
  { name: "Manado", lat: 1.4748, lon: 124.8421, province: "Sulawesi Utara" },
  { name: "Palu", lat: -0.9003, lon: 119.8779, province: "Sulawesi Tengah" },
  { name: "Kendari", lat: -3.9985, lon: 122.5129, province: "Sulawesi Tenggara" },
  { name: "Gorontalo", lat: 0.5435, lon: 123.0568, province: "Gorontalo" },
  { name: "Mataram", lat: -8.5833, lon: 116.1167, province: "NTB" },
  { name: "Kupang", lat: -10.1772, lon: 123.6073, province: "NTT" },
  { name: "Ambon", lat: -3.6555, lon: 128.1908, province: "Maluku" },
  { name: "Ternate", lat: 0.7833, lon: 127.3667, province: "Maluku Utara" },
  { name: "Jayapura", lat: -2.5337, lon: 140.7181, province: "Papua" },
  { name: "Sorong", lat: -0.8761, lon: 131.2558, province: "Papua Barat" },
  { name: "Brebes", lat: -6.8716, lon: 108.9568, province: "Jawa Tengah" },
  { name: "Wonosobo", lat: -7.3609, lon: 109.9005, province: "Jawa Tengah" },
  { name: "Temanggung", lat: -7.3127, lon: 110.1697, province: "Jawa Tengah" },
  { name: "Salatiga", lat: -7.3318, lon: 110.5076, province: "Jawa Tengah" },
  { name: "Kudus", lat: -6.8042, lon: 110.8383, province: "Jawa Tengah" },
  { name: "Jepara", lat: -6.5879, lon: 110.6674, province: "Jawa Tengah" },
  { name: "Demak", lat: -6.8944, lon: 110.6402, province: "Jawa Tengah" },
  { name: "Boyolali", lat: -7.5268, lon: 110.5994, province: "Jawa Tengah" },
  { name: "Rembang", lat: -6.7048, lon: 111.3415, province: "Jawa Tengah" },
  { name: "Blora", lat: -6.9714, lon: 111.4133, province: "Jawa Tengah" },
  { name: "Grobogan", lat: -7.0219, lon: 110.9116, province: "Jawa Tengah" },
  { name: "Banjarnegara", lat: -7.3908, lon: 109.6944, province: "Jawa Tengah" },
];
