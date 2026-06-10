import type { StatsPayload } from "@/lib/types";

export type DayTotals = Record<string, number>;

export function dayAdditionTotals(byDay: StatsPayload["byDay"]): DayTotals {
  const totals: DayTotals = {};

  for (const [date, repos] of Object.entries(byDay)) {
    totals[date] = Object.values(repos).reduce(
      (sum, stats) => sum + stats.additions,
      0,
    );
  }

  return totals;
}
