"use client";

import { useEffect, useState } from "react";

type Status = "idle" | "loading" | "error";

async function requestRefresh(): Promise<string | null> {
  try {
    const response = await fetch("/api/refresh/me", { method: "POST" });
    if (response.ok) return null;
    const body = await response.json().catch(() => ({}));
    return typeof body?.error === "string"
      ? body.error
      : `refresh failed (${response.status})`;
  } catch (error) {
    return error instanceof Error ? error.message : "network error";
  }
}

// Drops ?reconnected=1 so the reload doesn't start another refresh.
function reloadWithoutQuery() {
  window.location.replace(window.location.pathname);
}

export function ManualRefreshButton({
  autoStart = false,
}: {
  autoStart?: boolean;
}) {
  const [status, setStatus] = useState<Status>(autoStart ? "loading" : "idle");
  const [message, setMessage] = useState<string | null>(null);

  // GitHub skips its consent screen for an app you already approved, so a
  // reconnect lands back here in a second. Recount now so the visit shows
  // something changed instead of the stats from before the grant.
  useEffect(() => {
    if (!autoStart) return;
    // Reloading mid-recount must not start a second full rebuild.
    window.history.replaceState(null, "", window.location.pathname);
    let cancelled = false;
    requestRefresh().then((error) => {
      if (cancelled) return;
      if (!error) return reloadWithoutQuery();
      setMessage(error);
      setStatus("error");
    });
    return () => {
      cancelled = true;
    };
  }, [autoStart]);

  async function refresh() {
    setStatus("loading");
    setMessage(null);
    const error = await requestRefresh();
    if (!error) return reloadWithoutQuery();
    setMessage(error);
    setStatus("error");
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
      {autoStart && status === "loading" ? (
        <span className="manual-refresh-error">
          full visibility connected. recounting your repos, this can take a
          minute.
        </span>
      ) : null}
      {status === "error" ? (
        <span className="manual-refresh-error">{message}</span>
      ) : null}
    </div>
  );
}
