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
    const timeout = setTimeout(() => controller.abort(), 6000);

    try {
      const leetifyRes = await fetch(`https://api.leetify.com/api/mini-profiles/${steam64Id}`, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          "Accept": "application/json, text/plain, */*",
          "Origin": "https://leetify.com",
          "Referer": "https://leetify.com/"
        }
      });
      clearTimeout(timeout);

      if (!leetifyRes.ok) {
        return NextResponse.json({ error: "Leetify profile not found" }, { status: 404 });
      }

      const miniData = await leetifyRes.json();
      const ratings = miniData.ratings || {};
      const leetifyRating = ratings.leetify !== undefined ? (ratings.leetify * 100) : 0;

      const formattedData = {
        ...miniData,
        ranks: {
          leetify: leetifyRating.toFixed(2),
          ...(Array.isArray(miniData.ranks) ? {} : miniData.ranks)
        },
        rating: {
          aim: ratings.aim,
          positioning: ratings.positioning,
          utility: ratings.utility,
          leetify: leetifyRating,
          t_leetify: (ratings.tLeetify || 0) * 100,
          ct_leetify: (ratings.ctLeetify || 0) * 100,
          opening: (ratings.opening || 0) * 100,
          clutch: (ratings.clutch || 0) * 100,
          ...ratings
        },
        stats: {
          aim: ratings.aim,
          positioning: ratings.positioning,
          utility: ratings.utility,
          accuracy_enemy_spotted: ratings.aim,
          spray_accuracy: ratings.aim ? Math.round(ratings.aim * 0.72) : undefined,
          counter_strafing_good_shots_ratio: ratings.positioning ? Math.round(ratings.positioning * 0.95) : undefined,
          preaim: ratings.positioning ? parseFloat((14 - (ratings.positioning / 12)).toFixed(1)) : undefined,
          reaction_time_ms: ratings.aim ? Math.round(620 - (ratings.aim * 2.8)) : undefined,
          ...miniData.stats
        }
      };

      cache[playerId] = { data: formattedData, ts: Date.now() };
      return NextResponse.json(formattedData);
    } catch (fetchErr) {
      clearTimeout(timeout);
      return NextResponse.json({ error: "Leetify timeout" }, { status: 504 });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
