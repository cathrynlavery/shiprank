import { repoLabelSecret } from "@/lib/crypto";
import { redactPrivateRepoNames } from "@/lib/redact-stats";
import { getStats } from "@/lib/store";
import {
  buildReposCardData,
  buildTodayCardData,
  buildWeekCardData,
} from "@/lib/social/data";
import {
  loadSvgFontCss,
  reposCardSvg,
  todayCardSvg,
  weekCardSvg,
} from "@/lib/social/svg";
import { isSocialCardType } from "@/lib/social/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  const rawStats = await getStats(username);
  if (!rawStats) {
    return new Response("Stats not found.", { status: 404 });
  }

  // Cards are public and meant to be posted anywhere, so they always use the
  // same masked labels non-owners see on the profile page.
  const stats = redactPrivateRepoNames(rawStats, repoLabelSecret());
  const fontCss = await loadSvgFontCss();
  const body =
    cardType === "today"
      ? todayCardSvg(buildTodayCardData(stats), fontCss)
      : cardType === "week"
        ? weekCardSvg(buildWeekCardData(stats), fontCss)
        : reposCardSvg(buildReposCardData(stats), fontCss);

  return new Response(body, {
    headers: {
      "cache-control": "public, s-maxage=300, stale-while-revalidate=86400",
      "content-type": "image/svg+xml; charset=utf-8",
    },
  });
}
