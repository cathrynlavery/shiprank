import { CountUp } from "@/components/count-up";
import type { RepoStats } from "@/lib/types";

function repoLabel(
  repoFullName: string,
  isPrivate: boolean,
  revealNames: boolean,
) {
  if (isPrivate && !revealNames) return repoFullName;
  return repoFullName.split("/").at(-1) ?? repoFullName;
}

export function RepoList({
  repos,
  limit,
  revealNames = false,
}: {
  repos: RepoStats;
  limit?: number;
  revealNames?: boolean;
}) {
  const entries = Object.entries(repos)
    .sort((a, b) => b[1].additions - a[1].additions)
    .slice(0, limit);

  if (!entries.length) return <p className="empty">nothing yet</p>;

  return entries.map(([repo, stats]) => {
    const isPrivate = stats.private === true;
    const label = repoLabel(repo, isPrivate, revealNames);
    const showLink = !isPrivate || revealNames;

    return (
      <div className="repo-row" key={repo}>
        <div className="repo-meta">
          {showLink ? (
            <a
              className="repo-name repo-link"
              href={`https://github.com/${repo}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {label}
            </a>
          ) : (
            <span className="repo-name">{label}</span>
          )}
          <span className={isPrivate ? "repo-scope private" : "repo-scope"}>
            {isPrivate ? "private" : "public"}
          </span>
        </div>
        <span className="repo-lines">
          <CountUp value={stats.additions} durationMs={650} />
        </span>
      </div>
    );
  });
}
