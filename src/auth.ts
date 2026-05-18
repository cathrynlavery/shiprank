import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { signInWithGithubFullEnabled } from "@/lib/oauth-config";
import { getUser, saveUser } from "@/lib/store";
import { statsDate } from "@/lib/stats-date";

type GitHubProfile = {
  id?: number | string;
  login?: string;
};

function mapGithubAccount(account: {
  access_token?: string;
  expires_at?: number;
  refresh_token?: string;
  refresh_token_expires_in?: unknown;
}) {
  return {
    access_token: account.access_token,
    expires_at: account.expires_at,
    refresh_token: account.refresh_token,
    refresh_token_expires_at: account.refresh_token_expires_in
      ? Math.floor(Date.now() / 1000) +
        Number(account.refresh_token_expires_in)
      : undefined,
  };
}

const githubProvider = GitHub({
  clientId: process.env.AUTH_GITHUB_ID,
  clientSecret: process.env.AUTH_GITHUB_SECRET,
  checks: ["none"],
  account: mapGithubAccount,
  authorization: {
    params: {
      scope: "read:user user:email",
    },
  },
});

const providers = [githubProvider];

if (signInWithGithubFullEnabled()) {
  providers.push(
    GitHub({
      id: "github-full",
      name: "GitHub Full Visibility",
      clientId: process.env.AUTH_GITHUB_FULL_ID,
      clientSecret: process.env.AUTH_GITHUB_FULL_SECRET,
      account: mapGithubAccount,
      authorization: {
        params: {
          scope: "repo read:user",
        },
      },
    }),
  );
}

function githubProfileId(profile: GitHubProfile | undefined) {
  const id = Number(profile?.id);
  return Number.isFinite(id) ? id : null;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers,
  callbacks: {
    async signIn({ account, profile, user }) {
      if (account?.provider !== "github" && account?.provider !== "github-full") {
        return true;
      }
      if (!account.access_token) return true;

      const githubProfile = profile as GitHubProfile | undefined;
      const username = githubProfile?.login;
      if (!username) return true;

      try {
        const existing = await getUser(username);
        const githubUserId = githubProfileId(githubProfile);
        if (!githubUserId) return true;

        if (
          existing?.githubUserId &&
          existing.githubUserId !== githubUserId
        ) {
          console.error(`github-id mismatch for ${username}`);
          return true;
        }

        if (account.provider === "github") {
          await saveUser({
            ...existing,
            username,
            githubUserId,
            token: account.access_token,
            accessToken: account.access_token,
            accessTokenExpiresAt: account.expires_at,
            refreshToken: account.refresh_token,
            refreshTokenExpiresAt:
              typeof account.refresh_token_expires_at === "number"
                ? account.refresh_token_expires_at
                : undefined,
            tokenKind: "github-app",
            registeredAt: existing?.registeredAt ?? new Date().toISOString(),
            name: user.name,
            image: user.image,
          });
          return true;
        }

        await saveUser({
          ...existing,
          username,
          githubUserId,
          registeredAt: existing?.registeredAt ?? new Date().toISOString(),
          name: user.name ?? existing?.name,
          image: user.image ?? existing?.image,
          byDayInvalidUntil: statsDate(),
          oauth: {
            accessToken: account.access_token,
            accessTokenExpiresAt: account.expires_at,
            refreshToken: account.refresh_token,
            refreshTokenExpiresAt:
              typeof account.refresh_token_expires_at === "number"
                ? account.refresh_token_expires_at
                : undefined,
            grantedAt: new Date().toISOString(),
            scope: account.scope,
          },
        });
      } catch (error) {
        console.error(error);
      }

      return true;
    },
    jwt({ token, account, profile }) {
      if (account?.provider === "github" || account?.provider === "github-full") {
        token.githubUsername = (profile as GitHubProfile | undefined)?.login;
        if (account.provider === "github") {
          token.githubAccessToken = account.access_token;
          token.githubAccessTokenExpiresAt = account.expires_at;
          token.githubRefreshToken = account.refresh_token;
          token.githubRefreshTokenExpiresAt =
            typeof account.refresh_token_expires_at === "number"
              ? account.refresh_token_expires_at
              : undefined;
        }
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
