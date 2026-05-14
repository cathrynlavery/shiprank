# shiprank

A public leaderboard for developers who ship.

**Live at [shiprank.dev](https://shiprank.dev).**

GitHub login → daily count of lines added across every repo you commit to → ranked against every other developer on the board. No vanity metrics, no algorithm, no "engagement." Just who shipped what.

## What you see

```
+118,747
LINES SHIPPED TODAY · ACROSS 2 DEVELOPERS · TOP @CATHRYNLAVERY
```

Plus a 7-day activity chart, a today / this week toggle, per-profile breakdowns (commits, merged PRs, lines added vs removed), and a share card you can post to Twitter.

## Privacy

Private repos count toward your total, but their contents stay private:

- Private repo names show as deterministic sci-fi codenames (_Stellar Voyager 7f3_, _Eclipse Marauder 2a9_).
- The leaderboard only shows aggregate totals — no per-repo breakdown.
- Commit messages, file names, code, and diffs are never published.
- OAuth tokens are stored in Vercel KV and used only to read repos for line counting.

## Stack

- Next.js 16 App Router · TypeScript
- Auth.js v5 (GitHub OAuth, scopes: `repo read:user user:email`)
- Vercel KV (Upstash Redis)
- Vercel Cron — daily refresh at 08:00 UTC
- `next/og` for Twitter / OG share cards
- Geist + Geist Mono, dark/light mode, no CSS framework

Visual style is Visualize Value: black, white, monospace, thin 1px rules, single max-width column.

## Run it yourself

```bash
git clone https://github.com/cathrynlavery/shiprank.git
cd shiprank
npm install
cp .env.example .env.local
# fill in the values (see below)
npm run dev
```

GitHub OAuth callback URLs (set both on your GitHub OAuth app):

```
http://localhost:3000/api/auth/callback/github
https://your-deployment.vercel.app/api/auth/callback/github
```

## Env

| Var                  | What                                                |
| -------------------- | --------------------------------------------------- |
| `AUTH_SECRET`        | `openssl rand -hex 32`                              |
| `AUTH_GITHUB_ID`     | GitHub OAuth app client ID                          |
| `AUTH_GITHUB_SECRET` | GitHub OAuth app secret                             |
| `AUTH_URL`           | Deployed URL (or `http://localhost:3000` in dev)    |
| `KV_REST_API_URL`    | Vercel KV / Upstash Redis REST URL                  |
| `KV_REST_API_TOKEN`  | KV access token                                     |
| `CRON_SECRET`        | Random string used to authorize `/api/cron/refresh` |

## Manual refresh

The daily cron is configured in `vercel.json`. To force a refresh:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://your-domain/api/cron/refresh
```

## Built by

[Cathryn Lavery](https://twitter.com/cathrynlavery). PRs and issues welcome.
