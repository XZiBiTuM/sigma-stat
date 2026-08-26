export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { faceitFetch } from "@/lib/faceit";
import { getStoragePath } from "@/lib/storage";
import { promises as fs } from "fs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ hubId: string }> }
) {
  try {
    let { hubId } = await params;
    if (hubId === "0dd077bc-b401-4f5c-8a40-47578601ccb7") {
      hubId = "d0701937-8eba-4df9-8830-22137001c0bd";
    }

    const { searchParams } = request.nextUrl;
    const limit = searchParams.get("limit") || "100";
    const offset = searchParams.get("offset") || "0";

    const data = await faceitFetch(`/leaderboards/hubs/${hubId}/general`, {
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
      console.warn("Failed to read match cache in general leaderboard:", e);
    }

    const playerAgg: Record<string, {
      matches: number;
      wins: number;
      kills: number;
      deaths: number;
      assists: number;
      damage: number;
      rounds: number;
      headshots: number;
    }> = {};

    for (const matchId in cacheData) {
      const match = cacheData[matchId];
      if (!match || !Array.isArray(match.rounds)) continue;

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

            const primaryKey = pid || nick;
            if (!playerAgg[primaryKey]) {
              playerAgg[primaryKey] = {
                matches: 0,
                wins: 0,
                kills: 0,
                deaths: 0,
                assists: 0,
                damage: 0,
                rounds: 0,
                headshots: 0
              };
            }

            const isWin = (Boolean(roundWinner) && team.team_id === roundWinner) || 
                          team.team_stats?.TeamWin === "1" || 
                          team.team_stats?.["Team Win"] === "1" || 
                          ps.Result === "1";

            const pObj = playerAgg[primaryKey];
            pObj.matches++;
            if (isWin) pObj.wins++;
            pObj.kills += parseInt(ps.Kills || "0", 10);
            pObj.deaths += parseInt(ps.Deaths || "0", 10);
            pObj.assists += parseInt(ps.Assists || "0", 10);
            pObj.damage += parseInt(ps.Damage || "0", 10);
            pObj.rounds += roundsInMatch;
            pObj.headshots += parseInt(ps.Headshots || "0", 10);

            // Also alias by nickname if pid exists
            if (pid && nick && !playerAgg[nick]) {
              playerAgg[nick] = pObj;
            }
          }
        }
      }
    }

    // 0. Fetch active hub members to ensure kicked/removed members are filtered out
    let activeMemberIds = new Set<string>();
    let activeMemberNicks = new Set<string>();
    try {
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
          const avgKills = parseFloat((st.kills / st.matches).toFixed(1));
          const adr = st.rounds > 0 ? parseFloat((st.damage / st.rounds).toFixed(1)) : 0;
          const hsPct = st.kills > 0 ? Math.round((st.headshots / st.kills) * 100) : 0;

          const kpr = st.rounds > 0 ? st.kills / st.rounds : 0;
          const dpr = st.rounds > 0 ? st.deaths / st.rounds : 0;
          const apr = st.rounds > 0 ? st.assists / st.rounds : 0;
          const adrNum = st.rounds > 0 ? st.damage / st.rounds : 0;
          const hltv = parseFloat(Math.max(0.1, (0.36 * kpr) - (0.53 * dpr) + (0.1 * apr) + (0.003 * adrNum) + 0.85).toFixed(2));

          const tableWinRate = typeof item.win_rate === "number" 
            ? (item.win_rate <= 1 ? item.win_rate * 100 : item.win_rate)
            : (typeof item.played === "number" && item.played > 0 && typeof item.won === "number" ? (item.won / item.played) * 100 : undefined);

          const winrate = tableWinRate !== undefined 
            ? parseFloat(tableWinRate.toFixed(1)) 
            : (st.matches > 0 ? parseFloat(((st.wins / st.matches) * 100).toFixed(1)) : 50.0);

          const matchesCount = typeof item.played === "number" ? item.played : st.matches;
          const winsCount = typeof item.won === "number" ? item.won : st.wins;

          item.hubStats = {
            kd,
            avgKills,
            adr,
            hsPct,
            hltv,
            winrate,
            matches: matchesCount,
            wins: winsCount,
            rounds: st.rounds
          };
        } else {
          item.hubStats = null;
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
      { error: error.message || "Не удалось загрузить общий рейтинг хаба" },
      { status: error.status || 500 }
    );
  }
}
