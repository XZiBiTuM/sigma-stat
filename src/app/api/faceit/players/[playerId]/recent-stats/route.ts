import { NextRequest, NextResponse } from "next/server";
import { faceitFetch, getPlayerProfile } from "@/lib/faceit";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ playerId: string }> }
) {
  try {
    const { playerId } = await params;
    if (!playerId) {
      return NextResponse.json({ error: "Не указан ID игрока" }, { status: 400 });
    }

    // Resolve player profile to get actual UUID
    const playerProfile = await getPlayerProfile(playerId);
    const uuid = playerProfile.player_id;

    // 1. Fetch match history (last 5 matches)
    const historyData = await faceitFetch(`/players/${uuid}/history?game=cs2&limit=5`);
    const matches = historyData.items || [];

    // 2. Fetch statistics for each match in parallel
    const recentMatchesStats = await Promise.all(
      matches.map(async (match: any) => {
        const matchId = match.match_id;
        const finishedAt = match.finished_at || match.started_at;
        
        try {
          const statsRes = await faceitFetch(`/matches/${matchId}/stats`);
          
          // Find player stats and match outcome
          let playerStats: any = null;
          let isWin = false;
          let mapName = "Unknown";
          let score = "—";

          if (Array.isArray(statsRes) && statsRes.length > 0) {
            // FACEIT stats returns an array representing map segments (usually 1 segment for 5v5 CS2)
            const mapSegment = statsRes[0];
            mapName = mapSegment.stats?.Map || "Unknown";
            
            // Score formatting e.g. "13 - 7"
            score = mapSegment.stats?.Score || "—";

            // Find player in teams
            const teamsList = mapSegment.teams || [];
            for (const team of teamsList) {
              const playersList = team.players || [];
              const foundPlayer = playersList.find((p: any) => p.player_id === playerId);
              
              if (foundPlayer) {
                playerStats = foundPlayer.player_stats || {};
                isWin = team.stats?.Winner === "1";
                break;
              }
            }
          }

          const kills = playerStats ? parseInt(playerStats.Kills || "0") : 0;
          const deaths = playerStats ? parseInt(playerStats.Deaths || "0") : 0;
          const assists = playerStats ? parseInt(playerStats.Assists || "0") : 0;
          const adr = playerStats ? parseFloat(playerStats.ADR || "75") : 75;
          const rounds = (Array.isArray(statsRes) && statsRes.length > 0) ? parseInt(statsRes[0].stats?.Rounds || "24", 10) : 24;

          const kpr = rounds > 0 ? kills / rounds : 0;
          const dpr = rounds > 0 ? deaths / rounds : 0;
          const apr = rounds > 0 ? assists / rounds : 0;
          const hltvRating = (0.36 * kpr) - (0.53 * dpr) + (0.1 * apr) + (0.003 * adr) + 0.85;
          const rating = Math.max(0.1, hltvRating);

          return {
            matchId,
            map: mapName,
            won: isWin,
            score,
            finishedAt: new Date(finishedAt * 1000).toLocaleString("ru-RU", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit"
            }),
            kills,
            deaths,
            assists,
            kd: playerStats ? parseFloat(playerStats["K/D Ratio"] || "0") : 0,
            hsPct: playerStats ? parseInt(playerStats["Headshots %"] || "0") : 0,
            mvps: playerStats ? parseInt(playerStats.MVPs || "0") : 0,
            rating: parseFloat(rating.toFixed(2))
          };

        } catch (e: any) {
          console.warn(`Failed to fetch stats for match ${matchId}:`, e.message);
          return {
            matchId,
            map: match.voting?.map?.entities?.[0]?.name || "Unknown",
            won: false,
            score: "—",
            finishedAt: new Date(finishedAt * 1000).toLocaleString("ru-RU", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit"
            }),
            kills: 0,
            deaths: 0,
            assists: 0,
            kd: 0,
            hsPct: 0,
            mvps: 0,
            error: true
          };
        }
      })
    );

    return NextResponse.json({
      playerId,
      matches: recentMatchesStats
    });

  } catch (error: any) {
    console.error("Error fetching player recent stats:", error.message);
    return NextResponse.json(
      { error: error.message || "Не удалось загрузить историю матчей игрока" },
      { status: 500 }
    );
  }
}
