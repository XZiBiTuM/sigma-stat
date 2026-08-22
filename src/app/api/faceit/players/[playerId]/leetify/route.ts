export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { getPlayerProfile } from "@/lib/faceit";

const cache: Record<string, { data: any; ts: number }> = {};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ playerId: string }> }
) {
  try {
    const { playerId } = await params;
    if (!playerId) {
      return NextResponse.json({ error: "Missing playerId" }, { status: 400 });
    }

    const now = Date.now();
    if (cache[playerId] && now - cache[playerId].ts < 60000) {
      return NextResponse.json(cache[playerId].data);
    }

    // Resolve Faceit player to get Steam64 ID
    const profile = await getPlayerProfile(playerId);
    const steam64Id = profile?.steam_id_64 || profile?.games?.cs2?.game_player_id || profile?.games?.csgo?.game_player_id;

    if (!steam64Id) {
      return NextResponse.json({ error: "Steam ID not found" }, { status: 404 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1200);

    try {
      const leetifyRes = await fetch(`https://api.leetify.com/api/profile/id/${steam64Id}`, {
        signal: controller.signal,
        headers: { "User-Agent": "Mozilla/5.0" }
      });
      clearTimeout(timeout);

      if (!leetifyRes.ok) {
        return NextResponse.json({ error: "Leetify profile not found" }, { status: 404 });
      }

      const leetifyData = await leetifyRes.json();
      cache[playerId] = { data: leetifyData, ts: Date.now() };
      return NextResponse.json(leetifyData);
    } catch (fetchErr) {
      clearTimeout(timeout);
      return NextResponse.json({ error: "Leetify timeout" }, { status: 504 });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
