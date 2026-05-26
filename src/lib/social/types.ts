export const SOCIAL_CARD_TYPES = ["today", "week", "repos"] as const;

export type SocialCardType = (typeof SOCIAL_CARD_TYPES)[number];

export type SocialCardMeta = {
  type: SocialCardType;
  title: string;
  blurb: string;
};

export const SOCIAL_CARDS: SocialCardMeta[] = [
  {
    type: "today",
    title: "Today",
    blurb: "Daily lines, commits, and merged PRs.",
  },
  {
    type: "week",
    title: "Week",
    blurb: "Seven-day activity bars and totals.",
  },
  {
    type: "repos",
    title: "Projects",
    blurb: "Top repositories with private names masked.",
  },
];

export function isSocialCardType(value: string): value is SocialCardType {
  return (SOCIAL_CARD_TYPES as readonly string[]).includes(value);
}
