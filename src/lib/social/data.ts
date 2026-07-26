import { shortDate, weekRange } from "@/lib/date-label";
import { formatLines, signedLines } from "@/lib/format";
import type { RepoStats, StatsPayload } from "@/lib/types";

export type StatItem = {
  label: string;
  value: string;
};

export type TodayCardData = {
  username: string;
  dateLabel: string;
  lines: string;
  stats: StatItem[];
};

export type WeekCardData = {
  username: string;
  rangeLabel: string;
  totalLines: string;
  days: Array<{ date: string; day: string; lines: number; active: boolean }>;
  stats: StatItem[];
};

export type ReposCardData = {
  username: string;
  rangeLabel: string;
  totalLines: string;
  repos: Array<{
    name: string;
    scope: "public" | "private";
    lines: number;
    net: number;
  }>;
};

export type ProfileOgData = {
  username: string;
  date: string;
  lines: string;
  stats: StatItem[];
};

function dayTotal(repos: RepoStats | undefined) {
  if (!repos) return 0;
  return Object.values(repos).reduce((sum, stats) => sum + stats.additions, 0);
}

function netLabel(value: number) {
  return value > 0 ? `+${formatLines(value)}` : formatLines(value);
}

// Private entries arrive already masked by redactPrivateRepoNames, so their key
// is a display label rather than an owner/repo pair. Matches RepoList.
function repoLabel(repoFullName: string, isPrivate?: boolean) {
  if (isPrivate) return repoFullName;
  return repoFullName.split("/").at(-1) ?? repoFullName;
}

export function buildTodayCardData(stats: StatsPayload): TodayCardData {
  return {
    username: stats.username,
    dateLabel: shortDate(stats.today.date),
    lines: signedLines(stats.today.lines),
    stats: [
      { label: "net", value: netLabel(stats.today.net) },
      { label: "commits", value: formatLines(stats.today.commits) },
      { label: "merged prs", value: formatLines(stats.today.prs) },
    ],
  };
}

export function buildWeekCardData(stats: StatsPayload): WeekCardData {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${stats.today.date}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() - (6 - index));
    const dateString = date.toISOString().slice(0, 10);
    return {
      date: dateString,
      day: ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][
        date.getUTCDay()
      ],
      lines: dayTotal(stats.byDay[dateString]),
      active: dateString === stats.today.date,
    };
  });

  return {
    username: stats.username,
    rangeLabel: weekRange(stats.today.date),
    totalLines: `+${formatLines(stats.week.lines)}`,
    days,
    stats: [
      { label: "net", value: netLabel(stats.week.net) },
      { label: "commits", value: formatLines(stats.week.commits) },
      { label: "merged prs", value: formatLines(stats.week.prs) },
    ],
  };
}

export function buildReposCardData(stats: StatsPayload): ReposCardData {
  const repos = Object.entries(stats.week.byRepo)
    .sort((a, b) => b[1].additions - a[1].additions)
    .slice(0, 5)
    .map(([repoFullName, repoStats]) => ({
      name: repoLabel(repoFullName, repoStats.private),
      scope: repoStats.private ? ("private" as const) : ("public" as const),
      lines: repoStats.additions,
      net: repoStats.additions - repoStats.deletions,
    }));

  return {
    username: stats.username,
    rangeLabel: weekRange(stats.today.date),
    totalLines: `+${formatLines(stats.week.lines)}`,
    repos,
  };
}

export function buildProfileOgData(stats: StatsPayload): ProfileOgData {
  return {
    username: stats.username,
    date: stats.today.date,
    lines: signedLines(stats.today.lines),
    stats: [
      { label: "net", value: netLabel(stats.today.net) },
      { label: "commits", value: formatLines(stats.today.commits) },
      { label: "merged prs", value: formatLines(stats.today.prs) },
    ],
  };
}

export { formatLines, signedLines };
