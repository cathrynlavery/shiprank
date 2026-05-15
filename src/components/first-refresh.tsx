"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Status = "pending" | "error";

export function FirstRefresh({ username }: { username: string }) {
  const [status, setStatus] = useState<Status>("pending");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const response = await fetch("/api/refresh/me", { method: "POST" });
        if (cancelled) return;

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
        if (cancelled) return;
        setMessage(error instanceof Error ? error.message : "network error");
        setStatus("error");
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="wrap">
      <div className="topline">
        <div className="handle">
          <Link href="/">
            <span className="wordmark-bold">ship</span>rank
          </Link>
        </div>
      </div>

      <div className="handle">
        <a
          href={`https://github.com/${username}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          @{username}
        </a>
      </div>
      <div className="hero-num">…</div>
      <div className="hero-sub">
        {status === "pending"
          ? "counting your lines — this can take up to a minute"
          : `couldn't compute stats: ${message ?? "unknown error"}`}
      </div>

      {status === "error" ? (
        <section className="section">
          <p className="prose">
            Stats refresh at 09:00 and 20:00 UTC. Your stats will appear then
            even if this retry fails.{" "}
            <Link href="/">Back to the leaderboard</Link>.
          </p>
        </section>
      ) : null}
    </main>
  );
}
