import { notFound } from "next/navigation";
import { StatsPage } from "@/components/stats-page";
import { getStats } from "@/lib/store";

export const dynamic = "force-dynamic";

type UserPageProps = {
  params: Promise<{
    username: string;
  }>;
};

export default async function UserPage({ params }: UserPageProps) {
  const { username } = await params;
  const stats = await getStats(username);

  if (!stats) notFound();

  return <StatsPage stats={stats} />;
}
