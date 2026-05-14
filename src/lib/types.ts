export type RepoLineStats = {
  additions: number;
  deletions: number;
  private?: boolean;
};

export type RepoStats = Record<string, RepoLineStats>;

export type PeriodSummary = {
  lines: number;
  net: number;
  commits: number;
  prs: number;
  byRepo: RepoStats;
};

export type StatsPayload = {
  username: string;
  generated: string;
  today: PeriodSummary & { date: string };
  yesterday: PeriodSummary & { date: string };
  week: PeriodSummary;
  byDay: Record<string, RepoStats>;
};

export type StoredUser = {
  username: string;
  token: string;
  registeredAt: string;
  name?: string | null;
  image?: string | null;
};
