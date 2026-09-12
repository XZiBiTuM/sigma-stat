"use client";

import React, { useState, useEffect } from "react";

export interface TeamLogo {
  badgeShape?: "shield" | "hexagon" | "diamond" | "circle";
  primaryColor: string;
  secondaryColor: string;
  bgGradient?: string;
}

export interface BracketTeam {
  id: string;
  name: string;
  captain: string;
  players: string[];
  logo: TeamLogo;
}

export interface BracketMatch {
  id: string;
  round: number; // 1, 2, 3
  team1Id: string;
  team2Id: string;
  score1: number | null; // e.g. 2, 1, 0
  score2: number | null; // e.g. 0, 1, 2
  map1?: string;
  map2?: string;
  map1Score1?: number | null;
  map1Score2?: number | null;
  map2Score1?: number | null;
  map2Score2?: number | null;
  status: "UPCOMING" | "LIVE" | "FINISHED";
  roomZone?: "vip" | "main" | null;
  scheduledTime?: string;
}

export interface BracketState {
  tournamentTitle: string;
  status: "NOT_STARTED" | "LIVE" | "COMPLETED";
  teams: BracketTeam[];
  matches: BracketMatch[];
  rules?: {
    pointsWin: number;
    pointsDraw: number;
    pointsLoss: number;
    format: string;
  };
}

export interface UserBet {
  id: string;
  userId: string;
  userName: string;
  avatar?: string;
  matchId: string;
  round: number;
  team1Name: string;
  team2Name: string;
  choice: "team1" | "draw" | "team2";
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

export interface MatchOdds {
  matchId: string;
  k1: number;
  kX: number;
  k2: number;
  p1: number;
  pX: number;
  p2: number;
}

export interface PlayerOverrideItem {
  customSkillScore?: number;
  shooting?: number;
  calls?: number;
  mental?: number;
  gamesense?: number;
  aura?: number;
  customElo?: number;
  csRating?: number;
  nickname?: string;
}

export function calculateTeamSkill(team: BracketTeam | undefined, overridesMap: Record<string, PlayerOverrideItem>): { avgSkill: number; membersCount: number } {
  if (!team) return { avgSkill: 65, membersCount: 0 };
  const members = (team.players && team.players.length > 0) ? team.players : [team.captain];
  let totalSkill = 0;
  let count = 0;

  members.forEach(pName => {
    if (!pName) return;
    const clean = pName.trim();
    const lower = clean.toLowerCase();
    const ov = overridesMap[clean] || overridesMap[lower] || Object.values(overridesMap).find(o => o.nickname?.toLowerCase() === lower);
    
    let skill = 65; // realistic default average
    if (ov) {
      if (typeof ov.customSkillScore === "number" && ov.customSkillScore > 0) {
        skill = ov.customSkillScore;
      } else if (typeof ov.customElo === "number" && ov.customElo > 0) {
        // Approximate skill from Faceit Elo: 1000->50, 1500->70, 2000->85, 2500->95
        skill = Math.min(99, Math.max(30, Math.round(30 + (ov.customElo / 2500) * 65)));
      }
    }
    totalSkill += skill;
    count++;
  });

  const avg = count > 0 ? Math.round(totalSkill / count) : 65;
  return { avgSkill: avg, membersCount: count };
}

export function getBO2MatchOdds(skill1: number, skill2: number): { k1: number; kX: number; k2: number; p1: number; pX: number; p2: number } {
  const delta = skill1 - skill2;
  const pMap1 = 1 / (1 + Math.pow(10, -delta / 32));
  const pMap2 = 1 - pMap1;
  let rawP1 = pMap1 * pMap1;
  let rawP2 = pMap2 * pMap2;
  let rawPX = 2 * pMap1 * pMap2;
  rawPX = Math.max(0.25, Math.min(0.42, rawPX));
  const rem = 1 - rawPX;
  const sum12 = rawP1 + rawP2;
  if (sum12 > 0) {
    rawP1 = (rawP1 / sum12) * rem;
    rawP2 = (rawP2 / sum12) * rem;
  }
  const margin = 1.05;
  const k1 = Number((1 / (rawP1 * margin)).toFixed(2));
  const kX = Number((1 / (rawPX * margin)).toFixed(2));
  const k2 = Number((1 / (rawP2 * margin)).toFixed(2));
  return {
    k1: Math.max(1.15, Math.min(9.5, k1)),
    kX: Math.max(1.85, Math.min(6.0, kX)),
    k2: Math.max(1.15, Math.min(9.5, k2)),
    p1: Math.round(rawP1 * 100),
    pX: Math.round(rawPX * 100),
    p2: Math.round(rawP2 * 100)
  };
}

export function calculateMatchWinProbability(
  team1: BracketTeam | undefined,
  team2: BracketTeam | undefined,
  overridesMap: Record<string, PlayerOverrideItem>
): { prob1: number; prob2: number; skill1: number; skill2: number } {
  const { avgSkill: s1 } = calculateTeamSkill(team1, overridesMap);
  const { avgSkill: s2 } = calculateTeamSkill(team2, overridesMap);

  // Logistic Elo-style win probability based on skill difference
  // Skill difference of 10 gives ~65% / 35%
  const delta = s1 - s2;
  const p1 = 1 / (1 + Math.pow(10, -delta / 28));
  
  // Bound probability between 15% and 85% to keep match odds sensible and exciting
  const prob1 = Math.round(Math.min(85, Math.max(15, p1 * 100)));
  const prob2 = 100 - prob1;

  return { prob1, prob2, skill1: s1, skill2: s2 };
}

// Map team names or badgeShape to tailored esports emblem paths & accents
function getEmblemShape(shape: string | undefined, indexHint: number): string {
  const s = shape || (indexHint % 4 === 0 ? "shield" : indexHint % 4 === 1 ? "hexagon" : indexHint % 4 === 2 ? "diamond" : "circle");
  return s;
}

export const TeamBadgeLogo = ({
  logo,
  name,
  size = "md"
}: {
  logo?: TeamLogo;
  name: string;
  size?: "sm" | "md" | "lg" | "xl";
}) => {
  const s = size === "sm" ? 36 : size === "lg" ? 56 : size === "xl" ? 76 : 44;
  const fontSize = size === "sm" ? "0.75rem" : size === "lg" ? "1.15rem" : size === "xl" ? "1.45rem" : "0.92rem";

  const primary = logo?.primaryColor || "#ffc619";
  const secondary = logo?.secondaryColor || "#9d3bf5";
  const shape = logo?.badgeShape || "shield";

  // Initials (2 letters, max 3)
  const cleanName = (name || "T").replace(/^team\s+/i, "").trim();
  const initials = cleanName.length >= 2 ? cleanName.slice(0, 2).toUpperCase() : cleanName.toUpperCase();

  // Polygon clip path based on shape for an authentic pro esports emblem cut
  let clipPath = "polygon(50% 0%, 100% 15%, 100% 75%, 50% 100%, 0% 75%, 0% 15%)"; // default shield
  if (shape === "hexagon") {
    clipPath = "polygon(50% 0%, 95% 25%, 95% 75%, 50% 100%, 5% 75%, 5% 25%)";
  } else if (shape === "diamond") {
    clipPath = "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)";
  } else if (shape === "circle") {
    clipPath = "circle(48% at 50% 50%)";
  }

  return (
    <div
      style={{
        width: `${s}px`,
        height: `${s}px`,
        minWidth: `${s}px`,
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        userSelect: "none",
        filter: `drop-shadow(0 0 10px ${primary}55)`
      }}
    >
      {/* Outer Glow Shield Badge */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          clipPath,
          background: `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`,
          opacity: 0.95
        }}
      />

      {/* Inner Inset Background with Cyber Gradients */}
      <div
        style={{
          position: "absolute",
          inset: size === "sm" ? "2px" : "3px",
          clipPath,
          background: `linear-gradient(160deg, #161026 0%, #0d0918 60%, ${primary}22 100%)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        {/* Subtle Cyber Grid / Radial Flare */}
        <div
          style={{
            position: "absolute",
            top: "-20%",
            left: "-20%",
            right: "-20%",
            bottom: "-20%",
            backgroundImage: `radial-gradient(circle at 50% 20%, ${primary}44 0%, transparent 60%)`,
            pointerEvents: "none"
          }}
        />

        {/* Diagonal Tech Scanline Accent */}
        <div
          style={{
            position: "absolute",
            width: "120%",
            height: "1px",
            background: `linear-gradient(90deg, transparent, ${secondary}88, transparent)`,
            transform: "rotate(-35deg)",
            pointerEvents: "none"
          }}
        />

        {/* Team Initials */}
        <span
          style={{
            position: "relative",
            zIndex: 3,
            fontWeight: "900",
            fontSize,
            letterSpacing: "0.05em",
            color: "#ffffff",
            fontFamily: "var(--font-mono, monospace)",
            textShadow: `0 0 10px ${primary}, 0 2px 4px rgba(0,0,0,0.8)`
          }}
        >
          {initials}
        </span>
      </div>

      {/* Corner / Top Crest Micro-Dot */}
      <div
        style={{
          position: "absolute",
          top: "4px",
          width: size === "sm" ? "3px" : "4px",
          height: size === "sm" ? "3px" : "4px",
          borderRadius: "50%",
          background: "#fff",
          boxShadow: `0 0 6px ${primary}`,
          zIndex: 4
        }}
      />
    </div>
  );
};

export interface TeamStanding {
  team: BracketTeam;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  mapsWon: number;
  mapsLost: number;
  mapDiff: number;
  roundDiff: number;
  points: number;
}

export function computeStandings(
  teams: BracketTeam[],
  matches: BracketMatch[],
  rules = { pointsWin: 2, pointsDraw: 1, pointsLoss: 0 }
): TeamStanding[] {
  const standingsMap: Record<string, TeamStanding> = {};

  teams.forEach(t => {
    standingsMap[t.id] = {
      team: t,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      mapsWon: 0,
      mapsLost: 0,
      mapDiff: 0,
      roundDiff: 0,
      points: 0
    };
  });

  matches.forEach(m => {
    if (m.status !== "FINISHED" || m.score1 === null || m.score2 === null) return;
    const st1 = standingsMap[m.team1Id];
    const st2 = standingsMap[m.team2Id];
    if (!st1 || !st2) return;

    st1.played += 1;
    st2.played += 1;
    st1.mapsWon += m.score1;
    st1.mapsLost += m.score2;
    st2.mapsWon += m.score2;
    st2.mapsLost += m.score1;

    // Optional round scores difference if provided
    let r1 = 0;
    let r2 = 0;
    if (m.map1Score1 !== undefined && m.map1Score2 !== undefined && m.map1Score1 !== null && m.map1Score2 !== null) {
      r1 += m.map1Score1;
      r2 += m.map1Score2;
    }
    if (m.map2Score1 !== undefined && m.map2Score2 !== undefined && m.map2Score1 !== null && m.map2Score2 !== null) {
      r1 += m.map2Score1;
      r2 += m.map2Score2;
    }
    st1.roundDiff += r1 - r2;
    st2.roundDiff += r2 - r1;

    // BO2 Rules: 2 points for win (2:0), 1 point for draw (1:1), 0 points for loss (0:2)
    if (m.score1 > m.score2) {
      st1.won += 1;
      st1.points += rules.pointsWin; // 2
      st2.lost += 1;
      st2.points += rules.pointsLoss; // 0
    } else if (m.score2 > m.score1) {
      st2.won += 1;
      st2.points += rules.pointsWin; // 2
      st1.lost += 1;
      st1.points += rules.pointsLoss; // 0
    } else {
      st1.drawn += 1;
      st2.drawn += 1;
      st1.points += rules.pointsDraw; // 1
      st2.points += rules.pointsDraw; // 1
    }
  });

  const list = Object.values(standingsMap);
  list.forEach(item => {
    item.mapDiff = item.mapsWon - item.mapsLost;
  });

  list.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.mapDiff !== a.mapDiff) return b.mapDiff - a.mapDiff;
    if (b.mapsWon !== a.mapsWon) return b.mapsWon - a.mapsWon;
    if (b.roundDiff !== a.roundDiff) return b.roundDiff - a.roundDiff;
    if (b.won !== a.won) return b.won - a.won;
    return a.team.name.localeCompare(b.team.name);
  });

  return list;
}

export function TournamentBracketView({ 
  bracket, 
  currentUser 
}: { 
  bracket: BracketState; 
  currentUser?: any;
}) {
  const [selectedRound, setSelectedRound] = useState<number | "ALL">("ALL");
  const [playerOverrides, setPlayerOverrides] = useState<Record<string, PlayerOverrideItem>>({});

  // Betting States
  const [userWallet, setUserWallet] = useState<UserWallet | null>(null);
  const [userBets, setUserBets] = useState<UserBet[]>([]);
  const [betsLeaderboard, setBetsLeaderboard] = useState<UserWallet[]>([]);
  const [betOddsMap, setBetOddsMap] = useState<Record<string, MatchOdds>>({});
  const [activeBetTab, setActiveBetTab] = useState<"matches" | "my_bets" | "leaderboard">("matches");

  // Bet Modal State
  const [betModalOpen, setBetModalOpen] = useState(false);
  const [activeMatchForBet, setActiveMatchForBet] = useState<BracketMatch | null>(null);
  const [activeBetChoice, setActiveBetChoice] = useState<"team1" | "draw" | "team2">("team1");
  const [activeBetOdds, setActiveBetOdds] = useState<number>(2.0);
  const [betAmountInput, setBetAmountInput] = useState<string>("10000");
  const [isPlacingBet, setIsPlacingBet] = useState(false);
  const [betErrorMsg, setBetErrorMsg] = useState<string>("");
  const [betSuccessMsg, setBetSuccessMsg] = useState<string>("");

  const fetchBetsData = async () => {
    try {
      const res = await fetch("/api/bets");
      if (res.ok) {
        const data = await res.json();
        if (data.userWallet) setUserWallet(data.userWallet);
        if (data.userBets) setUserBets(data.userBets);
        if (data.leaderboard) setBetsLeaderboard(data.leaderboard);
        if (data.oddsMap) setBetOddsMap(data.oddsMap);
      }
    } catch (e) {
      console.error("Failed to fetch bets data:", e);
    }
  };

  useEffect(() => {
    fetchBetsData();
    const interval = setInterval(fetchBetsData, 10000);
    return () => clearInterval(interval);
  }, [currentUser]);

  const handleOpenBetModal = (match: BracketMatch, choice: "team1" | "draw" | "team2", odds: number) => {
    if (!currentUser) {
      alert("Для размещения ставок на турнир необходимо войти через Steam!");
      window.location.href = "/api/auth/steam/login";
      return;
    }
    setActiveMatchForBet(match);
    setActiveBetChoice(choice);
    setActiveBetOdds(odds);
    setBetErrorMsg("");
    setBetSuccessMsg("");
    setBetModalOpen(true);
  };

  const handlePlaceBetSubmit = async () => {
    if (!activeMatchForBet) return;
    const amt = parseInt(betAmountInput, 10);
    if (isNaN(amt) || amt <= 0) {
      setBetErrorMsg("Укажите корректную сумму ставки!");
      return;
    }
    if (userWallet && userWallet.balance < amt) {
      setBetErrorMsg("Недостаточно СИГМАНАТ на балансе!");
      return;
    }

    setIsPlacingBet(true);
    setBetErrorMsg("");
    setBetSuccessMsg("");

    try {
      const res = await fetch("/api/bets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchId: activeMatchForBet.id,
          choice: activeBetChoice,
          amount: amt
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setBetSuccessMsg(data.message || "Ставка успешно принята!");
        if (data.userWallet) setUserWallet(data.userWallet);
        if (data.userBets) setUserBets(data.userBets);
        setTimeout(() => {
          setBetModalOpen(false);
          setBetSuccessMsg("");
        }, 1200);
      } else {
        setBetErrorMsg(data.error || "Не удалось сделать ставку");
      }
    } catch (err: any) {
      setBetErrorMsg(err.message || "Ошибка сети");
    } finally {
      setIsPlacingBet(false);
    }
  };

  useEffect(() => {
    fetch("/api/admin/players/override")
      .then(res => res.json())
      .then(data => {
        if (data && data.overrides) {
          const map: Record<string, PlayerOverrideItem> = {};
          Object.entries(data.overrides).forEach(([k, v]: [string, any]) => {
            map[k] = v;
            if (v && v.nickname) {
              map[v.nickname] = v;
              map[v.nickname.toLowerCase()] = v;
            }
          });
          setPlayerOverrides(map);
        }
      })
      .catch(() => {});
  }, []);

  const rules = bracket.rules || { pointsWin: 2, pointsDraw: 1, pointsLoss: 0, format: "BO2" };
  const standings = computeStandings(bracket.teams || [], bracket.matches || [], rules);

  const teamMap = new Map<string, BracketTeam>();
  (bracket.teams || []).forEach(t => teamMap.set(t.id, t));

  const filteredMatches =
    selectedRound === "ALL"
      ? bracket.matches || []
      : (bracket.matches || []).filter(m => m.round === selectedRound);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem", width: "100%" }}>
      {/* 1. TOURNAMENT HERO BANNER (matching Fantasy Banner style) */}
      <div
        className="glass-card animate-fade-in"
        style={{
          padding: "2rem 2.5rem",
          borderRadius: "24px",
          background: "linear-gradient(135deg, rgba(255, 198, 25, 0.12) 0%, rgba(157, 59, 245, 0.1) 50%, rgba(6, 5, 10, 0.95) 100%)",
          border: "1.5px solid rgba(255, 198, 25, 0.35)",
          boxShadow: "0 0 50px rgba(255, 198, 25, 0.12)",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "1.5rem"
        }}
      >
        <div style={{ maxWidth: "620px" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.3rem 0.8rem",
              borderRadius: "20px",
              background: "rgba(255, 198, 25, 0.15)",
              border: "1px solid rgba(255, 198, 25, 0.4)",
              color: "#ffc619",
              fontSize: "0.75rem",
              fontWeight: "800",
              marginBottom: "0.75rem",
              textTransform: "uppercase",
              letterSpacing: "1px"
            }}
          >
            СИСТЕМА ROUND-ROBIN • 4 КОМАНДЫ • BO2
          </div>
          <h2
            style={{
              fontSize: "1.9rem",
              fontWeight: "900",
              margin: "0 0 0.5rem 0",
              color: "#ffffff",
              textShadow: "0 0 20px rgba(255, 198, 25, 0.3)",
              letterSpacing: "-0.02em"
            }}
          >
            {bracket.tournamentTitle || "SIGMA CS2 TOURNAMENT"}
          </h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem", margin: 0, lineHeight: "1.55" }}>
            Формат BO2 (две карты). Каждый играет с каждым. Начисление очков:{" "}
            <strong style={{ color: "#ffc619" }}>Победа (2:0) = 2 очка</strong>,{" "}
            <strong style={{ color: "#ab9ebc" }}>Ничья (1:1) = 1 очко</strong>,{" "}
            <strong style={{ color: "var(--text-muted)" }}>Поражение (0:2) = 0 очков</strong>.
          </p>
        </div>

                {/* USER SIGMANAT WALLET SUMMARY */}
        <div style={{
          background: "rgba(10, 8, 18, 0.75)",
          border: "1.5px solid rgba(255, 198, 25, 0.35)",
          borderRadius: "18px",
          padding: "1.1rem 1.6rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.6rem",
          boxShadow: "0 8px 30px rgba(0,0,0,0.5)",
          minWidth: "260px"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.72rem", color: "#ffc619", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              ВАШ БАЛАНС
            </span>
            <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", background: "rgba(255,255,255,0.06)", padding: "0.1rem 0.4rem", borderRadius: "4px" }}>
              СИГМАНАТ
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "baseline", gap: "0.4rem" }}>
            <span style={{ fontSize: "1.8rem", fontWeight: "900", color: "#fff", fontFamily: "var(--font-mono)", textShadow: "0 0 15px rgba(255, 198, 25, 0.4)" }}>
              {currentUser ? (userWallet?.balance ?? 100000).toLocaleString() : "100 000"}
            </span>
            <span style={{ fontSize: "0.85rem", color: "#ffc619", fontWeight: "800" }}>
              SIGMA
            </span>
          </div>

          {currentUser ? (
            <div style={{ fontSize: "0.74rem", color: "var(--text-secondary)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Ставок сделано: <strong style={{ color: "#fff" }}>{userWallet?.totalBets || 0}</strong></span>
              <span>Выигрыш: <strong style={{ color: "var(--success)" }}>+{userWallet?.totalWon ? userWallet.totalWon.toLocaleString() : 0}</strong></span>
            </div>
          ) : (
            <a
              href="/api/auth/steam/login"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.4rem",
                padding: "0.4rem 0.8rem",
                borderRadius: "8px",
                background: "linear-gradient(135deg, rgba(255, 198, 25, 0.2), rgba(255, 145, 0, 0.3))",
                border: "1px solid rgba(255, 198, 25, 0.5)",
                color: "#ffc619",
                fontSize: "0.75rem",
                fontWeight: "800",
                textDecoration: "none",
                cursor: "pointer"
              }}
            >
              Войти через Steam для ставок
            </a>
          )}
        </div>

        {standings.length > 0 && standings[0].played > 0 && (
          <div
            style={{
              background: "rgba(10, 8, 18, 0.7)",
              border: "1px solid rgba(255, 198, 25, 0.4)",
              borderRadius: "16px",
              padding: "1rem 1.4rem",
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              boxShadow: "0 8px 30px rgba(0,0,0,0.5)"
            }}
          >
            <TeamBadgeLogo logo={standings[0].team.logo} name={standings[0].team.name} size="lg" />
            <div>
              <div style={{ fontSize: "0.72rem", color: "#ffc619", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                1 МЕСТО В ТАБЛИЦЕ
              </div>
              <div style={{ fontSize: "1.1rem", fontWeight: "900", color: "#fff", marginTop: "0.15rem" }}>
                {standings[0].team.name}
              </div>
              <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
                <strong style={{ color: "#ffc619" }}>{standings[0].points} PTS</strong> ({standings[0].won}W - {standings[0].drawn}D - {standings[0].lost}L)
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. STANDINGS TABLE */}
      <div
        className="glass-card animate-fade-in"
        style={{
          padding: "1.75rem",
          borderRadius: "20px",
          background: "var(--bg-secondary)",
          border: "1px solid var(--border-light)",
          boxShadow: "var(--glass-shadow)"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.5rem" }}>
          <div>
            <h3 style={{ fontSize: "1.15rem", fontWeight: "800", color: "#fff", margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
              Турнирная таблица
            </h3>
            <span style={{ fontSize: "0.76rem", color: "var(--text-muted)" }}>
              Сортировка: Очки (PTS) &gt; Разница карт &gt; Выигранные карты &gt; Победы
            </span>
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", background: "rgba(255,255,255,0.04)", padding: "0.3rem 0.75rem", borderRadius: "8px", border: "1px solid var(--border-light)" }}>
            Победа 2:0 = 2 очка | Ничья 1:1 = 1 очко
          </div>
        </div>

        <div className="custom-table-container" style={{ border: "1px solid var(--border-light)", borderRadius: "14px" }}>
          <table className="custom-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "rgba(22, 17, 38, 0.8)", borderBottom: "1px solid var(--border-light)" }}>
                <th style={{ textAlign: "center", width: "48px", padding: "0.9rem 0.6rem" }}>#</th>
                <th style={{ textAlign: "left", padding: "0.9rem 1rem" }}>Команда</th>
                <th style={{ textAlign: "center", padding: "0.9rem 0.6rem" }}>И</th>
                <th style={{ textAlign: "center", padding: "0.9rem 0.6rem", color: "var(--success)" }}>В (2:0)</th>
                <th style={{ textAlign: "center", padding: "0.9rem 0.6rem", color: "var(--text-secondary)" }}>Н (1:1)</th>
                <th style={{ textAlign: "center", padding: "0.9rem 0.6rem", color: "var(--danger)" }}>П (0:2)</th>
                <th style={{ textAlign: "center", padding: "0.9rem 0.8rem" }}>Карты</th>
                <th style={{ textAlign: "center", padding: "0.9rem 1.2rem", color: "#ffc619", fontWeight: "900" }}>Очки (PTS)</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((st, idx) => {
                const isLeader = idx === 0 && st.played > 0;
                return (
                  <tr
                    key={st.team.id}
                    style={{
                      borderBottom: idx === standings.length - 1 ? "none" : "1px solid var(--border-light)",
                      background: isLeader ? "rgba(255, 198, 25, 0.05)" : undefined,
                      transition: "background 0.2s ease"
                    }}
                  >
                    <td style={{ textAlign: "center", padding: "0.85rem 0.6rem" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "26px",
                          height: "26px",
                          borderRadius: "8px",
                          fontSize: "0.78rem",
                          fontWeight: "900",
                          background: idx === 0 ? "#ffc619" : idx === 1 ? "rgba(255,255,255,0.15)" : idx === 2 ? "rgba(205, 127, 50, 0.3)" : "rgba(255,255,255,0.05)",
                          color: idx === 0 ? "#000" : "#fff"
                        }}
                      >
                        {idx + 1}
                      </span>
                    </td>
                    <td style={{ padding: "0.85rem 1rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
                        <TeamBadgeLogo logo={st.team.logo} name={st.team.name} size="sm" />
                        <div>
                          <div style={{ fontWeight: "800", fontSize: "0.92rem", color: isLeader ? "#ffc619" : "#fff" }}>
                            {st.team.name}
                          </div>
                          <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>
                            Капитан: <span style={{ color: "var(--text-secondary)" }}>{st.team.captain || "—"}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ textAlign: "center", padding: "0.85rem 0.6rem", fontWeight: "700", color: "var(--text-primary)" }}>
                      {st.played}
                    </td>
                    <td style={{ textAlign: "center", padding: "0.85rem 0.6rem", fontWeight: "800", color: "var(--success)" }}>
                      {st.won}
                    </td>
                    <td style={{ textAlign: "center", padding: "0.85rem 0.6rem", fontWeight: "700", color: "var(--text-secondary)" }}>
                      {st.drawn}
                    </td>
                    <td style={{ textAlign: "center", padding: "0.85rem 0.6rem", fontWeight: "800", color: "var(--danger)" }}>
                      {st.lost}
                    </td>
                    <td style={{ textAlign: "center", padding: "0.85rem 0.8rem", fontFamily: "var(--font-mono)", fontSize: "0.82rem" }}>
                      <span style={{ color: st.mapDiff > 0 ? "var(--success)" : st.mapDiff < 0 ? "var(--danger)" : "var(--text-secondary)" }}>
                        {st.mapsWon}:{st.mapsLost}
                      </span>
                      <span style={{ color: "var(--text-muted)", marginLeft: "0.4rem", fontSize: "0.74rem" }}>
                        ({st.mapDiff > 0 ? `+${st.mapDiff}` : st.mapDiff})
                      </span>
                    </td>
                    <td style={{ textAlign: "center", padding: "0.85rem 1.2rem" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "0.3rem 0.8rem",
                          borderRadius: "8px",
                          background: "rgba(255, 198, 25, 0.12)",
                          border: "1px solid rgba(255, 198, 25, 0.4)",
                          color: "#ffc619",
                          fontWeight: "900",
                          fontSize: "0.95rem",
                          fontFamily: "var(--font-mono)"
                        }}
                      >
                        {st.points}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. MATCHES SCHEDULE & RESULTS */}
      <div
        className="glass-card animate-fade-in"
        style={{
          padding: "1.75rem",
          borderRadius: "20px",
          background: "var(--bg-secondary)",
          border: "1px solid var(--border-light)",
          boxShadow: "var(--glass-shadow)"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h3 style={{ fontSize: "1.15rem", fontWeight: "800", color: "#fff", margin: 0 }}>
              Расписание и Результаты Матчей
            </h3>
            <span style={{ fontSize: "0.76rem", color: "var(--text-muted)" }}>
              3 тура, по 2 матча в каждом (формат BO2)
            </span>
          </div>

          {/* Round Selector Tabs */}
          <div style={{ display: "flex", gap: "0.4rem", background: "rgba(0,0,0,0.4)", padding: "0.25rem", borderRadius: "12px", border: "1px solid var(--border-light)" }}>
            {(["ALL", 1, 2, 3] as const).map(rnd => (
              <button
                key={rnd}
                onClick={() => setSelectedRound(rnd)}
                className="btn"
                style={{
                  padding: "0.35rem 0.85rem",
                  fontSize: "0.78rem",
                  fontWeight: "700",
                  borderRadius: "8px",
                  background: selectedRound === rnd ? "#ffc619" : "transparent",
                  color: selectedRound === rnd ? "#000" : "var(--text-secondary)",
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.2s ease"
                }}
              >
                {rnd === "ALL" ? "Все матчи" : `Тур ${rnd}`}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1rem" }}>
          {filteredMatches.map(match => {
            const team1 = teamMap.get(match.team1Id);
            const team2 = teamMap.get(match.team2Id);
            const isFinished = match.status === "FINISHED";
            const isLive = match.status === "LIVE";

            const team1Won = isFinished && (match.score1 ?? 0) > (match.score2 ?? 0);
            const team2Won = isFinished && (match.score2 ?? 0) > (match.score1 ?? 0);
            const isDraw = isFinished && match.score1 === match.score2 && match.score1 !== null;

            // Calculate win probability based on players skill scores
            const { prob1, prob2, skill1, skill2 } = calculateMatchWinProbability(team1, team2, playerOverrides);
            const team1Color = team1?.logo?.primaryColor || "#ffc619";
            const team2Color = team2?.logo?.primaryColor || "#00e5ff";

            return (
              <div
                key={match.id}
                style={{
                  background: isLive
                    ? "rgba(255, 23, 68, 0.08)"
                    : isFinished
                    ? "rgba(22, 17, 38, 0.4)"
                    : "rgba(16, 12, 28, 0.3)",
                  border: isLive
                    ? "1px solid rgba(255, 23, 68, 0.5)"
                    : isFinished
                    ? "1px solid rgba(255, 198, 25, 0.2)"
                    : "1px solid var(--border-light)",
                  borderRadius: "16px",
                  padding: "1.25rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.9rem",
                  position: "relative",
                  boxShadow: isLive ? "0 0 25px rgba(255, 23, 68, 0.15)" : undefined
                }}
              >
                {/* Match Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.74rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ fontWeight: "800", color: "#ffc619", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      ТУР {match.round}
                    </span>
                    <span style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>• BO2</span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    {isLive ? (
                      <span
                        style={{
                          padding: "0.15rem 0.55rem",
                          borderRadius: "12px",
                          background: "rgba(255, 23, 68, 0.2)",
                          border: "1px solid rgba(255, 23, 68, 0.4)",
                          color: "#ff1744",
                          fontWeight: "800",
                          fontSize: "0.7rem",
                          letterSpacing: "0.05em"
                        }}
                      >
                        LIVE
                      </span>
                    ) : isFinished ? (
                      <span
                        style={{
                          padding: "0.15rem 0.55rem",
                          borderRadius: "12px",
                          background: "rgba(0, 230, 118, 0.12)",
                          border: "1px solid rgba(0, 230, 118, 0.3)",
                          color: "var(--success)",
                          fontWeight: "700",
                          fontSize: "0.7rem"
                        }}
                      >
                        Завершён
                      </span>
                    ) : (
                      <span
                        style={{
                          padding: "0.15rem 0.55rem",
                          borderRadius: "12px",
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid var(--border-light)",
                          color: "var(--text-muted)",
                          fontSize: "0.7rem"
                        }}
                      >
                        Ожидается
                      </span>
                    )}
                  </div>
                </div>

                {/* Team 1 Row */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.75rem 0.9rem",
                    borderRadius: "12px",
                    background: team1Won ? "rgba(255, 198, 25, 0.1)" : "rgba(255,255,255,0.03)",
                    border: team1Won ? "1px solid rgba(255, 198, 25, 0.3)" : "1px solid transparent"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", minWidth: 0 }}>
                    <TeamBadgeLogo logo={team1?.logo} name={team1?.name || "T1"} size="sm" />
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: "800",
                          fontSize: "0.88rem",
                          color: team1Won ? "#ffc619" : "#fff",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis"
                        }}
                      >
                        {team1?.name || "Команда 1"}
                      </div>
                      <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                        Капитан: {team1?.captain || "—"}
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "1.2rem",
                      fontWeight: "900",
                      color: team1Won ? "#ffc619" : isFinished ? "#fff" : "var(--text-muted)",
                      marginLeft: "1rem"
                    }}
                  >
                    {isFinished || isLive ? match.score1 ?? 0 : "-"}
                  </div>
                </div>

                {/* VS Indicator & Win Probability Bar */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", padding: "0.2rem 0.4rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.68rem", fontWeight: "800" }}>
                    <span style={{ color: prob1 >= prob2 ? team1Color : "var(--text-secondary)", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                      <span>{prob1}%</span>
                      <span style={{ fontSize: "0.6rem", color: "var(--text-muted)", fontWeight: "500" }}>({skill1} PWR)</span>
                    </span>

                    <span style={{ fontSize: "0.68rem", fontWeight: "900", color: isDraw ? "#ffc619" : "var(--text-muted)", letterSpacing: "0.08em" }}>
                      {isDraw ? "НИЧЬЯ (1:1)" : "Шанс на победу"}
                    </span>

                    <span style={{ color: prob2 >= prob1 ? team2Color : "var(--text-secondary)", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                      <span style={{ fontSize: "0.6rem", color: "var(--text-muted)", fontWeight: "500" }}>({skill2} PWR)</span>
                      <span>{prob2}%</span>
                    </span>
                  </div>

                  {/* Dual-Color Probability Progress Bar */}
                  <div
                    style={{
                      height: "5px",
                      width: "100%",
                      borderRadius: "6px",
                      background: "rgba(255, 255, 255, 0.08)",
                      display: "flex",
                      overflow: "hidden",
                      position: "relative"
                    }}
                    title={`Шанс на победу: ${team1?.name || "Команда 1"} ${prob1}% vs ${prob2}% ${team2?.name || "Команда 2"}`}
                  >
                    <div
                      style={{
                        width: `${prob1}%`,
                        height: "100%",
                        background: `linear-gradient(90deg, ${team1Color}cc, ${team1Color})`,
                        transition: "width 0.4s ease"
                      }}
                    />
                    <div
                      style={{
                        width: `${prob2}%`,
                        height: "100%",
                        background: `linear-gradient(90deg, ${team2Color}, ${team2Color}cc)`,
                        transition: "width 0.4s ease"
                      }}
                    />
                  </div>
                </div>

                {/* Team 2 Row */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.75rem 0.9rem",
                    borderRadius: "12px",
                    background: team2Won ? "rgba(255, 198, 25, 0.1)" : "rgba(255,255,255,0.03)",
                    border: team2Won ? "1px solid rgba(255, 198, 25, 0.3)" : "1px solid transparent"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", minWidth: 0 }}>
                    <TeamBadgeLogo logo={team2?.logo} name={team2?.name || "T2"} size="sm" />
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: "800",
                          fontSize: "0.88rem",
                          color: team2Won ? "#ffc619" : "#fff",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis"
                        }}
                      >
                        {team2?.name || "Команда 2"}
                      </div>
                      <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                        Капитан: {team2?.captain || "—"}
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "1.2rem",
                      fontWeight: "900",
                      color: team2Won ? "#ffc619" : isFinished ? "#fff" : "var(--text-muted)",
                      marginLeft: "1rem"
                    }}
                  >
                    {isFinished || isLive ? match.score2 ?? 0 : "-"}
                  </div>
                </div>

                {/* BETTING ODDS PANEL */}
                {(() => {
                  const odds = betOddsMap[match.id] || getBO2MatchOdds(skill1, skill2);
                  const isUpcoming = match.status === "UPCOMING";
                  const myMatchBets = userBets.filter(b => b.matchId === match.id);

                  return (
                    <div style={{
                      marginTop: "0.25rem",
                      background: "rgba(10, 8, 18, 0.6)",
                      border: "1px solid rgba(255, 198, 25, 0.2)",
                      borderRadius: "12px",
                      padding: "0.75rem 0.85rem",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.5rem"
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.72rem" }}>
                        <span style={{ color: "#ffc619", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                          <span>💰</span>
                          <span>Ставки на матч (СИГМАНАТ)</span>
                        </span>
                        {!isUpcoming && (
                          <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontStyle: "italic" }}>
                            Ставки закрыты
                          </span>
                        )}
                      </div>

                      {/* Odds Buttons */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.45rem" }}>
                        {/* 1. Team 1 */}
                        <button
                          type="button"
                          disabled={!isUpcoming}
                          onClick={() => handleOpenBetModal(match, "team1", odds.k1)}
                          style={{
                            padding: "0.45rem 0.3rem",
                            borderRadius: "8px",
                            background: "rgba(255, 198, 25, 0.08)",
                            border: "1px solid rgba(255, 198, 25, 0.3)",
                            color: "#fff",
                            cursor: isUpcoming ? "pointer" : "not-allowed",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: "0.15rem",
                            transition: "all 0.2s ease"
                          }}
                          title={`Поставить на победу ${team1?.name || "Команда 1"} с кэфом ${odds.k1}`}
                        >
                          <span style={{ fontSize: "0.66rem", color: "var(--text-muted)", fontWeight: "700", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "90%" }}>
                            П1 ({(team1?.name || "T1").replace(/^team\s+/i, "").slice(0, 4)})
                          </span>
                          <span style={{ fontSize: "0.88rem", fontWeight: "900", color: "#ffc619", fontFamily: "var(--font-mono)" }}>
                            {odds.k1.toFixed(2)}
                          </span>
                        </button>

                        {/* 2. Draw */}
                        <button
                          type="button"
                          disabled={!isUpcoming}
                          onClick={() => handleOpenBetModal(match, "draw", odds.kX)}
                          style={{
                            padding: "0.45rem 0.3rem",
                            borderRadius: "8px",
                            background: "rgba(157, 59, 245, 0.08)",
                            border: "1px solid rgba(157, 59, 245, 0.3)",
                            color: "#fff",
                            cursor: isUpcoming ? "pointer" : "not-allowed",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: "0.15rem",
                            transition: "all 0.2s ease"
                          }}
                          title={`Поставить на ничью (1:1) с кэфом ${odds.kX}`}
                        >
                          <span style={{ fontSize: "0.66rem", color: "var(--text-muted)", fontWeight: "700" }}>
                            НИЧЬЯ (1:1)
                          </span>
                          <span style={{ fontSize: "0.88rem", fontWeight: "900", color: "#b388ff", fontFamily: "var(--font-mono)" }}>
                            {odds.kX.toFixed(2)}
                          </span>
                        </button>

                        {/* 3. Team 2 */}
                        <button
                          type="button"
                          disabled={!isUpcoming}
                          onClick={() => handleOpenBetModal(match, "team2", odds.k2)}
                          style={{
                            padding: "0.45rem 0.3rem",
                            borderRadius: "8px",
                            background: "rgba(0, 229, 255, 0.08)",
                            border: "1px solid rgba(0, 229, 255, 0.3)",
                            color: "#fff",
                            cursor: isUpcoming ? "pointer" : "not-allowed",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: "0.15rem",
                            transition: "all 0.2s ease"
                          }}
                          title={`Поставить на победу ${team2?.name || "Команда 2"} с кэфом ${odds.k2}`}
                        >
                          <span style={{ fontSize: "0.66rem", color: "var(--text-muted)", fontWeight: "700", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "90%" }}>
                            П2 ({(team2?.name || "T2").replace(/^team\s+/i, "").slice(0, 4)})
                          </span>
                          <span style={{ fontSize: "0.88rem", fontWeight: "900", color: "#00e5ff", fontFamily: "var(--font-mono)" }}>
                            {odds.k2.toFixed(2)}
                          </span>
                        </button>
                      </div>

                      {/* My Active Bets on this match */}
                      {myMatchBets.length > 0 && (
                        <div style={{ marginTop: "0.2rem", paddingTop: "0.4rem", borderTop: "1px dashed rgba(255,255,255,0.08)" }}>
                          <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>Ваши ставки на этот матч:</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                            {myMatchBets.map(b => {
                              const outcomeName = b.choice === "team1" ? team1?.name : b.choice === "draw" ? "Ничья (1:1)" : team2?.name;
                              return (
                                <div key={b.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.72rem", background: "rgba(255,255,255,0.03)", padding: "0.2rem 0.45rem", borderRadius: "6px" }}>
                                  <span style={{ color: "#fff", fontWeight: "700" }}>{outcomeName} ({b.odds.toFixed(2)})</span>
                                  <span style={{ color: b.status === "WON" ? "var(--success)" : b.status === "LOST" ? "var(--danger)" : "#ffc619", fontWeight: "800", fontFamily: "var(--font-mono)" }}>
                                    {b.amount.toLocaleString()} ➦ {b.status === "WON" ? `+${b.payout.toLocaleString()}` : b.status === "LOST" ? "Проигрыш" : `до ${b.potentialWin.toLocaleString()}`}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. BETS & SIGMANAT LEADERBOARD SECTION */}
      <div
        className="glass-card animate-fade-in"
        style={{
          padding: "1.75rem",
          borderRadius: "20px",
          background: "var(--bg-secondary)",
          border: "1px solid var(--border-light)",
          boxShadow: "var(--glass-shadow)"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h3 style={{ fontSize: "1.15rem", fontWeight: "800", color: "#fff", margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
              💰 Ставки и Топ по СИГМАНАТ
            </h3>
            <span style={{ fontSize: "0.76rem", color: "var(--text-muted)" }}>
              Стартовый капитал 100 000 СИГМАНАТ • Автоматический расчёт побед
            </span>
          </div>

          <div style={{ display: "flex", gap: "0.4rem", background: "rgba(0,0,0,0.4)", padding: "0.25rem", borderRadius: "12px", border: "1px solid var(--border-light)" }}>
            <button
              onClick={() => setActiveBetTab("matches")}
              style={{
                padding: "0.35rem 0.85rem",
                fontSize: "0.78rem",
                fontWeight: "700",
                borderRadius: "8px",
                background: activeBetTab === "matches" ? "#ffc619" : "transparent",
                color: activeBetTab === "matches" ? "#000" : "var(--text-secondary)",
                border: "none",
                cursor: "pointer"
              }}
            >
              Мои ставки ({userBets.length})
            </button>
            <button
              onClick={() => setActiveBetTab("leaderboard")}
              style={{
                padding: "0.35rem 0.85rem",
                fontSize: "0.78rem",
                fontWeight: "700",
                borderRadius: "8px",
                background: activeBetTab === "leaderboard" ? "#ffc619" : "transparent",
                color: activeBetTab === "leaderboard" ? "#000" : "var(--text-secondary)",
                border: "none",
                cursor: "pointer"
              }}
            >
              Топ миллионеров ({betsLeaderboard.length})
            </button>
          </div>
        </div>

        {activeBetTab === "matches" ? (
          <div>
            {!currentUser ? (
              <div style={{ textAlign: "center", padding: "2.5rem 1.5rem", color: "var(--text-muted)" }}>
                <p style={{ margin: "0 0 1rem 0" }}>Авторизуйтесь через Steam, чтобы делать ставки и отслеживать историю.</p>
                <a
                  href="/api/auth/steam/login"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    padding: "0.5rem 1.2rem",
                    borderRadius: "10px",
                    background: "#ffc619",
                    color: "#000",
                    fontWeight: "800",
                    fontSize: "0.85rem",
                    textDecoration: "none"
                  }}
                >
                  Войти через Steam
                </a>
              </div>
            ) : userBets.length === 0 ? (
              <div style={{ textAlign: "center", padding: "2.5rem 1.5rem", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                Вы ещё не сделали ни одной ставки. Нажмите на коэффициент матча выше, чтобы зарядить СИГМАНАТ!
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "0.75rem" }}>
                {userBets.map(bet => (
                  <div
                    key={bet.id}
                    style={{
                      background: "rgba(10, 8, 18, 0.6)",
                      border: bet.status === "WON" ? "1px solid rgba(0, 230, 118, 0.4)" : bet.status === "LOST" ? "1px solid rgba(255, 23, 68, 0.3)" : "1px solid var(--border-light)",
                      borderRadius: "12px",
                      padding: "0.9rem",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.4rem"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.74rem" }}>
                      <span style={{ color: "var(--text-muted)" }}>Тур {bet.round} • {bet.team1Name} vs {bet.team2Name}</span>
                      <span style={{
                        padding: "0.1rem 0.45rem",
                        borderRadius: "6px",
                        fontSize: "0.68rem",
                        fontWeight: "800",
                        background: bet.status === "WON" ? "rgba(0, 230, 118, 0.15)" : bet.status === "LOST" ? "rgba(255, 23, 68, 0.15)" : "rgba(255, 198, 25, 0.15)",
                        color: bet.status === "WON" ? "var(--success)" : bet.status === "LOST" ? "var(--danger)" : "#ffc619"
                      }}>
                        {bet.status === "WON" ? "ВЫИГРЫШ" : bet.status === "LOST" ? "ПРОИГРЫШ" : "В ИГРЕ"}
                      </span>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.2rem" }}>
                      <span style={{ fontSize: "0.9rem", fontWeight: "800", color: "#fff" }}>
                        {bet.choice === "team1" ? `Победа ${bet.team1Name}` : bet.choice === "draw" ? "Ничья (1:1)" : `Победа ${bet.team2Name}`}
                      </span>
                      <span style={{ fontFamily: "var(--font-mono)", fontWeight: "900", color: "#ffc619", fontSize: "0.95rem" }}>
                        x{bet.odds.toFixed(2)}
                      </span>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.75rem", borderTop: "1px dashed rgba(255,255,255,0.06)", paddingTop: "0.4rem", marginTop: "0.2rem" }}>
                      <span style={{ color: "var(--text-muted)" }}>Ставка: <strong style={{ color: "#fff" }}>{bet.amount.toLocaleString()}</strong></span>
                      <span style={{ color: bet.status === "WON" ? "var(--success)" : "#fff", fontWeight: "800" }}>
                        {bet.status === "WON" ? `Выплата: +${bet.payout.toLocaleString()}` : `Возможный выигрыш: ${bet.potentialWin.toLocaleString()}`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="custom-table-container" style={{ border: "1px solid var(--border-light)", borderRadius: "14px" }}>
              <table className="custom-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "rgba(22, 17, 38, 0.8)", borderBottom: "1px solid var(--border-light)" }}>
                    <th style={{ textAlign: "center", width: "48px", padding: "0.75rem 0.5rem" }}>#</th>
                    <th style={{ textAlign: "left", padding: "0.75rem 1rem" }}>Игрок</th>
                    <th style={{ textAlign: "center", padding: "0.75rem 0.6rem" }}>Ставок</th>
                    <th style={{ textAlign: "center", padding: "0.75rem 0.6rem", color: "var(--success)" }}>Выиграно</th>
                    <th style={{ textAlign: "right", padding: "0.75rem 1.2rem", color: "#ffc619", fontWeight: "900" }}>Баланс СИГМАНАТ</th>
                  </tr>
                </thead>
                <tbody>
                  {betsLeaderboard.map((w, idx) => (
                    <tr key={w.userId} style={{ borderBottom: "1px solid var(--border-light)" }}>
                      <td style={{ textAlign: "center", padding: "0.75rem 0.5rem", fontWeight: "800", color: idx === 0 ? "#ffc619" : "#fff" }}>
                        {idx + 1}
                      </td>
                      <td style={{ padding: "0.75rem 1rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                          {w.avatar ? (
                            <img src={w.avatar} alt="Avatar" style={{ width: "26px", height: "26px", borderRadius: "50%" }} />
                          ) : (
                            <div style={{ width: "26px", height: "26px", borderRadius: "50%", background: "#ffc619", color: "#000", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "900", fontSize: "0.75rem" }}>
                              {w.userName.slice(0, 1)}
                            </div>
                          )}
                          <span style={{ fontWeight: "700", color: "#fff", fontSize: "0.85rem" }}>{w.userName}</span>
                        </div>
                      </td>
                      <td style={{ textAlign: "center", padding: "0.75rem 0.6rem", color: "var(--text-secondary)", fontSize: "0.82rem" }}>
                        {w.totalBets}
                      </td>
                      <td style={{ textAlign: "center", padding: "0.75rem 0.6rem", color: "var(--success)", fontWeight: "800", fontFamily: "var(--font-mono)", fontSize: "0.82rem" }}>
                        +{w.totalWon.toLocaleString()}
                      </td>
                      <td style={{ textAlign: "right", padding: "0.75rem 1.2rem", color: "#ffc619", fontWeight: "900", fontFamily: "var(--font-mono)", fontSize: "0.95rem" }}>
                        {w.balance.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* BET PLACEMENT MODAL */}
      {betModalOpen && activeMatchForBet && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.75)",
          backdropFilter: "blur(8px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          padding: "1rem"
        }}>
          <div style={{
            background: "#120e20",
            border: "1.5px solid rgba(255, 198, 25, 0.4)",
            borderRadius: "20px",
            padding: "1.75rem",
            maxWidth: "420px",
            width: "100%",
            boxShadow: "0 0 50px rgba(0,0,0,0.8)",
            display: "flex",
            flexDirection: "column",
            gap: "1.1rem"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: "1.05rem", fontWeight: "900", color: "#fff", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <span>💰 Сделать ставку</span>
              </div>
              <button
                onClick={() => setBetModalOpen(false)}
                style={{ background: "transparent", border: "none", color: "var(--text-muted)", fontSize: "1.1rem", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            {/* Match info & Selected Choice */}
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px", padding: "0.85rem" }}>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
                Тур {activeMatchForBet.round} • Формат BO2
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.4rem" }}>
                <span style={{ fontWeight: "800", color: "#fff", fontSize: "0.92rem" }}>
                  {activeBetChoice === "team1"
                    ? `Победа ${teamMap.get(activeMatchForBet.team1Id)?.name || "Команда 1"}`
                    : activeBetChoice === "draw"
                    ? "Ничья (1:1)"
                    : `Победа ${teamMap.get(activeMatchForBet.team2Id)?.name || "Команда 2"}`}
                </span>
                <span style={{ fontSize: "1.1rem", fontWeight: "900", color: "#ffc619", fontFamily: "var(--font-mono)" }}>
                  x{activeBetOdds.toFixed(2)}
                </span>
              </div>
            </div>

            {/* User current balance */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.75rem", padding: "0 0.2rem" }}>
              <span style={{ color: "var(--text-secondary)" }}>Ваш баланс:</span>
              <strong style={{ color: "#ffc619", fontFamily: "var(--font-mono)" }}>
                {(userWallet?.balance ?? 100000).toLocaleString()} СИГМАНАТ
              </strong>
            </div>

            {/* Amount input */}
            <div>
              <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: "700", display: "block", marginBottom: "0.4rem" }}>
                Сумма ставки (СИГМАНАТ):
              </label>
              <input
                type="number"
                min="100"
                step="1000"
                value={betAmountInput}
                onChange={e => setBetAmountInput(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.7rem 1rem",
                  borderRadius: "10px",
                  background: "#080611",
                  border: "1px solid rgba(255, 198, 25, 0.4)",
                  color: "#fff",
                  fontSize: "1.1rem",
                  fontWeight: "800",
                  fontFamily: "var(--font-mono)"
                }}
              />

              {/* Quick amount buttons */}
              <div style={{ display: "flex", gap: "0.35rem", marginTop: "0.5rem" }}>
                {[5000, 10000, 25000, 50000].map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setBetAmountInput(val.toString())}
                    style={{
                      flex: 1,
                      padding: "0.3rem 0",
                      fontSize: "0.68rem",
                      fontWeight: "700",
                      borderRadius: "6px",
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "var(--text-secondary)",
                      cursor: "pointer"
                    }}
                  >
                    +{val >= 1000 ? `${val / 1000}k` : val}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setBetAmountInput((userWallet?.balance || 100000).toString())}
                  style={{
                    flex: 1,
                    padding: "0.3rem 0",
                    fontSize: "0.68rem",
                    fontWeight: "800",
                    borderRadius: "6px",
                    background: "rgba(255, 23, 68, 0.15)",
                    border: "1px solid rgba(255, 23, 68, 0.3)",
                    color: "#ff1744",
                    cursor: "pointer"
                  }}
                >
                  ALL-IN
                </button>
              </div>
            </div>

            {/* Potential payout */}
            <div style={{ background: "rgba(255, 198, 25, 0.08)", border: "1px solid rgba(255, 198, 25, 0.25)", borderRadius: "10px", padding: "0.75rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.76rem", color: "#fff", fontWeight: "700" }}>Возможный выигрыш:</span>
              <span style={{ fontSize: "1.05rem", fontWeight: "900", color: "#ffc619", fontFamily: "var(--font-mono)" }}>
                {(() => {
                  const amt = parseInt(betAmountInput, 10);
                  if (isNaN(amt) || amt <= 0) return "0";
                  return Math.round(amt * activeBetOdds).toLocaleString();
                })()} СИГМАНАТ
              </span>
            </div>

            {/* Error / Success messages */}
            {betErrorMsg && (
              <div style={{ fontSize: "0.75rem", color: "#ff4949", background: "rgba(255, 73, 73, 0.1)", border: "1px solid rgba(255, 73, 73, 0.3)", borderRadius: "8px", padding: "0.5rem" }}>
                {betErrorMsg}
              </div>
            )}
            {betSuccessMsg && (
              <div style={{ fontSize: "0.75rem", color: "var(--success)", background: "rgba(0, 230, 118, 0.1)", border: "1px solid rgba(0, 230, 118, 0.3)", borderRadius: "8px", padding: "0.5rem" }}>
                {betSuccessMsg}
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: "flex", gap: "0.6rem", marginTop: "0.2rem" }}>
              <button
                type="button"
                onClick={() => setBetModalOpen(false)}
                style={{
                  flex: 1,
                  padding: "0.65rem",
                  borderRadius: "10px",
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid var(--border-light)",
                  color: "#fff",
                  fontWeight: "700",
                  fontSize: "0.82rem",
                  cursor: "pointer"
                }}
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handlePlaceBetSubmit}
                disabled={isPlacingBet}
                style={{
                  flex: 2,
                  padding: "0.65rem",
                  borderRadius: "10px",
                  background: "linear-gradient(135deg, #ffc619, #ff9100)",
                  border: "none",
                  color: "#000",
                  fontWeight: "900",
                  fontSize: "0.88rem",
                  cursor: isPlacingBet ? "not-allowed" : "pointer",
                  boxShadow: "0 0 20px rgba(255, 198, 25, 0.4)"
                }}
              >
                {isPlacingBet ? "Размещение..." : "Поставить СИГМАНАТ"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. TEAMS ROSTER OVERVIEW */}
      <div
        className="glass-card animate-fade-in"
        style={{
          padding: "1.75rem",
          borderRadius: "20px",
          background: "var(--bg-secondary)",
          border: "1px solid var(--border-light)",
          boxShadow: "var(--glass-shadow)"
        }}
      >
        <h3 style={{ fontSize: "1.15rem", fontWeight: "800", color: "#fff", marginBottom: "1.25rem", margin: 0 }}>
          Составы Команд Турнира
        </h3>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: "1rem", marginTop: "1rem" }}>
          {(bracket.teams || []).map(team => (
            <div
              key={team.id}
              style={{
                background: "rgba(22, 17, 38, 0.4)",
                border: "1px solid var(--border-light)",
                borderRadius: "14px",
                padding: "1.25rem",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center"
              }}
            >
              <div style={{ marginBottom: "0.75rem" }}>
                <TeamBadgeLogo logo={team.logo} name={team.name} size="lg" />
              </div>
              <div style={{ fontWeight: "900", color: "#fff", fontSize: "1rem" }}>
                {team.name}
              </div>
              <div style={{ fontSize: "0.78rem", color: "#ffc619", fontWeight: "700", marginTop: "0.2rem", marginBottom: "0.9rem" }}>
                Капитан: {team.captain || "—"}
              </div>

              <div
                style={{
                  width: "100%",
                  background: "rgba(10, 8, 18, 0.6)",
                  borderRadius: "10px",
                  padding: "0.75rem",
                  border: "1px solid rgba(255,255,255,0.04)",
                  textAlign: "left",
                  fontSize: "0.76rem"
                }}
              >
                <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: "800", textTransform: "uppercase", marginBottom: "0.4rem" }}>
                  Состав (5 игроков):
                </div>
                {(team.players || []).length > 0 ? (
                  (team.players || []).map((m, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.4rem",
                        padding: "0.2rem 0",
                        color: m.toLowerCase() === (team.captain || "").toLowerCase() ? "#ffc619" : "var(--text-primary)",
                        fontWeight: m.toLowerCase() === (team.captain || "").toLowerCase() ? "800" : "500"
                      }}
                    >
                      <span style={{ color: "var(--text-muted)", fontSize: "0.68rem", width: "16px" }}>#{idx + 1}</span>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m}</span>
                      {m.toLowerCase() === (team.captain || "").toLowerCase() && (
                        <span style={{ fontSize: "0.65rem", padding: "0.05rem 0.25rem", borderRadius: "4px", background: "rgba(255, 198, 25, 0.15)", border: "1px solid rgba(255, 198, 25, 0.3)", color: "#ffc619" }}>
                          (C)
                        </span>
                      )}
                    </div>
                  ))
                ) : (
                  <div style={{ color: "var(--text-muted)", fontStyle: "italic" }}>Игроки не сформированы</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
