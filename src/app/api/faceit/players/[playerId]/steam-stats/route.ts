import { NextRequest, NextResponse } from "next/server";
import { faceitFetch, getPlayerProfile } from "@/lib/faceit";

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
    const faceitProfile = await getPlayerProfile(playerId);
    const steamId = faceitProfile.steam_id_64 || faceitProfile.platforms?.steam;

    if (!steamId) {
      return NextResponse.json({ error: "Steam ID не привязан к профилю FACEIT" }, { status: 404 });
    }

    // 2. Fetch from cs2tracker.gg API
    const trackerUrl = `https://cs2tracker.gg/api/player/${steamId}`;
    console.log(`Fetching official Valve stats from cs2tracker.gg for Steam ID: ${steamId}...`);
    
    const res = await fetch(trackerUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });

    if (!res.ok) {
      console.warn(`cs2tracker.gg returned status ${res.status} for Steam ID ${steamId}`);
      return NextResponse.json({ error: "Не удалось получить официальный Valve рейтинг" }, { status: res.status });
    }

    const data = await res.json();
    
    // 3. Extract Premier Rating
    const csstatsRanks = data.csstatsgg?.ranks || [];
    let premierRating = null;
    let maxPremierSeason = -1;

    // Find the latest premier season that has a rank
    for (const r of csstatsRanks) {
      if (r.mode?.type === "Premier" && r.rank > 0) {
        const season = r.mode.season || 0;
        if (season > maxPremierSeason) {
          maxPremierSeason = season;
          premierRating = r.rank;
        }
      }
    }

    // 4. Extract Competitive Map Ranks
    const activeCompetitiveMaps = ["de_dust2", "de_cache", "de_nuke", "de_mirage", "de_anubis", "de_ancient", "de_inferno"];
    const mapRanks = activeCompetitiveMaps.map(mapName => {
      // Find matching rank in csstatsgg
      const match = csstatsRanks.find((r: any) => r.mode?.type === "Matchmaking" && r.mode?.map === mapName);
      const rankVal = match ? (match.rank || 0) : 0;
      return {
        map: mapName,
        rank: mmRanksMap[rankVal] || "Unranked",
        value: rankVal
      };
    });

    // 5. Extract Ban Info
    const banInfo = data.ban_info || {};

    // 6. Extract CSStats Career stats & recent matches
    const csstatsStats = data.csstatsgg?.stats || {};
    const totalMatchesPlayed = data.stats?.playerstats?.all_stats?.total_matches_played || csstatsStats.matches || 0;

    // Find latest Premier season number
    let latestPremierSeason = 5;
    for (const r of csstatsRanks) {
      if (r.mode?.type === "Premier" && r.mode?.season) {
        latestPremierSeason = Math.max(latestPremierSeason, r.mode.season);
      }
    }

    const recentMatches = (data.csstatsgg?.recent_matches || []).slice(0, 10).map((m: any) => {
      let result = "L";
      if (m.score_for > m.score_against) result = "W";
      else if (m.score_for === m.score_against) result = "T";
      return {
        result,
        score: `${m.score_for}:${m.score_against}`
      };
    });

    return NextResponse.json({
      steamId,
      nickname: data.nickname || faceitProfile.nickname || "major winner",
      avatarUrl: data.avatar_url || "",
      premierRating,
      ranks: mapRanks,
      vacBanned: banInfo.vac_banned || false,
      gameBans: banInfo.number_of_game_bans || 0,
      level: data.level || 0,
      totalPlayHours: Math.round(data.total_time_played_hours || 0),
      steamMatches: totalMatchesPlayed,
      kd: csstatsStats.kd !== undefined ? csstatsStats.kd : 1.00,
      hs: csstatsStats.hs !== undefined ? csstatsStats.hs : 45,
      recentMatches,
      latestPremierSeason
    });

  } catch (error: any) {
    console.error("Error fetching Valve stats:", error.message);
    return NextResponse.json({ error: error.message || "Ошибка сервера" }, { status: 500 });
  }
}
