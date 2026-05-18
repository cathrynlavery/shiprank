"use client";

import { useState } from "react";

type Status = "idle" | "loading" | "error";

export function ManualRefreshButton() {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    setStatus("loading");
    setMessage(null);

    try {
      const response = await fetch("/api/refresh/me", { method: "POST" });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setMessage(
          typeof body?.error === "string"
            ? body.error
            : `refresh failed (${response.status})`,
        );
        setStatus("error");
        return;
      }

      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "network error");
      setStatus("error");
    }
  }

  return (
    <div className="manual-refresh">
      <button
        className="button"
        type="button"
        onClick={refresh}
        disabled={status === "loading"}
      >
        {status === "loading" ? "refreshing" : "refresh now"}
      </button>
      {status === "error" ? (
        <span className="manual-refresh-error">{message}</span>
      ) : null}
    </div>
  );
}
