import { signIn } from "@/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  await signIn("github", { redirectTo: "/me" });
}
