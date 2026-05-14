import type { Session } from "next-auth";
import { signInWithGithub, signOutUser } from "@/app/actions";

export function AuthButton({ session }: { session: Session | null }) {
  if (session?.githubUsername) {
    return (
      <form action={signOutUser}>
        <button className="button" type="submit">
          sign out
        </button>
      </form>
    );
  }

  return (
    <form action={signInWithGithub}>
      <button className="button" type="submit">
        add yourself
      </button>
    </form>
  );
}
