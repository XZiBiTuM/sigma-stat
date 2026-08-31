"use client";

import React from "react";

export interface PlayerAttributes {
  shooting: number;
  calls: number;
  mental: number;
  gamesense: number;
  aura: number;
  isShootingAuto?: boolean;
}

export interface PlayerRadarChartProps {
  attributes: PlayerAttributes;
  playerName?: string;
  size?: number;
  onEditClick?: () => void;
  themeColor?: "cyan" | "purple" | "gold" | "green";
  hideHeader?: boolean;
  hideDisclaimer?: boolean;
}

export function computeAutoShooting(stats: {
  kd?: number;
  hsPct?: number;
  adr?: number;
  skillScore?: number;
  leetifyAim?: number;
}): number {
  if (typeof stats.leetifyAim === "number" && stats.leetifyAim > 0) {
    return Math.round(Math.min(99, Math.max(20, stats.leetifyAim)));
  }
  if (typeof stats.skillScore === "number" && stats.skillScore > 0) {
    let score = stats.skillScore;
    if (stats.hsPct && stats.hsPct > 50) score += (stats.hsPct - 50) * 0.2;
    if (stats.kd && stats.kd > 1.2) score += (stats.kd - 1.2) * 6;
    return Math.round(Math.min(99, Math.max(25, score)));
  }
  if (stats.kd || stats.adr) {
    const kd = stats.kd || 1.0;
    const hs = stats.hsPct || 40;
    const adr = stats.adr || 75;
    const raw = (kd * 28) + (hs * 0.38) + (adr * 0.32);
    return Math.round(Math.min(99, Math.max(20, raw)));
  }
  return 50;
}

const AXIS_CONFIG = [
  {
    key: "shooting",
    label: "Стрельба",
    subLabel: "Aim и механика",
    color: "#00e5ff",
    isAuto: true
  },
  {
    key: "gamesense",
    label: "Геймсенс",
    subLabel: "Позиционка и тайминги",
    color: "#a855f7",
    isAuto: false
  },
  {
    key: "aura",
    label: "Аура",
    subLabel: "Авторитет и влияние",
    color: "#ffd700",
    isAuto: false
  },
  {
    key: "mental",
    label: "Менталка",
    subLabel: "Тильтоустойчивость",
    color: "#00e676",
    isAuto: false
  },
  {
    key: "calls",
    label: "Коллы",
    subLabel: "Коммуникация и инфа",
    color: "#ff9100",
    isAuto: false
  }
] as const;

export default function PlayerRadarChart({ 
  attributes, 
  playerName, 
  size = 380, 
  onEditClick,
  themeColor = "cyan",
  hideHeader = false,
  hideDisclaimer = false
}: PlayerRadarChartProps) {
  const center = size / 2;
  const radius = (size / 2) - 58;
  const numAxes = 5;
  const angleStep = (Math.PI * 2) / numAxes;
  const startAngle = -Math.PI / 2;

  const levels = [0.2, 0.4, 0.6, 0.8, 1.0];

  const getCoordinates = (index: number, valueRatio: number, r: number = radius) => {
    const angle = startAngle + index * angleStep;
    const x = center + r * valueRatio * Math.cos(angle);
    const y = center + r * valueRatio * Math.sin(angle);
    return { x, y, angle };
  };

  const getLevelPolygon = (lvl: number) => {
    return Array.from({ length: numAxes }).map((_, i) => {
      const { x, y } = getCoordinates(i, lvl);
      return `${x},${y}`;
    }).join(" ");
  };

  const values = [
    Math.min(100, Math.max(10, attributes.shooting || 50)),
    Math.min(100, Math.max(10, attributes.gamesense || 50)),
    Math.min(100, Math.max(10, attributes.aura || 50)),
    Math.min(100, Math.max(10, attributes.mental || 50)),
    Math.min(100, Math.max(10, attributes.calls || 50))
  ];

  const dataPoints = values.map((val, i) => getCoordinates(i, val / 100));
  const dataPolygonString = dataPoints.map(p => `${p.x},${p.y}`).join(" ");

  const avgRating = Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);

  const isPurpleTheme = themeColor === "purple";
  const primaryColor = isPurpleTheme ? "#c084fc" : "#00e5ff";
  const gradientStart = isPurpleTheme ? "rgba(192, 132, 252, 0.5)" : "rgba(0, 229, 255, 0.45)";
  const gradientEnd = isPurpleTheme ? "rgba(124, 77, 255, 0.15)" : "rgba(124, 77, 255, 0.12)";
  const borderColor = isPurpleTheme ? "rgba(168, 85, 247, 0.3)" : "rgba(0, 229, 255, 0.25)";
  const shadowColor = isPurpleTheme ? "rgba(168, 85, 247, 0.15)" : "rgba(0, 229, 255, 0.1)";
  const filterId = `radarGlow_${themeColor}_${playerName ? playerName.replace(/[^a-zA-Z0-9]/g, "") : "def"}`;
  const gradientId = `radarGradient_${themeColor}_${playerName ? playerName.replace(/[^a-zA-Z0-9]/g, "") : "def"}`;

  return (
    <div className="glass-card animate-fade-in" style={{
      padding: "1.5rem",
      borderRadius: "20px",
      border: `1px solid ${borderColor}`,
      background: "linear-gradient(135deg, rgba(12, 10, 23, 0.95) 0%, rgba(20, 15, 35, 0.9) 100%)",
      boxShadow: `0 0 30px ${shadowColor}`,
      position: "relative",
      overflow: "hidden",
      width: "100%",
      boxSizing: "border-box"
    }}>
      {!hideHeader && (
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          paddingBottom: "1rem",
          marginBottom: "1rem",
          flexWrap: "wrap",
          gap: "0.75rem"
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <h3 style={{ fontSize: "1.15rem", fontWeight: "900", color: "#fff", margin: 0 }}>
                {playerName || "Характеристики игрока"}
              </h3>
              <span style={{
                fontSize: "0.68rem",
                fontWeight: "800",
                color: primaryColor,
                background: isPurpleTheme ? "rgba(168, 85, 247, 0.12)" : "rgba(0, 229, 255, 0.12)",
                border: `1px solid ${borderColor}`,
                padding: "0.15rem 0.5rem",
                borderRadius: "6px"
              }}>
                5D RADAR
              </span>
            </div>
            <span style={{ fontSize: "0.76rem", color: "var(--text-secondary)", marginTop: "0.2rem", display: "block" }}>
              {playerName ? `Индивидуальный профиль: ${playerName}` : "Профиль ключевых навыков и качеств"}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            {onEditClick && (
              <button
                type="button"
                onClick={onEditClick}
                style={{
                  background: isPurpleTheme ? "rgba(168, 85, 247, 0.12)" : "rgba(0, 229, 255, 0.12)",
                  border: `1px solid ${primaryColor}`,
                  color: primaryColor,
                  borderRadius: "8px",
                  padding: "0.4rem 0.8rem",
                  fontSize: "0.75rem",
                  fontWeight: "800",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  transition: "all 0.2s ease"
                }}
              >
                Редактировать
              </button>
            )}

            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              background: "rgba(0, 0, 0, 0.4)",
              padding: "0.4rem 0.8rem",
              borderRadius: "10px",
              border: "1px solid rgba(255, 255, 255, 0.08)"
            }}>
              <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "700" }}>
                Общий балл:
              </span>
              <span style={{
                fontSize: "1.2rem",
                fontWeight: "900",
                color: isPurpleTheme ? "#c084fc" : avgRating >= 80 ? "#c084fc" : avgRating >= 65 ? "var(--accent-cyan)" : "#ffd54f"
              }}>
                {avgRating}
              </span>
            </div>
          </div>
        </div>
      )}

      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: "1.25rem"
      }}>
        <div style={{ position: "relative", width: "100%", maxWidth: `${size}px`, margin: "0 auto" }}>
          <svg
            viewBox={`0 0 ${size} ${size}`}
            style={{ width: "100%", height: "auto", display: "block", overflow: "visible" }}
          >
            <defs>
              <radialGradient id={gradientId} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={gradientStart} />
                <stop offset="60%" stopColor="rgba(168, 85, 247, 0.35)" />
                <stop offset="100%" stopColor={gradientEnd} />
              </radialGradient>

              <filter id={filterId} x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="3.5" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {levels.map((lvl, idx) => (
              <polygon
                key={idx}
                points={getLevelPolygon(lvl)}
                fill={idx === levels.length - 1 ? "rgba(255, 255, 255, 0.015)" : "none"}
                stroke="rgba(255, 255, 255, 0.1)"
                strokeWidth={idx === levels.length - 1 ? "1.5" : "1"}
                strokeDasharray={idx === levels.length - 1 ? "none" : "3 3"}
              />
            ))}

            {Array.from({ length: numAxes }).map((_, i) => {
              const { x, y } = getCoordinates(i, 1.0);
              return (
                <line
                  key={i}
                  x1={center}
                  y1={center}
                  x2={x}
                  y2={y}
                  stroke="rgba(255, 255, 255, 0.12)"
                  strokeWidth="1.2"
                />
              );
            })}

            {levels.map((lvl, idx) => {
              const { y } = getCoordinates(0, lvl);
              return (
                <text
                  key={idx}
                  x={center + 6}
                  y={y + 3}
                  fill="rgba(255, 255, 255, 0.25)"
                  fontSize="8.5"
                  fontFamily="sans-serif"
                  fontWeight="600"
                >
                  {Math.round(lvl * 100)}
                </text>
              );
            })}

            <polygon
              points={dataPolygonString}
              fill={`url(#${gradientId})`}
              stroke={primaryColor}
              strokeWidth="2.5"
              filter={`url(#${filterId})`}
              style={{ transition: "all 0.35s ease-out" }}
            />

            {dataPoints.map((pt, i) => {
              const cfg = AXIS_CONFIG[i];
              return (
                <g key={i}>
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r="4.5"
                    fill={cfg.color}
                    stroke="#0c0a17"
                    strokeWidth="2"
                    style={{ filter: `drop-shadow(0 0 6px ${cfg.color})`, transition: "all 0.35s ease-out" }}
                  />
                </g>
              );
            })}

            {AXIS_CONFIG.map((cfg, i) => {
              const { x, y, angle } = getCoordinates(i, 1.22);
              const val = values[i];
              
              let textAnchor = "middle";
              let dx = 0;
              let dy = 4;

              if (Math.abs(Math.cos(angle)) > 0.3) {
                if (Math.cos(angle) > 0) {
                  textAnchor = "start";
                  dx = 4;
                } else {
                  textAnchor = "end";
                  dx = -4;
                }
              } else {
                if (Math.sin(angle) < 0) {
                  dy = -10;
                } else {
                  dy = 16;
                }
              }

              return (
                <g key={i} transform={`translate(${x + dx}, ${y + dy})`}>
                  <text
                    textAnchor={textAnchor as any}
                    fill="#fff"
                    fontSize="11"
                    fontWeight="800"
                    fontFamily="sans-serif"
                  >
                    {cfg.label}
                  </text>
                  <text
                    textAnchor={textAnchor as any}
                    y="13"
                    fill={cfg.color}
                    fontSize="11.5"
                    fontWeight="900"
                    fontFamily="monospace"
                  >
                    {val}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="radar-traits-row">
          {AXIS_CONFIG.map((cfg, idx) => {
            const val = values[idx];
            return (
              <div 
                key={idx} 
                className={`radar-trait-card-${idx}`}
                style={{
                  background: "rgba(0, 0, 0, 0.35)",
                  border: `1px solid ${cfg.color}35`,
                  borderRadius: "10px",
                  padding: "0.6rem 0.75rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.2rem",
                  position: "relative",
                  overflow: "hidden",
                  minWidth: 0,
                  boxSizing: "border-box"
                }}
              >
                <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: "3.5px", background: cfg.color }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.35rem" }}>
                  <span style={{ fontSize: "0.8rem", fontWeight: "800", color: "#fff", whiteSpace: "nowrap" }}>
                    {cfg.label}
                  </span>
                  <span style={{ fontSize: "1.05rem", fontWeight: "900", color: cfg.color, flexShrink: 0 }}>
                    {val}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: "0.1rem" }}>
                  <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                    {cfg.subLabel}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {!hideDisclaimer && (
          <div style={{
            width: "100%",
            boxSizing: "border-box",
            background: "rgba(255, 215, 0, 0.06)",
            border: "1px solid rgba(255, 215, 0, 0.3)",
            borderRadius: "12px",
            padding: "0.75rem 1rem",
            display: "flex",
            alignItems: "flex-start",
            gap: "0.65rem"
          }}>
            <div style={{
              fontSize: "0.75rem",
              color: "var(--text-secondary)",
              lineHeight: "1.45"
            }}>
              <strong style={{ color: "#ffd54f", display: "block", marginBottom: "0.15rem", fontSize: "0.8rem" }}>
                Субъективная оценка администратора хаба
              </strong>
              Параметры <strong>Коллы</strong>, <strong>Менталка</strong>, <strong>Геймсенс</strong> и <strong>Аура</strong> выставляются администратором хаба лично на основе наблюдений за играми. Параметр <strong>Стрельба</strong> рассчитывается автоматически по боевой статистике и точности.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
