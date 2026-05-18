import { statsDate } from "@/lib/stats-date";
import type { StoredUser } from "@/lib/types";

type GitHubTokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
};

type TokenValues = {
  accessToken?: string;
  refreshToken?: string;
  accessTokenExpiresAt?: number;
  refreshTokenExpiresAt?: number;
};

export type TokenSource = "oauth" | "app";

export type RefreshSlot = {
  source: TokenSource;
  clientIdEnv: "AUTH_GITHUB_ID" | "AUTH_GITHUB_FULL_ID";
  clientSecretEnv: "AUTH_GITHUB_SECRET" | "AUTH_GITHUB_FULL_SECRET";
  read(user: StoredUser): TokenValues;
  write(user: StoredUser, values: TokenValues): StoredUser;
};

export const githubAppSlot: RefreshSlot = {
  source: "app",
  clientIdEnv: "AUTH_GITHUB_ID",
  clientSecretEnv: "AUTH_GITHUB_SECRET",
  read(user) {
    return {
      accessToken: user.accessToken ?? user.token,
      refreshToken: user.refreshToken,
      accessTokenExpiresAt: user.accessTokenExpiresAt,
      refreshTokenExpiresAt: user.refreshTokenExpiresAt,
    };
  },
  write(user, values) {
    return {
      ...user,
      token: values.accessToken ?? user.token,
      accessToken: values.accessToken ?? user.accessToken,
      accessTokenExpiresAt:
        values.accessTokenExpiresAt ?? user.accessTokenExpiresAt,
      refreshToken: values.refreshToken ?? user.refreshToken,
      refreshTokenExpiresAt:
        values.refreshTokenExpiresAt ?? user.refreshTokenExpiresAt,
    };
  },
};

export const oauthSlot: RefreshSlot = {
  source: "oauth",
  clientIdEnv: "AUTH_GITHUB_FULL_ID",
  clientSecretEnv: "AUTH_GITHUB_FULL_SECRET",
  read(user) {
    return {
      accessToken: user.oauth?.accessToken,
      refreshToken: user.oauth?.refreshToken,
      accessTokenExpiresAt: user.oauth?.accessTokenExpiresAt,
      refreshTokenExpiresAt: user.oauth?.refreshTokenExpiresAt,
    };
  },
  write(user, values) {
    if (!user.oauth) return user;
    return {
      ...user,
      oauth: {
        ...user.oauth,
        accessToken: values.accessToken ?? user.oauth.accessToken,
        accessTokenExpiresAt:
          values.accessTokenExpiresAt ?? user.oauth.accessTokenExpiresAt,
        refreshToken: values.refreshToken ?? user.oauth.refreshToken,
        refreshTokenExpiresAt:
          values.refreshTokenExpiresAt ?? user.oauth.refreshTokenExpiresAt,
      },
    };
  },
};

function needsRefresh(values: TokenValues) {
  const expiresAt = values.accessTokenExpiresAt;
  if (!expiresAt || !values.refreshToken) return false;
  return Date.now() >= (expiresAt - 60) * 1000;
}

export async function refreshIfNeeded(user: StoredUser, slot: RefreshSlot) {
  const values = slot.read(user);
  if (!needsRefresh(values)) {
    return {
      user,
      token: values.accessToken ?? null,
      refreshed: false,
      refreshFailed: false,
    };
  }

  const clientId = process.env[slot.clientIdEnv];
  const clientSecret = process.env[slot.clientSecretEnv];
  if (!clientId || !clientSecret || !values.refreshToken) {
    return {
      user,
      token: values.accessToken ?? null,
      refreshed: false,
      refreshFailed: false,
    };
  }

  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: values.refreshToken,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    return {
      user,
      token: values.accessToken ?? null,
      refreshed: false,
      refreshFailed: true,
    };
  }

  const body = (await response.json()) as GitHubTokenResponse;
  const accessToken = body.access_token ?? values.accessToken;
  const now = Math.floor(Date.now() / 1000);
  const updated = slot.write(user, {
    accessToken,
    accessTokenExpiresAt: body.expires_in
      ? now + body.expires_in
      : values.accessTokenExpiresAt,
    refreshToken: body.refresh_token ?? values.refreshToken,
    refreshTokenExpiresAt: body.refresh_token_expires_in
      ? now + body.refresh_token_expires_in
      : values.refreshTokenExpiresAt,
  });

  return {
    user: updated,
    token: accessToken ?? null,
    refreshed: true,
    refreshFailed: false,
  };
}

export async function getUsableGitHubToken(user: StoredUser) {
  return refreshIfNeeded(user, githubAppSlot);
}

export async function getUsableOauthToken(user: StoredUser) {
  return refreshIfNeeded(user, oauthSlot);
}

export type SearchTokenResult = {
  token: string | null;
  source: TokenSource;
  user: StoredUser;
  oauthCleared: boolean;
};

export async function getSearchToken(user: StoredUser): Promise<SearchTokenResult> {
  const app = async (updatedUser = user, oauthCleared = false) => {
    const result = await getUsableGitHubToken(updatedUser);
    return {
      token: result.token,
      source: "app" as const,
      user: result.user,
      oauthCleared,
    };
  };

  /*
   * Search token state table:
   * - no oauth: use GitHub App token.
   * - revoked: use GitHub App token.
   * - valid: use OAuth token.
   * - expired-refresh-ok: use refreshed OAuth token and return updated user.
   * - expired-refresh-fail: mark oauth.revokedAt, fall back to App, persist via caller.
   */
  if (!user.oauth?.accessToken) return app();
  if (user.oauth.revokedAt) return app();

  const result = await getUsableOauthToken(user);
  if (result.token && !result.refreshFailed) {
    return {
      token: result.token,
      source: "oauth",
      user: result.user,
      oauthCleared: false,
    };
  }

  const revokedUser: StoredUser = {
    ...result.user,
    byDayInvalidUntil: statsDate(),
    oauth: result.user.oauth
      ? { ...result.user.oauth, revokedAt: new Date().toISOString() }
      : result.user.oauth,
  };

  return app(revokedUser, true);
}

export type GitHubFailureClassification =
  | "revoked"
  | "policy-blocked"
  | "secondary-rate-limit"
  | "transient"
  | "unknown";

export class GitHubApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: string,
    public retryAfter?: string | null,
  ) {
    super(message);
    this.name = "GitHubApiError";
  }
}

export function classifyGitHubFailure(
  error: unknown,
): GitHubFailureClassification {
  if (!(error instanceof GitHubApiError)) return "transient";

  const body = error.body.toLowerCase();
  if (error.status === 401 && body.includes("bad credentials")) {
    return "revoked";
  }

  if (error.status === 403) {
    if (
      body.includes("saml") ||
      body.includes("sso") ||
      body.includes("org-policy") ||
      body.includes("organization policy") ||
      body.includes("resource not accessible")
    ) {
      return "policy-blocked";
    }

    if (
      body.includes("abuse") ||
      body.includes("secondary rate") ||
      body.includes("secondary-rate")
    ) {
      return "secondary-rate-limit";
    }
  }

  if (error.status >= 500) return "transient";
  return "unknown";
}
