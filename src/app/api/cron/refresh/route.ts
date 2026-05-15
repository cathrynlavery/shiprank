import { NextResponse } from "next/server";
import { refreshUserStats } from "@/lib/github";
import { getUsableGitHubToken } from "@/lib/github-token";
import { getAllUsers, saveStats, saveUser } from "@/lib/store";

export const maxDuration = 800;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const users = await getAllUsers();
  const results = [];

  for (const user of users) {
    try {
      const { user: updatedUser, token } = await getUsableGitHubToken(user);
      if (updatedUser !== user) await saveUser(updatedUser);

      const stats = await refreshUserStats(user.username, token);
      await saveStats(stats);
      results.push({ username: user.username, ok: true });
    } catch (error) {
      results.push({
        username: user.username,
        ok: false,
        error: error instanceof Error ? error.message : "unknown error",
      });
    }
  }

  return NextResponse.json({
    refreshed: results.filter((result) => result.ok).length,
    total: users.length,
    results,
  });
}
