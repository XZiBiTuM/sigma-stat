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

  useEffect(() => {
    try {
      const saved = localStorage.getItem("sigma_user_role");
      if (saved && saved !== "GUEST") {
        setCurrentRole(saved);
      }
    } catch (e) {}
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const p = passcode.trim().toLowerCase();

    if (p === "demon323161" || p === "sigmaadmin" || p === "admin") {
      localStorage.setItem("sigma_user_role", "ADMIN");
      localStorage.setItem("sigma_user_name", "Admin");
      setSuccessMsg("Успешный вход в систему с правами Администратора!");
      setError("");
      setTimeout(() => {
        router.push("/");
      }, 1000);
    } else if (p === "chillout" || p === "mrchillout") {
      localStorage.setItem("sigma_user_role", "EVENT_MAKER");
      localStorage.setItem("sigma_user_name", "Mr.Chillout");
      setSuccessMsg("Успешный вход! Права: Event Maker (Mr.Chillout)");
      setError("");
      setTimeout(() => {
        router.push("/");
      }, 1000);
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

  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(circle at 50% 20%, rgba(124, 77, 255, 0.12) 0%, rgba(6, 5, 12, 0.98) 70%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "1.5rem",
      color: "#fff",
      fontFamily: "var(--font-sans, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif)"
    }}>
      <div className="glass-card animate-fade-in" style={{
        maxWidth: "460px",
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
          Вход для администраторов хаба СИГМА и организаторов ивентов
        </p>

        {currentRole ? (
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
