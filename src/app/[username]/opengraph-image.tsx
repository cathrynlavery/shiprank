import { ImageResponse } from "next/og";
import { getStats } from "@/lib/store";
import { statsDate } from "@/lib/stats-date";
import { ProfileOgCard } from "@/lib/social/cards";
import { buildProfileOgData } from "@/lib/social/data";
import { loadSocialFonts } from "@/lib/social/fonts";

export const runtime = "nodejs";
export const contentType = "image/png";
export const size = { width: 1200, height: 630 };
export const alt = "ShipRank — lines shipped";

type Props = { params: Promise<{ username: string }> };

export default async function OpengraphImage({ params }: Props) {
  const { username } = await params;
  const stats = await getStats(username);
  const fonts = await loadSocialFonts();
  const data = stats
    ? buildProfileOgData(stats)
    : {
        username,
        date: statsDate(),
        lines: "0",
        stats: [
          { label: "net", value: "0" },
          { label: "commits", value: "0" },
          { label: "merged prs", value: "0" },
        ],
      };

  return new ImageResponse(
    <ProfileOgCard {...data} />,
    {
      ...size,
      fonts: [
        { name: "Geist", data: fonts.sans, weight: 400, style: "normal" },
        { name: "Geist", data: fonts.sansBold, weight: 700, style: "normal" },
        { name: "Geist Mono", data: fonts.mono, weight: 400, style: "normal" },
      ],
    },
  );
}
