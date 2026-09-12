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

export interface UserBet {
  id: string;
  userId: string; // Steam ID
  userName: string;
  avatar?: string;
  matchId: string;
  round: number;
  team1Name: string;
  team2Name: string;
  choice: "team1" | "draw" | "team2"; // 1, X, 2
  odds: number; // e.g. 1.85
  amount: number; // amount of СИГМАНАТ
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

export interface MatchOdds {
  matchId: string;
  k1: number; // Team 1 Win (2:0)
  kX: number; // Draw (1:1)
  k2: number; // Team 2 Win (0:2)
  p1: number; // percentage
  pX: number; // percentage
  p2: number; // percentage
}

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

// Odds Calculation Engine for BO2
export function calculateMatchOdds(
  avgSkill1: number,
  avgSkill2: number
): { k1: number; kX: number; k2: number; p1: number; pX: number; p2: number } {
  // Single map win probability based on skill difference
  const delta = avgSkill1 - avgSkill2;
  const pMap1 = 1 / (1 + Math.pow(10, -delta / 32));
  const pMap2 = 1 - pMap1;

  // In BO2 series:
  // 2:0 is pMap1 * pMap1
  // 0:2 is pMap2 * pMap2
  // 1:1 is 2 * pMap1 * pMap2
  let rawP1 = pMap1 * pMap1;
  let rawP2 = pMap2 * pMap2;
  let rawPX = 2 * pMap1 * pMap2;

  // Keep draw probability balanced for Counter-Strike BO2 (~25% to 42%)
  rawPX = Math.max(0.25, Math.min(0.42, rawPX));
  const rem = 1 - rawPX;
  const sum12 = rawP1 + rawP2;
  if (sum12 > 0) {
    rawP1 = (rawP1 / sum12) * rem;
    rawP2 = (rawP2 / sum12) * rem;
  }

  // Add 5% bookmaker margin
  const margin = 1.05;
  const k1 = Number((1 / (rawP1 * margin)).toFixed(2));
  const kX = Number((1 / (rawPX * margin)).toFixed(2));
  const k2 = Number((1 / (rawP2 * margin)).toFixed(2));

  // Bound odds between 1.15 and 9.50
  return {
    k1: Math.max(1.15, Math.min(9.5, k1)),
    kX: Math.max(1.85, Math.min(6.0, kX)),
    k2: Math.max(1.15, Math.min(9.5, k2)),
    p1: Math.round(rawP1 * 100),
    pX: Math.round(rawPX * 100),
    p2: Math.round(rawP2 * 100)
  };
}

// Settle completed matches and credit winners
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
      let winningChoice: "team1" | "draw" | "team2" = "draw";
      if (m.score1 > m.score2) winningChoice = "team1";
      else if (m.score2 > m.score1) winningChoice = "team2";
      else winningChoice = "draw";

      const wallet = store.wallets[bet.userId];

      if (bet.choice === winningChoice) {
        // WIN!
        bet.status = "WON";
        bet.payout = Math.round(bet.amount * bet.odds);
        bet.settledAt = Date.now();

        if (wallet) {
          wallet.balance += bet.payout;
          wallet.totalWon += bet.payout;
          wallet.updatedAt = Date.now();
        }
      } else {
        // LOSS
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
        // Initialize new wallet with 100,000 СИГМАНАТ!
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
        // Sync profile info if changed
        const w = store.wallets[userId];
        if (currentUser?.steamName && w.userName !== currentUser.steamName) w.userName = currentUser.steamName;
        if (currentUser?.steamAvatar && !w.avatar) w.avatar = currentUser.steamAvatar;
      }

      userWallet = store.wallets[userId];
      userBets = store.bets.filter(b => b.userId === userId).sort((a, b) => b.createdAt - a.createdAt);
    }

    // Compute Odds for all matches in the bracket
    const oddsMap: Record<string, MatchOdds> = {};
    if (bracket?.matches && bracket?.teams) {
      const teamMap = new Map<string, any>();
      bracket.teams.forEach((t: any) => teamMap.set(t.id, t));

      bracket.matches.forEach((m: any) => {
        const t1 = teamMap.get(m.team1Id);
        const t2 = teamMap.get(m.team2Id);

        // Helper to get team skill
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
        oddsMap[m.id] = {
          matchId: m.id,
          ...o
        };
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
    // 1. Must be authenticated via Steam
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
    const { matchId, choice, amount } = body;

    const betAmount = parseInt(amount, 10);
    if (isNaN(betAmount) || betAmount <= 0) {
      return NextResponse.json({ success: false, error: "Укажите корректную сумму ставки в СИГМАНАТ!" }, { status: 400 });
    }

    if (!["team1", "draw", "team2"].includes(choice)) {
      return NextResponse.json({ success: false, error: "Некорректный выбор исхода (team1 / draw / team2)" }, { status: 400 });
    }

    // 2. Load Store and Bracket
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

    // Match must be UPCOMING to accept bets
    if (match.status !== "UPCOMING") {
      return NextResponse.json(
        { success: false, error: "Ставки на этот матч уже закрыты (матч идёт LIVE или завершён)!" },
        { status: 400 }
      );
    }

    // Initialize or get wallet
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

    // Check if user already placed a bet on this specific choice for this match
    const existingSameBet = store.bets.find(
      b => b.userId === userId && b.matchId === matchId && b.choice === choice && b.status === "PENDING"
    );

    // Calculate current odds for this match
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

    const odds = calculateMatchOdds(getSkill(t1), getSkill(t2));
    const selectedOdds = choice === "team1" ? odds.k1 : choice === "draw" ? odds.kX : odds.k2;

    // Deduct balance
    wallet.balance -= betAmount;
    wallet.totalBets += 1;
    wallet.updatedAt = Date.now();

    if (existingSameBet) {
      // Increase existing pending bet
      existingSameBet.amount += betAmount;
      existingSameBet.potentialWin = Math.round(existingSameBet.amount * existingSameBet.odds);
    } else {
      // Create new bet
      const newBet: UserBet = {
        id: "bet_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
        userId,
        userName: wallet.userName,
        avatar: wallet.avatar,
        matchId,
        round: match.round,
        team1Name: t1?.name || "Команда 1",
        team2Name: t2?.name || "Команда 2",
        choice: choice as any,
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
      message: "Ставка принята! Списано: " + betAmount.toLocaleString() + " СИГМАНАТ",
      userWallet: wallet,
      userBets: store.bets.filter(b => b.userId === userId).sort((a, b) => b.createdAt - a.createdAt)
    });
  } catch (error: any) {
    console.error("Error in placing bet POST:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
