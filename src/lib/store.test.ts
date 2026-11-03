import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as database from "@/lib/neon-store";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  acquireRefreshLock,
  getAllStats,
  getAllUsers,
  getStats,
  getUser,
  isLocalStoreEnabled,
  isStorageReadOnly,
  saveCachedCommitStats,
  saveCachedPrCount,
  mergeByDayStats,
  normalizeStats,
  releaseRefreshLock,
  saveStats,
  saveUser,
} from "@/lib/store";
import { statsDate } from "@/lib/stats-date";
import type { StatsPayload } from "@/lib/types";

vi.mock("@/lib/neon-store", () => ({
  getValue: vi.fn(), setValue: vi.fn(), listValues: vi.fn(), appendAudit: vi.fn(),
  acquireLock: vi.fn(), releaseLock: vi.fn(), purgeExpired: vi.fn(),
}));

function makePeriod(overrides: Partial<StatsPayload["today"]> = {}) {
  return {
    date: "2026-05-14",
    lines: 0,
    net: 0,
    commits: 0,
    prs: 0,
    byRepo: {},
    ...overrides,
  };
}

function normalizeAt(raw: unknown, iso = "2026-05-14T12:00:00.000Z") {
  return normalizeStats(raw, new Date(iso));
}

describe("normalizeStats", () => {
  it("returns a usable shape for completely empty input", () => {
    const stats = normalizeAt({});
    expect(stats.username).toBe("");
    expect(stats.today.lines).toBe(0);
    expect(stats.yesterday.lines).toBe(0);
    expect(stats.week.lines).toBe(0);
    expect(stats.total.lines).toBe(0);
    expect(stats.byDay).toEqual({});
    expect(stats.today.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(stats.yesterday.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("round-trips a full payload without losing fields", () => {
    const input: StatsPayload = {
      username: "ada",
      generated: "2026-05-14T12:00:00.000Z",
      today: makePeriod({
        date: "2026-05-14",
        lines: 100,
        net: 80,
        commits: 5,
        prs: 1,
        byRepo: { "ada/repo": { additions: 100, deletions: 20 } },
      }),
      yesterday: makePeriod({
        date: "2026-05-13",
        lines: 50,
        net: 40,
        commits: 3,
        prs: 0,
        byRepo: { "ada/repo": { additions: 50, deletions: 10 } },
      }),
      week: makePeriod({
        lines: 500,
        net: 400,
        commits: 25,
        prs: 4,
        byRepo: { "ada/repo": { additions: 500, deletions: 100 } },
      }),
      total: makePeriod({
        lines: 650,
        net: 520,
        commits: 33,
        prs: 5,
        byRepo: { "ada/repo": { additions: 650, deletions: 130 } },
      }),
      byDay: {
        "2026-05-14": { "ada/repo": { additions: 100, deletions: 20 } },
        "2026-05-13": { "ada/repo": { additions: 50, deletions: 10 } },
      },
    };

    const out = normalizeAt(input);
    expect(out.username).toBe("ada");
    expect(out.today.lines).toBe(100);
    expect(out.yesterday.lines).toBe(50);
    expect(out.yesterday.date).toBe("2026-05-13");
    expect(out.week.commits).toBe(25);
    expect(out.total.lines).toBe(650);
    expect(out.total.prs).toBe(5);
    expect(out.byDay["2026-05-13"]).toEqual({
      "ada/repo": { additions: 50, deletions: 10 },
    });
  });

  it("derives total from project-start daily cache when total block is missing", () => {
    const stats = normalizeAt({
      byDay: {
        "2026-05-13": { "ada/before": { additions: 999, deletions: 0 } },
        "2026-05-14": { "ada/start": { additions: 100, deletions: 20 } },
        "2026-05-15": { "ada/next": { additions: 50, deletions: 5 } },
      },
      byDayCommits: {
        "2026-05-13": 9,
        "2026-05-14": 2,
        "2026-05-15": 3,
      },
    });

    expect(stats.total.lines).toBe(150);
    expect(stats.total.net).toBe(125);
    expect(stats.total.commits).toBe(5);
    expect(stats.total.byRepo).toEqual({
      "ada/start": { additions: 100, deletions: 20 },
      "ada/next": { additions: 50, deletions: 5 },
    });
  });

  it("derives yesterdayDate as today minus one day when missing", () => {
    const stats = normalizeAt({
      today: { date: "2026-05-14", lines: 10 },
    });
    expect(stats.today.date).toBe("2026-05-14");
    expect(stats.yesterday.date).toBe("2026-05-13");
  });

  it("does not crash on a malformed today.date string", () => {
    const stats = normalizeAt({ today: { date: "not-a-date", lines: 0 } });
    // Falls back to today and yesterday-of-today instead of throwing.
    expect(stats.today.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(stats.yesterday.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("rejects an obviously bad date format (mm/dd/yyyy)", () => {
    const stats = normalizeAt({ today: { date: "05/14/2026" } });
    expect(stats.today.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(stats.today.date).not.toBe("05/14/2026");
  });

  it("derives yesterday lines from byDay when yesterday block is missing (legacy payload)", () => {
    const stats = normalizeAt({
      today: { date: "2026-05-14", lines: 100 },
      byDay: {
        "2026-05-13": {
          "ada/repo": { additions: 75, deletions: 5 },
          "ada/other": { additions: 25, deletions: 0 },
        },
      },
    });
    expect(stats.yesterday.date).toBe("2026-05-13");
    expect(stats.yesterday.lines).toBe(100);
    expect(stats.yesterday.byRepo).toEqual({
      "ada/repo": { additions: 75, deletions: 5 },
      "ada/other": { additions: 25, deletions: 0 },
    });
  });

  it("prefers stored yesterday block over byDay-derived data", () => {
    const stats = normalizeAt({
      today: { date: "2026-05-14" },
      yesterday: {
        date: "2026-05-13",
        lines: 42,
        byRepo: { "ada/explicit": { additions: 42, deletions: 0 } },
      },
      byDay: {
        "2026-05-13": { "ada/derived": { additions: 999, deletions: 0 } },
      },
    });
    expect(stats.yesterday.lines).toBe(42);
    expect(stats.yesterday.byRepo).toEqual({
      "ada/explicit": { additions: 42, deletions: 0 },
    });
  });

  it("promotes a stale today snapshot to yesterday after the date rolls over", () => {
    const stats = normalizeAt(
      {
        today: {
          date: "2026-05-14",
          lines: 120,
          net: 90,
          commits: 4,
          prs: 2,
          byRepo: { "ada/repo": { additions: 120, deletions: 30 } },
        },
        yesterday: {
          date: "2026-05-13",
          lines: 40,
          net: 35,
          commits: 1,
          prs: 0,
          byRepo: { "ada/old": { additions: 40, deletions: 5 } },
        },
      },
      "2026-05-15T06:00:00.000Z",
    );

    expect(stats.today.date).toBe("2026-05-15");
    expect(stats.today.lines).toBe(0);
    expect(stats.yesterday.date).toBe("2026-05-14");
    expect(stats.yesterday.lines).toBe(120);
    expect(stats.yesterday.net).toBe(90);
    expect(stats.yesterday.commits).toBe(4);
    expect(stats.yesterday.prs).toBe(2);
    expect(stats.yesterday.byRepo).toEqual({
      "ada/repo": { additions: 120, deletions: 30 },
    });
  });

  it("does not promote today during the UTC-only rollover before the stats day changes", () => {
    const stats = normalizeAt(
      {
        today: {
          date: "2026-05-15",
          lines: 120,
          net: 90,
          commits: 4,
          prs: 2,
          byRepo: { "ada/repo": { additions: 120, deletions: 30 } },
        },
        yesterday: {
          date: "2026-05-14",
          lines: 40,
          net: 35,
          commits: 1,
          prs: 0,
          byRepo: { "ada/old": { additions: 40, deletions: 5 } },
        },
      },
      "2026-05-16T02:00:00.000Z",
    );

    expect(stats.today.date).toBe("2026-05-15");
    expect(stats.today.lines).toBe(120);
    expect(stats.yesterday.date).toBe("2026-05-14");
    expect(stats.yesterday.lines).toBe(40);
  });

  it("derives yesterday from byDay when the stored today snapshot is older than yesterday", () => {
    const stats = normalizeAt(
      {
        today: {
          date: "2026-05-13",
          lines: 10,
          byRepo: { "ada/old": { additions: 10, deletions: 0 } },
        },
        byDay: {
          "2026-05-14": {
            "ada/repo": { additions: 75, deletions: 15 },
          },
        },
      },
      "2026-05-15T06:00:00.000Z",
    );

    expect(stats.today.date).toBe("2026-05-15");
    expect(stats.today.lines).toBe(0);
    expect(stats.yesterday.date).toBe("2026-05-14");
    expect(stats.yesterday.lines).toBe(75);
    expect(stats.yesterday.net).toBe(60);
    expect(stats.yesterday.commits).toBe(0);
    expect(stats.yesterday.prs).toBe(0);
  });

  it("computes net from byRepo when explicit net is missing", () => {
    const stats = normalizeAt({
      today: {
        date: "2026-05-14",
        lines: 100,
        byRepo: { "ada/repo": { additions: 100, deletions: 30 } },
      },
    });
    expect(stats.today.net).toBe(70);
  });

  it("treats garbage byDay as empty without throwing", () => {
    const stats = normalizeAt({
      today: { date: "2026-05-14" },
      byDay: "not-an-object",
    });
    expect(stats.byDay).toEqual({});
  });

  it("guards yesterdayDate when today.date is parseable but unusual (year 1)", () => {
    const stats = normalizeAt({ today: { date: "0001-01-01" } });
    // Should not throw; produce some valid date string.
    expect(stats.yesterday.date).toMatch(/^-?\d{4,6}-\d{2}-\d{2}$/);
  });
});

describe("mergeByDayStats", () => {
  it("merges new days and preserves days back to the project start", () => {
    const merged = mergeByDayStats({
      today: "2026-05-18",
      existing: {
        "2026-05-14": { "ada/old": { additions: 10, deletions: 1 } },
        "2026-05-17": { "ada/stale": { additions: 20, deletions: 2 } },
      },
      fresh: {
        "2026-05-17": { "ada/fresh": { additions: 30, deletions: 3 } },
        "2026-05-18": { "ada/new": { additions: 40, deletions: 4 } },
      },
    });

    expect(merged).toEqual({
      "2026-05-14": { "ada/old": { additions: 10, deletions: 1 } },
      "2026-05-17": { "ada/fresh": { additions: 30, deletions: 3 } },
      "2026-05-18": { "ada/new": { additions: 40, deletions: 4 } },
    });
  });

  it("rolls off days before the project start by default", () => {
    const merged = mergeByDayStats({
      today: "2026-05-18",
      existing: {
        "2026-05-13": { "ada/too-old": { additions: 10, deletions: 1 } },
        "2026-05-14": { "ada/kept": { additions: 20, deletions: 2 } },
      },
      fresh: {},
    });

    expect(merged).toEqual({
      "2026-05-14": { "ada/kept": { additions: 20, deletions: 2 } },
    });
  });
});

describe("development local store", () => {
  let dir: string;
  let storePath: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "shiprank-store-"));
    storePath = join(dir, "shiprank-store.json");
    vi.stubEnv("SHIPRANK_LOCAL_STORE_DIR", dir);
    vi.stubEnv("SHIPRANK_USE_LOCAL_STORE", "1");
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", "12345678901234567890123456789012");
    vi.stubEnv("DATABASE_URL", "");
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    vi.resetAllMocks();
    await rm(dir, { recursive: true, force: true });
  });

  it("uses the local store when forced even with a database URL", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "postgres://test:test@db.example.test/shiprank");
    expect(isLocalStoreEnabled()).toBe(true);

    const user = {
      username: "ada",
      githubUserId: 123,
      registeredAt: "2026-05-18T00:00:00.000Z",
    };
    await saveUser(user);
    await expect(getUser("ada")).resolves.toMatchObject(user);
    expect(JSON.parse(await readFile(storePath, "utf8")).values["user:ada"])
      .toEqual(user);
    expect(database.setValue).not.toHaveBeenCalled();
    expect(database.getValue).not.toHaveBeenCalled();
  });

  it("uses the local store automatically in development without a database URL", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("SHIPRANK_USE_LOCAL_STORE", undefined);
    expect(isLocalStoreEnabled()).toBe(true);

    const user = {
      username: "ada",
      githubUserId: 123,
      registeredAt: "2026-05-18T00:00:00.000Z",
    };
    await saveUser(user);
    await expect(getUser("ada")).resolves.toMatchObject(user);
    expect(JSON.parse(await readFile(storePath, "utf8")).values["user:ada"]).toEqual(user);
    expect(database.setValue).not.toHaveBeenCalled();
  });

  it("persists users and stats without a remote database", async () => {
    expect(isLocalStoreEnabled()).toBe(true);

    await saveUser({
      username: "ada",
      githubUserId: 123,
      registeredAt: "2026-05-18T00:00:00.000Z",
      token: "github-token",
    });
    expect(JSON.parse(await readFile(storePath, "utf8")).values["user:ada"])
      .toBeTruthy();

    await saveStats({
      username: "ada",
      generated: "2026-05-18T12:00:00.000Z",
      today: makePeriod({ date: statsDate(), lines: 10 }),
      yesterday: makePeriod({ lines: 5 }),
      week: makePeriod({ lines: 15 }),
      total: makePeriod({ lines: 30 }),
      byDay: {},
    });
    const afterStats = JSON.parse(await readFile(storePath, "utf8"));
    expect(Object.keys(afterStats.values)).toContain("user:ada");
    expect(isLocalStoreEnabled()).toBe(true);

    await expect(getUser("ada")).resolves.toMatchObject({
      username: "ada",
      token: "github-token",
    });
    await expect(getStats("ada")).resolves.toMatchObject({
      username: "ada",
      today: { lines: 10 },
    });
    await expect(getAllUsers()).resolves.toHaveLength(1);
    await expect(getAllStats()).resolves.toHaveLength(1);

    const stored = JSON.parse(await readFile(storePath, "utf8"));
    expect(stored.values["user:ada"].token).not.toBe("github-token");
    expect(stored.values["stats:ada"].today.lines).toBe(10);
  });

  it("allows one refresh per user at a time", async () => {
    await expect(acquireRefreshLock("ada")).resolves.toBe(true);
    await expect(acquireRefreshLock("ada")).resolves.toBe(false);
    await expect(acquireRefreshLock("bo")).resolves.toBe(true);
    await releaseRefreshLock("ada");
    await expect(acquireRefreshLock("ada")).resolves.toBe(true);
  });

  it("never enables local storage automatically in production", () => {
    vi.stubEnv("SHIPRANK_USE_LOCAL_STORE", undefined);
    vi.stubEnv("NODE_ENV", "production");
    expect(isLocalStoreEnabled()).toBe(false);
  });

  it("uses Neon in production with only a database URL", async () => {
    vi.stubEnv("SHIPRANK_USE_LOCAL_STORE", undefined);
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "postgres://test:test@db.example.test/shiprank");
    const user = { username: "ada", registeredAt: "2026-05-18T00:00:00Z", token: "example-token" };
    await saveUser(user);
    const persisted = vi.mocked(database.setValue).mock.calls[0][1] as typeof user;
    expect(persisted.token).toMatch(/^enc:v1:/);
    expect(persisted.token).not.toBe(user.token);
    vi.mocked(database.getValue).mockResolvedValue(persisted);
    await expect(getUser("ada")).resolves.toMatchObject(user);
    expect(database.appendAudit).toHaveBeenCalledOnce();
  });

  it("freezes all storage mutations while keeping existing reads available", async () => {
    await saveUser({ username: "ada", token: "example-token", registeredAt: "2026-05-18" });
    const before = await readFile(storePath, "utf8");
    vi.stubEnv("SHIPRANK_STORAGE_READ_ONLY", "1");
    expect(isStorageReadOnly()).toBe(true);
    await expect(getUser("ada")).resolves.toMatchObject({ username: "ada", token: "example-token" });
    await expect(saveUser({ username: "bo", registeredAt: "2026-05-18" })).rejects.toThrow("read-only");
    await expect(saveStats(normalizeAt({ username: "ada" }))).rejects.toThrow("read-only");
    await expect(saveCachedCommitStats("ada/repo", "sha", { additions: 1, deletions: 0 })).rejects.toThrow("read-only");
    await expect(saveCachedPrCount("ada", "app", "query", 1, 60)).rejects.toThrow("read-only");
    await expect(acquireRefreshLock("ada")).resolves.toBe(false);
    await releaseRefreshLock("ada");
    expect(await readFile(storePath, "utf8")).toBe(before);
    expect(database.appendAudit).not.toHaveBeenCalled();
    expect(database.setValue).not.toHaveBeenCalled();
  });

  it("keeps Neon token reads free of audit writes and lazy rewrites during maintenance", async () => {
    vi.stubEnv("SHIPRANK_USE_LOCAL_STORE", undefined);
    vi.stubEnv("DATABASE_URL", "postgres://test:test@db.example.test/shiprank");
    vi.stubEnv("SHIPRANK_STORAGE_READ_ONLY", "1");
    vi.mocked(database.getValue).mockResolvedValue({ username: "ada", token: "legacy-fixture" });
    await expect(getUser("ada")).resolves.toMatchObject({ token: "legacy-fixture" });
    await expect(acquireRefreshLock("ada")).resolves.toBe(false);
    await releaseRefreshLock("ada");
    expect(database.appendAudit).not.toHaveBeenCalled();
    expect(database.setValue).not.toHaveBeenCalled();
    expect(database.acquireLock).not.toHaveBeenCalled();
    expect(database.releaseLock).not.toHaveBeenCalled();
  });
});
