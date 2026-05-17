import { NextResponse } from "next/server";
import { mapWithConcurrency } from "@/lib/concurrency";
import { refreshUserStats } from "@/lib/github";
import { getUsableGitHubToken } from "@/lib/github-token";
import { getAllUsers, saveStats, saveUser } from "@/lib/store";
import type { StoredUser } from "@/lib/types";

export const maxDuration = 800;

const USER_REFRESH_CONCURRENCY = 3;

type RefreshResult = {
  username: string;
  ok: boolean;
  error?: string;
};

async function refreshStoredUser(user: StoredUser): Promise<RefreshResult> {
  try {
    const { user: updatedUser, token } = await getUsableGitHubToken(user);
    if (updatedUser !== user) await saveUser(updatedUser);

    const stats = await refreshUserStats(user.username, token);
    await saveStats(stats);
    return { username: user.username, ok: true };
  } catch (error) {
    return {
      username: user.username,
      ok: false,
      error: error instanceof Error ? error.message : "unknown error",
    };
  }
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const users = await getAllUsers();
  const results = await mapWithConcurrency(
    users,
    USER_REFRESH_CONCURRENCY,
    refreshStoredUser,
  );

  return NextResponse.json({
    refreshed: results.filter((result) => result.ok).length,
    total: users.length,
    results,
  });
}
