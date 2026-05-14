import { redirect } from "next/navigation";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (session?.githubUsername) {
    redirect(`/${session.githubUsername}`);
  }
  redirect("/");
}
