import { kv } from "@vercel/kv";
import { decryptToken, encryptToken, isEncryptedToken } from "@/lib/crypto";
import { addStatsDays, statsDate } from "@/lib/stats-date";
import type {
  RepoLineStats,
  RepoStats,
  StatsPayload,
  StoredUser,
} from "@/lib/types";

const LATEST_STATS_GENERATED_KEY = "stats:latest-generated";
const COMMIT_STATS_TTL_SECONDS = 60 * 60 * 24 * 30;
const TOKEN_AUDIT_TTL_SECONDS = 60 * 60 * 24 * 90;

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

function cloneUser(user: StoredUser): StoredUser {
  return {
    ...user,
    oauth: user.oauth ? { ...user.oauth } : undefined,
  };
}

function encryptUserForStorage(user: StoredUser): StoredUser {
  const encrypted = cloneUser(user);
  if (encrypted.token) encrypted.token = encryptToken(encrypted.token);
  if (encrypted.accessToken) {
    encrypted.accessToken = encryptToken(encrypted.accessToken);
  }
  if (encrypted.refreshToken) {
    encrypted.refreshToken = encryptToken(encrypted.refreshToken);
  }
  if (encrypted.oauth?.accessToken) {
    encrypted.oauth.accessToken = encryptToken(encrypted.oauth.accessToken);
  }
  if (encrypted.oauth?.refreshToken) {
    encrypted.oauth.refreshToken = encryptToken(encrypted.oauth.refreshToken);
  }
  return encrypted;
}

function decryptTokenField(
  value: string | undefined,
): { value: string | undefined; migrated: boolean } {
  if (!value) return { value, migrated: false };
  return decryptToken(value);
}

export function decryptUserFromStorage(raw: StoredUser): {
  user: StoredUser;
  migrated: boolean;
} {
  const user = cloneUser(raw);
  let migrated = false;

  const token = decryptTokenField(user.token);
  user.token = token.value;
  migrated ||= token.migrated;

  const accessToken = decryptTokenField(user.accessToken);
  user.accessToken = accessToken.value;
  migrated ||= accessToken.migrated;

  const refreshToken = decryptTokenField(user.refreshToken);
  user.refreshToken = refreshToken.value;
  migrated ||= refreshToken.migrated;

  if (user.oauth) {
    const oauthAccessToken = decryptTokenField(user.oauth.accessToken);
    user.oauth.accessToken = oauthAccessToken.value ?? user.oauth.accessToken;
    migrated ||= oauthAccessToken.migrated;

    const oauthRefreshToken = decryptTokenField(user.oauth.refreshToken);
    user.oauth.refreshToken = oauthRefreshToken.value;
    migrated ||= oauthRefreshToken.migrated;
  }

  return { user, migrated };
}

function tokenFields(user: StoredUser) {
  const fields: string[] = [];
  if (user.token) fields.push("token");
  if (user.accessToken) fields.push("accessToken");
  if (user.refreshToken) fields.push("refreshToken");
  if (user.oauth?.accessToken) fields.push("oauth.accessToken");
  if (user.oauth?.refreshToken) fields.push("oauth.refreshToken");
  return fields;
}

async function auditTokenRead(user: StoredUser, fields: string[]) {
  if (!fields.length || !hasKv()) return;
  const date = new Date().toISOString().slice(0, 10);
  const key = `audit:token-reads:${date}`;

  try {
    await kv.lpush(
      key,
      JSON.stringify({
        username: user.username,
        fields,
        readAt: new Date().toISOString(),
      }),
    );
    await kv.expire(key, TOKEN_AUDIT_TTL_SECONDS);
  } catch (error) {
    console.warn("Token read audit failed", error);
  }
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

function normalizePeriod(
  raw: Record<string, unknown>,
  fallbackByRepo: RepoStats,
) {
  const byRepoFromBlock = asRepoStats(raw.byRepo);
  const byRepo =
    Object.keys(byRepoFromBlock).length > 0 ? byRepoFromBlock : fallbackByRepo;

  return {
    lines: asNumber(raw.lines ?? raw.total, sumAdditions(byRepo)),
    net: asNumber(raw.net, netFromRepos(byRepo)),
    commits: asNumber(raw.commits),
    prs: asNumber(raw.prs),
    byRepo,
  };
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
  return addStatsDays(isoDate, -1);
}

function validTimestamp(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? value : null;
}

function asLineStats(value: unknown) {
  const record = asRecord(value);
  const additions = asNumber(record.additions, -1);
  const deletions = asNumber(record.deletions, -1);

  return additions >= 0 && deletions >= 0 ? { additions, deletions } : null;
}

function commitStatsKey(repoFullName: string, sha: string) {
  return `commit-stats:${encodeURIComponent(repoFullName)}:${sha}`;
}

export function normalizeStats(raw: unknown, now = new Date()): StatsPayload {
  const r = asRecord(raw);
  const today = asRecord(r.today);
  const yesterday = asRecord(r.yesterday);
  const week = asRecord(r.week);
  const weekByRepo = asRepoStats(week.byRepo);
  const weekLines = asNumber(week.lines ?? week.total);
  const currentDate = statsDate(now);
  const currentYesterdayDate = dayBefore(currentDate);

  const todayDate = safeIsoDate(today.date, currentDate);
  const yesterdayDate = safeIsoDate(yesterday.date, dayBefore(todayDate));

  const byDay: StatsPayload["byDay"] =
    r.byDay && typeof r.byDay === "object"
      ? (r.byDay as StatsPayload["byDay"])
      : {};
  const byDayCommits: StatsPayload["byDayCommits"] =
    r.byDayCommits && typeof r.byDayCommits === "object"
      ? (r.byDayCommits as StatsPayload["byDayCommits"])
      : {};

  const storedToday = normalizePeriod(today, byDay[todayDate] ?? {});
  const storedYesterday = normalizePeriod(
    yesterday,
    byDay[yesterdayDate] ?? {},
  );

  let normalizedTodayDate = todayDate;
  let normalizedToday = storedToday;
  let normalizedYesterdayDate = yesterdayDate;
  let normalizedYesterday = storedYesterday;

  if (todayDate < currentDate) {
    normalizedTodayDate = currentDate;
    normalizedToday = normalizePeriod({}, byDay[currentDate] ?? {});
    normalizedYesterdayDate = currentYesterdayDate;

    if (todayDate === currentYesterdayDate) {
      normalizedYesterday = storedToday;
    } else if (yesterdayDate === currentYesterdayDate) {
      normalizedYesterday = storedYesterday;
    } else {
      normalizedYesterday = normalizePeriod(
        {},
        byDay[currentYesterdayDate] ?? {},
      );
    }
  }

  return {
    username: typeof r.username === "string" ? r.username : "",
    generated: typeof r.generated === "string" ? r.generated : now.toISOString(),
    today: {
      date: normalizedTodayDate,
      ...normalizedToday,
    },
    yesterday: {
      date: normalizedYesterdayDate,
      ...normalizedYesterday,
    },
    week: {
      lines: weekLines,
      net: asNumber(week.net, netFromRepos(weekByRepo)),
      commits: asNumber(week.commits),
      prs: asNumber(week.prs),
      byRepo: weekByRepo,
    },
    byDay,
    byDayCommits,
  };
}

export async function saveUser(user: StoredUser) {
  if (!hasKv()) return;
  await kv.set(`user:${user.username}`, encryptUserForStorage(user));
}

export async function getUser(username: string) {
  if (!hasKv()) return null;
  const raw = await kv.get<StoredUser>(`user:${username}`);
  if (!raw) return null;

  const { user, migrated } = decryptUserFromStorage(raw);
  await auditTokenRead(user, tokenFields(user));
  if (migrated) await saveUser(user);
  return user;
}

export async function saveStats(stats: StatsPayload) {
  if (!hasKv()) return;
  await Promise.all([
    kv.set(`stats:${stats.username}`, stats),
    kv.set(LATEST_STATS_GENERATED_KEY, new Date().toISOString()),
  ]);
}

export async function getStats(username: string) {
  if (!hasKv()) return null;
  const raw = await kv.get(`stats:${username}`);
  return raw ? normalizeStats(raw) : null;
}

export async function getAllStats() {
  if (!hasKv()) return [];

  const keys: string[] = [];

  for await (const key of kv.scanIterator({ match: "stats:*", count: 100 })) {
    if (key === LATEST_STATS_GENERATED_KEY) continue;
    keys.push(key);
  }

  const values = await Promise.all(keys.map((key) => kv.get(key)));
  return values.flatMap((value) => (value ? [normalizeStats(value)] : []));
}

export async function getLatestStatsGenerated() {
  if (!hasKv()) return null;

  const cached = validTimestamp(await kv.get(LATEST_STATS_GENERATED_KEY));
  if (cached) return cached;

  let latest: string | null = null;
  let latestTime = 0;

  for await (const key of kv.scanIterator({ match: "stats:*", count: 100 })) {
    if (key === LATEST_STATS_GENERATED_KEY) continue;
    const value = asRecord(await kv.get(key));
    const generated = validTimestamp(value.generated);
    if (!generated) continue;

    const time = new Date(generated).getTime();
    if (time <= latestTime) continue;

    latest = generated;
    latestTime = time;
  }

  return latest;
}

export async function getCachedCommitStats(repoFullName: string, sha: string) {
  if (!hasKv()) return null;
  return asLineStats(await kv.get(commitStatsKey(repoFullName, sha)));
}

export async function saveCachedCommitStats(
  repoFullName: string,
  sha: string,
  stats: RepoLineStats,
) {
  if (!hasKv()) return;
  await kv.set(commitStatsKey(repoFullName, sha), stats, {
    ex: COMMIT_STATS_TTL_SECONDS,
  });
}

export async function getAllUsers() {
  if (!hasKv()) return [];

  const keys: string[] = [];

  for await (const key of kv.scanIterator({ match: "user:*", count: 100 })) {
    keys.push(key);
  }

  const values = await Promise.all(keys.map((key) => kv.get<StoredUser>(key)));
  const users = await Promise.all(
    values.flatMap((value) => {
      if (!value) return [];
      const { user, migrated } = decryptUserFromStorage(value);
      return [
        (async () => {
          await auditTokenRead(user, tokenFields(user));
          if (migrated) await saveUser(user);
          return user;
        })(),
      ];
    }),
  );

  return users;
}

export function mergeByDayStats({
  existing,
  fresh,
  today,
  keepDays = 30,
}: {
  existing: StatsPayload["byDay"];
  fresh: StatsPayload["byDay"];
  today: string;
  keepDays?: number;
}) {
  const cutoff = addStatsDays(today, -(keepDays - 1));
  const merged: StatsPayload["byDay"] = {};

  for (const [date, repos] of Object.entries({ ...existing, ...fresh })) {
    if (date >= cutoff && date <= today) merged[date] = repos;
  }

  return merged;
}

export function mergeByDayCommits({
  existing,
  fresh,
  today,
  keepDays = 30,
}: {
  existing: Record<string, number>;
  fresh: Record<string, number>;
  today: string;
  keepDays?: number;
}) {
  const cutoff = addStatsDays(today, -(keepDays - 1));
  const merged: Record<string, number> = {};

  for (const [date, count] of Object.entries({ ...existing, ...fresh })) {
    if (date >= cutoff && date <= today) merged[date] = count;
  }

  return merged;
}

export function isStoredTokenEncrypted(value: string): boolean {
  return isEncryptedToken(value);
}
