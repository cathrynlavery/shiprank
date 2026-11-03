# ShipRank storage migration

Neon stores the existing key/value payloads in `shiprank_entries`. User token
ciphertext, stats history, daily token-read audit lists and absolute expiration
times keep their existing formats. The app still needs its original
`TOKEN_ENCRYPTION_KEY`; never replace it during this migration. The import tool
does not need that key and never decrypts tokens. It rejects plaintext token
fields instead of copying them into Neon.

## Configuration

- `SHIPRANK_STORAGE_BACKEND=neon` selects Neon and requires `DATABASE_URL`.
- `SHIPRANK_STORAGE_BACKEND=redis` explicitly selects the old KV store and requires
  both `KV_REST_API_URL` and `KV_REST_API_TOKEN`. This is the temporary migration
  and rollback path, not an automatic fallback.
- `SHIPRANK_STORAGE_READ_ONLY=1` pauses all application storage writes. Public
  stats reads continue. OAuth sign-in is declined, refresh lock acquisition
  returns false, and saves fail with a read-only error. Audit appends, lazy token
  rewrites, lock releases and expiration cleanup also stop. Manual refresh
  requests return HTTP 503 with a maintenance message.
- Local development without remote storage configuration still uses the local
  file. `SHIPRANK_USE_LOCAL_STORE=1` forces it, including local previews.

Production fails closed if its backend is missing, unknown or lacks credentials.
Do not set `DATABASE_URL` or any token variable with a `NEXT_PUBLIC_` prefix.

## Cutover

1. Review and deploy this code with backend `redis` and read-only mode enabled.
   Keep the existing auth secret and token encryption key unchanged.
2. Pause scheduled refresh triggers and confirm public reads still work. Wait at
   least 800 seconds after the last old deployment request before copying data:
   an in-flight refresh can outlive a deployment and otherwise write after the
   snapshot. The importer refuses active `refresh-lock:*` keys.
3. Supply `KV_REST_API_URL`, `KV_REST_API_TOKEN` and the new `DATABASE_URL` to the
   importer directly from the process environment or a secret-manager consumer.
   Do not print them, put them in command-line arguments or commit an export.
   Run `node scripts/migrate-kv-to-neon.mjs` for a read-only dry-run. This scans to
   cursor zero, deduplicates keys, validates the supported types and token
   ciphertext format, checks the Neon connection, and repeats the source scan to
   detect changes. Only aggregate counts are printed.
4. With writes actually paused, set `SHIPRANK_MIGRATION_SOURCE_PAUSED=1` for the
   importer and run it with `--write`. It creates the schema from
   `scripts/neon-schema.sql`, inserts missing rows without overwriting any live
   row (expired rows can be replaced), repeats the source scan, then compares all live destination
   values and expirations with the source. Conflicting destination data stops
   the run. A partial failed copy can be rerun while the source remains paused.
5. Run the importer with `--verify` and require `destinationVerified: true`.
   Deployment credentials should use the pooled Neon connection URL. Switch the
   application backend to `neon`, retaining read-only mode, then verify the live
   leaderboard and owner profile. Confirm token decryption works using the
   unchanged application key. Do not use a new key to "fix" decryption failures.
6. Remove read-only mode, restore the refresh schedule, and verify a refresh and
   a login write on the live application. Only then retire the old KV resource
   and remove the temporary Redis adapter/dependency in a follow-up change.

Before Neon writes resume, rollback is backend `redis` with the source intact.
After Neon has accepted new writes, switching back blindly can lose those
updates: pause writes and reconcile them first. This change deletes nothing from
Redis and does not change Vercel or Neon account settings by itself.

### When Redis reads are blocked by its request quota

A provider RDB export can supply the snapshot without Redis REST requests or a
paid plan change. Keep the export private (file mode 600, directory mode 700),
preserve its checksum and load it only into a compatible, isolated Redis process
with TCP disabled and a private Unix socket. Never restore it into shared Redis,
change its header to bypass compatibility checks, or print its contents or raw
loader errors. A private consumer can adapt the export to `sourceSnapshot`, then
reuse `writeRows` and `sameRows`; the CLI itself still expects Redis REST.

To restore reads while preparing the final write freeze:

1. Verify the immutable export against the isolated rehearsal copy, including
   every live value and absolute expiration. Preseed the unused production Neon
   database only after confirming it is empty. Verify that seed against the same
   export. An export taken before the freeze is a provisional seed, not proof
   that live-source writes have stopped.
2. Pause scheduled refresh triggers, retain the original auth secret and token
   encryption key, and deploy backend `neon` with read-only mode enabled against
   the seeded production database. Confirm the live leaderboard and owner
   profile load and the unchanged key decrypts tokens. Keep sign-in and refresh
   writes paused. This restores reads while the source is quota-blocked.
3. Confirm the old deployment can no longer start write requests, then drain its
   in-flight requests for at least 800 seconds. Obtain a fresh provider RDB export
   after that drain and compare all live values and absolute expirations with
   the production Neon database. Preserve both datasets and keep read-only mode
   enabled if any difference appears; reconcile the drift and verify equality
   before proceeding. Never blindly overwrite conflicting destination rows.
4. Only after the fresh, frozen-source comparison passes, remove read-only mode
   and complete the live login/refresh checks from the normal cutover procedure.
   Preserve Redis and the exports until those checks pass. After Neon accepts
   writes, the same reconciliation requirement applies to any rollback.

## Expiration and checks

Expired rows are excluded from every read and lock conflict check. The existing
scheduled refresh also deletes physically expired rows, so expired cache and
audit data is removed on its next run (up to the refresh schedule's overnight
gap, rather than Redis's immediate TTL eviction).

`npm test` exercises backend selection, maintenance writes, encryption, cursor
completion, source drift, expiry comparisons and import validation. For actual
SQL/lock behavior, supply an isolated Neon test branch as
`SHIPRANK_TEST_DATABASE_URL` and run
`npx vitest run src/lib/neon-store.integration.test.ts`. This test creates the
table and cleans its own rows; its expiration test also purges expired rows, so
never point it at production.

Run `src/lib/kv-migration.integration.test.ts` against a separate empty test
database to exercise partial-copy reruns, live-row conflict refusal and expired
row replacement using the importer's actual SQL write path.

Live import, deployment and user-flow checks are still required; unit tests do
not establish that the migration has happened.
