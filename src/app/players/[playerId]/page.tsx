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

const formatPercent = (val: any) => {
  if (val === undefined || val === null) return "—";
  const num = parseFloat(val);
  if (isNaN(num)) return val;
  if (num > 0 && num < 1) {
    return Math.round(num * 100) + "%";
  }
  return Math.round(num) + "%";
};

export default function PlayerProfilePage() {
  const params = useParams();
  const playerId = params.playerId as string;

  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [leetify, setLeetify] = useState<any>(null);
  
  const [recentMatches, setRecentMatches] = useState<any[]>([]);
  const [isLoadingMatches, setIsLoadingMatches] = useState(true);
  const [activeTab, setActiveTab] = useState<"general" | "tactical" | "maps">("general");

  useEffect(() => {
    if (!playerId) return;

    const loadData = async () => {
      setIsLoading(true);
      try {
        const profileRes = await fetch(`/api/faceit/players/${playerId}`);
        if (!profileRes.ok) throw new Error("Профиль не найден");
        const profileData = await profileRes.json();
        setProfile(profileData);

        const statsRes = await fetch(`/api/faceit/players/${playerId}/stats/cs2`);
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats(statsData);
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
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    const loadMatches = async () => {
      setIsLoadingMatches(true);
      try {
        const matchesRes = await fetch(`/api/faceit/players/${playerId}/recent-stats`);
        if (matchesRes.ok) {
          const matchesData = await matchesRes.json();
          setRecentMatches(matchesData.matches || []);
        }
      } catch (err) {
        console.error("Failed to load recent matches", err);
      } finally {
        setIsLoadingMatches(false);
      }
    };

    loadData();
    loadMatches();
  }, [playerId]);

  if (isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", backgroundColor: "var(--bg-primary)" }}>
        <div style={{ textAlign: "center" }}>
          <div className="glow-text-cyan" style={{ fontSize: "1.5rem", fontWeight: "700" }}>Загрузка игровой аналитики...</div>
          <div style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginTop: "0.5rem" }}>Собираем данные с FACEIT и Leetify</div>
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

  // Aggregate multi-kills from segments
  let totalTriples = 0;
  let totalQuadros = 0;
  let totalPentas = 0;
  if (stats && Array.isArray(stats.segments)) {
    stats.segments.forEach((seg: any) => {
      if (seg.type === "Map" && seg.stats) {
        totalTriples += parseInt(seg.stats["Triple Kills"] || "0");
        totalQuadros += parseInt(seg.stats["Quadro Kills"] || "0");
        totalPentas += parseInt(seg.stats["Penta Kills"] || "0");
      }
    });
  }

  // Calculate estimated career HLTV rating
  const kdRatio = stats ? parseFloat(stats.lifetime["Average K/D Ratio"] || "1.0") : 1.0;
  const winRate = stats ? parseFloat(stats.lifetime["Win Rate %"] || "50") / 100 : 0.5;
  const careerHLTV = (kdRatio * 0.72) + (winRate * 0.45) + 0.15;

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
                    🌍 Страна: <strong style={{ color: "#fff" }}>{profile.country.toUpperCase()}</strong>
                  </span>
                )}
                {(profile.steam_id_64 || profile.platforms?.steam) && (
                  <a 
                    href={`https://steamcommunity.com/profiles/${profile.steam_id_64 || profile.platforms?.steam}`}
                    target="_blank" 
                    rel="noreferrer"
                    style={{ color: "var(--accent-cyan)", fontSize: "0.9rem", textDecoration: "none", fontWeight: "600" }}
                  >
                    🎮 Steam Profile ↗
                  </a>
                )}
                <a 
                  href={`https://www.faceit.com/ru/players/${profile.nickname}`}
                  target="_blank" 
                  rel="noreferrer"
                  style={{ color: "var(--accent-purple)", fontSize: "0.9rem", textDecoration: "none", fontWeight: "600" }}
                >
                  🏆 FACEIT Profile ↗
                </a>
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
                  <div style={getLevelBadgeStyle(cs2Info.skill_level)}>
                    {cs2Info.skill_level}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Detailed Statistics Container */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "2rem", alignItems: "start" }}>
            
            {/* Left Panel: Tabs & Metrics */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              
              {/* Tabs Navigation Card */}
              <div className="glass-card" style={{ padding: "0.5rem", borderRadius: "12px", border: "1px solid var(--border-light)", display: "flex", gap: "0.25rem" }}>
                {[
                  { id: "general", label: "Общая статистика" },
                  { id: "tactical", label: "Тактика & Leetify" },
                  { id: "maps", label: "Статистика карт" }
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
              {activeTab === "general" && stats && (
                <div className="glass-card" style={{ padding: "1.5rem", borderRadius: "16px", border: "1px solid var(--border-light)", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                  <h3 style={{ fontSize: "1.1rem", fontWeight: "800", color: "#fff", marginBottom: "0.25rem" }}>Lifetime показатели</h3>
                  
                  {/* Grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1rem" }}>
                    {[
                      { label: "Всего матчей", val: stats.lifetime.Matches, color: "#fff" },
                      { label: "Процент побед", val: `${stats.lifetime["Win Rate %"]}%`, color: "var(--success)" },
                      { label: "Средний K/D", val: parseFloat(stats.lifetime["Average K/D Ratio"]).toFixed(2), color: "var(--accent-cyan)" },
                      { label: "Средний HS%", val: `${stats.lifetime["Average Headshots %"]}%`, color: "#fff" }
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
                        +{stats.lifetime["Current Win Streak"] || 0} побед
                      </span>
                    </div>
                    <div style={{ flex: 1, background: "rgba(0,0,0,0.2)", border: "1px solid var(--border-light)", borderRadius: "10px", padding: "1rem", textAlign: "center" }}>
                      <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)", display: "block" }}>Лучший стрик</span>
                      <span style={{ fontSize: "1.3rem", fontWeight: "800", color: "#fff", display: "block", marginTop: "0.25rem" }}>
                        {stats.lifetime["Longest Win Streak"] || 0} побед
                      </span>
                    </div>
                  </div>

                  {/* Form */}
                  {Array.isArray(stats.lifetime["Recent Results"]) && (
                    <div style={{ background: "rgba(0,0,0,0.15)", borderRadius: "10px", padding: "1rem", border: "1px dashed var(--border-light)" }}>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.75rem" }}>Форма последних матчей</span>
                      <div style={{ display: "flex", gap: "0.75rem" }}>
                        {stats.lifetime["Recent Results"].map((res: string, i: number) => {
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
                              {isWin ? "WIN" : "LOSS"}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tactical Tab Content */}
              {activeTab === "tactical" && stats && (
                <div className="glass-card" style={{ padding: "1.5rem", borderRadius: "16px", border: "1px solid var(--border-light)", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                  
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
                          <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "block" }}>Сравнительный тактический показатель</span>
                        </div>
                        {(() => {
                          const val = parseFloat(leetify.stats.leetify_rating);
                          const isPos = val >= 0;
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
                          { label: "Preaim Accuracy", val: `${Math.round(leetify.stats.preaim * 100)}%` },
                          { label: "Reaction Time", val: `${Math.round(leetify.stats.reaction_time)} ms` },
                          { label: "Aim Accuracy", val: `${Math.round(leetify.stats.accuracy * 100)}%` },
                          { label: "Counter-Strafing", val: `${Math.round(leetify.stats.counter_strafing_shots_good_ratio * 100)}%` },
                          { label: "Spray Accuracy", val: `${Math.round(leetify.stats.spray_accuracy * 100)}%` },
                          { label: "Leetify T / CT", val: `${parseFloat(leetify.stats.t_leetify_rating).toFixed(1)} / ${parseFloat(leetify.stats.ct_leetify_rating).toFixed(1)}` }
                        ].map((item, idx) => (
                          <div key={idx} style={{ background: "rgba(0,0,0,0.25)", borderRadius: "8px", padding: "0.6rem 0.85rem", border: "1px solid var(--border-light)" }}>
                            <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", display: "block" }}>{item.label}</span>
                            <span style={{ fontSize: "1rem", fontWeight: "800", color: "#fff", display: "block", marginTop: "0.15rem" }}>{item.val}</span>
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
                      💡 <strong>Данные Leetify недоступны:</strong> этот игрок не зарегистрирован на Leetify. Ниже выводится альтернативная тактическая статистика FACEIT.
                    </div>
                  )}

                  {/* FACEIT Tactical Stats */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "0.75rem" }}>
                    {[
                      { title: "⚔ Бой и Атака", items: [
                        { label: "Средний урон (ADR)", val: stats.lifetime["ADR"] || "—" },
                        { label: "Убийств за раунд (KPR)", val: stats.lifetime["Average Kills"] ? (parseFloat(stats.lifetime["Average Kills"]) / 20).toFixed(2) : "—" }
                      ], color: "var(--accent-cyan)" },
                      { title: "⚡ Первые дуэли (Entry)", items: [
                        { label: "Участие в дуэлях (Entry Rate)", val: stats.lifetime["Entry Rate"] ? `${Math.round(parseFloat(stats.lifetime["Entry Rate"]) * 100)}%` : "—" },
                        { label: "Выиграно дуэлей (Entry Success)", val: stats.lifetime["Entry Success Rate"] ? `${Math.round(parseFloat(stats.lifetime["Entry Success Rate"]) * 100)}%` : "—" }
                      ], color: "var(--warning)" },
                      { title: "🏆 Клачи", items: [
                        { label: "Побед в 1v1 клачах", val: stats.lifetime["1v1 Win Rate"] ? `${Math.round(parseFloat(stats.lifetime["1v1 Win Rate"]) * 100)}%` : "—" },
                        { label: "Побед в 1v2 клачах", val: stats.lifetime["1v2 Win Rate"] ? `${Math.round(parseFloat(stats.lifetime["1v2 Win Rate"]) * 100)}%` : "—" }
                      ], color: "#00d4ff" },
                      { title: "💣 Использование гранат", items: [
                        { label: "Урон гранатами / раунд", val: stats.lifetime["Utility Damage per Round"] ? `${stats.lifetime["Utility Damage per Round"]} HP` : "—" },
                        { label: "Эффективность флешек", val: stats.lifetime["Flash Success Rate"] ? `${Math.round(parseFloat(stats.lifetime["Flash Success Rate"]) * 100)}%` : "—" }
                      ], color: "var(--accent-purple)" }
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

                </div>
              )}

              {/* Maps Stats View in Left column fallback if tab chosen */}
              {activeTab === "maps" && stats && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {stats.segments
                    ?.filter((seg: any) => seg.type === "Map")
                    .map((seg: any, idx: number) => {
                      const mapName = seg.label;
                      const matches = parseInt(seg.stats.Matches || "0");
                      const winRate = parseInt(seg.stats["Win Rate %"] || "0");
                      const kd = parseFloat(seg.stats["Average K/D Ratio"] || "0").toFixed(2);
                      const avgKills = parseFloat(seg.stats["Average Kills"] || "0").toFixed(1);
                      const adr = seg.stats.ADR ? parseFloat(seg.stats.ADR).toFixed(1) : null;
                      const bgImage = seg.img_small || seg.img_regular;

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
                            padding: "1rem 1.25rem",
                            minHeight: "75px"
                          }}
                        >
                          {/* Background Map Image Overlay */}
                          {bgImage && (
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
                          )}

                          <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                            <div>
                              <span style={{ fontSize: "0.95rem", fontWeight: "800", color: "#fff", display: "block" }}>{mapName}</span>
                              <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                                Матчей: <strong>{matches}</strong> • Win Rate: <strong style={{ color: winRate >= 50 ? "var(--success)" : "var(--danger)" }}>{winRate}%</strong>
                              </span>
                            </div>
                            <div style={{ display: "flex", gap: "1.25rem", textAlign: "right" }}>
                              <div>
                                <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", display: "block" }}>Avg K/D</span>
                                <span style={{ fontSize: "0.9rem", fontWeight: "800", color: "var(--accent-cyan)" }}>{kd}</span>
                              </div>
                              <div>
                                <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", display: "block" }}>Avg Kills</span>
                                <span style={{ fontSize: "0.9rem", fontWeight: "800", color: "#fff" }}>{avgKills}</span>
                              </div>
                              {adr && (
                                <div>
                                  <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", display: "block" }}>ADR</span>
                                  <span style={{ fontSize: "0.9rem", fontWeight: "800", color: "var(--accent-yellow)" }}>{adr}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}

            </div>

            {/* Right Panel: Advanced Tactical Breakdowns & Multi-Kills */}
            {stats && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                
                {/* Est HLTV Rating Prominent Card */}
                <div className="glass-card" style={{ padding: "1.5rem", borderRadius: "16px", border: "1px solid var(--border-light)", display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "4px", background: "var(--accent-cyan)" }} />
                  <div>
                    <h4 style={{ fontSize: "0.9rem", fontWeight: "800", color: "var(--text-secondary)", textTransform: "uppercase" }}>Карьерный HLTV-рейтинг</h4>
                    <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", display: "block", marginTop: "0.15rem" }}>Рассчитано по формуле K/D и Win Rate</span>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span className="glow-text-cyan" style={{ fontSize: "2rem", fontWeight: "900", color: "var(--accent-cyan)" }}>{careerHLTV.toFixed(2)}</span>
                  </div>
                </div>

                {/* Multi-Kills Statistics */}
                <div className="glass-card" style={{ padding: "1.5rem", borderRadius: "16px", border: "1px solid var(--border-light)" }}>
                  <h3 style={{ fontSize: "1.1rem", fontWeight: "800", color: "#fff", marginBottom: "1rem" }}>Мульти-киллы (За карьеру)</h3>
                  
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    {[
                      { type: "Тройные убийства (3K)", count: totalTriples, color: "var(--text-secondary)" },
                      { type: "Квадро-убийства (4K)", count: totalQuadros, color: "var(--accent-yellow)" },
                      { type: "Эйсы / Aces (5K)", count: totalPentas, color: "var(--danger)" }
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
                  <h3 style={{ fontSize: "1.1rem", fontWeight: "800", color: "#fff", marginBottom: "1rem" }}>Показатели дуэлей и клатчей</h3>
                  
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    {[
                      { label: "Дуэлей первого контакта", val: stats.lifetime["Total Entry Count"] || "—", suffix: "дуэлей" },
                      { label: "Побед в первых дуэлях", val: stats.lifetime["Total Entry Wins"] || "—", suffix: `(${formatPercent(stats.lifetime["Entry Success Rate"])})` },
                      { label: "Всего 1v1 дуэлей", val: stats.lifetime["Total 1v1 Count"] || "—", suffix: "клатчей" },
                      { label: "Побед 1v1", val: stats.lifetime["Total 1v1 Wins"] || "—", suffix: `(${formatPercent(stats.lifetime["1v1 Win Rate"])})` },
                      { label: "Всего 1v2 дуэлей", val: stats.lifetime["Total 1v2 Count"] || "—", suffix: "клатчей" },
                      { label: "Побед 1v2", val: stats.lifetime["Total 1v2 Wins"] || "—", suffix: `(${formatPercent(stats.lifetime["1v2 Win Rate"])})` }
                    ].map((item, idx) => (
                      <div key={idx} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.03)", paddingBottom: "0.4rem", fontSize: "0.8rem" }}>
                        <span style={{ color: "var(--text-secondary)" }}>{item.label}</span>
                        <span style={{ fontWeight: "700", color: "#fff" }}>{item.val} <span style={{ color: "var(--text-muted)", fontSize: "0.72rem", fontWeight: "normal" }}>{item.suffix}</span></span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Granades detailed performance */}
                <div className="glass-card" style={{ padding: "1.5rem", borderRadius: "16px", border: "1px solid var(--border-light)" }}>
                  <h3 style={{ fontSize: "1.1rem", fontWeight: "800", color: "#fff", marginBottom: "1rem" }}>Гранатная статистика (Подробно)</h3>
                  
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    {[
                      { label: "Брошено гранат за карьеру", val: stats.lifetime["Total Utility Count"] || "—" },
                      { label: "Эффективных гранат", val: stats.lifetime["Total Utility Successes"] || "—", suffix: `(${formatPercent(stats.lifetime["Utility Success Rate"])})` },
                      { label: "Суммарный урон гранатами", val: stats.lifetime["Total Utility Damage"] ? `${stats.lifetime["Total Utility Damage"]} HP` : "—" },
                      { label: "Брошено флешек за карьеру", val: stats.lifetime["Total Flash Count"] || "—" },
                      { label: "Успешных ослеплений", val: stats.lifetime["Total Flash Successes"] || "—", suffix: `(${formatPercent(stats.lifetime["Flash Success Rate"])})` },
                      { label: "Ослеплено врагов", val: stats.lifetime["Total Enemies Flashed"] || "—", suffix: `(${stats.lifetime["Enemies Flashed per Round"]} за раунд)` }
                    ].map((item, idx) => (
                      <div key={idx} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.03)", paddingBottom: "0.4rem", fontSize: "0.8rem" }}>
                        <span style={{ color: "var(--text-secondary)" }}>{item.label}</span>
                        <span style={{ fontWeight: "700", color: "#fff" }}>{item.val} <span style={{ color: "var(--text-muted)", fontSize: "0.72rem", fontWeight: "normal" }}>{item.suffix}</span></span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}

          </div>

          {/* Bottom Section: Recent Matches History */}
          <div className="glass-card" style={{ padding: "2rem", borderRadius: "16px", border: "1px solid var(--border-light)" }}>
            <h3 style={{ fontSize: "1.2rem", fontWeight: "800", color: "#fff", marginBottom: "1.25rem" }}>История последних матчей на FACEIT</h3>
            
            {isLoadingMatches ? (
              <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-secondary)" }}>
                Загрузка истории матчей...
              </div>
            ) : recentMatches.length === 0 ? (
              <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-secondary)" }}>
                Не удалось найти последние матчи или статистика недоступна.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {recentMatches.map((m: any, i: number) => (
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
                          minWidth: "65px"
                        }}
                      >
                        {m.won ? "POBEDA" : "PORAZH"}
                      </div>
                      <div>
                        <span style={{ fontSize: "0.95rem", fontWeight: "800", color: "#fff", display: "block" }}>{m.map}</span>
                        <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>{m.finishedAt}</span>
                      </div>
                    </div>

                    {/* Middle: Score */}
                    <div style={{ position: "relative", zIndex: 1, textAlign: "center", minWidth: "80px" }}>
                      <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "block" }}>Счет матча</span>
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
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
