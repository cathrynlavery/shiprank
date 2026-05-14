import Link from "next/link";
import { auth } from "@/auth";
import { AuthButton } from "@/components/auth-button";
import { CountUp } from "@/components/count-up";
import { ThemeToggle } from "@/components/theme-toggle";
import { formatLines } from "@/lib/format";
import { getAllStats } from "@/lib/store";

export const dynamic = "force-dynamic";

type HomeProps = {
  searchParams: Promise<{
    range?: string;
  }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const [{ range }, session, allStats] = await Promise.all([
    searchParams,
    auth(),
    getAllStats(),
  ]);
  const mode = range === "week" ? "week" : "today";
  const leaderboard = allStats
    .map((stats) => ({
      username: stats.username,
      total: mode === "week" ? stats.week.lines : stats.today.lines,
      today: stats.today.lines,
      week: stats.week.lines,
      date: stats.today.date,
    }))
    .sort((a, b) => b.total - a.total);
  const leader = leaderboard[0];
  const today = leader?.date ?? new Date().toISOString().slice(0, 10);
  const heroTotal = leaderboard.reduce((sum, entry) => sum + entry.total, 0);
  const devCount = leaderboard.length;

  const rangeLabel =
    mode === "week" ? "lines shipped this week" : "lines shipped today";
  const developerCount =
    devCount === 1 ? "1 developer" : `${devCount} developers`;
  const heroSub =
    devCount > 0
      ? `${rangeLabel} · across ${developerCount}${
          leader ? ` · top @${leader.username}` : ""
        }`
      : rangeLabel;

  return (
    <main className="wrap">
      <div className="topline">
        <div className="handle">
          <Link href="/">
            <span className="wordmark-bold">ship</span>rank
          </Link>
        </div>
        <div className="topline-actions">
          <ThemeToggle />
          <AuthButton session={session} />
        </div>
      </div>

      <p className="tagline">A public leaderboard for developers who ship.</p>

      <div className="date">{today}</div>
      <div className="hero-num">
        <CountUp value={heroTotal} />
      </div>
      <div className="hero-sub">{heroSub}</div>

      <section className="section">
        <h2 className="section-head">leaderboard</h2>
        <div className="toggle" aria-label="leaderboard range">
          <Link className={mode === "today" ? "active" : ""} href="/">
            today
          </Link>
          <Link className={mode === "week" ? "active" : ""} href="/?range=week">
            this week
          </Link>
        </div>

        {leaderboard.length ? (
          leaderboard.map((entry, index) => (
            <Link
              className="row row-link"
              href={`/${entry.username}`}
              key={entry.username}
            >
              <span className="label">
                {String(index + 1).padStart(2, "0")} / @{entry.username}
              </span>
              <span className="val">+{formatLines(entry.total)}</span>
            </Link>
          ))
        ) : (
          <p className="empty">nothing yet</p>
        )}
      </section>

      <section className="section">
        <h2 className="section-head">privacy</h2>
        <p className="prose">
          Private repository names are never shown publicly. ShipRank only shows
          aggregate totals on the leaderboard. On your profile, private repos
          are replaced with deterministic anonymous names.
        </p>
      </section>

      <section className="section">
        <h2 className="section-head">what we store</h2>
        <p className="prose">
          We store your GitHub username, OAuth token, and recent line-count
          stats so daily refreshes can run. Tokens are used only to read your
          repositories and commits for stats generation.
        </p>
      </section>

      <section className="section">
        <h2 className="section-head">what we do not show</h2>
        <p className="prose">
          We do not publish private repo names, commit messages, file names,
          code, or diffs.
        </p>
      </section>

      <p className="contact">Stats refresh daily at 08:00 UTC.</p>
      <p className="contact">
        Questions or removal requests:{" "}
        <a href="mailto:hello@shiprank.dev">hello@shiprank.dev</a>
      </p>

      {session?.githubUsername ? (
        <div className="permalink">
          <Link href={`/${session.githubUsername}`}>your stats</Link>
        </div>
      ) : null}
    </main>
  );
}
