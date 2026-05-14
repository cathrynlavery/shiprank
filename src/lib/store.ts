import { kv } from "@vercel/kv";
import type { RepoStats, StatsPayload, StoredUser } from "@/lib/types";

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

function sumAdditions(repos: RepoStats) {
  return Object.values(repos).reduce((sum, stats) => sum + stats.additions, 0);
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = new Date(`${value}T00:00:00Z`).getTime();
  return Number.isFinite(time);
}

function safeIsoDate(value: unknown, fallback: string): string {
  return typeof value === "string" && isIsoDate(value) ? value : fallback;
}

function dayBefore(isoDate: string): string {
  const ms = new Date(`${isoDate}T00:00:00Z`).getTime();
  if (!Number.isFinite(ms)) {
    return new Date(Date.now() - 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
  }
  return new Date(ms - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function normalizeStats(raw: unknown): StatsPayload {
  const r = asRecord(raw);
  const today = asRecord(r.today);
  const yesterday = asRecord(r.yesterday);
  const week = asRecord(r.week);
  const todayByRepo = asRepoStats(today.byRepo);
  const weekByRepo = asRepoStats(week.byRepo);

  const todayLines = asNumber(today.lines ?? today.total);
  const weekLines = asNumber(week.lines ?? week.total);

  const todayDate = safeIsoDate(
    today.date,
    new Date().toISOString().slice(0, 10),
  );
  const yesterdayDate = safeIsoDate(yesterday.date, dayBefore(todayDate));

  const byDay: StatsPayload["byDay"] =
    r.byDay && typeof r.byDay === "object"
      ? (r.byDay as StatsPayload["byDay"])
      : {};

  // Yesterday's byRepo/lines can be derived from byDay for legacy payloads
  // that predate the yesterday top-level field. Commits + PRs aren't in byDay,
  // so they stay zero until the next refresh.
  const yesterdayByRepoFromBlock = asRepoStats(yesterday.byRepo);
  const yesterdayByRepoFromDay = byDay[yesterdayDate] ?? {};
  const yesterdayByRepo =
    Object.keys(yesterdayByRepoFromBlock).length > 0
      ? yesterdayByRepoFromBlock
      : yesterdayByRepoFromDay;
  const yesterdayLinesStored = asNumber(
    yesterday.lines ?? yesterday.total,
    sumAdditions(yesterdayByRepo),
  );

  return {
    username: typeof r.username === "string" ? r.username : "",
    generated:
      typeof r.generated === "string" ? r.generated : new Date().toISOString(),
    today: {
      date: todayDate,
      lines: todayLines,
      net: asNumber(today.net, netFromRepos(todayByRepo)),
      commits: asNumber(today.commits),
      prs: asNumber(today.prs),
      byRepo: todayByRepo,
    },
    yesterday: {
      date: yesterdayDate,
      lines: yesterdayLinesStored,
      net: asNumber(yesterday.net, netFromRepos(yesterdayByRepo)),
      commits: asNumber(yesterday.commits),
      prs: asNumber(yesterday.prs),
      byRepo: yesterdayByRepo,
    },
    week: {
      lines: weekLines,
      net: asNumber(week.net, netFromRepos(weekByRepo)),
      commits: asNumber(week.commits),
      prs: asNumber(week.prs),
      byRepo: weekByRepo,
    },
    byDay,
  };
}

export async function saveUser(user: StoredUser) {
  if (!hasKv()) return;
  await kv.set(`user:${user.username}`, user);
}

export async function getUser(username: string) {
  if (!hasKv()) return null;
  return (await kv.get<StoredUser>(`user:${username}`)) ?? null;
}

export async function saveStats(stats: StatsPayload) {
  if (!hasKv()) return;
  await kv.set(`stats:${stats.username}`, stats);
}

export async function getStats(username: string) {
  if (!hasKv()) return null;
  const raw = await kv.get(`stats:${username}`);
  return raw ? normalizeStats(raw) : null;
}

export async function getAllStats() {
  if (!hasKv()) return [];

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
