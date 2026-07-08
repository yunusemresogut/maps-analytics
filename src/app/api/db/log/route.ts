import { NextResponse } from "next/server";
import { list, put } from "@vercel/blob";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const LOCAL_DB_PATH = path.join(process.cwd(), "src/data/local_db.json");

function isBlobConfigured() {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

async function getDb() {
  if (isBlobConfigured()) {
    const { blobs } = await list();
    const dbBlob = blobs.find((b) => b.pathname === "db.json");
    if (dbBlob) {
      const response = await fetch(`${dbBlob.url}?t=${Date.now()}`, {
        cache: "no-store",
      });
      return await response.json();
    }
  } else if (fs.existsSync(LOCAL_DB_PATH)) {
    const fileContent = fs.readFileSync(LOCAL_DB_PATH, "utf-8");
    return JSON.parse(fileContent);
  }
  return { stores: [], storeData: {}, users: [], activityLogs: [] };
}

async function saveDb(data: any) {
  if (isBlobConfigured()) {
    await put("db.json", JSON.stringify(data), {
      access: "public",
      addRandomSuffix: false,
    });
  } else {
    fs.mkdirSync(path.dirname(LOCAL_DB_PATH), { recursive: true });
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(data, null, 2));
  }
}

export async function POST(request: Request) {
  try {
    const entry = await request.json();
    const db = await getDb();

    const logs = [entry, ...(db.activityLogs ?? [])].slice(0, 500);
    db.activityLogs = logs;

    await saveDb(db);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Log yazma hatası: " + error.message },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const db = await getDb();
    db.activityLogs = [];

    await saveDb(db);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Log silme hatası: " + error.message },
      { status: 500 }
    );
  }
}
