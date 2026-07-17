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
                    style={{ color: "var(--accent-cyan)", fontSize: "0.9rem", textDecoration: "none", fontWeight: "600", display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
                  >
                    <img src="/icons/steam.png" alt="" style={{ width: "16px", height: "16px", objectFit: "contain" }} />
                    <span>Steam Profile ↗</span>
                  </a>
                )}
                <a 
                  href={`https://www.faceit.com/ru/players/${profile.nickname}`}
                  target="_blank" 
                  rel="noreferrer"
                  style={{ color: "var(--accent-purple)", fontSize: "0.9rem", textDecoration: "none", fontWeight: "600", display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
                >
                  <img src="/icons/faceit.png" alt="" style={{ width: "16px", height: "16px", objectFit: "contain" }} />
                  <span>FACEIT Profile ↗</span>
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
                  { id: "general", label: "Статистика Хаба" },
                  { id: "tactical", label: "Тактика & Leetify" },
                  { id: "maps", label: "Карты в Хабе" }
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
                <div className="glass-card" style={{ padding: "1.5rem", borderRadius: "16px", border: "1px solid var(--border-light)", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h3 style={{ fontSize: "1.1rem", fontWeight: "800", color: "#fff" }}>Результаты в Хабе</h3>
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
                </div>
              )}

              {/* Tactical Tab Content */}
              {activeTab === "tactical" && hubStats && (
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
                      Leetify: <strong>Этот игрок не зарегистрирован на Leetify. Ниже выводится детальная статистика по матчам хаба.</strong>
                    </div>
                  )}

                  {/* Hub Tactical Stats */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "0.75rem" }}>
                    {[
                      { title: "Бой и Атака в Хабе", items: [
                        { label: "Средний урон (ADR)", val: hubStats.adr ? `${hubStats.adr} HP` : "—" },
                        { label: "Убийств за раунд (KPR)", val: hubStats.matchesCount ? (hubStats.totalKills / hubStats.totalRounds).toFixed(2) : "—" }
                      ], color: "var(--accent-cyan)" },
                      { title: "Первые дуэли (Entry) в Хабе", items: [
                        { label: "Участие в дуэлях (Entry Rate)", val: hubStats.duels?.entryCount ? `${hubStats.duels.entryCount} раз` : "—" },
                        { label: "Выиграно первых дуэлей", val: hubStats.duels?.entrySuccessRate ? `${hubStats.duels.entrySuccessRate}%` : "—" }
                      ], color: "var(--warning)" },
                      { title: "Клатчи в Хабе", items: [
                        { label: "Побед в 1v1 клачах", val: hubStats.duels?.clutch1v1Rate ? `${hubStats.duels.clutch1v1Rate}%` : "—" },
                        { label: "Побед в 1v2 клачах", val: hubStats.duels?.clutch1v2Rate ? `${hubStats.duels.clutch1v2Rate}%` : "—" }
                      ], color: "#00d4ff" },
                      { title: "Использование гранат в Хабе", items: [
                        { label: "Урон гранатами / раунд", val: hubStats.utility?.utilityDamagePerRound ? `${hubStats.utility.utilityDamagePerRound} HP` : "—" },
                        { label: "Эффективность флешек", val: hubStats.utility?.flashSuccessRate ? `${hubStats.utility.flashSuccessRate}%` : "—" }
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
              {activeTab === "maps" && hubStats && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
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
                            padding: "1rem 1.25rem",
                            minHeight: "75px"
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
                                Матчей: <strong>{matches}</strong> • Win Rate: <strong style={{ color: winRate >= 50 ? "var(--success)" : "var(--danger)" }}>{winRate}%</strong>
                              </span>
                            </div>
                            <div style={{ display: "flex", gap: "1.25rem", textAlign: "right" }}>
                              <div>
                                <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", display: "block" }}>Avg K/D</span>
                                <span style={{ fontSize: "0.9rem", fontWeight: "800", color: "var(--accent-cyan)" }}>{kd.toFixed(2)}</span>
                              </div>
                              {adr && (
                                <div>
                                  <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", display: "block" }}>ADR</span>
                                  <span style={{ fontSize: "0.9rem", fontWeight: "800", color: "var(--accent-yellow)" }}>{adr.toFixed(1)}</span>
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
            {hubStats && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                
                {/* Est HLTV Rating Prominent Card */}
                <div className="glass-card" style={{ padding: "1.5rem", borderRadius: "16px", border: "1px solid var(--border-light)", display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "4px", background: "var(--accent-cyan)" }} />
                  <div>
                    <h4 style={{ fontSize: "0.9rem", fontWeight: "800", color: "var(--text-secondary)", textTransform: "uppercase" }}>Рейтинг HLTV 2.0 в Хабе</h4>
                    <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", display: "block", marginTop: "0.15rem" }}>Рассчитано по матчам внутри этого хаба</span>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span className="glow-text-cyan" style={{ fontSize: "2rem", fontWeight: "900", color: "var(--accent-cyan)" }}>{hubStats.hltvRating.toFixed(2)}</span>
                  </div>
                </div>

                {/* Multi-Kills Statistics */}
                <div className="glass-card" style={{ padding: "1.5rem", borderRadius: "16px", border: "1px solid var(--border-light)" }}>
                  <h3 style={{ fontSize: "1.1rem", fontWeight: "800", color: "#fff", marginBottom: "1rem" }}>Мульти-киллы в Хабе</h3>
                  
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    {[
                      { type: "Двойные убийства (2K)", count: hubStats.multiKills?.doubles || 0, color: "var(--text-muted)" },
                      { type: "Тройные убийства (3K)", count: hubStats.multiKills?.triples || 0, color: "var(--text-secondary)" },
                      { type: "Квадро-убийства (4K)", count: hubStats.multiKills?.quadros || 0, color: "var(--accent-yellow)" },
                      { type: "Эйсы / Aces (5K)", count: hubStats.multiKills?.pentas || 0, color: "var(--danger)" }
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
                  <h3 style={{ fontSize: "1.1rem", fontWeight: "800", color: "#fff", marginBottom: "1rem" }}>Дуэли и Клатчи в Хабе</h3>
                  
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    {[
                      { label: "Дуэлей первого контакта", val: hubStats.duels?.entryCount || "0", suffix: "дуэлей" },
                      { label: "Побед в первых дуэлях", val: hubStats.duels?.entryWins || "0", suffix: `(${hubStats.duels?.entrySuccessRate || 0}%)` },
                      { label: "Всего 1v1 дуэлей", val: hubStats.duels?.clutch1v1Count || "0", suffix: "клатчей" },
                      { label: "Побед 1v1", val: hubStats.duels?.clutch1v1Wins || "0", suffix: `(${hubStats.duels?.clutch1v1Rate || 0}%)` },
                      { label: "Всего 1v2 дуэлей", val: hubStats.duels?.clutch1v2Count || "0", suffix: "клатчей" },
                      { label: "Побед 1v2", val: hubStats.duels?.clutch1v2Wins || "0", suffix: `(${hubStats.duels?.clutch1v2Rate || 0}%)` },
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
                <div className="glass-card" style={{ padding: "1.5rem", borderRadius: "16px", border: "1px solid var(--border-light)" }}>
                  <h3 style={{ fontSize: "1.1rem", fontWeight: "800", color: "#fff", marginBottom: "1rem" }}>Использование гранат в Хабе</h3>
                  
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    {[
                      { label: "Брошено гранат", val: hubStats.utility?.utilityCount || "0" },
                      { label: "Эффективных гранат", val: hubStats.utility?.utilitySuccesses || "0", suffix: `(${hubStats.utility?.utilitySuccessRate || 0}%)` },
                      { label: "Урон гранатами (Сумма)", val: hubStats.utility?.utilityDamage ? `${hubStats.utility.utilityDamage} HP` : "0 HP" },
                      { label: "Брошено флешек", val: hubStats.utility?.flashCount || "0" },
                      { label: "Успешных флешек", val: hubStats.utility?.flashSuccesses || "0", suffix: `(${hubStats.utility?.flashSuccessRate || 0}%)` },
                      { label: "Ослеплено противников", val: hubStats.utility?.enemiesFlashed || "0", suffix: `(${hubStats.utility?.enemiesFlashedPerRound || 0} за раунд)` }
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
            <h3 style={{ fontSize: "1.2rem", fontWeight: "800", color: "#fff", marginBottom: "1.25rem" }}>Последние игры в Хабе</h3>
            
            {hubStats && hubStats.recentMatches && hubStats.recentMatches.length === 0 ? (
              <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-secondary)" }}>
                Игрок еще не сыграл ни одной игры в этом хабе.
              </div>
            ) : hubStats && hubStats.recentMatches ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {hubStats.recentMatches.map((m: any, i: number) => (
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
