export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { faceitFetch } from "@/lib/faceit";
import { getStoragePath, isMatchExcluded } from "@/lib/storage";
import { promises as fs } from "fs";
import { getHubPlayersFormMap } from "@/lib/player_form";
import { fetchHubTournamentsData } from "@/app/api/faceit/hubs/[hubId]/tournaments/route";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ leaderboardId: string }> }
) {
  try {
    const { leaderboardId } = await params;
    if (!leaderboardId) {
      return NextResponse.json({ error: "Не указан ID таблицы лидеров" }, { status: 400 });
    }

    const { searchParams } = request.nextUrl;
    const limit = searchParams.get("limit") || "100";
    const offset = searchParams.get("offset") || "0";

    const data = await faceitFetch(`/leaderboards/${leaderboardId}`, {
      limit,
      offset,
    });

    // 1. Read match stats cache to aggregate real hub performance per player
    let cacheData: Record<string, any> = {};
    try {
      const cacheFilePath = getStoragePath("match_stats_cache.json");
      const dataStr = await fs.readFile(cacheFilePath, "utf8");
      cacheData = JSON.parse(dataStr);
    } catch (e) {
      console.warn("Failed to read match cache in specific leaderboard:", e);
    }

    // 1.1 Include Custom Matches into cacheData
    try {
      const customMatchesFilePath = getStoragePath("custom_matches.json");
      const customMatchesRaw = await fs.readFile(customMatchesFilePath, "utf8").catch(() => "[]");
      const customMatchesList = JSON.parse(customMatchesRaw || "[]");
      if (Array.isArray(customMatchesList)) {
        customMatchesList.forEach((cm: any) => {
          if (!cm.match_id || cm.status !== "FINISHED" || isMatchExcluded(cm.match_id)) return;

          const mapsList = cm.mapBreakdown || [
            {
              map: cm.maps?.[0] || "de_mirage",
              score1: cm.results?.score?.faction1 || 13,
              score2: cm.results?.score?.faction2 || 9,
              players1: cm.players1 || [],
              players2: cm.players2 || []
            }
          ];

          const rounds = mapsList.map((mb: any, idx: number) => {
            const s1 = mb.score1 || 0;
            const s2 = mb.score2 || 0;
            const totalRounds = s1 + s2;
            const t1Win = s1 > s2;
            const t2Win = s2 > s1;

            return {
              match_id: `${cm.match_id}_map${idx}`,
              round_stats: {
                Map: mb.map || "de_mirage",
                Score: `${s1}:${s2}`,
                Rounds: totalRounds.toString(),
                Winner: t1Win ? "faction1" : (t2Win ? "faction2" : "draw")
              },
              teams: [
                {
                  team_id: "faction1",
                  team_stats: {
                    Team: cm.teams?.faction1?.name || "Команда 1",
                    TeamWin: t1Win ? "1" : "0"
                  },
                  players: (mb.players1 || []).map((p: any) => ({
                    player_id: p.player_id,
                    nickname: p.nickname,
                    player_stats: {
                      Kills: (p.kills || 0).toString(),
                      Deaths: (p.deaths || 0).toString(),
                      Assists: (p.assists || 0).toString(),
                      Damage: (p.damage || 0).toString(),
                      Headshots: (p.headshots || 0).toString(),
                      MVPs: (p.mvps || 0).toString(),
                      "K/D Ratio": (p.deaths > 0 ? (p.kills / p.deaths).toFixed(2) : p.kills.toString()),
                      "K/R Ratio": (totalRounds > 0 ? (p.kills / totalRounds).toFixed(2) : "0.75"),
                      Result: t1Win ? "1" : "0"
                    }
                  }))
                },
                {
                  team_id: "faction2",
                  team_stats: {
                    Team: cm.teams?.faction2?.name || "Команда 2",
                    TeamWin: t2Win ? "1" : "0"
                  },
                  players: (mb.players2 || []).map((p: any) => ({
                    player_id: p.player_id,
                    nickname: p.nickname,
                    player_stats: {
                      Kills: (p.kills || 0).toString(),
                      Deaths: (p.deaths || 0).toString(),
                      Assists: (p.assists || 0).toString(),
                      Damage: (p.damage || 0).toString(),
                      Headshots: (p.headshots || 0).toString(),
                      MVPs: (p.mvps || 0).toString(),
                      "K/D Ratio": (p.deaths > 0 ? (p.kills / p.deaths).toFixed(2) : p.kills.toString()),
                      "K/R Ratio": (totalRounds > 0 ? (p.kills / totalRounds).toFixed(2) : "0.75"),
                      Result: t2Win ? "1" : "0"
                    }
                  }))
                }
              ]
            };
          });

          cacheData[cm.match_id] = {
            match_id: cm.match_id,
            finished_at: cm.finished_at || cm.started_at,
            started_at: cm.started_at,
            rounds
          };
        });
      }
    } catch (e) {
      console.warn("Failed to load custom matches into specific leaderboard:", e);
    }

    let overridesData: Record<string, any> = {};
    try {
      const overridesPath = getStoragePath("player_overrides.json");
      const ovStr = await fs.readFile(overridesPath, "utf8");
      overridesData = JSON.parse(ovStr);
    } catch (e) {}

    const playerAgg: Record<string, {
      matches: number;
      wins: number;
      kills: number;
      deaths: number;
      assists: number;
      damage: number;
      rounds: number;
      headshots: number;
      maps: number;
    }> = {};

    for (const matchId in cacheData) {
      if (isMatchExcluded(matchId)) continue;
      const match = cacheData[matchId];
      if (!match || !Array.isArray(match.rounds)) continue;
      const mTime = match.finished_at || match.started_at || match.created_at || 0;

      const playersInMatch = new Map<string, {
        pid: string;
        nick: string;
        isWin: boolean;
        kills: number;
        deaths: number;
        assists: number;
        damage: number;
        rounds: number;
        headshots: number;
        maps: number;
      }>();

      for (const round of match.rounds) {
        const roundsInMatch = parseInt(round.round_stats?.Rounds || "22", 10);
        const roundWinner = round.round_stats?.Winner;

        for (const team of round.teams || []) {
          for (const player of team.players || []) {
            const pid = (player.player_id || "").toLowerCase();
            const nick = (player.nickname || "").toLowerCase();
            const ps = player.player_stats || {};

            const keys = [pid, nick].filter(Boolean);
            if (keys.length === 0) continue;

            const pOv = (pid && overridesData[pid]) || (nick && overridesData[nick]) || (nick && overridesData[nick.toLowerCase()]);
            if (pOv?.statsStartDate) {
              const cutoff = Math.floor(new Date(pOv.statsStartDate).getTime() / 1000);
              if (cutoff > 0 && (!mTime || mTime < cutoff)) {
                continue; // Skip pre-cutoff matches for this player
              }
            }

            const primaryKey = pid || nick;
            if (!playersInMatch.has(primaryKey)) {
              playersInMatch.set(primaryKey, {
                pid,
                nick,
                isWin: false,
                kills: 0,
                deaths: 0,
                assists: 0,
                damage: 0,
                rounds: 0,
                headshots: 0,
                maps: 0
              });
            }

            const pEntry = playersInMatch.get(primaryKey)!;
            const isWin = (Boolean(roundWinner) && team.team_id === roundWinner) || 
                          team.team_stats?.TeamWin === "1" || 
                          team.team_stats?.["Team Win"] === "1" || 
                          ps.Result === "1";
            if (isWin) pEntry.isWin = true;
            pEntry.kills += parseInt(ps.Kills || "0", 10);
            pEntry.deaths += parseInt(ps.Deaths || "0", 10);
            pEntry.assists += parseInt(ps.Assists || "0", 10);
            pEntry.damage += parseInt(ps.Damage || "0", 10);
            pEntry.rounds += roundsInMatch;
            pEntry.headshots += parseInt(ps.Headshots || "0", 10);
            pEntry.maps++;
          }
        }
      }

      for (const [primaryKey, pEntry] of playersInMatch.entries()) {
        if (!playerAgg[primaryKey]) {
          playerAgg[primaryKey] = {
            matches: 0,
            wins: 0,
            kills: 0,
            deaths: 0,
            assists: 0,
            damage: 0,
            rounds: 0,
            headshots: 0,
            maps: 0
          };
        }
        const pObj = playerAgg[primaryKey];
        pObj.matches++;
        if (pEntry.isWin) pObj.wins++;
        pObj.kills += pEntry.kills;
        pObj.deaths += pEntry.deaths;
        pObj.assists += pEntry.assists;
        pObj.damage += pEntry.damage;
        pObj.rounds += pEntry.rounds;
        pObj.headshots += pEntry.headshots;
        pObj.maps += pEntry.maps;

        if (pEntry.pid && pEntry.nick && !playerAgg[pEntry.nick]) {
          playerAgg[pEntry.nick] = pObj;
        }
      }
    }

    // 0. Fetch active hub members to ensure kicked/removed members are filtered out
    let activeMemberIds = new Set<string>();
    let activeMemberNicks = new Set<string>();
    try {
      const hubId = "d0701937-8eba-4df9-8830-22137001c0bd";
      const membersData = await faceitFetch(`/hubs/${hubId}/members`).catch(() => null);
      if (membersData && Array.isArray(membersData.items)) {
        membersData.items.forEach((m: any) => {
          const pid = (m.user_id || m.player_id || m.id || "").toLowerCase();
          const nick = (m.nickname || "").toLowerCase();
          if (pid) activeMemberIds.add(pid);
          if (nick) activeMemberNicks.add(nick);
        });
      }
    } catch (e) {
      console.warn("Failed to fetch active hub members for filtering:", e);
    }

    const HUB_ID = "d0701937-8eba-4df9-8830-22137001c0bd";
    let formMap: Record<string, any> = {};
    try {
      const tourneysRes = await fetchHubTournamentsData(HUB_ID);
      formMap = getHubPlayersFormMap(HUB_ID, tourneysRes.tournaments);
    } catch {
      formMap = getHubPlayersFormMap(HUB_ID);
    }

    // Attach computed stats to leaderboard items
    if (data && Array.isArray(data.items)) {
      if (activeMemberIds.size > 0 || activeMemberNicks.size > 0) {
        data.items = data.items.filter((item: any) => {
          const pInfo = item.player || item.user || {};
          const pid = (pInfo.player_id || pInfo.user_id || pInfo.id || item.player_id || "").toLowerCase();
          const nick = (pInfo.nickname || item.nickname || "").toLowerCase();
          return (pid && activeMemberIds.has(pid)) || (nick && activeMemberNicks.has(nick));
        });
      }

      data.items.forEach((item: any, idx: number) => {
        item.position = idx + 1;
        const pInfo = item.player || item.user || {};
        const pid = (pInfo.player_id || pInfo.user_id || pInfo.id || item.player_id || "").toLowerCase();
        const nick = (pInfo.nickname || item.nickname || "").toLowerCase();

        const st = (pid && playerAgg[pid]) || (nick && playerAgg[nick]) || null;
        if (st && st.matches > 0) {
          const kd = st.deaths > 0 ? parseFloat((st.kills / st.deaths).toFixed(2)) : st.kills;
          const mapDivisor = st.maps > 0 ? st.maps : st.matches;
          const avgKills = parseFloat((st.kills / mapDivisor).toFixed(1));
          const adr = st.rounds > 0 ? parseFloat((st.damage / st.rounds).toFixed(1)) : 0;
          const hsPct = st.kills > 0 ? Math.round((st.headshots / st.kills) * 100) : 0;

          const kpr = st.rounds > 0 ? st.kills / st.rounds : 0;
          const dpr = st.rounds > 0 ? st.deaths / st.rounds : 0;
          const apr = st.rounds > 0 ? st.assists / st.rounds : 0;
          const adrNum = st.rounds > 0 ? st.damage / st.rounds : 0;
          const hltv = parseFloat(Math.max(0.1, (0.36 * kpr) - (0.53 * dpr) + (0.1 * apr) + (0.003 * adrNum) + 0.85).toFixed(2));

          const pOv = (pid && overridesData[pid]) || (nick && overridesData[nick]) || (nick && overridesData[nick.toLowerCase()]);
          const hasCutoff = Boolean(pOv?.statsStartDate);

          const tableWinRate = (!hasCutoff && typeof item.win_rate === "number")
            ? (item.win_rate <= 1 ? item.win_rate * 100 : item.win_rate)
            : (!hasCutoff && typeof item.played === "number" && item.played > 0 && typeof item.won === "number" ? (item.won / item.played) * 100 : undefined);

          const winrate = hasCutoff 
            ? (st.matches > 0 ? parseFloat(((st.wins / st.matches) * 100).toFixed(1)) : 50.0)
            : (tableWinRate !== undefined ? parseFloat(tableWinRate.toFixed(1)) : (st.matches > 0 ? parseFloat(((st.wins / st.matches) * 100).toFixed(1)) : 50.0));

          const matchesCount = hasCutoff ? st.matches : (typeof item.played === "number" ? item.played : st.matches);
          const winsCount = hasCutoff ? st.wins : (typeof item.won === "number" ? item.won : st.wins);

          if (hasCutoff) {
            item.played = st.matches;
            item.won = st.wins;
            item.lost = Math.max(0, st.matches - st.wins);
            item.win_rate = st.matches > 0 ? parseFloat((st.wins / st.matches).toFixed(2)) : 0.5;
          }

          const form = (pid && formMap[pid]) || (nick && formMap[nick]) || (pInfo.player_id && formMap[pInfo.player_id]) || null;

          item.hubStats = {
            kd,
            avgKills,
            adr,
            hsPct,
            hltv,
            winrate,
            matches: matchesCount,
            wins: winsCount,
            rounds: st.rounds,
            maps: st.maps,
            form
          };
        } else {
          const form = (pid && formMap[pid]) || (nick && formMap[nick]) || (pInfo.player_id && formMap[pInfo.player_id]) || null;
          item.hubStats = form ? { form } : null;
        }
      });
    }

    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" }
    });
  } catch (error: any) {
    if (error.message === "API_KEY_MISSING") {
      return NextResponse.json({ error: "API_KEY_MISSING" }, { status: 401 });
    }
    return NextResponse.json(
      { error: error.message || "Не удалось загрузить данные таблицы лидеров" },
      { status: error.status || 500 }
    );
  }
}
