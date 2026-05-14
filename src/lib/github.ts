import type {
  PeriodSummary,
  RepoLineStats,
  RepoStats,
  StatsPayload,
} from "@/lib/types";

type GitHubRepo = {
  full_name: string;
  private: boolean;
  pushed_at: string;
};

type GitHubCommit = {
  sha: string;
  commit: {
    author?: {
      date?: string;
    };
  };
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

async function getRecentRepos(token: string, weekAgoISO: string) {
  const repos: GitHubRepo[] = [];

  for (let page = 1; page <= 5; page++) {
    const batch = await githubGet<GitHubRepo[]>(
      `/user/repos?per_page=100&sort=pushed&direction=desc&page=${page}`,
      token,
    );

    if (!batch?.length) break;

    repos.push(...batch);

    const oldest = batch[batch.length - 1];
    if (oldest?.pushed_at && oldest.pushed_at < weekAgoISO) break;
  }

  return repos.filter((repo) => repo.pushed_at >= weekAgoISO);
}

async function getCommits(
  token: string,
  repoFullName: string,
  username: string,
  weekAgoISO: string,
) {
  const commits: GitHubCommit[] = [];
  const author = encodeURIComponent(username);

  for (let page = 1; page <= 3; page++) {
    const batch = await githubGet<GitHubCommit[]>(
      `/repos/${repoFullName}/commits?author=${author}&since=${weekAgoISO}&per_page=100&page=${page}`,
      token,
    );

    if (!batch?.length) break;

    commits.push(...batch);
    if (batch.length < 100) break;
  }

  return commits;
}

async function getCommitStats(
  token: string,
  repoFullName: string,
  sha: string,
): Promise<RepoLineStats> {
  try {
    const detail = await githubGet<GitHubCommitDetail>(
      `/repos/${repoFullName}/commits/${sha}`,
      token,
    );

    return {
      additions: detail?.stats?.additions ?? 0,
      deletions: detail?.stats?.deletions ?? 0,
    };
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
  const today = now.toISOString().slice(0, 10);
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const weekAgoISO = weekAgo.toISOString();
  const weekAgoDate = weekAgoISO.slice(0, 10);

  const byDay: StatsPayload["byDay"] = {};
  const commitsByDay: Record<string, number> = {};
  const recentRepos = await getRecentRepos(token, weekAgoISO);

  for (const repo of recentRepos) {
    const commits = await getCommits(
      token,
      repo.full_name,
      username,
      weekAgoISO,
    );

    for (const commit of commits) {
      const date = commit.commit.author?.date?.slice(0, 10);
      if (!date) continue;

      commitsByDay[date] = (commitsByDay[date] ?? 0) + 1;
      byDay[date] ??= {};
      const stats = await getCommitStats(token, repo.full_name, commit.sha);
      addRepoStats(byDay[date], repo.full_name, stats, repo.private);
    }
  }

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
