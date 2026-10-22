import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { refreshUserStats } from "@/lib/github";
import { isGitHubRateLimit } from "@/lib/github-token";
import {
  acquireRefreshLock,
  getUser,
  releaseRefreshLock,
  saveStats,
  saveUser,
} from "@/lib/store";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST() {
  const session = await auth();
  const username = session?.githubUsername;
  if (!username) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const user = await getUser(username);
  if (!user?.token && !user?.oauth?.accessToken) {
    return NextResponse.json({ error: "no token" }, { status: 404 });
  }

  if (!(await acquireRefreshLock(username))) {
    return NextResponse.json(
      { error: "a refresh is already running. give it a minute, then reload." },
      { status: 409 },
    );
  }

  try {
    const { stats, user: updatedUser } = await refreshUserStats(user);
    if (updatedUser !== user) await saveUser(updatedUser);
    await saveStats(stats);
    return NextResponse.json({ ok: true, generated: stats.generated });
  } catch (error) {
    if (isGitHubRateLimit(error)) {
      return NextResponse.json(
        {
          error:
            "github is rate limiting your account. your stats are safe. wait a few minutes, then refresh again.",
        },
        { status: 429 },
      );
    }
    const message = error instanceof Error ? error.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await releaseRefreshLock(username);
  }
}
