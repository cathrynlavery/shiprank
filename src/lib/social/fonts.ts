export type SocialFonts = {
  sans: ArrayBuffer;
  sansBold: ArrayBuffer;
  mono: ArrayBuffer;
};

type FontSpec = {
  family: string;
  weight: number;
};

const SPECS: Record<keyof SocialFonts, FontSpec> = {
  sans: { family: "Geist", weight: 400 },
  sansBold: { family: "Geist", weight: 700 },
  mono: { family: "Geist Mono", weight: 400 },
};

const CSS_UA = "Mozilla/5.0";

let cached: Promise<SocialFonts> | null = null;

async function fetchFontUrlFromCss({ family, weight }: FontSpec) {
  const familyParam = encodeURIComponent(family);
  const cssUrl = `https://fonts.googleapis.com/css2?family=${familyParam}:wght@${weight}&display=swap`;
  const response = await fetch(cssUrl, {
    headers: {
      "user-agent": CSS_UA,
    },
    cache: "force-cache",
  });

  if (!response.ok) {
    throw new Error(`Could not load font CSS for ${family}: ${response.status}`);
  }

  const css = await response.text();
  const match = css.match(/url\((https:\/\/[^)]+\.ttf)\)/);
  if (!match) throw new Error(`Could not extract font URL for ${family}`);
  return match[1];
}

async function fetchFontBuffer(spec: FontSpec) {
  const fontUrl = await fetchFontUrlFromCss(spec);
  const response = await fetch(fontUrl, { cache: "force-cache" });

  if (!response.ok) {
    throw new Error(`Could not load font ${fontUrl}: ${response.status}`);
  }

  return response.arrayBuffer();
}

export function loadSocialFonts(): Promise<SocialFonts> {
  if (cached) return cached;

  cached = (async () => {
    const entries = await Promise.all(
      (Object.entries(SPECS) as Array<[keyof SocialFonts, FontSpec]>).map(
        async ([key, spec]) => [key, await fetchFontBuffer(spec)] as const,
      ),
    );
    const fonts = {} as SocialFonts;
    for (const [key, buffer] of entries) fonts[key] = buffer;
    return fonts;
  })().catch((error) => {
    cached = null;
    throw error;
  });

  return cached;
}
