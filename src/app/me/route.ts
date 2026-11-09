import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (session?.githubUsername) {
    // Returning from a GitHub App install/update: recount with the new repos.
    const reconnected =
      request.nextUrl.searchParams.get("reconnected") === "1"
        ? "?reconnected=1"
        : "";
    redirect(`/${session.githubUsername}${reconnected}`);
  }
  redirect("/");
}
