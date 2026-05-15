import { CountUp } from "@/components/count-up";
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

  return entries.map(([repo, stats]) => {
    const label = repoLabel(repo, stats.private);

    return (
      <div className="repo-row" key={repo}>
        <div className="repo-meta">
          {stats.private ? (
            <span className="repo-name">{label}</span>
          ) : (
            <a
              className="repo-name repo-link"
              href={`https://github.com/${repo}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {label}
            </a>
          )}
          <span className={stats.private ? "repo-scope private" : "repo-scope"}>
            {stats.private ? "private" : "public"}
          </span>
        </div>
        <span className="repo-lines">
          <CountUp value={stats.additions} durationMs={650} />
        </span>
      </div>
    );
  });
}
