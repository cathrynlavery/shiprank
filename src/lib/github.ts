import type {
  PeriodSummary,
  RepoLineStats,
  RepoStats,
  StatsPayload,
} from "@/lib/types";
import { mapWithConcurrency } from "@/lib/concurrency";
import { addStatsDays, statsDate } from "@/lib/stats-date";
import { getCachedCommitStats, saveCachedCommitStats } from "@/lib/store";

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
    throw new Error(`GitHub API ${response.status} for ${path}: ${body}`);
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

export async function refreshUserStats(
  username: string,
  token: string,
): Promise<StatsPayload> {
  const now = new Date();
  const today = statsDate(now);
  const yesterday = addStatsDays(today, -1);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const weekAgoISO = weekAgo.toISOString();
  const weekAgoDate = statsDate(weekAgo);

  const byDay: StatsPayload["byDay"] = {};
  const commitsByDay: Record<string, number> = {};
  const commits = await searchUserCommits(token, username, weekAgoISO);

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

  const weekByRepo: RepoStats = {};
  for (const repos of Object.values(byDay)) {
    for (const [repoFullName, stats] of Object.entries(repos)) {
      addRepoStats(weekByRepo, repoFullName, stats, stats.private ?? false);
    }
  }

  const [prsToday, prsYesterday, prsWeek] = await Promise.all([
    getMergedPrCount(token, username, `merged:${today}`),
    getMergedPrCount(token, username, `merged:${yesterday}`),
    getMergedPrCount(token, username, `merged:>=${weekAgoDate}`),
  ]);

  const todayByRepo = byDay[today] ?? {};
  const yesterdayByRepo = byDay[yesterday] ?? {};
  const todayCommits = commitsByDay[today] ?? 0;
  const yesterdayCommits = commitsByDay[yesterday] ?? 0;
  const weekCommits = Object.values(commitsByDay).reduce(
    (sum, n) => sum + n,
    0,
  );

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

  return {
    username,
    generated: now.toISOString(),
    today: { date: today, ...todaySummary },
    yesterday: { date: yesterday, ...yesterdaySummary },
    week: weekSummary,
    byDay,
  };
}
