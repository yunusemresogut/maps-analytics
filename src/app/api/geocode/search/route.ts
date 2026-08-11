import { NextResponse } from "next/server";

export type GeocodeResult = {
  id: string;
  label: string;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();

  if (q.length < 3) {
    return NextResponse.json({ results: [] as GeocodeResult[] });
  }

  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "json");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("limit", "6");
    url.searchParams.set("countrycodes", "tr");
    url.searchParams.set("q", q);

    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": "MapsAnalytics/1.0 (local-dev)",
        Accept: "application/json",
      },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Geocoding failed", results: [] },
        { status: 502 }
      );
    }

    const data = (await res.json()) as Array<{
      place_id: number;
      display_name: string;
      lat: string;
      lon: string;
      address?: Record<string, string>;
    }>;

    const results: GeocodeResult[] = data.map((item) => {
      const addr = item.address || {};
      const city =
        addr.city ||
        addr.town ||
        addr.province ||
        addr.state ||
        addr.county ||
        "";
      return {
        id: String(item.place_id),
        label: item.display_name,
        address: item.display_name,
        city,
        latitude: Number(item.lat),
        longitude: Number(item.lon),
      };
    });

    return NextResponse.json({ results });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Geocoding failed", results: [] },
      { status: 500 }
    );
  }
}
