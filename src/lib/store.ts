import { kv } from "@vercel/kv";
import type { StatsPayload, StoredUser } from "@/lib/types";

const fallbackStatsUrl =
  process.env.FALLBACK_STATS_URL ??
  "https://cathrynlavery.github.io/shipstats/stats.json";

function hasKv() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

async function getFallbackStats(username?: string) {
  if (username && username.toLowerCase() !== "cathrynlavery") return null;

  try {
    const response = await fetch(fallbackStatsUrl, {
      cache: "no-store",
      next: { revalidate: 0 },
    });
    if (!response.ok) return null;
    return (await response.json()) as StatsPayload;
  } catch {
    return null;
  }
}

export async function saveUser(user: StoredUser) {
  if (!hasKv()) return;
  await kv.set(`user:${user.username}`, user);
}

export async function saveStats(stats: StatsPayload) {
  if (!hasKv()) return;
  await kv.set(`stats:${stats.username}`, stats);
}

export async function getStats(username: string) {
  if (!hasKv()) return getFallbackStats(username);
  return kv.get<StatsPayload>(`stats:${username}`);
}

export async function getAllStats() {
  if (!hasKv()) {
    const fallback = await getFallbackStats();
    return fallback ? [fallback] : [];
  }

  const stats: StatsPayload[] = [];

  for await (const key of kv.scanIterator({ match: "stats:*", count: 100 })) {
    const value = await kv.get<StatsPayload>(key);
    if (value) stats.push(value);
  }

  return stats;
}

export async function getAllUsers() {
  if (!hasKv()) return [];

  const users: StoredUser[] = [];

  for await (const key of kv.scanIterator({ match: "user:*", count: 100 })) {
    const value = await kv.get<StoredUser>(key);
    if (value) users.push(value);
  }

  return users;
}
