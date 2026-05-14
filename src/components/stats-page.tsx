import Link from "next/link";
import { ActivityChart } from "@/components/activity-chart";
import { MetricStrip } from "@/components/metric-strip";
import { RepoList } from "@/components/repo-list";
import { ShareButton } from "@/components/share-button";
import { formatLines, signedLines } from "@/lib/format";
import type { StatsPayload } from "@/lib/types";

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

      <MetricStrip
        lines={stats.today.lines}
        commits={stats.today.commits}
        prs={stats.today.prs}
      />

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
        <MetricStrip
          lines={stats.week.lines}
          commits={stats.week.commits}
          prs={stats.week.prs}
        />
        <RepoList repos={stats.week.byRepo} limit={8} />
      </section>

      <p className="contact">Stats refresh daily at 08:00 UTC.</p>

      <div className="permalink">
        <a href={`https://github.com/${stats.username}`}>github profile</a>
      </div>
    </main>
  );
}
