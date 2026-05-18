# KV Token Breach Playbook

Use this if Vercel KV contents, backups, logs, or credentials may have exposed
stored GitHub tokens.

## Immediate Containment

1. Rotate `KV_REST_API_TOKEN` and restrict Vercel project access.
2. Disable scheduled refreshes by removing or changing `CRON_SECRET`.
3. Preserve KV audit keys matching `audit:token-reads:*` for investigation.

## Revoke GitHub Access

1. Revoke ShipRank Full Visibility OAuth grants through GitHub's application
   authorization API or the GitHub developer settings UI.
2. Rotate the GitHub App client secret used by `AUTH_GITHUB_SECRET`.
3. Rotate `AUTH_GITHUB_FULL_SECRET`.

## Rotate Encryption

1. Generate a new 32-byte `TOKEN_ENCRYPTION_KEY`.
2. Store it in Vercel and the team password manager.
3. Do not delete the old key until all affected grants have been revoked.
   Existing encrypted values cannot be decrypted after the key changes.

## Force Re-Auth

1. Remove token fields from each `user:*` KV record:
   `token`, `accessToken`, `refreshToken`, and `oauth`.
2. Keep public stats records unless they contain incident-specific evidence.
3. Ask users to reconnect the GitHub App and, if needed, re-grant Full
   Visibility.

## Post-Incident Checks

1. Confirm no plaintext tokens appear in Vercel logs or local debug output.
2. Review Vercel KV access and remove unnecessary members.
3. Re-enable cron only after a test user can refresh successfully.
