export const STATS_TIME_ZONE = "America/Chicago";

export function statsDate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: STATS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) return date.toISOString().slice(0, 10);
  return `${year}-${month}-${day}`;
}

export function addStatsDays(isoDate: string, days: number): string {
  const ms = new Date(`${isoDate}T12:00:00Z`).getTime();
  if (!Number.isFinite(ms)) return statsDate();

  const date = new Date(ms);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
