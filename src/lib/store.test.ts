import { describe, expect, it } from "vitest";
import { normalizeStats } from "@/lib/store";
import type { StatsPayload } from "@/lib/types";

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
    expect(out.byDay["2026-05-13"]).toEqual({
      "ada/repo": { additions: 50, deletions: 10 },
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
