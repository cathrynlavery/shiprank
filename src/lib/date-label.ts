function ordinal(day: number) {
  if (day > 3 && day < 21) return `${day}th`;
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

export function shortDate(dateString: string) {
  const date = new Date(`${dateString}T12:00:00Z`);
  const month = new Intl.DateTimeFormat("en-US", {
    month: "short",
    timeZone: "UTC",
  }).format(date);

  return `${month} ${ordinal(date.getUTCDate())}`;
}

export function weekRange(today: string) {
  const end = new Date(`${today}T12:00:00Z`);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 6);

  return `${shortDate(start.toISOString().slice(0, 10))} to ${shortDate(today)}`;
}

export function timestampLabel(timestamp: string) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return null;

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}
