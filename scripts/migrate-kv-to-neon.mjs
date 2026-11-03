import { neon } from "@neondatabase/serverless";
import { readFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import { pathToFileURL } from "node:url";

const tokenFields = ["token", "accessToken", "refreshToken"];

export function userTokens(value, transform) {
  const user = structuredClone(value);
  if (!user || typeof user !== "object" || typeof user.username !== "string") {
    throw new Error("Invalid source user record");
  }
  for (const field of tokenFields) {
    if (user[field]) user[field] = transform(user[field]);
  }
  if (user.oauth) {
    for (const field of ["accessToken", "refreshToken"]) {
      if (user.oauth[field]) user.oauth[field] = transform(user.oauth[field]);
    }
  }
  return user;
}

function canonicalValue(key, value) {
  return key.startsWith("user:")
    ? userTokens(value, (token) => {
      if (typeof token !== "string" || !/^enc:v1:[A-Za-z0-9_-]+$/.test(token) || Buffer.from(token.slice(7), "base64url").length < 28) {
        throw new Error("Invalid token encryption in migration data; repair the affected store before migrating");
      }
      return token;
    })
    : value;
}

export async function sourceSnapshot(command, now = Date.now) {
  const keys = new Set();
  const cursors = new Set();
  let cursor = "0";
  do {
    const scan = await command(["SCAN", cursor, "COUNT", "500"]);
    if (!Array.isArray(scan) || scan.length !== 2 || !Array.isArray(scan[1])) {
      throw new Error("Invalid Redis SCAN response");
    }
    cursor = String(scan[0]);
    for (const key of scan[1]) {
      if (typeof key !== "string") throw new Error("Invalid Redis key");
      keys.add(key);
    }
    if (cursor !== "0" && cursors.has(cursor)) throw new Error("Redis SCAN cursor repeated");
    cursors.add(cursor);
  } while (cursor !== "0");

  const rows = new Map();
  for (const key of keys) {
    if (!/^(user:|stats:|commit-stats:|pr-count:|audit:token-reads:|refresh-lock:)/.test(key)) {
      throw new Error("Unexpected Redis key prefix; migration stopped");
    }
  }
  const large = (key) => key.startsWith("stats:") || key.startsWith("audit:");
  const batches = [];
  for (const [group, size] of [[true, 10], [false, 100]]) {
    const groupKeys = [...keys].filter((key) => large(key) === group).sort();
    for (let i = 0; i < groupKeys.length; i += size) batches.push(groupKeys.slice(i, i + size));
  }
  for (let i = 0; i < batches.length; i += 4) {
    await Promise.all(batches.slice(i, i + 4).map(async (batch) => {
      const commands = [["TIME"]];
      for (const key of batch) commands.push(["TYPE", key], ["PTTL", key],
        key.startsWith("audit:") ? ["LRANGE", key, "0", "-1"] : ["GET", key]);
      const result = await command(commands);
      if (!Array.isArray(result) || result.length !== commands.length || !Array.isArray(result[0])) {
        throw new Error("Invalid Redis transaction response");
      }
      const time = Number(result[0][0]) * 1000 + Number(result[0][1]) / 1000;
      if (!Number.isFinite(time)) throw new Error("Invalid Redis server time");
      for (let offset = 0; offset < batch.length; offset++) {
        const key = batch[offset], [type, ttl, raw] = result.slice(offset * 3 + 1, offset * 3 + 4);
        if (type === "none" || ttl === -2 || raw === null) continue;
        if (type !== (key.startsWith("audit:") ? "list" : "string")) {
          throw new Error("Unexpected Redis data type; migration stopped");
        }
        if (!Number.isFinite(ttl) || ttl < -1) throw new Error("Invalid Redis expiration metadata");
        const expiresAt = ttl === -1 ? null : time + ttl;
        if (expiresAt !== null && expiresAt <= now()) continue;
        if (key.startsWith("refresh-lock:")) {
          throw new Error("Refresh still running; pause source writes and let refresh locks drain");
        }
        let value = raw;
        if (type === "string") {
          try { value = JSON.parse(raw); } catch { /* Redis also stores bare timestamp strings. */ }
        } else if (!Array.isArray(raw) || !raw.every((entry) => typeof entry === "string")) {
          throw new Error("Invalid Redis audit list");
        }
        canonicalValue(key, value);
        rows.set(key, { value, expiresAt });
      }
    }));
  }
  return rows;
}

export function sameRows(expected, actual, now = Date.now()) {
  const live = (rows) => new Map([...rows].filter(([, row]) => row.expiresAt === null || row.expiresAt > now));
  const a = live(expected), b = live(actual);
  if (a.size !== b.size) return false;
  return [...a].every(([key, row]) => {
    const other = b.get(key);
    return other && isDeepStrictEqual(canonicalValue(key, row.value), canonicalValue(key, other.value)) &&
      (row.expiresAt === null ? other.expiresAt === null : other.expiresAt !== null && Math.abs(row.expiresAt - other.expiresAt) <= 100);
  });
}

export async function writeRows(sql, source, existing) {
  for (const [key, row] of existing) {
    if (!source.has(key) || !sameRows(new Map([[key, source.get(key)]]), new Map([[key, row]]))) {
      throw new Error("Destination contains conflicting data; nothing was overwritten");
    }
  }
  const entries = [...source].map(([key, row]) => ({ key, value: row.value,
    expires_at: row.expiresAt === null ? null : new Date(row.expiresAt).toISOString() }));
  for (let i = 0; i < entries.length; i += 100) {
    await sql`
      INSERT INTO shiprank_entries (key, value, expires_at)
      SELECT key, value, expires_at FROM jsonb_to_recordset(${JSON.stringify(entries.slice(i, i + 100))}::jsonb)
        AS imported(key text, value jsonb, expires_at timestamptz)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, expires_at = EXCLUDED.expires_at
        WHERE shiprank_entries.expires_at <= now()
    `;
  }
}

async function main() {
  const flags = process.argv.slice(2);
  if (flags.some((flag) => !["--write", "--verify"].includes(flag)) || (flags.includes("--write") && flags.includes("--verify"))) {
    throw new Error("Use no flags for dry-run, --write to import, or --verify to compare");
  }
  const write = flags.includes("--write"), verify = flags.includes("--verify");
  for (const name of ["KV_REST_API_URL", "KV_REST_API_TOKEN", "DATABASE_URL"]) {
    if (!process.env[name]) throw new Error(`Missing ${name}`);
  }
  if (write && process.env.SHIPRANK_MIGRATION_SOURCE_PAUSED !== "1") {
    throw new Error("--write requires SHIPRANK_MIGRATION_SOURCE_PAUSED=1 after pausing all source writes");
  }
  const endpoint = new URL(process.env.KV_REST_API_URL);
  if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password) {
    throw new Error("Redis REST endpoint must use HTTPS without URL credentials");
  }
  const command = async (commands) => {
    const transaction = Array.isArray(commands[0]);
    const response = await fetch(new URL(transaction ? "/multi-exec" : "/", endpoint), {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(commands),
    });
    if (!response.ok) throw new Error(`Redis REST request failed (${response.status})`);
    const payload = await response.json();
    const results = transaction ? payload : [payload];
    if (!Array.isArray(results) || results.some((row) => row.error || !("result" in row))) {
      throw new Error("Redis command failed; response withheld to protect stored data");
    }
    return transaction ? results.map((row) => row.result) : results[0].result;
  };
  const source = await sourceSnapshot(command);
  const sql = neon(process.env.DATABASE_URL);
  await sql`SELECT 1`;
  if (write) {
    const schema = await readFile(new URL("./neon-schema.sql", import.meta.url), "utf8");
    for (const statement of schema.split(";").filter((part) => part.trim())) await sql.query(statement);
  }
  const destination = async () => {
    const rows = await sql`SELECT key, value, expires_at FROM shiprank_entries WHERE expires_at IS NULL OR expires_at > now()`;
    return new Map(rows.map((row) => [row.key, { value: row.value, expiresAt: row.expires_at === null ? null : new Date(row.expires_at).getTime() }]));
  };
  if (write) await writeRows(sql, source, await destination());
  const sourceAfter = await sourceSnapshot(command);
  if (!sameRows(source, sourceAfter)) throw new Error("Source changed during migration; keep source active and retry after pausing writes");
  if ((write || verify) && !sameRows(sourceAfter, await destination())) {
    throw new Error("Destination verification failed; do not cut over");
  }
  const counts = {};
  for (const key of sourceAfter.keys()) {
    const group = key.startsWith("audit:") ? "audit" : key.split(":")[0];
    counts[group] = (counts[group] ?? 0) + 1;
  }
  console.log(JSON.stringify({ mode: write ? "write-and-verify" : verify ? "verify" : "dry-run", keys: sourceAfter.size, counts, sourceStable: true, destinationVerified: write || verify, rawDataPrinted: false }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    const safeMessages = /^(Use no flags|Missing |--write requires|Redis REST|Redis command|Invalid |Unexpected |Refresh still|Destination |Source changed|TOKEN_ENCRYPTION_KEY)/;
    console.error(safeMessages.test(error.message) ? error.message : "Migration failed; details withheld to protect credentials and stored data");
    process.exitCode = 1;
  });
}
