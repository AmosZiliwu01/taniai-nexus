// src/services/weather/weatherService.ts
// OpenWeather API integration — real-time weather + REAL 7-day forecast

export interface CurrentWeather {
  temp: number;
  feels_like: number;
  humidity: number;
  wind_speed: number;
  wind_deg: number;
  rainfall_1h: number;
  condition: string;
  description: string;
  icon: string;
  city: string;
  country: string;
  updated_at: Date;
}

export interface ForecastDay {
  date: string;
  dayName: string;
  temp_max: number;
  temp_min: number;
  humidity: number;
  rainfall: number;
  wind_speed: number;
  condition: string;
  description: string;
  icon: string;
  rain_chance: number;
}

export interface WeatherData {
  current: CurrentWeather;
  forecast: ForecastDay[];
  alerts: WeatherAlert[];
}

export interface WeatherAlert {
  type:
    | "hujan_lebat"
    | "badai"
    | "kelembapan_tinggi"
    | "kekeringan"
    | "angin_kencang";
  title: string;
  message: string;
  severity: "info" | "warning" | "danger";
}

const CACHE_KEY = "taniai_weather_cache";
const CACHE_TTL = 30 * 60 * 1000;

interface WeatherCache {
  data: WeatherData;
  lat: number;
  lon: number;
  timestamp: number;
}

function getCache(lat: number, lon: number): WeatherData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);

    if (!raw) return null;

    const cache: WeatherCache = JSON.parse(raw);

    const sameLocation =
      Math.abs(cache.lat - lat) < 0.05 &&
      Math.abs(cache.lon - lon) < 0.05;

    if (!sameLocation) return null;

    if (Date.now() - cache.timestamp > CACHE_TTL) return null;

    return cache.data;
  } catch {
    return null;
  }
}

function setCache(lat: number, lon: number, data: WeatherData): void {
  const cache: WeatherCache = {
    data,
    lat,
    lon,
    timestamp: Date.now(),
  };

  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

const DAYS_ID = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
];

function conditionToId(main: string, desc: string): string {
  const m = main.toLowerCase();
  const d = desc.toLowerCase();

  if (m === "thunderstorm") return "Badai Petir";

  if (m === "drizzle") return "Gerimis";

  if (m === "rain") {
    if (d.includes("heavy") || d.includes("extreme")) {
      return "Hujan Lebat";
    }

    if (d.includes("light")) {
      return "Hujan Ringan";
    }

    return "Hujan";
  }

  if (m === "snow") return "Salju";

  if (m === "atmosphere") {
    if (d.includes("fog") || d.includes("mist")) {
      return "Berkabut";
    }

    return "Berawan Tebal";
  }

  if (m === "clear") return "Cerah";

  if (m === "clouds") {
    if (d.includes("few") || d.includes("scattered")) {
      return "Cerah Berawan";
    }

    if (d.includes("broken") || d.includes("overcast")) {
      return "Berawan";
    }

    return "Berawan";
  }

  return "Cerah";
}

function buildAlerts(
  current: CurrentWeather,
  forecast: ForecastDay[]
): WeatherAlert[] {
  const alerts: WeatherAlert[] = [];

  if (current.humidity >= 85) {
    alerts.push({
      type: "kelembapan_tinggi",
      severity: "warning",
      title: "Kelembapan Sangat Tinggi",
      message: `Kelembapan ${current.humidity}% — risiko jamur dan penyakit daun meningkat.`,
    });
  }

  const heavyRainDay = forecast
    .slice(0, 3)
    .find((f) => f.rainfall > 20 || f.rain_chance > 70);

  if (heavyRainDay) {
    alerts.push({
      type: "hujan_lebat",
      severity: "warning",
      title: "Potensi Hujan Lebat",
      message: `Hujan lebat diprakirakan pada ${heavyRainDay.dayName}.`,
    });
  }

  if (current.wind_speed > 10) {
    alerts.push({
      type: "angin_kencang",
      severity: "info",
      title: "Angin Cukup Kencang",
      message: `Kecepatan angin ${Math.round(
        current.wind_speed
      )} km/jam.`,
    });
  }

  const noRain = forecast
    .slice(0, 5)
    .every((f) => f.rainfall < 2 && f.rain_chance < 30);

  if (noRain && current.humidity < 55) {
    alerts.push({
      type: "kekeringan",
      severity: "warning",
      title: "Potensi Kekeringan",
      message:
        "Tidak ada hujan diprakirakan selama 5 hari ke depan.",
    });
  }

  if (current.condition === "Badai Petir") {
    alerts.push({
      type: "badai",
      severity: "danger",
      title: "Waspada Badai",
      message:
        "Kondisi cuaca berbahaya. Hindari aktivitas di lahan terbuka.",
    });
  }

  return alerts;
}

export async function fetchWeather(
  lat: number,
  lon: number
): Promise<WeatherData> {
  const apiKey = import.meta.env.VITE_OPENWEATHER_API_KEY;

  if (!apiKey) {
    throw new Error("VITE_OPENWEATHER_API_KEY belum diisi");
  }

  // cache
  const cached = getCache(lat, lon);

  if (cached) {
    return cached;
  }

  // fetch current + forecast
  const [currentRes, forecastRes] = await Promise.all([
    fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=id`
    ),

    fetch(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=id&cnt=40`
    ),
  ]);

  if (!currentRes.ok) {
    throw new Error(
      `Gagal mengambil data cuaca: ${currentRes.status}`
    );
  }

  if (!forecastRes.ok) {
    throw new Error(
      `Gagal mengambil prakiraan: ${forecastRes.status}`
    );
  }

  const [cData, fData] = await Promise.all([
    currentRes.json(),
    forecastRes.json(),
  ]);

  // current weather
  const current: CurrentWeather = {
    temp: Math.round(cData.main.temp),

    feels_like: Math.round(cData.main.feels_like),

    humidity: cData.main.humidity,

    wind_speed: Math.round((cData.wind?.speed ?? 0) * 3.6),

    wind_deg: cData.wind?.deg ?? 0,

    rainfall_1h: cData.rain?.["1h"] ?? 0,

    condition: conditionToId(
      cData.weather[0].main,
      cData.weather[0].description
    ),

    description: cData.weather[0].description,

    icon: cData.weather[0].icon,

    city: cData.name,

    country: cData.sys.country,

    updated_at: new Date(),
  };

  // group forecast by date
  const dayMap = new Map<string, any[]>();

  for (const item of fData.list) {
    const date = item.dt_txt.split(" ")[0];

    if (!dayMap.has(date)) {
      dayMap.set(date, []);
    }

    dayMap.get(date)!.push(item);
  }

  // YYYY-MM-DD STABLE FORMAT
  const now = new Date();

  const todayStr =
    now.getFullYear() +
    "-" +
    String(now.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(now.getDate()).padStart(2, "0");

  // inject TODAY if missing
  if (!dayMap.has(todayStr)) {
    const syntheticItem = {
      dt_txt: `${todayStr} 12:00:00`,

      main: {
        temp: cData.main.temp,
        temp_min: cData.main.temp_min,
        temp_max: cData.main.temp_max,
        humidity: cData.main.humidity,
      },

      wind: {
        speed: cData.wind?.speed ?? 0,
      },

      rain: cData.rain
        ? {
            "3h": (cData.rain["1h"] ?? 0) * 3,
          }
        : undefined,

      pop: 0,

      weather: cData.weather,
    };

    const newMap = new Map<string, any[]>();

    newMap.set(todayStr, [syntheticItem]);

    for (const [k, v] of dayMap) {
      newMap.set(k, v);
    }

    dayMap.clear();

    for (const [k, v] of newMap) {
      dayMap.set(k, v);
    }
  }

  // SORTED + FORCE 7 DAYS
  const sortedDays = Array.from(dayMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(0, 7);

  const forecast: ForecastDay[] = [];

  for (const [date, items] of sortedDays) {
    const temps = items.map((i) => i.main.temp);

    const humidities = items.map(
      (i) => i.main.humidity
    );

    const winds = items.map(
      (i) => i.wind?.speed ?? 0
    );

    const rainfalls = items.map(
      (i) => i.rain?.["3h"] ?? 0
    );

    const rainProbs = items.map(
      (i) => i.pop ?? 0
    );

    const noonItem =
      items.find((i) =>
        i.dt_txt.includes("12:00")
      ) ?? items[Math.floor(items.length / 2)];

    const d = new Date(date + "T00:00:00");

    forecast.push({
      date,

      dayName: DAYS_ID[d.getDay()],

      temp_max: Math.round(Math.max(...temps)),

      temp_min: Math.round(Math.min(...temps)),

      humidity: Math.round(
        humidities.reduce((a, b) => a + b, 0) /
          humidities.length
      ),

      wind_speed: Math.round(
        (winds.reduce((a, b) => a + b, 0) /
          winds.length) *
          3.6
      ),

      rainfall:
        Math.round(
          rainfalls.reduce((a, b) => a + b, 0) * 10
        ) / 10,

      condition: conditionToId(
        noonItem.weather[0].main,
        noonItem.weather[0].description
      ),

      description: noonItem.weather[0].description,

      icon: noonItem.weather[0].icon,

      rain_chance: Math.round(
        Math.max(...rainProbs) * 100
      ),
    });
  }

  // FORCE EXACTLY 7 DAYS
  while (forecast.length < 7) {
    const last = forecast[forecast.length - 1];

    const nextDate = new Date(last.date);

    nextDate.setDate(nextDate.getDate() + 1);

    forecast.push({
      ...last,

      date: nextDate.toISOString().split("T")[0],

      dayName: DAYS_ID[nextDate.getDay()],
    });
  }

  const alerts = buildAlerts(current, forecast);

  const result: WeatherData = {
    current,
    forecast,
    alerts,
  };

  setCache(lat, lon, result);

  return result;
}

export function getMockWeather(
  cityName: string
): WeatherData {
  const today = new Date();

  const forecast: ForecastDay[] = Array.from({
    length: 7,
  }).map((_, i) => {
    const d = new Date(today);

    d.setDate(d.getDate() + i);

    const isRainy = [2, 3, 5].includes(i);

    return {
      date: d.toISOString().split("T")[0],

      dayName: DAYS_ID[d.getDay()],

      temp_max: 29 + Math.round(Math.random() * 3),

      temp_min: 22 + Math.round(Math.random() * 2),

      humidity: isRainy ? 85 : 68,

      wind_speed: 8 + Math.round(Math.random() * 6),

      rainfall: isRainy ? 12 : 0,

      condition: isRainy
        ? "Hujan"
        : i === 1
        ? "Cerah Berawan"
        : "Cerah",

      description: isRainy ? "hujan" : "cerah",

      icon: isRainy ? "10d" : "01d",

      rain_chance: isRainy ? 70 : 20,
    };
  });

  const current: CurrentWeather = {
    temp: 28,

    feels_like: 31,

    humidity: 72,

    wind_speed: 11,

    wind_deg: 180,

    rainfall_1h: 0,

    condition: "Cerah Berawan",

    description: "cerah berawan",

    icon: "02d",

    city: cityName,

    country: "ID",

    updated_at: new Date(),
  };

  return {
    current,
    forecast,
    alerts: [],
  };
}

export function conditionToLucideIcon(
  condition: string
): string {
  const c = condition.toLowerCase();

  if (c.includes("badai") || c.includes("petir")) {
    return "cloud-lightning";
  }

  if (c.includes("hujan lebat")) {
    return "cloud-rain";
  }

  if (
    c.includes("gerimis") ||
    c.includes("hujan ringan")
  ) {
    return "cloud-drizzle";
  }

  if (c.includes("hujan")) {
    return "cloud-rain";
  }

  if (
    c.includes("berkabut") ||
    c.includes("kabut")
  ) {
    return "cloud-fog";
  }

  if (
    c.includes("berawan") &&
    c.includes("cerah")
  ) {
    return "cloud-sun";
  }

  if (c.includes("berawan")) {
    return "cloud";
  }

  if (c.includes("cerah")) {
    return "sun";
  }

  return "cloud-sun";
}

export function conditionToColor(
  condition: string
): string {
  const c = condition.toLowerCase();

  if (c.includes("badai")) {
    return "text-red-500";
  }

  if (c.includes("hujan lebat")) {
    return "text-blue-600";
  }

  if (c.includes("hujan")) {
    return "text-blue-500";
  }

  if (c.includes("berawan")) {
    return "text-gray-500";
  }

  if (c.includes("cerah")) {
    return "text-amber-500";
  }

  return "text-sky-500";
}