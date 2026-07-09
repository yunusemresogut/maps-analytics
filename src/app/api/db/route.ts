import { NextResponse } from "next/server";
import { getDb, updateDb } from "@/lib/db-server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getDb();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Veritabanı okuma hatası: " + error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const data = await updateDb(payload);
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Veritabanı yazma hatası: " + error.message },
      { status: 500 }
    );
  }
}
