import type {
  PeriodSummary,
  RepoLineStats,
  RepoStats,
  StatsPayload,
  StoredUser,
} from "@/lib/types";
import { mapWithConcurrency } from "@/lib/concurrency";
import { addStatsDays, statsDate } from "@/lib/stats-date";
import {
  getCachedCommitStats,
  getStats,
  mergeByDayCommits,
  mergeByDayStats,
  saveCachedCommitStats,
} from "@/lib/store";
import {
  classifyGitHubFailure,
  getSearchToken,
  getUsableGitHubToken,
  GitHubApiError,
  type TokenSource,
} from "@/lib/github-token";

type GitHubCommitSearchItem = {
  sha: string;
  commit: {
    author?: {
      date?: string;
    };
  };
  repository: {
    full_name: string;
    private: boolean;
  };
};

type GitHubCommitSearchResult = {
  items?: GitHubCommitSearchItem[];
};

type GitHubCommitDetail = {
  stats?: {
    additions?: number;
    deletions?: number;
  };
};

type GitHubSearchResult = {
  total_count: number;
};

const GITHUB_API = "https://api.github.com";
const COMMIT_STATS_CONCURRENCY = 8;
const COMMIT_SEARCH_MAX_PAGES = 10;
const INCREMENTAL_SEARCH_DAYS = 3;
const FULL_SEARCH_DAYS = 7;

async function githubGet<T>(path: string, token: string): Promise<T | null> {
  const response = await fetch(`${GITHUB_API}${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "shiprank/0.1",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    cache: "no-store",
  });

  if (response.status === 404) return null;

  if (!response.ok) {
    const body = await response.text();
    throw new GitHubApiError(
      `GitHub API ${response.status} for ${path}: ${body}`,
      response.status,
      body,
      response.headers.get("retry-after"),
    );
  }

  return (await response.json()) as T;
}

async function searchUserCommits(
  token: string,
  username: string,
  weekAgoISO: string,
) {
  const items: GitHubCommitSearchItem[] = [];
  const q = encodeURIComponent(
    `author:${username} author-date:>=${weekAgoISO}`,
  );

  for (let page = 1; page <= COMMIT_SEARCH_MAX_PAGES; page++) {
    const result = await githubGet<GitHubCommitSearchResult>(
      `/search/commits?q=${q}&per_page=100&page=${page}`,
      token,
    );

    const batch = result?.items ?? [];
    if (!batch.length) break;

    items.push(...batch);
    if (batch.length < 100) break;
  }

  return items;
}

async function getCommitStats(
  token: string,
  repoFullName: string,
  sha: string,
): Promise<RepoLineStats> {
  try {
    const cached = await getCachedCommitStats(repoFullName, sha);
    if (cached) return cached;
  } catch (error) {
    console.warn("Commit stats cache read failed", error);
  }

  try {
    const detail = await githubGet<GitHubCommitDetail>(
      `/repos/${repoFullName}/commits/${sha}`,
      token,
    );

    const stats = {
      additions: detail?.stats?.additions ?? 0,
      deletions: detail?.stats?.deletions ?? 0,
    };

    try {
      await saveCachedCommitStats(repoFullName, sha, stats);
    } catch (error) {
      console.warn("Commit stats cache write failed", error);
    }

    return stats;
  } catch {
    return { additions: 0, deletions: 0 };
  }
}

async function getMergedPrCount(
  token: string,
  username: string,
  query: string,
) {
  const q = encodeURIComponent(`author:${username} type:pr is:merged ${query}`);
  const result = await githubGet<GitHubSearchResult>(
    `/search/issues?q=${q}&per_page=1`,
    token,
  );
  return result?.total_count ?? 0;
}

function sumLines(repos: RepoStats) {
  return Object.values(repos).reduce((sum, stats) => sum + stats.additions, 0);
}

function sumNet(repos: RepoStats) {
  return Object.values(repos).reduce(
    (sum, stats) => sum + stats.additions - stats.deletions,
    0,
  );
}

function addRepoStats(
  bucket: RepoStats,
  repoFullName: string,
  stats: RepoLineStats,
  isPrivate: boolean,
) {
  bucket[repoFullName] ??= {
    additions: 0,
    deletions: 0,
    private: isPrivate,
  };
  bucket[repoFullName].additions += stats.additions;
  bucket[repoFullName].deletions += stats.deletions;
  bucket[repoFullName].private = isPrivate;
}

function sumCommitCounts(byDayCommits: Record<string, number>, startDate: string) {
  return Object.entries(byDayCommits).reduce(
    (sum, [date, count]) => (date >= startDate ? sum + count : sum),
    0,
  );
}

function rollupRepos(byDay: StatsPayload["byDay"], startDate: string) {
  const rolledUp: RepoStats = {};
  for (const [date, repos] of Object.entries(byDay)) {
    if (date < startDate) continue;
    for (const [repoFullName, stats] of Object.entries(repos)) {
      addRepoStats(rolledUp, repoFullName, stats, stats.private ?? false);
    }
  }
  return rolledUp;
}

async function collectByDayStats(
  username: string,
  token: string,
  sinceISO: string,
) {
  const byDay: StatsPayload["byDay"] = {};
  const commitsByDay: Record<string, number> = {};
  const commits = await searchUserCommits(token, username, sinceISO);

  await mapWithConcurrency(commits, COMMIT_STATS_CONCURRENCY, async (commit) => {
    const authorDate = commit.commit.author?.date;
    if (!authorDate) return;

    const date = statsDate(new Date(authorDate));
    const repoFullName = commit.repository.full_name;

    commitsByDay[date] = (commitsByDay[date] ?? 0) + 1;
    byDay[date] ??= {};
    const stats = await getCommitStats(token, repoFullName, commit.sha);
    addRepoStats(byDay[date], repoFullName, stats, commit.repository.private);
  });

  return { byDay, commitsByDay };
}

function logOauthFallback(
  username: string,
  classification: ReturnType<typeof classifyGitHubFailure>,
  error: unknown,
) {
  const retryAfter =
    error instanceof GitHubApiError && error.retryAfter
      ? ` retry-after=${error.retryAfter}`
      : "";
  console.warn(
    `OAuth search failed for ${username}; falling back to GitHub App (${classification}).${retryAfter}`,
  );
}

async function runWithSearchToken(
  user: StoredUser,
  sinceISO: string,
): Promise<{
  user: StoredUser;
  token: string;
  source: TokenSource;
  byDay: StatsPayload["byDay"];
  commitsByDay: Record<string, number>;
}> {
  const initial = await getSearchToken(user);
  if (!initial.token) throw new Error(`no usable GitHub token for ${user.username}`);

  try {
    const collected = await collectByDayStats(
      user.username,
      initial.token,
      sinceISO,
    );
    return {
      user: initial.user,
      token: initial.token,
      source: initial.source,
      ...collected,
    };
  } catch (error) {
    if (initial.source !== "oauth") throw error;

    const classification = classifyGitHubFailure(error);
    logOauthFallback(user.username, classification, error);

    const revokedAt =
      classification === "revoked" ? new Date().toISOString() : undefined;
    const userAfterOauthFailure: StoredUser = {
      ...initial.user,
      byDayInvalidUntil:
        classification === "revoked"
          ? statsDate()
          : initial.user.byDayInvalidUntil,
      oauth: initial.user.oauth
        ? { ...initial.user.oauth, revokedAt }
        : initial.user.oauth,
    };
    const app = await getUsableGitHubToken(userAfterOauthFailure);
    if (!app.token) throw error;

    const collected = await collectByDayStats(user.username, app.token, sinceISO);
    return {
      user: app.user,
      token: app.token,
      source: "app",
      ...collected,
    };
  }
}

export async function refreshUserStats(user: StoredUser): Promise<{
  stats: StatsPayload;
  user: StoredUser;
}> {
  const now = new Date();
  const today = statsDate(now);
  const yesterday = addStatsDays(today, -1);

  const existingStats = await getStats(user.username);
  const fullRefresh = Boolean(user.byDayInvalidUntil || !existingStats);
  const searchDays = fullRefresh ? FULL_SEARCH_DAYS : INCREMENTAL_SEARCH_DAYS;
  const searchStartDate = addStatsDays(today, -(searchDays - 1));
  const weekStartDate = addStatsDays(today, -(FULL_SEARCH_DAYS - 1));
  const sinceISO = `${searchStartDate}T00:00:00Z`;

  const collected = await runWithSearchToken(user, sinceISO);
  const sourceChanged = collected.source !== user.byDayTokenSource;
  const replaceCachedDays = fullRefresh && sourceChanged;
  const freshByDay = replaceCachedDays
    ? collected.byDay
    : mergeByDayStats({
        existing: existingStats?.byDay ?? {},
        fresh: collected.byDay,
        today,
      });
  const freshCommitsByDay = replaceCachedDays
    ? collected.commitsByDay
    : mergeByDayCommits({
        existing: existingStats?.byDayCommits ?? {},
        fresh: collected.commitsByDay,
        today,
      });

  const weekByRepo = rollupRepos(freshByDay, weekStartDate);

  const [prsToday, prsYesterday, prsWeek] = await Promise.all([
    getMergedPrCount(collected.token, user.username, `merged:${today}`),
    getMergedPrCount(collected.token, user.username, `merged:${yesterday}`),
    getMergedPrCount(collected.token, user.username, `merged:>=${weekStartDate}`),
  ]);

  const todayByRepo = freshByDay[today] ?? {};
  const yesterdayByRepo = freshByDay[yesterday] ?? {};
  const todayCommits = freshCommitsByDay[today] ?? 0;
  const yesterdayCommits = freshCommitsByDay[yesterday] ?? 0;
  const weekCommits = sumCommitCounts(freshCommitsByDay, weekStartDate);

  const todaySummary: PeriodSummary = {
    lines: sumLines(todayByRepo),
    net: sumNet(todayByRepo),
    commits: todayCommits,
    prs: prsToday,
    byRepo: todayByRepo,
  };

  const yesterdaySummary: PeriodSummary = {
    lines: sumLines(yesterdayByRepo),
    net: sumNet(yesterdayByRepo),
    commits: yesterdayCommits,
    prs: prsYesterday,
    byRepo: yesterdayByRepo,
  };

  const weekSummary: PeriodSummary = {
    lines: sumLines(weekByRepo),
    net: sumNet(weekByRepo),
    commits: weekCommits,
    prs: prsWeek,
    byRepo: weekByRepo,
  };

  const stats = {
    username: user.username,
    generated: now.toISOString(),
    today: { date: today, ...todaySummary },
    yesterday: { date: yesterday, ...yesterdaySummary },
    week: weekSummary,
    byDay: freshByDay,
    byDayCommits: freshCommitsByDay,
  };

  return {
    stats,
    user: {
      ...collected.user,
      byDayTokenSource: collected.source,
      byDayInvalidUntil: undefined,
    },
  };
}
