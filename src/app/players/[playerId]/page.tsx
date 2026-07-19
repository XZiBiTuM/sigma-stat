"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

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
    de_overpass: "https://assets.faceit-cdn.net/third_party/games/ce652bd4-0abb-4c90-9936-1133965ca38b/assets/votables/058c4eb3-dac4-441c-a810-70afa0f3022c_1695819170133.jpeg",
    de_vertigo: "https://assets.faceit-cdn.net/third_party/games/ce652bd4-0abb-4c90-9936-1133965ca38b/assets/votables/84a2ca0d-9b57-4148-be85-a7b69c4cd662_1695819208035.jpeg"
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
  const [visibleMatches, setVisibleMatches] = useState(10);
  const [steamStats, setSteamStats] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [steamHover, setSteamHover] = useState(false);
  const [faceitHover, setFaceitHover] = useState(false);
  const [copyHover, setCopyHover] = useState(false);

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

    const { premierRating, ranks, vacBanned, gameBans } = steamStats;

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
              <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", display: "block" }}>Официальный рейтинг Valve</span>
            </div>
            <span style={{ fontSize: "1.25rem", fontWeight: "900", color: premierRating ? tierColor : "var(--text-secondary)", textShadow: premierRating ? `0 0 10px ${tierColor}30` : "none" }}>
              {premierRating ? `${premierRating.toLocaleString()} PTS` : "Без рейтинга"}
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

  const renderRatingChart = () => {
    if (!hubStats || !Array.isArray(hubStats.recentMatches) || hubStats.recentMatches.length === 0) return null;

    const chartData = [...hubStats.recentMatches].slice(0, 10).reverse();
    const width = 500;
    const height = 150;
    const paddingLeft = 35;
    const paddingRight = 15;
    const paddingTop = 25;
    const paddingBottom = 20;

    const ratings = chartData.map((m: any) => m.rating || 1.0);
    const minRating = Math.max(0.2, Math.min(...ratings) - 0.15);
    const maxRating = Math.min(3.0, Math.max(...ratings) + 0.15);
    const ratingRange = maxRating - minRating;

    const getX = (idx: number) => {
      if (chartData.length <= 1) return paddingLeft;
      return paddingLeft + (idx / (chartData.length - 1)) * (width - paddingLeft - paddingRight);
    };

    const getY = (val: number) => {
      return height - paddingBottom - ((val - minRating) / ratingRange) * (height - paddingTop - paddingBottom);
    };

    // Construct path coordinates
    const points = chartData.map((m: any, idx: number) => ({
      x: getX(idx),
      y: getY(m.rating || 1.0),
      rating: m.rating,
      won: m.won,
      mapName: m.map
    }));

    let linePath = "";
    let areaPath = "";
    if (points.length > 0) {
      linePath = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(" ");
      areaPath = `${linePath} L ${points[points.length - 1].x} ${height - paddingBottom} L ${points[0].x} ${height - paddingBottom} Z`;
    }

    return (
      <div className="glass-card" style={{ padding: "1.25rem", borderRadius: "16px", border: "1px solid var(--border-light)", display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "0rem" }}>
        <div>
          <span style={{ fontSize: "0.9rem", fontWeight: "800", color: "#fff", display: "block" }}>Динамика перформанса (HLTV Rating 2.0)</span>
          <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "block" }}>Последние {chartData.length} игр в хабе</span>
        </div>

        <div style={{ width: "100%", overflowX: "auto" }}>
          <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", overflow: "visible" }}>
            <defs>
              <linearGradient id="chartAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent-cyan)" stopOpacity="0.25" />
                <stop offset="100%" stopColor="var(--accent-cyan)" stopOpacity="0.0" />
              </linearGradient>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Horizontal Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1.0].map((t, idx) => {
              const yVal = minRating + t * ratingRange;
              const y = getY(yVal);
              return (
                <g key={idx}>
                  <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray="4,4" />
                  <text x={paddingLeft - 8} y={y + 3} fill="var(--text-muted)" fontSize="8" fontWeight="600" textAnchor="end">
                    {yVal.toFixed(2)}
                  </text>
                </g>
              );
            })}

            {/* Area Path */}
            {points.length > 0 && (
              <path d={areaPath} fill="url(#chartAreaGrad)" />
            )}

            {/* Line Path */}
            {points.length > 0 && (
              <path d={linePath} fill="none" stroke="var(--accent-cyan)" strokeWidth="2.5" filter="url(#glow)" strokeLinecap="round" strokeLinejoin="round" />
            )}

            {/* Dots */}
            {points.map((p, idx) => (
              <g key={idx}>
                <circle 
                  cx={p.x} 
                  cy={p.y} 
                  r="4.5" 
                  fill={p.won ? "var(--success)" : "var(--danger)"} 
                  stroke="#fff" 
                  strokeWidth="1.5" 
                  style={{ cursor: "pointer" }}
                />
                <circle 
                  cx={p.x} 
                  cy={p.y} 
                  r="9" 
                  fill="transparent" 
                  style={{ cursor: "pointer" }}
                >
                  <title>{`${p.mapName}\nРейтинг: ${p.rating.toFixed(2)}\nРезультат: ${p.won ? "Победа" : "Поражение"}`}</title>
                </circle>
                {/* Rating labels above dots */}
                <text x={p.x} y={p.y - 8} fill="#fff" fontSize="8" fontWeight="800" textAnchor="middle">
                  {p.rating.toFixed(2)}
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
          <span style={{ fontSize: "0.9rem", fontWeight: "800", color: "#fff", display: "block" }}>Сравнение со средним по Хабу</span>
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

    const loadData = async () => {
      setIsLoading(true);
      try {
        const profileRes = await fetch(`/api/faceit/players/${playerId}`);
        if (!profileRes.ok) throw new Error("Профиль не найден");
        const profileData = await profileRes.json();
        setProfile(profileData);

        const hubStatsRes = await fetch(`/api/faceit/players/${playerId}/hub-stats`);
        if (hubStatsRes.ok) {
          const statsData = await hubStatsRes.json();
          setHubStats(statsData);
        }

        try {
          const leetifyRes = await fetch(`/api/faceit/players/${playerId}/leetify`);
          if (leetifyRes.ok) {
            const leetifyData = await leetifyRes.json();
            if (leetifyData && !leetifyData.error) {
              setLeetify(leetifyData);
            }
          }
        } catch (e) {
          console.warn("Leetify stats load failed", e);
        }

        try {
          const steamStatsRes = await fetch(`/api/faceit/players/${playerId}/steam-stats`);
          if (steamStatsRes.ok) {
            const steamData = await steamStatsRes.json();
            if (steamData && !steamData.error) {
              setSteamStats(steamData);
            }
          }
        } catch (e) {
          console.warn("Steam stats load failed", e);
        }
      } catch (err) {
        console.error(err);
      } finally {
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
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          
          {/* Top Info Header */}
          <div className="glass-card" style={{ padding: "2rem", borderRadius: "16px", border: "1px solid var(--border-light)", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "2rem", position: "relative" }}>
            {/* Top decorative line */}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: "linear-gradient(90deg, var(--accent-purple), var(--accent-cyan))" }} />
            
            {/* Avatar */}
            <div style={{ width: "100px", height: "100px", borderRadius: "16px", overflow: "hidden", background: "#1c1829", border: "2px solid var(--border-light)", boxShadow: "0 4px 20px rgba(0,0,0,0.4)" }}>
              {profile.avatar ? (
                <img src={profile.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem", fontWeight: "800", color: "var(--text-muted)" }}>
                  {profile.nickname.substring(0, 2).toUpperCase()}
                </div>
              )}
            </div>

            {/* Name and Links */}
            <div>
              <h1 style={{ fontSize: "2.2rem", fontWeight: "900", color: "#fff", letterSpacing: "-0.03em" }}>{profile.nickname}</h1>
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

          {/* Detailed Statistics Container */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "2rem", alignItems: "stretch" }}>
            
            {/* Left Panel: Tabs & Metrics */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", height: "100%" }}>
              
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
                <div className="glass-card" style={{ padding: "1.5rem", borderRadius: "16px", border: "1px solid var(--border-light)", display: "flex", flexDirection: "column", gap: "1.25rem", height: "750px", overflow: "hidden", boxSizing: "border-box" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h3 style={{ fontSize: "1.1rem", fontWeight: "800", color: "#fff" }}>Статистика (хаб)</h3>
                    <span style={{ fontSize: "0.72rem", padding: "0.2rem 0.5rem", background: "rgba(0, 212, 255, 0.1)", border: "1px solid rgba(0, 212, 255, 0.2)", borderRadius: "6px", color: "var(--accent-cyan)", fontWeight: "700" }}>
                      Hub Scoped
                    </span>
                  </div>
                  
                  {/* Grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1rem" }}>
                    {[
                      { label: "Всего матчей", val: hubStats.matchesCount, color: "#fff" },
                      { label: "Процент побед", val: `${hubStats.winrate}%`, color: "var(--success)" },
                      { label: "Средний K/D", val: hubStats.kd.toFixed(2), color: "var(--accent-cyan)" },
                      { label: "Средний HS%", val: `${hubStats.hsPct}%`, color: "#fff" }
                    ].map((item, idx) => (
                      <div key={idx} style={{ background: "rgba(0,0,0,0.2)", border: "1px solid var(--border-light)", borderRadius: "10px", padding: "1rem" }}>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block" }}>{item.label}</span>
                        <span style={{ fontSize: "1.4rem", fontWeight: "800", color: item.color, display: "block", marginTop: "0.25rem" }}>{item.val}</span>
                      </div>
                    ))}
                  </div>

                  {/* Win Streaks */}
                  <div style={{ display: "flex", gap: "1rem", marginTop: "0.5rem" }}>
                    <div style={{ flex: 1, background: "rgba(0,0,0,0.2)", border: "1px solid var(--border-light)", borderRadius: "10px", padding: "1rem", textAlign: "center" }}>
                      <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)", display: "block" }}>Текущий стрик</span>
                      <span style={{ fontSize: "1.3rem", fontWeight: "800", color: "var(--success)", display: "block", marginTop: "0.25rem" }}>
                        +{hubStats.streaks?.current || 0} побед
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
                      <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.75rem" }}>Форма в Хабе</span>
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
                  <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "0.75rem", marginTop: "0.5rem" }}>
                    {[
                      { title: "Атака", items: [
                        { label: "Средний урон (ADR)", val: hubStats.adr ? `${hubStats.adr} HP` : "—" },
                        { label: "Убийств за раунд (KPR)", val: hubStats.totalRounds > 0 ? (hubStats.totalKills / hubStats.totalRounds).toFixed(2) : "—" }
                      ], color: "var(--accent-cyan)" }
                    ].map((section, idx) => (
                      <div key={idx} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-light)", borderRadius: "10px", padding: "1rem" }}>
                        <span style={{ fontSize: "0.82rem", fontWeight: "800", color: section.color, display: "block", marginBottom: "0.5rem" }}>{section.title}</span>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
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

                  {/* Hub Maps Summary Info to balance height */}
                  <div style={{
                    marginTop: "0.5rem",
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid var(--border-light)",
                    borderRadius: "10px",
                    padding: "1rem"
                  }}>
                    <span style={{ fontSize: "0.82rem", fontWeight: "800", color: "var(--accent-cyan)", display: "block", marginBottom: "0.5rem" }}>Карты в Хабе</span>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.78rem" }}>
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

                        // Best map
                        let bestMap = "—";
                        let maxWinrate = -1;
                        mapsList.forEach((m: any) => {
                          if (m.matches > 0 && m.winrate > maxWinrate) {
                            maxWinrate = m.winrate;
                            bestMap = m.map;
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
                              <span style={{ color: "var(--text-secondary)" }}>Лучшая игра в Хабе:</span>
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
                <div className="glass-card" style={{ padding: "1.5rem", borderRadius: "16px", border: "1px solid var(--border-light)", display: "flex", flexDirection: "column", gap: "1.25rem", height: "750px", overflow: "hidden", boxSizing: "border-box" }}>
                  
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
                          { label: "Разменяли меня после смерти", val: leetify.stats.traded_deaths_success_percentage !== undefined ? `${Math.round(leetify.stats.traded_deaths_success_percentage)}%` : "—" }
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
                <div className="glass-card" style={{ padding: "1.25rem", borderRadius: "16px", border: "1px solid var(--border-light)", display: "flex", flexDirection: "column", gap: "0.5rem", height: "750px", overflow: "hidden", boxSizing: "border-box" }}>
                  
                  {/* Maps Summary Box at the top */}
                  <div style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid var(--border-light)",
                    borderRadius: "12px",
                    padding: "0.85rem 1rem",
                    marginBottom: "0.5rem"
                  }}>
                    <span style={{ fontSize: "0.8rem", fontWeight: "800", color: "var(--accent-cyan)", display: "block", marginBottom: "0.4rem" }}>Суммарная инфо по картам хаба</span>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", fontSize: "0.75rem" }}>
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

                        // Best map
                        let bestMap = "—";
                        let maxWinrate = -1;
                        mapsList.forEach((m: any) => {
                          if (m.matches > 0 && m.winrate > maxWinrate) {
                            maxWinrate = m.winrate;
                            bestMap = m.map;
                          }
                        });

                        return (
                          <>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                              <span style={{ color: "var(--text-secondary)" }}>Всего игр на картах:</span>
                              <span style={{ fontWeight: "700", color: "#fff" }}>{totalMapGames}</span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                              <span style={{ color: "var(--text-secondary)" }}>Самая популярная:</span>
                              <span style={{ fontWeight: "700", color: "#fff" }}>
                                {mostPlayedMap.replace("de_", "").replace("cs_", "").toUpperCase()} {maxPlayed > 0 ? `(${maxPlayed} игр)` : ""}
                              </span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                              <span style={{ color: "var(--text-secondary)" }}>Лучшая игра в Хабе:</span>
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

                  {hubStats.maps?.map((seg: any, idx: number) => {
                      const mapName = seg.map;
                      const matches = seg.matches;
                      const winRate = seg.winrate;
                      const kd = seg.kd;
                      const adr = seg.adr;

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
                                <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", display: "block" }}>Avg K/D</span>
                                <span style={{ fontSize: "0.9rem", fontWeight: "800", color: "var(--accent-cyan)" }}>
                                  {matches > 0 ? kd.toFixed(2) : "—"}
                                </span>
                              </div>
                              <div>
                                <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", display: "block" }}>ADR</span>
                                <span style={{ fontSize: "0.9rem", fontWeight: "800", color: "var(--accent-yellow)" }}>
                                  {matches > 0 && adr ? adr.toFixed(1) : "—"}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}

              {/* HLTV Rating 2.0 SVG Trend Chart */}
              {renderRatingChart()}
              {/* Comparison with Pro-level benchmark */}
              {renderComparisonCard()}
            </div>

            {/* Right Panel: Advanced Tactical Breakdowns & Multi-Kills */}
            {hubStats && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", height: "100%" }}>
                
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
                      { label: "Суммарно фрагов в клатчах", val: hubStats.duels?.clutchKills || "0", suffix: "убийств" }
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

              </div>
            )}

          </div>

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
                      gap: "1.5rem"
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

                    {/* Left: Map & Outcome */}
                    <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: "1rem", minWidth: "180px" }}>
                      <div 
                        style={{
                          background: m.won ? "rgba(76, 175, 80, 0.15)" : "rgba(244, 67, 54, 0.15)",
                          border: m.won ? "1px solid rgba(76, 175, 80, 0.35)" : "1px solid rgba(244, 67, 54, 0.35)",
                          color: m.won ? "#4caf50" : "#f44336",
                          padding: "0.35rem 0.75rem",
                          borderRadius: "6px",
                          fontSize: "0.8rem",
                          fontWeight: "800",
                          textAlign: "center",
                          minWidth: "75px"
                        }}
                      >
                        {m.won ? "ПОБЕДА" : "ПОРАЖЕНИЕ"}
                      </div>
                      <div>
                        <span style={{ fontSize: "0.95rem", fontWeight: "800", color: "#fff", display: "block" }}>{m.map}</span>
                        <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>{m.finishedAt}</span>
                      </div>
                    </div>

                    {/* Middle: Score */}
                    <div style={{ position: "relative", zIndex: 1, textAlign: "center", minWidth: "80px" }}>
                      <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "block" }}>Счет</span>
                      <span style={{ fontSize: "1.1rem", fontWeight: "800", color: "#fff" }}>{m.score}</span>
                    </div>

                    {/* Right: Personal Stats Grid */}
                    <div style={{ position: "relative", zIndex: 1, display: "flex", flex: 1, justifyContent: "space-around", gap: "1rem", flexWrap: "wrap" }}>
                      <div>
                        <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", display: "block" }}>K / D / A</span>
                        <span style={{ fontSize: "0.9rem", fontWeight: "800", color: "#fff" }}>{m.kills} / {m.deaths} / {m.assists}</span>
                      </div>
                      <div>
                        <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", display: "block" }}>K/D Ratio</span>
                        <span style={{ fontSize: "0.9rem", fontWeight: "800", color: m.kd >= 1.2 ? "var(--success)" : m.kd < 0.95 ? "var(--danger)" : "var(--text-primary)" }}>{m.kd.toFixed(2)}</span>
                      </div>
                      <div>
                        <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", display: "block" }}>Rating 2.0</span>
                        <span style={{ fontSize: "0.9rem", fontWeight: "800", color: m.rating >= 1.2 ? "var(--success)" : m.rating < 0.95 ? "var(--danger)" : "var(--accent-cyan)" }}>
                          {m.rating ? m.rating.toFixed(2) : "—"}
                        </span>
                      </div>
                      <div>
                        <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", display: "block" }}>Headshots</span>
                        <span style={{ fontSize: "0.9rem", fontWeight: "800", color: "#fff" }}>{m.hsPct}%</span>
                      </div>
                      <div>
                        <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", display: "block" }}>MVPs</span>
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
