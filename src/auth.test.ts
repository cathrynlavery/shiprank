import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StoredUser } from "@/lib/types";

type AccountInput = {
  provider: string;
  access_token?: string;
  expires_at?: number;
  refresh_token?: string;
  refresh_token_expires_at?: number;
  scope?: string;
};

type ProfileInput = {
  id?: number | string;
  login?: string;
};

type SignInArgs = {
  account?: AccountInput;
  profile?: ProfileInput;
  user: { name?: string | null; image?: string | null };
};

type AuthConfig = {
  callbacks: {
    signIn(args: SignInArgs): Promise<boolean>;
  };
};

const storeState = vi.hoisted(() => ({
  existing: null as StoredUser | null,
  saved: [] as StoredUser[],
  config: null as AuthConfig | null,
}));

vi.mock("@/lib/store", () => ({
  getUser: vi.fn(async () => storeState.existing),
  saveUser: vi.fn(async (user: StoredUser) => {
    storeState.saved.push(user);
  }),
}));

vi.mock("next-auth", () => ({
  default: vi.fn((config: AuthConfig) => {
    storeState.config = config;
    return {
      handlers: {},
      auth: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
    };
  }),
}));

vi.mock("next-auth/providers/github", () => ({
  default: vi.fn((config: Record<string, unknown>) => ({
    id: "github",
    ...config,
  })),
}));

async function loadConfig(): Promise<AuthConfig> {
  vi.resetModules();
  storeState.config = null;
  await import("@/auth");
  const config: AuthConfig | null = storeState.config;
  if (config === null) throw new Error("auth config was not captured");
  return config;
}

function account(provider: "github" | "github-full"): AccountInput {
  return {
    provider,
    access_token: `${provider}-access`,
    expires_at: 1_800_000_000,
    refresh_token: `${provider}-refresh`,
    refresh_token_expires_at: 1_900_000_000,
    scope: provider === "github-full" ? "repo read:user" : "read:user",
  };
}

describe("auth signIn merge", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("AUTH_GITHUB_FULL_ID", "full-client");
    vi.stubEnv("AUTH_GITHUB_FULL_SECRET", "full-secret");
    storeState.existing = null;
    storeState.saved = [];
  });

  it("preserves oauth when the GitHub App provider re-signs in", async () => {
    storeState.existing = {
      username: "ada",
      githubUserId: 123,
      registeredAt: "2026-05-01T00:00:00.000Z",
      oauth: {
        accessToken: "oauth-access",
        grantedAt: "2026-05-02T00:00:00.000Z",
      },
    };
    const config = await loadConfig();

    await config.callbacks.signIn({
      account: account("github"),
      profile: { id: 123, login: "ada" },
      user: { name: "Ada", image: "https://example.com/ada.png" },
    });

    expect(storeState.saved[0]).toMatchObject({
      username: "ada",
      githubUserId: 123,
      tokenKind: "github-app",
      token: "github-access",
      oauth: { accessToken: "oauth-access" },
    });
  });

  it("creates a new GitHub App user", async () => {
    const config = await loadConfig();

    await config.callbacks.signIn({
      account: account("github"),
      profile: { id: 123, login: "ada" },
      user: { name: "Ada", image: null },
    });

    expect(storeState.saved[0]).toMatchObject({
      username: "ada",
      githubUserId: 123,
      tokenKind: "github-app",
      token: "github-access",
      registeredAt: expect.any(String) as string,
    });
  });

  it("preserves App fields when github-full signs in", async () => {
    storeState.existing = {
      username: "ada",
      githubUserId: 123,
      registeredAt: "2026-05-01T00:00:00.000Z",
      token: "app-token",
      accessToken: "app-token",
      refreshToken: "app-refresh",
      tokenKind: "github-app",
    };
    const config = await loadConfig();

    await config.callbacks.signIn({
      account: account("github-full"),
      profile: { id: 123, login: "ada" },
      user: { name: "Ada", image: null },
    });

    expect(storeState.saved[0]).toMatchObject({
      username: "ada",
      token: "app-token",
      refreshToken: "app-refresh",
      tokenKind: "github-app",
      oauth: {
        accessToken: "github-full-access",
        refreshToken: "github-full-refresh",
        scope: "repo read:user",
      },
    });
  });

  it("creates a new github-full user without App fields", async () => {
    const config = await loadConfig();

    await config.callbacks.signIn({
      account: account("github-full"),
      profile: { id: 123, login: "ada" },
      user: { name: "Ada", image: null },
    });

    expect(storeState.saved[0]).toMatchObject({
      username: "ada",
      githubUserId: 123,
      oauth: { accessToken: "github-full-access" },
    });
    expect(storeState.saved[0].token).toBeUndefined();
  });

  it("does nothing without a profile login", async () => {
    const config = await loadConfig();

    await config.callbacks.signIn({
      account: account("github"),
      profile: { id: 123 },
      user: { name: "Ada", image: null },
    });

    expect(storeState.saved).toEqual([]);
  });

  it("does not merge when the stored GitHub user id differs", async () => {
    storeState.existing = {
      username: "ada",
      githubUserId: 456,
      registeredAt: "2026-05-01T00:00:00.000Z",
    };
    const config = await loadConfig();

    await config.callbacks.signIn({
      account: account("github"),
      profile: { id: 123, login: "ada" },
      user: { name: "Ada", image: null },
    });

    expect(storeState.saved).toEqual([]);
  });
});
