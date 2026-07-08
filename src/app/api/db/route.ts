import { NextResponse } from "next/server";
import { list, put } from "@vercel/blob";
import fs from "fs";
import path from "path";
import { demoStores } from "@/data/stores";

export const dynamic = "force-dynamic";

const LOCAL_DB_PATH = path.join(process.cwd(), "src/data/local_db.json");

function getInitialData() {
  return {
    stores: demoStores,
    storeData: {},
  };
}

function isBlobConfigured() {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

export async function GET() {
  try {
    if (isBlobConfigured()) {
      const { blobs } = await list();
      const dbBlob = blobs.find((b) => b.pathname === "db.json");

      if (dbBlob) {
        // Fetch direct from blob URL (add a cache-buster query param to avoid CDN caching issues)
        const response = await fetch(`${dbBlob.url}?t=${Date.now()}`, {
          cache: "no-store",
        });
        const data = await response.json();
        return NextResponse.json(data);
      } else {
        const initial = getInitialData();
        return NextResponse.json(initial);
      }
    } else {
      // Local fallback
      if (fs.existsSync(LOCAL_DB_PATH)) {
        const fileContent = fs.readFileSync(LOCAL_DB_PATH, "utf-8");
        return NextResponse.json(JSON.parse(fileContent));
      } else {
        const initial = getInitialData();
        fs.mkdirSync(path.dirname(LOCAL_DB_PATH), { recursive: true });
        fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(initial, null, 2));
        return NextResponse.json(initial);
      }
    }
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

    if (isBlobConfigured()) {
      await put("db.json", JSON.stringify(payload), {
        access: "public",
        addRandomSuffix: false,
      });
    } else {
      // Local fallback
      fs.mkdirSync(path.dirname(LOCAL_DB_PATH), { recursive: true });
      fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(payload, null, 2));
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Veritabanı yazma hatası: " + error.message },
      { status: 500 }
    );
  }
}
