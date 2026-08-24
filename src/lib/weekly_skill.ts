import { getStoragePath, getPersistentPath } from "@/lib/storage";
import { computeAdaptiveSkillScore } from "@/lib/skill";
import { promises as fs } from "fs";
import fsSync from "fs";

export interface PlayerWeeklyRecord {
  playerId: string;
  nickname: string;
  currentScore: number;
  previousScore: number;
  weeklyDelta: number;
  tier: string;
  color: string;
  updatedWeek: string;
  updatedAt: string;
  faceitElo?: number;
  matchesInWeek?: number;
}

export interface WeeklySkillData {
  currentWeek: string;
  lastRecalibratedAt: string;
  players: Record<string, PlayerWeeklyRecord>;
}

export function getISOWeekKey(d: Date = new Date()): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export function getWeeklySkillFilePath(): string {
  const pPath = getPersistentPath("weekly_skill_snapshots.json");
  const sPath = getStoragePath("weekly_skill_snapshots.json");
  return fsSync.existsSync(pPath) ? pPath : sPath;
}

export async function loadWeeklySkillData(): Promise<WeeklySkillData> {
  const currentWeek = getISOWeekKey();
  const defaultData: WeeklySkillData = {
    currentWeek,
    lastRecalibratedAt: new Date().toISOString(),
    players: {}
  };

  try {
    const filePath = getWeeklySkillFilePath();
    if (fsSync.existsSync(filePath)) {
      const content = await fs.readFile(filePath, "utf8");
      const parsed = JSON.parse(content || "{}");
      if (parsed && typeof parsed === "object") {
        return {
          currentWeek: parsed.currentWeek || currentWeek,
          lastRecalibratedAt: parsed.lastRecalibratedAt || new Date().toISOString(),
          players: parsed.players || {}
        };
      }
    }
  } catch (e) {
    console.warn("Failed to load weekly skill snapshots:", e);
  }

  return defaultData;
}

export async function saveWeeklySkillData(data: WeeklySkillData): Promise<void> {
  try {
    const pPath = getPersistentPath("weekly_skill_snapshots.json");
    const sPath = getStoragePath("weekly_skill_snapshots.json");
    const jsonStr = JSON.stringify(data, null, 2);
    
    // Save to persistent path first
    try {
      await fs.writeFile(pPath, jsonStr, "utf8");
    } catch {}
    
    // Also save to storage path
    try {
      await fs.writeFile(sPath, jsonStr, "utf8");
    } catch {}
  } catch (e) {
    console.error("Failed to save weekly skill snapshots:", e);
  }
}

export async function performWeeklyRecalibration(force: boolean = false): Promise<{
  updated: boolean;
  currentWeek: string;
  playerCount: number;
}> {
  const currentWeekKey = getISOWeekKey();
  const data = await loadWeeklySkillData();

  const isNewWeek = data.currentWeek !== currentWeekKey;
  if (!isNewWeek && !force && Object.keys(data.players).length > 0) {
    return {
      updated: false,
      currentWeek: data.currentWeek,
      playerCount: Object.keys(data.players).length
    };
  }

  // Load match cache & overrides to compute fresh scores
  let cacheData: Record<string, any> = {};
  try {
    const cachePath = fsSync.existsSync(getPersistentPath("match_stats_cache.json"))
      ? getPersistentPath("match_stats_cache.json")
      : getStoragePath("match_stats_cache.json");
    if (fsSync.existsSync(cachePath)) {
      cacheData = JSON.parse(await fs.readFile(cachePath, "utf8") || "{}");
    }
  } catch {}

  let overrides: Record<string, any> = {};
  try {
    const ovPath = fsSync.existsSync(getPersistentPath("player_overrides.json"))
      ? getPersistentPath("player_overrides.json")
      : getStoragePath("player_overrides.json");
    if (fsSync.existsSync(ovPath)) {
      overrides = JSON.parse(await fs.readFile(ovPath, "utf8") || "{}");
    }
  } catch {}

  // Aggregate stats per player
  const playerStats: Record<string, {
    id: string;
    nickname: string;
    kills: number;
    deaths: number;
    damage: number;
    rounds: number;
    headshots: number;
    matches: number;
    wins: number;
    hltvSum: number;
  }> = {};

  for (const match of Object.values(cacheData) as any[]) {
    if (!match?.rounds) continue;
    for (const round of match.rounds) {
      for (const t of round.teams || []) {
        for (const p of t.players || []) {
          const pid = p.player_id || p.user_id || p.id;
          const nick = p.nickname;
          if (!nick) continue;

          const key = (pid || nick).toLowerCase();
          if (!playerStats[key]) {
            playerStats[key] = {
              id: pid || "",
              nickname: nick,
              kills: 0,
              deaths: 0,
              damage: 0,
              rounds: 0,
              headshots: 0,
              matches: 0,
              wins: 0,
              hltvSum: 0
            };
          }

          const st = p.player_stats || {};
          const k = parseInt(st.Kills || "0", 10);
          const d = parseInt(st.Deaths || "0", 10);
          const dmg = parseInt(st.Damage || "0", 10);
          const hs = parseInt(st.Headshots || "0", 10);
          const rnds = parseInt(round.round_stats?.Rounds || "22", 10);
          const isWin = Boolean(round.round_stats?.Winner && t.team_id === round.round_stats?.Winner);
          const hltv = parseFloat(st["HLTV 2.0 Rating"] || st["Rating"] || "1.0") || 1.0;

          playerStats[key].kills += k;
          playerStats[key].deaths += d;
          playerStats[key].damage += dmg;
          playerStats[key].headshots += hs;
          playerStats[key].rounds += rnds;
          playerStats[key].hltvSum += hltv;
          playerStats[key].matches++;
          if (isWin) playerStats[key].wins++;
        }
      }
    }
  }

  const updatedPlayers: Record<string, PlayerWeeklyRecord> = {};

  for (const [key, p] of Object.entries(playerStats)) {
    const existing = data.players[key] || data.players[p.id] || data.players[p.nickname.toLowerCase()] || data.players[p.nickname];
    const ov = overrides[p.id] || overrides[p.nickname] || overrides[p.nickname.toLowerCase()] || {};

    const kd = p.deaths > 0 ? p.kills / p.deaths : p.kills;
    const adr = p.rounds > 0 ? p.damage / p.rounds : 75;
    const hsPct = p.kills > 0 ? (p.headshots / p.kills) * 100 : 45;
    const avgKills = p.matches > 0 ? p.kills / p.matches : 16;
    const winrate = p.matches > 0 ? (p.wins / p.matches) * 100 : 50;
    const hltv = p.matches > 0 ? p.hltvSum / p.matches : 1.0;

    const baseElo = ov.customElo || 1200;
    const skillRes = computeAdaptiveSkillScore({
      playerId: p.id,
      nickname: p.nickname,
      elo: baseElo,
      combatStats: {
        kd,
        adr,
        hltv,
        avgKills,
        hsPct,
        winrate,
        matchesCount: p.matches
      },
      overrides: ov
    });

    const currentScore = skillRes.score;
    // If it's a new week, the previous week's score is existing.currentScore; otherwise preserve existing.previousScore
    const previousScore = isNewWeek ? (existing?.currentScore ?? currentScore) : (existing?.previousScore ?? currentScore);
    const weeklyDelta = currentScore - previousScore;

    const record: PlayerWeeklyRecord = {
      playerId: p.id,
      nickname: p.nickname,
      currentScore,
      previousScore,
      weeklyDelta,
      tier: skillRes.tier,
      color: skillRes.color,
      updatedWeek: currentWeekKey,
      updatedAt: new Date().toISOString(),
      faceitElo: baseElo,
      matchesInWeek: p.matches
    };

    if (p.id) updatedPlayers[p.id] = record;
    if (p.nickname) {
      updatedPlayers[p.nickname] = record;
      updatedPlayers[p.nickname.toLowerCase()] = record;
    }
  }

  const newWeeklyData: WeeklySkillData = {
    currentWeek: currentWeekKey,
    lastRecalibratedAt: new Date().toISOString(),
    players: updatedPlayers
  };

  await saveWeeklySkillData(newWeeklyData);

  return {
    updated: true,
    currentWeek: currentWeekKey,
    playerCount: Object.keys(updatedPlayers).length
  };
}
