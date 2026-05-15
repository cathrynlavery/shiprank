import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { saveUser } from "@/lib/store";

type GitHubProfile = {
  login?: string;
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
      checks: ["none"],
      account(account) {
        return {
          access_token: account.access_token,
          expires_at: account.expires_at,
          refresh_token: account.refresh_token,
          refresh_token_expires_at: account.refresh_token_expires_in
            ? Math.floor(Date.now() / 1000) +
              Number(account.refresh_token_expires_in)
            : undefined,
        };
      },
      authorization: {
        params: {
          scope: "read:user user:email",
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
          accessToken: account.access_token,
          accessTokenExpiresAt: account.expires_at,
          refreshToken: account.refresh_token,
          refreshTokenExpiresAt:
            typeof account.refresh_token_expires_at === "number"
              ? account.refresh_token_expires_at
              : undefined,
          tokenKind: "github-app",
          registeredAt: new Date().toISOString(),
          name: user.name,
          image: user.image,
        });
      } catch (error) {
        console.error(error);
      }

      return true;
    },
    jwt({ token, account, profile }) {
      if (account?.provider === "github") {
        token.githubUsername = (profile as GitHubProfile | undefined)?.login;
        token.githubAccessToken = account.access_token;
        token.githubAccessTokenExpiresAt = account.expires_at;
        token.githubRefreshToken = account.refresh_token;
        token.githubRefreshTokenExpiresAt =
          typeof account.refresh_token_expires_at === "number"
            ? account.refresh_token_expires_at
            : undefined;
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
