"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import PlayerAchievements, { computePlayerAchievements } from "@/components/PlayerAchievements";
import PlayerCommentsWall from "@/components/PlayerCommentsWall";
import { computeAdaptiveSkillScore } from "@/lib/skill";

// Normalized map name to match public/maps/ file names (e.g. Mirage -> de_mirage)
const getMapFileName = (mapNameStr: string) => {
  if (!mapNameStr) return "default";
  const clean = mapNameStr.toLowerCase().trim();
  if (clean === "dust2" || clean === "dust 2") return "de_dust2";
  if (clean === "mirage") return "de_mirage";
  if (clean === "inferno") return "de_inferno";
  if (clean === "nuke") return "de_nuke";
  if (clean === "ancient") return "de_ancient";
  if (clean === "anubis") return "de_anubis";
  if (clean === "overpass") return "de_overpass";
  if (clean === "vertigo") return "de_vertigo";
  if (clean === "cache") return "de_cache";
  return clean;
};

const getMapImageUrl = (mapNameStr: string) => {
  const filename = getMapFileName(mapNameStr);
  const mapping: Record<string, string> = {
    de_dust2: "https://assets.faceit-cdn.net/third_party/games/ce652bd4-0abb-4c90-9936-1133965ca38b/assets/votables/7c17caa9-64a6-4496-8a0b-885e0f038d79_1695819126962.jpeg",
    de_mirage: "https://assets.faceit-cdn.net/third_party/games/ce652bd4-0abb-4c90-9936-1133965ca38b/assets/votables/7fb7d725-e44d-4e3c-b557-e1d19b260ab8_1695819144685.jpeg",
    de_nuke: "https://assets.faceit-cdn.net/third_party/games/ce652bd4-0abb-4c90-9936-1133965ca38b/assets/votables/7197a969-81e4-4fef-8764-55f46c7cec6e_1695819158849.jpeg",
    de_inferno: "https://assets.faceit-cdn.net/third_party/games/ce652bd4-0abb-4c90-9936-1133965ca38b/assets/votables/993380de-bb5b-4aa1-ada9-a0c1741dc475_1695819220797.jpeg",
    de_ancient: "https://assets.faceit-cdn.net/third_party/games/ce652bd4-0abb-4c90-9936-1133965ca38b/assets/votables/5b844241-5b15-45bf-a304-ad6df63b5ce5_1695819190976.jpeg",
    de_anubis: "https://assets.faceit-cdn.net/third_party/games/ce652bd4-0abb-4c90-9936-1133965ca38b/assets/votables/31f01daf-e531-43cf-b949-c094ebc9b3ea_1695819235255.jpeg",
    de_cache: "/maps/de_cache.webp"
  };
  return mapping[filename] || `/maps/${filename}.webp`;
};

const getLevelBadgeStyle = (level: number) => {
  const baseStyle = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "28px",
    height: "28px",
    borderRadius: "4px",
    fontWeight: "800",
    fontSize: "0.9rem",
    color: "#fff"
  };

  switch (level) {
    case 1: return { ...baseStyle, backgroundColor: "#EEEEEE", color: "#111" };
    case 2:
    case 3: return { ...baseStyle, backgroundColor: "#02E152" };
    case 4:
    case 5:
    case 6:
    case 7: return { ...baseStyle, backgroundColor: "#FFC800", color: "#111" };
    case 8:
    case 9: return { ...baseStyle, backgroundColor: "#FF5E00" };
    case 10: return {
      ...baseStyle,
      backgroundColor: "#FF0000",
      boxShadow: "0 0 10px rgba(255, 0, 0, 0.6)"
    };
    default: return baseStyle;
  }
};



export default function PlayerProfilePage() {
  const params = useParams();
  const playerId = params.playerId as string;

  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [hubStats, setHubStats] = useState<any>(null);
  const [leetify, setLeetify] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"general" | "tactical" | "maps">("general");
  const [fantasyPickData, setFantasyPickData] = useState<{ count: number; roles: string[] }>({ count: 0, roles: [] });
  const [fantasyWinnerNick, setFantasyWinnerNick] = useState<string>("");
  const [fantasyWinnerSteamId, setFantasyWinnerSteamId] = useState<string>("");
  const [visibleMatches, setVisibleMatches] = useState(10);
  const [chartMetricIndex, setChartMetricIndex] = useState<number>(0);
  const [steamStats, setSteamStats] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [steamHover, setSteamHover] = useState(false);
  const [faceitHover, setFaceitHover] = useState(false);
  const [copyHover, setCopyHover] = useState(false);
  const [playerOverridesMap, setPlayerOverridesMap] = useState<Record<string, any>>({});
  const [weeklySkillMap, setWeeklySkillMap] = useState<Record<string, any>>({});
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    fetch("/api/auth/steam/me")
      .then(res => res.json())
      .then(data => { if (data?.authenticated && data?.user) setCurrentUser(data.user); })
      .catch(() => {});

    fetch("/api/faceit/weekly-skill?checkAuto=1")
      .then(res => res.json())
      .then(data => {
        if (data?.players) setWeeklySkillMap(data.players);
      })
      .catch(() => {});

    fetch("/api/admin/players/override")
      .then(res => res.json())
      .then(data => {
        if (data && data.overrides) {
          const map: Record<string, any> = {};
          Object.entries(data.overrides).forEach(([k, v]: [string, any]) => {
            map[k] = v;
            if (v && v.nickname) {
              map[v.nickname] = v;
              map[v.nickname.toLowerCase()] = v;
            }
          });
          setPlayerOverridesMap(map);
        }
      })
      .catch(() => {});
  }, []);

  const getPlayerSkillInfo = (
    playerIdVal: string, 
    nicknameVal: string, 
    eloVal?: number, 
    realPremierRating?: number, 
    statsObj?: any,
    faceitMatchesCount?: number,
    premierMatchesCount?: number
  ) => {
    const lowerNick = (nicknameVal || "").toLowerCase();
    const ov = (playerIdVal && playerOverridesMap[playerIdVal]) || 
               (lowerNick && playerOverridesMap[lowerNick]) || 
               (nicknameVal && playerOverridesMap[nicknameVal]) || {};

    const baseElo = eloVal || ov.customElo || (ov.csRating ? Math.round(ov.csRating / 11.53) : 1000);
    const isRealPremier = Boolean(realPremierRating || ov.csRating);

    const skillRes = computeAdaptiveSkillScore({
      playerId: playerIdVal,
      nickname: nicknameVal,
      elo: baseElo,
      faceitMatches: faceitMatchesCount || 500,
      premierRating: realPremierRating || ov.csRating,
      premierMatches: premierMatchesCount || 0,
      isRealPremier,
      combatStats: statsObj ? {
        kd: statsObj.kd,
        adr: statsObj.adr,
        hltv: statsObj.hltv || statsObj.hltvRating,
        avgKills: statsObj.avgKills,
        hsPct: statsObj.hsPct,
        winrate: statsObj.winrate !== undefined ? parseFloat(String(statsObj.winrate)) : (statsObj.wins !== undefined && statsObj.matches ? (statsObj.wins / statsObj.matches) * 100 : 50.0),
        matchesCount: statsObj.matchesCount || statsObj.matches || 0
      } : null,
      overrides: ov
    });

    return {
      ...skillRes,
      override: ov
    };
  };

  const handleCopyProfile = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderValveStats = () => {
    if (!steamStats) {
      return (
        <div style={{ marginTop: "1rem", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "1rem" }}>
          <span style={{ fontSize: "0.85rem", fontWeight: "800", color: "var(--accent-cyan)", display: "block", marginBottom: "0.75rem" }}>Статистика Valve Matchmaking & Steam</span>
          <div style={{ padding: "1.5rem", textAlign: "center", color: "var(--text-secondary)", fontSize: "0.8rem", background: "rgba(0,0,0,0.15)", borderRadius: "10px" }}>
            Загрузка официального рейтинга Valve...
          </div>
        </div>
      );
    }

    const lowerNick = (profile?.nickname || "").toLowerCase();
    const ov = (profile?.player_id && playerOverridesMap[profile.player_id]) || 
               (lowerNick && playerOverridesMap[lowerNick]) || {};

    const premierRating = steamStats?.premierRating || ov?.csRating;
    const { ranks, vacBanned, gameBans } = steamStats;

    // Premier rating tier color (CS2 colors)
    let tierColor = "#cbd5e1";
    if (premierRating >= 25000) tierColor = "#f59e0b";
    else if (premierRating >= 20000) tierColor = "#eb4899";
    else if (premierRating >= 15000) tierColor = "#8b5cf6";
    else if (premierRating >= 10000) tierColor = "#3b82f6";
    else if (premierRating >= 5000) tierColor = "#10b981";

    return (
      <div style={{ marginTop: "1rem", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "1rem" }}>
        <span style={{ fontSize: "0.85rem", fontWeight: "800", color: "var(--accent-cyan)", display: "block", marginBottom: "0.75rem" }}>Статистика Valve Matchmaking & Steam</span>
        
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {/* Premier rating banner */}
          <div style={{
            background: premierRating ? `linear-gradient(135deg, ${tierColor}15 0%, rgba(20, 20, 30, 0.4) 100%)` : "rgba(0,0,0,0.15)",
            border: premierRating ? `1px solid ${tierColor}40` : "1px solid var(--border-light)",
            borderRadius: "10px",
            padding: "0.85rem 1rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
            <div>
              <span style={{ fontSize: "0.8rem", fontWeight: "800", color: "#fff" }}>CS2 Premier Rating</span>
              <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", display: "block" }}>
                {premierRating ? "Официальный рейтинг Valve / CSSTATS" : "Нету в CSSTATS (расчет по скиллу ELO)"}
              </span>
            </div>
            <span style={{ fontSize: "1.2rem", fontWeight: "900", color: premierRating ? tierColor : "var(--text-secondary)", textShadow: premierRating ? `0 0 10px ${tierColor}30` : "none" }}>
              {premierRating ? `${premierRating.toLocaleString()} PTS` : "Нету (Без рейтинга)"}
            </span>
          </div>

          {/* Map Ranks */}
          {Array.isArray(ranks) && ranks.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.4rem" }}>
              {ranks.map((r: any, idx: number) => (
                <div key={idx} style={{
                  background: "rgba(0,0,0,0.25)",
                  border: "1px solid var(--border-light)",
                  borderRadius: "8px",
                  padding: "0.5rem 0.25rem",
                  textAlign: "center",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.25rem"
                }}>
                  <span style={{ fontSize: "0.65rem", color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: "800" }}>
                    {r.map.replace("de_", "").replace("cs_", "")}
                  </span>
                  <img
                    src={`/icons/skillgroup${r.value || 0}.svg`}
                    alt={r.rank}
                    style={{
                      height: "22px",
                      width: "auto",
                      maxWidth: "100%",
                      objectFit: "contain",
                      filter: r.value === 0 ? "grayscale(1) opacity(0.4)" : "none"
                    }}
                  />
                  <span style={{
                    fontSize: "0.55rem",
                    color: "var(--text-muted)",
                    fontWeight: "700",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    maxWidth: "100%"
                  }} title={r.rank}>
                    {r.rank === "Unranked" ? "No Rank" : r.rank}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: "0.75rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.7rem", background: "rgba(0,0,0,0.15)", borderRadius: "8px", border: "1px dashed var(--border-light)" }}>
              Нет данных о званиях соревновательного режима
            </div>
          )}

          {/* Steam Ban Status */}
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "var(--text-muted)", background: "rgba(0,0,0,0.15)", padding: "0.5rem 0.75rem", borderRadius: "6px" }}>
            <span>VAC статус: <strong style={{ color: vacBanned ? "var(--danger)" : "var(--success)" }}>{vacBanned ? "Заблокирован" : "Чисто"}</strong></span>
            <span>Игровые баны: <strong style={{ color: gameBans > 0 ? "var(--danger)" : "var(--success)" }}>{gameBans > 0 ? `${gameBans} бан(ов)` : "Чисто"}</strong></span>
          </div>
        </div>
      </div>
    );
  };

  const CHART_METRICS = [
    {
      id: "hltv",
      label: "HLTV 2.0",
      shortName: "HLTV Rating 2.0",
      color: "#ffd700",
      lineColor: "#ffc837",
      gradStart: "rgba(255, 200, 55, 0.35)",
      gradEnd: "rgba(255, 200, 55, 0.0)",
      getValue: (m: any) => typeof m.rating === "number" ? m.rating : (parseFloat(m.rating) || 1.0),
      formatValue: (v: number) => v.toFixed(2),
      formatAxis: (v: number) => v.toFixed(2),
      minRange: 0.3,
      unit: ""
    },
    {
      id: "kd",
      label: "K/D",
      shortName: "K/D Ratio",
      color: "#00e5ff",
      lineColor: "#00e5ff",
      gradStart: "rgba(0, 229, 255, 0.35)",
      gradEnd: "rgba(0, 229, 255, 0.0)",
      getValue: (m: any) => typeof m.kd === "number" ? m.kd : (parseFloat(m.kd) || (m.deaths > 0 ? m.kills / m.deaths : m.kills) || 1.0),
      formatValue: (v: number) => v.toFixed(2),
      formatAxis: (v: number) => v.toFixed(2),
      minRange: 0.4,
      unit: ""
    },
    {
      id: "adr",
      label: "ADR",
      shortName: "Урон за раунд (ADR)",
      color: "#ff9100",
      lineColor: "#ff9100",
      gradStart: "rgba(255, 145, 0, 0.35)",
      gradEnd: "rgba(255, 145, 0, 0.0)",
      getValue: (m: any) => typeof m.adr === "number" ? m.adr : (parseFloat(m.adr) || (m.damage && m.rounds ? m.damage / m.rounds : 75)),
      formatValue: (v: number) => `${Math.round(v)}`,
      formatAxis: (v: number) => `${Math.round(v)}`,
      minRange: 20,
      unit: " HP"
    },
    {
      id: "avg",
      label: "AVG",
      shortName: "Фраги (AVG)",
      color: "#00e676",
      lineColor: "#00e676",
      gradStart: "rgba(0, 230, 118, 0.35)",
      gradEnd: "rgba(0, 230, 118, 0.0)",
      getValue: (m: any) => typeof m.kills === "number" ? m.kills : (parseInt(m.kills, 10) || 16),
      formatValue: (v: number) => `${Math.round(v)}`,
      formatAxis: (v: number) => `${Math.round(v)}`,
      minRange: 6,
      unit: " киллов"
    },
    {
      id: "hs",
      label: "HS%",
      shortName: "Хедшоты (HS%)",
      color: "#e040fb",
      lineColor: "#e040fb",
      gradStart: "rgba(224, 64, 251, 0.35)",
      gradEnd: "rgba(224, 64, 251, 0.0)",
      getValue: (m: any) => typeof m.hsPct === "number" ? m.hsPct : (parseFloat(m.hsPct) || 45),
      formatValue: (v: number) => `${Math.round(v)}%`,
      formatAxis: (v: number) => `${Math.round(v)}%`,
      minRange: 15,
      unit: "%"
    }
  ];

  const renderRatingChart = () => {
    if (!hubStats || !Array.isArray(hubStats.recentMatches) || hubStats.recentMatches.length === 0) return null;

    const activeMetric = CHART_METRICS[chartMetricIndex] || CHART_METRICS[0];
    const chartData = [...hubStats.recentMatches].slice(0, 10).reverse();
    const width = 500;
    const height = 260;
    const paddingLeft = 38;
    const paddingRight = 15;
    const paddingTop = 38;
    const paddingBottom = 30;

    const values = chartData.map((m: any) => activeMetric.getValue(m));
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const rawRange = rawMax - rawMin;

    const effectiveRange = Math.max(activeMetric.minRange, rawRange);
    const pad = effectiveRange * 0.15;
    const minValue = Math.max(0, rawMin - pad);
    const maxValue = rawMax + pad;
    const valRange = maxValue - minValue || 1;

    const getX = (idx: number) => {
      if (chartData.length <= 1) return paddingLeft;
      return paddingLeft + (idx / (chartData.length - 1)) * (width - paddingLeft - paddingRight);
    };

    const getY = (val: number) => {
      return height - paddingBottom - ((val - minValue) / valRange) * (height - paddingTop - paddingBottom);
    };

    // Construct path coordinates
    const points = chartData.map((m: any, idx: number) => {
      const v = activeMetric.getValue(m);
      return {
        x: getX(idx),
        y: getY(v),
        rawVal: v,
        displayVal: activeMetric.formatValue(v),
        won: m.won,
        mapName: m.map,
        score: m.score,
        finishedAt: m.finishedAt
      };
    });

    let linePath = "";
    let areaPath = "";
    if (points.length > 0) {
      linePath = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(" ");
      areaPath = `${linePath} L ${points[points.length - 1].x} ${height - paddingBottom} L ${points[0].x} ${height - paddingBottom} Z`;
    }

    const handlePrev = () => {
      setChartMetricIndex((prev) => (prev - 1 + CHART_METRICS.length) % CHART_METRICS.length);
    };

    const handleNext = () => {
      setChartMetricIndex((prev) => (prev + 1) % CHART_METRICS.length);
    };

    return (
      <div className="glass-card" style={{ padding: "1.25rem", borderRadius: "16px", border: "1px solid var(--border-light)", display: "flex", flexDirection: "column", gap: "0.85rem", marginTop: "0rem", flex: 1, minHeight: "280px", justifyContent: "space-between", boxSizing: "border-box" }}>
        
        {/* Header with Switcher Tabs & Arrows */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.6rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.92rem", fontWeight: "800", color: "#fff", display: "inline-block" }}>
                Динамика перформанса
              </span>
              <span style={{ fontSize: "0.8rem", fontWeight: "800", color: activeMetric.color, background: `${activeMetric.color}18`, padding: "0.15rem 0.5rem", borderRadius: "6px", border: `1px solid ${activeMetric.color}40` }}>
                {activeMetric.shortName}
              </span>
            </div>
            <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "block", marginTop: "0.15rem" }}>
              Последние {chartData.length} игр (Хаб)
            </span>
          </div>

          {/* Metric Selector Buttons + Leaf Arrows */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", background: "rgba(0,0,0,0.3)", padding: "0.25rem 0.35rem", borderRadius: "10px", border: "1px solid var(--border-light)" }}>
            <button
              onClick={handlePrev}
              title="Предыдущий график"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#fff",
                borderRadius: "6px",
                width: "24px",
                height: "24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                fontSize: "0.85rem",
                fontWeight: "bold",
                transition: "all 0.15s ease"
              }}
            >
              ‹
            </button>

            {CHART_METRICS.map((met, idx) => {
              const isActive = idx === chartMetricIndex;
              return (
                <button
                  key={met.id}
                  onClick={() => setChartMetricIndex(idx)}
                  style={{
                    background: isActive ? `${met.color}25` : "transparent",
                    color: isActive ? met.color : "var(--text-secondary)",
                    border: isActive ? `1px solid ${met.color}70` : "1px solid transparent",
                    boxShadow: isActive ? `0 0 10px ${met.color}35` : "none",
                    borderRadius: "6px",
                    padding: "0.2rem 0.55rem",
                    fontSize: "0.72rem",
                    fontWeight: isActive ? "800" : "600",
                    cursor: "pointer",
                    transition: "all 0.2s ease"
                  }}
                >
                  {met.label}
                </button>
              );
            })}

            <button
              onClick={handleNext}
              title="Следующий график"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#fff",
                borderRadius: "6px",
                width: "24px",
                height: "24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                fontSize: "0.85rem",
                fontWeight: "bold",
                transition: "all 0.15s ease"
              }}
            >
              ›
            </button>
          </div>
        </div>

        {/* Dynamic SVG Chart */}
        <div style={{ width: "100%", display: "flex", alignItems: "center", overflow: "hidden" }}>
          <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "100%", overflow: "visible" }}>
            <defs>
              <linearGradient id={`chartAreaGrad_${activeMetric.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={activeMetric.color} stopOpacity="0.28" />
                <stop offset="100%" stopColor={activeMetric.color} stopOpacity="0.0" />
              </linearGradient>
              <filter id={`glow_${activeMetric.id}`} x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Horizontal Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1.0].map((t, idx) => {
              const yVal = minValue + t * valRange;
              const y = getY(yVal);
              return (
                <g key={idx}>
                  <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray="4,4" />
                  <text x={paddingLeft - 6} y={y + 3} fill="var(--text-muted)" fontSize="8" fontWeight="600" textAnchor="end">
                    {activeMetric.formatAxis(yVal)}
                  </text>
                </g>
              );
            })}

            {/* Area Path */}
            {points.length > 0 && (
              <path d={areaPath} fill={`url(#chartAreaGrad_${activeMetric.id})`} />
            )}

            {/* Line Path */}
            {points.length > 0 && (
              <path 
                d={linePath} 
                fill="none" 
                stroke={activeMetric.lineColor} 
                strokeWidth="2.5" 
                filter={`url(#glow_${activeMetric.id})`} 
                strokeLinecap="round" 
                strokeLinejoin="round" 
              />
            )}

            {/* Dots */}
            {points.map((p, idx) => (
              <g key={idx}>
                {/* Glow ring */}
                <circle 
                  cx={p.x} 
                  cy={p.y} 
                  r="5.5" 
                  fill={activeMetric.color} 
                  opacity="0.35"
                />
                {/* Dot */}
                <circle 
                  cx={p.x} 
                  cy={p.y} 
                  r="4" 
                  fill={p.won ? "var(--success)" : "var(--danger)"} 
                  stroke="#fff" 
                  strokeWidth="1.5" 
                  style={{ cursor: "pointer" }}
                />
                {/* Invisible hit target for hover tooltip */}
                <circle 
                  cx={p.x} 
                  cy={p.y} 
                  r="10" 
                  fill="transparent" 
                  style={{ cursor: "pointer" }}
                >
                  <title>{`${p.mapName} (${p.score || "Счет"})\n${activeMetric.shortName}: ${p.displayVal}\nРезультат: ${p.won ? "Победа" : "Поражение"}\n${p.finishedAt || ""}`}</title>
                </circle>
                {/* Value label above dots */}
                <text x={p.x} y={p.y - 8} fill="#fff" fontSize="8" fontWeight="800" textAnchor="middle">
                  {p.displayVal}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </div>
    );
  };

  const renderComparisonCard = () => {
    if (!hubStats) return null;

    const hubAvg = hubStats.hubAverages || { kd: 1.05, adr: 75.0, hsPct: 40, entrySuccessRate: 50 };

    const metrics = [
      { name: "Средний K/D", player: hubStats.kd, avg: hubAvg.kd, format: (val: number) => val.toFixed(2), max: 2.0 },
      { name: "Средний урон за раунд (ADR)", player: hubStats.adr || 0, avg: hubAvg.adr, format: (val: number) => `${val.toFixed(1)} HP`, max: 120 },
      { name: "Попадания в голову (HS%)", player: hubStats.hsPct || 0, avg: hubAvg.hsPct, format: (val: number) => `${val}%`, max: 100 },
      { name: "Успех первых дуэлей", player: hubStats.duels?.entrySuccessRate || 0, avg: hubAvg.entrySuccessRate, format: (val: number) => `${val}%`, max: 100 }
    ];

    return (
      <div className="glass-card" style={{ padding: "1.25rem", borderRadius: "16px", border: "1px solid var(--border-light)", display: "flex", flexDirection: "column", gap: "1rem", marginTop: "auto" }}>
        <div>
          <span style={{ fontSize: "0.9rem", fontWeight: "800", color: "#fff", display: "block" }}>Сравнение со средним значением по Хабу</span>
          <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "block", marginTop: "0.15rem" }}>Сопоставление ваших показателей со средней статистикой игроков хаба</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          {metrics.map((m, idx) => {
            const playerPct = Math.min(100, Math.max(10, (m.player / m.max) * 100));
            const avgPct = Math.min(100, Math.max(10, (m.avg / m.max) * 100));
            const isBetter = m.player >= m.avg;

            return (
              <div key={idx} style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem" }}>
                  <span style={{ fontWeight: "700", color: "var(--text-secondary)" }}>{m.name}</span>
                  <span style={{ color: isBetter ? "var(--success)" : "var(--danger)", fontWeight: "800" }}>
                    {m.format(m.player)} <span style={{ color: "var(--text-muted)", fontWeight: "normal", fontSize: "0.7rem" }}>vs {m.format(m.avg)} Ср.</span>
                  </span>
                </div>
                {/* Visual Progress Bar */}
                <div style={{ height: "6px", background: "rgba(255,255,255,0.05)", borderRadius: "3px", position: "relative", overflow: "hidden" }}>
                  {/* Avg Marker Line */}
                  <div style={{
                    position: "absolute",
                    left: `${avgPct}%`,
                    top: 0, bottom: 0,
                    width: "2px",
                    background: "#ffd54f",
                    zIndex: 2,
                    boxShadow: "0 0 4px #ffd54f"
                  }} title="Hub Average" />
                  
                  {/* Player Fill */}
                  <div style={{
                    height: "100%",
                    width: `${playerPct}%`,
                    background: isBetter ? "linear-gradient(90deg, var(--accent-purple), var(--accent-cyan))" : "linear-gradient(90deg, var(--accent-purple), var(--danger))",
                    borderRadius: "3px",
                    zIndex: 1
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  useEffect(() => {
    if (!playerId) return;
    try { fetch("/api/analytics", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: `/players/${playerId}` }) }).catch(() => {}); } catch(e) {}

    const loadData = async () => {
      setIsLoading(true);
      try {
        // Fetch active fantasy tournament winner
        fetch("/api/fantasy/tournament")
          .then(r => r.ok ? r.json() : null)
          .then(d => {
            if (d?.tournament?.winnerNickname) setFantasyWinnerNick(d.tournament.winnerNickname);
            if (d?.tournament?.winnerSteamId) setFantasyWinnerSteamId(d.tournament.winnerSteamId);
          })
          .catch(() => {});

        // Fetch core profile and hub stats in parallel
        const [profileRes, hubStatsRes] = await Promise.all([
          fetch(`/api/faceit/players/${playerId}`),
          fetch(`/api/faceit/players/${playerId}/hub-stats`, { cache: "no-store" })
        ]);

        if (!profileRes.ok) throw new Error("Профиль не найден");
        const profileData = await profileRes.json();
        setProfile(profileData);

        if (hubStatsRes.ok) {
          const statsData = await hubStatsRes.json();
          setHubStats(statsData);
        }

        // Immediately unlock the UI for ultra-fast instant render
        setIsLoading(false);

        // Fetch secondary third-party stats (Leetify, Steam) asynchronously in background
        fetch(`/api/faceit/players/${playerId}/leetify`)
          .then(r => r.ok ? r.json() : null)
          .then(data => {
            if (data && !data.error) setLeetify(data);
          })
          .catch(() => {});

        fetch(`/api/faceit/players/${playerId}/steam-stats`)
          .then(r => r.ok ? r.json() : null)
          .then(data => {
            if (data && !data.error) setSteamStats(data);
          })
          .catch(() => {});

      } catch (err) {
        console.error(err);
        setIsLoading(false);
      }
    };

    loadData();
  }, [playerId]);

  if (isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", backgroundColor: "var(--bg-primary)" }}>
        <div style={{ textAlign: "center" }}>
          <div className="glow-text-cyan" style={{ fontSize: "1.5rem", fontWeight: "700" }}>Загрузка аналитики хаба...</div>
          <div style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginTop: "0.5rem" }}>Считываем локальную статистику матчей хаба и Leetify</div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", backgroundColor: "var(--bg-primary)" }}>
        <div style={{ textAlign: "center" }}>
          <h2 style={{ color: "var(--danger)", fontSize: "2rem" }}>Профиль не найден</h2>
          <Link href="/" style={{ color: "var(--accent-cyan)", textDecoration: "underline", display: "inline-block", marginTop: "1rem" }}>
            Вернуться на главную
          </Link>
        </div>
      </div>
    );
  }

  const cs2Info = profile.games?.cs2 || profile.games?.csgo;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)", color: "var(--text-primary)", padding: "2rem 1.5rem" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        
        {/* Navigation Header */}
        <div style={{ marginBottom: "2rem" }}>
          <Link 
            href="/" 
            style={{ 
              display: "inline-flex", 
              alignItems: "center", 
              gap: "0.5rem", 
              color: "var(--text-secondary)", 
              fontSize: "0.9rem", 
              textDecoration: "none",
              background: "rgba(255, 255, 255, 0.02)",
              border: "1px solid var(--border-light)",
              padding: "0.5rem 1rem",
              borderRadius: "8px",
              fontWeight: "600"
            }}
          >
            <span>←</span> На главную
          </Link>
        </div>

        {/* Profile Layout */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          
          {/* Top Info Header */}
          <div className="glass-card" style={{ padding: "2rem", borderRadius: "16px", border: "1px solid var(--border-light)", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "1.25rem", position: "relative" }}>
            {/* Top decorative line */}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: "linear-gradient(90deg, var(--accent-purple), var(--accent-cyan))" }} />
            
            {/* Avatar */}
            {(() => {
              const isChamp = Boolean(
                fantasyWinnerNick && (
                  profile.nickname?.toLowerCase() === fantasyWinnerNick.toLowerCase() ||
                  profile.player_id === fantasyWinnerNick ||
                  (fantasyWinnerSteamId && profile.steam_id_64 === fantasyWinnerSteamId)
                )
              );
              return (
                <div style={{
                  width: "100px",
                  height: "100px",
                  borderRadius: "16px",
                  overflow: "hidden",
                  background: "#1c1829",
                  border: isChamp ? "2.5px solid #ffd700" : "2px solid var(--border-light)",
                  boxShadow: isChamp ? "0 0 25px rgba(255, 215, 0, 0.4), 0 4px 20px rgba(0,0,0,0.4)" : "0 4px 20px rgba(0,0,0,0.4)"
                }}>
              {profile.avatar ? (
                <img src={profile.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem", fontWeight: "800", color: "var(--text-muted)" }}>
                  {profile.nickname.substring(0, 2).toUpperCase()}
                </div>
              )}
            </div>
            );
            })()}

            {/* Name and Links */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                <h1 style={{ fontSize: "2.2rem", fontWeight: "900", color: "#fff", letterSpacing: "-0.03em", margin: 0 }}>{profile.nickname}</h1>
                {Boolean(
                  fantasyWinnerNick && (
                    profile.nickname?.toLowerCase() === fantasyWinnerNick.toLowerCase() ||
                    profile.player_id === fantasyWinnerNick ||
                    (fantasyWinnerSteamId && profile.steam_id_64 === fantasyWinnerSteamId)
                  )
                ) && (
                  <span style={{
                    fontSize: "0.75rem",
                    padding: "0.25rem 0.65rem",
                    borderRadius: "10px",
                    background: "linear-gradient(135deg, #ffd700, #ff9100)",
                    color: "#000",
                    fontWeight: "900",
                    letterSpacing: "0.5px"
                  }}>
                    ФАНТАЗЕР СЕЗОНА
                  </span>
                )}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "1rem", marginTop: "0.5rem" }}>
                {profile.country && (
                  <span style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
                    Страна: <strong style={{ color: "#fff" }}>{profile.country.toUpperCase()}</strong>
                  </span>
                )}
                {(profile.steam_id_64 || profile.platforms?.steam) && (
                  <a 
                    href={`https://steamcommunity.com/profiles/${profile.steam_id_64 || profile.platforms?.steam}`}
                    target="_blank" 
                    rel="noreferrer"
                    style={{ color: steamHover ? "#fff" : "var(--accent-cyan)", fontSize: "0.9rem", textDecoration: "none", fontWeight: "600", display: "inline-flex", alignItems: "center", gap: "0.4rem", transition: "color 0.2s" }}
                    onMouseEnter={() => setSteamHover(true)}
                    onMouseLeave={() => setSteamHover(false)}
                  >
                    <img src="/icons/steam.png" alt="" style={{ width: "16px", height: "16px", objectFit: "contain" }} />
                    <span>Steam Profile ↗</span>
                  </a>
                )}
                <a 
                  href={`https://www.faceit.com/ru/players/${profile.nickname}`}
                  target="_blank" 
                  rel="noreferrer"
                  style={{ color: faceitHover ? "#fff" : "var(--accent-purple)", fontSize: "0.9rem", textDecoration: "none", fontWeight: "600", display: "inline-flex", alignItems: "center", gap: "0.4rem", transition: "color 0.2s" }}
                  onMouseEnter={() => setFaceitHover(true)}
                  onMouseLeave={() => setFaceitHover(false)}
                >
                  <img src="/icons/faceit.png" alt="" style={{ width: "16px", height: "16px", objectFit: "contain" }} />
                  <span>FACEIT Profile ↗</span>
                </a>
                <button
                  onClick={handleCopyProfile}
                  onMouseEnter={() => setCopyHover(true)}
                  onMouseLeave={() => setCopyHover(false)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: copied ? "#4caf50" : (copyHover ? "#fff" : "rgba(255, 255, 255, 0.7)"),
                    fontSize: "0.9rem",
                    fontWeight: "600",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.4rem",
                    cursor: "pointer",
                    padding: 0,
                    transition: "color 0.2s"
                  }}
                >
                  <svg viewBox="0 0 24 24" style={{ width: "16px", height: "16px", fill: copied ? "#4caf50" : (copyHover ? "#fff" : "rgba(255, 255, 255, 0.7)"), transition: "fill 0.2s" }}>
                    <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                  </svg>
                  <span>{copied ? "Ссылка скопирована!" : "Скопировать ссылку профиля"}</span>
                </button>
              </div>
            </div>

            {/* Level and Elo */}
            {cs2Info && (
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "1.25rem", background: "rgba(0,0,0,0.25)", border: "1px solid var(--border-light)", padding: "0.75rem 1.5rem", borderRadius: "12px" }}>
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", textTransform: "uppercase", fontWeight: "700" }}>Faceit ELO</span>
                  <span style={{ fontWeight: "800", color: "#fff", fontSize: "1.3rem" }}>{cs2Info.faceit_elo}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.15rem" }}>
                  <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: "700" }}>LEVEL</span>
                  <img 
                    src={`/icons/faceit_level_${cs2Info.skill_level}.svg`} 
                    alt={`Level ${cs2Info.skill_level}`} 
                    style={{ width: "32px", height: "32px", objectFit: "contain", display: "block", marginTop: "0.15rem" }} 
                  />
                </div>
              </div>
            )}
          </div>

          {/* Skill Rating & Premier CS Rating Dedicated Block */}
          {(() => {
            const eloVal = cs2Info?.faceit_elo;
            const realPremier = steamStats?.premierRating;
            const pId = profile?.player_id || profile?.user_id || profile?.id || playerId;
            const combatStats = hubStats || (profile?.lifetime ? {
              kd: profile.lifetime["Average K/D Ratio"],
              hsPct: profile.lifetime["Average Headshots %"],
              winrate: profile.lifetime["Win Rate %"],
              avgKills: profile.lifetime["Average Kills"]
            } : null);
            const faceitMatches = (profile?.games?.cs2 as any)?.matches || (profile?.lifetime as any)?.Matches || 500;
            const premierMatches = steamStats?.premierMatches || 0;
            const sk = getPlayerSkillInfo(pId, profile?.nickname, eloVal, realPremier, combatStats, faceitMatches, premierMatches);
            const wRecord = (pId && weeklySkillMap[pId]) || 
                            (profile?.nickname && weeklySkillMap[profile.nickname.toLowerCase()]) || 
                            (profile?.nickname && weeklySkillMap[profile.nickname]);
            const delta = wRecord?.weeklyDelta;
            const prevScore = wRecord?.previousScore;

            return (
              <div className="glass-card" style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "1.1rem 1.5rem",
                borderRadius: "16px",
                background: "rgba(255, 255, 255, 0.02)",
                border: "1px solid var(--border-light)",
                gap: "1rem",
                flexWrap: "wrap"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
                  <span 
                    style={{
                      fontSize: "1.4rem",
                      fontWeight: "900",
                      background: sk.bg,
                      border: `1px solid ${sk.border}`,
                      color: sk.color,
                      padding: "0.45rem 1rem",
                      borderRadius: "12px",
                      boxShadow: sk.glow || "none"
                    }}
                  >
                    {sk.score} / 100
                  </span>
                  <div>
                    <span style={{ fontSize: "1rem", fontWeight: "800", color: sk.color }}>
                      {sk.tier} — Оценка скилла
                    </span>
                    <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", display: "block", marginTop: "0.2rem" }}>
                      Premier CS Rating {sk.isRealPremier ? "" : "(расчетный)"}: <strong style={{ color: "#fff" }}>{(sk?.csRating ?? 0).toLocaleString("ru-RU")}</strong>
                    </span>
                  </div>
                </div>

                {/* Weekly Skill Calibration Badge */}
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.85rem",
                  background: "rgba(0,0,0,0.25)",
                  border: "1px solid var(--border-light)",
                  padding: "0.5rem 1rem",
                  borderRadius: "10px"
                }}>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "0.4rem" }}>
                      <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "700" }}>
                        Еженедельный пересчет
                      </span>
                      {delta !== undefined && delta !== 0 && (
                        <span style={{
                          fontSize: "0.75rem",
                          fontWeight: "800",
                          color: delta > 0 ? "var(--success)" : "var(--danger)",
                          background: delta > 0 ? "rgba(0,230,118,0.15)" : "rgba(255,77,77,0.15)",
                          padding: "0.1rem 0.4rem",
                          borderRadius: "4px",
                          border: `1px solid ${delta > 0 ? "rgba(0,230,118,0.3)" : "rgba(255,77,77,0.3)"}`
                        }}>
                          {delta > 0 ? `▲ +${delta}` : `▼ ${delta}`}
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginTop: "0.15rem" }}>
                      {prevScore !== undefined ? `Прошлая неделя: ${prevScore} баллов` : "Обновление: каждый понедельник"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Detailed Statistics Container */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.25rem", alignItems: "stretch" }}>
            
            {/* Left Panel: Tabs & Metrics */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", height: "100%" }}>
              
              {/* Disclaimer */}
              <div style={{
                padding: "0.75rem 1rem",
                background: "rgba(0, 212, 255, 0.05)",
                border: "1px solid rgba(0, 212, 255, 0.15)",
                borderRadius: "10px",
                fontSize: "0.78rem",
                color: "var(--text-secondary)",
                display: "flex",
                alignItems: "center",
                gap: "0.6rem"
              }}>
                <svg viewBox="0 0 24 24" style={{ width: "16px", height: "16px", fill: "var(--accent-cyan)", flexShrink: 0 }}>
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
                </svg>
                <span>Вся статистика собрана по матчам Хаба, за исключением вкладки <strong>«Статистика (все игры)»</strong>.</span>
              </div>

              {/* Tabs Navigation Card */}
              <div className="glass-card" style={{ padding: "0.5rem", borderRadius: "12px", border: "1px solid var(--border-light)", display: "flex", gap: "0.25rem" }}>
                {[
                  { id: "general", label: "Статистика (хаб)" },
                  { id: "tactical", label: "Статистика (все игры)" },
                  { id: "maps", label: "Статистика по картам" }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    style={{
                      flex: 1,
                      background: activeTab === tab.id ? "linear-gradient(135deg, var(--accent-purple), var(--accent-cyan))" : "transparent",
                      color: activeTab === tab.id ? "#fff" : "var(--text-secondary)",
                      border: "none",
                      padding: "0.65rem 1rem",
                      fontSize: "0.85rem",
                      fontWeight: "700",
                      borderRadius: "8px",
                      cursor: "pointer",
                      transition: "all 0.2s"
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* General Tab Content */}
              {activeTab === "general" && hubStats && (
                <div className="glass-card" style={{ padding: "1.5rem", borderRadius: "16px", border: "1px solid var(--border-light)", display: "flex", flexDirection: "column", gap: "1.25rem", height: "auto", overflow: "hidden", boxSizing: "border-box" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h3 style={{ fontSize: "1.1rem", fontWeight: "800", color: "#fff" }}>Статистика (хаб)</h3>
                    <span style={{ fontSize: "0.72rem", padding: "0.2rem 0.5rem", background: "rgba(0, 212, 255, 0.1)", border: "1px solid rgba(0, 212, 255, 0.2)", borderRadius: "6px", color: "var(--accent-cyan)", fontWeight: "700" }}>
                      Hub Scoped
                    </span>
                  </div>
                  
                  {/* Grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1rem" }}>
                    {[
                      { label: "Всего матчей", val: hubStats.matchesCount, sub: hubStats.mapsCount ? `${hubStats.mapsCount} карт` : null, color: "#fff" },
                      { label: "Процент побед", val: `${hubStats.winrate}%`, sub: hubStats.winsCount ? `${hubStats.winsCount} побед` : null, color: "var(--success)" },
                      { label: "Средний K/D", val: hubStats.kd.toFixed(2), sub: null, color: "var(--accent-cyan)" },
                      { label: "Средний HS%", val: `${hubStats.hsPct}%`, sub: null, color: "#fff" }
                    ].map((item, idx) => (
                      <div key={idx} style={{ background: "rgba(0,0,0,0.2)", border: "1px solid var(--border-light)", borderRadius: "10px", padding: "1rem" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{item.label}</span>
                          {item.sub && (
                            <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", background: "rgba(255,255,255,0.04)", padding: "0.1rem 0.35rem", borderRadius: "4px" }}>
                              {item.sub}
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: "1.4rem", fontWeight: "800", color: item.color, display: "block", marginTop: "0.25rem" }}>{item.val}</span>
                      </div>
                    ))}
                  </div>

                  {/* Win Streaks */}
                  <div style={{ display: "flex", gap: "1rem", marginTop: "0.5rem" }}>
                    <div style={{ flex: 1, background: "rgba(0,0,0,0.2)", border: "1px solid var(--border-light)", borderRadius: "10px", padding: "1rem", textAlign: "center" }}>
                      <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)", display: "block" }}>Текущий стрик</span>
                      <span style={{ fontSize: "1.3rem", fontWeight: "800", color: "var(--success)", display: "block", marginTop: "0.25rem" }}>
                        {(hubStats.streaks?.current || 0) > 0 ? `+${hubStats.streaks?.current} побед` : "0 побед"}
                      </span>
                    </div>
                    <div style={{ flex: 1, background: "rgba(0,0,0,0.2)", border: "1px solid var(--border-light)", borderRadius: "10px", padding: "1rem", textAlign: "center" }}>
                      <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)", display: "block" }}>Лучший стрик</span>
                      <span style={{ fontSize: "1.3rem", fontWeight: "800", color: "#fff", display: "block", marginTop: "0.25rem" }}>
                        {hubStats.streaks?.longest || 0} побед
                      </span>
                    </div>
                  </div>

                  {/* Form */}
                  {Array.isArray(hubStats.recentResults) && hubStats.recentResults.length > 0 && (
                    <div style={{ background: "rgba(0,0,0,0.15)", borderRadius: "10px", padding: "1rem", border: "1px dashed var(--border-light)" }}>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.75rem" }}>Последние 5 игр</span>
                      <div style={{ display: "flex", gap: "0.75rem" }}>
                        {hubStats.recentResults.map((res: string, i: number) => {
                          const isWin = res === "1";
                          return (
                            <div 
                              key={i} 
                              style={{
                                flex: 1, height: "32px", borderRadius: "8px",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: "0.85rem", fontWeight: "800",
                                background: isWin ? "rgba(76, 175, 80, 0.15)" : "rgba(244, 67, 54, 0.15)",
                                border: isWin ? "1px solid rgba(76, 175, 80, 0.35)" : "1px solid rgba(244, 67, 54, 0.35)",
                                color: isWin ? "#4caf50" : "#f44336"
                              }}
                            >
                              {isWin ? "W" : "L"}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Hub Tactical Stats */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "0.4rem", marginTop: "0.25rem" }}>
                    {[
                      { title: "Атака", items: [
                        { label: "Средний урон (ADR)", val: hubStats.adr ? `${hubStats.adr} HP` : "—" },
                        { label: "Убийств за раунд (KPR)", val: hubStats.totalRounds > 0 ? (hubStats.totalKills / hubStats.totalRounds).toFixed(2) : "—" }
                      ], color: "var(--accent-cyan)" }
                    ].map((section, idx) => (
                      <div key={idx} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-light)", borderRadius: "10px", padding: "0.75rem 1rem" }}>
                        <span style={{ fontSize: "0.82rem", fontWeight: "800", color: section.color, display: "block", marginBottom: "0.4rem" }}>{section.title}</span>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                          {section.items.map((item, i) => (
                            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem" }}>
                              <span style={{ color: "var(--text-secondary)" }}>{item.label}:</span>
                              <span style={{ fontWeight: "700", color: "#fff" }}>{item.val}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Best Weapon */}
                  <div style={{
                    marginTop: "0.25rem",
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid var(--border-light)",
                    borderRadius: "10px",
                    padding: "0.75rem 1rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "1rem"
                  }}>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: "0.82rem", fontWeight: "800", color: "var(--accent-yellow)", display: "block", marginBottom: "0.4rem" }}>Лучшее оружие</span>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", fontSize: "0.78rem" }}>
                        {(() => {
                          const sniperKills = hubStats.sniper?.kills || 0;
                          const sniperRate = hubStats.sniper?.rate || 0;
                          const isSniper = sniperRate >= 30;
                          const weaponName = isSniper ? "AWP" : "AK-47";
                          const weaponKills = isSniper ? sniperKills : (hubStats.totalKills - sniperKills);
                          return (
                            <>
                              <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <span style={{ color: "var(--text-secondary)" }}>Топ оружие:</span>
                                <span style={{ fontWeight: "700", color: "#fff" }}>{weaponName}</span>
                              </div>
                              <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <span style={{ color: "var(--text-secondary)" }}>Убийств со снайперской винтовки:</span>
                                <span style={{ fontWeight: "700", color: "var(--accent-yellow)" }}>{sniperKills} ({sniperRate}%)</span>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                    <div style={{ fontSize: "2rem", lineHeight: 1, opacity: 0.95, flexShrink: 0, display: "flex", alignItems: "center" }}>
                      <img
                        src={`https://raw.githubusercontent.com/ChetdeJong/cs2-killfeed-generator/master/public/weapons/${(hubStats.sniper?.rate || 0) >= 30 ? "awp" : "ak47"}.svg`}
                        alt={(hubStats.sniper?.rate || 0) >= 30 ? "AWP" : "AK-47"}
                        style={{ width: "80px", height: "auto", filter: "drop-shadow(0 0 6px rgba(255,200,0,0.4))" }}
                        onError={(e: any) => { e.target.style.display = "none"; }}
                      />
                    </div>
                  </div>

                  {/* Hub Maps Summary Info to balance height */}
                  <div style={{
                    marginTop: "0.25rem",
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid var(--border-light)",
                    borderRadius: "10px",
                    padding: "0.75rem 1rem"
                  }}>
                    <span style={{ fontSize: "0.82rem", fontWeight: "800", color: "var(--accent-cyan)", display: "block", marginBottom: "0.4rem" }}>Карты</span>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", fontSize: "0.78rem" }}>
                      {(() => {
                        const mapsList = hubStats.maps || [];
                        const totalMapGames = mapsList.reduce((sum: number, m: any) => sum + (m.matches || 0), 0);
                        
                        // Most played map
                        let mostPlayedMap = "—";
                        let maxPlayed = 0;
                        mapsList.forEach((m: any) => {
                          if ((m.matches || 0) > maxPlayed) {
                            maxPlayed = m.matches;
                            mostPlayedMap = m.map;
                          }
                        });

                        return (
                          <>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                              <span style={{ color: "var(--text-secondary)" }}>Всего сыграно игр на картах:</span>
                              <span style={{ fontWeight: "700", color: "#fff" }}>{totalMapGames}</span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                              <span style={{ color: "var(--text-secondary)" }}>Самая популярная карта:</span>
                              <span style={{ fontWeight: "700", color: "#fff" }}>
                                {mostPlayedMap.replace("de_", "").replace("cs_", "").toUpperCase()} {maxPlayed > 0 ? `(${maxPlayed} игр)` : ""}
                              </span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                              <span style={{ color: "var(--text-secondary)" }}>Лучшая игра:</span>
                              {hubStats.bestMatch ? (
                                <span style={{ fontWeight: "700", color: "var(--accent-yellow)" }}>
                                  {hubStats.bestMatch.map.replace("de_", "").replace("cs_", "").toUpperCase()} ({hubStats.bestMatch.score}) • {hubStats.bestMatch.kills}K/{hubStats.bestMatch.deaths}D
                                </span>
                              ) : (
                                <span style={{ fontWeight: "700", color: "#fff" }}>—</span>
                              )}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                </div>
              )}

              {/* Tactical Tab Content */}
              {activeTab === "tactical" && hubStats && (
                <div className="glass-card" style={{ padding: "1.5rem", borderRadius: "16px", border: "1px solid var(--border-light)", display: "flex", flexDirection: "column", gap: "1.25rem", height: "auto", overflow: "hidden", boxSizing: "border-box" }}>
                  
                  {/* Leetify Card */}
                  {leetify ? (
                    <div style={{
                      background: "linear-gradient(135deg, rgba(30, 215, 96, 0.06) 0%, rgba(20, 20, 30, 0.4) 100%)",
                      border: "1px solid rgba(30, 215, 96, 0.3)",
                      borderRadius: "14px",
                      padding: "1.25rem"
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                        <div>
                          <span style={{ fontSize: "1rem", fontWeight: "800", color: "#fff" }}>Рейтинг Leetify</span>
                          <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "block" }}>Сравнительный тактический показатель (все игры)</span>
                        </div>
                        {(() => {
                           const val = parseFloat(leetify.ranks?.leetify);
                           const isPos = val >= 0;
                           if (isNaN(val)) return <div style={{ color: "var(--text-secondary)", fontWeight: "800", fontSize: "1.1rem" }}>—</div>;
                           return (
                             <div style={{
                               background: isPos ? "rgba(76,175,80,0.18)" : "rgba(244,67,54,0.18)",
                               border: isPos ? "1px solid rgba(76,175,80,0.4)" : "1px solid rgba(244,67,54,0.4)",
                               color: isPos ? "#4caf50" : "#f44336",
                               padding: "0.4rem 1rem",
                               borderRadius: "8px",
                               fontWeight: "900",
                               fontSize: "1.2rem"
                             }}>
                               {isPos ? `+${val.toFixed(2)}` : val.toFixed(2)}
                             </div>
                           );
                         })()}
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.75rem" }}>
                        {[
                          { label: "Aim (стрельба)", val: leetify.rating?.aim !== undefined ? `${leetify.rating.aim.toFixed(1)} / 100` : "—", highlightColor: "var(--accent-cyan)" },
                          { label: "Позиционирование", val: leetify.rating?.positioning !== undefined ? `${leetify.rating.positioning.toFixed(1)} / 100` : "—", highlightColor: "var(--success)" },
                          { label: "Поведение в клатчах", val: leetify.rating?.clutch !== undefined ? (leetify.rating.clutch >= 0 ? `+${leetify.rating.clutch.toFixed(2)}` : leetify.rating.clutch.toFixed(2)) : "—", highlightColor: "#00d4ff" },
                          { label: "Первые дуэли (Opening)", val: leetify.rating?.opening !== undefined ? (leetify.rating.opening >= 0 ? `+${leetify.rating.opening.toFixed(2)}` : leetify.rating.opening.toFixed(2)) : "—", highlightColor: "var(--warning)" },
                          { label: "Рейтинг T / CT", val: `${leetify.rating?.t_leetify >= 0 ? "+" : ""}${parseFloat(leetify.rating?.t_leetify || 0).toFixed(2)} / ${leetify.rating?.ct_leetify >= 0 ? "+" : ""}${parseFloat(leetify.rating?.ct_leetify || 0).toFixed(2)}`, highlightColor: "#fff" },
                          { label: "Использование гранат", val: leetify.rating?.utility !== undefined ? `${leetify.rating.utility.toFixed(1)} / 100` : "—", highlightColor: "var(--accent-purple)" }
                        ].map((item, idx) => (
                          <div key={idx} style={{ background: "rgba(0,0,0,0.25)", borderRadius: "8px", padding: "0.6rem 0.85rem", border: "1px solid var(--border-light)" }}>
                            <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", display: "block" }}>{item.label}</span>
                            <span style={{ fontSize: "1rem", fontWeight: "800", color: item.highlightColor, display: "block", marginTop: "0.15rem" }}>{item.val}</span>
                          </div>
                        ))}
                      </div>

                      {/* Detailed overall indicators */}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.75rem 2.5rem", marginTop: "1rem" }}>
                        {[
                          { label: "Ошибка прицела (Preaim)", val: leetify.stats.preaim !== undefined ? `${parseFloat(leetify.stats.preaim).toFixed(1)}°` : "—" },
                          { label: "Время реакции", val: leetify.stats.reaction_time_ms !== undefined ? `${Math.round(leetify.stats.reaction_time_ms)} ms` : "—" },
                          { label: "Точность Aim", val: leetify.stats.accuracy_enemy_spotted !== undefined ? `${Math.round(leetify.stats.accuracy_enemy_spotted)}%` : "—" },
                          { label: "Контр-стрейф", val: leetify.stats.counter_strafing_good_shots_ratio !== undefined ? `${Math.round(leetify.stats.counter_strafing_good_shots_ratio)}%` : "—" },
                          { label: "Точность спрея", val: leetify.stats.spray_accuracy !== undefined ? `${Math.round(leetify.stats.spray_accuracy)}%` : "—" },
                          { label: "Урон гранатой (HE)", val: leetify.stats.he_foes_damage_avg !== undefined ? `${leetify.stats.he_foes_damage_avg.toFixed(1)} HP` : "—" },
                          { label: "Время ослепления флешкой", val: leetify.stats.flashbang_hit_foe_avg_duration !== undefined ? `${leetify.stats.flashbang_hit_foe_avg_duration.toFixed(1)} сек` : "—" },
                          { label: "Флешки под убийство", val: leetify.stats.flashbang_leading_to_kill !== undefined ? `${Math.round(leetify.stats.flashbang_leading_to_kill)}%` : "—" },
                          { label: "Успешные размены", val: leetify.stats.trade_kills_success_percentage !== undefined ? `${Math.round(leetify.stats.trade_kills_success_percentage)}%` : "—" },
                          { label: "Размен игрока после его смерти", val: leetify.stats.traded_deaths_success_percentage !== undefined ? `${Math.round(leetify.stats.traded_deaths_success_percentage)}%` : "—" }
                        ].map((item, idx) => (
                          <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", borderBottom: "1px solid rgba(255,255,255,0.03)", paddingBottom: "0.3rem" }}>
                            <span style={{ color: "var(--text-secondary)" }}>{item.label}</span>
                            <span style={{ fontWeight: "700", color: "#fff" }}>{item.val}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      padding: "1rem",
                      background: "rgba(255, 255, 255, 0.01)",
                      border: "1px dashed var(--border-light)",
                      borderRadius: "10px",
                      fontSize: "0.78rem",
                      color: "var(--text-muted)",
                      lineHeight: "1.5"
                    }}>
                      Leetify: <strong>Этот игрок не имеет зарегистрированных данных на Leetify. Ниже выводится статистика по матчам Steam.</strong>
                    </div>
                  )}

                  {/* Valve Matchmaking & Steam Stats */}
                  {renderValveStats()}

                </div>
              )}

              
              {/* Maps Stats View in Left column fallback if tab chosen */}
              {activeTab === "maps" && hubStats && (
                <div className="glass-card" style={{ padding: "1.25rem", borderRadius: "16px", border: "1px solid var(--border-light)", display: "flex", flexDirection: "column", gap: "0.5rem", height: "auto", overflow: "hidden", boxSizing: "border-box" }}>
                  
                  {/* Maps Summary Box at the top */}
                  <div style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid var(--border-light)",
                    borderRadius: "12px",
                    padding: "0.85rem 1rem",
                    marginBottom: "0.5rem"
                  }}>
                    <span style={{ fontSize: "0.8rem", fontWeight: "800", color: "var(--accent-cyan)", display: "block", marginBottom: "0.4rem" }}>Общая статистика по картам</span>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", fontSize: "0.75rem" }}>
                      {(() => {
                        const mapsList = (hubStats.maps || []).filter((m: any) => !m.map.toLowerCase().includes("overpass") && !m.map.toLowerCase().includes("vertigo"));
                        const totalMapGames = mapsList.reduce((sum: number, m: any) => sum + (m.matches || 0), 0);
                        const totalWins = mapsList.reduce((sum: number, m: any) => sum + (m.wins || 0), 0);
                        const overallWr = totalMapGames > 0 ? Math.round((totalWins / totalMapGames) * 100) : 0;
                        const avgKd = hubStats.kd ?? 0;
                        
                        // Most played map
                        let mostPlayedMap = "—";
                        let maxPlayed = 0;
                        mapsList.forEach((m: any) => {
                          if ((m.matches || 0) > maxPlayed) {
                            maxPlayed = m.matches;
                            mostPlayedMap = m.map;
                          }
                        });

                        // Best map by winrate
                        let bestMap = "—";
                        let bestMapWr = 0;
                        let maxWinrate = -1;
                        mapsList.forEach((m: any) => {
                          if (m.matches > 0 && m.winrate > maxWinrate) {
                            maxWinrate = m.winrate;
                            bestMap = m.map;
                            bestMapWr = m.winrate;
                          }
                        });

                        // Worst map by winrate
                        let worstMap = "—";
                        let worstMapWr = 0;
                        let minWinrate = 101;
                        mapsList.forEach((m: any) => {
                          if (m.matches > 1 && m.winrate < minWinrate) {
                            minWinrate = m.winrate;
                            worstMap = m.map;
                            worstMapWr = m.winrate;
                          }
                        });

                        return (
                          <>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                              <span style={{ color: "var(--text-secondary)" }}>Всего игр:</span>
                              <span style={{ fontWeight: "700", color: "#fff" }}>{totalMapGames}</span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                              <span style={{ color: "var(--text-secondary)" }}>Общий WR:</span>
                              <span style={{ fontWeight: "700", color: overallWr >= 50 ? "var(--success)" : "var(--danger)" }}>{overallWr}%</span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                              <span style={{ color: "var(--text-secondary)" }}>Самая популярная карта:</span>
                              <span style={{ fontWeight: "700", color: "#fff" }}>
                                {mostPlayedMap.replace("de_", "").replace("cs_", "").toUpperCase()} ({maxPlayed} игр)
                              </span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                              <span style={{ color: "var(--text-secondary)" }}>Лучшая карта (WR):</span>
                              <span style={{ fontWeight: "700", color: "var(--success)" }}>
                                {bestMap.replace("de_", "").replace("cs_", "").toUpperCase()} ({bestMapWr}%)
                              </span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                              <span style={{ color: "var(--text-secondary)" }}>Худшая карта (WR):</span>
                              <span style={{ fontWeight: "700", color: "var(--danger)" }}>
                                {worstMap.replace("de_", "").replace("cs_", "").toUpperCase()} ({worstMapWr}%)
                              </span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                              <span style={{ color: "var(--text-secondary)" }}>Лучшая игра:</span>
                              {hubStats.bestMatch ? (
                                <span style={{ fontWeight: "700", color: "var(--accent-yellow)" }}>
                                  {hubStats.bestMatch.map.replace("de_", "").replace("cs_", "").toUpperCase()} ({hubStats.bestMatch.score}) • {hubStats.bestMatch.kills}K/{hubStats.bestMatch.deaths}D
                                </span>
                              ) : (
                                <span style={{ fontWeight: "700", color: "#fff" }}>—</span>
                              )}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {hubStats.maps?.filter((seg: any) => !seg.map.toLowerCase().includes("overpass") && !seg.map.toLowerCase().includes("vertigo")).map((seg: any, idx: number) => {
                      const mapName = seg.map;
                      const matches = seg.matches;
                      const winRate = seg.winrate;
                      const kd = seg.kd;
                      const adr = seg.adr;
                      const hsPct = seg.hsPct ?? 0;

                      return (
                        <div 
                          key={idx} 
                          style={{
                            position: "relative",
                            borderRadius: "12px",
                            overflow: "hidden",
                            background: "rgba(20, 18, 30, 0.8)",
                            border: "1px solid var(--border-light)",
                            display: "flex",
                            alignItems: "center",
                            padding: "0.5rem 1rem",
                            minHeight: "56px"
                          }}
                        >
                          {/* Background Map Image Overlay */}
                          <div 
                            style={{
                              position: "absolute",
                              right: 0, top: 0, bottom: 0,
                              width: "50%",
                              backgroundImage: `linear-gradient(to left, rgba(20, 18, 30, 0.2) 0%, rgba(20, 18, 30, 0.95) 75%, rgba(20, 18, 30, 1) 100%), url(${getMapImageUrl(mapName)})`,
                              backgroundSize: "cover",
                              backgroundPosition: "center",
                              opacity: 0.7,
                              zIndex: 0
                            }}
                          />
                          <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                            <div>
                              <span style={{ fontSize: "0.95rem", fontWeight: "800", color: "#fff", display: "block" }}>{mapName}</span>
                              <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                                Матчей: <strong>{matches}</strong> • Win Rate: {matches > 0 ? (
                                  <strong style={{ color: winRate >= 50 ? "var(--success)" : "var(--danger)" }}>{winRate}%</strong>
                                ) : (
                                  <strong>—</strong>
                                )}
                              </span>
                            </div>
                            <div style={{ display: "flex", gap: "1.25rem", textAlign: "right" }}>
                              <div>
                                <span style={{ fontSize: "0.68rem", color: "var(--accent-cyan)", display: "block" }}>Avg K/D</span>
                                <span style={{ fontSize: "0.9rem", fontWeight: "800", color: matches > 0 ? (kd >= 1.0 ? "var(--success)" : "var(--danger)") : "var(--text-muted)" }}>
                                  {matches > 0 ? kd.toFixed(2) : "—"}
                                </span>
                              </div>
                              <div>
                                <span style={{ fontSize: "0.68rem", color: "var(--accent-yellow)", display: "block" }}>ADR</span>
                                <span style={{ fontSize: "0.9rem", fontWeight: "800", color: matches > 0 && adr ? (adr >= 80 ? "var(--success)" : "var(--danger)") : "var(--text-muted)" }}>
                                  {matches > 0 && adr ? adr.toFixed(1) : "—"}
                                </span>
                              </div>
                              <div>
                                <span style={{ fontSize: "0.68rem", color: "var(--accent-purple)", display: "block" }}>HS%</span>
                                <span style={{ fontSize: "0.9rem", fontWeight: "800", color: matches > 0 ? (hsPct >= 40 ? "var(--success)" : "var(--danger)") : "var(--text-muted)" }}>
                                  {matches > 0 ? `${hsPct}%` : "—"}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                  {/* Winrate bars block to fill remaining space */}
                  {hubStats.maps && hubStats.maps.some((m: any) => m.matches > 0) && (
                    <div style={{
                      marginTop: "0.5rem",
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid var(--border-light)",
                      borderRadius: "12px",
                      padding: "0.85rem 1rem"
                    }}>
                      <span style={{ fontSize: "0.8rem", fontWeight: "800", color: "var(--accent-purple)", display: "block", marginBottom: "0.6rem" }}>Win Rate по картам</span>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                        {hubStats.maps.filter((m: any) => m.matches > 0).map((m: any, i: number) => (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.72rem" }}>
                            <span style={{ color: "var(--text-secondary)", minWidth: "72px", textAlign: "right" }}>
                              {m.map.replace("de_", "").replace("cs_", "").toUpperCase()}
                            </span>
                            <div style={{ flex: 1, height: "8px", background: "rgba(255,255,255,0.07)", borderRadius: "4px", overflow: "hidden" }}>
                              <div style={{
                                height: "100%",
                                width: `${m.winrate}%`,
                                borderRadius: "4px",
                                background: m.winrate >= 60 ? "var(--success)" : m.winrate >= 50 ? "rgba(76,175,80,0.6)" : m.winrate >= 40 ? "rgba(255,152,0,0.7)" : "var(--danger)",
                                transition: "width 0.6s ease"
                              }} />
                            </div>
                            <span style={{ color: m.winrate >= 50 ? "var(--success)" : "var(--danger)", fontWeight: "700", minWidth: "34px" }}>
                              {m.winrate}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}


              {/* HLTV Rating 2.0 SVG Trend Chart */}
              {renderRatingChart()}
            </div>

            {/* Right Panel: Advanced Tactical Breakdowns & Multi-Kills */}
            {hubStats && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", height: "100%" }}>
                
                {/* Est HLTV Rating Prominent Card */}
                <div className="glass-card" style={{ padding: "1.5rem", borderRadius: "16px", border: "1px solid var(--border-light)", display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "4px", background: "var(--accent-cyan)" }} />
                  <div>
                    <h4 style={{ fontSize: "0.9rem", fontWeight: "800", color: "var(--text-secondary)", textTransform: "uppercase" }}>Рейтинг HLTV 2.0</h4>
                    <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", display: "block", marginTop: "0.15rem" }}>Рассчитано по матчам внутри этого хаба</span>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span className="glow-text-cyan" style={{ fontSize: "2rem", fontWeight: "900", color: "var(--accent-cyan)" }}>{hubStats.hltvRating.toFixed(2)}</span>
                  </div>
                </div>

                {/* Multi-Kills Statistics */}
                <div className="glass-card" style={{ padding: "1.5rem", borderRadius: "16px", border: "1px solid var(--border-light)" }}>
                  <h3 style={{ fontSize: "1.1rem", fontWeight: "800", color: "#fff", marginBottom: "1rem" }}>Мульти-киллы</h3>
                  
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    {[
                      { type: "Двойные убийства (2K)", count: hubStats.multiKills?.doubles || 0, color: "var(--text-muted)" },
                      { type: "Тройные убийства (3K)", count: hubStats.multiKills?.triples || 0, color: "var(--text-secondary)" },
                      { type: "Квадро-убийства (4K)", count: hubStats.multiKills?.quadros || 0, color: "var(--accent-yellow)" },
                      { type: "Эйсы (5K)", count: hubStats.multiKills?.pentas || 0, color: "var(--danger)" }
                    ].map((item, idx) => (
                      <div key={idx} style={{ background: "rgba(0,0,0,0.18)", borderRadius: "8px", padding: "0.75rem 1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "0.85rem", fontWeight: "700", color: "#fff" }}>{item.type}</span>
                        <span style={{ fontSize: "1.2rem", fontWeight: "900", color: item.color }}>{item.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Opening Duels & Clutches */}
                <div className="glass-card" style={{ padding: "1.5rem", borderRadius: "16px", border: "1px solid var(--border-light)" }}>
                  <h3 style={{ fontSize: "1.1rem", fontWeight: "800", color: "#fff", marginBottom: "1rem" }}>Дуэли и Клатчи</h3>
                  
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    {[
                      { label: "Дуэлей первого контакта", val: hubStats.duels?.entryCount || "0", suffix: "дуэлей" },
                      { label: "Побед в первых дуэлях", val: hubStats.duels?.entryWins || "0", suffix: `(${hubStats.duels?.entrySuccessRate || 0}%)` },
                      { label: "Всего 1v1 дуэлей", val: hubStats.duels?.clutch1v1Count || "0", suffix: "клатчей" },
                      { label: "Побед 1v1", val: hubStats.duels?.clutch1v1Wins || "0", suffix: `(${hubStats.duels?.clutch1v1Rate || 0}%)` },
                      { label: "Всего 1v2 дуэлей", val: hubStats.duels?.clutch1v2Count || "0", suffix: "клатчей" },
                      { label: "Побед 1v2", val: hubStats.duels?.clutch1v2Wins || "0", suffix: `(${hubStats.duels?.clutch1v2Rate || 0}%)` },
                      { label: "Побед 1v3", val: hubStats.duels?.clutch1v3Wins || "0", suffix: "раз" },
                      { label: "Побед 1v4", val: hubStats.duels?.clutch1v4Wins || "0", suffix: "раз" },
                      { label: "Побед 1v5", val: hubStats.duels?.clutch1v5Wins || "0", suffix: "раз" },
                      { label: "Суммарно убийств в клатчах", val: hubStats.duels?.clutchKills || "0", suffix: "убийств" }
                    ].map((item, idx) => (
                      <div key={idx} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.03)", paddingBottom: "0.4rem", fontSize: "0.8rem" }}>
                        <span style={{ color: "var(--text-secondary)" }}>{item.label}</span>
                        <span style={{ fontWeight: "700", color: "#fff" }}>{item.val} <span style={{ color: "var(--text-muted)", fontSize: "0.72rem", fontWeight: "normal" }}>{item.suffix}</span></span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Granades detailed performance */}
                <div className="glass-card" style={{ padding: "1.5rem", borderRadius: "16px", border: "1px solid var(--border-light)", marginTop: "auto" }}>
                  <h3 style={{ fontSize: "1.1rem", fontWeight: "800", color: "#fff", marginBottom: "1rem" }}>Гранаты</h3>
                  
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    {[
                      { label: "Использовано гранат", val: hubStats.utility?.utilityCount || "0", suffix: "" },
                      { label: "Процент эффективности использования гранат", val: hubStats.utility?.utilitySuccessRate ? `${hubStats.utility.utilitySuccessRate}%` : "0%", suffix: "" },
                      { label: "Общий урон гранатами", val: hubStats.utility?.utilityDamage ? `${hubStats.utility.utilityDamage} HP` : "0 HP", suffix: "" },
                      { 
                        label: "Флешки", 
                        val: `${hubStats.utility?.flashCount || 0} бр / ${hubStats.utility?.flashSuccesses || 0} усп (${hubStats.utility?.flashSuccessRate || 0}%)`, 
                        suffix: `[ослеплено: ${hubStats.utility?.enemiesFlashed || 0}]` 
                      }
                    ].map((item, idx) => (
                      <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.03)", paddingBottom: "0.4rem", fontSize: "0.8rem", minHeight: "28px" }}>
                        <span style={{ color: "var(--text-secondary)" }}>{item.label}</span>
                        <span style={{ fontWeight: "700", color: "#fff", textAlign: "right", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                          {item.val} 
                          {item.suffix && <span style={{ color: "var(--text-muted)", fontSize: "0.72rem", fontWeight: "normal" }}>{item.suffix}</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Comparison Card - moved from left panel */}
                {renderComparisonCard()}

              </div>
            )}

          </div>

          {/* STANDALONE FANTASY STATS SECTION */}
          {profile && (() => {
            const pId = profile?.player_id || profile?.user_id || profile?.id || playerId;
            const nick = profile?.nickname || "";
            const ov = playerOverridesMap[pId] || playerOverridesMap[playerId] || playerOverridesMap[nick] || playerOverridesMap[nick.toLowerCase()] || {};
            let elo = ov.customElo || profile?.games?.cs2?.faceit_elo || 1000;
            let csRating = ov.csRating || Math.round(elo * 9.5);
            const sElo = Math.min(100, Math.max(10, (elo - 300) / 22));
            const sPremier = Math.min(100, Math.max(10, csRating / 260));
            const skillScore = ov.customSkillScore ?? Math.round((0.45 * sElo) + (0.55 * sPremier));
            const underdogBonus = Math.round((1.0 + ((100 - Math.min(100, Math.max(10, skillScore))) / 100) * 0.40) * 100) / 100;

            const recent = hubStats?.recentMatches || [];
            let totalFantasyPts = 0;
            let bestMatchPts = 0;

            recent.forEach((m: any) => {
              const kills = m.kills ?? 15;
              const assists = m.assists ?? 3;
              const isWin = Boolean(m.won === true || m.result === "WIN" || m.result === "1" || m.result === "win");
              const hs = m.headshots ?? Math.round(kills * ((m.hsPct || 45) / 100));
              
              const snipPts = kills * 2.0 + hs * 1.0;
              const suppPts = assists * 2.5 + (kills * 0.8);
              const winBonus = isWin ? 10 : 2;

              const matchTotal = Math.round(((snipPts * 0.5 + suppPts * 0.5 + winBonus)) * 10) / 10;
              totalFantasyPts += matchTotal;
              if (matchTotal > bestMatchPts) bestMatchPts = matchTotal;
            });

            if (recent.length === 0) {
              totalFantasyPts = Math.round((skillScore * 3.2) * 10) / 10;
              bestMatchPts = Math.round((skillScore * 0.55 + 15) * 10) / 10;
            }

            const avgFantasyPts = (totalFantasyPts / (recent.length || 1)).toFixed(1);

            return (
              <div className="glass-card animate-fade-in" style={{
                padding: "1.5rem",
                borderRadius: "16px",
                border: "1px solid rgba(192, 132, 252, 0.3)",
                background: "linear-gradient(135deg, rgba(20, 15, 35, 0.9) 0%, rgba(12, 10, 25, 0.95) 100%)",
                boxShadow: "0 0 30px rgba(124, 77, 255, 0.15)",
                display: "flex",
                flexDirection: "column",
                gap: "1.25rem",
                marginBottom: "0.5rem"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-light)", paddingBottom: "0.85rem", flexWrap: "wrap", gap: "0.5rem" }}>
                  <div>
                    <h3 style={{ fontSize: "1.15rem", fontWeight: "900", color: "#fff", margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      Fantasy статистика игрока
                    </h3>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                      Заработанные очки и турнирный профиль игрока в Fantasy League
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <span style={{ fontSize: "0.72rem", padding: "0.25rem 0.6rem", background: "rgba(192, 132, 252, 0.15)", border: "1px solid rgba(192, 132, 252, 0.3)", borderRadius: "6px", color: "var(--accent-purple)", fontWeight: "800" }}>
                      Fantasy League
                    </span>
                    <span style={{ fontSize: "0.72rem", padding: "0.25rem 0.6rem", background: "rgba(0, 229, 255, 0.1)", border: "1px solid rgba(0, 229, 255, 0.3)", borderRadius: "6px", color: "var(--accent-cyan)", fontWeight: "800" }}>
                      Скилл: {skillScore} очков
                    </span>
                  </div>
                </div>

                {/* 4 Key Metrics */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.75rem" }}>
                  <div style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--border-light)", borderRadius: "10px", padding: "0.85rem" }}>
                    <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)", display: "block" }}>Всего очков Fantasy</span>
                    <span style={{ fontSize: "1.35rem", fontWeight: "900", color: "var(--accent-cyan)", display: "block", marginTop: "0.2rem" }}>
                      {totalFantasyPts.toFixed(1)}
                    </span>
                  </div>

                  <div style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--border-light)", borderRadius: "10px", padding: "0.85rem" }}>
                    <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)", display: "block" }}>Среднее за матч</span>
                    <span style={{ fontSize: "1.35rem", fontWeight: "900", color: "#ffd54f", display: "block", marginTop: "0.2rem" }}>
                      {avgFantasyPts}
                    </span>
                  </div>

                  <div style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--border-light)", borderRadius: "10px", padding: "0.85rem" }}>
                    <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)", display: "block" }}>Рекорд за матч</span>
                    <span style={{ fontSize: "1.35rem", fontWeight: "900", color: "var(--success)", display: "block", marginTop: "0.2rem" }}>
                      {bestMatchPts}
                    </span>
                  </div>

                  <div style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--border-light)", borderRadius: "10px", padding: "0.85rem" }}>
                    <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)", display: "block" }}>Бонусный множитель</span>
                    <span style={{ fontSize: "1.35rem", fontWeight: "900", color: "var(--accent-purple)", display: "block", marginTop: "0.2rem" }}>
                      x{underdogBonus.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Popularity and Role Recommendation */}
                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-light)", borderRadius: "12px", padding: "1rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem", flexWrap: "wrap", gap: "0.5rem" }}>
                    <span style={{ fontSize: "0.82rem", fontWeight: "800", color: "#fff" }}>
                      Позиционирование в Драфте
                    </span>
                    <span style={{ fontSize: "0.75rem", color: "var(--accent-cyan)", fontWeight: "700" }}>
                      Показатель Скилла: {skillScore} очков
                    </span>
                  </div>
                  <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: 0, lineHeight: "1.4" }}>
                    {skillScore >= 75 && "Игрок высшего эшелона — приносит максимум очков на позиции Снайпера (фраги, открывающие дуэли и хедшоты)."}
                    {skillScore >= 50 && skillScore < 75 && "Надежный командный боец — отлично набирает очки на позиции Саппорта (ассисты, урон и клатчи)."}
                    {skillScore < 50 && `Бонусный множитель x${underdogBonus.toFixed(2)} — дает повышенные очки на роли Темная лошадка.`}
                  </p>
                </div>

                {/* Fantasy Scoring Rules Guide */}
                <div style={{ background: "rgba(0,0,0,0.25)", border: "1px dashed rgba(192, 132, 252, 0.25)", borderRadius: "12px", padding: "1rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.4rem" }}>
                    <span style={{ fontSize: "0.78rem", fontWeight: "800", color: "var(--accent-purple)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                      Правила начисления Fantasy-очков
                    </span>
                    <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", background: "rgba(255,255,255,0.05)", padding: "0.1rem 0.4rem", borderRadius: "4px" }}>
                      Победа: +10 pts
                    </span>
                  </div>

                  <p style={{ fontSize: "0.72rem", color: "var(--text-secondary)", margin: 0, lineHeight: "1.4" }}>
                    В турнире пики получают очки по выбранной роли (Снайпер / Саппорт / Лошадка). Индивидуальный рекорд в профиле и достижении — универсальный боевой скор за матч: <span style={{ color: "#fff", fontWeight: "700" }}>(Снайпер + Саппорт) / 2 + Победа</span>.
                  </p>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.5rem", fontSize: "0.72rem" }}>
                    <div style={{ background: "rgba(255,255,255,0.02)", padding: "0.55rem 0.7rem", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)" }}>
                      <div style={{ color: "var(--accent-cyan)", fontWeight: "800", marginBottom: "0.15rem" }}>Снайпер</div>
                      <div style={{ color: "var(--text-muted)", lineHeight: "1.3" }}>Фраги (×2.0), Хедшоты (×1.0), Первые дуэли (×1.5).</div>
                    </div>
                    <div style={{ background: "rgba(255,255,255,0.02)", padding: "0.55rem 0.7rem", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)" }}>
                      <div style={{ color: "#ffd54f", fontWeight: "800", marginBottom: "0.15rem" }}>Саппорт</div>
                      <div style={{ color: "var(--text-muted)", lineHeight: "1.3" }}>Ассисты (×2.5), Фраги (×0.8), Клатчи и урон.</div>
                    </div>
                    <div style={{ background: "rgba(255,255,255,0.02)", padding: "0.55rem 0.7rem", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)" }}>
                      <div style={{ color: "var(--accent-purple)", fontWeight: "800", marginBottom: "0.15rem" }}>Тёмная лошадка</div>
                      <div style={{ color: "var(--text-muted)", lineHeight: "1.3" }}>Боевой скор × персональный бонус (до ×1.40).</div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ACHIEVEMENTS & MEDALS SECTION */}
          {profile && (
            <div className="glass-card" style={{ padding: "1.75rem 2rem", borderRadius: "16px", border: "1px solid var(--border-light)" }}>
              <PlayerAchievements
                achievements={computePlayerAchievements({
                  hubStats,
                  profile,
                  leetify,
                  currentStreak: hubStats?.streak || 0,
                  hubPlayed: hubStats?.matches || 0,
                  hubWon: hubStats?.wins || 0
                })}
              />
            </div>
          )}

          {/* COMMENTS & VOUCHES WALL */}
          {profile && (
            <div className="glass-card" style={{ padding: "1.75rem 2rem", borderRadius: "16px", border: "1px solid var(--border-light)" }}>
              <PlayerCommentsWall
                targetPlayerId={profile?.player_id || profile?.id || playerId}
                targetPlayerNick={profile?.nickname || ""}
                currentUser={currentUser}
                isAdmin={currentUser?.role === "ADMIN"}
              />
            </div>
          )}

          {/* Bottom Section: Recent Matches History */}
          <div className="glass-card" style={{ padding: "2rem", borderRadius: "16px", border: "1px solid var(--border-light)" }}>
            <h3 style={{ fontSize: "1.2rem", fontWeight: "800", color: "#fff", marginBottom: "1.25rem" }}>Последние игры</h3>
            
            {hubStats && hubStats.recentMatches && hubStats.recentMatches.length === 0 ? (
              <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-secondary)" }}>
                Игрок еще не сыграл ни одной игры в этом хабе.
              </div>
            ) : hubStats && hubStats.recentMatches ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {hubStats.recentMatches.slice(0, visibleMatches).map((m: any, i: number) => (
                  <div 
                    key={i} 
                    style={{
                      position: "relative",
                      borderRadius: "12px",
                      overflow: "hidden",
                      background: "rgba(22, 17, 38, 0.4)",
                      border: "1px solid var(--border-light)",
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      padding: "1rem 1.25rem",
                      minHeight: "75px",
                      gap: "1.25rem"
                    }}
                  >
                    {/* Background Map Overlay */}
                    <div 
                      style={{
                        position: "absolute",
                        right: 0, top: 0, bottom: 0,
                        width: "35%",
                        backgroundImage: `linear-gradient(to left, rgba(22, 17, 38, 0.2) 0%, rgba(22, 17, 38, 0.95) 75%, rgba(22, 17, 38, 1) 100%), url(${getMapImageUrl(m.map)})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                        opacity: 0.5,
                        zIndex: 0
                      }}
                    />

                    {/* Left: Fixed-width Badge + Fixed-width Map Info */}
                    <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: "1.1rem", width: "270px", flexShrink: 0 }}>
                      <div 
                        style={{
                          background: m.won ? "rgba(76, 175, 80, 0.15)" : "rgba(244, 67, 54, 0.15)",
                          border: m.won ? "1px solid rgba(76, 175, 80, 0.35)" : "1px solid rgba(244, 67, 54, 0.35)",
                          color: m.won ? "#4caf50" : "#f44336",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "116px",
                          height: "32px",
                          boxSizing: "border-box",
                          padding: "0",
                          borderRadius: "6px",
                          fontSize: "0.8rem",
                          fontWeight: "800",
                          lineHeight: "1",
                          letterSpacing: "0px",
                          flexShrink: 0
                        }}
                      >
                        {m.won ? "ПОБЕДА" : "ПОРАЖЕНИЕ"}
                      </div>
                      <div style={{ width: "140px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        <span style={{ fontSize: "0.95rem", fontWeight: "800", color: "#fff", display: "block" }}>{m.map}</span>
                        <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>{m.finishedAt}</span>
                      </div>
                    </div>

                    {/* Middle: Score with Fixed Width */}
                    <div style={{ position: "relative", zIndex: 1, textAlign: "center", width: "80px", flexShrink: 0 }}>
                      <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "block" }}>Счет</span>
                      <span style={{ fontSize: "1.1rem", fontWeight: "800", color: "#fff" }}>{m.score}</span>
                    </div>

                    {/* Right: Personal Stats Grid with Exact Uniform Column Widths */}
                    <div style={{ position: "relative", zIndex: 1, display: "flex", flex: 1, justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
                      <div style={{ width: "95px", textAlign: "center" }}>
                        <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", display: "block" }}>K / D / A</span>
                        <span style={{ fontSize: "0.9rem", fontWeight: "800", color: "#fff" }}>{m.kills}/{m.deaths}/{m.assists}</span>
                      </div>
                      <div style={{ width: "80px", textAlign: "center" }}>
                        <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", display: "block" }}>K/D Ratio</span>
                        <span style={{ fontSize: "0.9rem", fontWeight: "800", color: m.kd >= 1.2 ? "var(--success)" : m.kd < 0.95 ? "var(--danger)" : "var(--text-primary)" }}>{m.kd.toFixed(2)}</span>
                      </div>
                      <div style={{ width: "80px", textAlign: "center" }}>
                        <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", display: "block" }}>Rating 2.0</span>
                        <span style={{ fontSize: "0.9rem", fontWeight: "800", color: m.rating >= 1.2 ? "var(--success)" : m.rating < 0.95 ? "var(--danger)" : "var(--accent-cyan)" }}>
                          {m.rating ? m.rating.toFixed(2) : "—"}
                        </span>
                      </div>
                      <div style={{ width: "80px", textAlign: "center" }}>
                        <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", display: "block" }}>Headshots</span>
                        <span style={{ fontSize: "0.9rem", fontWeight: "800", color: "#fff" }}>{m.hsPct}%</span>
                      </div>
                      <div style={{ width: "65px", textAlign: "center" }}>
                        <span style={{ fontSize: "0.68rem", color: "var(--accent-yellow)", display: "block" }}>MVPs</span>
                        <span style={{ fontSize: "0.9rem", fontWeight: "800", color: m.mvps > 0 ? "var(--accent-yellow)" : "var(--text-secondary)" }}>
                          {m.mvps > 0 ? `★ ${m.mvps}` : "—"}
                        </span>
                      </div>
                    </div>

                  </div>
                ))}
                
                {hubStats && hubStats.recentMatches && hubStats.recentMatches.length > visibleMatches && (
                  <div style={{ display: "flex", justifyContent: "center", marginTop: "0.5rem" }}>
                    <button 
                      onClick={() => setVisibleMatches(prev => prev + 10)}
                      style={{
                        background: "linear-gradient(135deg, var(--accent-purple), var(--accent-cyan))",
                        border: "none",
                        color: "#fff",
                        padding: "0.6rem 2rem",
                        borderRadius: "10px",
                        fontWeight: "700",
                        fontSize: "0.85rem",
                        cursor: "pointer",
                        boxShadow: "0 0 10px rgba(0, 242, 254, 0.2)",
                        transition: "all 0.2s"
                      }}
                    >
                      Показать еще
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-secondary)" }}>
                Загрузка истории матчей...
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
