import { createHmac } from "node:crypto";
import type { RepoStats, StatsPayload } from "@/lib/types";
import { wackyName } from "@/lib/wacky-name";

type RepoLabelSecret = string | null | undefined;

function collectPrivateRepoNames(stats: StatsPayload) {
  const privateNames = new Set<string>();
  const collect = (repos: RepoStats) => {
    for (const [name, repoStats] of Object.entries(repos)) {
      if (repoStats.private === true) privateNames.add(name);
    }
  };

  for (const period of [
    stats.today,
    stats.yesterday,
    stats.week,
    stats.total,
  ]) {
    collect(period.byRepo);
  }

  for (const repos of Object.values(stats.byDay)) collect(repos);

  return privateNames;
}

function nextAvailableLabel(base: string, used: Set<string>) {
  let label = base;
  let bump = 2;

  while (used.has(label)) {
    label = `${base} ${bump++}`;
  }

  used.add(label);
  return label;
}

function basePrivateLabel(fullName: string, secret: RepoLabelSecret) {
  if (!secret) return "private repo";

  const seed = createHmac("sha256", secret).update(fullName).digest("hex");
  return wackyName(seed);
}

function buildLabelMap(stats: StatsPayload, secret: RepoLabelSecret) {
  const used = new Set<string>();
  const labels = new Map<string, string>();

  for (const fullName of [...collectPrivateRepoNames(stats)].sort()) {
    labels.set(
      fullName,
      nextAvailableLabel(basePrivateLabel(fullName, secret), used),
    );
  }

  return labels;
}

function remapRepos(repos: RepoStats, labels: Map<string, string>) {
  const out: RepoStats = {};

  for (const [name, repoStats] of Object.entries(repos)) {
    const key =
      repoStats.private === true ? (labels.get(name) ?? "private repo") : name;
    out[key] = { ...repoStats };
  }

  return out;
}

export function redactPrivateRepoNames(
  stats: StatsPayload,
  secret: RepoLabelSecret,
): StatsPayload {
  const labels = buildLabelMap(stats, secret);
  const byDay: StatsPayload["byDay"] = {};

  for (const [date, repos] of Object.entries(stats.byDay)) {
    byDay[date] = remapRepos(repos, labels);
  }

  return {
    ...stats,
    today: { ...stats.today, byRepo: remapRepos(stats.today.byRepo, labels) },
    yesterday: {
      ...stats.yesterday,
      byRepo: remapRepos(stats.yesterday.byRepo, labels),
    },
    week: { ...stats.week, byRepo: remapRepos(stats.week.byRepo, labels) },
    total: { ...stats.total, byRepo: remapRepos(stats.total.byRepo, labels) },
    byDay,
  };
}
