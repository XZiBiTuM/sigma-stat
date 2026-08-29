/**
 * Unified Adaptive Skill Score Calculation
 * 
 * Rules:
 * 1. Base Rank (ELO / Premier) has the primary dominant weight (~60%).
 * 2. Adaptive weighting between FACEIT ELO and Premier Rating:
 *    Proportionally weighted by match counts (where player played more matches, that rank has higher weight).
 * 3. Combat Stats from Hub matches (K/D, ADR, HLTV Rating, AVG Kills, WinRate, HS%) account for ~40%.
 * 4. Overrides (customSkillScore) take precedence if explicitly set by admin.
 */

export interface SkillParams {
  playerId?: string;
  nickname?: string;
  elo?: number;
  faceitMatches?: number;
  premierRating?: number;
  premierMatches?: number;
  isRealPremier?: boolean;
  combatStats?: {
    kd?: number;
    adr?: number;
    hltv?: number;
    avgKills?: number;
    hsPct?: number;
    winrate?: number;
    matchesCount?: number;
  } | null;
  overrides?: {
    customSkillScore?: number;
    customElo?: number;
    csRating?: number;
  } | null;
}

export interface SkillResult {
  score: number;
  tier: string;
  color: string;
  bg: string;
  border: string;
  glow: string;
  csRating: number;
  isRealPremier: boolean;
}

export function computeAdaptiveSkillScore(params: SkillParams): SkillResult {
  const {
    elo: rawElo = 1000,
    faceitMatches = 500,
    premierRating = 0,
    premierMatches = 0,
    isRealPremier = false,
    combatStats,
    overrides
  } = params;

  const baseElo = rawElo || overrides?.customElo || 1000;
  const csRating = premierRating || overrides?.csRating || Math.round(baseElo * 9.5);

  // 4. Combat Stats Score (K/D, ADR, HLTV, AVG Kills, WinRate, HS%)
  const kd = parseFloat(String(combatStats?.kd ?? 1.0)) || 1.0;
  const adr = parseFloat(String(combatStats?.adr ?? 75.0)) || 75.0;
  const hltv = parseFloat(String(combatStats?.hltv ?? 1.0)) || 1.0;
  const avgKills = parseFloat(String(combatStats?.avgKills ?? (kd * 16))) || 16.0;
  const hsPct = parseFloat(String(combatStats?.hsPct ?? 45.0)) || 45.0;
  const winRate = parseFloat(String(combatStats?.winrate ?? 50.0)) || 50.0;
  const hubMatchesCount = combatStats?.matchesCount || 0;

  // 1. If explicit manual override exists, return it directly
  if (overrides?.customSkillScore !== undefined && overrides?.customSkillScore !== null && String(overrides.customSkillScore).trim() !== "") {
    const manualScore = Number(overrides.customSkillScore);
    if (!isNaN(manualScore)) {
      return getTierProps(manualScore, csRating, isRealPremier);
    }
  }

  // 2. Base ELO curve (10-100)
  let sElo = 50;
  if (baseElo <= 1000) {
    sElo = Math.max(15, 25 + ((baseElo - 300) / 700) * 25);
  } else if (baseElo <= 2000) {
    sElo = 50 + ((baseElo - 1000) / 1000) * 36; // 1000 -> 50, 1500 -> 68, 1923 -> 83.2, 2000 -> 86
  } else {
    sElo = Math.min(100, 86 + ((baseElo - 2000) / 1000) * 14); // 2500 -> 93, 3000 -> 100
  }

  // 3. Base Premier curve (10-100)
  let sPremier = 50;
  if (csRating <= 10000) {
    sPremier = Math.max(15, 25 + (csRating / 10000) * 25);
  } else if (csRating <= 20000) {
    sPremier = 50 + ((csRating - 10000) / 10000) * 36; // 15000 -> 68, 18116 -> 79.2, 20000 -> 86
  } else {
    sPremier = Math.min(100, 86 + ((csRating - 20000) / 10000) * 14);
  }

  // Adaptive weighting based on which platform player played more games on
  let wElo = 0.65;
  let wPremier = 0.35;
  if (isRealPremier && (premierMatches > 0 || faceitMatches > 0)) {
    const totalRankMatches = (faceitMatches || 1) + (premierMatches || 0);
    wElo = Math.min(0.90, Math.max(0.10, (faceitMatches || 1) / totalRankMatches));
    wPremier = 1 - wElo;
  } else if (!isRealPremier) {
    wElo = 0.85;
    wPremier = 0.15;
  }

  const sRank = (sElo * wElo) + (sPremier * wPremier);

  const sKd = Math.min(100, Math.max(15, 50 + (kd - 1.0) * 55));
  const sAdr = Math.min(100, Math.max(15, 50 + (adr - 70) * 1.5));
  const sHltv = Math.min(100, Math.max(15, 50 + (hltv - 1.0) * 65));
  const sAvg = Math.min(100, Math.max(15, 50 + (avgKills - 16) * 4.0));
  const sWr = Math.min(100, Math.max(15, 50 + (winRate - 50) * 1.5));
  const sHs = Math.min(100, Math.max(15, 50 + (hsPct - 45) * 1.5));

  const sCombat = (sKd * 0.28) + (sHltv * 0.25) + (sAdr * 0.20) + (sAvg * 0.15) + (sWr * 0.08) + (sHs * 0.04);

  // 5. Final Combination:
  // Rank has the primary weight (60%), Hub combat performance accounts for 40%
  // If player has few hub matches (< 5), Rank weight increases up to 85%
  const hubWeight = hubMatchesCount >= 5 ? 0.40 : Math.min(0.40, hubMatchesCount * 0.08);
  const rankWeight = 1 - hubWeight;

  const finalScore = Math.min(99, Math.max(15, Math.round((sRank * rankWeight) + (sCombat * hubWeight))));

  return getTierProps(finalScore, csRating, isRealPremier);
}

function getTierProps(score: number, csRating: number, isRealPremier: boolean): SkillResult {
  let tier = "Tier D";
  let color = "#ff9100"; // Orange
  let bg = "rgba(255, 145, 0, 0.15)";
  let border = "rgba(255, 145, 0, 0.4)";
  let glow = "";

  if (score >= 85) {
    tier = "Tier S";
    color = "#c084fc"; // Glowing Purple
    bg = "rgba(168, 85, 247, 0.22)";
    border = "rgba(168, 85, 247, 0.7)";
    glow = "0 0 16px rgba(168, 85, 247, 0.7), 0 0 4px rgba(192, 132, 252, 0.9)";
  } else if (score >= 70) {
    tier = "Tier A";
    color = "#00e5ff"; // Neon Cyan / Aqua
    bg = "rgba(0, 229, 255, 0.15)";
    border = "rgba(0, 229, 255, 0.5)";
    glow = "0 0 10px rgba(0, 229, 255, 0.4)";
  } else if (score >= 56) {
    tier = "Tier B";
    color = "#00e676"; // Bright Green
    bg = "rgba(0, 230, 118, 0.15)";
    border = "rgba(0, 230, 118, 0.4)";
  } else if (score >= 40) {
    tier = "Tier C";
    color = "#ffd700"; // Yellow / Gold
    bg = "rgba(255, 215, 0, 0.15)";
    border = "rgba(255, 215, 0, 0.4)";
  } else {
    tier = "Tier D";
    color = "#ff9100"; // Orange / Coral
    bg = "rgba(255, 145, 0, 0.15)";
    border = "rgba(255, 145, 0, 0.4)";
  }

  return {
    score,
    tier,
    color,
    bg,
    border,
    glow,
    csRating,
    isRealPremier
  };
}
