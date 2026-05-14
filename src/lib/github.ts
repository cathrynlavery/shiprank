import type { RepoLineStats, RepoStats, StatsPayload } from "@/lib/types";

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

function totalAdditions(repos: RepoStats) {
  return Object.values(repos).reduce((sum, stats) => sum + stats.additions, 0);
}

function addStats(
  repos: RepoStats,
  repoFullName: string,
  stats: RepoLineStats,
  isPrivate: boolean,
) {
  repos[repoFullName] ??= {
    additions: 0,
    deletions: 0,
    private: isPrivate,
  };
  repos[repoFullName].additions += stats.additions;
  repos[repoFullName].deletions += stats.deletions;
  repos[repoFullName].private = isPrivate;
}

export async function refreshUserStats(username: string, token: string) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const weekAgoISO = new Date(
    now.getTime() - 7 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const byDay: StatsPayload["byDay"] = {};
  const recentRepos = await getRecentRepos(token, weekAgoISO);

  for (const repo of recentRepos) {
    const commits = await getCommits(token, repo.full_name, username, weekAgoISO);

    for (const commit of commits) {
      const date = commit.commit.author?.date?.slice(0, 10);
      if (!date) continue;

      byDay[date] ??= {};
      const stats = await getCommitStats(token, repo.full_name, commit.sha);
      addStats(byDay[date], repo.full_name, stats, repo.private);
    }
  }

  const weekByRepo: RepoStats = {};

  for (const repos of Object.values(byDay)) {
    for (const [repoFullName, stats] of Object.entries(repos)) {
      addStats(weekByRepo, repoFullName, stats, stats.private ?? false);
    }
  }

  const todayByRepo = byDay[today] ?? {};

  return {
    username,
    generated: now.toISOString(),
    today: {
      date: today,
      total: totalAdditions(todayByRepo),
      byRepo: todayByRepo,
    },
    week: {
      total: totalAdditions(weekByRepo),
      byRepo: weekByRepo,
    },
    byDay,
  } satisfies StatsPayload;
}
