import { NextResponse } from "next/server";
import { getRequestCaller } from "@/lib/server-auth";
import { NOMINATIM_HEADERS, parseNominatimItem, type GeocodeResult } from "@/lib/geocode-server";

export type { GeocodeResult };

/** Adres → konum adayları (dünya geneli; sonuçlar Türkçe adlarla) */
export async function GET(request: Request) {
  // Açık bir proxy olmasın: yalnızca oturum açmış kullanıcılar
  const auth = await getRequestCaller(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim().slice(0, 300);

  if (q.length < 3) {
    return NextResponse.json({ results: [] as GeocodeResult[] });
  }

  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "json");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("limit", "6");
    url.searchParams.set("q", q);

    const res = await fetch(url.toString(), { headers: NOMINATIM_HEADERS, cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json({ error: "Geocoding failed", results: [] }, { status: 502 });
    }
    const data = (await res.json()) as Parameters<typeof parseNominatimItem>[0][];
    // Şehri belirlenemeyen (okyanus, ülke geneli gibi) sonuçlar mağaza konumu olamaz
    const results = data.map(parseNominatimItem).filter((item) => item.city);
    return NextResponse.json({ results });
  } catch (error: unknown) {
    console.error("Adres araması başarısız", error);
    return NextResponse.json({ error: "Geocoding failed", results: [] }, { status: 500 });
  }
}
