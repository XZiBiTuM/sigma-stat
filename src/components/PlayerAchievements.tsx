"use client";

import React from "react";

export interface AchievementItem {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  category?: "combat" | "maps" | "special";
  unlocked: boolean;
  progressText: string;
  percent: number;
  color: string;
  glowColor: string;
  bgGradient: string;
  iconSvg: React.ReactNode;
}

export function computePlayerAchievements(params: {
  hubStats?: any;
  profile?: any;
  leetify?: any;
  currentStreak?: number;
  hubPlayed?: number;
  hubWon?: number;
}): AchievementItem[] {
  const { hubStats, profile, leetify, currentStreak = 0, hubPlayed = 0, hubWon = 0 } = params;

  // 1. Headshot Master (HS% >= 55%) -> "Охотник за головами"
  const hsPct = parseFloat(String(hubStats?.hsPct ?? profile?.lifetime?.["Average Headshots %"] ?? profile?.stats?.["Average Headshots %"] ?? 0)) || 0;
  const hsUnlocked = hsPct >= 55;
  const hsPercent = Math.min(100, Math.round((hsPct / 55) * 100));

  // 2. Carry -> "Самый ценный игрок" (Strictly HLTV >= 1.20)
  const hltv = parseFloat(String(hubStats?.hltv ?? hubStats?.hltvRating ?? 0)) || 0;
  const impactUnlocked = hltv >= 1.20;
  const impactPercent = Math.min(100, Math.round((hltv / 1.20) * 100));

  // 3. Clutch Minister -> "Клач-министр" (Based on clutches won in hub)
  const played = hubPlayed || hubStats?.matchesCount || hubStats?.matches || 0;
  const c1v1 = hubStats?.duels?.clutch1v1Wins || 0;
  const c1v2 = hubStats?.duels?.clutch1v2Wins || 0;
  const c1v3 = hubStats?.duels?.clutch1v3Wins || 0;
  const c1v4 = hubStats?.duels?.clutch1v4Wins || 0;
  const c1v5 = hubStats?.duels?.clutch1v5Wins || 0;
  const clutchWins = c1v1 + c1v2 + c1v3 + c1v4 + c1v5;
  const clutchUnlocked = clutchWins >= 10 || (clutchWins >= 5 && (hubStats?.duels?.clutch1v1Rate || 0) >= 50);
  const clutchPercent = Math.min(100, Math.round((clutchWins / 10) * 100));

  // 4. Grand Slam -> "Победитель по жизни" (5 consecutive wins in hub)
  let maxConsecutiveWins = 0;
  if (Array.isArray(hubStats?.recentMatches) && hubStats.recentMatches.length > 0) {
    const seenMatches = new Set<string>();
    let curr = 0;
    const sorted = [...hubStats.recentMatches].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    for (const m of sorted) {
      const mId = m.matchId || m.match_id;
      if (mId && seenMatches.has(mId)) continue;
      if (mId) seenMatches.add(mId);

      const isWin = Boolean(m.won === true || m.result === "WIN" || (m.winner && m.teamId && m.winner === m.teamId));
      if (isWin) {
        curr++;
        if (curr > maxConsecutiveWins) maxConsecutiveWins = curr;
      } else {
        curr = 0;
      }
    }
  }

  if (maxConsecutiveWins === 0 && currentStreak) {
    maxConsecutiveWins = currentStreak;
  }

  const grandSlamUnlocked = maxConsecutiveWins >= 5;
  const grandSlamPercent = Math.min(100, Math.round((maxConsecutiveWins / 5) * 100));

  // 5. Deadly K/D -> "Серийный убийца" (K/D >= 1.30)
  const kd = parseFloat(String(hubStats?.kd ?? profile?.lifetime?.["Average K/D Ratio"] ?? profile?.stats?.["Average K/D Ratio"] ?? 0)) || 0;
  const kdUnlocked = kd >= 1.30;
  const kdPercent = Math.min(100, Math.round((kd / 1.30) * 100));

  // 6. Ace of Spades -> "Одиночка" (Aces / Pentas >= 1 in hub)
  const pentas = hubStats?.multiKills?.pentas || 0;
  const aceUnlocked = pentas >= 1;
  const acePercent = pentas >= 1 ? 100 : 0;

  // 7. Veteran -> "Ветеран" (Matches >= 15)
  const vetUnlocked = played >= 15;
  const vetPercent = Math.min(100, Math.round((played / 15) * 100));

  // Helper to extract map stats from hubStats.maps
  const getMapInfo = (mapSlug: string) => {
    if (Array.isArray(hubStats?.maps)) {
      const found = hubStats.maps.find((m: any) => (m.map || "").toLowerCase().includes(mapSlug));
      if (found) {
        const matches = found.matches || 0;
        const wins = found.wins || 0;
        const wr = matches > 0 ? Math.round((wins / matches) * 100) : 0;
        return { matches, wins, wr };
      }
    }
    return { matches: 0, wins: 0, wr: 0 };
  };

  // 8. Mirage Enjoyer -> "Сын Миража" (Win Rate >= 50% with >= 6 matches) - I
  const mirage = getMapInfo("mirage");
  const mirageUnlocked = mirage.matches >= 6 && mirage.wr >= 50;
  const miragePercent = mirage.matches < 6 ? Math.round((mirage.matches / 6) * 50) : Math.min(100, Math.round((mirage.wr / 50) * 100));

  // 9. Dust2 Master -> "Казах" (Win Rate >= 50% with >= 6 matches) - II
  const dust2 = getMapInfo("dust2");
  const dust2Unlocked = dust2.matches >= 6 && dust2.wr >= 50;
  const dust2Percent = dust2.matches < 6 ? Math.round((dust2.matches / 6) * 50) : Math.min(100, Math.round((dust2.wr / 50) * 100));

  // 10. Inferno Defender -> "Итальянский Мастер" (Win Rate >= 50% with >= 6 matches) - III
  const inferno = getMapInfo("inferno");
  const infernoUnlocked = inferno.matches >= 6 && inferno.wr >= 50;
  const infernoPercent = inferno.matches < 6 ? Math.round((inferno.matches / 6) * 50) : Math.min(100, Math.round((inferno.wr / 50) * 100));

  // 11. Nuke Specialist -> "Гомер Симпсон" (Win Rate >= 50% with >= 6 matches) - IV
  const nuke = getMapInfo("nuke");
  const nukeUnlocked = nuke.matches >= 6 && nuke.wr >= 50;
  const nukePercent = nuke.matches < 6 ? Math.round((nuke.matches / 6) * 50) : Math.min(100, Math.round((nuke.wr / 50) * 100));

  // 12. Anubis Pharaoh -> "Фараон" (Win Rate >= 50% with >= 6 matches) - V
  const anubis = getMapInfo("anubis");
  const anubisUnlocked = anubis.matches >= 6 && anubis.wr >= 50;
  const anubisPercent = anubis.matches < 6 ? Math.round((anubis.matches / 6) * 50) : Math.min(100, Math.round((anubis.wr / 50) * 100));

  // 13. Ancient Fan -> "Тлатоани" (Win Rate >= 50% with >= 6 matches) - VI
  const ancient = getMapInfo("ancient");
  const ancientUnlocked = ancient.matches >= 6 && ancient.wr >= 50;
  const ancientPercent = ancient.matches < 6 ? Math.round((ancient.matches / 6) * 50) : Math.min(100, Math.round((ancient.wr / 50) * 100));

  // 14. Cache Owner -> "Сталкер" (Win Rate >= 50% with >= 6 matches) - VII
  const cache = getMapInfo("cache");
  const cacheUnlocked = cache.matches >= 6 && cache.wr >= 50;
  const cachePercent = cache.matches < 6 ? Math.round((cache.matches / 6) * 50) : Math.min(100, Math.round((cache.wr / 50) * 100));

  // 15. Blind Master -> "Ослепительная улыбка" (Flash Success Rate >= 35%)
  const flashRate = parseFloat(String(hubStats?.utility?.flashSuccessRate ?? (hubStats?.utility?.flashCount > 0 ? (hubStats.utility.flashSuccesses / hubStats.utility.flashCount) * 100 : 0))) || 0;
  const flashUnlocked = flashRate >= 35;
  const flashPercent = Math.min(100, Math.round((flashRate / 35) * 100));

  // 16. Commentator -> "Комментатор" (Leave comments to >= 7 different players)
  const commentedCount = hubStats?.commentedPlayersCount || 0;
  const commentatorUnlocked = commentedCount >= 7;
  const commentatorPercent = Math.min(100, Math.round((commentedCount / 7) * 100));

  // 17. Fantasy Winner -> "Фантазер" (Win Fantasy League >= 1 time)
  const isFantasyWinner = Boolean(hubStats?.isFantasyWinner || profile?.isFantasyWinner || profile?.customRole === "CHAMPION");
  const fantasyWinnerUnlocked = isFantasyWinner;
  const fantasyWinnerPercent = isFantasyWinner ? 100 : 0;

  // 18. Fantasy Farmer -> "Фантастический прорыв" (Max fantasy score >= 75)
  let maxFantasyScore = 0;
  if (Array.isArray(hubStats?.recentMatches) && hubStats.recentMatches.length > 0) {
    for (const m of hubStats.recentMatches) {
      const k = m.kills || 0;
      const a = m.assists || 0;
      const hs = Math.round((m.hsPct || 0) * k / 100);
      const isWin = Boolean(m.won === true || m.result === "WIN" || m.result === "1" || m.result === "win");

      const snipPts = k * 2.0 + hs * 1.0;
      const suppPts = a * 2.5 + (k * 0.8);
      const winBonus = isWin ? 10 : 2;

      const matchTotal = Math.round((snipPts * 0.5 + suppPts * 0.5 + winBonus) * 10) / 10;
      if (matchTotal > maxFantasyScore) maxFantasyScore = matchTotal;
    }
  }

  const fantasyUnlocked = maxFantasyScore >= 75;
  const fantasyPercent = Math.min(100, Math.round((maxFantasyScore / 75) * 100));

  const renderRoman = (text: string) => (
    <span style={{ fontSize: "1.05rem", fontWeight: "900", fontFamily: "system-ui, -apple-system, sans-serif", letterSpacing: "0.02em" }}>
      {text}
    </span>
  );

  return [
    // --- Combat / Core Achievements ---
    {
      id: "hs_master",
      title: "HEADSHOT MASTER",
      subtitle: "Охотник за головами",
      description: "Процент попаданий в голову ≥ 55%",
      category: "combat",
      unlocked: hsUnlocked,
      progressText: `${hsPct.toFixed(1)}% / 55%`,
      percent: hsPercent,
      color: "#ff4b4b",
      glowColor: "rgba(255, 75, 75, 0.4)",
      bgGradient: "linear-gradient(135deg, rgba(255, 75, 75, 0.15) 0%, rgba(180, 20, 20, 0.05) 100%)",
      iconSvg: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="4" />
          <line x1="12" y1="2" x2="12" y2="6" />
          <line x1="12" y1="18" x2="12" y2="22" />
          <line x1="2" y1="12" x2="6" y2="12" />
          <line x1="18" y1="12" x2="22" y2="12" />
        </svg>
      )
    },
    {
      id: "impact_carry",
      title: "CARRY",
      subtitle: "Самый ценный игрок",
      description: "Рейтинг HLTV 2.0 ≥ 1.20 в хабе",
      category: "combat",
      unlocked: impactUnlocked,
      progressText: `${hltv.toFixed(2)} / 1.20 HLTV`,
      percent: impactPercent,
      color: "#00e5ff",
      glowColor: "rgba(0, 229, 255, 0.4)",
      bgGradient: "linear-gradient(135deg, rgba(0, 229, 255, 0.15) 0%, rgba(0, 150, 200, 0.05) 100%)",
      iconSvg: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      )
    },
    {
      id: "clutch_minister",
      title: "CLUTCH MINISTER",
      subtitle: "Клач-министр",
      description: "Выиграно ≥ 10 клатчей (1vX) в хабе",
      category: "combat",
      unlocked: clutchUnlocked,
      progressText: `${clutchWins} / 10 клатчей`,
      percent: clutchPercent,
      color: "#b388ff",
      glowColor: "rgba(179, 136, 255, 0.4)",
      bgGradient: "linear-gradient(135deg, rgba(179, 136, 255, 0.15) 0%, rgba(120, 50, 220, 0.05) 100%)",
      iconSvg: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      )
    },
    {
      id: "grand_slam",
      title: "GRAND SLAM",
      subtitle: "Победитель по жизни",
      description: "Серия из 5 побед подряд в хабе",
      category: "combat",
      unlocked: grandSlamUnlocked,
      progressText: `${maxConsecutiveWins} / 5 побед подряд`,
      percent: grandSlamPercent,
      color: "#00e676",
      glowColor: "rgba(0, 230, 118, 0.4)",
      bgGradient: "linear-gradient(135deg, rgba(0, 230, 118, 0.15) 0%, rgba(0, 160, 80, 0.05) 100%)",
      iconSvg: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="13 17 18 12 13 7" />
          <polyline points="6 17 11 12 6 7" />
        </svg>
      )
    },
    {
      id: "deadly_kd",
      title: "DEADLY K/D",
      subtitle: "Серийный убийца",
      description: "Коэффициент K/D Ratio ≥ 1.30",
      category: "combat",
      unlocked: kdUnlocked,
      progressText: `${kd.toFixed(2)} K/D`,
      percent: kdPercent,
      color: "#ff9100",
      glowColor: "rgba(255, 145, 0, 0.4)",
      bgGradient: "linear-gradient(135deg, rgba(255, 145, 0, 0.15) 0%, rgba(200, 100, 0, 0.05) 100%)",
      iconSvg: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="22" y1="12" x2="18" y2="12" />
          <line x1="6" y1="12" x2="2" y2="12" />
          <line x1="12" y1="6" x2="12" y2="2" />
          <line x1="12" y1="22" x2="12" y2="18" />
        </svg>
      )
    },
    {
      id: "ace_of_spades",
      title: "ACE OF SPADES",
      subtitle: "Одиночка",
      description: "Сделать минимум 1 эйс (5 киллов) в хабе",
      category: "combat",
      unlocked: aceUnlocked,
      progressText: `${pentas} / 1 эйс`,
      percent: acePercent,
      color: "#f43f5e",
      glowColor: "rgba(244, 63, 94, 0.4)",
      bgGradient: "linear-gradient(135deg, rgba(244, 63, 94, 0.15) 0%, rgba(180, 20, 50, 0.05) 100%)",
      iconSvg: (
        // Ace of Spades vector icon
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2C9 7 4 9 4 14a6 6 0 0 0 10.5 4l-2.5 4h0l4 0-2.5-4A6 6 0 0 0 20 14c0-5-5-7-8-12z" />
          <circle cx="12" cy="13" r="1.5" fill="currentColor" />
        </svg>
      )
    },
    {
      id: "veteran",
      title: "VETERAN",
      subtitle: "Ветеран",
      description: "Сыграно ≥ 15 матчей в хабе",
      category: "combat",
      unlocked: vetUnlocked,
      progressText: `${played} / 15 матчей`,
      percent: vetPercent,
      color: "#ffd700",
      glowColor: "rgba(255, 215, 0, 0.4)",
      bgGradient: "linear-gradient(135deg, rgba(255, 215, 0, 0.15) 0%, rgba(180, 140, 0, 0.05) 100%)",
      iconSvg: (
        // Military Veteran Shield / Badge with star
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" />
          <circle cx="12" cy="12" r="2.5" />
        </svg>
      )
    },

    // --- Map-Specific Achievements (Roman Numerals I - VII) ---
    {
      id: "mirage_enjoyer",
      title: "MIRAGE ENJOYER",
      subtitle: "Сын Миража",
      description: "Win Rate ≥ 50% на Mirage при ≥ 6 матчах",
      category: "maps",
      unlocked: mirageUnlocked,
      progressText: mirage.matches < 6 ? `${mirage.matches}/6 игр` : `${mirage.wr}% WR (${mirage.matches} игр)`,
      percent: miragePercent,
      color: "#f59e0b",
      glowColor: "rgba(245, 158, 11, 0.4)",
      bgGradient: "linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(180, 100, 0, 0.05) 100%)",
      iconSvg: renderRoman("I")
    },
    {
      id: "dust2_master",
      title: "DUST2 MASTER",
      subtitle: "Казах",
      description: "Win Rate ≥ 50% на Dust2 при ≥ 6 матчах",
      category: "maps",
      unlocked: dust2Unlocked,
      progressText: dust2.matches < 6 ? `${dust2.matches}/6 игр` : `${dust2.wr}% WR (${dust2.matches} игр)`,
      percent: dust2Percent,
      color: "#fb923c",
      glowColor: "rgba(251, 146, 60, 0.4)",
      bgGradient: "linear-gradient(135deg, rgba(251, 146, 60, 0.15) 0%, rgba(190, 80, 0, 0.05) 100%)",
      iconSvg: renderRoman("II")
    },
    {
      id: "inferno_defender",
      title: "INFERNO DEFENDER",
      subtitle: "Итальянский Мастер",
      description: "Win Rate ≥ 50% на Inferno при ≥ 6 матчах",
      category: "maps",
      unlocked: infernoUnlocked,
      progressText: inferno.matches < 6 ? `${inferno.matches}/6 игр` : `${inferno.wr}% WR (${inferno.matches} игр)`,
      percent: infernoPercent,
      color: "#ef4444",
      glowColor: "rgba(239, 68, 68, 0.4)",
      bgGradient: "linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(180, 20, 20, 0.05) 100%)",
      iconSvg: renderRoman("III")
    },
    {
      id: "nuke_specialist",
      title: "NUKE SPECIALIST",
      subtitle: "Гомер Симпсон",
      description: "Win Rate ≥ 50% на Nuke при ≥ 6 матчах",
      category: "maps",
      unlocked: nukeUnlocked,
      progressText: nuke.matches < 6 ? `${nuke.matches}/6 игр` : `${nuke.wr}% WR (${nuke.matches} игр)`,
      percent: nukePercent,
      color: "#84cc16",
      glowColor: "rgba(132, 204, 22, 0.4)",
      bgGradient: "linear-gradient(135deg, rgba(132, 204, 22, 0.15) 0%, rgba(80, 140, 10, 0.05) 100%)",
      iconSvg: renderRoman("IV")
    },
    {
      id: "anubis_pharaoh",
      title: "ANUBIS PHARAOH",
      subtitle: "Фараон",
      description: "Win Rate ≥ 50% на Anubis при ≥ 6 матчах",
      category: "maps",
      unlocked: anubisUnlocked,
      progressText: anubis.matches < 6 ? `${anubis.matches}/6 игр` : `${anubis.wr}% WR (${anubis.matches} игр)`,
      percent: anubisPercent,
      color: "#06b6d4",
      glowColor: "rgba(6, 182, 212, 0.4)",
      bgGradient: "linear-gradient(135deg, rgba(6, 182, 212, 0.15) 0%, rgba(0, 120, 150, 0.05) 100%)",
      iconSvg: renderRoman("V")
    },
    {
      id: "ancient_fan",
      title: "ANCIENT FAN",
      subtitle: "Тлатоани",
      description: "Win Rate ≥ 50% на Ancient при ≥ 6 матчах",
      category: "maps",
      unlocked: ancientUnlocked,
      progressText: ancient.matches < 6 ? `${ancient.matches}/6 игр` : `${ancient.wr}% WR (${ancient.matches} игр)`,
      percent: ancientPercent,
      color: "#10b981",
      glowColor: "rgba(16, 185, 129, 0.4)",
      bgGradient: "linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(0, 120, 80, 0.05) 100%)",
      iconSvg: renderRoman("VI")
    },
    {
      id: "cache_owner",
      title: "CACHE OWNER",
      subtitle: "Сталкер",
      description: "Win Rate ≥ 50% на Cache при ≥ 6 матчах",
      category: "maps",
      unlocked: cacheUnlocked,
      progressText: cache.matches < 6 ? `${cache.matches}/6 игр` : `${cache.wr}% WR (${cache.matches} игр)`,
      percent: cachePercent,
      color: "#6366f1",
      glowColor: "rgba(99, 102, 241, 0.4)",
      bgGradient: "linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(50, 50, 180, 0.05) 100%)",
      iconSvg: renderRoman("VII")
    },

    // --- Special Achievements ---
    {
      id: "blind_master",
      title: "BLIND MASTER",
      subtitle: "Ослепительная улыбка",
      description: "Успешность флешек (Flashbang Rate) ≥ 35%",
      category: "special",
      unlocked: flashUnlocked,
      progressText: `${flashRate.toFixed(1)}% / 35%`,
      percent: flashPercent,
      color: "#38bdf8",
      glowColor: "rgba(56, 189, 248, 0.4)",
      bgGradient: "linear-gradient(135deg, rgba(56, 189, 248, 0.15) 0%, rgba(0, 100, 180, 0.05) 100%)",
      iconSvg: (
        // 4-point Sparkle Flash Star vector icon
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" fill="currentColor" fillOpacity="0.25" />
          <circle cx="12" cy="12" r="2" fill="currentColor" />
        </svg>
      )
    },
    {
      id: "commentator",
      title: "COMMENTATOR",
      subtitle: "Комментатор",
      description: "Оставить комментарии ≥ 7 разным игрокам",
      category: "special",
      unlocked: commentatorUnlocked,
      progressText: `${commentedCount} / 7 игроков`,
      percent: commentatorPercent,
      color: "#c084fc",
      glowColor: "rgba(192, 132, 252, 0.4)",
      bgGradient: "linear-gradient(135deg, rgba(192, 132, 252, 0.15) 0%, rgba(120, 50, 200, 0.05) 100%)",
      iconSvg: (
        // Chat bubble with microphone / speech waves vector icon
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          <path d="M12 7v4" />
          <circle cx="12" cy="14" r="0.5" fill="currentColor" />
        </svg>
      )
    },
    {
      id: "fantasy_winner",
      title: "FANTASY WINNER",
      subtitle: "Фантазер",
      description: "Победитель Fantasy-лиги (1-е место) ≥ 1 раза",
      category: "special",
      unlocked: fantasyWinnerUnlocked,
      progressText: isFantasyWinner ? "1 / 1 победа" : "0 / 1 победа",
      percent: fantasyWinnerPercent,
      color: "#fbbf24",
      glowColor: "rgba(251, 191, 36, 0.4)",
      bgGradient: "linear-gradient(135deg, rgba(251, 191, 36, 0.15) 0%, rgba(200, 140, 0, 0.05) 100%)",
      iconSvg: (
        // Tournament Ladder / Podium with Crown vector icon
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 21h16" />
          <path d="M8 21v-7h8v7" />
          <path d="M4 21v-4h4v4" />
          <path d="M16 21v-4h4v4" />
          <path d="M10 5l2-3 2 3 3-1-2 5H9L7 4z" fill="currentColor" fillOpacity="0.3" />
        </svg>
      )
    },
    {
      id: "fantasy_farmer",
      title: "FANTASY FARMER",
      subtitle: "Фантастический прорыв",
      description: "Рекорд за матч в Fantasy ≥ 75 очков",
      category: "special",
      unlocked: fantasyUnlocked,
      progressText: `${maxFantasyScore} / 75 очков`,
      percent: fantasyPercent,
      color: "#eab308",
      glowColor: "rgba(234, 179, 8, 0.4)",
      bgGradient: "linear-gradient(135deg, rgba(234, 179, 8, 0.15) 0%, rgba(180, 130, 0, 0.05) 100%)",
      iconSvg: (
        // Trophy Cup vector icon
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3" />
          <path d="M18 9h3a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-3" />
          <path d="M6 3h12v7a6 6 0 0 1-12 0V3z" />
          <path d="M12 16v4" />
          <path d="M8 20h8" />
        </svg>
      )
    }
  ];
}

export default function PlayerAchievements({ achievements }: { achievements: AchievementItem[] }) {
  const [filterCategory, setFilterCategory] = React.useState<string>("all");

  const unlockedCount = achievements.filter(a => a.unlocked).length;

  const filtered = React.useMemo(() => {
    if (filterCategory === "all") return achievements;
    return achievements.filter(a => a.category === filterCategory);
  }, [achievements, filterCategory]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Header & Tabs */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <h3 style={{ fontSize: "1.1rem", fontWeight: "800", color: "#fff", margin: 0, textTransform: "uppercase", letterSpacing: "0.03em" }}>
            Достижения
          </h3>
          <span style={{
            fontSize: "0.75rem",
            fontWeight: "800",
            padding: "0.15rem 0.55rem",
            borderRadius: "6px",
            background: unlockedCount > 0 ? "rgba(0, 229, 255, 0.15)" : "rgba(255,255,255,0.05)",
            color: unlockedCount > 0 ? "var(--accent-cyan)" : "var(--text-muted)",
            border: `1px solid ${unlockedCount > 0 ? "rgba(0, 229, 255, 0.3)" : "var(--border-light)"}`
          }}>
            {unlockedCount} / {achievements.length} получено
          </span>
        </div>

        {/* Category Filters */}
        <div style={{ display: "inline-flex", background: "rgba(0,0,0,0.3)", borderRadius: "8px", padding: "0.2rem", border: "1px solid var(--border-light)", gap: "0.2rem" }}>
          {[
            { id: "all", label: "Все" },
            { id: "combat", label: "Боевые" },
            { id: "maps", label: "Карты" },
            { id: "special", label: "Особые" }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilterCategory(tab.id)}
              style={{
                background: filterCategory === tab.id ? "rgba(255,255,255,0.12)" : "transparent",
                color: filterCategory === tab.id ? "#fff" : "var(--text-muted)",
                border: "none",
                borderRadius: "6px",
                padding: "0.25rem 0.65rem",
                fontSize: "0.75rem",
                fontWeight: "700",
                cursor: "pointer",
                transition: "all 0.2s ease"
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Cards */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: "0.85rem"
      }}>
        {filtered.map((item) => {
          return (
            <div
              key={item.id}
              style={{
                position: "relative",
                background: item.unlocked ? item.bgGradient : "rgba(255, 255, 255, 0.02)",
                border: item.unlocked ? `1px solid ${item.color}66` : "1px solid var(--border-light)",
                borderRadius: "14px",
                padding: "1rem 1.15rem",
                boxShadow: item.unlocked ? `0 0 20px ${item.glowColor}` : "none",
                display: "flex",
                flexDirection: "column",
                gap: "0.65rem",
                transition: "all 0.25s ease",
                opacity: item.unlocked ? 1 : 0.65
              }}
            >
              {/* Top Row: Icon + Title + Status */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
                <div style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "10px",
                  background: item.unlocked ? `${item.color}22` : "rgba(255,255,255,0.04)",
                  border: `1px solid ${item.unlocked ? item.color : "rgba(255,255,255,0.1)"}`,
                  color: item.unlocked ? item.color : "var(--text-muted)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  boxShadow: item.unlocked ? `0 0 12px ${item.glowColor}` : "none"
                }}>
                  {item.iconSvg}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.4rem" }}>
                    <div style={{
                      fontSize: "0.82rem",
                      fontWeight: "900",
                      color: item.unlocked ? "#fff" : "var(--text-secondary)",
                      letterSpacing: "0.04em",
                      textTransform: "uppercase"
                    }}>
                      {item.title}
                    </div>
                    <span style={{
                      fontSize: "0.68rem",
                      fontWeight: "800",
                      padding: "0.1rem 0.4rem",
                      borderRadius: "4px",
                      background: item.unlocked ? `${item.color}25` : "rgba(255,255,255,0.05)",
                      color: item.unlocked ? item.color : "var(--text-muted)",
                      border: `1px solid ${item.unlocked ? `${item.color}55` : "rgba(255,255,255,0.1)"}`,
                      whiteSpace: "nowrap"
                    }}>
                      {item.unlocked ? "ОТКРЫТО" : `${item.percent}%`}
                    </span>
                  </div>

                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>
                    {item.description}
                  </div>
                </div>
              </div>

              {/* Progress bar and current value */}
              <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.72rem",
                  color: item.unlocked ? item.color : "var(--text-muted)",
                  fontWeight: "700"
                }}>
                  <span>{item.subtitle}</span>
                  <span>{item.progressText}</span>
                </div>
                <div style={{
                  width: "100%",
                  height: "4px",
                  borderRadius: "2px",
                  background: "rgba(255,255,255,0.06)",
                  overflow: "hidden"
                }}>
                  <div style={{
                    width: `${item.percent}%`,
                    height: "100%",
                    background: item.unlocked ? item.color : "var(--text-muted)",
                    borderRadius: "2px",
                    boxShadow: item.unlocked ? `0 0 8px ${item.color}` : "none",
                    transition: "width 0.4s ease"
                  }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
