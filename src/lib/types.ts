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
  byDayCommits?: Record<string, number>;
};

export type OAuthTokenGrant = {
  accessToken: string;
  refreshToken?: string;
  accessTokenExpiresAt?: number;
  refreshTokenExpiresAt?: number;
  grantedAt: string;
  revokedAt?: string;
  scope?: string;
};

export type StoredUser = {
  username: string;
  githubUserId?: number;
  token?: string;
  accessToken?: string;
  accessTokenExpiresAt?: number;
  refreshToken?: string;
  refreshTokenExpiresAt?: number;
  tokenKind?: "oauth" | "github-app";
  oauth?: OAuthTokenGrant;
  byDayInvalidUntil?: string;
  byDayTokenSource?: "oauth" | "app";
  registeredAt: string;
  name?: string | null;
  image?: string | null;
};
