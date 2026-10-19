import { canonicalProvince } from "@/data/regions";

/** Nominatim (OpenStreetMap) sonucu → uygulamanın adres modeli. Yalnızca sunucuda kullanılır. */
export type GeocodeResult = {
  id: string;
  /** Arama listesinde gösterilen tam metin */
  label: string;
  /** Kısa adres: sokak/no, mahalle, ilçe/şehir (yurt dışında ülke de) */
  address: string;
  /** Türkiye'de 81 ilden biri; yurt dışında şehir/kasaba. Bulunamazsa boş */
  city: string;
  /** Türkiye'de ilçe; yurt dışında semt/bölge */
  district: string;
  /** Ülke adı (Türkçe), ör. "Türkiye", "Almanya" */
  country: string;
  latitude: number;
  longitude: number;
};

type NominatimItem = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address?: Record<string, string>;
};

export const NOMINATIM_HEADERS = {
  "User-Agent": "MapsAnalytics/1.0 (store-location)",
  Accept: "application/json",
  "Accept-Language": "tr",
};

/**
 * Türkiye'de il "province" alanındadır; "city"/"town" çoğu zaman ilçedir
 * (Kadıköy, Bodrum, "Bolu Merkez"). Şehir olarak bunlar kullanılırsa bölge
 * eşleştirmesi bozulur. Yurt dışında il kavramı olmadığından şehir/kasaba alınır.
 */
export function parseNominatimItem(item: NominatimItem): GeocodeResult {
  const a = item.address ?? {};
  const inTurkey = (a.country_code ?? "").toLowerCase() === "tr";
  const country = a.country ?? "";

  let city: string;
  let districtCandidate: string;
  if (inTurkey) {
    city = canonicalProvince(a.province) ?? canonicalProvince(a.state) ?? canonicalProvince(a.city) ?? "";
    districtCandidate = a.town || a.county || a.city_district || a.city || a.municipality || "";
  } else {
    city = a.city || a.town || a.village || a.municipality || a.county || a.state || "";
    districtCandidate = a.city_district || a.borough || a.suburb || "";
  }
  const district = districtCandidate && districtCandidate !== city ? districtCandidate : "";

  const street = [a.road || a.pedestrian || a.footway || "", a.house_number ? `No: ${a.house_number}` : ""]
    .filter(Boolean)
    .join(" ");
  const neighbourhood = inTurkey ? a.neighbourhood || a.suburb || a.quarter || a.village || "" : a.neighbourhood || a.quarter || "";
  const area = [district, city].filter(Boolean).join("/");
  const address =
    [street, neighbourhood, area, inTurkey ? "" : country].filter(Boolean).join(", ") || item.display_name;

  return {
    id: String(item.place_id),
    label: item.display_name,
    address,
    city,
    district,
    country,
    latitude: Number(item.lat),
    longitude: Number(item.lon),
  };
}
