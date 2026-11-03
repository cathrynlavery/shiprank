import { neon } from "@neondatabase/serverless";

function sql() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for ShipRank storage");
  }
  return neon(process.env.DATABASE_URL);
}

export async function getValue<T>(key: string): Promise<T | null> {
  const rows = await sql()`
    SELECT value FROM shiprank_entries
    WHERE key = ${key} AND (expires_at IS NULL OR expires_at > now())
  `;
  return (rows[0]?.value as T | undefined) ?? null;
}

export async function setValue(key: string, value: unknown, ttlSeconds?: number) {
  if (ttlSeconds !== undefined && (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0)) {
    throw new Error("Storage TTL must be positive");
  }
  await sql()`
    INSERT INTO shiprank_entries (key, value, expires_at)
    VALUES (${key}, ${JSON.stringify(value)}::jsonb,
      CASE WHEN ${ttlSeconds ?? null}::double precision IS NULL THEN NULL
        ELSE now() + ${ttlSeconds ?? null}::double precision * interval '1 second' END)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, expires_at = EXCLUDED.expires_at
  `;
}

export async function listValues<T>(prefix: string): Promise<T[]> {
  const rows = await sql()`
    SELECT value FROM shiprank_entries
    WHERE starts_with(key, ${prefix}) AND (expires_at IS NULL OR expires_at > now())
    ORDER BY key
  `;
  return rows.map((row) => row.value as T);
}

export async function appendAudit(key: string, entry: string, ttlSeconds: number) {
  await sql()`
    INSERT INTO shiprank_entries (key, value, expires_at)
    VALUES (${key}, ${JSON.stringify([entry])}::jsonb,
      now() + ${ttlSeconds}::double precision * interval '1 second')
    ON CONFLICT (key) DO UPDATE SET
      value = CASE WHEN shiprank_entries.expires_at <= now() THEN EXCLUDED.value
        ELSE EXCLUDED.value || shiprank_entries.value END,
      expires_at = EXCLUDED.expires_at
  `;
}

export async function acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
  const rows = await sql()`
    INSERT INTO shiprank_entries (key, value, expires_at)
    VALUES (${key}, '"1"'::jsonb, now() + ${ttlSeconds}::double precision * interval '1 second')
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, expires_at = EXCLUDED.expires_at
      WHERE shiprank_entries.expires_at <= now()
    RETURNING key
  `;
  return rows.length === 1;
}

export async function releaseLock(key: string) {
  await sql()`DELETE FROM shiprank_entries WHERE key = ${key}`;
}

export async function purgeExpired() {
  await sql()`DELETE FROM shiprank_entries WHERE expires_at <= now()`;
}
