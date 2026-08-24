"use client";

import React from "react";

export interface AchievementItem {
  id: string;
  title: string;
  subtitle: string;
  description: string;
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
  const played = hubPlayed || hubStats?.matches || hubStats?.matchesCount || 0;
  const c1v1 = hubStats?.duels?.clutch1v1Wins || 0;
  const c1v2 = hubStats?.duels?.clutch1v2Wins || 0;
  const c1v3 = hubStats?.duels?.clutch1v3Wins || 0;
  const c1v4 = hubStats?.duels?.clutch1v4Wins || 0;
  const c1v5 = hubStats?.duels?.clutch1v5Wins || 0;
  const clutchWins = c1v1 + c1v2 + c1v3 + c1v4 + c1v5;
  const clutchKills = hubStats?.duels?.clutchKills || 0;
  const clutchUnlocked = clutchWins >= 10 || (clutchWins >= 5 && (hubStats?.duels?.clutch1v1Rate || 0) >= 50);
  const clutchPercent = Math.min(100, Math.round((clutchWins / 10) * 100));

  // 4. Grand Slam -> "Победитель по жизни" (5 consecutive wins in hub)
  let maxConsecutiveWins = 0;
  if (Array.isArray(hubStats?.recentMatches) && hubStats.recentMatches.length > 0) {
    const seenMatches = new Set<string>();
    let curr = 0;
    // Walk through matches in chronological order (oldest to newest)
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

  // Fallback to hub current streak if no matches array
  if (maxConsecutiveWins === 0 && currentStreak) {
    maxConsecutiveWins = currentStreak;
  }

  const grandSlamUnlocked = maxConsecutiveWins >= 5;
  const grandSlamPercent = Math.min(100, Math.round((maxConsecutiveWins / 5) * 100));

  // 5. Deadly K/D -> "Серийный убийца" (K/D >= 1.30)
  const kd = parseFloat(String(hubStats?.kd ?? profile?.lifetime?.["Average K/D Ratio"] ?? profile?.stats?.["Average K/D Ratio"] ?? 0)) || 0;
  const kdUnlocked = kd >= 1.30;
  const kdPercent = Math.min(100, Math.round((kd / 1.30) * 100));

  // 6. Veteran -> "Ветеран" (Matches >= 15)
  const vetUnlocked = played >= 15;
  const vetPercent = Math.min(100, Math.round((played / 15) * 100));

  return [
    {
      id: "hs_master",
      title: "HEADSHOT MASTER",
      subtitle: "Охотник за головами",
      description: "Процент попаданий в голову ≥ 55%",
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
      id: "veteran",
      title: "VETERAN",
      subtitle: "Ветеран",
      description: "Сыграно ≥ 15 матчей в хабе",
      unlocked: vetUnlocked,
      progressText: `${played} / 15 матчей`,
      percent: vetPercent,
      color: "#ffd700",
      glowColor: "rgba(255, 215, 0, 0.4)",
      bgGradient: "linear-gradient(135deg, rgba(255, 215, 0, 0.15) 0%, rgba(180, 140, 0, 0.05) 100%)",
      iconSvg: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      )
    }
  ];
}

export default function PlayerAchievements({ achievements }: { achievements: AchievementItem[] }) {
  const unlockedCount = achievements.filter(a => a.unlocked).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
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
      </div>

      {/* Grid of Cards */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: "0.85rem"
      }}>
        {achievements.map((item) => {
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
