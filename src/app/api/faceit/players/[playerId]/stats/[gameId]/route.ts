import { NextRequest, NextResponse } from "next/server";
import { faceitFetch } from "@/lib/faceit";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ playerId: string; gameId: string }> }
) {
  try {
    const { playerId, gameId } = await params;
    if (!playerId || !gameId) {
      return NextResponse.json({ error: "Не указан ID игрока или ID игры" }, { status: 400 });
    }

    const data = await faceitFetch(`/players/${playerId}/stats/${gameId}`);
    return NextResponse.json(data);
  } catch (error: any) {
    if (error.message === "API_KEY_MISSING") {
      return NextResponse.json({ error: "API_KEY_MISSING" }, { status: 401 });
    }
    return NextResponse.json(
      { error: error.message || "Не удалось загрузить статистику игрока по игре" },
      { status: error.status || 500 }
    );
  }
}
