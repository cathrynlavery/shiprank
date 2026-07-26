import { describe, expect, it } from "vitest";
import { redactPrivateRepoNames } from "@/lib/redact-stats";
import type { PeriodSummary, RepoStats, StatsPayload } from "@/lib/types";

function makePeriod(byRepo: RepoStats = {}): PeriodSummary {
  const lines = Object.values(byRepo).reduce(
    (sum, stats) => sum + stats.additions,
    0,
  );
  const net = Object.values(byRepo).reduce(
    (sum, stats) => sum + stats.additions - stats.deletions,
    0,
  );

  return {
    lines,
    net,
    commits: 1,
    prs: 0,
    byRepo,
  };
}

function makeStats(overrides: Partial<StatsPayload> = {}): StatsPayload {
  const todayRepos: RepoStats = {
    "owner/public-site": { additions: 100, deletions: 5, private: false },
    "owner/secret-roadmap": { additions: 25, deletions: 2, private: true },
  };

  return {
    username: "owner",
    generated: "2026-06-09T12:00:00.000Z",
    today: {
      date: "2026-06-09",
      ...makePeriod(todayRepos),
    },
    yesterday: {
      date: "2026-06-08",
      ...makePeriod(),
    },
    week: makePeriod({
      "owner/public-site": { additions: 500, deletions: 40, private: false },
      "owner/secret-roadmap": { additions: 75, deletions: 10, private: true },
    }),
    total: makePeriod({
      "owner/public-site": { additions: 900, deletions: 60, private: false },
      "owner/secret-roadmap": { additions: 120, deletions: 20, private: true },
    }),
    byDay: {
      "2026-06-09": todayRepos,
      "2026-06-08": {
        "owner/secret-roadmap": {
          additions: 50,
          deletions: 8,
          private: true,
        },
      },
    },
    ...overrides,
  };
}

function privateRepoKey(repos: RepoStats) {
  const entry = Object.entries(repos).find(
    ([, stats]) => stats.private === true,
  );
  if (!entry) throw new Error("expected a private repo");
  return entry[0];
}

describe("redactPrivateRepoNames", () => {
  it("removes private owner/repo strings from the full payload", () => {
    const redacted = redactPrivateRepoNames(makeStats(), "fixed-secret");
    const payload = JSON.stringify(redacted);

    expect(payload).not.toContain("owner/secret-roadmap");
    expect(payload).toContain("owner/public-site");
  });

  it("leaves public repo keys unchanged", () => {
    const redacted = redactPrivateRepoNames(makeStats(), "fixed-secret");

    expect(redacted.today.byRepo["owner/public-site"]).toEqual({
      additions: 100,
      deletions: 5,
      private: false,
    });
    expect(redacted.week.byRepo["owner/public-site"]).toEqual({
      additions: 500,
      deletions: 40,
      private: false,
    });
  });

  it("keeps colliding private labels distinct without merging totals", () => {
    const redacted = redactPrivateRepoNames(
      makeStats({
        today: {
          date: "2026-06-09",
          ...makePeriod({
            "owner/private-2567": {
              additions: 10,
              deletions: 1,
              private: true,
            },
            "owner/private-3190": {
              additions: 20,
              deletions: 2,
              private: true,
            },
          }),
        },
        week: makePeriod(),
        total: makePeriod(),
        byDay: {},
      }),
      "collision-secret",
    );

    expect(redacted.today.byRepo["Tachyon Mainframe eak"]).toEqual({
      additions: 10,
      deletions: 1,
      private: true,
    });
    expect(redacted.today.byRepo["Tachyon Mainframe eak 2"]).toEqual({
      additions: 20,
      deletions: 2,
      private: true,
    });
    expect(Object.keys(redacted.today.byRepo)).toHaveLength(2);
  });

  it("uses the same private label across periods for the same repo", () => {
    const redacted = redactPrivateRepoNames(makeStats(), "fixed-secret");

    expect(privateRepoKey(redacted.today.byRepo)).toBe(
      privateRepoKey(redacted.week.byRepo),
    );
  });

  it("masks a repo in periods that still record it as public", () => {
    // A repo that just flipped to private: today knows, the retained total does not.
    const redacted = redactPrivateRepoNames(
      makeStats({
        total: makePeriod({
          "owner/secret-roadmap": {
            additions: 120,
            deletions: 20,
            private: false,
          },
        }),
      }),
      "fixed-secret",
    );

    expect(Object.keys(redacted.total.byRepo)).not.toContain(
      "owner/secret-roadmap",
    );
    expect(privateRepoKey(redacted.total.byRepo)).toBe(
      privateRepoKey(redacted.today.byRepo),
    );
    expect(JSON.stringify(redacted)).not.toContain("owner/secret-roadmap");
  });

  it("uses different private labels with different secrets", () => {
    const first = redactPrivateRepoNames(makeStats(), "secret-one");
    const second = redactPrivateRepoNames(makeStats(), "secret-two");

    expect(privateRepoKey(first.today.byRepo)).not.toBe(
      privateRepoKey(second.today.byRepo),
    );
  });
});
