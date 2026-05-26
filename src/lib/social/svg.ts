import type {
  ReposCardData,
  StatItem,
  TodayCardData,
  WeekCardData,
} from "@/lib/social/data";
import { formatLines } from "@/lib/social/data";

const WIDTH = 1080;
const HEIGHT = 1080;
const PAD = 72;

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function text({
  x,
  y,
  value,
  size,
  family = "ui-monospace, SFMono-Regular, Menlo, monospace",
  weight = 400,
  fill = "#000",
  anchor = "start",
  transform,
}: {
  x: number;
  y: number;
  value: string;
  size: number;
  family?: string;
  weight?: number;
  fill?: string;
  anchor?: "start" | "middle" | "end";
  transform?: string;
}) {
  return `<text x="${x}" y="${y}" font-family="${family}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}"${transform ? ` transform="${transform}"` : ""}>${escapeXml(value)}</text>`;
}

function wordmark(x = PAD, y = 111) {
  const family = "Inter, Arial, Helvetica, sans-serif";
  return [
    text({ x, y, value: "ship", size: 22, family, weight: 700 }),
    text({ x: x + 43, y, value: "rank", size: 22, family }),
  ].join("");
}

function frame(eyebrow: string, body: string, footer: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="#fff"/>
  ${wordmark()}
  ${text({ x: WIDTH - PAD, y: 111, value: eyebrow, size: 16, fill: "#888", anchor: "end", transform: `translate(${WIDTH - PAD} 111) scale(1 1) translate(${-WIDTH + PAD} -111)` })}
  <line x1="${PAD}" y1="132" x2="${WIDTH - PAD}" y2="132" stroke="#000" stroke-width="2"/>
  ${body}
  ${footer}
</svg>`;
}

function footer(username: string, label: string) {
  const y = HEIGHT - PAD;
  return `
  <line x1="${PAD}" y1="${y - 48}" x2="${WIDTH - PAD}" y2="${y - 48}" stroke="#000" stroke-width="1"/>
  ${text({ x: PAD, y, value: `@${username}`, size: 18 })}
  ${text({ x: PAD + username.length * 12 + 34, y, value: label, size: 18, fill: "#888" })}
  ${text({ x: WIDTH - PAD, y, value: "shiprank.dev", size: 15, fill: "#888", anchor: "end" })}`;
}

function statRows(stats: StatItem[], y = 632) {
  const gap = 18;
  const colWidth = (WIDTH - PAD * 2 - gap * 2) / 3;
  return stats
    .map((stat, index) => {
      const x = PAD + index * (colWidth + gap);
      return `
  <line x1="${x}" y1="${y}" x2="${x + colWidth}" y2="${y}" stroke="#000" stroke-width="1"/>
  ${text({ x, y: y + 30, value: stat.label, size: 15, fill: "#888" })}
  ${text({ x, y: y + 88, value: stat.value, size: 46, family: "Inter, Arial, Helvetica, sans-serif" })}`;
    })
    .join("");
}

export function todayCardSvg(data: TodayCardData) {
  const body = `
  ${text({ x: PAD, y: 252, value: "lines shipped", size: 22, fill: "#888" })}
  ${text({ x: PAD, y: 460, value: data.lines, size: 236, family: "Inter, Arial, Helvetica, sans-serif" })}
  ${text({ x: PAD, y: 520, value: `@${data.username} on ${data.dateLabel}`, size: 34 })}
  ${statRows(data.stats)}`;

  return frame("TODAY", body, footer(data.username, data.dateLabel));
}

export function weekCardSvg(data: WeekCardData) {
  const maxLines = Math.max(1, ...data.days.map((day) => day.lines));
  const chartX = PAD;
  const chartY = 510;
  const chartHeight = 220;
  const gap = 16;
  const barWidth = (WIDTH - PAD * 2 - gap * 6) / 7;
  const bars = data.days
    .map((day, index) => {
      const x = chartX + index * (barWidth + gap);
      const height = day.lines > 0 ? Math.max(8, (day.lines / maxLines) * chartHeight) : 4;
      const y = chartY + chartHeight - height;
      return `
  <rect x="${x}" y="${y}" width="${barWidth}" height="${height}" fill="#000"/>
  ${text({ x: x + barWidth / 2, y: chartY + chartHeight + 32, value: day.day, size: 16, fill: day.active ? "#000" : "#888", anchor: "middle" })}`;
    })
    .join("");
  const body = `
  ${text({ x: PAD, y: 234, value: "seven day total", size: 22, fill: "#888" })}
  ${text({ x: PAD, y: 400, value: data.totalLines, size: 168, family: "Inter, Arial, Helvetica, sans-serif" })}
  ${bars}
  ${statRows(data.stats, 792)}`;

  return frame("LAST 7 DAYS", body, footer(data.username, data.rangeLabel));
}

export function reposCardSvg(data: ReposCardData) {
  const maxLines = Math.max(1, ...data.repos.map((repo) => repo.lines));
  const rows = data.repos.length
    ? data.repos
        .map((repo, index) => {
          const y = 422 + index * 102;
          const barWidth = Math.max(20, (repo.lines / maxLines) * 540);
          return `
  <line x1="${PAD}" y1="${y - 30}" x2="${WIDTH - PAD}" y2="${y - 30}" stroke="#ebebeb" stroke-width="1"/>
  ${text({ x: PAD, y, value: String(index + 1).padStart(2, "0"), size: 18, fill: "#888" })}
  ${text({ x: PAD + 58, y, value: repo.name.slice(0, 28), size: 34, family: "Inter, Arial, Helvetica, sans-serif" })}
  <rect x="${PAD + 58 + Math.min(560, repo.name.length * 18)}" y="${y - 25}" width="${repo.scope === "private" ? 62 : 54}" height="24" fill="#fff" stroke="${repo.scope === "private" ? "#d8d8d8" : "#000"}"/>
  ${text({ x: PAD + 66 + Math.min(560, repo.name.length * 18), y: y - 7, value: repo.scope, size: 12, fill: repo.scope === "private" ? "#888" : "#000" })}
  ${text({ x: WIDTH - PAD, y, value: `+${formatLines(repo.lines)}`, size: 40, family: "Inter, Arial, Helvetica, sans-serif", anchor: "end" })}
  <rect x="${PAD + 58}" y="${y + 20}" width="540" height="8" fill="#ebebeb"/>
  <rect x="${PAD + 58}" y="${y + 20}" width="${barWidth}" height="8" fill="#000"/>`;
        })
        .join("")
    : `${text({ x: PAD, y: 432, value: "nothing yet", size: 24, fill: "#888" })}`;
  const body = `
  ${text({ x: PAD, y: 222, value: "top projects", size: 22, fill: "#888" })}
  ${text({ x: PAD, y: 332, value: data.totalLines, size: 96, family: "Inter, Arial, Helvetica, sans-serif" })}
  ${text({ x: WIDTH - PAD, y: 310, value: data.rangeLabel, size: 18, fill: "#888", anchor: "end" })}
  ${rows}`;

  return frame("PROJECTS", body, footer(data.username, "private names stay masked"));
}
