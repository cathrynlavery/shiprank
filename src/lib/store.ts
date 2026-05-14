import { kv } from "@vercel/kv";
import type { RepoStats, StatsPayload, StoredUser } from "@/lib/types";

const fallbackStatsUrl =
  process.env.FALLBACK_STATS_URL ??
  "https://cathrynlavery.github.io/shipstats/stats.json";

function hasKv() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asRepoStats(value: unknown): RepoStats {
  if (!value || typeof value !== "object") return {};
  return value as RepoStats;
}

function netFromRepos(repos: RepoStats) {
  return Object.values(repos).reduce(
    (sum, stats) => sum + stats.additions - stats.deletions,
    0,
  );
}

function normalizeStats(raw: unknown): StatsPayload {
  const r = asRecord(raw);
  const today = asRecord(r.today);
  const week = asRecord(r.week);
  const todayByRepo = asRepoStats(today.byRepo);
  const weekByRepo = asRepoStats(week.byRepo);

  const todayLines = asNumber(today.lines ?? today.total);
  const weekLines = asNumber(week.lines ?? week.total);

  return {
    username: typeof r.username === "string" ? r.username : "",
    generated:
      typeof r.generated === "string" ? r.generated : new Date().toISOString(),
    today: {
      date:
        typeof today.date === "string"
          ? today.date
          : new Date().toISOString().slice(0, 10),
      lines: todayLines,
      net: asNumber(today.net, netFromRepos(todayByRepo)),
      commits: asNumber(today.commits),
      prs: asNumber(today.prs),
      byRepo: todayByRepo,
    },
    week: {
      lines: weekLines,
      net: asNumber(week.net, netFromRepos(weekByRepo)),
      commits: asNumber(week.commits),
      prs: asNumber(week.prs),
      byRepo: weekByRepo,
    },
    byDay:
      r.byDay && typeof r.byDay === "object"
        ? (r.byDay as StatsPayload["byDay"])
        : {},
  };
}

async function getFallbackStats(username?: string) {
  if (username && username.toLowerCase() !== "cathrynlavery") return null;

  try {
    const response = await fetch(fallbackStatsUrl, {
      cache: "no-store",
      next: { revalidate: 0 },
    });
    if (!response.ok) return null;
    return normalizeStats(await response.json());
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
  const raw = await kv.get(`stats:${username}`);
  return raw ? normalizeStats(raw) : null;
}

export async function getAllStats() {
  if (!hasKv()) {
    const fallback = await getFallbackStats();
    return fallback ? [fallback] : [];
  }

  const stats: StatsPayload[] = [];

  for await (const key of kv.scanIterator({ match: "stats:*", count: 100 })) {
    const value = await kv.get(key);
    if (value) stats.push(normalizeStats(value));
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
