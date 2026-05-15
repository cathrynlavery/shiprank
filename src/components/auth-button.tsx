import type { Session } from "next-auth";
import Link from "next/link";
import { signOutUser } from "@/app/actions";

export function AuthButton({
  session,
  isRegistered = false,
}: {
  session: Session | null;
  isRegistered?: boolean;
}) {
  if (session?.githubUsername) {
    if (isRegistered) return null;

    return (
      <form action={signOutUser}>
        <button className="button" type="submit">
          sign out
        </button>
      </form>
    );
  }

  return (
    <Link className="button cta-button" href="/connect">
      join
    </Link>
  );
}
