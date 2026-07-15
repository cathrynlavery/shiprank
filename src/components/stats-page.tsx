import Link from "next/link";
import { ShareButton } from "@/components/share-button";
import { StatsTabs, type StatsTabsPayload } from "@/components/stats-tabs";
import { UpdateTimestamp } from "@/components/update-timestamp";
import type { DayTotals } from "@/lib/stats-totals";
import type { StatsPayload } from "@/lib/types";
import type { ReactNode } from "react";

export function StatsPage({
  stats,
  dayTotals,
  revealNames = false,
  ownerTopControls,
  ownerBottomControls,
}: {
  stats: StatsPayload;
  dayTotals: DayTotals;
  revealNames?: boolean;
  ownerTopControls?: ReactNode;
  ownerBottomControls?: ReactNode;
}) {
  const statsForTabs = {
    username: stats.username,
    generated: stats.generated,
    today: stats.today,
    yesterday: stats.yesterday,
    week: stats.week,
    total: stats.total,
    byDayCommits: stats.byDayCommits,
  } satisfies StatsTabsPayload;

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

      <div className="profile-identity">
        <div className="profile-kicker">github user</div>
        <a
          href={`https://github.com/${stats.username}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          @{stats.username}
        </a>
      </div>
      <UpdateTimestamp generated={stats.generated} />
      {ownerTopControls}
      <StatsTabs
        stats={statsForTabs}
        dayTotals={dayTotals}
        revealNames={revealNames}
      />
      {ownerBottomControls}
    </main>
  );
}
