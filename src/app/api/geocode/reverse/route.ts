import { NextResponse } from "next/server";
import { getRequestCaller } from "@/lib/server-auth";
import { NOMINATIM_HEADERS, parseNominatimItem } from "@/lib/geocode-server";
import { localeFromRequest, serverTranslator } from "@/i18n/server";

/** Konum → adres ve il. Haritadan seçilen ya da sürüklenen pin için kullanılır. */
export async function GET(request: Request) {
  const auth = await getRequestCaller(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: serverTranslator(localeFromRequest(request))("api.geocode.invalidCoordinates") }, { status: 400 });
  }

  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("format", "json");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("zoom", "18");
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lng));

    const res = await fetch(url.toString(), { headers: NOMINATIM_HEADERS, cache: "no-store" });
    if (!res.ok) return NextResponse.json({ error: "Geocoding failed" }, { status: 502 });
    const data = (await res.json()) as Parameters<typeof parseNominatimItem>[0] & { error?: string };
    if (data.error || !data.place_id) return NextResponse.json({ result: null });

    // Koordinat kullanıcının seçtiği nokta olarak kalır; adres en yakın yerden gelir
    const parsed = parseNominatimItem(data);
    return NextResponse.json({ result: { ...parsed, latitude: lat, longitude: lng } });
  } catch (error: unknown) {
    console.error("Konumdan adres bulunamadı", error);
    return NextResponse.json({ error: "Geocoding failed" }, { status: 500 });
  }
}
