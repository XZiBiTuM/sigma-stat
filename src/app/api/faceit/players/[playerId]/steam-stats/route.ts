export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { getPlayerProfile } from "@/lib/faceit";

const STEAM_API_KEY = process.env.STEAM_API_KEY || "15536CB4CFFE33DA56F57B1F3CF07CCF";
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

    const profile = await getPlayerProfile(playerId);
    const steam64Id = profile?.steam_id_64 || profile?.games?.cs2?.game_player_id || profile?.games?.csgo?.game_player_id;

    if (!steam64Id) {
      return NextResponse.json({ error: "Steam ID not found" }, { status: 404 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1200);

    try {
      const steamRes = await fetch(
        `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${STEAM_API_KEY}&steamids=${steam64Id}`,
        { signal: controller.signal }
      );
      clearTimeout(timeout);

      if (!steamRes.ok) {
        return NextResponse.json({ error: "Steam profile not found" }, { status: 404 });
      }

      const steamData = await steamRes.json();
      const playerSummary = steamData?.response?.players?.[0] || null;
      const result = { steamProfile: playerSummary };
      cache[playerId] = { data: result, ts: Date.now() };
      return NextResponse.json(result);
    } catch (fetchErr) {
      clearTimeout(timeout);
      return NextResponse.json({ error: "Steam timeout" }, { status: 504 });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
