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

export interface UserChallengeRecord {
  challenges: UserChallengeState[];
  generatedAt: number;
  rerollsRemaining: number;
}

export interface WeeklyChallengesState {
  weekId: string; // e.g. "2026-w38" or "2026-09-22"
  weekStart: string; // ISO Tuesday 00:00:00
  weekEnd: string;   // ISO Next Tuesday 00:00:00
  isCombatWeek: boolean;
  tournamentTitle?: string;
  tournamentDate?: string;
  userChallenges: Record<string, UserChallengeRecord>;
  tokenBalances: Record<string, number>; // userId -> tokens count
  updatedAt: number;
}

const LOCAL_STORAGE_FILE = path.join(process.cwd(), "src/lib/weekly_challenges.json");
const PERSISTENT_STORAGE_FILE = path.join(process.cwd(), "..", "sigma_persistent_weekly_challenges.json");

// Pool of TRAINING challenges (10x10 matches, 10 Easy, 10 Medium, 10 Hard)
export const TRAINING_CHALLENGES: ChallengeDefinition[] = [
  // EASY (10 challenges)
  {
    id: "train_deagle_tuesday",
    title: "Desert Eagle Outlaw",
    description: "Сделать не менее 10 киллов с Desert Eagle за матч 10х10",
    type: "TRAINING",
    difficulty: "EASY",
    rewardTokens: 0,
    conditionKey: "manual_fun",
    targetValue: 10
  },
  {
    id: "train_shotgun_party",
    title: "Heavy Buckshot",
    description: "Сыграть не менее 6 раундов только с дробовиком (XM1014 / Nova / MAG-7)",
    type: "TRAINING",
    difficulty: "EASY",
    rewardTokens: 0,
    conditionKey: "manual_fun",
    targetValue: 6
  },
  {
    id: "train_knife_master",
    title: "Silent Backstabber",
    description: "Сделать 2 килла ножом в спину в матчах 10х10",
    type: "TRAINING",
    difficulty: "EASY",
    rewardTokens: 0,
    conditionKey: "manual_fun",
    targetValue: 2
  },
  {
    id: "train_first_pistol",
    title: "Pistolero",
    description: "Сделать 3 килла на пистолетном раунде с базового пистолета (USP / Glock)",
    type: "TRAINING",
    difficulty: "EASY",
    rewardTokens: 0,
    conditionKey: "manual_fun",
    targetValue: 3
  },
  {
    id: "train_mp9_rush",
    title: "Blitzkrieg Runner",
    description: "Сделать 8 быстрых киллов с MP9 или MAC-10 на раннем тайминге раунда",
    type: "TRAINING",
    difficulty: "EASY",
    rewardTokens: 0,
    conditionKey: "manual_fun",
    targetValue: 8
  },
  {
    id: "train_p250_force",
    title: "Eco Armor Piercer",
    description: "Сделать 6 киллов за вечер с P250 или Five-SeveN в раундах форс-бая",
    type: "TRAINING",
    difficulty: "EASY",
    rewardTokens: 0,
    conditionKey: "manual_fun",
    targetValue: 6
  },
  {
    id: "train_smoke_defuse",
    title: "Ghost Ninja Defuse",
    description: "Разминировать бомбу внутри дымовой завесы в матче 10х10",
    type: "TRAINING",
    difficulty: "EASY",
    rewardTokens: 0,
    conditionKey: "manual_fun",
    targetValue: 1
  },
  {
    id: "train_molotov_tag",
    title: "Flame Inquisitor",
    description: "Нанести урон коктейлем Молотова или зажигалкой минимум 6 противникам за матч",
    type: "TRAINING",
    difficulty: "EASY",
    rewardTokens: 0,
    conditionKey: "manual_fun",
    targetValue: 6
  },
  {
    id: "train_galil_famas",
    title: "Budget Rifleman",
    description: "Сделать не менее 12 киллов с бюджетных винтовок Galil AR или FAMAS за матч",
    type: "TRAINING",
    difficulty: "EASY",
    rewardTokens: 0,
    conditionKey: "manual_fun",
    targetValue: 12
  },
  {
    id: "train_dual_barettas",
    title: "Dual Gunslinger",
    description: "Сделать 4 килла со стрельбы по-македонски из Dual Berettas за матч",
    type: "TRAINING",
    difficulty: "EASY",
    rewardTokens: 0,
    conditionKey: "manual_fun",
    targetValue: 4
  },

  // MEDIUM (10 challenges)
  {
    id: "train_scout_head",
    title: "Scout Headhunter",
    description: "Сделать 6 хедшотов с SSG 08 (Муха) за один матч 10х10",
    type: "TRAINING",
    difficulty: "MEDIUM",
    rewardTokens: 0,
    conditionKey: "manual_fun",
    targetValue: 6
  },
  {
    id: "train_zeus_shock",
    title: "High Voltage Shock",
    description: "Оформить 2 успешных поражения электрошокером Zeus x27 за вечер",
    type: "TRAINING",
    difficulty: "MEDIUM",
    rewardTokens: 0,
    conditionKey: "manual_fun",
    targetValue: 2
  },
  {
    id: "train_flasher",
    title: "Flashbang Maestro",
    description: "Ослепить более 30 игроков за карту световыми гранатами",
    type: "TRAINING",
    difficulty: "MEDIUM",
    rewardTokens: 0,
    conditionKey: "manual_fun",
    targetValue: 30
  },
  {
    id: "train_submachine",
    title: "SMG Spray Down",
    description: "Сделать 20 киллов с пистолетов-пулеметов (MP9 / MAC-10 / P90)",
    type: "TRAINING",
    difficulty: "MEDIUM",
    rewardTokens: 0,
    conditionKey: "manual_fun",
    targetValue: 20
  },
  {
    id: "train_negev_hold",
    title: "Lead Wall Suppressor",
    description: "Зажать точку с пулемета Negev и сделать 4 килла за один раунд",
    type: "TRAINING",
    difficulty: "MEDIUM",
    rewardTokens: 0,
    conditionKey: "manual_fun",
    targetValue: 4
  },
  {
    id: "train_jump_scout",
    title: "Acrobatic Marksman",
    description: "Сделать 2 убийства с SSG 08 в прыжке (Jump Shot) за матч",
    type: "TRAINING",
    difficulty: "MEDIUM",
    rewardTokens: 0,
    conditionKey: "manual_fun",
    targetValue: 2
  },
  {
    id: "train_revolver_cowboy",
    title: "R8 Wild West",
    description: "Сделать 6 хедшотов с револьвера R8 за вечер 10х10",
    type: "TRAINING",
    difficulty: "MEDIUM",
    rewardTokens: 0,
    conditionKey: "manual_fun",
    targetValue: 6
  },
  {
    id: "train_awp_flick",
    title: "Glass Cannon Sniper",
    description: "Сделать 12 фрагов с AWP за один матч без покупки брони",
    type: "TRAINING",
    difficulty: "MEDIUM",
    rewardTokens: 0,
    conditionKey: "manual_fun",
    targetValue: 12
  },
  {
    id: "train_wallbang",
    title: "Wallbang Specialist",
    description: "Сделать 4 убийства прострелом через стены, двери или ящики за матч",
    type: "TRAINING",
    difficulty: "MEDIUM",
    rewardTokens: 0,
    conditionKey: "manual_fun",
    targetValue: 4
  },
  {
    id: "train_no_scope",
    title: "No-Scope Assassin",
    description: "Сделать 2 килла с AWP или SSG 08 без использования прицела навскидку",
    type: "TRAINING",
    difficulty: "MEDIUM",
    rewardTokens: 0,
    conditionKey: "manual_fun",
    targetValue: 2
  },

  // HARD (10 challenges)
  {
    id: "train_ace_hunt",
    title: "Overkill Ace Breaker",
    description: "Сделать 5 киллов (полноценный Эйс) или 6+ киллов за один раунд в матче 10х10",
    type: "TRAINING",
    difficulty: "HARD",
    rewardTokens: 0,
    conditionKey: "manual_fun",
    targetValue: 5
  },
  {
    id: "train_clutch_crowd",
    title: "Lone Wolf Standing",
    description: "Выиграть раунд, оставшись в одиночку против 4 или более противников",
    type: "TRAINING",
    difficulty: "HARD",
    rewardTokens: 0,
    conditionKey: "manual_fun",
    targetValue: 4
  },
  {
    id: "train_he_grenade_kill",
    title: "Demolition Impact",
    description: "Сделать 2 килла прямым взрывом осколочных гранат HE за один матч",
    type: "TRAINING",
    difficulty: "HARD",
    rewardTokens: 0,
    conditionKey: "manual_fun",
    targetValue: 2
  },
  {
    id: "train_knife_duel",
    title: "Blade Warlord",
    description: "Выиграть 2 ножевые дуэли 1v1 в концовках раундов за вечер",
    type: "TRAINING",
    difficulty: "HARD",
    rewardTokens: 0,
    conditionKey: "manual_fun",
    targetValue: 2
  },
  {
    id: "train_deagle_one_tap",
    title: "Triple One-Tap",
    description: "Оформить 3 хедшота подряд с Desert Eagle в одном раунде",
    type: "TRAINING",
    difficulty: "HARD",
    rewardTokens: 0,
    conditionKey: "manual_fun",
    targetValue: 3
  },
  {
    id: "train_double_zeus",
    title: "Thunderbolt Master",
    description: "Оформить 3 успешных фрага шокером Zeus x27 за один вечер",
    type: "TRAINING",
    difficulty: "HARD",
    rewardTokens: 0,
    conditionKey: "manual_fun",
    targetValue: 3
  },
  {
    id: "train_mag7_jump",
    title: "Airborne Shotgunner",
    description: "Сделать 5 фрагов в прыжке с дробовика MAG-7 за матч 10х10",
    type: "TRAINING",
    difficulty: "HARD",
    rewardTokens: 0,
    conditionKey: "manual_fun",
    targetValue: 5
  },
  {
    id: "train_molotov_kill",
    title: "Hellfire Incineration",
    description: "Уничтожить 2 врагов насмерть огнем от коктейля Молотова за матч",
    type: "TRAINING",
    difficulty: "HARD",
    rewardTokens: 0,
    conditionKey: "manual_fun",
    targetValue: 2
  },
  {
    id: "train_smoke_kill_blind",
    title: "Blind Smoke Demon",
    description: "Убить 3 врагов сквозь плотный дым без прямой видимости за раунд",
    type: "TRAINING",
    difficulty: "HARD",
    rewardTokens: 0,
    conditionKey: "manual_fun",
    targetValue: 3
  },
  {
    id: "train_flawless_round",
    title: "Untouchable Slayer",
    description: "Сделать 4 килла за раунд и выжить с полными 100 HP",
    type: "TRAINING",
    difficulty: "HARD",
    rewardTokens: 0,
    conditionKey: "manual_fun",
    targetValue: 4
  }
];

// Pool of COMBAT challenges (tournament matches with real verification, gives 1 token each)
// 10 Easy, 10 Medium, 10 Hard (30 total)
export const COMBAT_CHALLENGES: ChallengeDefinition[] = [
  // EASY (1 Token, 10 challenges)
  {
    id: "combat_kills_15",
    title: "Apex Fragger",
    description: "Сделать суммарно не менее 22 убийств за турнирный матч / серию",
    type: "COMBAT",
    difficulty: "EASY",
    rewardTokens: 1,
    conditionKey: "match_kills",
    targetValue: 22
  },
  {
    id: "combat_hs_40",
    title: "Headshot Precision",
    description: "Показать процент попаданий в голову (HS%) не ниже 48% на сыгранной турнирной карте",
    type: "COMBAT",
    difficulty: "EASY",
    rewardTokens: 1,
    conditionKey: "headshot_pct",
    targetValue: 48
  },
  {
    id: "combat_assists_5",
    title: "Tactical Wingman",
    description: "Сделать от 7 ассистов за турнирную серию",
    type: "COMBAT",
    difficulty: "EASY",
    rewardTokens: 1,
    conditionKey: "total_assists",
    targetValue: 7
  },
  {
    id: "combat_rounds_won_10",
    title: "Map Conqueror",
    description: "Выиграть не менее 13 раундов в составе своей команды на любой карте турнира",
    type: "COMBAT",
    difficulty: "EASY",
    rewardTokens: 1,
    conditionKey: "map_rounds_won",
    targetValue: 13
  },
  {
    id: "combat_first_map_win",
    title: "Dominant Decider",
    description: "Выиграть карту с отрывом в 13+ взятых раундов в составе команды",
    type: "COMBAT",
    difficulty: "EASY",
    rewardTokens: 1,
    conditionKey: "map_rounds_won",
    targetValue: 13
  },
  {
    id: "combat_kd_100",
    title: "Battlefront Ratio",
    description: "Завершить турнирную карту с положительным K/D не менее 1.05 (при от 10 фрагах)",
    type: "COMBAT",
    difficulty: "EASY",
    rewardTokens: 1,
    conditionKey: "map_kd",
    targetValue: 1.05
  },
  {
    id: "combat_mvp_1",
    title: "MVP Spark",
    description: "Заработать не менее 2 звезд лучшего игрока раунда (MVP) на карте турнира",
    type: "COMBAT",
    difficulty: "EASY",
    rewardTokens: 1,
    conditionKey: "mvp_count",
    targetValue: 2
  },
  {
    id: "combat_headshots_8",
    title: "Skull Collector",
    description: "Оформить не менее 12 хедшотов за одну турнирную карту",
    type: "COMBAT",
    difficulty: "EASY",
    rewardTokens: 1,
    conditionKey: "map_headshots",
    targetValue: 12
  },
  {
    id: "combat_util_damage_60",
    title: "Artillery Barrage",
    description: "Нанести не менее 100 урона гранатами (Utility Damage) за карту турнира",
    type: "COMBAT",
    difficulty: "EASY",
    rewardTokens: 1,
    conditionKey: "utility_damage",
    targetValue: 100
  },
  {
    id: "combat_series_kills_20",
    title: "Series Firepower",
    description: "Набить не менее 26 фрагов суммарно за турнирную серию",
    type: "COMBAT",
    difficulty: "EASY",
    rewardTokens: 1,
    conditionKey: "match_kills",
    targetValue: 26
  },

  // MEDIUM (1 Token, 10 challenges)
  {
    id: "combat_kd_130",
    title: "Lethal Efficiency",
    description: "Завершить турнирную карту с K/D соотношением не менее 1.25 (при от 12 фрагах)",
    type: "COMBAT",
    difficulty: "MEDIUM",
    rewardTokens: 1,
    conditionKey: "map_kd",
    targetValue: 1.25
  },
  {
    id: "combat_kills_25",
    title: "Bullet Storm",
    description: "Набить не менее 35 фрагов суммарно в турнирной серии",
    type: "COMBAT",
    difficulty: "MEDIUM",
    rewardTokens: 1,
    conditionKey: "match_kills",
    targetValue: 35
  },
  {
    id: "combat_util_damage_120",
    title: "Combat Grenadier",
    description: "Нанести не менее 180 урона гранатами (Utility Damage) за турнирную карту",
    type: "COMBAT",
    difficulty: "MEDIUM",
    rewardTokens: 1,
    conditionKey: "utility_damage",
    targetValue: 180
  },
  {
    id: "combat_hs_50",
    title: "Cybernetic Aim",
    description: "Завершить карту с показателем попаданий в голову (HS%) 56% и выше (при от 12 фрагах)",
    type: "COMBAT",
    difficulty: "MEDIUM",
    rewardTokens: 1,
    conditionKey: "headshot_pct_min10",
    targetValue: 56
  },
  {
    id: "combat_assists_8",
    title: "Squad Strategist",
    description: "Набрать не менее 11 результативных ассистов за турнирный матч",
    type: "COMBAT",
    difficulty: "MEDIUM",
    rewardTokens: 1,
    conditionKey: "total_assists",
    targetValue: 11
  },
  {
    id: "combat_mvp_3",
    title: "Frontline Star",
    description: "Заработать не менее 4 MVP раундов на одной турнирной карте",
    type: "COMBAT",
    difficulty: "MEDIUM",
    rewardTokens: 1,
    conditionKey: "mvp_count",
    targetValue: 4
  },
  {
    id: "combat_single_map_kills_18",
    title: "Heavy Impact Fragger",
    description: "Сделать не менее 22 фрагов на одной конкретной карте турнира",
    type: "COMBAT",
    difficulty: "MEDIUM",
    rewardTokens: 1,
    conditionKey: "max_single_map_kills",
    targetValue: 22
  },
  {
    id: "combat_headshots_14",
    title: "Surgical Executioner",
    description: "Сделать не менее 18 хедшотов за одну турнирную карту",
    type: "COMBAT",
    difficulty: "MEDIUM",
    rewardTokens: 1,
    conditionKey: "map_headshots",
    targetValue: 18
  },
  {
    id: "combat_kd_150",
    title: "Tactical Dominator",
    description: "Завершить карту с K/D 1.40 или выше (при не менее 12 фрагах)",
    type: "COMBAT",
    difficulty: "MEDIUM",
    rewardTokens: 1,
    conditionKey: "map_kd",
    targetValue: 1.40
  },
  {
    id: "combat_series_kills_30",
    title: "Series Annihilator",
    description: "Набрать суммарно 42 или более фрагов за турнирную серию",
    type: "COMBAT",
    difficulty: "MEDIUM",
    rewardTokens: 1,
    conditionKey: "match_kills",
    targetValue: 42
  },

  // HARD (1 Token, 10 challenges)
  {
    id: "combat_kd_170",
    title: "Untouchable Godmode",
    description: "Завершить турнирную карту с доминирующим K/D соотношением 1.55 или выше (при от 14 фрагах)",
    type: "COMBAT",
    difficulty: "HARD",
    rewardTokens: 1,
    conditionKey: "map_kd",
    targetValue: 1.55
  },
  {
    id: "combat_multikill_4k",
    title: "Quad-Kill Rampage",
    description: "Оформить как минимум один квадро-килл (4 фрага за раунд) или Эйс на турнире",
    type: "COMBAT",
    difficulty: "HARD",
    rewardTokens: 1,
    conditionKey: "quadro_kills",
    targetValue: 1
  },
  {
    id: "combat_clutch_master",
    title: "Clutch Warlord",
    description: "Выиграть клатч в ситуации 1v1 или 1v2 в официальном матче турнира",
    type: "COMBAT",
    difficulty: "HARD",
    rewardTokens: 1,
    conditionKey: "clutch_wins",
    targetValue: 1
  },
  {
    id: "combat_series_mvp",
    title: "Match MVP Phenom",
    description: "Получить 6 или более MVP раундов на турнирной карте",
    type: "COMBAT",
    difficulty: "HARD",
    rewardTokens: 1,
    conditionKey: "mvp_count",
    targetValue: 6
  },
  {
    id: "combat_kills_38",
    title: "Total Apex Carnage",
    description: "Набрать 50 или более фрагов суммарно за серию матчей турнира",
    type: "COMBAT",
    difficulty: "HARD",
    rewardTokens: 1,
    conditionKey: "match_kills",
    targetValue: 50
  },
  {
    id: "combat_single_map_kills_24",
    title: "One-Man Army",
    description: "Оформить от 28 убийств на одной турнирной карте",
    type: "COMBAT",
    difficulty: "HARD",
    rewardTokens: 1,
    conditionKey: "max_single_map_kills",
    targetValue: 28
  },
  {
    id: "combat_hs_60",
    title: "Deadeye Sniper",
    description: "Показать процент попаданий в голову 65% и выше при 18+ фрагах на карте",
    type: "COMBAT",
    difficulty: "HARD",
    rewardTokens: 1,
    conditionKey: "headshot_pct_min15",
    targetValue: 65
  },
  {
    id: "combat_kd_200",
    title: "Apex Predator",
    description: "Завершить турнирную карту с превосходным K/D 1.75 или выше (при от 15 фрагах)",
    type: "COMBAT",
    difficulty: "HARD",
    rewardTokens: 1,
    conditionKey: "map_kd",
    targetValue: 1.75
  },
  {
    id: "combat_util_damage_200",
    title: "Heavy Artillery Siege",
    description: "Нанести не менее 280 урона гранатами (Utility Damage) на турнирной карте",
    type: "COMBAT",
    difficulty: "HARD",
    rewardTokens: 1,
    conditionKey: "utility_damage",
    targetValue: 280
  },
  {
    id: "combat_double_clutch",
    title: "Cold-Blooded Clutch King",
    description: "Выиграть суммарно не менее 3 клатчей (1v1 или 1v2) за турнирный матч",
    type: "COMBAT",
    difficulty: "HARD",
    rewardTokens: 1,
    conditionKey: "clutch_wins",
    targetValue: 3
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
): { challenges: UserChallengeState[]; rerollsRemaining: number } {
  const normalizedUser = (userId || "guest").toLowerCase();
  const existing = state.userChallenges[normalizedUser];

  if (existing && Array.isArray(existing.challenges) && existing.challenges.length === 3) {
    if (existing.rerollsRemaining === undefined) {
      existing.rerollsRemaining = 3;
      writeWeeklyChallengesState(state);
    }
    return { challenges: existing.challenges, rerollsRemaining: existing.rerollsRemaining };
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
    generatedAt: Date.now(),
    rerollsRemaining: 3
  };

  writeWeeklyChallengesState(state);
  return { challenges: newChallenges, rerollsRemaining: 3 };
}

/**
 * Re-rolls a specific challenge for a user (3 per week allowed)
 */
export function rerollUserChallenge(
  userId: string,
  challengeIndex: number,
  state: WeeklyChallengesState
): {
  success: boolean;
  message: string;
  challenges: UserChallengeState[];
  rerollsRemaining: number;
} {
  const normalizedUser = (userId || "guest").toLowerCase();
  const userRecord = state.userChallenges[normalizedUser];

  if (!userRecord || !userRecord.challenges || userRecord.challenges.length <= challengeIndex) {
    const init = getUserWeeklyChallenges(normalizedUser, state);
    return {
      success: false,
      message: "Челленджи не найдены",
      challenges: init.challenges,
      rerollsRemaining: init.rerollsRemaining
    };
  }

  if (userRecord.rerollsRemaining === undefined) {
    userRecord.rerollsRemaining = 3;
  }

  if (userRecord.rerollsRemaining <= 0) {
    return {
      success: false,
      message: "Закончились замены на эту неделю (максимум 3).",
      challenges: userRecord.challenges,
      rerollsRemaining: 0
    };
  }

  const currentChallenge = userRecord.challenges[challengeIndex];
  if (currentChallenge.completed) {
    return {
      success: false,
      message: "Нельзя заменить уже выполненное задание!",
      challenges: userRecord.challenges,
      rerollsRemaining: userRecord.rerollsRemaining
    };
  }

  const targetDifficulty = currentChallenge.definition.difficulty;
  const pool = (state.isCombatWeek ? COMBAT_CHALLENGES : TRAINING_CHALLENGES)
    .filter(c => c.difficulty === targetDifficulty);

  const currentIds = new Set(userRecord.challenges.map(c => c.definition.id));
  const availableAlternatives = pool.filter(c => !currentIds.has(c.id));

  const candidatePool = availableAlternatives.length > 0 
    ? availableAlternatives 
    : pool.filter(c => c.id !== currentChallenge.definition.id);

  if (candidatePool.length === 0) {
    return {
      success: false,
      message: "Нет доступных альтернативных заданий этой сложности.",
      challenges: userRecord.challenges,
      rerollsRemaining: userRecord.rerollsRemaining
    };
  }

  const randomIndex = Math.floor(Math.random() * candidatePool.length);
  const newDef = candidatePool[randomIndex];

  userRecord.challenges[challengeIndex] = {
    definition: newDef,
    completed: false,
    progress: 0,
    target: newDef.targetValue
  };

  userRecord.rerollsRemaining -= 1;
  state.userChallenges[normalizedUser] = userRecord;
  writeWeeklyChallengesState(state);

  return {
    success: true,
    message: `Задание заменено на «${newDef.title}». Осталось замен: ${userRecord.rerollsRemaining}`,
    challenges: userRecord.challenges,
    rerollsRemaining: userRecord.rerollsRemaining
  };
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
  let userRecord = state.userChallenges[primaryKey];
  if (!userRecord || !userRecord.challenges) {
    const init = getUserWeeklyChallenges(primaryKey, state);
    userRecord = state.userChallenges[primaryKey];
  }
  const userObj = userRecord;

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
  let maxSingleMapKills = 0;
  let totalAssists = 0;
  let maxMapKd = 0;
  let maxMapHsPct = 0;
  let maxMapHsPctMin10 = 0;
  let maxMapHsPctMin15 = 0;
  let maxMapHeadshots = 0;
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
            if (kills > maxSingleMapKills) maxSingleMapKills = kills;
            if (hs > maxMapHeadshots) maxMapHeadshots = hs;
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
            if (kills >= 15 && hsPct > maxMapHsPctMin15) maxMapHsPctMin15 = hsPct;

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
      case "max_single_map_kills":
        progress = maxSingleMapKills;
        break;
      case "map_headshots":
        progress = maxMapHeadshots;
        break;
      case "headshot_pct":
        progress = Math.round(maxMapHsPct);
        break;
      case "headshot_pct_min10":
        progress = Math.round(maxMapHsPctMin10);
        break;
      case "headshot_pct_min15":
        progress = Math.round(maxMapHsPctMin15);
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
    message = `Поздравляем! Выполнено заданий: ${tokensAwarded}. Начислено жетонов: +${tokensAwarded}!`;
  } else {
    message = "Проверка завершена. Новых выполненных боевых заданий пока не найдено. Сыграйте в матчах турнира!";
  }

  return {
    updatedChallenges: userObj.challenges,
    tokensAwarded,
    message
  };
}
