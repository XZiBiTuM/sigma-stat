import { NextRequest, NextResponse } from "next/server";
import { getPlayerProfile } from "@/lib/faceit";

const mmRanksMap = [
  "Unranked",
  "Silver I",
  "Silver II",
  "Silver III",
  "Silver IV",
  "Silver Elite",
  "Silver Elite Master",
  "Gold Nova I",
  "Gold Nova II",
  "Gold Nova III",
  "Gold Nova Master",
  "Master Guardian I",
  "Master Guardian II",
  "Master Guardian Elite",
  "Distinguished Master Guardian",
  "Legendary Eagle",
  "Legendary Eagle Master",
  "Supreme Master First Class",
  "Global Elite"
];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ playerId: string }> }
) {
  try {
    const { playerId } = await params;
    if (!playerId) {
      return NextResponse.json({ error: "Не указан ID игрока" }, { status: 400 });
    }

    // 1. Fetch FACEIT player profile to get steam ID
    let faceitProfile: any = null;
    try {
      faceitProfile = await getPlayerProfile(playerId);
    } catch (e) {
      return NextResponse.json({ error: "Профиль FACEIT не найден" }, { status: 404 });
    }

    const steamId = faceitProfile.steam_id_64 || faceitProfile.platforms?.steam;

    if (!steamId) {
      return NextResponse.json({ error: "Steam ID не привязан к профилю FACEIT" }, { status: 404 });
    }

    // 2. Fetch from Leetify V3 public API (does not return 403 Cloudflare block)
    const leetifyUrl = `https://api-public.cs-prod.leetify.com/v3/profile?steam64_id=${steamId}`;
    
    let premierRating: number | null = null;
    let mapRanks: any[] = [];
    let vacBanned = false;
    let gameBans = 0;
    let totalMatchesPlayed = 0;
    let kd = 1.0;
    let hs = 45;

    try {
      const res = await fetch(leetifyUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "application/json"
        }
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.ranks) {
          if (data.ranks.premier && data.ranks.premier > 0) {
            premierRating = data.ranks.premier;
          }

          if (Array.isArray(data.ranks.competitive)) {
            const activeCompetitiveMaps = ["de_dust2", "de_cache", "de_nuke", "de_mirage", "de_anubis", "de_ancient", "de_inferno"];
            mapRanks = activeCompetitiveMaps.map(mapName => {
              const match = data.ranks.competitive.find((r: any) => r.map_name === mapName || r.map_name === `de_${mapName}`);
              const rankVal = match ? (match.rank || 0) : 0;
              return {
                map: mapName,
                rank: mmRanksMap[rankVal] || "Unranked",
                value: rankVal
              };
            });
          }
        }

        if (data.bans) {
          vacBanned = data.bans.vac_banned || false;
          gameBans = data.bans.number_of_game_bans || 0;
        }

        if (data.stats) {
          kd = data.stats.kd !== undefined ? data.stats.kd : 1.0;
          hs = data.stats.hs_percentage !== undefined ? data.stats.hs_percentage : 45;
          totalMatchesPlayed = data.total_matches || 0;
        }
      }
    } catch (err: any) {
      console.warn("Leetify V3 fetch failed for Steam ID:", steamId, err.message);
    }

    return NextResponse.json({
      steamId,
      nickname: faceitProfile.nickname || "Player",
      avatarUrl: faceitProfile.avatar || "",
      premierRating,
      ranks: mapRanks,
      vacBanned,
      gameBans,
      level: 0,
      totalPlayHours: 0,
      steamMatches: totalMatchesPlayed,
      kd,
      hs,
      recentMatches: [],
      latestPremierSeason: 5
    });

  } catch (error: any) {
    console.error("Error in steam-stats route:", error.message);
    return NextResponse.json({ error: error.message || "Ошибка сервера" }, { status: 500 });
  }
}
