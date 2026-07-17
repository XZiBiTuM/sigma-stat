import { NextRequest, NextResponse } from "next/server";
import { faceitFetch } from "@/lib/faceit";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ hubId: string }> }
) {
  try {
    const { hubId } = await params;
    if (!hubId) {
      return NextResponse.json({ error: "Не указан ID хаба" }, { status: 400 });
    }

    const data = await faceitFetch(`/hubs/${hubId}`);
    return NextResponse.json(data);
  } catch (error: any) {
    if (error.message === "API_KEY_MISSING") {
      return NextResponse.json({ error: "API_KEY_MISSING" }, { status: 401 });
    }
    return NextResponse.json(
      { error: error.message || "Не удалось загрузить данные хаба" },
      { status: error.status || 500 }
    );
  }
}
