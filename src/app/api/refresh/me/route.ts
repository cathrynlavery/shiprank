import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { refreshUserStats } from "@/lib/github";
import { getUser, saveStats } from "@/lib/store";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST() {
  const session = await auth();
  const username = session?.githubUsername;
  if (!username) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const user = await getUser(username);
  if (!user?.token) {
    return NextResponse.json({ error: "no token" }, { status: 404 });
  }

  try {
    const stats = await refreshUserStats(username, user.token);
    await saveStats(stats);
    return NextResponse.json({ ok: true, generated: stats.generated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
