import type { NextRequest } from "next/server";
import { auth, signIn } from "@/auth";
import { statsDate } from "@/lib/stats-date";
import { getUser, isStorageReadOnly, saveUser } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  let redirectTo = "/me";

  // GitHub adds setup_action after an App install or repo-access update. New
  // repos can hold older commits, so rebuild the existing profile's history.
  // "request" means a non-admin only asked an org owner, so nothing changed.
  const action = request.nextUrl.searchParams.get("setup_action");
  if (action === "install" || action === "update") {
    const username = (await auth())?.githubUsername;
    const user = username ? await getUser(username) : null;
    if (user && !isStorageReadOnly()) {
      await saveUser({ ...user, byDayInvalidUntil: statsDate() });
      redirectTo = "/me?reconnected=1";
    }
  }

  await signIn("github", { redirectTo });
}
