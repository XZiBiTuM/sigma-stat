import { NextRequest, NextResponse } from "next/server";
import { faceitFetch } from "@/lib/faceit";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ hubId: string }> }
) {
  try {
    let { hubId } = await params;
    if (hubId === "0dd077bc-b401-4f5c-8a40-47578601ccb7") {
      hubId = "d0701937-8eba-4df9-8830-22137001c0bd";
    }

    const { searchParams } = request.nextUrl;
    const limit = searchParams.get("limit") || "50";
    const offset = searchParams.get("offset") || "0";

    const data = await faceitFetch(`/leaderboards/hubs/${hubId}/general`, {
      limit,
      offset,
    });
    return NextResponse.json(data);
  } catch (error: any) {
    if (error.message === "API_KEY_MISSING") {
      return NextResponse.json({ error: "API_KEY_MISSING" }, { status: 401 });
    }
    return NextResponse.json(
      { error: error.message || "Не удалось загрузить общий рейтинг хаба" },
      { status: error.status || 500 }
    );
  }
}
