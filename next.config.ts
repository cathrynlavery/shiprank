import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  // Both card routes read font files by name at runtime. Tracing picks them up
  // today, but it is inferring the path; state it so a 500 on the share cards
  // can never depend on that inference.
  outputFileTracingIncludes: {
    "/[username]/opengraph-image": ["src/lib/social/fonts/**/*"],
    "/api/users/[username]/social/[cardType]": ["src/lib/social/fonts/**/*"],
  },
};

export default nextConfig;
