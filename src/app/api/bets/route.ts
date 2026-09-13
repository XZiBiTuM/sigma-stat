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

export type BetMarketType = "OUTCOME" | "EXACT_SCORE" | "TOTAL_ROUNDS" | "HANDICAP";

export interface UserBet {
  id: string;
  userId: string; // Steam ID
  userName: string;
  avatar?: string;
  matchId: string;
  round: number;
  team1Name: string;
  team2Name: string;
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
  k1: number;
  kX: number;
  k2: number;
  p1: number;
  pX: number;
  p2: number;
  exactScore: {
    "2:0": number;
    "1:1": number;
    "0:2": number;
  };
  totalRounds: Array<{
    line: number;
    over: number;
    under: number;
  }>;
  handicaps: Array<{
    line: string;
    team1Odds: number;
    team2Odds: number;
    description1: string;
    description2: string;
  }>;
}

// Backward-compatibility alias
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
  // Delta divisor 48 compresses skill divergence so odds remain attractive and realistic (1.25 - 3.80 range)
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

  // Bookmaker margin of 6%
  const margin = 1.06;
  const calcK1 = Number((1 / (rawP1 * margin)).toFixed(2));
  const calcKX = Number((1 / (rawPX * margin)).toFixed(2));
  const calcK2 = Number((1 / (rawP2 * margin)).toFixed(2));

  // Hard clamp main odds between 1.25 and 3.80 for standard outcomes
  const k1 = Math.max(1.25, Math.min(3.80, calcK1));
  const kX = Math.max(1.90, Math.min(2.70, calcKX));
  const k2 = Math.max(1.25, Math.min(3.80, calcK2));

  // Exact score odds
  const exactScore = {
    "2:0": Number(Math.max(1.70, Math.min(3.95, k1 * 0.98 + 0.05)).toFixed(2)),
    "1:1": Number(Math.max(1.85, Math.min(2.65, kX)).toFixed(2)),
    "0:2": Number(Math.max(1.70, Math.min(3.95, k2 * 0.98 + 0.05)).toFixed(2))
  };

  // Total Rounds (2 maps of CS2 standard MR12 -> 24 to 50+ rounds)
  const skillGap = Math.abs(delta);
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

  // Handicaps (Фора по картам в BO2: +0.5 означает "не проиграет всухую", то есть 1:1 или 2:0)
  const t1Plus05Prob = rawP1 + rawPX;
  const t2Plus05Prob = rawP2 + rawPX;

  const handicaps = [
    {
      line: "0.5",
      team1Odds: Number(Math.max(1.22, Math.min(2.35, 1 / (t1Plus05Prob * margin))).toFixed(2)),
      team2Odds: Number(Math.max(1.22, Math.min(2.35, 1 / (t2Plus05Prob * margin))).toFixed(2)),
      description1: "Фора 1 (+0.5)",
      description2: "Фора 2 (+0.5)"
    },
    {
      line: "-0.5",
      team1Odds: Number(Math.max(1.70, Math.min(3.80, exactScore["2:0"])).toFixed(2)),
      team2Odds: Number(Math.max(1.70, Math.min(3.80, exactScore["0:2"])).toFixed(2)),
      description1: "Фора 1 (-0.5)",
      description2: "Фора 2 (-0.5)"
    }
  ];

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
    handicaps
  };
}

// Settle completed matches and credit winners for ALL markets
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
      const score1 = Number(m.score1);
      const score2 = Number(m.score2);
      const mType = bet.marketType || "OUTCOME";
      const mOption = bet.marketOption || bet.choice;

      // Calculate total rounds in match if map rounds exist, or estimate standard
      let totalRoundsPlayed = 0;
      if (m.map1Score1 !== undefined && m.map1Score2 !== undefined && m.map1Score1 !== null && m.map1Score2 !== null) {
        totalRoundsPlayed += Number(m.map1Score1) + Number(m.map1Score2);
      }
      if (m.map2Score1 !== undefined && m.map2Score2 !== undefined && m.map2Score1 !== null && m.map2Score2 !== null) {
        totalRoundsPlayed += Number(m.map2Score1) + Number(m.map2Score2);
      }
      if (totalRoundsPlayed === 0) {
        totalRoundsPlayed = 44; 
      }

      if (mType === "OUTCOME") {
        let winningOutcome: "team1" | "draw" | "team2" = "draw";
        if (score1 > score2) winningOutcome = "team1";
        else if (score2 > score1) winningOutcome = "team2";
        else winningOutcome = "draw";

        isWon = (mOption === winningOutcome || bet.choice === winningOutcome);
      } else if (mType === "EXACT_SCORE") {
        const actualScoreStr = score1 + ":" + score2;
        isWon = (mOption === actualScoreStr);
      } else if (mType === "TOTAL_ROUNDS") {
        if (mOption.startsWith("OVER_")) {
          const threshold = parseFloat(mOption.replace("OVER_", ""));
          isWon = totalRoundsPlayed > threshold;
        } else if (mOption.startsWith("UNDER_")) {
          const threshold = parseFloat(mOption.replace("UNDER_", ""));
          isWon = totalRoundsPlayed < threshold;
        }
      } else if (mType === "HANDICAP") {
        if (mOption === "T1_PLUS_0.5") {
          isWon = (score1 + 0.5) > score2;
        } else if (mOption === "T2_PLUS_0.5") {
          isWon = (score2 + 0.5) > score1;
        } else if (mOption === "T1_MINUS_0.5") {
          isWon = (score1 - 0.5) > score2;
        } else if (mOption === "T2_MINUS_0.5") {
          isWon = (score2 - 0.5) > score1;
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

    // Top Rich Wallets Leaderboard (sorted by balance)
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
    const { matchId, marketType = "OUTCOME", marketOption, choice, amount, choiceTitle } = body;

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
    let selectedOdds = 2.0;
    let finalTitle = choiceTitle || "";

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
      if (!k) return NextResponse.json({ success: false, error: "Неверный точный счет" }, { status: 400 });
      selectedOdds = k;
      finalTitle = `Точный счет ${optionSelected}`;
    } else if (marketType === "TOTAL_ROUNDS") {
      if (optionSelected.startsWith("OVER_")) {
        const line = parseFloat(optionSelected.replace("OVER_", ""));
        const item = extendedOdds.totalRounds.find(tr => tr.line === line);
        if (!item) return NextResponse.json({ success: false, error: "Неверный тотал" }, { status: 400 });
        selectedOdds = item.over;
        finalTitle = `Тотал больше ${line} раундов`;
      } else if (optionSelected.startsWith("UNDER_")) {
        const line = parseFloat(optionSelected.replace("UNDER_", ""));
        const item = extendedOdds.totalRounds.find(tr => tr.line === line);
        if (!item) return NextResponse.json({ success: false, error: "Неверный тотал" }, { status: 400 });
        selectedOdds = item.under;
        finalTitle = `Тотал меньше ${line} раундов`;
      }
    } else if (marketType === "HANDICAP") {
      if (optionSelected === "T1_PLUS_0.5") {
        selectedOdds = extendedOdds.handicaps[0].team1Odds;
        finalTitle = `${t1?.name || "Команда 1"} (+0.5)`;
      } else if (optionSelected === "T2_PLUS_0.5") {
        selectedOdds = extendedOdds.handicaps[0].team2Odds;
        finalTitle = `${t2?.name || "Команда 2"} (+0.5)`;
      } else if (optionSelected === "T1_MINUS_0.5") {
        selectedOdds = extendedOdds.handicaps[1].team1Odds;
        finalTitle = `${t1?.name || "Команда 1"} (-0.5)`;
      } else if (optionSelected === "T2_MINUS_0.5") {
        selectedOdds = extendedOdds.handicaps[1].team2Odds;
        finalTitle = `${t2?.name || "Команда 2"} (-0.5)`;
      }
    }

    const existingSameBet = store.bets.find(
      b => b.userId === userId && b.matchId === matchId && (b.marketOption === optionSelected || b.choice === optionSelected) && b.status === "PENDING"
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
        marketType: marketType as BetMarketType,
        marketOption: optionSelected,
        choiceTitle: finalTitle,
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
