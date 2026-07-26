import type { ReactElement } from "react";
import type {
  ProfileOgData,
  ReposCardData,
  StatItem,
  TodayCardData,
  WeekCardData,
} from "@/lib/social/data";
import { formatLines } from "@/lib/social/data";

const COLORS = {
  paper: "#fff",
  ink: "#000",
  muted: "#888",
  faint: "#d8d8d8",
  line: "#000",
  softLine: "#ebebeb",
};

const FONTS = {
  sans: "Geist",
  mono: "Geist Mono",
};

const SQUARE_SIZE = 1080;
const SQUARE_PAD = 72;

function Wordmark() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        fontFamily: FONTS.sans,
        fontSize: 22,
        fontWeight: 400,
        letterSpacing: "-0.01em",
      }}
    >
      <span style={{ fontWeight: 700 }}>ship</span>
      <span>rank</span>
    </div>
  );
}

function CardFrame({
  children,
  eyebrow,
}: {
  children: ReactElement | ReactElement[];
  eyebrow: string;
}) {
  return (
    <div
      style={{
        width: SQUARE_SIZE,
        height: SQUARE_SIZE,
        display: "flex",
        flexDirection: "column",
        backgroundColor: COLORS.paper,
        color: COLORS.ink,
        fontFamily: FONTS.mono,
        padding: SQUARE_PAD,
      }}
    >
      <CardHeader eyebrow={eyebrow} />
      {children}
    </div>
  );
}

function CardHeader({ eyebrow }: { eyebrow: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: `2px solid ${COLORS.line}`,
        paddingBottom: 18,
      }}
    >
      <Wordmark />
      <div
        style={{
          color: COLORS.muted,
          fontSize: 16,
          textTransform: "uppercase",
        }}
      >
        {eyebrow}
      </div>
    </div>
  );
}

function CardFooter({ username, label }: { username: string; label: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: "auto",
        borderTop: `1px solid ${COLORS.line}`,
        paddingTop: 22,
        fontSize: 18,
      }}
    >
      <div style={{ display: "flex", alignItems: "center" }}>
        <span style={{ color: COLORS.ink }}>@{username}</span>
        <span style={{ color: COLORS.muted, marginLeft: 18 }}>{label}</span>
      </div>
      <span style={{ color: COLORS.muted, fontSize: 15 }}>shiprank.dev</span>
    </div>
  );
}

function StatRow({ stats }: { stats: StatItem[] }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 18,
        marginTop: 48,
      }}
    >
      {stats.map((stat) => (
        <div
          key={stat.label}
          style={{
            display: "flex",
            flex: 1,
            flexDirection: "column",
            borderTop: `1px solid ${COLORS.line}`,
            paddingTop: 14,
          }}
        >
          <span style={{ color: COLORS.muted, fontSize: 15 }}>
            {stat.label}
          </span>
          <span
            style={{
              marginTop: 8,
              fontFamily: FONTS.sans,
              fontSize: 46,
              lineHeight: 1,
            }}
          >
            {stat.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function TodayCard(data: TodayCardData) {
  return (
    <CardFrame eyebrow="TODAY">
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          marginTop: 88,
        }}
      >
        <div
          style={{
            color: COLORS.muted,
            fontSize: 22,
            textTransform: "uppercase",
          }}
        >
          lines shipped
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            marginTop: 10,
            fontFamily: FONTS.sans,
            fontSize: 236,
            lineHeight: 0.95,
          }}
        >
          {data.lines}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 20,
            color: COLORS.ink,
            fontSize: 34,
          }}
        >
          @{data.username} on {data.dateLabel}
        </div>
      </div>

      <StatRow stats={data.stats} />
      <CardFooter username={data.username} label={data.dateLabel} />
    </CardFrame>
  );
}

export function WeekCard(data: WeekCardData) {
  const maxLines = Math.max(1, ...data.days.map((day) => day.lines));

  return (
    <CardFrame eyebrow="LAST 7 DAYS">
      <div style={{ display: "flex", flexDirection: "column", marginTop: 70 }}>
        <div
          style={{
            color: COLORS.muted,
            fontSize: 22,
            textTransform: "uppercase",
          }}
        >
          seven day total
        </div>
        <div
          style={{
            marginTop: 10,
            display: "flex",
            fontFamily: FONTS.sans,
            fontSize: 168,
            lineHeight: 1,
          }}
        >
          {data.totalLines}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 16,
          height: 260,
          marginTop: 48,
        }}
      >
        {data.days.map((day) => {
          const height = day.lines > 0 ? Math.max(8, (day.lines / maxLines) * 220) : 4;
          return (
            <div
              key={day.date}
              style={{
                display: "flex",
                flex: 1,
                flexDirection: "column",
                alignItems: "stretch",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  height: 220,
                }}
              >
                <div
                  style={{
                    width: "100%",
                    height,
                    backgroundColor: COLORS.ink,
                    display: "flex",
                  }}
                />
              </div>
              <div
                style={{
                  marginTop: 12,
                  color: day.active ? COLORS.ink : COLORS.muted,
                  fontSize: 16,
                  textAlign: "center",
                }}
              >
                {day.day}
              </div>
            </div>
          );
        })}
      </div>

      <StatRow stats={data.stats} />
      <CardFooter username={data.username} label={data.rangeLabel} />
    </CardFrame>
  );
}

export function ReposCard(data: ReposCardData) {
  const maxLines = Math.max(1, ...data.repos.map((repo) => repo.lines));

  return (
    <CardFrame eyebrow="PROJECTS">
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginTop: 58,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span
            style={{
              color: COLORS.muted,
              fontSize: 22,
              textTransform: "uppercase",
            }}
          >
            top projects
          </span>
          <span
            style={{
              marginTop: 12,
              fontFamily: FONTS.sans,
              fontSize: 96,
              lineHeight: 1,
            }}
          >
            {data.totalLines}
          </span>
        </div>
        <span style={{ color: COLORS.muted, fontSize: 18 }}>
          {data.rangeLabel}
        </span>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 18,
          marginTop: 46,
        }}
      >
        {data.repos.length ? null : (
          <div
            style={{
              display: "flex",
              borderTop: `1px solid ${COLORS.softLine}`,
              borderBottom: `1px solid ${COLORS.softLine}`,
              padding: "28px 0",
              color: COLORS.muted,
              fontSize: 24,
            }}
          >
            nothing yet
          </div>
        )}
        {data.repos.map((repo, index) => {
          const width = `${Math.max(3, (repo.lines / maxLines) * 100)}%`;
          return (
            <div
              key={`${repo.name}-${index}`}
              style={{
                display: "flex",
                flexDirection: "column",
                borderTop: `1px solid ${COLORS.softLine}`,
                paddingTop: 18,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", alignItems: "baseline" }}>
                  <span
                    style={{
                      width: 42,
                      color: COLORS.muted,
                      fontSize: 18,
                    }}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span
                    style={{
                      maxWidth: 560,
                      overflow: "hidden",
                      fontFamily: FONTS.sans,
                      fontSize: 34,
                    }}
                  >
                    {repo.name}
                  </span>
                  <span
                    style={{
                      marginLeft: 16,
                      border: `1px solid ${
                        repo.scope === "private" ? COLORS.faint : COLORS.ink
                      }`,
                      color:
                        repo.scope === "private" ? COLORS.muted : COLORS.ink,
                      padding: "4px 8px",
                      fontSize: 12,
                      textTransform: "uppercase",
                    }}
                  >
                    {repo.scope}
                  </span>
                </div>
                <span
                  style={{
                    fontFamily: FONTS.sans,
                    fontSize: 40,
                    lineHeight: 1,
                  }}
                >
                  +{formatLines(repo.lines)}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  height: 8,
                  marginTop: 14,
                  backgroundColor: COLORS.softLine,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    width,
                    height: 8,
                    backgroundColor: COLORS.ink,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <CardFooter username={data.username} label="private names stay masked" />
    </CardFrame>
  );
}

export function ProfileOgCard(data: ProfileOgData) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: COLORS.paper,
        color: COLORS.ink,
        padding: "72px 80px",
        fontFamily: FONTS.mono,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          fontSize: 22,
          textTransform: "uppercase",
        }}
      >
        <Wordmark />
        <span style={{ color: COLORS.muted }}>{data.date}</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div
          style={{
            fontFamily: FONTS.sans,
            fontSize: 280,
            lineHeight: 1,
          }}
        >
          {data.lines}
        </div>
        <div
          style={{
            fontSize: 26,
            textTransform: "uppercase",
          }}
        >
          {`lines shipped / @${data.username}`}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 64,
          borderTop: `1px solid ${COLORS.line}`,
          paddingTop: 24,
          fontSize: 22,
          textTransform: "uppercase",
        }}
      >
        {data.stats.map((stat) => (
          <div
            key={stat.label}
            style={{ display: "flex", flexDirection: "column", gap: 4 }}
          >
            <span>{stat.value}</span>
            <span style={{ color: COLORS.muted, fontSize: 16 }}>
              {stat.label}
            </span>
          </div>
        ))}
        <div
          style={{
            marginLeft: "auto",
            color: COLORS.muted,
            fontSize: 16,
            alignSelf: "flex-end",
            textTransform: "none",
          }}
        >
          {`shiprank.dev/${data.username}`}
        </div>
      </div>
    </div>
  );
}
