import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type SocialFonts = {
  sans: ArrayBuffer;
  sansBold: ArrayBuffer;
  mono: ArrayBuffer;
};

let cached: Promise<SocialFonts> | null = null;

function toArrayBuffer(buffer: Buffer) {
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;
}

export function loadSocialFonts(): Promise<SocialFonts> {
  if (cached) return cached;

  cached = (async () => {
    const geist = toArrayBuffer(
      await readFile(
        join(
          process.cwd(),
          "node_modules",
          "next",
          "dist",
          "compiled",
          "@vercel",
          "og",
          "Geist-Regular.ttf",
        ),
      ),
    );
    return {
      sans: geist,
      sansBold: geist.slice(0),
      mono: geist.slice(0),
    };
  })().catch((error) => {
    cached = null;
    throw error;
  });

  return cached;
}
