import { ImageResponse } from "next/og";
import { getStats } from "@/lib/store";
import { signedLines } from "@/lib/format";
import { statsDate } from "@/lib/stats-date";

export const runtime = "nodejs";
export const contentType = "image/png";
export const size = { width: 1200, height: 630 };
export const alt = "ShipRank — lines shipped";

async function loadFont(family: string, weight: number) {
  const cssUrl = `https://fonts.googleapis.com/css2?family=${family}:wght@${weight}&display=swap`;
  const css = await fetch(cssUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0) AppleWebKit/537.36",
    },
  }).then((r) => r.text());
  const match = css.match(
    /src: url\((https:\/\/[^)]+)\) format\('(?:woff2|truetype)'\)/,
  );
  if (!match) throw new Error(`Could not extract font URL for ${family}`);
  return fetch(match[1]).then((r) => r.arrayBuffer());
}

type Props = { params: Promise<{ username: string }> };

export default async function OpengraphImage({ params }: Props) {
  const { username } = await params;
  const stats = await getStats(username);

  const [geistSans, geistMono] = await Promise.all([
    loadFont("Geist", 400),
    loadFont("Geist+Mono", 400),
  ]);

  const today = stats?.today.date ?? statsDate();
  const lines = stats?.today.lines ?? 0;
  const net = stats?.today.net ?? 0;
  const commits = stats?.today.commits ?? 0;
  const prs = stats?.today.prs ?? 0;
  const num = lines > 0 ? signedLines(lines) : "0";
  const netLabel =
    net !== 0 ? `${net > 0 ? "+" : ""}${net.toLocaleString("en-US")}` : "0";

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#fff",
        color: "#000",
        padding: "72px 80px",
        fontFamily: "Geist Mono",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          fontSize: 22,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        <span>ShipRank</span>
        <span style={{ color: "#888" }}>{today}</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div
          style={{
            fontFamily: "Geist",
            fontSize: 280,
            lineHeight: 1,
            letterSpacing: "-0.03em",
          }}
        >
          {num}
        </div>
        <div
          style={{
            fontSize: 26,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          lines shipped · @{username}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 64,
          borderTop: "1px solid #000",
          paddingTop: 24,
          fontSize: 22,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span>{netLabel}</span>
          <span style={{ color: "#888", fontSize: 16 }}>net</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span>{commits.toLocaleString("en-US")}</span>
          <span style={{ color: "#888", fontSize: 16 }}>commits</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span>{prs.toLocaleString("en-US")}</span>
          <span style={{ color: "#888", fontSize: 16 }}>merged prs</span>
        </div>
        <div
          style={{
            marginLeft: "auto",
            color: "#888",
            fontSize: 16,
            alignSelf: "flex-end",
          }}
        >
          shiprank.dev/{username}
        </div>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: "Geist", data: geistSans, weight: 400, style: "normal" },
        { name: "Geist Mono", data: geistMono, weight: 400, style: "normal" },
      ],
    },
  );
}
