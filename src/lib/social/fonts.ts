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

async function loadFont(file: string) {
  return toArrayBuffer(
    await readFile(join(process.cwd(), "src", "lib", "social", "fonts", file)),
  );
}

export function loadSocialFonts(): Promise<SocialFonts> {
  if (cached) return cached;

  cached = (async () => {
    const [sans, sansBold, mono] = await Promise.all([
      loadFont("Geist-Regular.ttf"),
      loadFont("Geist-Bold.ttf"),
      loadFont("GeistMono-Regular.ttf"),
    ]);
    return { sans, sansBold, mono };
  })().catch((error) => {
    cached = null;
    throw error;
  });

  return cached;
}
