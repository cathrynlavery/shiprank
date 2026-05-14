# ShipRank

Public leaderboard for lines shipped.

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Required production env:

- `AUTH_SECRET`
- `AUTH_GITHUB_ID`
- `AUTH_GITHUB_SECRET`
- `AUTH_URL`
- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`
- `CRON_SECRET`

GitHub OAuth callback:

```text
http://localhost:3000/api/auth/callback/github
https://YOUR_DOMAIN/api/auth/callback/github
```
