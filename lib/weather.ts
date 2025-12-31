/**
 * Weather utility for Open-Meteo API integration
 * Free API, no key required
 */

export type WeatherCondition =
  | "clear"
  | "partly_cloudy"
  | "cloudy"
  | "foggy"
  | "rainy"
  | "snowy"
  | "stormy";

interface OpenMeteoResponse {
  current: {
    weather_code: number;
    is_day: number;
  };
}

/**
 * Fetch current weather from Open-Meteo
 */
export async function fetchWeather(
  lat: number,
  lon: number
): Promise<OpenMeteoResponse> {
  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=weather_code,is_day`,
    { next: { revalidate: 1800 } } // Cache for 30 minutes
  );

  if (!res.ok) {
    throw new Error(`Weather API error: ${res.status}`);
  }

  return res.json();
}

/**
 * Convert WMO weather code to simplified condition
 * https://open-meteo.com/en/docs#weathervariables
 */
export function getWeatherCondition(code: number): WeatherCondition {
  // 0: Clear sky
  if (code === 0) return "clear";

  // 1-3: Mainly clear, partly cloudy, overcast
  if (code <= 2) return "partly_cloudy";
  if (code === 3) return "cloudy";

  // 45-48: Fog
  if (code >= 45 && code <= 48) return "foggy";

  // 51-67: Drizzle and rain
  if (code >= 51 && code <= 67) return "rainy";

  // 71-77: Snow
  if (code >= 71 && code <= 77) return "snowy";

  // 80-82: Rain showers
  if (code >= 80 && code <= 82) return "rainy";

  // 85-86: Snow showers
  if (code >= 85 && code <= 86) return "snowy";

  // 95-99: Thunderstorm
  if (code >= 95) return "stormy";

  return "clear";
}
