import { NextRequest, NextResponse } from "next/server";
import { faceitFetch } from "@/lib/faceit";
import { getStoragePath } from "@/lib/storage";
import { promises as fs } from "fs";
import path from "path";

const cacheFilePath = getStoragePath("match_stats_cache.json");
const customMatchesFilePath = getStoragePath("custom_matches.json");

async function readStatsCache(): Promise<Record<string, any>> {
  try {
    const data = await fs.readFile(cacheFilePath, "utf8");
    return JSON.parse(data);
  } catch (error) {
    return {};
  }
}

async function readCustomMatches(): Promise<any[]> {
  try {
    const data = await fs.readFile(customMatchesFilePath, "utf8");
    return JSON.parse(data || "[]");
  } catch (error) {
    return [];
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
    const type = searchParams.get("type") || "all";

    const data = await faceitFetch(`/hubs/${hubId}/matches`, {
      limit,
      offset,
      type,
    });

    if (!data.items) {
      data.items = [];
    }

    // Enrich FACEIT matches with maps from cache if available
    const statsCache = await readStatsCache();
    for (const match of data.items) {
      const stats = statsCache[match.match_id];
      if (stats && stats.rounds) {
        match.maps = stats.rounds.map((r: any) => r.round_stats?.Map || "Неизвестно");
      } else {
        match.maps = match.voting?.map?.entities?.slice(0, 1).map((e: any) => e.name) || ["Голосование..."];
      }
    }

    // Prepend Custom Cybershoke matches to the items list
    const customMatches = await readCustomMatches();
    if (customMatches.length > 0) {
      data.items = [...customMatches, ...data.items];
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
