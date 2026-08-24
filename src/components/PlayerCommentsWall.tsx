"use client";

import React, { useState, useEffect } from "react";

export interface PlayerComment {
  id: string;
  authorNickname: string;
  authorAvatar: string;
  authorSteamId: string;
  authorFaceitId: string;
  authorRole?: string;
  text: string;
  createdAt: string;
}

export default function PlayerCommentsWall({
  targetPlayerId,
  targetPlayerNick,
  currentUser,
  isAdmin = false
}: {
  targetPlayerId: string;
  targetPlayerNick?: string;
  currentUser: any | null;
  isAdmin?: boolean;
}) {
  const [comments, setComments] = useState<PlayerComment[]>([]);
  const [inputText, setInputText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const key = targetPlayerId || targetPlayerNick || "";

  const loadComments = async () => {
    if (!key) return;
    try {
      setIsLoading(true);
      const res = await fetch(`/api/players/${encodeURIComponent(key)}/comments`);
      const data = await res.json();
      if (data.success && Array.isArray(data.comments)) {
        setComments(data.comments);
      }
    } catch (err) {
      console.warn("Failed to load comments:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadComments();
  }, [key]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      setErrorMsg("");
      const res = await fetch(`/api/players/${encodeURIComponent(key)}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: inputText.trim() })
      });
      const data = await res.json();
      if (data.success) {
        setInputText("");
        if (data.comments) setComments(data.comments);
        else loadComments();
      } else {
        setErrorMsg(data.error || "Ошибка при отправке");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Ошибка соединения");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm("Удалить этот комментарий?")) return;
    try {
      const res = await fetch(`/api/players/${encodeURIComponent(key)}/comments`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId, passcode: "demon323161" })
      });
      const data = await res.json();
      if (data.success) {
        if (data.comments) setComments(data.comments);
        else loadComments();
      }
    } catch (err) {
      console.warn("Failed to delete comment:", err);
    }
  };

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    } catch {
      return iso;
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <h3 style={{ fontSize: "1.1rem", fontWeight: "800", color: "#fff", margin: 0, textTransform: "uppercase", letterSpacing: "0.03em" }}>
            Комментарии
          </h3>
          <span style={{
            fontSize: "0.75rem",
            fontWeight: "800",
            padding: "0.15rem 0.55rem",
            borderRadius: "6px",
            background: "rgba(255, 255, 255, 0.05)",
            color: "var(--text-secondary)",
            border: "1px solid var(--border-light)"
          }}>
            {comments.length}
          </span>
        </div>
      </div>

      {/* Input Box */}
      {currentUser ? (
        <form onSubmit={handleSubmit} style={{
          background: "rgba(255, 255, 255, 0.02)",
          border: "1px solid var(--border-light)",
          borderRadius: "14px",
          padding: "1rem 1.25rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <img
              src={currentUser.faceit?.avatar || currentUser.steamAvatar || "/default-avatar.png"}
              alt=""
              style={{ width: "26px", height: "26px", borderRadius: "50%", objectFit: "cover", border: "1px solid var(--accent-cyan)" }}
            />
            <span style={{ fontSize: "0.82rem", fontWeight: "700", color: "#fff" }}>
              {currentUser.faceit?.nickname || currentUser.steamName}
            </span>
            <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginLeft: "auto" }}>
              {inputText.length} / 500
            </span>
          </div>

          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value.slice(0, 500))}
            placeholder={`Оставить отзыв или респект для ${targetPlayerNick || "игрока"}...`}
            rows={2}
            style={{
              width: "100%",
              background: "rgba(0, 0, 0, 0.35)",
              border: "1px solid var(--border-light)",
              borderRadius: "10px",
              padding: "0.6rem 0.85rem",
              color: "#fff",
              fontSize: "0.88rem",
              resize: "vertical",
              outline: "none",
              fontFamily: "inherit"
            }}
          />

          {errorMsg && (
            <div style={{ fontSize: "0.78rem", color: "#ff4b4b", fontWeight: "600" }}>
              {errorMsg}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="submit"
              disabled={isSubmitting || !inputText.trim()}
              style={{
                background: inputText.trim() ? "rgba(0, 229, 255, 0.15)" : "rgba(255, 255, 255, 0.05)",
                border: `1px solid ${inputText.trim() ? "var(--accent-cyan)" : "var(--border-light)"}`,
                color: inputText.trim() ? "var(--accent-cyan)" : "var(--text-muted)",
                padding: "0.4rem 1.1rem",
                borderRadius: "8px",
                fontSize: "0.82rem",
                fontWeight: "700",
                cursor: inputText.trim() ? "pointer" : "default",
                transition: "all 0.2s ease"
              }}
            >
              {isSubmitting ? "Отправка..." : "Опубликовать"}
            </button>
          </div>
        </form>
      ) : (
        <div style={{
          background: "rgba(255, 255, 255, 0.02)",
          border: "1px solid var(--border-light)",
          borderRadius: "14px",
          padding: "1.25rem",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "0.75rem"
        }}>
          <span style={{ fontSize: "0.88rem", color: "var(--text-secondary)" }}>
            Войдите через Steam, чтобы оставить комментарий или респект в профиле
          </span>
          <a
            href="/api/auth/steam/login"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              background: "linear-gradient(135deg, rgba(23, 26, 33, 0.95), rgba(42, 71, 94, 0.8))",
              border: "1px solid #66c0f4",
              color: "#c7d5e0",
              textDecoration: "none",
              padding: "0.4rem 1rem",
              borderRadius: "8px",
              fontSize: "0.82rem",
              fontWeight: "700",
              boxShadow: "0 0 15px rgba(102, 192, 244, 0.2)"
            }}
          >
            <img src="/steam-logo.svg" alt="" style={{ width: "16px", height: "16px" }} />
            Войти через Steam
          </a>
        </div>
      )}

      {/* Comments List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {isLoading ? (
          <div style={{ padding: "1.5rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
            Загрузка комментариев...
          </div>
        ) : comments.length === 0 ? (
          <div style={{
            background: "rgba(255, 255, 255, 0.01)",
            border: "1px dashed var(--border-light)",
            borderRadius: "12px",
            padding: "1.75rem",
            textAlign: "center",
            color: "var(--text-muted)",
            fontSize: "0.85rem"
          }}>
            Здесь пока нет комментариев. Будьте первым, кто оставит отзыв!
          </div>
        ) : (
          comments.map((c) => {
            const isMyComment = Boolean(
              currentUser && (
                (currentUser.steamId && currentUser.steamId === c.authorSteamId) ||
                (currentUser.faceit?.playerId && currentUser.faceit.playerId === c.authorFaceitId)
              )
            );
            const canDelete = isMyComment || isAdmin;

            return (
              <div
                key={c.id}
                style={{
                  background: "rgba(255, 255, 255, 0.02)",
                  border: "1px solid var(--border-light)",
                  borderRadius: "12px",
                  padding: "0.85rem 1.15rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem"
                }}
              >
                {/* Author Info + Time + Delete */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                  <img
                    src={c.authorAvatar || "/default-avatar.png"}
                    alt=""
                    style={{ width: "28px", height: "28px", borderRadius: "50%", objectFit: "cover", border: "1px solid rgba(255,255,255,0.15)" }}
                  />
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "0.85rem", fontWeight: "700", color: "#fff" }}>
                      {c.authorNickname}
                    </span>
                    {c.authorRole === "ADMIN" && (
                      <span style={{ fontSize: "0.65rem", fontWeight: "800", padding: "0.1rem 0.35rem", borderRadius: "4px", background: "rgba(255, 145, 0, 0.2)", color: "#ffb74d", border: "1px solid rgba(255, 145, 0, 0.4)" }}>
                        ADMIN
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginLeft: "auto" }}>
                    {formatDate(c.createdAt)}
                  </span>
                  {canDelete && (
                    <button
                      onClick={() => handleDelete(c.id)}
                      title="Удалить комментарий"
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "var(--text-muted)",
                        fontSize: "0.8rem",
                        cursor: "pointer",
                        padding: "0 0.25rem",
                        transition: "color 0.2s"
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "#ff4b4b")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Comment Text */}
                <div style={{ fontSize: "0.88rem", color: "var(--text-primary)", lineHeight: "1.5", wordBreak: "break-word" }}>
                  {c.text}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
