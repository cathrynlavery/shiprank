import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { neon } from "@neondatabase/serverless";
import { acquireLock, appendAudit, getValue, listValues, setValue } from "./neon-store";

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("@neondatabase/serverless", () => ({ neon: vi.fn(() => query) }));

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "postgres://test:test@db.example.test/shiprank");
  query.mockResolvedValue([]);
});
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe("Neon storage", () => {
  it("fails closed when the selected backend has no database URL", async () => {
    vi.stubEnv("DATABASE_URL", undefined);
    await expect(getValue("user:ada")).rejects.toThrow("DATABASE_URL is required");
    expect(neon).not.toHaveBeenCalled();
  });

  it("passes sensitive values as query parameters and excludes expired reads", async () => {
    query.mockResolvedValueOnce([{ value: { private: true } }]);
    await expect(getValue("user:quote'ada")).resolves.toEqual({ private: true });
    const [sql, ...parameters] = query.mock.calls[0];
    expect(sql.join("")).toContain("expires_at > now()");
    expect(sql.join("")).not.toContain("quote'ada");
    expect(parameters).toEqual(["user:quote'ada"]);
  });

  it("sets cache TTLs, rejects invalid TTLs, and preserves false/zero values", async () => {
    await setValue("pr-count:ada", 0, 60);
    expect(query.mock.calls[0].slice(1)).toEqual(["pr-count:ada", "0", 60, 60]);
    await expect(setValue("pr-count:ada", 1, 0)).rejects.toThrow("TTL must be positive");
    query.mockResolvedValueOnce([{ value: false }]);
    await expect(getValue("flag")).resolves.toBe(false);
  });

  it("uses a conditional conflict update for atomic lock acquisition", async () => {
    query.mockResolvedValueOnce([{ key: "refresh-lock:ada" }]).mockResolvedValueOnce([]);
    await expect(acquireLock("refresh-lock:ada", 300)).resolves.toBe(true);
    await expect(acquireLock("refresh-lock:ada", 300)).resolves.toBe(false);
    expect(query.mock.calls[0][0].join("")).toContain("WHERE shiprank_entries.expires_at <= now()");
  });

  it("reads literal prefixes and atomically prepends audit entries with retention", async () => {
    query.mockResolvedValueOnce([{ value: { username: "ada" } }]);
    await expect(listValues("user:_%")).resolves.toEqual([{ username: "ada" }]);
    expect(query.mock.calls[0][0].join("")).toContain("starts_with(key,");
    await appendAudit("audit:token-reads:2026-11-03", "entry", 7776000);
    expect(query.mock.calls[1].slice(1)).toEqual(["audit:token-reads:2026-11-03", '["entry"]', 7776000]);
    expect(query.mock.calls[1][0].join("")).toContain("EXCLUDED.value || shiprank_entries.value");
  });
});
