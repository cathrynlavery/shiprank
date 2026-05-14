import { formatLines, signedLines } from "@/lib/format";

type MetricStripProps = {
  lines: number;
  commits: number;
  prs: number;
};

export function MetricStrip({ lines, commits, prs }: MetricStripProps) {
  return (
    <div className="metrics">
      <div className="metric">
        <div className="metric-val">{signedLines(lines)}</div>
        <div className="metric-label">lines</div>
      </div>
      <div className="metric">
        <div className="metric-val">{formatLines(commits)}</div>
        <div className="metric-label">commits</div>
      </div>
      <div className="metric">
        <div className="metric-val">{formatLines(prs)}</div>
        <div className="metric-label">merged prs</div>
      </div>
    </div>
  );
}
