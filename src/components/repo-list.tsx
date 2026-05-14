import { formatLines } from "@/lib/format";
import type { RepoStats } from "@/lib/types";
import { wackyName } from "@/lib/wacky-name";

function repoLabel(repoFullName: string, isPrivate?: boolean) {
  if (isPrivate) return wackyName(repoFullName);
  return repoFullName.split("/").at(-1) ?? repoFullName;
}

export function RepoList({
  repos,
  limit,
}: {
  repos: RepoStats;
  limit?: number;
}) {
  const entries = Object.entries(repos)
    .sort((a, b) => b[1].additions - a[1].additions)
    .slice(0, limit);

  if (!entries.length) return <p className="empty">nothing yet</p>;

  return entries.map(([repo, stats]) => (
    <div className="row" key={repo}>
      <span className="label">{repoLabel(repo, stats.private)}</span>
      <span className="val">+{formatLines(stats.additions)}</span>
    </div>
  ));
}
