"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Caught in App Error Boundary:", error);
    const msg = error?.message || "";
    if (msg.includes("Server Action") || msg.includes("Loading chunk") || msg.includes("deployment")) {
      window.location.reload();
    }
  }, [error]);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#080612",
      color: "#fff",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "2rem",
      textAlign: "center",
      fontFamily: "sans-serif"
    }}>
      <div style={{
        background: "rgba(255, 255, 255, 0.03)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        borderRadius: "16px",
        padding: "2.5rem 2rem",
        maxWidth: "480px",
        width: "100%",
        boxShadow: "0 10px 40px rgba(0,0,0,0.8)"
      }}>
        <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>⚡</div>
        <h2 style={{ fontSize: "1.3rem", fontWeight: "800", marginBottom: "0.75rem", color: "#fff" }}>
          Временный сбой загрузки
        </h2>
        <p style={{ fontSize: "0.85rem", color: "#9ca3af", marginBottom: "1.5rem", lineHeight: "1.5" }}>
          Не удалось обновить данные или произошло обновление системы. Нажмите кнопку ниже для перезагрузки.
        </p>

        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
          <button
            onClick={() => reset()}
            style={{
              background: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              color: "#fff",
              borderRadius: "8px",
              padding: "0.6rem 1.25rem",
              fontSize: "0.85rem",
              fontWeight: "600",
              cursor: "pointer"
            }}
          >
            Попробовать снова
          </button>

          <button
            onClick={() => window.location.reload()}
            style={{
              background: "linear-gradient(135deg, #7c3aed, #06b6d4)",
              border: "none",
              color: "#fff",
              borderRadius: "8px",
              padding: "0.6rem 1.5rem",
              fontSize: "0.85rem",
              fontWeight: "700",
              cursor: "pointer"
            }}
          >
            Обновить страницу
          </button>
        </div>
      </div>
    </div>
  );
}
