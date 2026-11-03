import { neon } from "@neondatabase/serverless";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { acquireLock, appendAudit, getValue, listValues, purgeExpired, releaseLock, setValue } from "./neon-store";

const url = process.env.SHIPRANK_TEST_DATABASE_URL;

describe.skipIf(!url)("Neon integration (isolated test database only)", () => {
  const prefix = `integration:${randomUUID()}:`;
  const sql = url ? neon(url) : null;

  beforeAll(async () => {
    vi.stubEnv("DATABASE_URL", url!);
    const schema = await readFile(new URL("../../scripts/neon-schema.sql", import.meta.url), "utf8");
    for (const statement of schema.split(";").filter((part) => part.trim())) await sql!.query(statement);
  });

  afterAll(async () => {
    await sql!`DELETE FROM shiprank_entries WHERE starts_with(key, ${prefix})`;
    vi.unstubAllEnvs();
  });

  it("round-trips JSON and replaces expiration on permanent writes", async () => {
    await setValue(`${prefix}value`, { nested: { token: "encrypted-fixture" } }, 60);
    await setValue(`${prefix}value`, { nested: { token: "encrypted-fixture" } });
    await expect(getValue(`${prefix}value`)).resolves.toEqual({ nested: { token: "encrypted-fixture" } });
    const rows = await sql!`SELECT expires_at FROM shiprank_entries WHERE key = ${prefix + "value"}`;
    expect(rows[0].expires_at).toBeNull();
  });

  it("permits exactly one concurrent lock owner and reclaims expired locks", async () => {
    const lock = `${prefix}lock`;
    const results = await Promise.all(Array.from({ length: 8 }, () => acquireLock(lock, 300)));
    expect(results.filter(Boolean)).toHaveLength(1);
    await sql!`UPDATE shiprank_entries SET expires_at = now() - interval '1 second' WHERE key = ${lock}`;
    await expect(acquireLock(lock, 300)).resolves.toBe(true);
    await releaseLock(lock);
    await expect(acquireLock(lock, 300)).resolves.toBe(true);
  });

  it("hides expired records and retains concurrent audit appends in list order", async () => {
    const expired = `${prefix}expired`, audit = `${prefix}audit`;
    await setValue(expired, "old", 60);
    await sql!`UPDATE shiprank_entries SET expires_at = now() - interval '1 second' WHERE key = ${expired}`;
    await expect(getValue(expired)).resolves.toBeNull();
    await expect(listValues(expired)).resolves.toEqual([]);
    await Promise.all([appendAudit(audit, "first", 7776000), appendAudit(audit, "second", 7776000)]);
    expect(await getValue<string[]>(audit)).toEqual(expect.arrayContaining(["first", "second"]));
    await appendAudit(audit, "latest", 7776000);
    expect((await getValue<string[]>(audit))?.[0]).toBe("latest");
    await purgeExpired();
    const rows = await sql!`SELECT key FROM shiprank_entries WHERE key = ${expired}`;
    expect(rows).toHaveLength(0);
  });
});
