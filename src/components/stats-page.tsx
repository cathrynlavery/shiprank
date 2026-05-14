import Link from "next/link";
import { ActivityChart } from "@/components/activity-chart";
import { RepoList } from "@/components/repo-list";
import { ShareButton } from "@/components/share-button";
import { formatLines, signedLines } from "@/lib/format";
import type { PeriodSummary, StatsPayload } from "@/lib/types";

function MetricStrip({ summary }: { summary: PeriodSummary }) {
  return (
    <div className="metrics">
      <div className="metric">
        <div className="metric-val">{signedLines(summary.lines)}</div>
        <div className="metric-label">lines</div>
      </div>
      <div className="metric">
        <div className="metric-val">{formatLines(summary.commits)}</div>
        <div className="metric-label">commits</div>
      </div>
      <div className="metric">
        <div className="metric-val">{formatLines(summary.prs)}</div>
        <div className="metric-label">merged prs</div>
      </div>
    </div>
  );
}

export function StatsPage({ stats }: { stats: StatsPayload }) {
  return (
    <main className="wrap">
      <div className="topline">
        <div className="handle">
          <Link href="/">
            <span className="wordmark-bold">ship</span>rank
          </Link>
        </div>
        <ShareButton
          username={stats.username}
          total={stats.today.lines}
          date={stats.today.date}
        />
      </div>

      <div className="handle">
        <a href={`https://github.com/${stats.username}`}>@{stats.username}</a>
      </div>
      <div className="date">{stats.today.date}</div>
      <div className="hero-num">{signedLines(stats.today.lines)}</div>
      <div className="hero-sub">lines shipped today</div>

      <MetricStrip summary={stats.today} />

      <section className="section">
        <h2 className="section-head">last 7 days</h2>
        <ActivityChart byDay={stats.byDay} today={stats.today.date} />
      </section>

      <section className="section">
        <h2 className="section-head">today by project</h2>
        <RepoList repos={stats.today.byRepo} />
      </section>

      <section className="section">
        <h2 className="section-head">this week</h2>
        <div className="sub-num">+{formatLines(stats.week.lines)}</div>
        <div className="hero-sub">lines total</div>
        <MetricStrip summary={stats.week} />
        <RepoList repos={stats.week.byRepo} limit={8} />
      </section>

      <p className="contact">Stats refresh daily at 08:00 UTC.</p>

      <div className="permalink">
        <a href={`https://github.com/${stats.username}`}>github profile</a>
      </div>
    </main>
  );
}
