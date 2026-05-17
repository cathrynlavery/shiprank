import Link from "next/link";
import { GitHubPermissionNotice } from "@/components/github-permission-notice";
import { ShareButton } from "@/components/share-button";
import { StatsTabs } from "@/components/stats-tabs";
import { UpdateTimestamp } from "@/components/update-timestamp";
import type { StatsPayload } from "@/lib/types";

export function StatsPage({
  stats,
  showPermissionNotice = false,
}: {
  stats: StatsPayload;
  showPermissionNotice?: boolean;
}) {
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
      {showPermissionNotice ? <GitHubPermissionNotice /> : null}
      <StatsTabs stats={stats} />
    </main>
  );
}
