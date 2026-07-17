import { NextRequest, NextResponse } from "next/server";
import { faceitFetch } from "@/lib/faceit";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ playerId: string }> }
) {
  try {
    const { playerId } = await params;
    if (!playerId) {
      return NextResponse.json({ error: "Не указан ID игрока" }, { status: 400 });
    }

    // Fetch the last 10 matches of the player on CS2
    const data = await faceitFetch(`/players/${playerId}/history?game=cs2&limit=10`);
    return NextResponse.json(data);
  } catch (error: any) {
    if (error.message === "API_KEY_MISSING") {
      return NextResponse.json({ error: "API_KEY_MISSING" }, { status: 401 });
    }
    return NextResponse.json(
      { error: error.message || "Не удалось загрузить историю матчей игрока" },
      { status: error.status || 500 }
    );
  }
}
