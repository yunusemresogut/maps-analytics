import { NextResponse } from "next/server";
import { addActivityLog, clearActivityLogs } from "@/lib/db-server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const entry = await request.json();
    await addActivityLog(entry);
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
    await clearActivityLogs();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Log silme hatası: " + error.message },
      { status: 500 }
    );
  }
}
