import { afterEach, describe, expect, it, vi } from "vitest";
import { refreshUserStats } from "@/lib/github";
import { GitHubApiError } from "@/lib/github-token";
import type { StoredUser } from "@/lib/types";

vi.mock("@/lib/store", () => ({
  getCachedCommitStats: vi.fn(async () => null),
  getCachedPrCount: vi.fn(async () => null),
  getStats: vi.fn(async () => null),
  mergeByDayCommits: vi.fn(({ fresh }) => fresh),
  mergeByDayStats: vi.fn(({ fresh }) => fresh),
  saveCachedCommitStats: vi.fn(async () => undefined),
  saveCachedPrCount: vi.fn(async () => undefined),
}));

const SECONDARY_LIMIT_BODY = JSON.stringify({
  message:
    "You have exceeded a secondary rate limit. Please wait a few minutes before you try again.",
});

const oauthUser: StoredUser = {
  username: "ada",
  registeredAt: "2026-10-22T00:00:00.000Z",
  token: "app-token",
  oauth: { accessToken: "oauth-token", grantedAt: "2026-10-22T00:00:00.000Z" },
};

function json(body: unknown, status = 200) {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("refreshUserStats under GitHub rate limits", () => {
  it("does not retry the whole rebuild on the App token", async () => {
    const fetchMock = vi.fn(async () => json(SECONDARY_LIMIT_BODY, 403));
    vi.stubGlobal("fetch", fetchMock);

    await expect(refreshUserStats(oauthUser)).rejects.toBeInstanceOf(
      GitHubApiError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("fails instead of saving a rate-limited commit as 0 lines", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/search/commits")) {
        return json({
          items: [
            {
              sha: "abc",
              commit: { author: { date: "2026-10-22T12:00:00Z" } },
              repository: { full_name: "ada/app", private: false },
            },
          ],
        });
      }
      if (url.includes("/search/issues")) return json({ total_count: 0 });
      return json(SECONDARY_LIMIT_BODY, 403);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(refreshUserStats(oauthUser)).rejects.toBeInstanceOf(
      GitHubApiError,
    );
  });
});
