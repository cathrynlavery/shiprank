import { afterEach, describe, expect, it, vi } from "vitest";
import { sourceSnapshot, sameRows } from "../../scripts/migrate-kv-to-neon.mjs";
import { encryptToken } from "@/lib/crypto";

afterEach(() => vi.unstubAllEnvs());

describe("Redis migration snapshot", () => {
  it("walks cursors to zero, deduplicates keys, preserves ciphertext/list order and absolute TTL", async () => {
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", "12345678901234567890123456789012");
    const user = { username: "ada", token: encryptToken("example-token") };
    const audit = [JSON.stringify({ fields: ["token"], readAt: "2026-11-03" })];
    const command = vi.fn(async (cmd: unknown[]) => {
      if (cmd[0] === "SCAN") return cmd[1] === "0"
        ? ["42", ["user:ada", "audit:token-reads:2026-11-03"]]
        : ["0", ["user:ada"]];
      return (cmd as string[][]).map(([operation, key]) => {
        if (operation === "TIME") return ["100", "500000"];
        if (operation === "TYPE") return key.startsWith("audit:") ? "list" : "string";
        if (operation === "PTTL") return key.startsWith("audit:") ? 60000 : -1;
        return key.startsWith("audit:") ? audit : JSON.stringify(user);
      });
    });
    const rows = await sourceSnapshot(command, () => 0);
    expect(command.mock.calls.filter(([cmd]) => cmd[0] === "SCAN")).toHaveLength(2);
    expect(rows.size).toBe(2);
    expect(rows.get("user:ada")).toEqual({ value: user, expiresAt: null });
    expect(rows.get("audit:token-reads:2026-11-03")).toEqual({ value: audit, expiresAt: 160500 });
    vi.unstubAllEnvs();
    expect(sameRows(rows, rows, 0)).toBe(true);
  });

  it("rejects plaintext tokens before any destination operation", async () => {
    const command = vi.fn(async (cmd: unknown[]) => {
      if (cmd[0] === "SCAN") return ["0", ["user:ada"]];
      return [["100", "0"], "string", -1, JSON.stringify({ username: "ada", oauth: { accessToken: "plaintext" } })];
    });
    await expect(sourceSnapshot(command)).rejects.toThrow("token encryption");
  });

  it("fails closed for active refresh locks and unexpected data types", async () => {
    const command = vi.fn(async (cmd: unknown[]) => {
      if (cmd[0] === "SCAN") return ["0", ["refresh-lock:ada"]];
      return [["100", "0"], "string", 60000, "1"];
    });
    await expect(sourceSnapshot(command, () => 0)).rejects.toThrow("Refresh still running");
    const wrongType = async (cmd: unknown[]) => cmd[0] === "SCAN" ? ["0", ["user:ada"]] : [["100", "0"], "hash", -1, "invalid"];
    await expect(sourceSnapshot(wrongType)).rejects.toThrow("Unexpected Redis data type");
  });

  it("detects changing data and ignores entries that expired during verification", () => {
    const source = new Map([["stats:ada", { value: { lines: 1 }, expiresAt: null }]]);
    const changed = new Map([["stats:ada", { value: { lines: 2 }, expiresAt: null }]]);
    expect(sameRows(source, changed)).toBe(false);
    expect(sameRows(new Map([["pr-count:a", { value: 1, expiresAt: 10 }]]), new Map(), 11)).toBe(true);
  });

  it("rejects non-terminating cursor sequences", async () => {
    await expect(sourceSnapshot(async () => ["9", []])).rejects.toThrow("cursor repeated");
  });

  it("batches cache reads and keeps multi-key transaction responses aligned", async () => {
    const keys = Array.from({ length: 205 }, (_, i) => `commit-stats:repo:${i}`);
    const command = vi.fn(async (cmd: unknown[]) => {
      if (cmd[0] === "SCAN") return ["0", keys];
      return (cmd as string[][]).map(([operation, key]) => {
        if (operation === "TIME") return ["100", "0"];
        if (operation === "TYPE") return "string";
        if (operation === "PTTL") return 60000;
        return JSON.stringify({ additions: Number(key.split(":")[2]), deletions: 0 });
      });
    });
    const rows = await sourceSnapshot(command, () => 0);
    expect(rows.size).toBe(205);
    expect(rows.get("commit-stats:repo:204")?.value).toEqual({ additions: 204, deletions: 0 });
    const batches = command.mock.calls.filter(([cmd]) => Array.isArray(cmd[0]));
    expect(batches).toHaveLength(3);
    expect(batches.every(([cmd]) => cmd.length <= 301)).toBe(true);
  });
});
