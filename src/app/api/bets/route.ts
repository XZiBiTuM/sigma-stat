import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import * as path from "path";

const LOCAL_BETS_FILE = path.join(process.cwd(), "src/lib/tournament_bets.json");
const PERSISTENT_BETS_FILE = path.join(process.cwd(), "..", "sigma_persistent_tournament_bets.json");

const BRACKET_FILE = path.join(process.cwd(), "src/lib/tournament_bracket.json");
const PERSISTENT_BRACKET = path.join(process.cwd(), "..", "sigma_persistent_tournament_bracket.json");

const OVERRIDES_LOCAL = path.join(process.cwd(), "src/lib/player_overrides.json");
const OVERRIDES_PERSISTENT = path.join(process.cwd(), "..", "sigma_persistent_player_overrides.json");

export const STARTING_BALANCE = 100000; // 100,000 СИГМАНАТ

export type BetScope = "MATCH" | "MAP1" | "MAP2";

export type BetMarketType = 
  | "OUTCOME" 
  | "EXACT_SCORE" 
  | "TOTAL_ROUNDS" 
  | "MAP_HANDICAP" 
  | "ROUND_HANDICAP"
  | "MAP_WINNER"
  | "MAP_TOTAL_ROUNDS"
  | "MAP_ROUND_HANDICAP"
  | "HANDICAP";

export interface UserBet {
  id: string;
  userId: string; // Steam ID
  userName: string;
  avatar?: string;
  matchId: string;
  round: number;
  team1Name: string;
  team2Name: string;
  betScope: BetScope; // "MATCH" (серия целиком) | "MAP1" (Карта 1) | "MAP2" (Карта 2)
  marketType: BetMarketType;
  marketOption: string;
  choiceTitle: string;
  choice: "team1" | "draw" | "team2" | string;
  odds: number;
  amount: number;
  potentialWin: number;
  status: "PENDING" | "WON" | "LOST" | "REFUNDED";
  payout: number;
  createdAt: number;
  settledAt?: number;
}

export interface UserWallet {
  userId: string;
  userName: string;
  avatar?: string;
  balance: number;
  totalBets: number;
  totalWon: number;
  totalLost: number;
  updatedAt: number;
}

export interface ExtendedMatchOdds {
  matchId: string;
  // Main Match Outcome (BO2: П1, Ничья, П2)
  k1: number;
  kX: number;
  k2: number;
  p1: number;
  pX: number;
  p2: number;

  // Exact Score (2:0, 1:1, 0:2)
  exactScore: {
    "2:0": number;
    "1:1": number;
    "0:2": number;
  };

  // Total Rounds in Match (2 maps)
  totalRounds: Array<{
    line: number; // 42.5, 45.5, 48.5
    over: number;
    under: number;
  }>;

  // Map Handicap (Фора по картам)
  mapHandicaps: Array<{
    line: string; // "+0.5" | "-0.5"
    team1Odds: number;
    team2Odds: number;
    description1: string;
    description2: string;
  }>;

  // Round Handicap in Match (Фора по раундам за весь матч)
  matchRoundHandicaps: Array<{
    line: number; // e.g. -2.5, +2.5, -4.5, +4.5
    team1Odds: number;
    team2Odds: number;
    label1: string;
    label2: string;
  }>;

  // Single Map Odds (Для Карты 1 и Карты 2)
  mapOdds: {
    map1: {
      k1: number;
      k2: number;
      totals: Array<{ line: number; over: number; under: number }>; // 20.5, 21.5, 22.5
      handicaps: Array<{ line: number; team1Odds: number; team2Odds: number; label1: string; label2: string }>; // -2.5, +2.5
    };
    map2: {
      k1: number;
      k2: number;
      totals: Array<{ line: number; over: number; under: number }>;
      handicaps: Array<{ line: number; team1Odds: number; team2Odds: number; label1: string; label2: string }>;
    };
  };

  // Backward-compatibility alias
  handicaps?: any[];
}

export type MatchOdds = ExtendedMatchOdds;

export interface BetsStore {
  wallets: Record<string, UserWallet>;
  bets: UserBet[];
  updatedAt: number;
}

async function readJson<T>(local: string, persistent: string, defaultVal: T): Promise<T> {
  try {
    let target = local;
    const pStat = await fs.stat(persistent).catch(() => null);
    if (pStat) target = persistent;
    const data = await fs.readFile(target, "utf8");
    return JSON.parse(data);
  } catch {
    return defaultVal;
  }
}

async function writeBetsStore(store: BetsStore) {
  try {
    const dir = path.dirname(LOCAL_BETS_FILE);
    await fs.mkdir(dir, { recursive: true }).catch(() => {});
    const json = JSON.stringify(store, null, 2);
    await fs.writeFile(LOCAL_BETS_FILE, json, "utf8").catch(() => {});
    await fs.writeFile(PERSISTENT_BETS_FILE, json, "utf8").catch(() => {});
  } catch (err) {
    console.error("Failed to write bets store:", err);
  }
}

// Compressed Odds Calculation Engine for realistic esports betting
export function calculateMatchOdds(
  avgSkill1: number,
  avgSkill2: number
): ExtendedMatchOdds {
  // Delta divisor 48 compresses skill divergence so odds remain realistic (1.25 - 3.80 range)
  const delta = avgSkill1 - avgSkill2;
  const pMap1 = 1 / (1 + Math.pow(10, -delta / 48));
  const pMap2 = 1 - pMap1;

  let rawP1 = pMap1 * pMap1;
  let rawP2 = pMap2 * pMap2;
  let rawPX = 2 * pMap1 * pMap2;

  // Keep draw probability balanced for Counter-Strike BO2 (~32% to 44%)
  rawPX = Math.max(0.32, Math.min(0.44, rawPX));
  const rem = 1 - rawPX;
  const sum12 = rawP1 + rawP2;
  if (sum12 > 0) {
    rawP1 = (rawP1 / sum12) * rem;
    rawP2 = (rawP2 / sum12) * rem;
  }

  // Margin of 6%
  const margin = 1.06;
  const calcK1 = Number((1 / (rawP1 * margin)).toFixed(2));
  const calcKX = Number((1 / (rawPX * margin)).toFixed(2));
  const calcK2 = Number((1 / (rawP2 * margin)).toFixed(2));

  const k1 = Math.max(1.25, Math.min(3.80, calcK1));
  const kX = Math.max(1.90, Math.min(2.70, calcKX));
  const k2 = Math.max(1.25, Math.min(3.80, calcK2));

  // Single Map win odds (for Map 1 and Map 2)
  const mapK1 = Number(Math.max(1.28, Math.min(3.40, 1 / (pMap1 * margin))).toFixed(2));
  const mapK2 = Number(Math.max(1.28, Math.min(3.40, 1 / (pMap2 * margin))).toFixed(2));

  // Exact score odds
  const exactScore = {
    "2:0": Number(Math.max(1.70, Math.min(3.95, k1 * 0.98 + 0.05)).toFixed(2)),
    "1:1": Number(Math.max(1.85, Math.min(2.65, kX)).toFixed(2)),
    "0:2": Number(Math.max(1.70, Math.min(3.95, k2 * 0.98 + 0.05)).toFixed(2))
  };

  const skillGap = Math.abs(delta);

  // Total Rounds in Match
  const totalRounds = [
    {
      line: 42.5,
      over: Number(Math.max(1.55, Math.min(2.15, 1.70 + skillGap * 0.015)).toFixed(2)),
      under: Number(Math.max(1.65, Math.min(2.25, 2.05 - skillGap * 0.015)).toFixed(2))
    },
    {
      line: 45.5,
      over: Number(Math.max(1.80, Math.min(2.45, 1.95 + skillGap * 0.02)).toFixed(2)),
      under: Number(Math.max(1.50, Math.min(1.95, 1.80 - skillGap * 0.01)).toFixed(2))
    },
    {
      line: 48.5,
      over: Number(Math.max(2.15, Math.min(3.10, 2.40 + skillGap * 0.025)).toFixed(2)),
      under: Number(Math.max(1.30, Math.min(1.65, 1.50 - skillGap * 0.01)).toFixed(2))
    }
  ];

  // Map Handicap (+0.5 / -0.5 maps)
  const t1Plus05Prob = rawP1 + rawPX;
  const t2Plus05Prob = rawP2 + rawPX;

  const mapHandicaps = [
    {
      line: "+0.5",
      team1Odds: Number(Math.max(1.22, Math.min(2.35, 1 / (t1Plus05Prob * margin))).toFixed(2)),
      team2Odds: Number(Math.max(1.22, Math.min(2.35, 1 / (t2Plus05Prob * margin))).toFixed(2)),
      description1: "Фора 1 (+0.5 по картам)",
      description2: "Фора 2 (+0.5 по картам)"
    },
    {
      line: "-0.5",
      team1Odds: Number(Math.max(1.70, Math.min(3.80, exactScore["2:0"])).toFixed(2)),
      team2Odds: Number(Math.max(1.70, Math.min(3.80, exactScore["0:2"])).toFixed(2)),
      description1: "Фора 1 (-0.5 по картам)",
      description2: "Фора 2 (-0.5 по картам)"
    }
  ];

  // Match Round Handicaps (Фора по раундам за весь матч)
  // Higher skill gives negative handicap (e.g. -3.5 rounds), underdog gets positive (+3.5 rounds)
  const favoredIsT1 = delta >= 0;
  const roundSpread = Math.min(7.5, Math.max(1.5, Math.round((skillGap / 10) * 2.5 * 2) / 2 + 0.5)); // e.g. 2.5, 3.5, 4.5

  const matchRoundHandicaps = [
    {
      line: favoredIsT1 ? -roundSpread : roundSpread,
      team1Odds: favoredIsT1 ? 1.90 : 1.85,
      team2Odds: favoredIsT1 ? 1.85 : 1.90,
      label1: favoredIsT1 ? `Фора 1 (-${roundSpread} раундов)` : `Фора 1 (+${roundSpread} раундов)`,
      label2: favoredIsT1 ? `Фора 2 (+${roundSpread} раундов)` : `Фора 2 (-${roundSpread} раундов)`
    },
    {
      line: favoredIsT1 ? -(roundSpread + 2) : (roundSpread + 2),
      team1Odds: favoredIsT1 ? 2.25 : 1.62,
      team2Odds: favoredIsT1 ? 1.62 : 2.25,
      label1: favoredIsT1 ? `Фора 1 (-${roundSpread + 2} раундов)` : `Фора 1 (+${roundSpread + 2} раундов)`,
      label2: favoredIsT1 ? `Фора 2 (+${roundSpread + 2} раундов)` : `Фора 2 (-${roundSpread + 2} раундов)`
    }
  ];

  // Per-Map Markets (Map 1 & Map 2 totals and round handicaps)
  const mapSpread = 2.5; // typical round handicap on single MR12 map (e.g. -2.5 / +2.5)
  const mapRoundHandicaps = [
    {
      line: favoredIsT1 ? -mapSpread : mapSpread,
      team1Odds: favoredIsT1 ? 1.90 : 1.85,
      team2Odds: favoredIsT1 ? 1.85 : 1.90,
      label1: favoredIsT1 ? `Фора 1 (-${mapSpread})` : `Фора 1 (+${mapSpread})`,
      label2: favoredIsT1 ? `Фора 2 (+${mapSpread})` : `Фора 2 (-${mapSpread})`
    }
  ];

  const mapTotals = [
    { line: 20.5, over: 1.68, under: 2.10 },
    { line: 21.5, over: 1.90, under: 1.85 },
    { line: 22.5, over: 2.25, under: 1.60 }
  ];

  const mapOdds = {
    map1: {
      k1: mapK1,
      k2: mapK2,
      totals: mapTotals,
      handicaps: mapRoundHandicaps
    },
    map2: {
      k1: mapK1,
      k2: mapK2,
      totals: mapTotals,
      handicaps: mapRoundHandicaps
    }
  };

  return {
    matchId: "",
    k1,
    kX,
    k2,
    p1: Math.round(rawP1 * 100),
    pX: Math.round(rawPX * 100),
    p2: Math.round(rawP2 * 100),
    exactScore,
    totalRounds,
    mapHandicaps,
    matchRoundHandicaps,
    mapOdds,
    handicaps: mapHandicaps // alias
  };
}

// Settle completed matches and credit winners for ALL markets (Match, Map 1, Map 2)
export async function settleBetsForBracket(bracketData: any, store: BetsStore): Promise<{ settledCount: number }> {
  if (!bracketData?.matches || !Array.isArray(bracketData.matches)) {
    return { settledCount: 0 };
  }

  const matchMap = new Map<string, any>();
  bracketData.matches.forEach((m: any) => matchMap.set(m.id, m));

  let settledCount = 0;

  for (const bet of store.bets) {
    if (bet.status !== "PENDING") continue;

    const m = matchMap.get(bet.matchId);
    if (!m) continue;

    // Check if match is finished with scores
    if (m.status === "FINISHED" && m.score1 !== null && m.score2 !== null) {
      let isWon = false;
      const seriesScore1 = Number(m.score1);
      const seriesScore2 = Number(m.score2);
      const scope = bet.betScope || "MATCH";
      const mType = bet.marketType || "OUTCOME";
      const mOption = bet.marketOption || bet.choice;

      // Extract map round scores if available
      const m1s1 = (m.map1Score1 !== undefined && m.map1Score1 !== null) ? Number(m.map1Score1) : (seriesScore1 > 0 ? 13 : 8);
      const m1s2 = (m.map1Score2 !== undefined && m.map1Score2 !== null) ? Number(m.map1Score2) : (seriesScore2 > 0 && seriesScore1 === 0 ? 13 : 9);
      const m2s1 = (m.map2Score1 !== undefined && m.map2Score1 !== null) ? Number(m.map2Score1) : (seriesScore1 === 2 ? 13 : (seriesScore1 === 1 ? 7 : 8));
      const m2s2 = (m.map2Score2 !== undefined && m.map2Score2 !== null) ? Number(m.map2Score2) : (seriesScore2 > 0 ? 13 : 9);

      const totalRoundsMatch = (m1s1 + m1s2) + (m2s1 + m2s2);
      const totalRoundsMap1 = m1s1 + m1s2;
      const totalRoundsMap2 = m2s1 + m2s2;

      const totalT1Rounds = m1s1 + m2s1;
      const totalT2Rounds = m1s2 + m2s2;

      // SETTLEMENT LOGIC BASED ON SCOPE AND MARKET TYPE
      if (scope === "MATCH") {
        if (mType === "OUTCOME") {
          let winningOutcome: "team1" | "draw" | "team2" = "draw";
          if (seriesScore1 > seriesScore2) winningOutcome = "team1";
          else if (seriesScore2 > seriesScore1) winningOutcome = "team2";
          else winningOutcome = "draw";

          isWon = (mOption === winningOutcome || bet.choice === winningOutcome);
        } else if (mType === "EXACT_SCORE") {
          const actualScoreStr = seriesScore1 + ":" + seriesScore2;
          isWon = (mOption === actualScoreStr);
        } else if (mType === "TOTAL_ROUNDS") {
          if (mOption.startsWith("OVER_")) {
            const threshold = parseFloat(mOption.replace("OVER_", ""));
            isWon = totalRoundsMatch > threshold;
          } else if (mOption.startsWith("UNDER_")) {
            const threshold = parseFloat(mOption.replace("UNDER_", ""));
            isWon = totalRoundsMatch < threshold;
          }
        } else if (mType === "MAP_HANDICAP" || mType === "HANDICAP") {
          if (mOption === "T1_PLUS_0.5") {
            isWon = (seriesScore1 + 0.5) > seriesScore2;
          } else if (mOption === "T2_PLUS_0.5") {
            isWon = (seriesScore2 + 0.5) > seriesScore1;
          } else if (mOption === "T1_MINUS_0.5") {
            isWon = (seriesScore1 - 0.5) > seriesScore2;
          } else if (mOption === "T2_MINUS_0.5") {
            isWon = (seriesScore2 - 0.5) > seriesScore1;
          }
        } else if (mType === "ROUND_HANDICAP") {
          // e.g. "T1_ROUND_HANDICAP_-2.5" or "T2_ROUND_HANDICAP_+2.5"
          if (mOption.startsWith("T1_ROUND_HANDICAP_")) {
            const handicapVal = parseFloat(mOption.replace("T1_ROUND_HANDICAP_", ""));
            isWon = (totalT1Rounds + handicapVal) > totalT2Rounds;
          } else if (mOption.startsWith("T2_ROUND_HANDICAP_")) {
            const handicapVal = parseFloat(mOption.replace("T2_ROUND_HANDICAP_", ""));
            isWon = (totalT2Rounds + handicapVal) > totalT1Rounds;
          }
        }
      } else if (scope === "MAP1") {
        if (mType === "MAP_WINNER" || mType === "OUTCOME") {
          const map1Winner = m1s1 > m1s2 ? "team1" : "team2";
          isWon = (mOption === map1Winner || bet.choice === map1Winner);
        } else if (mType === "MAP_TOTAL_ROUNDS" || mType === "TOTAL_ROUNDS") {
          if (mOption.startsWith("MAP1_OVER_") || mOption.startsWith("OVER_")) {
            const clean = mOption.replace("MAP1_OVER_", "").replace("OVER_", "");
            isWon = totalRoundsMap1 > parseFloat(clean);
          } else if (mOption.startsWith("MAP1_UNDER_") || mOption.startsWith("UNDER_")) {
            const clean = mOption.replace("MAP1_UNDER_", "").replace("UNDER_", "");
            isWon = totalRoundsMap1 < parseFloat(clean);
          }
        } else if (mType === "MAP_ROUND_HANDICAP" || mType === "ROUND_HANDICAP") {
          if (mOption.startsWith("MAP1_T1_HANDICAP_")) {
            const h = parseFloat(mOption.replace("MAP1_T1_HANDICAP_", ""));
            isWon = (m1s1 + h) > m1s2;
          } else if (mOption.startsWith("MAP1_T2_HANDICAP_")) {
            const h = parseFloat(mOption.replace("MAP1_T2_HANDICAP_", ""));
            isWon = (m1s2 + h) > m1s1;
          }
        }
      } else if (scope === "MAP2") {
        if (mType === "MAP_WINNER" || mType === "OUTCOME") {
          const map2Winner = m2s1 > m2s2 ? "team1" : "team2";
          isWon = (mOption === map2Winner || bet.choice === map2Winner);
        } else if (mType === "MAP_TOTAL_ROUNDS" || mType === "TOTAL_ROUNDS") {
          if (mOption.startsWith("MAP2_OVER_") || mOption.startsWith("OVER_")) {
            const clean = mOption.replace("MAP2_OVER_", "").replace("OVER_", "");
            isWon = totalRoundsMap2 > parseFloat(clean);
          } else if (mOption.startsWith("MAP2_UNDER_") || mOption.startsWith("UNDER_")) {
            const clean = mOption.replace("MAP2_UNDER_", "").replace("UNDER_", "");
            isWon = totalRoundsMap2 < parseFloat(clean);
          }
        } else if (mType === "MAP_ROUND_HANDICAP" || mType === "ROUND_HANDICAP") {
          if (mOption.startsWith("MAP2_T1_HANDICAP_")) {
            const h = parseFloat(mOption.replace("MAP2_T1_HANDICAP_", ""));
            isWon = (m2s1 + h) > m2s2;
          } else if (mOption.startsWith("MAP2_T2_HANDICAP_")) {
            const h = parseFloat(mOption.replace("MAP2_T2_HANDICAP_", ""));
            isWon = (m2s2 + h) > m2s1;
          }
        }
      }

      const wallet = store.wallets[bet.userId];

      if (isWon) {
        bet.status = "WON";
        bet.payout = Math.round(bet.amount * bet.odds);
        bet.settledAt = Date.now();

        if (wallet) {
          wallet.balance += bet.payout;
          wallet.totalWon += bet.payout;
          wallet.updatedAt = Date.now();
        }
      } else {
        bet.status = "LOST";
        bet.payout = 0;
        bet.settledAt = Date.now();

        if (wallet) {
          wallet.totalLost += bet.amount;
          wallet.updatedAt = Date.now();
        }
      }
      settledCount++;
    }
  }

  if (settledCount > 0) {
    store.updatedAt = Date.now();
    await writeBetsStore(store);
  }

  return { settledCount };
}

export async function GET(request: NextRequest) {
  try {
    const store = await readJson<BetsStore>(LOCAL_BETS_FILE, PERSISTENT_BETS_FILE, {
      wallets: {},
      bets: [],
      updatedAt: Date.now()
    });

    const bracket = await readJson<any>(BRACKET_FILE, PERSISTENT_BRACKET, null);
    const overrides = await readJson<any>(OVERRIDES_LOCAL, OVERRIDES_PERSISTENT, {});

    // Automatically check and settle any finished matches
    await settleBetsForBracket(bracket, store);

    // Get current authenticated user
    let currentUser: any = null;
    const sessionCookie = request.cookies.get("sigma_user_session")?.value;
    if (sessionCookie) {
      try {
        const decodedStr = Buffer.from(sessionCookie, "base64").toString("utf8");
        currentUser = JSON.parse(decodedStr);
      } catch {}
    }

    const userId = currentUser?.steamId;
    let userWallet: UserWallet | null = null;
    let userBets: UserBet[] = [];

    if (userId) {
      if (!store.wallets[userId]) {
        store.wallets[userId] = {
          userId,
          userName: currentUser?.steamName || currentUser?.faceit?.nickname || "Игрок",
          avatar: currentUser?.faceit?.avatar || currentUser?.steamAvatar,
          balance: STARTING_BALANCE,
          totalBets: 0,
          totalWon: 0,
          totalLost: 0,
          updatedAt: Date.now()
        };
        await writeBetsStore(store);
      } else {
        const w = store.wallets[userId];
        if (currentUser?.steamName && w.userName !== currentUser.steamName) w.userName = currentUser.steamName;
        if (currentUser?.steamAvatar && !w.avatar) w.avatar = currentUser.steamAvatar;
      }

      userWallet = store.wallets[userId];
      userBets = store.bets.filter(b => b.userId === userId).sort((a, b) => b.createdAt - a.createdAt);
    }

    // Compute Odds for all matches in the bracket
    const oddsMap: Record<string, ExtendedMatchOdds> = {};
    if (bracket?.matches && bracket?.teams) {
      const teamMap = new Map<string, any>();
      bracket.teams.forEach((t: any) => teamMap.set(t.id, t));

      bracket.matches.forEach((m: any) => {
        const t1 = teamMap.get(m.team1Id);
        const t2 = teamMap.get(m.team2Id);

        const getSkill = (t: any) => {
          if (!t) return 65;
          const members = (t.players && t.players.length > 0) ? t.players : [t.captain];
          let total = 0;
          let count = 0;
          members.forEach((pName: string) => {
            if (!pName) return;
            const ov = overrides[pName] || overrides[pName.toLowerCase()] || Object.values(overrides).find((o: any) => o.nickname?.toLowerCase() === pName.toLowerCase());
            let s = 65;
            if (ov?.customSkillScore) s = ov.customSkillScore;
            else if (ov?.customElo) s = Math.min(99, Math.max(30, Math.round(30 + (ov.customElo / 2500) * 65)));
            total += s;
            count++;
          });
          return count > 0 ? Math.round(total / count) : 65;
        };

        const s1 = getSkill(t1);
        const s2 = getSkill(t2);
        const o = calculateMatchOdds(s1, s2);
        o.matchId = m.id;
        oddsMap[m.id] = o;
      });
    }

    const leaderboard = Object.values(store.wallets)
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 15);

    return NextResponse.json({
      success: true,
      userWallet,
      userBets,
      oddsMap,
      leaderboard,
      startingBalance: STARTING_BALANCE
    });
  } catch (error: any) {
    console.error("Error in bets API GET:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get("sigma_user_session")?.value;
    if (!sessionCookie) {
      return NextResponse.json(
        { success: false, error: "Для размещения ставки необходима авторизация через Steam!" },
        { status: 401 }
      );
    }

    let currentUser: any = null;
    try {
      const decodedStr = Buffer.from(sessionCookie, "base64").toString("utf8");
      currentUser = JSON.parse(decodedStr);
    } catch {}

    const userId = currentUser?.steamId;
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Недействительная Steam-сессия. Войдите заново." },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { 
      matchId, 
      betScope = "MATCH", 
      marketType = "OUTCOME", 
      marketOption, 
      choice, 
      amount, 
      choiceTitle,
      customOdds 
    } = body;

    const betAmount = parseInt(amount, 10);
    if (isNaN(betAmount) || betAmount <= 0) {
      return NextResponse.json({ success: false, error: "Укажите корректную сумму ставки в СИГМАНАТ!" }, { status: 400 });
    }

    const optionSelected = marketOption || choice;
    if (!optionSelected) {
      return NextResponse.json({ success: false, error: "Не выбран исход ставки!" }, { status: 400 });
    }

    const store = await readJson<BetsStore>(LOCAL_BETS_FILE, PERSISTENT_BETS_FILE, {
      wallets: {},
      bets: [],
      updatedAt: Date.now()
    });

    const bracket = await readJson<any>(BRACKET_FILE, PERSISTENT_BRACKET, null);
    if (!bracket?.matches) {
      return NextResponse.json({ success: false, error: "Сетка турнира не найдена." }, { status: 404 });
    }

    const match = bracket.matches.find((m: any) => m.id === matchId);
    if (!match) {
      return NextResponse.json({ success: false, error: "Матч не найден." }, { status: 404 });
    }

    if (match.status !== "UPCOMING") {
      return NextResponse.json(
        { success: false, error: "Ставки на этот матч уже закрыты (матч идёт LIVE или завершён)!" },
        { status: 400 }
      );
    }

    if (!store.wallets[userId]) {
      store.wallets[userId] = {
        userId,
        userName: currentUser?.steamName || currentUser?.faceit?.nickname || "Игрок",
        avatar: currentUser?.faceit?.avatar || currentUser?.steamAvatar,
        balance: STARTING_BALANCE,
        totalBets: 0,
        totalWon: 0,
        totalLost: 0,
        updatedAt: Date.now()
      };
    }

    const wallet = store.wallets[userId];

    if (wallet.balance < betAmount) {
      return NextResponse.json(
        {
          success: false,
          error: "Недостаточно средств на балансе! Доступно: " + wallet.balance.toLocaleString() + " СИГМАНАТ."
        },
        { status: 400 }
      );
    }

    const overrides = await readJson<any>(OVERRIDES_LOCAL, OVERRIDES_PERSISTENT, {});
    const teamMap = new Map<string, any>();
    bracket.teams?.forEach((t: any) => teamMap.set(t.id, t));

    const t1 = teamMap.get(match.team1Id);
    const t2 = teamMap.get(match.team2Id);

    const getSkill = (t: any) => {
      if (!t) return 65;
      const members = (t.players && t.players.length > 0) ? t.players : [t.captain];
      let total = 0;
      let count = 0;
      members.forEach((pName: string) => {
        if (!pName) return;
        const ov = overrides[pName] || overrides[pName.toLowerCase()] || Object.values(overrides).find((o: any) => o.nickname?.toLowerCase() === pName.toLowerCase());
        let s = 65;
        if (ov?.customSkillScore) s = ov.customSkillScore;
        else if (ov?.customElo) s = Math.min(99, Math.max(30, Math.round(30 + (ov.customElo / 2500) * 65)));
        total += s;
        count++;
      });
      return count > 0 ? Math.round(total / count) : 65;
    };

    const extendedOdds = calculateMatchOdds(getSkill(t1), getSkill(t2));
    let selectedOdds = typeof customOdds === "number" && customOdds >= 1.15 ? customOdds : 2.0;
    let finalTitle = choiceTitle || "";

    // Calculate verified odds based on market
    if (betScope === "MATCH") {
      if (marketType === "OUTCOME") {
        if (optionSelected === "team1") {
          selectedOdds = extendedOdds.k1;
          finalTitle = `Победа ${t1?.name || "Команда 1"}`;
        } else if (optionSelected === "draw") {
          selectedOdds = extendedOdds.kX;
          finalTitle = "Ничья (1:1)";
        } else {
          selectedOdds = extendedOdds.k2;
          finalTitle = `Победа ${t2?.name || "Команда 2"}`;
        }
      } else if (marketType === "EXACT_SCORE") {
        const k = (extendedOdds.exactScore as any)[optionSelected];
        if (k) selectedOdds = k;
        finalTitle = `Точный счет ${optionSelected}`;
      } else if (marketType === "TOTAL_ROUNDS") {
        if (optionSelected.startsWith("OVER_")) {
          const line = parseFloat(optionSelected.replace("OVER_", ""));
          const item = extendedOdds.totalRounds.find(tr => tr.line === line);
          if (item) selectedOdds = item.over;
          finalTitle = `Тотал больше ${line} раундов (Матч)`;
        } else if (optionSelected.startsWith("UNDER_")) {
          const line = parseFloat(optionSelected.replace("UNDER_", ""));
          const item = extendedOdds.totalRounds.find(tr => tr.line === line);
          if (item) selectedOdds = item.under;
          finalTitle = `Тотал меньше ${line} раундов (Матч)`;
        }
      } else if (marketType === "MAP_HANDICAP" || marketType === "HANDICAP") {
        if (optionSelected === "T1_PLUS_0.5") {
          selectedOdds = extendedOdds.mapHandicaps[0].team1Odds;
          finalTitle = `${t1?.name || "Команда 1"} (+0.5 по картам)`;
        } else if (optionSelected === "T2_PLUS_0.5") {
          selectedOdds = extendedOdds.mapHandicaps[0].team2Odds;
          finalTitle = `${t2?.name || "Команда 2"} (+0.5 по картам)`;
        } else if (optionSelected === "T1_MINUS_0.5") {
          selectedOdds = extendedOdds.mapHandicaps[1].team1Odds;
          finalTitle = `${t1?.name || "Команда 1"} (-0.5 по картам)`;
        } else if (optionSelected === "T2_MINUS_0.5") {
          selectedOdds = extendedOdds.mapHandicaps[1].team2Odds;
          finalTitle = `${t2?.name || "Команда 2"} (-0.5 по картам)`;
        }
      } else if (marketType === "ROUND_HANDICAP") {
        // Find line in matchRoundHandicaps
        if (optionSelected.startsWith("T1_ROUND_HANDICAP_")) {
          const lineVal = parseFloat(optionSelected.replace("T1_ROUND_HANDICAP_", ""));
          const item = extendedOdds.matchRoundHandicaps.find(h => Math.abs(h.line) === Math.abs(lineVal));
          if (item) {
            selectedOdds = lineVal === item.line ? item.team1Odds : item.team2Odds;
          }
          finalTitle = `${t1?.name || "Команда 1"} (Фора ${lineVal > 0 ? "+" + lineVal : lineVal} раундов на матч)`;
        } else if (optionSelected.startsWith("T2_ROUND_HANDICAP_")) {
          const lineVal = parseFloat(optionSelected.replace("T2_ROUND_HANDICAP_", ""));
          const item = extendedOdds.matchRoundHandicaps.find(h => Math.abs(h.line) === Math.abs(lineVal));
          if (item) {
            selectedOdds = lineVal === item.line ? item.team2Odds : item.team1Odds;
          }
          finalTitle = `${t2?.name || "Команда 2"} (Фора ${lineVal > 0 ? "+" + lineVal : lineVal} раундов на матч)`;
        }
      }
    } else if (betScope === "MAP1" || betScope === "MAP2") {
      const targetMap = betScope === "MAP1" ? extendedOdds.mapOdds.map1 : extendedOdds.mapOdds.map2;
      const mapNameStr = betScope === "MAP1" ? "Карта 1" : "Карта 2";

      if (marketType === "MAP_WINNER" || marketType === "OUTCOME") {
        if (optionSelected === "team1") {
          selectedOdds = targetMap.k1;
          finalTitle = `${mapNameStr}: Победа ${t1?.name || "Команда 1"}`;
        } else {
          selectedOdds = targetMap.k2;
          finalTitle = `${mapNameStr}: Победа ${t2?.name || "Команда 2"}`;
        }
      } else if (marketType === "MAP_TOTAL_ROUNDS" || marketType === "TOTAL_ROUNDS") {
        const isOver = optionSelected.includes("OVER_");
        const lineVal = parseFloat(optionSelected.split("OVER_")[1] || optionSelected.split("UNDER_")[1] || "21.5");
        const item = targetMap.totals.find(t => t.line === lineVal) || targetMap.totals[1];
        selectedOdds = isOver ? item.over : item.under;
        finalTitle = `${mapNameStr}: Тотал ${isOver ? "больше" : "меньше"} ${lineVal} раундов`;
      } else if (marketType === "MAP_ROUND_HANDICAP" || marketType === "ROUND_HANDICAP") {
        const isT1 = optionSelected.includes("T1");
        const lineVal = parseFloat(optionSelected.split("HANDICAP_")[1] || "2.5");
        const item = targetMap.handicaps[0];
        selectedOdds = isT1 ? item.team1Odds : item.team2Odds;
        const teamName = isT1 ? (t1?.name || "Команда 1") : (t2?.name || "Команда 2");
        finalTitle = `${mapNameStr}: ${teamName} (Фора ${lineVal > 0 ? "+" + lineVal : lineVal} раундов)`;
      }
    }

    const existingSameBet = store.bets.find(
      b => b.userId === userId && b.matchId === matchId && b.betScope === betScope && (b.marketOption === optionSelected || b.choice === optionSelected) && b.status === "PENDING"
    );

    wallet.balance -= betAmount;
    wallet.totalBets += 1;
    wallet.updatedAt = Date.now();

    if (existingSameBet) {
      existingSameBet.amount += betAmount;
      existingSameBet.potentialWin = Math.round(existingSameBet.amount * existingSameBet.odds);
    } else {
      const newBet: UserBet = {
        id: "bet_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
        userId,
        userName: wallet.userName,
        avatar: wallet.avatar,
        matchId,
        round: match.round,
        team1Name: t1?.name || "Команда 1",
        team2Name: t2?.name || "Команда 2",
        betScope: betScope as BetScope,
        marketType: marketType as BetMarketType,
        marketOption: optionSelected,
        choiceTitle: finalTitle || optionSelected,
        choice: (["team1", "draw", "team2"].includes(optionSelected) ? optionSelected : "other") as any,
        odds: selectedOdds,
        amount: betAmount,
        potentialWin: Math.round(betAmount * selectedOdds),
        status: "PENDING",
        payout: 0,
        createdAt: Date.now()
      };
      store.bets.push(newBet);
    }

    store.updatedAt = Date.now();
    await writeBetsStore(store);

    return NextResponse.json({
      success: true,
      message: `Ставка принята на "${finalTitle}"! Списано: ${betAmount.toLocaleString()} СИГМАНАТ`,
      userWallet: wallet,
      userBets: store.bets.filter(b => b.userId === userId).sort((a, b) => b.createdAt - a.createdAt)
    });
  } catch (error: any) {
    console.error("Error in placing bet POST:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
