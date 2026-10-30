import { kv } from "@vercel/kv";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { decryptToken, encryptToken, isEncryptedToken } from "@/lib/crypto";
import {
  addStatsDays,
  SHIPRANK_START_DATE,
  statsDate,
} from "@/lib/stats-date";
import type {
  RepoLineStats,
  RepoStats,
  StatsPayload,
  StoredUser,
} from "@/lib/types";

const LATEST_STATS_GENERATED_KEY = "stats:latest-generated";
const COMMIT_STATS_TTL_SECONDS = 60 * 60 * 24 * 30;
const TOKEN_AUDIT_TTL_SECONDS = 60 * 60 * 24 * 90;
type LocalStore = {
  values: Record<string, unknown>;
};
let localWriteQueue = Promise.resolve();

function hasKv() {
  if (process.env.SHIPRANK_USE_LOCAL_STORE === "1") return false;
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

function hasLocalStore() {
  return (
    !hasKv() &&
    (process.env.NODE_ENV === "development" ||
      process.env.SHIPRANK_USE_LOCAL_STORE === "1")
  );
}

export function isLocalStoreEnabled() {
  return hasLocalStore();
}

function localStorePath() {
  const dir = process.env.SHIPRANK_LOCAL_STORE_DIR;
  if (dir) return join(dir, "shiprank-store.json");
  return join(process.cwd(), ".local-data", "shiprank-store.json");
}

async function readLocalStore(): Promise<LocalStore> {
  try {
    const content = await readFile(localStorePath(), "utf8");
    const parsed = JSON.parse(content) as LocalStore;
    return parsed && typeof parsed === "object" && parsed.values
      ? parsed
      : { values: {} };
  } catch {
    return { values: {} };
  }
}

async function writeLocalStore(store: LocalStore) {
  const path = localStorePath();
  const tmpPath = `${path}.${process.pid}.tmp`;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(tmpPath, JSON.stringify(store, null, 2));
  await rename(tmpPath, path);
}

async function waitForLocalWrites() {
  try {
    await localWriteQueue;
  } catch {
    // The original caller receives the write failure; later reads should still proceed.
  }
}

async function updateLocalStore(
  update: (store: LocalStore) => void,
): Promise<void> {
  const nextWrite = localWriteQueue.then(async () => {
    const store = await readLocalStore();
    update(store);
    await writeLocalStore(store);
  });
  localWriteQueue = nextWrite.catch(() => undefined);
  await nextWrite;
}

async function localGet<T>(key: string): Promise<T | null> {
  if (!hasLocalStore()) return null;
  await waitForLocalWrites();
  const store = await readLocalStore();
  return (store.values[key] as T | undefined) ?? null;
}

async function localSet(key: string, value: unknown) {
  if (!hasLocalStore()) return;
  await updateLocalStore((store) => {
    store.values[key] = value;
  });
}

async function localKeys(prefix: string) {
  if (!hasLocalStore()) return [];
  await waitForLocalWrites();
  const store = await readLocalStore();
  return Object.keys(store.values).filter((key) => key.startsWith(prefix));
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

function retentionCutoff({
  today,
  keepDays,
  keepFromDate = SHIPRANK_START_DATE,
}: {
  today: string;
  keepDays?: number;
  keepFromDate?: string;
}) {
  if (!keepDays) return keepFromDate;

  const dayCutoff = addStatsDays(today, -(keepDays - 1));
  return dayCutoff > keepFromDate ? dayCutoff : keepFromDate;
}

function rollupReposSince(byDay: StatsPayload["byDay"], startDate: string) {
  const rolledUp: RepoStats = {};

  for (const [date, repos] of Object.entries(byDay)) {
    if (date < startDate) continue;
    for (const [repoFullName, stats] of Object.entries(repos)) {
      rolledUp[repoFullName] ??= {
        additions: 0,
        deletions: 0,
        private: stats.private,
      };
      rolledUp[repoFullName].additions += stats.additions;
      rolledUp[repoFullName].deletions += stats.deletions;
      rolledUp[repoFullName].private = stats.private;
    }
  }

  return rolledUp;
}

function sumCommitsSince(
  byDayCommits: Record<string, number>,
  startDate: string,
) {
  return Object.entries(byDayCommits).reduce(
    (sum, [date, count]) => (date >= startDate ? sum + count : sum),
    0,
  );
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

function prCountKey(username: string, tokenSource: string, query: string) {
  return `pr-count:${encodeURIComponent(username)}:${tokenSource}:${encodeURIComponent(query)}`;
}

export function normalizeStats(raw: unknown, now = new Date()): StatsPayload {
  const r = asRecord(raw);
  const today = asRecord(r.today);
  const yesterday = asRecord(r.yesterday);
  const week = asRecord(r.week);
  const weekByRepo = asRepoStats(week.byRepo);
  const weekLines = asNumber(week.lines ?? week.total);
  const total = asRecord(r.total);
  const currentDate = statsDate(now);
  const currentYesterdayDate = dayBefore(currentDate);

  const todayDate = safeIsoDate(today.date, currentDate);
  const yesterdayDate = safeIsoDate(yesterday.date, dayBefore(todayDate));

  const byDay: StatsPayload["byDay"] =
    r.byDay && typeof r.byDay === "object"
      ? (r.byDay as StatsPayload["byDay"])
      : {};
  const byDayCommits: Record<string, number> =
    r.byDayCommits && typeof r.byDayCommits === "object"
      ? (r.byDayCommits as Record<string, number>)
      : {};

  const storedToday = normalizePeriod(today, byDay[todayDate] ?? {});
  const storedYesterday = normalizePeriod(
    yesterday,
    byDay[yesterdayDate] ?? {},
  );
  const totalByRepoFallback = rollupReposSince(byDay, SHIPRANK_START_DATE);
  const normalizedTotal = normalizePeriod(total, totalByRepoFallback);

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
    total: {
      ...normalizedTotal,
      commits: asNumber(
        total.commits,
        sumCommitsSince(byDayCommits, SHIPRANK_START_DATE),
      ),
    },
    byDay,
    byDayCommits,
  };
}

export async function saveUser(user: StoredUser) {
  if (hasLocalStore()) {
    await localSet(`user:${user.username}`, encryptUserForStorage(user));
    return;
  }
  if (!hasKv()) return;
  await kv.set(`user:${user.username}`, encryptUserForStorage(user));
}

export async function getUser(username: string) {
  const raw = hasLocalStore()
    ? await localGet<StoredUser>(`user:${username}`)
    : hasKv()
      ? await kv.get<StoredUser>(`user:${username}`)
      : null;
  if (!raw) return null;

  const { user, migrated } = decryptUserFromStorage(raw);
  await auditTokenRead(user, tokenFields(user));
  if (migrated) await saveUser(user);
  return user;
}

export async function saveStats(stats: StatsPayload) {
  if (hasLocalStore()) {
    await Promise.all([
      localSet(`stats:${stats.username}`, stats),
      localSet(LATEST_STATS_GENERATED_KEY, new Date().toISOString()),
    ]);
    return;
  }
  if (!hasKv()) return;
  await Promise.all([
    kv.set(`stats:${stats.username}`, stats),
    kv.set(LATEST_STATS_GENERATED_KEY, new Date().toISOString()),
  ]);
}

export async function getStats(username: string) {
  const raw = hasLocalStore()
    ? await localGet(`stats:${username}`)
    : hasKv()
      ? await kv.get(`stats:${username}`)
      : null;
  return raw ? normalizeStats(raw) : null;
}

export async function getAllStats() {
  if (hasLocalStore()) {
    const keys = await localKeys("stats:");
    const values = await Promise.all(
      keys
        .filter((key) => key !== LATEST_STATS_GENERATED_KEY)
        .map((key) => localGet(key)),
    );
    return values.flatMap((value) => (value ? [normalizeStats(value)] : []));
  }

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
  if (hasLocalStore()) {
    const cached = validTimestamp(await localGet(LATEST_STATS_GENERATED_KEY));
    if (cached) return cached;

    const keys = await localKeys("stats:");
    const values = await Promise.all(
      keys
        .filter((key) => key !== LATEST_STATS_GENERATED_KEY)
        .map((key) => localGet(key)),
    );
    let latest: string | null = null;
    let latestTime = 0;

    for (const value of values) {
      const generated = validTimestamp(asRecord(value).generated);
      if (!generated) continue;

      const time = new Date(generated).getTime();
      if (time <= latestTime) continue;

      latest = generated;
      latestTime = time;
    }

    return latest;
  }

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

const REFRESH_LOCK_TTL_SECONDS = 300;

function refreshLockKey(username: string) {
  return `refresh-lock:${username}`;
}

// One refresh per user at a time: overlapping full rebuilds trip GitHub's
// secondary rate limit. TTL matches the refresh route's maxDuration.
export async function acquireRefreshLock(username: string) {
  if (hasLocalStore()) {
    const until = await localGet<number>(refreshLockKey(username));
    if (until && until > Date.now()) return false;
    await localSet(
      refreshLockKey(username),
      Date.now() + REFRESH_LOCK_TTL_SECONDS * 1000,
    );
    return true;
  }
  if (!hasKv()) return true;
  const result = await kv.set(refreshLockKey(username), "1", {
    nx: true,
    ex: REFRESH_LOCK_TTL_SECONDS,
  });
  return result === "OK";
}

export async function releaseRefreshLock(username: string) {
  if (hasLocalStore()) {
    await localSet(refreshLockKey(username), 0);
    return;
  }
  if (!hasKv()) return;
  await kv.del(refreshLockKey(username));
}

export async function getCachedCommitStats(repoFullName: string, sha: string) {
  if (hasLocalStore()) {
    return asLineStats(await localGet(commitStatsKey(repoFullName, sha)));
  }
  if (!hasKv()) return null;
  return asLineStats(await kv.get(commitStatsKey(repoFullName, sha)));
}

export async function saveCachedCommitStats(
  repoFullName: string,
  sha: string,
  stats: RepoLineStats,
) {
  if (hasLocalStore()) {
    await localSet(commitStatsKey(repoFullName, sha), stats);
    return;
  }
  if (!hasKv()) return;
  await kv.set(commitStatsKey(repoFullName, sha), stats, {
    ex: COMMIT_STATS_TTL_SECONDS,
  });
}

export async function getCachedPrCount(
  username: string,
  tokenSource: string,
  query: string,
) {
  if (!hasKv()) return null;
  const count = asNumber(
    await kv.get(prCountKey(username, tokenSource, query)),
    -1,
  );
  return count >= 0 ? count : null;
}

export async function saveCachedPrCount(
  username: string,
  tokenSource: string,
  query: string,
  count: number,
  ttlSeconds: number,
) {
  if (!hasKv()) return;
  await kv.set(prCountKey(username, tokenSource, query), count, {
    ex: ttlSeconds,
  });
}

export async function getAllUsers() {
  if (hasLocalStore()) {
    const keys = await localKeys("user:");
    const values = await Promise.all(
      keys.map((key) => localGet<StoredUser>(key)),
    );
    return Promise.all(
      values.flatMap((value) => {
        if (!value) return [];
        const { user, migrated } = decryptUserFromStorage(value);
        return [
          (async () => {
            if (migrated) await saveUser(user);
            return user;
          })(),
        ];
      }),
    );
  }

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
  keepDays,
  keepFromDate = SHIPRANK_START_DATE,
}: {
  existing: StatsPayload["byDay"];
  fresh: StatsPayload["byDay"];
  today: string;
  keepDays?: number;
  keepFromDate?: string;
}) {
  const cutoff = retentionCutoff({ today, keepDays, keepFromDate });
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
  keepDays,
  keepFromDate = SHIPRANK_START_DATE,
}: {
  existing: Record<string, number>;
  fresh: Record<string, number>;
  today: string;
  keepDays?: number;
  keepFromDate?: string;
}) {
  const cutoff = retentionCutoff({ today, keepDays, keepFromDate });
  const merged: Record<string, number> = {};

  for (const [date, count] of Object.entries({ ...existing, ...fresh })) {
    if (date >= cutoff && date <= today) merged[date] = count;
  }

  return merged;
}

export function isStoredTokenEncrypted(value: string): boolean {
  return isEncryptedToken(value);
}
