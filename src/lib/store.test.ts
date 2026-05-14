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

describe("normalizeStats", () => {
  it("returns a usable shape for completely empty input", () => {
    const stats = normalizeStats({});
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

    const out = normalizeStats(input);
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
    const stats = normalizeStats({
      today: { date: "2026-05-14", lines: 10 },
    });
    expect(stats.today.date).toBe("2026-05-14");
    expect(stats.yesterday.date).toBe("2026-05-13");
  });

  it("does not crash on a malformed today.date string", () => {
    const stats = normalizeStats({ today: { date: "not-a-date", lines: 0 } });
    // Falls back to today and yesterday-of-today instead of throwing.
    expect(stats.today.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(stats.yesterday.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("rejects an obviously bad date format (mm/dd/yyyy)", () => {
    const stats = normalizeStats({ today: { date: "05/14/2026" } });
    expect(stats.today.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(stats.today.date).not.toBe("05/14/2026");
  });

  it("derives yesterday lines from byDay when yesterday block is missing (legacy payload)", () => {
    const stats = normalizeStats({
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
    const stats = normalizeStats({
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

  it("computes net from byRepo when explicit net is missing", () => {
    const stats = normalizeStats({
      today: {
        date: "2026-05-14",
        lines: 100,
        byRepo: { "ada/repo": { additions: 100, deletions: 30 } },
      },
    });
    expect(stats.today.net).toBe(70);
  });

  it("treats garbage byDay as empty without throwing", () => {
    const stats = normalizeStats({
      today: { date: "2026-05-14" },
      byDay: "not-an-object",
    });
    expect(stats.byDay).toEqual({});
  });

  it("guards yesterdayDate when today.date is parseable but unusual (year 1)", () => {
    const stats = normalizeStats({ today: { date: "0001-01-01" } });
    // Should not throw; produce some valid date string.
    expect(stats.yesterday.date).toMatch(/^-?\d{4,6}-\d{2}-\d{2}$/);
  });
});
