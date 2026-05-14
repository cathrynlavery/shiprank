import { NextResponse } from "next/server";
import { refreshUserStats } from "@/lib/github";
import { getAllUsers, saveStats } from "@/lib/store";

export const maxDuration = 300;

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
      const stats = await refreshUserStats(user.username, user.token);
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
