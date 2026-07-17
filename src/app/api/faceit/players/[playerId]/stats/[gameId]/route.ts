import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const cacheFilePath = path.join(process.cwd(), "src", "lib", "match_stats_cache.json");

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ playerId: string; gameId: string }> }
) {
  try {
    const { playerId, gameId } = await params;
    if (!playerId || !gameId) {
      return NextResponse.json({ error: "Не указан ID игрока или ID игры" }, { status: 400 });
    }

    // 1. Read match stats cache
    let cacheData: Record<string, any> = {};
    try {
      const dataStr = await fs.readFile(cacheFilePath, "utf8");
      cacheData = JSON.parse(dataStr);
    } catch (e) {
      console.warn("Failed to read match cache file:", e);
    }

    // 2. Aggregate stats only for matches in the hub cache where player participated
    let matchesCount = 0;
    let winsCount = 0;
    let totalKills = 0;
    let totalDeaths = 0;
    let totalAssists = 0;
    let totalDamage = 0;
    let totalRounds = 0;
    let totalMVPs = 0;
    let totalHeadshots = 0;
    
    let totalEntryCount = 0;
    let totalEntryWins = 0;
    let total1v1Count = 0;
    let total1v1Wins = 0;
    let total1v2Count = 0;
    let total1v2Wins = 0;

    let totalUtilityDamage = 0;
    let totalFlashCount = 0;
    let totalFlashSuccesses = 0;
    let totalSniperKills = 0;

    const mapStats: Record<string, any> = {};
    const playerRoundsList: { won: boolean }[] = [];

    for (const matchId in cacheData) {
      const match = cacheData[matchId];
      if (!match || !Array.isArray(match.rounds)) continue;

      for (const round of match.rounds) {
        const roundStats = round.round_stats || {};
        const mapName = roundStats.Map || "Unknown";
        const roundsInMatch = parseInt(roundStats.Rounds || "22", 10);

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

          totalEntryCount += parseInt(playerStats["Entry Count"] || "0", 10);
          totalEntryWins += parseInt(playerStats["Entry Wins"] || "0", 10);
          
          total1v1Count += parseInt(playerStats["1v1Count"] || "0", 10);
          total1v1Wins += parseInt(playerStats["1v1Wins"] || "0", 10);
          total1v2Count += parseInt(playerStats["1v2Count"] || "0", 10);
          total1v2Wins += parseInt(playerStats["1v2Wins"] || "0", 10);

          totalUtilityDamage += parseInt(playerStats["Utility Damage"] || "0", 10);
          
          totalFlashCount += parseInt(playerStats["Flash Count"] || "0", 10);
          totalFlashSuccesses += parseInt(playerStats["Flash Successes"] || "0", 10);
          totalSniperKills += parseInt(playerStats["Sniper Kills"] || "0", 10);

          playerRoundsList.push({ won: isWin });

          // Map stats
          if (!mapStats[mapName]) {
            mapStats[mapName] = {
              map: mapName,
              matches: 0,
              wins: 0,
              kills: 0,
              deaths: 0,
              rounds: 0,
              damage: 0,
              headshots: 0
            };
          }
          const m = mapStats[mapName];
          m.matches++;
          if (isWin) m.wins++;
          m.kills += kills;
          m.deaths += deaths;
          m.rounds += roundsInMatch;
          m.damage += damage;
          m.headshots += headshots;
        }
      }
    }

    const winrateOverall = matchesCount > 0 ? Math.round((winsCount / matchesCount) * 100) : 0;
    const avgKd = totalDeaths > 0 ? totalKills / totalDeaths : totalKills;
    const avgHs = totalKills > 0 ? Math.round((totalHeadshots / totalKills) * 100) : 0;
    const avgAdr = totalRounds > 0 ? totalDamage / totalRounds : 75;

    // Streaks calculation from playerRoundsList
    let currentStreak = 0;
    let longestStreak = 0;
    let activeStreak = 0;
    playerRoundsList.forEach((r: any) => {
      if (r.won) {
        activeStreak++;
        if (activeStreak > longestStreak) longestStreak = activeStreak;
      } else {
        activeStreak = 0;
      }
    });
    for (let k = playerRoundsList.length - 1; k >= 0; k--) {
      if (playerRoundsList[k].won) {
        currentStreak++;
      } else {
        break;
      }
    }

    const recentResults = playerRoundsList.slice(-5).map((r: any) => r.won ? "1" : "0");

    // Format segments array matching FACEIT API
    const segments = Object.values(mapStats).map((m: any) => {
      const mapWinRate = m.matches > 0 ? Math.round((m.wins / m.matches) * 100) : 0;
      const mapKd = m.deaths > 0 ? m.kills / m.deaths : m.kills;
      const mapAdr = m.rounds > 0 ? m.damage / m.rounds : 75;

      return {
        label: m.map,
        type: "Map",
        img_regular: "",
        img_small: "",
        stats: {
          "Matches": m.matches.toString(),
          "Win Rate %": mapWinRate.toString(),
          "Average K/D Ratio": mapKd.toFixed(2),
          "Average Kills": m.matches > 0 ? (m.kills / m.matches).toFixed(1) : "0",
          "ADR": mapAdr.toFixed(1)
        }
      };
    });

    const responseData = {
      player_id: playerId,
      lifetime: {
        "Matches": matchesCount.toString(),
        "Win Rate %": winrateOverall.toString(),
        "Average K/D Ratio": avgKd.toFixed(2),
        "Average Headshots %": avgHs.toString(),
        "Recent Results": recentResults,
        "Current Win Streak": currentStreak.toString(),
        "Longest Win Streak": longestStreak.toString(),
        "Total Sniper Kills": totalSniperKills.toString(),
        "Sniper Kill Rate": totalKills > 0 ? (totalSniperKills / totalKills).toFixed(2) : "0",
        "ADR": avgAdr.toFixed(1),
        "K/D Ratio": avgKd.toFixed(2),
        "Entry Rate": totalRounds > 0 ? (totalEntryCount / totalRounds).toFixed(2) : "0.00",
        "Entry Success Rate": totalEntryCount > 0 ? (totalEntryWins / totalEntryCount).toFixed(2) : "0.00",
        "Utility Damage per Round": totalRounds > 0 ? (totalUtilityDamage / totalRounds).toFixed(2) : "0.00",
        "Flash Success Rate": totalFlashCount > 0 ? (totalFlashSuccesses / totalFlashCount).toFixed(2) : "0.00",
        "1v1 Win Rate": total1v1Count > 0 ? (total1v1Wins / total1v1Count).toFixed(2) : "0.00",
        "1v2 Win Rate": total1v2Count > 0 ? (total1v2Wins / total1v2Count).toFixed(2) : "0.00"
      },
      segments
    };

    return NextResponse.json(responseData);
  } catch (error: any) {
    console.error("Error generating player hub stats:", error.message);
    return NextResponse.json(
      { error: error.message || "Не удалось загрузить локальную статистику игрока по хабу" },
      { status: 500 }
    );
  }
}
