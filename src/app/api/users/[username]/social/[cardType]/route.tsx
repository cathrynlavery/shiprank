import { ImageResponse } from "next/og";
import { getStats } from "@/lib/store";
import {
  buildReposCardData,
  buildTodayCardData,
  buildWeekCardData,
} from "@/lib/social/data";
import { loadSocialFonts } from "@/lib/social/fonts";
import {
  ReposCard,
  TodayCard,
  WeekCard,
} from "@/lib/social/cards";
import { isSocialCardType } from "@/lib/social/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const size = { width: 1080, height: 1080 };
const CACHE_TTL_MS = 5 * 60 * 1000;
const imageCache = new Map<string, { body: ArrayBuffer; expiresAt: number }>();

type RouteParams = {
  params: Promise<{
    username: string;
    cardType: string;
  }>;
};

export async function GET(_request: Request, { params }: RouteParams) {
  const { username, cardType } = await params;

  if (!isSocialCardType(cardType)) {
    return new Response("Unknown card type.", { status: 404 });
  }

  const stats = await getStats(username);
  if (!stats) {
    return new Response("Stats not found.", { status: 404 });
  }

  const cacheKey = `${username}:${cardType}:${stats.generated}`;
  const cached = imageCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return new Response(cached.body, {
      headers: {
        "cache-control": "public, s-maxage=300, stale-while-revalidate=86400",
        "content-type": "image/png",
      },
    });
  }

  const fonts = await loadSocialFonts();
  const element =
    cardType === "today" ? (
      <TodayCard {...buildTodayCardData(stats)} />
    ) : cardType === "week" ? (
      <WeekCard {...buildWeekCardData(stats)} />
    ) : (
      <ReposCard {...buildReposCardData(stats)} />
    );

  const response = new ImageResponse(element, {
    ...size,
    fonts: [
      { name: "Geist", data: fonts.sans, weight: 400, style: "normal" },
      { name: "Geist", data: fonts.sansBold, weight: 700, style: "normal" },
      { name: "Geist Mono", data: fonts.mono, weight: 400, style: "normal" },
    ],
    headers: {
      "cache-control": "public, s-maxage=300, stale-while-revalidate=86400",
    },
  });
  const body = await response.arrayBuffer();
  imageCache.set(cacheKey, { body, expiresAt: Date.now() + CACHE_TTL_MS });

  return new Response(body, {
    headers: response.headers,
    status: response.status,
    statusText: response.statusText,
  });
}
