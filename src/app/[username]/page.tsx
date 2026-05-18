import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { FirstRefresh } from "@/components/first-refresh";
import { ManualRefreshButton } from "@/components/manual-refresh-button";
import { OAuthStateBanner } from "@/components/oauth-state-banner";
import { StatsPage } from "@/components/stats-page";
import {
  githubFullSettingsUrl,
  signInWithGithubFullEnabled,
} from "@/lib/oauth-config";
import { getStats, getUser } from "@/lib/store";
import { statsDate } from "@/lib/stats-date";

export const dynamic = "force-dynamic";

type UserPageProps = {
  params: Promise<{
    username: string;
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

export default async function UserPage({ params }: UserPageProps) {
  const { username } = await params;
  const [stats, session] = await Promise.all([getStats(username), auth()]);

  if (stats) {
    const isOwnProfile = session?.githubUsername === username;
    const user =
      isOwnProfile ? await getUser(username) : null;
    const oauthState =
      user?.oauth?.revokedAt
        ? "revoked"
        : user?.oauth?.accessToken
          ? "opted-in"
          : "not-opted-in";

    return (
      <StatsPage
        stats={stats}
        ownerControls={
          isOwnProfile ? (
            <>
              <ManualRefreshButton />
              <OAuthStateBanner
                enabled={signInWithGithubFullEnabled()}
                state={oauthState}
                revokedAt={user?.oauth?.revokedAt}
                settingsUrl={githubFullSettingsUrl()}
                username={username}
              />
            </>
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
