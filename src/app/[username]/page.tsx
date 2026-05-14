import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { FirstRefresh } from "@/components/first-refresh";
import { StatsPage } from "@/components/stats-page";
import { getStats, getUser } from "@/lib/store";

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
  const date = stats?.today.date ?? new Date().toISOString().slice(0, 10);
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

  if (stats) return <StatsPage stats={stats} />;

  if (session?.githubUsername === username) {
    const user = await getUser(username);
    if (user) return <FirstRefresh username={username} />;
  }

  notFound();
}
