"use client";

import { useCallback } from "react";

type ShareButtonProps = {
  username: string;
  total: number;
  date: string;
};

function buildShareText(total: number) {
  if (total > 0) {
    return `+${total.toLocaleString("en-US")} lines shipped today on ShipRank`;
  }
  return `tracking lines shipped on ShipRank`;
}

export function ShareButton({ username, total, date }: ShareButtonProps) {
  const onClick = useCallback(async () => {
    const text = buildShareText(total);
    const url = `https://shiprank.dev/${username}`;

    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title: `@${username} · ${date}`, text, url });
        return;
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
      }
    }

    const intent = new URL("https://twitter.com/intent/tweet");
    intent.searchParams.set("text", text);
    intent.searchParams.set("url", url);
    window.open(intent.toString(), "_blank", "noopener,noreferrer");
  }, [username, total, date]);

  return (
    <button className="button" type="button" onClick={onClick}>
      share
    </button>
  );
}
