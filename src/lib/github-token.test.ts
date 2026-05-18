import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  GitHubApiError,
  classifyGitHubFailure,
  getSearchToken,
  githubAppSlot,
  oauthSlot,
  refreshIfNeeded,
} from "@/lib/github-token";
import type { StoredUser } from "@/lib/types";

const now = new Date("2026-05-18T12:00:00.000Z");
const nowSeconds = Math.floor(now.getTime() / 1000);

function user(overrides: Partial<StoredUser> = {}): StoredUser {
  return {
    username: "ada",
    registeredAt: now.toISOString(),
    token: "app-token",
    accessToken: "app-token",
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  }) satisfies Response;
}

describe("refreshIfNeeded", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("does not refresh when the token is not expiring", async () => {
    const input = user({ accessTokenExpiresAt: nowSeconds + 600 });
    const result = await refreshIfNeeded(input, githubAppSlot);
    expect(result).toMatchObject({
      user: input,
      token: "app-token",
      refreshed: false,
      refreshFailed: false,
    });
  });

  it("keeps the existing token when refresh credentials are missing", async () => {
    const input = user({
      accessTokenExpiresAt: nowSeconds - 1,
      refreshToken: "refresh-token",
    });
    const result = await refreshIfNeeded(input, githubAppSlot);
    expect(result.token).toBe("app-token");
    expect(result.refreshed).toBe(false);
    expect(result.refreshFailed).toBe(false);
  });

  it("refreshes with provider credentials", async () => {
    vi.stubEnv("AUTH_GITHUB_FULL_ID", "client-id");
    vi.stubEnv("AUTH_GITHUB_FULL_SECRET", "client-secret");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          access_token: "new-oauth-token",
          expires_in: 3600,
          refresh_token: "new-refresh",
          refresh_token_expires_in: 7200,
        }),
      ),
    );

    const input = user({
      oauth: {
        accessToken: "old-oauth-token",
        refreshToken: "refresh-token",
        accessTokenExpiresAt: nowSeconds - 1,
        grantedAt: now.toISOString(),
      },
    });
    const result = await refreshIfNeeded(input, oauthSlot);
    expect(result.token).toBe("new-oauth-token");
    expect(result.refreshed).toBe(true);
    expect(result.user.oauth?.accessToken).toBe("new-oauth-token");
    expect(result.user.oauth?.refreshToken).toBe("new-refresh");
  });

  it("reports refresh failure on a 401 response", async () => {
    vi.stubEnv("AUTH_GITHUB_ID", "client-id");
    vi.stubEnv("AUTH_GITHUB_SECRET", "client-secret");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ error: "bad_verification_code" }, 401)),
    );

    const input = user({
      accessTokenExpiresAt: nowSeconds - 1,
      refreshToken: "refresh-token",
    });
    const result = await refreshIfNeeded(input, githubAppSlot);
    expect(result.token).toBe("app-token");
    expect(result.refreshFailed).toBe(true);
  });
});

describe("getSearchToken", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("uses the app token when there is no oauth grant", async () => {
    await expect(getSearchToken(user())).resolves.toMatchObject({
      token: "app-token",
      source: "app",
      oauthCleared: false,
    });
  });

  it("uses the app token when oauth is revoked", async () => {
    await expect(
      getSearchToken(
        user({
          oauth: {
            accessToken: "oauth-token",
            revokedAt: now.toISOString(),
            grantedAt: now.toISOString(),
          },
        }),
      ),
    ).resolves.toMatchObject({ token: "app-token", source: "app" });
  });

  it("uses a valid oauth token", async () => {
    await expect(
      getSearchToken(
        user({
          oauth: {
            accessToken: "oauth-token",
            accessTokenExpiresAt: nowSeconds + 600,
            grantedAt: now.toISOString(),
          },
        }),
      ),
    ).resolves.toMatchObject({ token: "oauth-token", source: "oauth" });
  });

  it("uses refreshed oauth when refresh succeeds", async () => {
    vi.stubEnv("AUTH_GITHUB_FULL_ID", "client-id");
    vi.stubEnv("AUTH_GITHUB_FULL_SECRET", "client-secret");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ access_token: "fresh-oauth" })),
    );

    const result = await getSearchToken(
      user({
        oauth: {
          accessToken: "old-oauth",
          refreshToken: "refresh-token",
          accessTokenExpiresAt: nowSeconds - 1,
          grantedAt: now.toISOString(),
        },
      }),
    );
    expect(result).toMatchObject({
      token: "fresh-oauth",
      source: "oauth",
      oauthCleared: false,
    });
    expect(result.user.oauth?.accessToken).toBe("fresh-oauth");
  });

  it("marks oauth revoked and falls back when refresh fails", async () => {
    vi.stubEnv("AUTH_GITHUB_FULL_ID", "client-id");
    vi.stubEnv("AUTH_GITHUB_FULL_SECRET", "client-secret");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ error: "bad" }, 401)),
    );

    const result = await getSearchToken(
      user({
        oauth: {
          accessToken: "old-oauth",
          refreshToken: "refresh-token",
          accessTokenExpiresAt: nowSeconds - 1,
          grantedAt: now.toISOString(),
        },
      }),
    );
    expect(result.token).toBe("app-token");
    expect(result.source).toBe("app");
    expect(result.oauthCleared).toBe(true);
    expect(result.user.oauth?.revokedAt).toBe(now.toISOString());
  });
});

describe("classifyGitHubFailure", () => {
  it("classifies bad credentials as revoked", () => {
    expect(
      classifyGitHubFailure(new GitHubApiError("bad", 401, "Bad credentials")),
    ).toBe("revoked");
  });

  it("classifies SSO and policy blocks", () => {
    expect(
      classifyGitHubFailure(
        new GitHubApiError("sso", 403, "Resource not accessible by SAML"),
      ),
    ).toBe("policy-blocked");
  });

  it("classifies abuse and secondary rate limits", () => {
    expect(
      classifyGitHubFailure(
        new GitHubApiError("rate", 403, "secondary rate limit"),
      ),
    ).toBe("secondary-rate-limit");
  });

  it("classifies 5xx and network failures as transient", () => {
    expect(classifyGitHubFailure(new GitHubApiError("oops", 502, "bad"))).toBe(
      "transient",
    );
    expect(classifyGitHubFailure(new Error("network"))).toBe("transient");
  });
});
