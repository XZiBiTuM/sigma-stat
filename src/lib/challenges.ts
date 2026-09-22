import fs from "fs";
import path from "path";
import { getStoragePath, getPersistentPath } from "@/lib/storage";

export type ChallengeType = "TRAINING" | "COMBAT";
export type ChallengeDifficulty = "EASY" | "MEDIUM" | "HARD";

export interface ChallengeDefinition {
  id: string;
  title: string;
  description: string;
  type: ChallengeType;
  difficulty: ChallengeDifficulty;
  rewardTokens: number;
  conditionKey: string;
  targetValue: number;
}

export interface UserChallengeState {
  definition: ChallengeDefinition;
  completed: boolean;
  progress: number;
  target: number;
  completedAt?: number;
}

export interface WeeklyChallengesState {
  weekId: string; // e.g. "2026-w38" or "2026-09-22"
  weekStart: string; // ISO Tuesday 00:00:00
  weekEnd: string;   // ISO Next Tuesday 00:00:00
  isCombatWeek: boolean;
  tournamentTitle?: string;
  tournamentDate?: string;
  userChallenges: Record<string, {
    challenges: UserChallengeState[];
    generatedAt: number;
  }>;
  tokenBalances: Record<string, number>; // userId -> tokens count
  updatedAt: number;
}

const LOCAL_STORAGE_FILE = path.join(process.cwd(), "src/lib/weekly_challenges.json");
const PERSISTENT_STORAGE_FILE = path.join(process.cwd(), "..", "sigma_persistent_weekly_challenges.json");

// Pool of TRAINING challenges (fun 10x10 challenges, no demo verification)
export const TRAINING_CHALLENGES: ChallengeDefinition[] = [
  // EASY
  {
    id: "train_deagle_tuesday",
    title: "Диглер Вторника",
    description: "Сделать от 5 киллов с Desert Eagle за вечерний фан-матч 10х10",
    type: "TRAINING",
    difficulty: "EASY",
    rewardTokens: 0,
    conditionKey: "manual_fun",
    targetValue: 5
  },
  {
    id: "train_shotgun_party",
    title: "Дробовиковый беспредел",
    description: "Сыграть минимум 3 раунда только с дробовиком (XM1014 / Nova / MAG-7)",
    type: "TRAINING",
    difficulty: "EASY",
    rewardTokens: 0,
    conditionKey: "manual_fun",
    targetValue: 3
  },
  {
    id: "train_knife_master",
    title: "Шелест клинка",
    description: "Оформить 1 фраговый удар ножом в спину в матче 10х10",
    type: "TRAINING",
    difficulty: "EASY",
    rewardTokens: 0,
    conditionKey: "manual_fun",
    targetValue: 1
  },
  {
    id: "train_first_pistol",
    title: "Мастер пистолетки",
    description: "Сделать 2 фрага на пистолетном раунде с базового пистолета (USP / Glock)",
    type: "TRAINING",
    difficulty: "EASY",
    rewardTokens: 0,
    conditionKey: "manual_fun",
    targetValue: 2
  },

  // MEDIUM
  {
    id: "train_scout_head",
    title: "Снайпер без зума",
    description: "Сделать 3 хедшота с SSG 08 (Муха) за один матч 10х10",
    type: "TRAINING",
    difficulty: "MEDIUM",
    rewardTokens: 0,
    conditionKey: "manual_fun",
    targetValue: 3
  },
  {
    id: "train_zeus_shock",
    title: "Зевс-Шокер",
    description: "Успешно поразить врага электрошокером Zeus x27",
    type: "TRAINING",
    difficulty: "MEDIUM",
    rewardTokens: 0,
    conditionKey: "manual_fun",
    targetValue: 1
  },
  {
    id: "train_flasher",
    title: "Ослепительный вечер",
    description: "Ослепить более 15 игроков за карту световыми гранатами",
    type: "TRAINING",
    difficulty: "MEDIUM",
    rewardTokens: 0,
    conditionKey: "manual_fun",
    targetValue: 15
  },
  {
    id: "train_submachine",
    title: "Беги и стреляй",
    description: "Сделать 10 киллов с пистолетов-пулеметов (MP9 / MAC-10 / P90)",
    type: "TRAINING",
    difficulty: "MEDIUM",
    rewardTokens: 0,
    conditionKey: "manual_fun",
    targetValue: 10
  },

  // HARD
  {
    id: "train_ace_hunt",
    title: "Король 10х10",
    description: "Сделать квадро-килл (4k) или Эйс (5k) за один раунд на фановом вторнике",
    type: "TRAINING",
    difficulty: "HARD",
    rewardTokens: 0,
    conditionKey: "manual_fun",
    targetValue: 4
  },
  {
    id: "train_clutch_crowd",
    title: "Один против толпы",
    description: "Остаться в живых и выиграть раунд против 3 или более противников",
    type: "TRAINING",
    difficulty: "HARD",
    rewardTokens: 0,
    conditionKey: "manual_fun",
    targetValue: 3
  },
  {
    id: "train_he_grenade_kill",
    title: "Мясной взрыв",
    description: "Оформить прямое убийство осколочной гранатой HE",
    type: "TRAINING",
    difficulty: "HARD",
    rewardTokens: 0,
    conditionKey: "manual_fun",
    targetValue: 1
  }
];

// Pool of COMBAT challenges (tournament matches with real verification, gives 1 token each)
export const COMBAT_CHALLENGES: ChallengeDefinition[] = [
  // EASY (1 Token)
  {
    id: "combat_kills_15",
    title: "Турнирный отстрел",
    description: "Сделать суммарно не менее 15 убийств за турнирный матч / серию",
    type: "COMBAT",
    difficulty: "EASY",
    rewardTokens: 1,
    conditionKey: "match_kills",
    targetValue: 15
  },
  {
    id: "combat_hs_40",
    title: "Точный прицел",
    description: "Показать процент попаданий в голову (HS%) не ниже 40% на сыгранной турнирной карте",
    type: "COMBAT",
    difficulty: "EASY",
    rewardTokens: 1,
    conditionKey: "headshot_pct",
    targetValue: 40
  },
  {
    id: "combat_assists_5",
    title: "Командная поддержка",
    description: "Сделать от 5 ассистов за турнирную серию",
    type: "COMBAT",
    difficulty: "EASY",
    rewardTokens: 1,
    conditionKey: "total_assists",
    targetValue: 5
  },
  {
    id: "combat_rounds_won_10",
    title: "Боевой раунд",
    description: "Выиграть не менее 10 раундов в составе своей команды на любой карте турнира",
    type: "COMBAT",
    difficulty: "EASY",
    rewardTokens: 1,
    conditionKey: "map_rounds_won",
    targetValue: 10
  },

  // MEDIUM (1 Token)
  {
    id: "combat_kd_130",
    title: "Положительный баланс",
    description: "Завершить турнирную карту с K/D соотношением не менее 1.30",
    type: "COMBAT",
    difficulty: "MEDIUM",
    rewardTokens: 1,
    conditionKey: "map_kd",
    targetValue: 1.30
  },
  {
    id: "combat_kills_25",
    title: "Шквал огня",
    description: "Набить не менее 25 фрагов суммарно в турнирной серии",
    type: "COMBAT",
    difficulty: "MEDIUM",
    rewardTokens: 1,
    conditionKey: "match_kills",
    targetValue: 25
  },
  {
    id: "combat_util_damage_120",
    title: "Гренадер турнира",
    description: "Нанести не менее 120 урона гранатами (Utility Damage) за карту",
    type: "COMBAT",
    difficulty: "MEDIUM",
    rewardTokens: 1,
    conditionKey: "utility_damage",
    targetValue: 120
  },
  {
    id: "combat_hs_50",
    title: "Хедшот-машина",
    description: "Завершить карту с показателем попаданий в голову (HS%) 50% и выше (при от 10 фрагах)",
    type: "COMBAT",
    difficulty: "MEDIUM",
    rewardTokens: 1,
    conditionKey: "headshot_pct_min10",
    targetValue: 50
  },

  // HARD (1 Token)
  {
    id: "combat_kd_170",
    title: "Неприкасаемый",
    description: "Завершить карту с доминирующим K/D соотношением 1.70 или выше",
    type: "COMBAT",
    difficulty: "HARD",
    rewardTokens: 1,
    conditionKey: "map_kd",
    targetValue: 1.70
  },
  {
    id: "combat_multikill_4k",
    title: "Квадро-киллер",
    description: "Оформить как минимум один квадро-килл (4 фрага за раунд) или Эйс на турнире",
    type: "COMBAT",
    difficulty: "HARD",
    rewardTokens: 1,
    conditionKey: "quadro_kills",
    targetValue: 1
  },
  {
    id: "combat_clutch_master",
    title: "Клатч-мастер",
    description: "Выиграть клатч в ситуации 1v1 или 1v2 в официальном матче турнира",
    type: "COMBAT",
    difficulty: "HARD",
    rewardTokens: 1,
    conditionKey: "clutch_wins",
    targetValue: 1
  },
  {
    id: "combat_series_mvp",
    title: "Звезда матча",
    description: "Получить 4 или более MVP раундов на турнирной карте",
    type: "COMBAT",
    difficulty: "HARD",
    rewardTokens: 1,
    conditionKey: "mvp_count",
    targetValue: 4
  }
];

/**
 * Calculates current Tuesday 00:00:00 and next Tuesday 00:00:00
 */
export function getCurrentTuesdayCycle(now = new Date()): {
  weekId: string;
  start: Date;
  end: Date;
} {
  const current = new Date(now.getTime());
  // In JS: Sunday=0, Monday=1, Tuesday=2, Wednesday=3, etc.
  const day = current.getDay();
  // Distance back to previous Tuesday
  // if day === 2 (Tuesday), distance is 0 days back (today at 00:00:00)
  // if day > 2, distance is day - 2
  // if day < 2 (Sunday=0, Monday=1), distance is day + 5 (0: 5 days back, 1: 6 days back)
  const daysSinceTuesday = (day + 7 - 2) % 7;

  const start = new Date(current);
  start.setDate(current.getDate() - daysSinceTuesday);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  end.setHours(0, 0, 0, 0);

  // Format weekId like "tuesday-2026-09-22"
  const y = start.getFullYear();
  const m = String(start.getMonth() + 1).padStart(2, "0");
  const d = String(start.getDate()).padStart(2, "0");
  const weekId = `tuesday-${y}-${m}-${d}`;

  return { weekId, start, end };
}

/**
 * Checks if a tournament is scheduled for this Tuesday cycle
 */
export function checkIsCombatWeek(cycleStart: Date, cycleEnd: Date): {
  isCombat: boolean;
  title?: string;
  date?: string;
} {
  try {
    const fantasyPath = fs.existsSync(getPersistentPath("fantasy_tournament.json"))
      ? getPersistentPath("fantasy_tournament.json")
      : getStoragePath("fantasy_tournament.json");

    if (fs.existsSync(fantasyPath)) {
      const raw = fs.readFileSync(fantasyPath, "utf8");
      const data = JSON.parse(raw);
      if (data && data.startTime) {
        const tourDate = new Date(data.startTime);
        if (!isNaN(tourDate.getTime())) {
          // Check if tournament falls into this week cycle [start, end)
          if (tourDate.getTime() >= cycleStart.getTime() && tourDate.getTime() < cycleEnd.getTime()) {
            return {
              isCombat: true,
              title: data.title || "Турнир Sigma Cup",
              date: data.startTime
            };
          }
        }
      }
    }
  } catch (e) {
    console.error("Failed to check tournament status for weekly challenges:", e);
  }

  // Also check tournament_bracket.json if any
  try {
    const bracketPath = fs.existsSync(getPersistentPath("tournament_bracket.json"))
      ? getPersistentPath("tournament_bracket.json")
      : getStoragePath("tournament_bracket.json");

    if (fs.existsSync(bracketPath)) {
      const raw = fs.readFileSync(bracketPath, "utf8");
      const data = JSON.parse(raw);
      if (data?.matches?.length > 0) {
        // If bracket has upcoming scheduled matches in this week
        for (const m of data.matches) {
          if (m.scheduledTime) {
            const mDate = new Date(m.scheduledTime);
            if (!isNaN(mDate.getTime()) && mDate.getTime() >= cycleStart.getTime() && mDate.getTime() < cycleEnd.getTime()) {
              return {
                isCombat: true,
                title: data.tournamentTitle || "Sigma Tournament",
                date: m.scheduledTime
              };
            }
          }
        }
      }
    }
  } catch {}

  return { isCombat: false };
}

/**
 * Deterministic pseudo-random selection of 3 challenges (Easy, Medium, Hard)
 * based on weekId + userId seed so every user gets consistent challenges for the week.
 */
export function generateUserChallenges(
  userId: string,
  isCombat: boolean
): ChallengeDefinition[] {
  const pool = isCombat ? COMBAT_CHALLENGES : TRAINING_CHALLENGES;
  const easyPool = pool.filter(c => c.difficulty === "EASY");
  const medPool = pool.filter(c => c.difficulty === "MEDIUM");
  const hardPool = pool.filter(c => c.difficulty === "HARD");

  const hashString = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  };

  const seed = hashString(userId.toLowerCase());

  const pickEasy = easyPool[seed % easyPool.length];
  const pickMed = medPool[(seed >> 3) % medPool.length];
  const pickHard = hardPool[(seed >> 6) % hardPool.length];

  return [pickEasy, pickMed, pickHard];
}

/**
 * Storage helpers
 */
function getStorageFile(): string {
  try {
    if (fs.existsSync(PERSISTENT_STORAGE_FILE)) {
      return PERSISTENT_STORAGE_FILE;
    }
  } catch {}
  return LOCAL_STORAGE_FILE;
}

export function readWeeklyChallengesState(): WeeklyChallengesState {
  const cycle = getCurrentTuesdayCycle();
  const combatInfo = checkIsCombatWeek(cycle.start, cycle.end);

  let state: WeeklyChallengesState = {
    weekId: cycle.weekId,
    weekStart: cycle.start.toISOString(),
    weekEnd: cycle.end.toISOString(),
    isCombatWeek: combatInfo.isCombat,
    tournamentTitle: combatInfo.title,
    tournamentDate: combatInfo.date,
    userChallenges: {},
    tokenBalances: {},
    updatedAt: Date.now()
  };

  try {
    const file = getStorageFile();
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, "utf8");
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        // Keep tokenBalances across weeks
        state.tokenBalances = parsed.tokenBalances || {};

        // If week changed, reset or archive challenges
        if (parsed.weekId === cycle.weekId) {
          state.userChallenges = parsed.userChallenges || {};
        }
      }
    }
  } catch (e) {
    console.error("Failed to read weekly challenges state:", e);
  }

  return state;
}

export function writeWeeklyChallengesState(state: WeeklyChallengesState): void {
  try {
    const dir = path.dirname(LOCAL_STORAGE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    state.updatedAt = Date.now();
    const json = JSON.stringify(state, null, 2);

    fs.writeFileSync(LOCAL_STORAGE_FILE, json, "utf8");
    try {
      fs.writeFileSync(PERSISTENT_STORAGE_FILE, json, "utf8");
    } catch {}
  } catch (e) {
    console.error("Failed to write weekly challenges state:", e);
  }
}

/**
 * Get or initialize user challenges for the current week
 */
export function getUserWeeklyChallenges(
  userId: string,
  state: WeeklyChallengesState
): UserChallengeState[] {
  const normalizedUser = (userId || "guest").toLowerCase();
  const existing = state.userChallenges[normalizedUser];

  if (existing && Array.isArray(existing.challenges) && existing.challenges.length === 3) {
    return existing.challenges;
  }

  // Generate new
  const defs = generateUserChallenges(normalizedUser, state.isCombatWeek);
  const newChallenges: UserChallengeState[] = defs.map(def => ({
    definition: def,
    completed: false,
    progress: 0,
    target: def.targetValue
  }));

  state.userChallenges[normalizedUser] = {
    challenges: newChallenges,
    generatedAt: Date.now()
  };

  writeWeeklyChallengesState(state);
  return newChallenges;
}

/**
 * Evaluates match statistics for player and updates challenge completion
 */
export function verifyUserCombatChallenges(
  playerKeys: string[], // [faceitId, nickname, steamId]
  state: WeeklyChallengesState
): {
  updatedChallenges: UserChallengeState[];
  tokensAwarded: number;
  message: string;
} {
  const primaryKey = (playerKeys[0] || "guest").toLowerCase();
  const userObj = state.userChallenges[primaryKey] || {
    challenges: getUserWeeklyChallenges(primaryKey, state),
    generatedAt: Date.now()
  };

  let tokensAwarded = 0;
  if (!state.isCombatWeek) {
    return {
      updatedChallenges: userObj.challenges,
      tokensAwarded: 0,
      message: "Текущая неделя — тренировочная (10х10). Жетоны начисляются только в боевые недели турниров!"
    };
  }

  // Read match cache & custom matches to find matches during this cycle
  const cycleStart = new Date(state.weekStart).getTime();
  const cycleEnd = new Date(state.weekEnd).getTime();

  let matchesList: any[] = [];

  // 1. Custom matches
  try {
    const cmPath = fs.existsSync(getPersistentPath("custom_matches.json"))
      ? getPersistentPath("custom_matches.json")
      : getStoragePath("custom_matches.json");
    if (fs.existsSync(cmPath)) {
      const cmRaw = fs.readFileSync(cmPath, "utf8");
      const list = JSON.parse(cmRaw);
      if (Array.isArray(list)) {
        matchesList.push(...list);
      }
    }
  } catch {}

  // 2. FACEIT match cache
  try {
    const cachePath = fs.existsSync(getPersistentPath("match_stats_cache.json"))
      ? getPersistentPath("match_stats_cache.json")
      : getStoragePath("match_stats_cache.json");
    if (fs.existsSync(cachePath)) {
      const cRaw = fs.readFileSync(cachePath, "utf8");
      const cObj = JSON.parse(cRaw);
      for (const [mId, mData] of Object.entries(cObj as Record<string, any>)) {
        if (mData) matchesList.push({ match_id: mId, ...mData });
      }
    }
  } catch {}

  // Filter matches within current week cycle
  const relevantMatches = matchesList.filter((m: any) => {
    let t = m.finished_at || m.started_at || m.created_at;
    if (t && t < 10000000000) t = t * 1000;
    return t && t >= cycleStart && t <= cycleEnd;
  });

  // Extract all round stats for the player in relevant matches
  const normalizedKeys = playerKeys.map(k => (k || "").toLowerCase()).filter(Boolean);

  let totalMatchKills = 0;
  let totalAssists = 0;
  let maxMapKd = 0;
  let maxMapHsPct = 0;
  let maxMapHsPctMin10 = 0;
  let maxMapRoundsWon = 0;
  let maxUtilityDamage = 0;
  let totalQuadroKills = 0;
  let totalClutchWins = 0;
  let maxMvps = 0;

  for (const match of relevantMatches) {
    // Check maps / rounds
    const rounds = match.rounds || (match.mapBreakdown ? match.mapBreakdown.map((mb: any) => ({
      round_stats: { Map: mb.map, Score: `${mb.score1}:${mb.score2}` },
      teams: [
        { team_id: "team1", team_stats: { TeamWin: mb.score1 > mb.score2 ? "1" : "0" }, players: mb.players1 || [] },
        { team_id: "team2", team_stats: { TeamWin: mb.score2 > mb.score1 ? "1" : "0" }, players: mb.players2 || [] }
      ]
    })) : []);

    let matchKillsSum = 0;

    for (const r of rounds) {
      for (const t of r.teams || []) {
        for (const p of t.players || []) {
          const pid = (p.player_id || p.id || "").toLowerCase();
          const pNick = (p.nickname || p.name || "").toLowerCase();

          const isTarget = normalizedKeys.some(k => k === pid || k === pNick);
          if (isTarget) {
            const st = p.player_stats || p;
            const kills = parseInt(st.Kills || st.kills || "0", 10);
            const deaths = parseInt(st.Deaths || st.deaths || "0", 10);
            const assists = parseInt(st.Assists || st.assists || "0", 10);
            const hs = parseInt(st.Headshots || st.headshots || "0", 10);
            const mvps = parseInt(st.MVPs || st.mvps || "0", 10);
            const quadros = parseInt(st.quadros || "0", 10) + parseInt(st.pentas || "0", 10);
            const clutches = (st.clutch1v1Wins || 0) + (st.clutch1v2Wins || 0) + (st.clutchKills || 0);
            const utilDmg = parseInt(st.utilityDamage || "0", 10);

            matchKillsSum += kills;
            totalAssists += assists;
            totalQuadroKills += quadros;
            totalClutchWins += clutches;
            if (mvps > maxMvps) maxMvps = mvps;
            if (utilDmg > maxUtilityDamage) maxUtilityDamage = utilDmg;

            const kd = deaths > 0 ? kills / deaths : kills;
            if (kd > maxMapKd) maxMapKd = kd;

            const hsPct = kills > 0 ? (hs / kills) * 100 : 0;
            if (hsPct > maxMapHsPct) maxMapHsPct = hsPct;
            if (kills >= 10 && hsPct > maxMapHsPctMin10) maxMapHsPctMin10 = hsPct;

            // Rounds won on this map
            const isWin = t.team_stats?.TeamWin === "1" || t.team_stats?.["Team Win"] === "1";
            if (isWin) {
              const scoreStr = r.round_stats?.Score || "13:0";
              const parts = scoreStr.split(/[:/]/).map((s: string) => parseInt(s.trim(), 10));
              const wonRounds = Math.max(parts[0] || 0, parts[1] || 0);
              if (wonRounds > maxMapRoundsWon) maxMapRoundsWon = wonRounds;
            }
          }
        }
      }
    }

    if (matchKillsSum > totalMatchKills) {
      totalMatchKills = matchKillsSum;
    }
  }

  // Evaluate each of the 3 user challenges
  userObj.challenges.forEach(c => {
    if (c.completed) return;

    let progress = 0;
    const key = c.definition.conditionKey;

    switch (key) {
      case "match_kills":
        progress = totalMatchKills;
        break;
      case "headshot_pct":
        progress = Math.round(maxMapHsPct);
        break;
      case "headshot_pct_min10":
        progress = Math.round(maxMapHsPctMin10);
        break;
      case "total_assists":
        progress = totalAssists;
        break;
      case "map_rounds_won":
        progress = maxMapRoundsWon;
        break;
      case "map_kd":
        progress = Number(maxMapKd.toFixed(2));
        break;
      case "utility_damage":
        progress = maxUtilityDamage;
        break;
      case "quadro_kills":
        progress = totalQuadroKills;
        break;
      case "clutch_wins":
        progress = totalClutchWins;
        break;
      case "mvp_count":
        progress = maxMvps;
        break;
      default:
        progress = 0;
    }

    c.progress = progress;

    if (progress >= c.target) {
      c.completed = true;
      c.completedAt = Date.now();
      const reward = c.definition.rewardTokens || 1;
      tokensAwarded += reward;

      // Add to player's persistent token balance
      state.tokenBalances[primaryKey] = (state.tokenBalances[primaryKey] || 0) + reward;
      normalizedKeys.forEach(k => {
        state.tokenBalances[k] = state.tokenBalances[primaryKey];
      });
    }
  });

  state.userChallenges[primaryKey] = userObj;
  writeWeeklyChallengesState(state);

  let message = "";
  if (tokensAwarded > 0) {
    message = `Поздравляем! Выполнено заданий: ${tokensAwarded}. Начислено жетонов: +${tokensAwarded} 🪙!`;
  } else {
    message = "Проверка завершена. Новых выполненных боевых заданий пока не найдено. Сыграйте в матчах турнира!";
  }

  return {
    updatedChallenges: userObj.challenges,
    tokensAwarded,
    message
  };
}
