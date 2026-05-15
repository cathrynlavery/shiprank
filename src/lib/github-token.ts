import type { StoredUser } from "@/lib/types";

type GitHubTokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
};

function needsRefresh(user: StoredUser) {
  const expiresAt = user.accessTokenExpiresAt;
  if (!expiresAt || !user.refreshToken) return false;
  return Date.now() >= (expiresAt - 60) * 1000;
}

export async function getUsableGitHubToken(user: StoredUser) {
  if (!needsRefresh(user)) {
    return { user, token: user.accessToken ?? user.token };
  }

  const refreshToken = user.refreshToken;
  const clientId = process.env.AUTH_GITHUB_ID;
  const clientSecret = process.env.AUTH_GITHUB_SECRET;
  if (!clientId || !clientSecret || !refreshToken) {
    return { user, token: user.accessToken ?? user.token };
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
      refresh_token: refreshToken,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    return { user, token: user.accessToken ?? user.token };
  }

  const body = (await response.json()) as GitHubTokenResponse;
  const accessToken = body.access_token ?? user.accessToken ?? user.token;
  const updated: StoredUser = {
    ...user,
    token: accessToken,
    accessToken,
    accessTokenExpiresAt: body.expires_in
      ? Math.floor(Date.now() / 1000) + body.expires_in
      : user.accessTokenExpiresAt,
    refreshToken: body.refresh_token ?? user.refreshToken,
    refreshTokenExpiresAt: body.refresh_token_expires_in
      ? Math.floor(Date.now() / 1000) + body.refresh_token_expires_in
      : user.refreshTokenExpiresAt,
  };

  return { user: updated, token: accessToken };
}
