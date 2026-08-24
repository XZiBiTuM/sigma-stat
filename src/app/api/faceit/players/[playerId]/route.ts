export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { getPlayerProfile, faceitFetch } from "@/lib/faceit";
import { getStoragePath, getPersistentPath } from "@/lib/storage";
import { computeAdaptiveSkillScore } from "@/lib/skill";
import { promises as fs } from "fs";
import fsSync from "fs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ playerId: string }> }
) {
  try {
    const { playerId } = await params;
    if (!playerId) {
      return NextResponse.json({ error: "Не указан ID игрока" }, { status: 400 });
    }

    const data = await getPlayerProfile(playerId);

    // Read stored overrides
    let overrides: any = {};
    try {
      const ovPath = getPersistentPath("player_overrides.json");
      const fallbackOv = getStoragePath("player_overrides.json");
      const activePath = fsSync.existsSync(ovPath) ? ovPath : fallbackOv;
      if (fsSync.existsSync(activePath)) {
        overrides = JSON.parse(await fs.readFile(activePath, "utf8") || "{}");
      }
    } catch {}

    const playerKey = playerId;
    const nicknameKey = data.nickname;
    const lowerNick = (data.nickname || "").toLowerCase();
    const override = overrides[playerKey] || overrides[nicknameKey] || overrides[lowerNick] || {};

    const realFaceitElo = data.games?.cs2?.faceit_elo || data.games?.csgo?.faceit_elo;
    const elo = realFaceitElo || override.customElo || 1000;
    const faceitMatches = data.games?.cs2?.matches || data.lifetime?.Matches || 500;

    // Aggregate combat stats from match cache
    let combatStats: any = null;
    try {
      const cachePath = getPersistentPath("match_stats_cache.json");
      const fallbackCache = getStoragePath("match_stats_cache.json");
      const activeCachePath = fsSync.existsSync(cachePath) ? cachePath : fallbackCache;
      let kills = 0, deaths = 0, damage = 0, rounds = 0, headshots = 0, matches = 0, wins = 0, hltvSum = 0;
      if (fsSync.existsSync(activeCachePath)) {
        const cache = JSON.parse(await fs.readFile(activeCachePath, "utf8") || "{}");
        
        for (const match of Object.values(cache) as any[]) {
          if (!match?.rounds) continue;
          for (const round of match.rounds) {
            for (const t of round.teams || []) {
              for (const p of t.players || []) {
                const pidMatch = (p.player_id || "").toLowerCase() === (data.player_id || "").toLowerCase();
                const nickMatch = (p.nickname || "").toLowerCase() === lowerNick;
                if (pidMatch || nickMatch) {
                  const st = p.player_stats || {};
                  kills += parseInt(st.Kills || "0", 10);
                  deaths += parseInt(st.Deaths || "0", 10);
                  damage += parseInt(st.Damage || "0", 10);
                  headshots += parseInt(st.Headshots || "0", 10);
                  rounds += parseInt(round.round_stats?.Rounds || "22", 10);
                  if (round.round_stats?.Winner && t.team_id === round.round_stats?.Winner) wins++;
                  hltvSum += parseFloat(st["HLTV 2.0 Rating"] || st["Rating"] || "1.0") || 1.0;
                  matches++;
                }
              }
            }
          }
        }
      }

    // Check general leaderboard for official played & won count & winrate
    let officialWinRate: number | undefined;
    let officialPlayed: number | undefined;
    try {
      const HUB_ID = "d0701937-8eba-4df9-8830-22137001c0bd";
      const lbRes = await faceitFetch(`/leaderboards/hubs/${HUB_ID}/general?limit=50`).catch(() => ({ items: [] }));
      const userLb = (lbRes?.items || []).find((i: any) => 
        (i.player?.user_id && i.player.user_id.toLowerCase() === (data.player_id || "").toLowerCase()) || 
        (i.player?.nickname && i.player.nickname.toLowerCase() === lowerNick)
      );
      if (userLb) {
        if (typeof userLb.win_rate === "number") {
          officialWinRate = userLb.win_rate <= 1 ? userLb.win_rate * 100 : userLb.win_rate;
        } else if (typeof userLb.played === "number" && userLb.played > 0 && typeof userLb.won === "number") {
          officialWinRate = (userLb.won / userLb.played) * 100;
        }
        if (typeof userLb.played === "number") {
          officialPlayed = userLb.played;
        }
      }
    } catch {}

    if (matches > 0) {
      combatStats = {
        kd: deaths > 0 ? kills / deaths : kills,
        adr: rounds > 0 ? damage / rounds : 75,
        hsPct: kills > 0 ? (headshots / kills) * 100 : 45,
        avgKills: matches > 0 ? kills / matches : 16,
        winrate: officialWinRate !== undefined ? officialWinRate : (matches > 0 ? (wins / matches) * 100 : 50),
        hltv: matches > 0 ? hltvSum / matches : 1.0,
        matchesCount: officialPlayed !== undefined ? officialPlayed : matches
      };
    }
  } catch (e) {
    console.warn("Failed to load match cache for skill:", e);
  }

    const skillObj = computeAdaptiveSkillScore({
      playerId,
      nickname: data.nickname,
      elo,
      faceitMatches,
      premierRating: override.csRating,
      combatStats,
      overrides: override
    });

    return NextResponse.json({
      ...data,
      csRating: skillObj.csRating,
      skillScore: skillObj.score,
      skillTier: skillObj.tier,
      override
    });
  } catch (error: any) {
    if (error.message === "API_KEY_MISSING") {
      return NextResponse.json({ error: "API_KEY_MISSING" }, { status: 401 });
    }
    return NextResponse.json(
      { error: error.message || "Не удалось загрузить профиль игрока" },
      { status: error.status || 500 }
    );
  }
}
