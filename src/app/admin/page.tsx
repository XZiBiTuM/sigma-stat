"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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

  useEffect(() => {
    try {
      const saved = localStorage.getItem("sigma_user_role");
      if (saved && saved !== "GUEST") {
        setCurrentRole(saved);
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
      setCurrentRole("ADMIN");
      setSuccessMsg("Успешный вход в систему с правами Администратора!");
      setError("");
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
    setCurrentRole(null);
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
          passcode: passcode || "demon323161",
          title: tourTitle,
          startTime: tourDate,
          status: tourStatus,
          winnerNickname: tourWinner
        })
      });
      const data = await res.json();
      if (res.ok) {
        setTourSaveMsg("✅ Настройки турнира и Fantasy League успешно сохранены!");
      } else {
        setTourSaveMsg(`❌ Ошибка: ${data.error || "Не удалось сохранить"}`);
      }
    } catch (e: any) {
      setTourSaveMsg(`❌ Ошибка сети: ${e.message}`);
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
        maxWidth: "560px",
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
          Панель Организатора
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginBottom: "1.75rem", lineHeight: "1.4" }}>
          Управление хабом СИГМА, турнирами и Fantasy League
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

            {/* FANTASY LEAGUE TOURNAMENT MANAGEMENT SECTION */}
            {currentRole === "ADMIN" && (
              <div style={{
                marginTop: "2rem",
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
                      <option value="DRAFT_OPEN">🟢 DRAFT OPEN (Прием прогнозов открыт)</option>
                      <option value="LIVE">🟡 LIVE (Турнир идет, пики зафиксированы)</option>
                      <option value="COMPLETED">🔴 COMPLETED (Завершен, итоги подведены)</option>
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
                    {isSavingTour ? "Сохранение..." : "💾 Сохранить турнир и Fantasy"}
                  </button>
                </form>
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
