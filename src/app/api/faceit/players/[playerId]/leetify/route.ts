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

    // 1. Get player profile from FACEIT to get their Steam ID 64
    const playerProfile = await faceitFetch(`/players/${playerId}`);
    const steamId = playerProfile.steam_id_64 || playerProfile.platforms?.steam;

    if (!steamId) {
      return NextResponse.json({ error: "Steam ID не найден для этого профиля FACEIT" }, { status: 404 });
    }

    // 2. Fetch from Leetify public API
    const leetifyUrl = `https://api-public.cs-prod.leetify.com/v3/profile?steam64_id=${steamId}`;
    const leetifyKey = process.env.LEETIFY_API_KEY;

    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    if (leetifyKey) {
      headers["Authorization"] = `Bearer ${leetifyKey}`;
    }

    console.log(`Fetching Leetify statistics for SteamID ${steamId}...`);
    const leetifyRes = await fetch(leetifyUrl, { headers });

    if (!leetifyRes.ok) {
      console.warn(`Leetify returned status ${leetifyRes.status} for SteamID ${steamId}`);
      return NextResponse.json({ 
        error: `Leetify API вернул статус ${leetifyRes.status}`,
        status: leetifyRes.status 
      }, { status: leetifyRes.status });
    }

    const leetifyData = await leetifyRes.json();
    return NextResponse.json(leetifyData);

  } catch (error: any) {
    console.error("Error fetching Leetify profile:", error.message);
    return NextResponse.json(
      { error: error.message || "Не удалось загрузить Leetify профиль" },
      { status: 500 }
    );
  }
}
