import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { FirstRefresh } from "@/components/first-refresh";
import { ManualRefreshButton } from "@/components/manual-refresh-button";
import { OAuthStateBanner } from "@/components/oauth-state-banner";
import { PrivateNamesNotice } from "@/components/private-names-notice";
import { StatsPage } from "@/components/stats-page";
import { repoLabelSecret } from "@/lib/crypto";
import {
  githubFullSettingsUrl,
  signInWithGithubFullEnabled,
} from "@/lib/oauth-config";
import {
  collectPrivateRepoNames,
  redactPrivateRepoNames,
} from "@/lib/redact-stats";
import { getStats, getUser } from "@/lib/store";
import { dayAdditionTotals } from "@/lib/stats-totals";
import { statsDate } from "@/lib/stats-date";

export const dynamic = "force-dynamic";

type UserPageProps = {
  params: Promise<{
    username: string;
  }>;
  searchParams: Promise<{
    view?: string;
    reconnected?: string;
  }>;
};

export async function generateMetadata({
  params,
}: UserPageProps): Promise<Metadata> {
  const { username } = await params;
  const stats = await getStats(username);
  const total = stats?.today.lines ?? 0;
  const date = stats?.today.date ?? statsDate();
  const lines = total > 0 ? `+${total.toLocaleString("en-US")}` : "tracking";
  const title = `@${username} · ${lines} lines shipped`;
  const description = `${lines} lines shipped on ${date} · ShipRank`;
  const url = `https://shiprank.dev/${username}`;

  return {
    title,
    description,
    openGraph: { title, description, url, type: "profile" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function UserPage({
  params,
  searchParams,
}: UserPageProps) {
  const [{ username }, { view, reconnected }] = await Promise.all([
    params,
    searchParams,
  ]);
  const [rawStats, session] = await Promise.all([getStats(username), auth()]);

  if (rawStats) {
    const isOwner = session?.githubUsername === username;
    // ?view=public renders the owner's page through the exact visitor path.
    const isOwnProfile = isOwner && view !== "public";
    const stats = isOwnProfile
      ? rawStats
      : redactPrivateRepoNames(rawStats, repoLabelSecret());
    const dayTotals = dayAdditionTotals(stats.byDay);
    const user = isOwnProfile ? await getUser(username) : null;
    const oauthState =
      user?.oauth?.revokedAt
        ? "revoked"
        : user?.oauth?.accessToken
          ? "opted-in"
          : "not-opted-in";

    return (
      <StatsPage
        stats={stats}
        dayTotals={dayTotals}
        revealNames={isOwnProfile}
        repoNotice={
          isOwner && collectPrivateRepoNames(rawStats).size > 0 ? (
            <PrivateNamesNotice
              username={username}
              previewing={!isOwnProfile}
            />
          ) : null
        }
        ownerTopControls={
          isOwnProfile ? (
            <ManualRefreshButton autoStart={reconnected === "1"} />
          ) : null
        }
        ownerBottomControls={
          isOwnProfile ? (
            <OAuthStateBanner
              enabled={signInWithGithubFullEnabled()}
              state={oauthState}
              grantedAt={user?.oauth?.grantedAt}
              revokedAt={user?.oauth?.revokedAt}
              settingsUrl={githubFullSettingsUrl()}
              username={username}
            />
          ) : null
        }
      />
    );
  }

  if (session?.githubUsername === username) {
    const user = await getUser(username);
    if (user) return <FirstRefresh username={username} />;
  }

  notFound();
}
