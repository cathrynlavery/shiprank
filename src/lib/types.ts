export type RepoLineStats = {
  additions: number;
  deletions: number;
  private?: boolean;
};

export type RepoStats = Record<string, RepoLineStats>;

export type StatsPayload = {
  username: string;
  generated: string;
  today: {
    date: string;
    total: number;
    byRepo: RepoStats;
  };
  week: {
    total: number;
    byRepo: RepoStats;
  };
  byDay: Record<string, RepoStats>;
};

export type StoredUser = {
  username: string;
  token: string;
  registeredAt: string;
  name?: string | null;
  image?: string | null;
};
