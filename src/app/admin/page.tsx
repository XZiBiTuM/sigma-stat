"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface AnalyticsData {
  totalViews: number;
  totalUniques: number;
  todayViews: number;
  todayUniques: number;
  topPages: Record<string, number>;
  dailyHistory: Array<{ date: string; views: number; uniques: number }>;
}

export default function AdminLoginPage() {
  const router = useRouter();
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [currentRole, setCurrentRole] = useState<string | null>(null);

  // Tournament settings state
  const [tourTitle, setTourTitle] = useState("Sigma Cup: Season 3");
  const [tourDate, setTourDate] = useState("");
  const [tourStatus, setTourStatus] = useState<"DRAFT_OPEN" | "LIVE" | "COMPLETED">("DRAFT_OPEN");
  const [tourWinner, setTourWinner] = useState("");
  const [isSavingTour, setIsSavingTour] = useState(false);
  const [tourSaveMsg, setTourSaveMsg] = useState("");

  // Analytics state
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);

  // Fantasy Picks Management state
  const [fantasyPicksList, setFantasyPicksList] = useState<any[]>([]);
  const [isLoadingPicks, setIsLoadingPicks] = useState(false);
  const [picksMsg, setPicksMsg] = useState("");

  const fetchAnalytics = (code?: string) => {
    setIsLoadingAnalytics(true);
    const pass = code || passcode || localStorage.getItem("sigma_admin_pass") || "demon323161";
    fetch(`/api/analytics?passcode=${encodeURIComponent(pass)}`)
      .then(res => res.json())
      .then(data => {
        if (data && !data.error) {
          setAnalytics(data);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoadingAnalytics(false));
  };

  const fetchFantasyPicks = () => {
    setIsLoadingPicks(true);
    fetch("/api/fantasy/picks")
      .then(res => res.json())
      .then(data => {
        if (data && data.picks) {
          setFantasyPicksList(Object.values(data.picks));
        } else {
          setFantasyPicksList([]);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoadingPicks(false));
  };

  const handleDeletePick = async (userId: string, userName: string) => {
    if (!window.confirm(`Вы действительно хотите удалить прогноз участника "${userName}"?`)) return;
    try {
      const res = await fetch(`/api/fantasy/picks?userId=${encodeURIComponent(userId)}`, { method: "DELETE" });
      if (res.ok) {
        setPicksMsg(`Прогноз "${userName}" успешно удален!`);
        fetchFantasyPicks();
      } else {
        const d = await res.json();
        setPicksMsg(`Ошибка: ${d.error || "Не удалось удалить"}`);
      }
    } catch (e: any) {
      setPicksMsg(`Ошибка сети: ${e.message}`);
    }
  };

  const handleClearAllPicks = async () => {
    if (!window.confirm("⚠️ ВНИМАНИЕ: Вы действительно хотите удалить ВСЕ прогнозы Fantasy League и очистить таблицу? Это действие необратимо.")) return;
    try {
      const res = await fetch("/api/fantasy/picks?all=true", { method: "DELETE" });
      if (res.ok) {
        setPicksMsg("Все прогнозы успешно удалены! Таблица Fantasy League очищена.");
        fetchFantasyPicks();
      } else {
        const d = await res.json();
        setPicksMsg(`Ошибка: ${d.error || "Не удалось очистить"}`);
      }
    } catch (e: any) {
      setPicksMsg(`Ошибка сети: ${e.message}`);
    }
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem("sigma_user_role");
      if (saved && saved !== "GUEST") {
        setCurrentRole(saved);
        if (saved === "ADMIN") {
          fetchAnalytics();
          fetchFantasyPicks();
        }
      }
    } catch (e) {}

    // Fetch active tournament settings
    fetch("/api/fantasy/tournament")
      .then(res => res.json())
      .then(data => {
        if (data && data.tournament) {
          setTourTitle(data.tournament.title || "");
          setTourDate(data.tournament.startTime || "");
          setTourStatus(data.tournament.status || "DRAFT_OPEN");
          setTourWinner(data.tournament.winnerNickname || "");
        }
      })
      .catch(() => {});
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const p = passcode.trim().toLowerCase();

    if (p === "demon323161" || p === "sigmaadmin" || p === "admin") {
      localStorage.setItem("sigma_user_role", "ADMIN");
      localStorage.setItem("sigma_user_name", "Admin");
      localStorage.setItem("sigma_admin_pass", p);
      setCurrentRole("ADMIN");
      setSuccessMsg("Успешный вход в систему с правами Администратора!");
      setError("");
      fetchAnalytics(p);
      fetchFantasyPicks();
    } else if (p === "chillout" || p === "mrchillout") {
      localStorage.setItem("sigma_user_role", "EVENT_MAKER");
      localStorage.setItem("sigma_user_name", "Mr.Chillout");
      setCurrentRole("EVENT_MAKER");
      setSuccessMsg("Успешный вход! Права: Event Maker (Mr.Chillout)");
      setError("");
    } else {
      setError("Неверный пароль доступа");
      setSuccessMsg("");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("sigma_user_role");
    localStorage.removeItem("sigma_user_name");
    localStorage.removeItem("sigma_admin_pass");
    setCurrentRole(null);
    setAnalytics(null);
    setSuccessMsg("Вы вышли из системы администратора.");
  };

  const handleSaveTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingTour(true);
    setTourSaveMsg("");
    try {
      const res = await fetch("/api/fantasy/tournament", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          passcode: passcode || localStorage.getItem("sigma_admin_pass") || "demon323161",
          title: tourTitle,
          startTime: tourDate,
          status: tourStatus,
          winnerNickname: tourWinner
        })
      });
      const data = await res.json();
      if (res.ok) {
        setTourSaveMsg("Настройки турнира и Fantasy League успешно сохранены!");
      } else {
        setTourSaveMsg(`Ошибка: ${data.error || "Не удалось сохранить"}`);
      }
    } catch (e: any) {
      setTourSaveMsg(`Ошибка сети: ${e.message}`);
    } finally {
      setIsSavingTour(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(circle at 50% 20%, rgba(124, 77, 255, 0.12) 0%, rgba(6, 5, 12, 0.98) 70%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "2rem 1rem",
      color: "#fff",
      fontFamily: "var(--font-sans, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif)"
    }}>
      <div className="glass-card animate-fade-in" style={{
        maxWidth: "680px",
        width: "100%",
        padding: "2.5rem 2rem",
        borderRadius: "24px",
        border: "1.5px solid rgba(0, 229, 255, 0.3)",
        boxShadow: "0 0 50px rgba(0, 229, 255, 0.15), 0 20px 40px rgba(0,0,0,0.8)",
        background: "#0c0a17",
        textAlign: "center",
        position: "relative"
      }}>
        <div style={{
          width: "64px",
          height: "64px",
          borderRadius: "18px",
          background: "linear-gradient(135deg, rgba(0, 229, 255, 0.2), rgba(124, 77, 255, 0.2))",
          border: "1px solid var(--accent-cyan)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 1.5rem auto",
          fontSize: "1.75rem",
          boxShadow: "0 0 25px rgba(0, 229, 255, 0.25)"
        }}>
          🛡️
        </div>

        <h2 className="glow-text-cyan" style={{ fontSize: "1.6rem", fontWeight: "800", margin: "0 0 0.5rem 0" }}>
          Панель Администратора
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginBottom: "1.75rem", lineHeight: "1.4" }}>
          Управление хабом СИГМА, турнирами, Fantasy League и статистика посещаемости
        </p>

        {currentRole ? (
          <div>
            <div style={{
              background: "rgba(255, 255, 255, 0.03)",
              border: "1px solid var(--border-light)",
              borderRadius: "16px",
              padding: "1.25rem",
              marginBottom: "1.5rem"
            }}>
              <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "0.5rem" }}>
                Текущая активная сессия:
              </div>
              <div style={{ fontSize: "1.1rem", fontWeight: "800", color: currentRole === "ADMIN" ? "#ffb74d" : "#b388ff", marginBottom: "1rem" }}>
                {currentRole === "ADMIN" ? "ADMIN" : "EVENT MAKER"}
              </div>
              <div style={{ display: "flex", gap: "0.75rem" }}>
                <Link
                  href="/"
                  style={{
                    flex: 1,
                    padding: "0.65rem 1rem",
                    borderRadius: "10px",
                    background: "linear-gradient(135deg, #00e5ff, #00b4d8)",
                    color: "#000",
                    fontWeight: "700",
                    fontSize: "0.85rem",
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  Перейти на сайт
                </Link>
                <button
                  onClick={handleLogout}
                  style={{
                    padding: "0.65rem 1rem",
                    borderRadius: "10px",
                    background: "rgba(255, 73, 73, 0.15)",
                    border: "1px solid rgba(255, 73, 73, 0.4)",
                    color: "#ff7b7b",
                    fontWeight: "700",
                    fontSize: "0.85rem",
                    cursor: "pointer"
                  }}
                >
                  Выйти
                </button>
              </div>
            </div>

            {/* ADMIN-ONLY VISITOR ANALYTICS SECTION */}
            {currentRole === "ADMIN" && (
              <div style={{
                marginTop: "1.5rem",
                background: "rgba(0, 229, 255, 0.03)",
                border: "1px solid rgba(0, 229, 255, 0.25)",
                borderRadius: "18px",
                padding: "1.5rem",
                textAlign: "left"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ fontSize: "1.25rem" }}>📊</span>
                    <h3 style={{ margin: 0, fontSize: "1.1rem", color: "#00e5ff" }}>
                      Статистика посещаемости сайта
                    </h3>
                  </div>
                  <button
                    onClick={() => fetchAnalytics()}
                    disabled={isLoadingAnalytics}
                    style={{
                      padding: "0.4rem 0.75rem",
                      borderRadius: "8px",
                      background: "rgba(0, 229, 255, 0.15)",
                      border: "1px solid var(--accent-cyan)",
                      color: "#00e5ff",
                      fontSize: "0.75rem",
                      fontWeight: "700",
                      cursor: "pointer"
                    }}
                  >
                    {isLoadingAnalytics ? "Загрузка..." : "Обновить"}
                  </button>
                </div>

                {analytics ? (
                  <div>
                    {/* 4 Metric Tiles */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "0.75rem", marginBottom: "1.25rem" }}>
                      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-light)", borderRadius: "12px", padding: "0.85rem", textAlign: "center" }}>
                        <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginBottom: "0.3rem" }}>Всего просмотров</div>
                        <div style={{ fontSize: "1.35rem", fontWeight: "800", color: "#00e5ff" }}>{analytics.totalViews.toLocaleString()}</div>
                      </div>
                      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-light)", borderRadius: "12px", padding: "0.85rem", textAlign: "center" }}>
                        <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginBottom: "0.3rem" }}>Уникальных всего</div>
                        <div style={{ fontSize: "1.35rem", fontWeight: "800", color: "#7c4dff" }}>{analytics.totalUniques.toLocaleString()}</div>
                      </div>
                      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-light)", borderRadius: "12px", padding: "0.85rem", textAlign: "center" }}>
                        <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginBottom: "0.3rem" }}>Просмотры сегодня</div>
                        <div style={{ fontSize: "1.35rem", fontWeight: "800", color: "#4caf50" }}>{analytics.todayViews.toLocaleString()}</div>
                      </div>
                      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-light)", borderRadius: "12px", padding: "0.85rem", textAlign: "center" }}>
                        <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginBottom: "0.3rem" }}>Уникальные сегодня</div>
                        <div style={{ fontSize: "1.35rem", fontWeight: "800", color: "#ffb74d" }}>{analytics.todayUniques.toLocaleString()}</div>
                      </div>
                    </div>

                    {/* Daily History Table */}
                    {analytics.dailyHistory && analytics.dailyHistory.length > 0 && (
                      <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: "10px", padding: "0.75rem", border: "1px solid var(--border-light)", marginBottom: "1rem" }}>
                        <div style={{ fontSize: "0.78rem", fontWeight: "700", color: "var(--text-secondary)", marginBottom: "0.5rem" }}>
                          История посещений по дням:
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", maxHeight: "150px", overflowY: "auto" }}>
                          {analytics.dailyHistory.slice().reverse().map((day, idx) => (
                            <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", padding: "0.25rem 0.5rem", borderRadius: "6px", background: idx === 0 ? "rgba(0, 229, 255, 0.08)" : "transparent" }}>
                              <span style={{ color: idx === 0 ? "#00e5ff" : "var(--text-secondary)", fontWeight: idx === 0 ? "700" : "500" }}>{day.date} {idx === 0 ? "(Сегодня)" : ""}</span>
                              <span style={{ color: "#fff", fontWeight: "600" }}>{day.views} просмотров ({day.uniques} уник.)</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ color: "var(--text-muted)", fontSize: "0.85rem", textAlign: "center", padding: "1rem" }}>
                    {isLoadingAnalytics ? "Загрузка аналитики..." : "Нажмите «Обновить» для получения статистики"}
                  </div>
                )}
              </div>
            )}

            {/* FANTASY LEAGUE TOURNAMENT MANAGEMENT SECTION */}
            {currentRole === "ADMIN" && (
              <div style={{
                marginTop: "1.5rem",
                background: "rgba(124, 77, 255, 0.05)",
                border: "1px solid rgba(124, 77, 255, 0.3)",
                borderRadius: "18px",
                padding: "1.5rem",
                textAlign: "left"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
                  <span style={{ fontSize: "1.25rem" }}>🏆</span>
                  <h3 style={{ margin: 0, fontSize: "1.1rem", color: "#b388ff" }}>
                    Настройки следующего турнира (Fantasy)
                  </h3>
                </div>

                <form onSubmit={handleSaveTournament} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.3rem" }}>
                      Название турнира:
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      value={tourTitle}
                      onChange={e => setTourTitle(e.target.value)}
                      placeholder="Например: Sigma Cup #14"
                      style={{ width: "100%", padding: "0.6rem 0.8rem", borderRadius: "10px", background: "#06050c", border: "1px solid var(--border-light)", color: "#fff", boxSizing: "border-box" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.3rem" }}>
                      Дата и время начала турнира:
                    </label>
                    <input
                      type="datetime-local"
                      className="input-field"
                      value={tourDate}
                      onChange={e => setTourDate(e.target.value)}
                      style={{ width: "100%", padding: "0.6rem 0.8rem", borderRadius: "10px", background: "#06050c", border: "1px solid var(--border-light)", color: "#fff", boxSizing: "border-box" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.3rem" }}>
                      Статус Fantasy League:
                    </label>
                    <select
                      value={tourStatus}
                      onChange={e => setTourStatus(e.target.value as any)}
                      style={{ width: "100%", padding: "0.6rem 0.8rem", borderRadius: "10px", background: "#06050c", border: "1px solid var(--border-light)", color: "#fff", boxSizing: "border-box" }}
                    >
                      <option value="DRAFT_OPEN">DRAFT OPEN (Прием прогнозов открыт)</option>
                      <option value="LIVE">LIVE (Турнир идет, пики зафиксированы)</option>
                      <option value="COMPLETED">COMPLETED (Завершен, итоги подведены)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.3rem" }}>
                      Никнейм победителя («Фантазер» турнира):
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      value={tourWinner}
                      onChange={e => setTourWinner(e.target.value)}
                      placeholder="Никнейм победителя для золотой рамки..."
                      style={{ width: "100%", padding: "0.6rem 0.8rem", borderRadius: "10px", background: "#06050c", border: "1px solid var(--border-light)", color: "#fff", boxSizing: "border-box" }}
                    />
                  </div>

                  {tourSaveMsg && (
                    <div style={{ fontSize: "0.85rem", padding: "0.5rem", borderRadius: "8px", background: "rgba(255,255,255,0.05)" }}>
                      {tourSaveMsg}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSavingTour}
                    style={{
                      marginTop: "0.5rem",
                      padding: "0.75rem",
                      borderRadius: "10px",
                      background: "linear-gradient(135deg, #7c4dff, #00e5ff)",
                      border: "none",
                      color: "#fff",
                      fontWeight: "700",
                      cursor: "pointer"
                    }}
                  >
                    {isSavingTour ? "Сохранение..." : "Сохранить турнир и Fantasy"}
                  </button>
                </form>
              </div>
            )}

            {/* FANTASY PICKS MANAGEMENT SECTION */}
            {currentRole === "ADMIN" && (
              <div style={{
                marginTop: "1.5rem",
                background: "rgba(255, 215, 0, 0.04)",
                border: "1px solid rgba(255, 215, 0, 0.3)",
                borderRadius: "18px",
                padding: "1.5rem",
                textAlign: "left"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ fontSize: "1.25rem" }}>🎯</span>
                    <h3 style={{ margin: 0, fontSize: "1.1rem", color: "#ffd700" }}>
                      Прогнозы участников Fantasy League ({fantasyPicksList.length})
                    </h3>
                  </div>

                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                      onClick={() => fetchFantasyPicks()}
                      disabled={isLoadingPicks}
                      style={{
                        padding: "0.35rem 0.75rem",
                        borderRadius: "8px",
                        background: "rgba(255, 215, 0, 0.15)",
                        border: "1px solid rgba(255, 215, 0, 0.4)",
                        color: "#ffd700",
                        fontSize: "0.75rem",
                        fontWeight: "700",
                        cursor: "pointer"
                      }}
                    >
                      {isLoadingPicks ? "Обновление..." : "🔄 Обновить"}
                    </button>
                    {fantasyPicksList.length > 0 && (
                      <button
                        onClick={handleClearAllPicks}
                        style={{
                          padding: "0.35rem 0.75rem",
                          borderRadius: "8px",
                          background: "rgba(255, 73, 73, 0.15)",
                          border: "1px solid rgba(255, 73, 73, 0.4)",
                          color: "#ff7b7b",
                          fontSize: "0.75rem",
                          fontWeight: "700",
                          cursor: "pointer"
                        }}
                        title="Удалить все прогнозы и полностью очистить таблицу лидеров фентези"
                      >
                        ⚠️ Очистить все
                      </button>
                    )}
                  </div>
                </div>

                {picksMsg && (
                  <div style={{ fontSize: "0.85rem", padding: "0.6rem 0.8rem", borderRadius: "8px", background: "rgba(255,255,255,0.05)", marginBottom: "1rem", color: picksMsg.includes("успешно") ? "#00e5ff" : "#ff7b7b" }}>
                    {picksMsg}
                  </div>
                )}

                {fantasyPicksList.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "1.5rem", color: "var(--text-muted)", fontSize: "0.85rem", border: "1px dashed var(--border-light)", borderRadius: "12px" }}>
                    {isLoadingPicks ? "Загрузка списка прогнозов..." : "Нет активных прогнозов в текущем турнире."}
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", maxHeight: "300px", overflowY: "auto" }}>
                    {fantasyPicksList.map((pick: any) => (
                      <div
                        key={pick.userId}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "0.75rem 1rem",
                          borderRadius: "12px",
                          background: "rgba(0,0,0,0.4)",
                          border: "1px solid var(--border-light)",
                          flexWrap: "wrap",
                          gap: "0.75rem"
                        }}
                      >
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <strong style={{ color: "#fff", fontSize: "0.92rem" }}>{pick.userName}</strong>
                            <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", background: "rgba(255,255,255,0.06)", padding: "0.1rem 0.4rem", borderRadius: "4px" }}>
                              {pick.userId.startsWith("guest_") ? "Гость" : "Steam"}
                            </span>
                          </div>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
                            🔴 {pick.sniper?.nickname || "—"} | 🔵 {pick.support?.nickname || "—"} | 🟡 {pick.darkHorse?.nickname || "—"}
                          </div>
                        </div>

                        <button
                          onClick={() => handleDeletePick(pick.userId, pick.userName)}
                          style={{
                            padding: "0.35rem 0.75rem",
                            borderRadius: "8px",
                            background: "rgba(255, 73, 73, 0.12)",
                            border: "1px solid rgba(255, 73, 73, 0.3)",
                            color: "#ff7b7b",
                            fontSize: "0.75rem",
                            fontWeight: "700",
                            cursor: "pointer",
                            transition: "all 0.2s ease"
                          }}
                        >
                          🗑 Удалить
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div style={{ textAlign: "left" }}>
              <label style={{ display: "block", marginBottom: "0.4rem", fontSize: "0.82rem", color: "var(--text-secondary)", fontWeight: "600" }}>
                Секретный пароль доступа:
              </label>
              <input
                type="password"
                className="input-field"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Введите пароль..."
                autoFocus
                style={{
                  width: "100%",
                  padding: "0.75rem 1rem",
                  borderRadius: "12px",
                  background: "#06050c",
                  border: "1px solid var(--border-light)",
                  color: "#fff",
                  fontSize: "0.95rem",
                  boxSizing: "border-box"
                }}
              />
            </div>

            {error && (
              <div style={{
                color: "#ff4949",
                background: "rgba(255, 73, 73, 0.1)",
                padding: "0.65rem",
                borderRadius: "10px",
                fontSize: "0.82rem",
                border: "1px solid rgba(255, 73, 73, 0.3)"
              }}>
                {error}
              </div>
            )}

            {successMsg && (
              <div style={{
                color: "#00e5ff",
                background: "rgba(0, 229, 255, 0.1)",
                padding: "0.65rem",
                borderRadius: "10px",
                fontSize: "0.82rem",
                border: "1px solid var(--accent-cyan)"
              }}>
                {successMsg}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-glow-cyan"
              style={{
                width: "100%",
                padding: "0.8rem",
                borderRadius: "12px",
                fontSize: "0.95rem",
                fontWeight: "700",
                background: "linear-gradient(135deg, #00e5ff, #7c4dff)",
                color: "#fff",
                border: "none",
                cursor: "pointer"
              }}
            >
              Войти в панель
            </button>
          </form>
        )}

        <div style={{ marginTop: "1.75rem", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "1.25rem" }}>
          <Link
            href="/"
            style={{
              color: "var(--text-muted)",
              fontSize: "0.82rem",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem"
            }}
          >
            ← Вернуться на главную страницу
          </Link>
        </div>
      </div>
    </div>
  );
}
