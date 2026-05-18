import { describe, expect, it, vi, beforeEach } from "vitest";
import { decryptToken, encryptToken, isEncryptedToken } from "@/lib/crypto";
import { decryptUserFromStorage, isStoredTokenEncrypted } from "@/lib/store";
import type { StoredUser } from "@/lib/types";

describe("token encryption", () => {
  beforeEach(() => {
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", "12345678901234567890123456789012");
  });

  it("round-trips a token", () => {
    const encrypted = encryptToken("secret-token");
    expect(isEncryptedToken(encrypted)).toBe(true);
    expect(isStoredTokenEncrypted(encrypted)).toBe(true);
    expect(decryptToken(encrypted)).toEqual({
      value: "secret-token",
      migrated: false,
    });
  });

  it("treats plaintext values as lazy migration candidates", () => {
    const raw: StoredUser = {
      username: "ada",
      registeredAt: "2026-05-18T00:00:00.000Z",
      token: "plain-app-token",
      oauth: {
        accessToken: "plain-oauth-token",
        grantedAt: "2026-05-18T00:00:00.000Z",
      },
    };

    const result = decryptUserFromStorage(raw);
    expect(result.migrated).toBe(true);
    expect(result.user.token).toBe("plain-app-token");
    expect(result.user.oauth?.accessToken).toBe("plain-oauth-token");
  });
});
