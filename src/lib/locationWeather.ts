import * as Location from 'expo-location';
import { z } from 'zod';

const currentWeatherSchema = z.object({
  temperature_2m: z.number().optional(),
  weathercode: z.number().optional(),
});

const forecastSchema = z.object({
  current: currentWeatherSchema.optional(),
});

export interface EntryContext {
  locationLabel: string | null;
  weatherLabel: string | null;
}

/** Best-effort location + weather. Never throws — returns nulls when unavailable. */
export async function captureEntryContext(): Promise<EntryContext> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return { locationLabel: null, weatherLabel: null };
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
    let locationLabel: string | null = null;
    try {
      const [place] = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      if (place) {
        locationLabel = [place.city, place.region].filter(Boolean).join(', ') || null;
      }
    } catch {
      locationLabel = null;
    }
    let weatherLabel: string | null = null;
    try {
      // Open-Meteo needs no API key.
      const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${pos.coords.latitude}` +
        `&longitude=${pos.coords.longitude}&current=temperature_2m,weathercode&temperature_unit=celsius&timezone=auto`;
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 6000);
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(t);
      if (res.ok) {
        const json = await res.json();
        const parsed = forecastSchema.parse(json);
        const temp = parsed.current?.temperature_2m;
        const code = parsed.current?.weathercode;
        const desc = weatherDescription(code);
        weatherLabel = [desc, typeof temp === 'number' ? `${Math.round(temp)}°C` : null]
          .filter(Boolean)
          .join(' · ') || null;
      }
    } catch {
      weatherLabel = null;
    }
    return { locationLabel, weatherLabel };
  } catch {
    return { locationLabel: null, weatherLabel: null };
  }
}

function weatherDescription(code: number | undefined): string | null {
  if (code == null) return null;
  if (code === 0) return 'Clear sky';
  if (code <= 3) return 'Partly cloudy';
  if (code <= 48) return 'Foggy';
  if (code <= 57) return 'Drizzle';
  if (code <= 67) return 'Rain';
  if (code <= 77) return 'Snow';
  if (code <= 82) return 'Showers';
  if (code <= 99) return 'Stormy';
  return null;
}
