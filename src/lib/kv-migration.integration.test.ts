import { neon } from "@neondatabase/serverless";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sameRows, writeRows } from "../../scripts/migrate-kv-to-neon.mjs";

const url = process.env.SHIPRANK_TEST_DATABASE_URL;

describe.skipIf(!url)("Importer writes (empty isolated test database only)", () => {
  const prefix = `integration:${randomUUID()}:`;
  const sql = url ? neon(url) : null;
  const destination = async () => {
    const rows = await sql!`SELECT key, value, expires_at FROM shiprank_entries WHERE expires_at IS NULL OR expires_at > now()`;
    return new Map(rows.map((row) => [row.key, {
      value: row.value, expiresAt: row.expires_at === null ? null : new Date(row.expires_at).getTime(),
    }]));
  };

  beforeAll(async () => {
    const schema = await readFile(new URL("../../scripts/neon-schema.sql", import.meta.url), "utf8");
    for (const statement of schema.split(";").filter((part) => part.trim())) await sql!.query(statement);
    expect(await destination()).toEqual(new Map());
  });

  afterAll(async () => {
    await sql!`DELETE FROM shiprank_entries WHERE starts_with(key, ${prefix})`;
  });

  it("resumes partial batches, preserves live rows, replaces expired rows and refuses conflicts", async () => {
    const source = new Map(Array.from({ length: 101 }, (_, i) => [
      `${prefix}${i}`, { value: { nested: [i, "ciphertext-fixture", "quote'\""] },
        expiresAt: i % 2 ? Date.now() + 60000 : null },
    ]));
    await writeRows(sql, new Map([...source].slice(0, 50)), await destination());
    await writeRows(sql, source, await destination());
    expect(sameRows(source, await destination())).toBe(true);
    await writeRows(sql, source, await destination());
    expect(sameRows(source, await destination())).toBe(true);

    const key = `${prefix}0`;
    await sql!`UPDATE shiprank_entries SET expires_at = now() - interval '1 second' WHERE key = ${key}`;
    source.set(key, { value: { nested: [99, "replacement", "permanent"] }, expiresAt: null });
    await writeRows(sql, source, await destination());
    expect(sameRows(source, await destination())).toBe(true);

    const beforeConcurrentWrite = await destination();
    await sql!`UPDATE shiprank_entries SET value = '{"conflict":true}'::jsonb WHERE key = ${key}`;
    await writeRows(sql, source, beforeConcurrentWrite);
    const rows = await sql!`SELECT value FROM shiprank_entries WHERE key = ${key}`;
    expect(rows[0].value).toEqual({ conflict: true });
    await expect(writeRows(sql, source, await destination())).rejects.toThrow("conflicting data");
  });
});
