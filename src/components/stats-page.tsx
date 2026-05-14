import { ActivityChart } from "@/components/activity-chart";
import { RepoList } from "@/components/repo-list";
import { formatLines, signedLines } from "@/lib/format";
import type { StatsPayload } from "@/lib/types";

export function StatsPage({ stats }: { stats: StatsPayload }) {
  return (
    <main className="wrap">
      <div className="handle">
        <a href={`https://github.com/${stats.username}`}>@{stats.username}</a>
      </div>
      <div className="date">{stats.today.date}</div>
      <div className="hero-num">{signedLines(stats.today.total)}</div>
      <div className="hero-sub">lines shipped today</div>

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
        <div className="sub-num">+{formatLines(stats.week.total)}</div>
        <div className="hero-sub">lines total</div>
        <RepoList repos={stats.week.byRepo} limit={8} />
      </section>

      <div className="permalink">
        <a href={`https://github.com/${stats.username}`}>github profile</a>
      </div>
    </main>
  );
}
