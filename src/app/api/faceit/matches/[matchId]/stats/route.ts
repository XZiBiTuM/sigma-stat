import { NextRequest, NextResponse } from "next/server";
import { faceitFetch } from "@/lib/faceit";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  try {
    const { matchId } = await params;
    if (!matchId) {
      return NextResponse.json({ error: "Не указан ID матча" }, { status: 400 });
    }

    const data = await faceitFetch(`/matches/${matchId}/stats`);
    return NextResponse.json(data);
  } catch (error: any) {
    if (error.message === "API_KEY_MISSING") {
      return NextResponse.json({ error: "API_KEY_MISSING" }, { status: 401 });
    }
    return NextResponse.json(
      { error: error.message || "Не удалось загрузить статистику матча" },
      { status: error.status || 500 }
    );
  }
}
