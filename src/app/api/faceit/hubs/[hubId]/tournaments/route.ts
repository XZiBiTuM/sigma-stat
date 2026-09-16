import { NextRequest, NextResponse } from "next/server";
import { faceitFetch } from "@/lib/faceit";
import { getStoragePath, isMatchExcluded } from "@/lib/storage";
import { promises as fs } from "fs";
import path from "path";

// Path to stats cache file
const cacheFilePath = getStoragePath("match_stats_cache.json");
const customMatchesFilePath = getStoragePath("custom_matches.json");

// Local helper to read cache
async function readStatsCache(): Promise<Record<string, any>> {
  try {
    const data = await fs.readFile(cacheFilePath, "utf8");
    return JSON.parse(data);
  } catch (error) {
    return {};
  }
}

// Local helper to read custom matches
async function readCustomMatches(): Promise<any[]> {
  try {
    const data = await fs.readFile(customMatchesFilePath, "utf8");
    return JSON.parse(data || "[]");
  } catch (error) {
    return [];
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

export async function fetchHubTournamentsData(hubId: string) {
  try {
    if (hubId === "0dd077bc-b401-4f5c-8a40-47578601ccb7") {
      hubId = "d0701937-8eba-4df9-8830-22137001c0bd";
    }

    // 1. Fetch finished matches from FACEIT API (limit=100)
    const matchesData = await faceitFetch(`/hubs/${hubId}/matches`, {
    limit: "100",
    type: "past",
  });

    const finishedMatches = (matchesData.items || []).filter(
      (m: any) => m.status === "FINISHED" && !isMatchExcluded(m.match_id)
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
              const roundsInMatch = parseInt(round.round_stats?.Rounds || "22", 10);
              const pDamage = parseFloat(p.player_stats?.Damage || "0") || (parseFloat(p.player_stats?.ADR || "0") * roundsInMatch) || (parseInt(p.player_stats?.Kills || "0", 10) * 85);

              ps.roundsPlayed += 1;
              ps.totalRounds += roundsInMatch;
              ps.totalDamage += pDamage;
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
        const adr = p.totalRounds > 0 ? p.totalDamage / p.totalRounds : (p.roundsPlayed > 0 ? (p.kills * 80) / (p.roundsPlayed * 22) : 0);

        const kpr = p.totalRounds > 0 ? p.kills / p.totalRounds : (p.kills / (p.roundsPlayed * 22 || 1));
        const dpr = p.totalRounds > 0 ? p.deaths / p.totalRounds : (p.deaths / (p.roundsPlayed * 22 || 1));
        const apr = p.totalRounds > 0 ? p.assists / p.totalRounds : (p.assists / (p.roundsPlayed * 22 || 1));
        const hltv = Math.max(0.1, (0.36 * kpr) - (0.53 * dpr) + (0.1 * apr) + (0.003 * adr) + 0.85);

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
          adr: adr.toFixed(1),
          hltv: hltv.toFixed(2),
        };
      });

      // Sort by HLTV 2.0 desc, then avgKd desc, then winRate desc
      playersList.sort((a, b) => {
        const hltvDiff = parseFloat(b.hltv) - parseFloat(a.hltv);
        if (hltvDiff !== 0) return hltvDiff;
        const kdDiff = parseFloat(b.avgKd) - parseFloat(a.avgKd);
        if (kdDiff !== 0) return kdDiff;
        return parseFloat(b.winRate) - parseFloat(a.winRate);
      });

      // Determine Tournament MVP by HLTV 2.0 Rating
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

    // Process Cybershoke Custom Tournament if custom matches exist
    const customMatches = await readCustomMatches();
    const cupMatches = customMatches.filter((m: any) => m.match_id && m.match_id.startsWith("cs_sigma_cup_"));
    if (cupMatches.length > 0) {
      const cMapCounts: Record<string, number> = {};
      const cPlayerStats: Record<string, any> = {};
      const cProcessedMatches: any[] = [];

      for (const cm of cupMatches) {
        const mapsList = (cm.mapBreakdown || []).map((mb: any) => mb.map || "de_mirage");
        for (const mName of mapsList) {
          cMapCounts[mName] = (cMapCounts[mName] || 0) + 1;
        }

        cProcessedMatches.push({
          match_id: cm.match_id,
          finished_at: cm.finished_at || 1789514900,
          maps: mapsList,
          teams: {
            faction1: {
              name: cm.teams?.faction1?.name || "Team 1",
              score: cm.results?.score?.faction1 ?? 0,
            },
            faction2: {
              name: cm.teams?.faction2?.name || "Team 2",
              score: cm.results?.score?.faction2 ?? 0,
            },
          },
        });

        for (const mb of cm.mapBreakdown || []) {
          const isFaction1Win = (mb.score1 || 0) > (mb.score2 || 0);
          const isFaction2Win = (mb.score2 || 0) > (mb.score1 || 0);
          const mapRounds = (mb.score1 || 13) + (mb.score2 || 9);

          for (const p of mb.players1 || []) {
            const pId = p.player_id || `cs_p_${p.nickname}`;
            if (!cPlayerStats[pId]) {
              cPlayerStats[pId] = {
                nickname: p.nickname,
                kills: 0,
                deaths: 0,
                assists: 0,
                mvps: 0,
                played: 0,
                wins: 0,
                roundsPlayed: 0,
                totalRounds: 0,
                totalDamage: 0,
                hsPctSum: 0,
              };
            }
            cPlayerStats[pId].kills += p.kills || 0;
            cPlayerStats[pId].deaths += p.deaths || 0;
            cPlayerStats[pId].assists += p.assists || 0;
            cPlayerStats[pId].mvps += p.mvps || 0;
            cPlayerStats[pId].played += 1;
            cPlayerStats[pId].roundsPlayed += 1;
            cPlayerStats[pId].totalRounds += mapRounds;
            cPlayerStats[pId].totalDamage += (p.damage || (p.kills * 85));
            cPlayerStats[pId].hsPctSum += (p.kills > 0 && p.headshots ? (p.headshots / p.kills) * 100 : 40);
            if (isFaction1Win) cPlayerStats[pId].wins += 1;
          }

          for (const p of mb.players2 || []) {
            const pId = p.player_id || `cs_p_${p.nickname}`;
            if (!cPlayerStats[pId]) {
              cPlayerStats[pId] = {
                nickname: p.nickname,
                kills: 0,
                deaths: 0,
                assists: 0,
                mvps: 0,
                played: 0,
                wins: 0,
                roundsPlayed: 0,
                totalRounds: 0,
                totalDamage: 0,
                hsPctSum: 0,
              };
            }
            cPlayerStats[pId].kills += p.kills || 0;
            cPlayerStats[pId].deaths += p.deaths || 0;
            cPlayerStats[pId].assists += p.assists || 0;
            cPlayerStats[pId].mvps += p.mvps || 0;
            cPlayerStats[pId].played += 1;
            cPlayerStats[pId].roundsPlayed += 1;
            cPlayerStats[pId].totalRounds += mapRounds;
            cPlayerStats[pId].totalDamage += (p.damage || (p.kills * 85));
            cPlayerStats[pId].hsPctSum += (p.kills > 0 && p.headshots ? (p.headshots / p.kills) * 100 : 40);
            if (isFaction2Win) cPlayerStats[pId].wins += 1;
          }
        }
      }

      let cPopularMap = "de_anubis";
      let cMaxMapCount = 0;
      for (const map in cMapCounts) {
        if (cMapCounts[map] > cMaxMapCount) {
          cMaxMapCount = cMapCounts[map];
          cPopularMap = map;
        }
      }

      const cPlayersList = Object.keys(cPlayerStats).map((playerId) => {
        const p = cPlayerStats[playerId];
        const avgKd = p.deaths > 0 ? p.kills / p.deaths : p.kills;
        const winRate = p.roundsPlayed > 0 ? (p.wins / p.roundsPlayed) * 100 : 0;
        const avgHs = p.roundsPlayed > 0 ? p.hsPctSum / p.roundsPlayed : 40;
        const adr = p.totalRounds > 0 ? p.totalDamage / p.totalRounds : (p.kills * 80) / (p.roundsPlayed * 22 || 1);

        const kpr = p.totalRounds > 0 ? p.kills / p.totalRounds : p.kills / (p.roundsPlayed * 22 || 1);
        const dpr = p.totalRounds > 0 ? p.deaths / p.totalRounds : p.deaths / (p.roundsPlayed * 22 || 1);
        const apr = p.totalRounds > 0 ? p.assists / p.totalRounds : p.assists / (p.roundsPlayed * 22 || 1);
        const hltv = Math.max(0.1, (0.36 * kpr) - (0.53 * dpr) + (0.1 * apr) + (0.003 * adr) + 0.85);

        return {
          playerId,
          nickname: p.nickname,
          avatar: "",
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
          adr: adr.toFixed(1),
          hltv: hltv.toFixed(2),
        };
      });

      // Sort by HLTV 2.0 desc, then avgKd desc, then winRate desc
      cPlayersList.sort((a, b) => {
        const hltvDiff = parseFloat(b.hltv) - parseFloat(a.hltv);
        if (hltvDiff !== 0) return hltvDiff;
        const kdDiff = parseFloat(b.avgKd) - parseFloat(a.avgKd);
        if (kdDiff !== 0) return kdDiff;
        return parseFloat(b.winRate) - parseFloat(a.winRate);
      });

      const cMvp = cPlayersList[0] || null;

      const cyberCupTournament = {
        id: "tournament-cybershoke-s2",
        name: `Турнир #${tournaments.length + 1} (Sigma Cyber Cup)`,
        startDate: "15.09.2026",
        endDate: "15.09.2026",
        matchesCount: cupMatches.length,
        popularMap: cPopularMap,
        maxMapCount: cMaxMapCount,
        mvp: cMvp,
        players: cPlayersList,
        matches: cProcessedMatches,
      };

      // Prepend to tournaments so it appears first
      tournaments.unshift(cyberCupTournament);
    }

    // Write back updated cache if any new fetches occurred
    if (cacheUpdated) {
      await writeStatsCache(statsCache);
    }

    return { tournaments };
  } catch (error: any) {
    console.error("Error in fetchHubTournamentsData:", error);
    return { tournaments: [], error: error.message };
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ hubId: string }> }
) {
  try {
    const { hubId } = await params;
    const result = await fetchHubTournamentsData(hubId);
    if (result.error === "API_KEY_MISSING") {
      return NextResponse.json({ error: "API_KEY_MISSING" }, { status: 401 });
    }
    return NextResponse.json({ tournaments: result.tournaments });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Не удалось загрузить турниры" },
      { status: error.status || 500 }
    );
  }
}
