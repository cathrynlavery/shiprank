# shiprank

A public leaderboard for people who ship.

**Live at [shiprank.dev](https://shiprank.dev).**

GitHub login → daily count of lines added across every repo you commit to → ranked against every other builder on the board. No vanity metrics, no algorithm, no "engagement." Just who shipped what.

## What you see

```
+118,747
LINES SHIPPED · ACROSS 2 BUILDERS · TOP @CATHRYNLAVERY
```

Plus a 7-day activity chart, a today / yesterday / this week toggle, per-profile breakdowns (commits, merged PRs, lines added vs removed), and a share card you can post to Twitter.

## Privacy

Private repos count toward your total, but their contents stay private:

- Private repo names show as deterministic sci-fi codenames (_Stellar Voyager 7f3_, _Eclipse Marauder 2a9_).
- The leaderboard only shows aggregate totals — no per-repo breakdown.
- Commit messages, file names, code, and diffs are never published.
- GitHub tokens are stored in Vercel KV and used only for read-only stats generation.

## Stack

- Next.js 16 App Router · TypeScript
- Auth.js v5 (GitHub sign-in, scopes: `read:user user:email`)
- Vercel KV (Upstash Redis)
- GitHub Actions scheduled refreshes every 2 hours from 8 AM to midnight Central
- SVG share cards with browser-side PNG export, plus `next/og` profile cards
- Geist + Geist Mono, dark/light mode, no CSS framework

Visual style is Visualize Value: black, white, monospace, thin 1px rules, single max-width column.

## Run it yourself

```bash
git clone https://github.com/cathrynlavery/shiprank.git
cd shiprank
npm install
npm run setup:local
# fill in AUTH_GITHUB_ID and AUTH_GITHUB_SECRET in .env.local
npm run dev
```

The default local server uses Next's webpack dev bundler on `127.0.0.1` with a
768 MB Node heap cap. Turbopack can use substantially more memory in this app
when the browser reconnects and preloads profile/share-image routes. If you
specifically need to debug Turbopack behavior, run `npm run dev:turbo`.

For lightweight local testing without hot reload, use:

```bash
npm run preview
```

This creates a memory-capped production build and starts it on `127.0.0.1:3000`
with `.local-data/shiprank-store.json` enabled automatically. The running server
uses substantially less memory than `next dev`; rerun the command after source
changes. If the build already exists, `npm run start:local` skips the rebuild.

For local testing, create a GitHub App and set these URLs:

```
Homepage URL: http://localhost:3000
Callback URL: http://localhost:3000/api/auth/callback/github
Setup URL: http://localhost:3000/api/github/setup
```

Enable "Redirect on update" for the setup URL if you want repository selection
changes to return to ShipRank. The setup URL is where GitHub returns after App
installation; the callback URL is where GitHub returns after user authorization.

Then copy these from the GitHub App settings into `.env.local`:

```
AUTH_GITHUB_ID=<Client ID>
AUTH_GITHUB_SECRET=<Client secret>
GITHUB_APP_SLUG=<app slug>
```

GitHub OAuth callback URLs for deployments:

```
http://localhost:3000/api/auth/callback/github
https://your-deployment.vercel.app/api/auth/callback/github
```

Vercel KV is optional in development. If `KV_REST_API_URL` and
`KV_REST_API_TOKEN` are empty, `npm run dev` stores users, tokens, and stats in
`.local-data/shiprank-store.json`. Delete that file to reset local state.

## Env

| Var                  | What                                                |
| -------------------- | --------------------------------------------------- |
| `AUTH_SECRET`        | `openssl rand -hex 32`                              |
| `AUTH_GITHUB_ID`     | GitHub App client ID                                |
| `AUTH_GITHUB_SECRET` | GitHub App client secret                            |
| `GITHUB_APP_SLUG`    | GitHub App slug for repository installation links   |
| `AUTH_URL`           | Deployed URL (or `http://localhost:3000` in dev)    |
| `KV_REST_API_URL`    | Optional in dev; Vercel KV / Upstash Redis REST URL |
| `KV_REST_API_TOKEN`  | Optional in dev; KV access token                    |
| `CRON_SECRET`        | Random string used to authorize `/api/cron/refresh` |

## Manual refresh

GitHub Actions runs `.github/workflows/refresh-numbers.yml` hourly and only
calls the refresh endpoint during the America/Chicago windows for 8 AM, 10 AM,
12 PM, 2 PM, 4 PM, 6 PM, 8 PM, 10 PM, and midnight. Add a repository secret
named `CRON_SECRET` with the same value used by the deployment. If the endpoint
is not `https://shiprank.dev/api/cron/refresh`, set a repository variable named
`SHIPRANK_REFRESH_URL`.

`vercel.json` keeps a daily Vercel Cron fallback at 05:01 UTC. Vercel Hobby
cron jobs are limited to daily schedules, so the more frequent refresh cadence
runs from GitHub Actions instead.

To force a refresh:

```bash
curl -fsSL -H "Authorization: Bearer $CRON_SECRET" https://your-domain/api/cron/refresh
```

Run this once after any deploy that adds a new period to `StatsPayload` (e.g. `yesterday`, `month`) so existing users get the new fields populated before the next scheduled cron.

## Built by

[Cathryn Lavery](https://twitter.com/cathrynlavery). PRs and issues welcome.
