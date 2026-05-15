import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    githubUsername?: string;
    user?: DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    githubUsername?: string;
    githubAccessToken?: string;
    githubAccessTokenExpiresAt?: number;
    githubRefreshToken?: string;
    githubRefreshTokenExpiresAt?: number;
  }
}
