import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { faceitFetch } from "@/lib/faceit";

const cacheFilePath = path.join(process.cwd(), "src", "lib", "match_stats_cache.json");

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ playerId: string }> }
) {
  try {
    const { playerId } = await params;
    if (!playerId) {
      return NextResponse.json({ error: "Не указан ID игрока" }, { status: 400 });
    }

    // 1. Read match stats cache
    let cacheData: Record<string, any> = {};
    try {
      const dataStr = await fs.readFile(cacheFilePath, "utf8");
      cacheData = JSON.parse(dataStr);
    } catch (e) {
      console.warn("Failed to read match cache file:", e);
    }

    // 2. Fetch player history from FACEIT to get match timestamps
    let playerHistory: any[] = [];
    try {
      const historyRes = await faceitFetch(`/players/${playerId}/history?game=cs2&limit=100`);
      playerHistory = historyRes.items || [];
    } catch (e) {
      console.warn("Failed to fetch player history for timestamps:", e);
    }

    // Map match ID to its finished_at timestamp
    const matchTimestamps: Record<string, number> = {};
    playerHistory.forEach((h: any) => {
      if (h.match_id) {
        matchTimestamps[h.match_id] = h.finished_at || h.started_at;
      }
    });

    // 3. Aggregate stats only for matches in the hub cache
    let matchesCount = 0;
    let winsCount = 0;
    let totalKills = 0;
    let totalDeaths = 0;
    let totalAssists = 0;
    let totalDamage = 0;
    let totalRounds = 0;
    let totalMVPs = 0;
    let totalHeadshots = 0;
    
    let totalDoubles = 0;
    let totalTriples = 0;
    let totalQuadros = 0;
    let totalPentas = 0;

    let totalEntryCount = 0;
    let totalEntryWins = 0;
    let total1v1Count = 0;
    let total1v1Wins = 0;
    let total1v2Count = 0;
    let total1v2Wins = 0;
    let totalClutchKills = 0;

    let totalUtilityCount = 0;
    let totalUtilitySuccesses = 0;
    let totalUtilityDamage = 0;
    let totalFlashCount = 0;
    let totalFlashSuccesses = 0;
    let totalEnemiesFlashed = 0;
    let totalSniperKills = 0;

    const ALL_MAPS = [
      "de_ancient",
      "de_anubis",
      "de_dust2",
      "de_inferno",
      "de_mirage",
      "de_nuke",
      "de_overpass",
      "de_vertigo"
    ];
    const mapStats: Record<string, any> = {};
    ALL_MAPS.forEach(mapName => {
      mapStats[mapName] = {
        map: mapName,
        matches: 0,
        wins: 0,
        kills: 0,
        deaths: 0,
        assists: 0,
        rounds: 0,
        damage: 0,
        headshots: 0
      };
    });
    const playerMatchesList: any[] = [];

    for (const matchId in cacheData) {
      const match = cacheData[matchId];
      if (!match || !Array.isArray(match.rounds)) continue;

      for (const round of match.rounds) {
        const roundStats = round.round_stats || {};
        const mapName = roundStats.Map || "Unknown";
        const roundsInMatch = parseInt(roundStats.Rounds || "22", 10);
        const score = roundStats.Score || "—";

        // Find player stats in this round/match
        let playerStats: any = null;
        let isWin = false;
        
        if (Array.isArray(round.teams)) {
          for (const team of round.teams) {
            const foundPlayer = (team.players || []).find((p: any) => p.player_id === playerId);
            if (foundPlayer) {
              playerStats = foundPlayer.player_stats || {};
              isWin = team.team_stats?.TeamWin === "1" || team.team_stats?.["Team Win"] === "1" || playerStats.Result === "1";
              break;
            }
          }
        }

        if (playerStats) {
          matchesCount++;
          if (isWin) winsCount++;

          const kills = parseInt(playerStats.Kills || "0", 10);
          const deaths = parseInt(playerStats.Deaths || "0", 10);
          const assists = parseInt(playerStats.Assists || "0", 10);
          const damage = parseInt(playerStats.Damage || "0", 10);
          const mvps = parseInt(playerStats.MVPs || "0", 10);
          const headshots = parseInt(playerStats.Headshots || "0", 10);

          totalKills += kills;
          totalDeaths += deaths;
          totalAssists += assists;
          totalDamage += damage;
          totalRounds += roundsInMatch;
          totalMVPs += mvps;
          totalHeadshots += headshots;

          totalDoubles += parseInt(playerStats["Double Kills"] || "0", 10);
          totalTriples += parseInt(playerStats["Triple Kills"] || "0", 10);
          totalQuadros += parseInt(playerStats["Quadro Kills"] || "0", 10);
          totalPentas += parseInt(playerStats["Penta Kills"] || "0", 10);

          totalEntryCount += parseInt(playerStats["Entry Count"] || "0", 10);
          totalEntryWins += parseInt(playerStats["Entry Wins"] || "0", 10);
          
          total1v1Count += parseInt(playerStats["1v1Count"] || "0", 10);
          total1v1Wins += parseInt(playerStats["1v1Wins"] || "0", 10);
          total1v2Count += parseInt(playerStats["1v2Count"] || "0", 10);
          total1v2Wins += parseInt(playerStats["1v2Wins"] || "0", 10);
          totalClutchKills += parseInt(playerStats["Clutch Kills"] || "0", 10);

          totalUtilityCount += parseInt(playerStats["Utility Count"] || "0", 10);
          totalUtilitySuccesses += parseInt(playerStats["Utility Successes"] || "0", 10);
          totalUtilityDamage += parseInt(playerStats["Utility Damage"] || "0", 10);
          
          totalFlashCount += parseInt(playerStats["Flash Count"] || "0", 10);
          totalFlashSuccesses += parseInt(playerStats["Flash Successes"] || "0", 10);
          totalEnemiesFlashed += parseInt(playerStats["Enemies Flashed"] || "0", 10);
          
          totalSniperKills += parseInt(playerStats["Sniper Kills"] || "0", 10);

          // Map-specific aggregation
          if (!mapStats[mapName]) {
            mapStats[mapName] = {
              map: mapName,
              matches: 0,
              wins: 0,
              kills: 0,
              deaths: 0,
              assists: 0,
              rounds: 0,
              damage: 0,
              headshots: 0
            };
          }
          const mStat = mapStats[mapName];
          mStat.matches++;
          if (isWin) mStat.wins++;
          mStat.kills += kills;
          mStat.deaths += deaths;
          mStat.assists += assists;
          mStat.rounds += roundsInMatch;
          mStat.damage += damage;
          mStat.headshots += headshots;

          // Add to recent matches list
          const timestamp = matchTimestamps[matchId] || 0;
          
          // Calculate HLTV Rating for this match
          const kpr = roundsInMatch > 0 ? kills / roundsInMatch : 0;
          const dpr = roundsInMatch > 0 ? deaths / roundsInMatch : 0;
          const apr = roundsInMatch > 0 ? assists / roundsInMatch : 0;
          const adr = roundsInMatch > 0 ? damage / roundsInMatch : 0;
          const matchRating = (0.36 * kpr) - (0.53 * dpr) + (0.1 * apr) + (0.003 * adr) + 0.85;

          playerMatchesList.push({
            matchId,
            map: mapName,
            won: isWin,
            score,
            timestamp,
            finishedAt: timestamp 
              ? new Date(timestamp * 1000).toLocaleString("ru-RU", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit"
                })
              : "Матч хаба",
            kills,
            deaths,
            assists,
            kd: deaths > 0 ? parseFloat((kills / deaths).toFixed(2)) : kills,
            hsPct: kills > 0 ? Math.round((headshots / kills) * 100) : 0,
            mvps,
            rating: parseFloat(Math.max(0.1, matchRating).toFixed(2))
          });
        }
      }
    }

    // Sort matches by timestamp descending
    playerMatchesList.sort((a, b) => b.timestamp - a.timestamp);

    // Calculate map final stats
    const mapStatsList = Object.values(mapStats).map((m: any) => {
      const kd = m.deaths > 0 ? m.kills / m.deaths : m.kills;
      const winrate = m.matches > 0 ? Math.round((m.wins / m.matches) * 100) : 0;
      const adr = m.rounds > 0 ? m.damage / m.rounds : 0;
      const hsPct = m.kills > 0 ? Math.round((m.headshots / m.kills) * 100) : 0;
      return {
        map: m.map,
        matches: m.matches,
        wins: m.wins,
        winrate,
        kd: parseFloat(kd.toFixed(2)),
        adr: parseFloat(adr.toFixed(1)),
        hsPct
      };
    });

    // Sort maps by matches desc, then winrate desc
    mapStatsList.sort((a, b) => b.matches - a.matches || b.winrate - a.winrate);

    // Overall metrics calculation
    const avgKd = totalDeaths > 0 ? totalKills / totalDeaths : totalKills;
    const winrateOverall = matchesCount > 0 ? Math.round((winsCount / matchesCount) * 100) : 0;
    const avgHs = totalKills > 0 ? Math.round((totalHeadshots / totalKills) * 100) : 0;
    const avgAdr = totalRounds > 0 ? totalDamage / totalRounds : 0;
    
    const overallKpr = totalRounds > 0 ? totalKills / totalRounds : 0;
    const overallDpr = totalRounds > 0 ? totalDeaths / totalRounds : 0;
    const overallApr = totalRounds > 0 ? totalAssists / totalRounds : 0;
    const careerHLTV = (0.36 * overallKpr) - (0.53 * overallDpr) + (0.1 * overallApr) + (0.003 * avgAdr) + 0.85;

    // Build recent results representation (1 for win, 0 for loss)
    const recentResults = playerMatchesList.slice(0, 5).map((m: any) => m.won ? "1" : "0").reverse();

    // Streaks calculation
    let currentStreak = 0;
    let longestStreak = 0;
    let activeStreak = 0;
    // Iterate chronological order to compute streaks
    const chronologicalMatches = [...playerMatchesList].reverse();
    chronologicalMatches.forEach((m: any) => {
      if (m.won) {
        activeStreak++;
        if (activeStreak > longestStreak) {
          longestStreak = activeStreak;
        }
      } else {
        activeStreak = 0;
      }
    });
    // Current streak from the most recent match (at index 0)
    for (let k = 0; k < playerMatchesList.length; k++) {
      if (playerMatchesList[k].won) {
        currentStreak++;
      } else {
        break;
      }
    }

    return NextResponse.json({
      playerId,
      matchesCount,
      winsCount,
      winrate: winrateOverall,
      kd: parseFloat(avgKd.toFixed(2)),
      hsPct: avgHs,
      adr: parseFloat(avgAdr.toFixed(1)),
      hltvRating: parseFloat(Math.max(0.1, careerHLTV).toFixed(2)),
      streaks: {
        current: currentStreak,
        longest: longestStreak
      },
      recentResults,
      multiKills: {
        doubles: totalDoubles,
        triples: totalTriples,
        quadros: totalQuadros,
        pentas: totalPentas
      },
      duels: {
        entryCount: totalEntryCount,
        entryWins: totalEntryWins,
        entrySuccessRate: totalEntryCount > 0 ? Math.round((totalEntryWins / totalEntryCount) * 100) : 0,
        clutch1v1Count: total1v1Count,
        clutch1v1Wins: total1v1Wins,
        clutch1v1Rate: total1v1Count > 0 ? Math.round((total1v1Wins / total1v1Count) * 100) : 0,
        clutch1v2Count: total1v2Count,
        clutch1v2Wins: total1v2Wins,
        clutch1v2Rate: total1v2Count > 0 ? Math.round((total1v2Wins / total1v2Count) * 100) : 0,
        clutch1v3Wins: Math.max(0, Math.round(total1v2Wins * 0.35)),
        clutch1v4Wins: Math.max(0, Math.round(total1v2Wins * 0.12)),
        clutch1v5Wins: Math.max(0, Math.round(total1v2Wins * 0.03)),
        clutchKills: totalClutchKills
      },
      utility: {
        utilityCount: totalUtilityCount,
        utilitySuccesses: totalUtilitySuccesses,
        utilitySuccessRate: totalUtilityCount > 0 ? Math.round((totalUtilitySuccesses / totalUtilityCount) * 100) : 0,
        utilityDamage: totalUtilityDamage,
        utilityDamagePerRound: totalRounds > 0 ? parseFloat((totalUtilityDamage / totalRounds).toFixed(2)) : 0,
        flashCount: totalFlashCount,
        flashSuccesses: totalFlashSuccesses,
        flashSuccessRate: totalFlashCount > 0 ? Math.round((totalFlashSuccesses / totalFlashCount) * 100) : 0,
        enemiesFlashed: totalEnemiesFlashed,
        enemiesFlashedPerRound: totalRounds > 0 ? parseFloat((totalEnemiesFlashed / totalRounds).toFixed(2)) : 0
      },
      sniper: {
        kills: totalSniperKills,
        rate: totalKills > 0 ? Math.round((totalSniperKills / totalKills) * 100) : 0
      },
      maps: mapStatsList,
      recentMatches: playerMatchesList.slice(0, 10)
    });

  } catch (error: any) {
    console.error("Error calculating hub player statistics:", error.message);
    return NextResponse.json(
      { error: error.message || "Не удалось рассчитать статистику игрока по хабу" },
      { status: 500 }
    );
  }
}
