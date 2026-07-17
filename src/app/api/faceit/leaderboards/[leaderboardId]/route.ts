import { NextRequest, NextResponse } from "next/server";
import { faceitFetch } from "@/lib/faceit";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ leaderboardId: string }> }
) {
  try {
    const { leaderboardId } = await params;
    if (!leaderboardId) {
      return NextResponse.json({ error: "Не указан ID таблицы лидеров" }, { status: 400 });
    }

    const { searchParams } = request.nextUrl;
    const limit = searchParams.get("limit") || "50";
    const offset = searchParams.get("offset") || "0";

    const data = await faceitFetch(`/leaderboards/${leaderboardId}`, {
      limit,
      offset,
    });
    return NextResponse.json(data);
  } catch (error: any) {
    if (error.message === "API_KEY_MISSING") {
      return NextResponse.json({ error: "API_KEY_MISSING" }, { status: 401 });
    }
    return NextResponse.json(
      { error: error.message || "Не удалось загрузить данные таблицы лидеров" },
      { status: error.status || 500 }
    );
  }
}
