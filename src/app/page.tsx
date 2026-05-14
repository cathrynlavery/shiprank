import Link from "next/link";
import { auth } from "@/auth";
import { ActivityChart } from "@/components/activity-chart";
import { AuthButton } from "@/components/auth-button";
import { CountUp } from "@/components/count-up";
import { HamburgerMenu } from "@/components/hamburger-menu";
import { MetricStrip } from "@/components/metric-strip";
import { ThemeToggle } from "@/components/theme-toggle";
import { formatLines } from "@/lib/format";
import { getAllStats } from "@/lib/store";
import type { PeriodSummary, RepoStats, StatsPayload } from "@/lib/types";

export const dynamic = "force-dynamic";

type HomeProps = {
  searchParams: Promise<{
    range?: string;
    by?: string;
  }>;
};

type RangeKey = "today" | "yesterday" | "week";

type RangeDef = {
  label: string;
  toggleLabel: string;
  period: (stats: StatsPayload) => PeriodSummary;
  date: (stats: StatsPayload) => string;
};

const RANGES: Record<RangeKey, RangeDef> = {
  today: {
    label: "today",
    toggleLabel: "today",
    period: (s) => s.today,
    date: (s) => s.today.date,
  },
  yesterday: {
    label: "yesterday",
    toggleLabel: "yesterday",
    period: (s) => s.yesterday,
    date: (s) => s.yesterday.date,
  },
  week: {
    label: "this week",
    toggleLabel: "this week",
    period: (s) => s.week,
    date: (s) => s.today.date,
  },
};

const RANGE_ORDER: RangeKey[] = ["today", "yesterday", "week"];

function parseRange(value: string | undefined): RangeKey {
  return (RANGE_ORDER as string[]).includes(value ?? "")
    ? (value as RangeKey)
    : "today";
}

function aggregateByDay(allStats: StatsPayload[]): StatsPayload["byDay"] {
  const out: StatsPayload["byDay"] = {};
  for (const stats of allStats) {
    for (const [date, repos] of Object.entries(stats.byDay)) {
      const bucket: RepoStats = (out[date] ??= {});
      for (const [repoFullName, repoStats] of Object.entries(repos)) {
        const scopedKey = `${stats.username}::${repoFullName}`;
        bucket[scopedKey] = repoStats;
      }
    }
  }
  return out;
}

export default async function Home({ searchParams }: HomeProps) {
  const [{ range, by }, session, allStats] = await Promise.all([
    searchParams,
    auth(),
    getAllStats(),
  ]);
  const mode = parseRange(range);
  const sortBy = by === "prs" ? "prs" : "lines";
  const rangeDef = RANGES[mode];
  const leaderboard = allStats
    .map((stats) => {
      const period = rangeDef.period(stats);
      return {
        username: stats.username,
        lines: period.lines,
        commits: period.commits,
        prs: period.prs,
        deletions: Math.max(0, period.lines - period.net),
        date: rangeDef.date(stats),
      };
    })
    .sort((a, b) =>
      sortBy === "prs" ? b.prs - a.prs || b.lines - a.lines : b.lines - a.lines,
    );

  const leader = leaderboard[0];
  const heroDate = leader?.date ?? new Date().toISOString().slice(0, 10);
  const heroLines = leaderboard.reduce((sum, entry) => sum + entry.lines, 0);
  const heroCommits = leaderboard.reduce(
    (sum, entry) => sum + entry.commits,
    0,
  );
  const heroPrs = leaderboard.reduce((sum, entry) => sum + entry.prs, 0);
  const heroTotal = sortBy === "prs" ? heroPrs : heroLines;
  const devCount = leaderboard.length;
  const collectiveByDay = aggregateByDay(allStats);
  const todayForChart = allStats[0]?.today.date ?? heroDate;

  const noun = sortBy === "prs" ? "prs merged" : "lines shipped";
  const rangeLabel = `${noun} ${rangeDef.label}`;
  const developerCount =
    devCount === 1 ? "1 developer" : `${devCount} developers`;
  const heroSub =
    devCount > 0
      ? `${rangeLabel} · across ${developerCount}${
          leader ? ` · top @${leader.username}` : ""
        }`
      : rangeLabel;

  function buildHref({
    nextRange,
    nextSort,
  }: {
    nextRange?: RangeKey;
    nextSort?: "lines" | "prs";
  }) {
    const params = new URLSearchParams();
    const effectiveRange = nextRange ?? mode;
    const effectiveSort = nextSort ?? sortBy;
    if (effectiveRange !== "today") params.set("range", effectiveRange);
    if (effectiveSort === "prs") params.set("by", "prs");
    const qs = params.toString();
    return qs ? `/?${qs}` : "/";
  }

  return (
    <main className="wrap">
      <div className="topline">
        <div className="handle">
          <Link href="/">
            <span className="wordmark-bold">ship</span>rank
          </Link>
        </div>
        <HamburgerMenu>
          {session?.githubUsername ? (
            <Link className="button" href={`/${session.githubUsername}`}>
              my stats
            </Link>
          ) : null}
          <ThemeToggle />
          <AuthButton session={session} />
        </HamburgerMenu>
      </div>

      <p className="tagline">A public leaderboard for developers who ship.</p>

      <div className="date">{heroDate}</div>
      <div className="hero-num">
        <CountUp value={heroTotal} />
      </div>
      <div className="hero-sub">{heroSub}</div>

      <MetricStrip lines={heroLines} commits={heroCommits} prs={heroPrs} />

      <section className="section">
        <h2 className="section-head">last 7 days</h2>
        <ActivityChart byDay={collectiveByDay} today={todayForChart} />
      </section>

      <section className="section">
        <h2 className="section-head">leaderboard</h2>
        <div className="toggle" aria-label="leaderboard range">
          {RANGE_ORDER.map((key) => (
            <Link
              key={key}
              className={mode === key ? "active" : ""}
              href={buildHref({ nextRange: key })}
            >
              {RANGES[key].toggleLabel}
            </Link>
          ))}
        </div>
        <div className="toggle" aria-label="leaderboard sort">
          <Link
            className={sortBy === "lines" ? "active" : ""}
            href={buildHref({ nextSort: "lines" })}
          >
            by lines
          </Link>
          <Link
            className={sortBy === "prs" ? "active" : ""}
            href={buildHref({ nextSort: "prs" })}
          >
            by prs
          </Link>
        </div>

        {leaderboard.length ? (
          leaderboard.map((entry, index) => {
            const primary =
              sortBy === "prs"
                ? `${formatLines(entry.prs)} prs`
                : `+${formatLines(entry.lines)}`;
            return (
              <Link
                className="row row-link"
                href={`/${entry.username}`}
                key={entry.username}
              >
                <div className="row-main">
                  <span className="label">
                    {String(index + 1).padStart(2, "0")} / @{entry.username}
                  </span>
                  <span className="val">{primary}</span>
                </div>
                <div className="row-detail">
                  <span>{formatLines(entry.commits)} commits</span>
                  <span className="row-detail-sep">·</span>
                  <span>{formatLines(entry.prs)} merged prs</span>
                  <span className="row-detail-sep">·</span>
                  <span>
                    +{formatLines(entry.lines)} / −
                    {formatLines(entry.deletions)}
                  </span>
                </div>
              </Link>
            );
          })
        ) : (
          <p className="empty">nothing yet</p>
        )}
      </section>

      <div className="collapsibles">
        <details className="collapsible">
          <summary className="section-head">privacy</summary>
          <p className="prose">
            Private repository names are never shown publicly. ShipRank only
            shows aggregate totals on the leaderboard. On your profile, private
            repos are replaced with deterministic anonymous names.
          </p>
        </details>

        <details className="collapsible">
          <summary className="section-head">what we store</summary>
          <p className="prose">
            We store your GitHub username, OAuth token, and recent line-count
            stats so daily refreshes can run. Tokens are used only to read your
            repositories and commits for stats generation.
          </p>
        </details>

        <details className="collapsible">
          <summary className="section-head">what we do not show</summary>
          <p className="prose">
            We do not publish private repo names, commit messages, file names,
            code, or diffs.
          </p>
        </details>
      </div>
    </main>
  );
}
