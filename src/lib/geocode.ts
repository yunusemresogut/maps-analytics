import { apiFetch } from "@/lib/api-client";

export type Coords = { latitude: number; longitude: number };

export type GeocodeResult = Coords & {
  id: string;
  label: string;
  address: string;
  /** Türkiye'de 81 ilden biri (sunucu eşler); yurt dışında şehir */
  city: string;
  district: string;
  country: string;
};

export async function searchAddresses(query: string, signal?: AbortSignal): Promise<GeocodeResult[]> {
  const response = await apiFetch(`/api/geocode/search?q=${encodeURIComponent(query)}`, { signal });
  const data = (await response.json().catch(() => null)) as { results?: GeocodeResult[] } | null;
  if (!response.ok || !Array.isArray(data?.results)) throw new Error("Adres araması başarısız");
  return data.results;
}

export async function reverseGeocode(coords: Coords, signal?: AbortSignal): Promise<GeocodeResult | null> {
  const response = await apiFetch(
    `/api/geocode/reverse?lat=${coords.latitude}&lng=${coords.longitude}`,
    { signal }
  );
  const data = (await response.json().catch(() => null)) as { result?: GeocodeResult | null } | null;
  if (!response.ok || !data) throw new Error("Konumdan adres bulunamadı");
  return data.result ?? null;
}

export function sameCoords(a: Coords | null, b: Coords | null) {
  return (
    !!a &&
    !!b &&
    Math.abs(a.latitude - b.latitude) < 1e-7 &&
    Math.abs(a.longitude - b.longitude) < 1e-7
  );
}

/** Ana haritadan gelen konum seçimi; nonce aynı noktaya tekrar tıklamayı da yeni olay yapar */
export type MapPick = { coords: Coords; nonce: number; source: "click" | "drag" };
