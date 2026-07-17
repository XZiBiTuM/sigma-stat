import { NextRequest, NextResponse } from "next/server";
import { faceitFetch } from "@/lib/faceit";
import { promises as fs } from "fs";
import path from "path";

// Path to stats cache file
const cacheFilePath = path.join(process.cwd(), "src", "lib", "match_stats_cache.json");

// Local helper to read cache
async function readStatsCache(): Promise<Record<string, any>> {
  try {
    const data = await fs.readFile(cacheFilePath, "utf8");
    return JSON.parse(data);
  } catch (error) {
    return {};
  }
}

// Local helper to write cache
async function writeStatsCache(cache: Record<string, any>) {
  try {
    const cacheDir = path.dirname(cacheFilePath);
    await fs.mkdir(cacheDir, { recursive: true });
    await fs.writeFile(cacheFilePath, JSON.stringify(cache, null, 2), "utf8");
  } catch (error) {
    console.error("Error writing stats cache:", error);
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

    // 1. Fetch finished matches from FACEIT API (limit=100)
    const matchesData = await faceitFetch(`/hubs/${hubId}/matches`, {
      limit: "100",
      type: "past",
    });

    const finishedMatches = (matchesData.items || []).filter(
      (m: any) => m.status === "FINISHED"
    );

    // Sort chronologically (oldest to newest)
    finishedMatches.sort((a: any, b: any) => {
      const timeA = a.finished_at || a.started_at || 0;
      const timeB = b.finished_at || b.started_at || 0;
      return timeA - timeB;
    });

    // 2. Group matches into tournaments
    const tournamentsGroups: any[][] = [];
    let currentGroup: any[] = [];
    let baseDate: Date | null = null;

    for (const match of finishedMatches) {
      const matchTime = (match.finished_at || match.started_at) * 1000;
      const matchDate = new Date(matchTime);

      if (currentGroup.length === 0) {
        currentGroup.push(match);
        baseDate = matchDate;
      } else {
        const timeDiff = Math.abs(matchDate.getTime() - (baseDate?.getTime() || 0));
        const hoursDiff = timeDiff / (1000 * 60 * 60);

        // Group size limit: 6, time window limit: 36 hours
        if (hoursDiff <= 36 && currentGroup.length < 6) {
          currentGroup.push(match);
        } else {
          tournamentsGroups.push(currentGroup);
          currentGroup = [match];
          baseDate = matchDate;
        }
      }
    }

    if (currentGroup.length > 0) {
      tournamentsGroups.push(currentGroup);
    }

    // 3. Load stats cache
    const statsCache = await readStatsCache();
    let cacheUpdated = false;

    const tournaments = [];

    // Process tournaments (reverse chronological order for frontend display: newest first)
    for (let tIdx = tournamentsGroups.length - 1; tIdx >= 0; tIdx--) {
      const tMatches = tournamentsGroups[tIdx];
      if (tMatches.length === 0) continue;

      const startDateStr = new Date(
        (tMatches[0].finished_at || tMatches[0].started_at) * 1000
      ).toLocaleDateString("ru-RU");
      const endDateStr = new Date(
        (tMatches[tMatches.length - 1].finished_at ||
          tMatches[tMatches.length - 1].started_at) * 1000
      ).toLocaleDateString("ru-RU");

      const mapCounts: Record<string, number> = {};
      const playerStats: Record<string, any> = {};

      const processedMatches = [];

      for (const match of tMatches) {
        let stats = statsCache[match.match_id];

        if (!stats) {
          try {
            // Delay to avoid rate limiting
            await new Promise((resolve) => setTimeout(resolve, 150));
            stats = await faceitFetch(`/matches/${match.match_id}/stats`);
            statsCache[match.match_id] = stats;
            cacheUpdated = true;
          } catch (e: any) {
            console.error(`Failed to fetch stats for match ${match.match_id}:`, e.message);
            continue;
          }
        }

        const rounds = stats?.rounds || [];
        if (rounds.length === 0) continue;

        const mapsList = rounds.map((r: any) => r.round_stats?.Map || "Неизвестно");
        for (const mapName of mapsList) {
          mapCounts[mapName] = (mapCounts[mapName] || 0) + 1;
        }

        // Get score for this match
        const score1 = match.results?.score?.faction1 ?? match.teams?.faction1?.score ?? "-";
        const score2 = match.results?.score?.faction2 ?? match.teams?.faction2?.score ?? "-";

        processedMatches.push({
          match_id: match.match_id,
          finished_at: match.finished_at,
          maps: mapsList,
          teams: {
            faction1: {
              name: match.teams?.faction1?.name || "Faction 1",
              score: score1,
            },
            faction2: {
              name: match.teams?.faction2?.name || "Faction 2",
              score: score2,
            },
          },
        });

        // Player statistics aggregation across all rounds in this match
        const matchPlayers = new Set<string>();
        for (const round of rounds) {
          for (const team of round.teams || []) {
            const isWinner = team.team_stats?.Result === "1" || team.team_stats?.["Team Win"] === "1";

            for (const p of team.players || []) {
              if (!playerStats[p.player_id]) {
                playerStats[p.player_id] = {
                  nickname: p.nickname,
                  avatar: p.avatar || "",
                  kills: 0,
                  deaths: 0,
                  assists: 0,
                  mvps: 0,
                  wins: 0,
                  played: 0,
                  hsPctSum: 0,
                  kdSum: 0,
                  roundsPlayed: 0,
                };
              }

              const ps = playerStats[p.player_id];
              ps.roundsPlayed += 1;
              ps.kills += parseInt(p.player_stats?.Kills || "0", 10);
              ps.deaths += parseInt(p.player_stats?.Deaths || "0", 10);
              ps.assists += parseInt(p.player_stats?.Assists || "0", 10);
              ps.mvps += parseInt(p.player_stats?.MVPs || "0", 10);
              ps.hsPctSum += parseInt(p.player_stats?.["Headshots %"] || "0", 10);
              ps.kdSum += parseFloat(p.player_stats?.["K/D Ratio"] || "0");
              if (isWinner) {
                ps.wins += 1;
              }

              if (!matchPlayers.has(p.player_id)) {
                matchPlayers.add(p.player_id);
                ps.played += 1;
              }
            }
          }
        }
      }

      // Determine most popular map
      let popularMap = "Неизвестно";
      let maxMapCount = 0;
      for (const map in mapCounts) {
        if (mapCounts[map] > maxMapCount) {
          maxMapCount = mapCounts[map];
          popularMap = map;
        }
      }

      // Convert players stats to sorted list
      const playersList = Object.keys(playerStats).map((playerId) => {
        const p = playerStats[playerId];
        const avgKd = p.deaths > 0 ? p.kills / p.deaths : p.kills;
        const winRate = (p.wins / p.roundsPlayed) * 100;
        const avgHs = p.hsPctSum / p.roundsPlayed;

        return {
          playerId,
          nickname: p.nickname,
          avatar: p.avatar,
          played: p.played,
          wins: p.wins,
          losses: p.roundsPlayed - p.wins,
          winRate: winRate.toFixed(1),
          kills: p.kills,
          deaths: p.deaths,
          assists: p.assists,
          mvps: p.mvps,
          avgKd: avgKd.toFixed(2),
          avgHs: avgHs.toFixed(1),
        };
      });

      // Sort: KD desc, then winRate desc
      playersList.sort((a, b) => {
        const kdDiff = parseFloat(b.avgKd) - parseFloat(a.avgKd);
        if (kdDiff !== 0) return kdDiff;
        return parseFloat(b.winRate) - parseFloat(a.winRate);
      });

      // Determine Tournament MVP
      // Must have played at least 3 matches in the tournament (or at least 1 if short tournament)
      const mvpCandidates = playersList.filter(
        (p) => p.played >= Math.min(3, tMatches.length)
      );
      const mvp = mvpCandidates.length > 0 ? mvpCandidates[0] : playersList[0] || null;

      tournaments.push({
        id: `tournament-${tIdx + 1}`,
        name: `Турнир #${tIdx + 1}`,
        startDate: startDateStr,
        endDate: endDateStr,
        matchesCount: tMatches.length,
        popularMap,
        maxMapCount,
        mvp,
        players: playersList,
        matches: processedMatches,
      });
    }

    // Write back updated cache if any new fetches occurred
    if (cacheUpdated) {
      await writeStatsCache(statsCache);
    }

    return NextResponse.json({ tournaments });
  } catch (error: any) {
    if (error.message === "API_KEY_MISSING") {
      return NextResponse.json({ error: "API_KEY_MISSING" }, { status: 401 });
    }
    return NextResponse.json(
      { error: error.message || "Не удалось загрузить турниры" },
      { status: error.status || 500 }
    );
  }
}
