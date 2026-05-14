import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { refreshUserStats } from "@/lib/github";
import { saveStats, saveUser } from "@/lib/store";

type GitHubProfile = {
  login?: string;
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    GitHub({
      authorization: {
        params: {
          scope: "read:user user:email repo",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ account, profile, user }) {
      if (account?.provider !== "github" || !account.access_token) return true;

      const username = (profile as GitHubProfile | undefined)?.login;
      if (!username) return true;

      try {
        await saveUser({
          username,
          token: account.access_token,
          registeredAt: new Date().toISOString(),
          name: user.name,
          image: user.image,
        });
        const stats = await refreshUserStats(username, account.access_token);
        await saveStats(stats);
      } catch (error) {
        console.error(error);
      }

      return true;
    },
    jwt({ token, account, profile }) {
      if (account?.provider === "github") {
        token.githubUsername = (profile as GitHubProfile | undefined)?.login;
      }

      return token;
    },
    session({ session, token }) {
      session.githubUsername =
        typeof token.githubUsername === "string"
          ? token.githubUsername
          : undefined;
      return session;
    },
  },
});
