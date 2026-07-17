import { NextRequest, NextResponse } from "next/server";
import { faceitFetch } from "@/lib/faceit";
import { promises as fs } from "fs";
import path from "path";

const cacheFilePath = path.join(process.cwd(), "src", "lib", "match_stats_cache.json");

async function readStatsCache(): Promise<Record<string, any>> {
  try {
    const data = await fs.readFile(cacheFilePath, "utf8");
    return JSON.parse(data);
  } catch (error) {
    return {};
  }
}

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
    const limit = searchParams.get("limit") || "20";
    const offset = searchParams.get("offset") || "0";
    // FACEIT API matches endpoint supports type: 'all', 'upcoming', 'ongoing', 'past'
    const type = searchParams.get("type") || "all";

    const data = await faceitFetch(`/hubs/${hubId}/matches`, {
      limit,
      offset,
      type,
    });

    // Enrich with maps from cache if available
    const statsCache = await readStatsCache();
    if (data && data.items) {
      for (const match of data.items) {
        const stats = statsCache[match.match_id];
        if (stats && stats.rounds) {
          match.maps = stats.rounds.map((r: any) => r.round_stats?.Map || "Неизвестно");
        } else {
          // Fallback to voting maps
          match.maps = match.voting?.map?.entities?.slice(0, 1).map((e: any) => e.name) || ["Голосование..."];
        }
      }
    }

    return NextResponse.json(data);
  } catch (error: any) {
    if (error.message === "API_KEY_MISSING") {
      return NextResponse.json({ error: "API_KEY_MISSING" }, { status: 401 });
    }
    return NextResponse.json(
      { error: error.message || "Не удалось загрузить матчи хаба" },
      { status: error.status || 500 }
    );
  }
}
