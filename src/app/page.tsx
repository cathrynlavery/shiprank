import Link from "next/link";
import { auth } from "@/auth";
import { AuthButton } from "@/components/auth-button";
import { formatLines, signedLines } from "@/lib/format";
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
      total: mode === "week" ? stats.week.total : stats.today.total,
      today: stats.today.total,
      week: stats.week.total,
      date: stats.today.date,
    }))
    .sort((a, b) => b.total - a.total);
  const leader = leaderboard[0];
  const today = leader?.date ?? new Date().toISOString().slice(0, 10);

  return (
    <main className="wrap">
      <div className="topline">
        <div className="handle">
          <Link href="/">ShipRank</Link>
        </div>
        <AuthButton session={session} />
      </div>

      <div className="date">{today}</div>
      <div className="hero-num">{leader ? signedLines(leader.total) : "0"}</div>
      <div className="hero-sub">
        {mode === "week" ? "top lines this week" : "top lines today"}
      </div>

      <section className="section">
        <h2 className="section-head">leaderboard</h2>
        <div className="toggle" aria-label="leaderboard range">
          <Link className={mode === "today" ? "active" : ""} href="/">
            today
          </Link>
          <Link
            className={mode === "week" ? "active" : ""}
            href="/?range=week"
          >
            this week
          </Link>
        </div>

        {leaderboard.length ? (
          leaderboard.map((entry, index) => (
            <Link className="row row-link" href={`/${entry.username}`} key={entry.username}>
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

      {session?.githubUsername ? (
        <div className="permalink">
          <Link href={`/${session.githubUsername}`}>your stats</Link>
        </div>
      ) : null}
    </main>
  );
}
