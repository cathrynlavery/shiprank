import { afterEach, describe, expect, it, vi } from "vitest";
import { githubAppInstallUrl, githubConnectUrl } from "./github-app";

describe("GitHub connection URLs", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("starts OAuth when the visitor is logged out", () => {
    expect(githubConnectUrl(false)).toBe("/api/github/setup");
  });

  it("opens GitHub App management when the visitor is authenticated", () => {
    vi.stubEnv("GITHUB_APP_SLUG", "shiprank");

    expect(githubConnectUrl(true)).toBe(
      "https://github.com/apps/shiprank/installations/new",
    );
  });

  it("removes deployment whitespace from the GitHub App slug", () => {
    vi.stubEnv("GITHUB_APP_SLUG", "shiprank\n");

    expect(githubAppInstallUrl()).toBe(
      "https://github.com/apps/shiprank/installations/new",
    );
  });
});
