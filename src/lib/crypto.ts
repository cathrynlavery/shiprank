import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

const PREFIX = "enc:v1:";
const IV_BYTES = 12;
const TAG_BYTES = 16;

function tokenKey(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("TOKEN_ENCRYPTION_KEY is required to encrypt tokens");
  }

  const trimmed = raw.trim();
  const candidates: Buffer[] = [Buffer.from(trimmed, "base64")];
  if (/^[0-9a-f]+$/i.test(trimmed)) {
    candidates.push(Buffer.from(trimmed, "hex"));
  }
  candidates.push(Buffer.from(trimmed, "utf8"));

  const key = candidates.find((value) => value.length === 32);
  if (!key) {
    throw new Error("TOKEN_ENCRYPTION_KEY must decode to 32 bytes");
  }

  return key;
}

export function isEncryptedToken(value: string): boolean {
  return value.startsWith(PREFIX);
}

export function encryptToken(value: string): string {
  if (isEncryptedToken(value)) return value;

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", tokenKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return `${PREFIX}${Buffer.concat([iv, tag, ciphertext]).toString("base64url")}`;
}

export function decryptToken(value: string): {
  value: string;
  migrated: boolean;
} {
  if (!isEncryptedToken(value)) return { value, migrated: true };

  const packed = Buffer.from(value.slice(PREFIX.length), "base64url");
  const iv = packed.subarray(0, IV_BYTES);
  const tag = packed.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ciphertext = packed.subarray(IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv("aes-256-gcm", tokenKey(), iv);
  decipher.setAuthTag(tag);

  return {
    value: Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8"),
    migrated: false,
  };
}
