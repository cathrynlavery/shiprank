import type { StatsPayload } from "@/lib/types";

function dayTotal(repos: StatsPayload["today"]["byRepo"] | undefined) {
  if (!repos) return 0;
  return Object.values(repos).reduce((sum, stats) => sum + stats.additions, 0);
}

export function ActivityChart({
  byDay,
  today,
}: {
  byDay: StatsPayload["byDay"];
  today: string;
}) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${today}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() - (6 - index));
    const dateString = date.toISOString().slice(0, 10);

    return {
      date: dateString,
      day: ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][
        date.getUTCDay()
      ],
      total: dayTotal(byDay[dateString]),
    };
  });
  const max = Math.max(...days.map((day) => day.total), 1);

  return (
    <div className="chart">
      {days.map((day) => {
        const height = day.total > 0 ? `${(day.total / max) * 100}%` : "2px";
        const active = day.date === today;

        return (
          <div className="bar-col" key={day.date}>
            <div className="bar-wrap">
              <div
                className={active ? "bar bar-active" : "bar"}
                style={{ height }}
              />
            </div>
            <div className={active ? "bar-day bar-day-active" : "bar-day"}>
              {day.day}
            </div>
          </div>
        );
      })}
    </div>
  );
}
