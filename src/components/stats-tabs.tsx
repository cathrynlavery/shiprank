"use client";

import { useState } from "react";
import { ActivityChart } from "@/components/activity-chart";
import { CountUp } from "@/components/count-up";
import { MetricStrip } from "@/components/metric-strip";
import { RepoList } from "@/components/repo-list";
import { shortDate, weekRange } from "@/lib/date-label";
import { formatLines, signedLines } from "@/lib/format";
import type { PeriodSummary, StatsPayload } from "@/lib/types";

type PeriodKey = "today" | "yesterday" | "week";

type Period = {
  key: PeriodKey;
  label: string;
  dateLabel: string;
  summary: PeriodSummary;
  hero: string;
  subhead: string;
  projectHead: string;
  showChart?: boolean;
  repoLimit?: number;
};

function periodDigitCount(value: string) {
  return value.length;
}

export function StatsTabs({ stats }: { stats: StatsPayload }) {
  const [activeKey, setActiveKey] = useState<PeriodKey>("today");
  const periods: Period[] = [
    {
      key: "today",
      label: "TODAY",
      dateLabel: shortDate(stats.today.date),
      summary: stats.today,
      hero: signedLines(stats.today.lines),
      subhead: "lines shipped",
      projectHead: "today by project",
      showChart: true,
    },
    {
      key: "yesterday",
      label: "YESTERDAY",
      dateLabel: shortDate(stats.yesterday.date),
      summary: stats.yesterday,
      hero: signedLines(stats.yesterday.lines),
      subhead: "lines shipped yesterday",
      projectHead: "yesterday by project",
    },
    {
      key: "week",
      label: "LAST 7 DAYS",
      dateLabel: weekRange(stats.today.date),
      summary: stats.week,
      hero: `+${formatLines(stats.week.lines)}`,
      subhead: "lines in the last 7 days",
      projectHead: "last 7 days by project",
      showChart: true,
      repoLimit: 8,
    },
  ];
  const active =
    periods.find((period) => period.key === activeKey) ?? periods[0];

  return (
    <section className="stats-tabs" aria-label="profile stats">
      <div className="tabs-head">
        <div className="tabs-list" role="tablist" aria-label="time period">
          {periods.map((period) => (
            <button
              aria-controls={`stats-panel-${period.key}`}
              aria-selected={active.key === period.key}
              className="tab-button"
              id={`stats-tab-${period.key}`}
              key={period.key}
              onClick={() => setActiveKey(period.key)}
              role="tab"
              type="button"
            >
              {period.label}
            </button>
          ))}
        </div>
        <div className="period-date">{active.dateLabel}</div>
      </div>

      <div
        aria-labelledby={`stats-tab-${active.key}`}
        id={`stats-panel-${active.key}`}
        role="tabpanel"
      >
        <div
          className="hero-num profile-hero-num"
          style={
            {
              "--digit-count": periodDigitCount(active.hero),
            } as React.CSSProperties
          }
        >
          <CountUp value={active.summary.lines} durationMs={850} />
        </div>
        <div className="hero-sub">{active.subhead}</div>

        <MetricStrip
          lines={active.summary.lines}
          commits={active.summary.commits}
          prs={active.summary.prs}
        />

        {active.showChart ? (
          <section className="section compact-section">
            <h2 className="section-head">last 7 days</h2>
            <ActivityChart byDay={stats.byDay} today={stats.today.date} />
          </section>
        ) : null}

        <section className="section compact-section">
          <h2 className="section-head">{active.projectHead}</h2>
          <RepoList repos={active.summary.byRepo} limit={active.repoLimit} />
        </section>
      </div>
    </section>
  );
}
