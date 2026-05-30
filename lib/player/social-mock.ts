/**
 * Mock data for the social-first player profile page.
 *
 * Everything here lives outside the Prisma schema for now. When we add
 * `Post`, `Follow`, and `Prop` models later, this file becomes a real-data
 * loader (mirroring lib/player/data.ts) and the consumers don't change.
 *
 * Each item is keyed so we can swap to a server fetch without a UI rewrite.
 */

export type PostKind =
  | "ranking"
  | "match-win"
  | "coach-feedback"
  | "highlight"
  | "goal-update"
  | "mention";

export type PostAuthor = {
  name: string;
  handle: string;
  initials: string;
  avatarTone: string;
  verified?: boolean;
  badge?: string;
};

export type FeedPost = {
  id: string;
  kind: PostKind;
  pinned?: boolean;
  author: PostAuthor;
  postedAt: string; // human-readable ("Apr 28", "2h", "4h")
  body: string;
  emoji?: string; // leading emoji shown bigger
  likes: number;
  comments: number;
  shares: number;
  bookmarked?: boolean;
  // Optional inline payloads
  rankCard?: { rank: number; scope: string; subtitle: string };
  matchResult?: {
    homeName: string;
    homeMonogram: string;
    homeTone: string;
    awayName: string;
    awayMonogram: string;
    awayTone: string;
    homeScore: number;
    awayScore: number;
    label: string;
  };
  highlight?: { duration: string; title: string };
  goalProgress?: { current: number; target: number; rewardLabel: string };
};

export type SocialTag = string;

export type ProfileMeta = {
  // Brief-supplied identity flair that doesn't have schema yet
  verified: boolean;
  handle: string;
  rank: number;
  rankScope: string;
  tags: SocialTag[];
  quote: string;
  // Social counts
  posts: number;
  followers: number;
  following: number;
  bannerHueA: string; // gradient start (oklch / var)
  bannerHueB: string;
};

export const PROFILE_META: ProfileMeta = {
  verified: true,
  handle: "avamitchell",
  rank: 12,
  rankScope: "in State",
  tags: ["IGL", "Entry", "Clutch", "Leader"],
  quote: "Calm under pressure. I call the plays.",
  posts: 192,
  followers: 1248,
  following: 842,
  bannerHueA: "var(--brand-crimson)",
  bannerHueB: "var(--brand-purple)",
};

// --- Posts feed --------------------------------------------------------

const AVATAR_TONES = {
  crimson: "from-[color:var(--brand-crimson)] to-rose-700",
  purple: "from-[color:var(--brand-purple)] to-fuchsia-700",
  gold: "from-[color:var(--brand-gold)] to-amber-600",
  emerald: "from-emerald-500 to-emerald-700",
  sky: "from-sky-500 to-blue-700",
} as const;

/**
 * Build the player's feed from REAL data only.
 *
 * Earlier this builder fell back to hardcoded mock content ("WE WON vs
 * Carmel Greyhounds!") when no real data backed a post — which meant every
 * player saw the same Carmel-themed posts regardless of who they actually
 * play for. Now every post is conditional: if there's no real data behind
 * it, the post is skipped entirely. Sparse-but-real beats dense-but-fake.
 *
 * The Post / Follow / Highlight schemas don't exist yet, so the engagement
 * counts (likes, comments, shares) are still mock — but they're attached
 * only to posts that ARE personalized. When those schemas land, the counts
 * become real with no UI changes.
 */
export function buildPlayerFeed(args: {
  playerName: string;
  playerInitials: string;
  schoolShortName: string;
  /** Set when the player has a current rank — drives the pinned ranking post. */
  realRanking?: { rank: number; scope: string; winRatePct: number } | null;
  realCoachComment?: { authorName: string; body: string; postedAt: string } | null;
  realMatchWin?: {
    opponent: string;
    opponentMonogram: string;
    ourMonogram: string;
    ourScore: number;
    theirScore: number;
    daysAgo: number;
  } | null;
  realGoalProgress?: { current: number; target: number; label: string } | null;
  /** A real teammate from the player's roster — drives the mention post. */
  realTeammateMention?: {
    teammateName: string;
    teammateInitials: string;
    body: string;
  } | null;
}): FeedPost[] {
  const {
    playerName,
    playerInitials,
    schoolShortName,
    realRanking,
    realCoachComment,
    realMatchWin,
    realGoalProgress,
    realTeammateMention,
  } = args;

  const ownAuthor: PostAuthor = {
    name: playerName,
    handle: PROFILE_META.handle,
    initials: playerInitials,
    avatarTone: AVATAR_TONES.crimson,
    verified: PROFILE_META.verified,
  };

  const posts: FeedPost[] = [];

  // --- Pinned ranking ---
  if (realRanking) {
    posts.push({
      id: "p-rank",
      kind: "ranking",
      pinned: true,
      author: ownAuthor,
      postedAt: "This week",
      emoji: "🏆",
      body: `Ranked #${realRanking.rank} ${realRanking.scope.toLowerCase()}\n${realRanking.winRatePct.toFixed(0)}% win rate this season. Grateful for the team and the grind.`,
      likes: 142,
      comments: 23,
      shares: 7,
      rankCard: {
        rank: realRanking.rank,
        scope: realRanking.scope.toUpperCase(),
        subtitle: `${realRanking.winRatePct.toFixed(0)}% win rate`,
      },
    });
  }

  // --- Match win — only when there's a real recent win ---
  if (realMatchWin) {
    posts.push({
      id: "p-win",
      kind: "match-win",
      author: ownAuthor,
      postedAt: realMatchWin.daysAgo === 0 ? "Today" : realMatchWin.daysAgo === 1 ? "1d" : `${realMatchWin.daysAgo}d`,
      emoji: "🔥",
      body: `WE WON! ${realMatchWin.theirScore === 0 ? "Clean sweep" : "Close one"} vs ${realMatchWin.opponent}.\nGreat comms and execution from the squad.`,
      likes: 24,
      comments: 6,
      shares: 2,
      matchResult: {
        homeName: schoolShortName,
        homeMonogram: realMatchWin.ourMonogram,
        homeTone: "from-[color:var(--brand-crimson)] to-rose-700",
        awayName: realMatchWin.opponent,
        awayMonogram: realMatchWin.opponentMonogram,
        awayTone: "from-zinc-700 to-zinc-900",
        homeScore: realMatchWin.ourScore,
        awayScore: realMatchWin.theirScore,
        label: "FINAL",
      },
    });
  }

  // --- Coach feedback — only when there's a real PlayerComment ---
  if (realCoachComment) {
    posts.push({
      id: "p-coach",
      kind: "coach-feedback",
      author: {
        name: realCoachComment.authorName,
        handle: slugifyName(realCoachComment.authorName),
        initials: initialsOf(realCoachComment.authorName),
        avatarTone: AVATAR_TONES.gold,
        badge: "Head Coach",
      },
      postedAt: realCoachComment.postedAt,
      body: realCoachComment.body,
      likes: 18,
      comments: 4,
      shares: 1,
    });
  }

  // --- Goal update — only when there's a real PlayerGoal ---
  if (realGoalProgress) {
    posts.push({
      id: "p-goal",
      kind: "goal-update",
      author: {
        name: "RIEL Goals",
        handle: "rielgoals",
        initials: "RG",
        avatarTone: AVATAR_TONES.purple,
        badge: "System",
      },
      postedAt: "This week",
      body: `${playerName.split(" ")[0]} is ${Math.round((realGoalProgress.current / Math.max(1, realGoalProgress.target)) * 100)}% to a season goal — ${Math.round(realGoalProgress.current)}/${Math.round(realGoalProgress.target)}.`,
      likes: 12,
      comments: 3,
      shares: 0,
      goalProgress: {
        current: realGoalProgress.current,
        target: realGoalProgress.target,
        rewardLabel: realGoalProgress.label,
      },
    });
  }

  // --- Teammate mention — only when we have a real teammate ---
  if (realTeammateMention) {
    posts.push({
      id: "p-mention",
      kind: "mention",
      author: {
        name: realTeammateMention.teammateName,
        handle: slugifyName(realTeammateMention.teammateName),
        initials: realTeammateMention.teammateInitials,
        avatarTone: AVATAR_TONES.sky,
      },
      postedAt: "Recent",
      body: realTeammateMention.body,
      likes: 6,
      comments: 1,
      shares: 0,
    });
  }

  return posts;
}

/**
 * Back-compat alias — older imports still use `buildMockFeed`. Kept so
 * existing call sites don't break while we migrate them to the new name.
 */
export const buildMockFeed = buildPlayerFeed;

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "??";
}

function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 24) || "user";
}

// --- Right-sidebar widgets (mock parts) --------------------------------

export type TeamProp = { label: string; count: number; tone: "crimson" | "gold" | "purple" };

export const TEAM_PROPS: { total: number; props: TeamProp[]; voterInitials: string[] } = {
  total: 12,
  props: [
    { label: "Clutch Player", count: 6, tone: "crimson" },
    { label: "Smart IGL", count: 4, tone: "purple" },
    { label: "Great Calls", count: 2, tone: "gold" },
  ],
  voterInitials: ["NR", "MK", "EB", "LP", "SC", "AG"],
};

export type WhoToFollow = {
  name: string;
  handle: string;
  initials: string;
  avatarTone: string;
  affiliation: string;
};

export const WHO_TO_FOLLOW: WhoToFollow[] = [
  { name: "Mason Cook", handle: "masoncook", initials: "MC", avatarTone: AVATAR_TONES.purple, affiliation: "Brebeuf Jesuit High School" },
  { name: "Ella Nguyen", handle: "ellanguyen", initials: "EN", avatarTone: AVATAR_TONES.gold, affiliation: "Westfield High School" },
  { name: "HSE Esports", handle: "hseesports", initials: "HS", avatarTone: AVATAR_TONES.sky, affiliation: "Hamilton Southeastern" },
];

export type TrendingPlayer = {
  rank: number;
  name: string;
  initials: string;
  avatarTone: string;
  school: string;
  kd: number;
};

export const TRENDING_PLAYERS: TrendingPlayer[] = [
  { rank: 1, name: "Ethan Miller", initials: "EM", avatarTone: AVATAR_TONES.emerald, school: "Lakota High School", kd: 1.48 },
  { rank: 2, name: "Ava Mitchell", initials: "AM", avatarTone: AVATAR_TONES.crimson, school: "Brebeuf Jesuit HS", kd: 1.38 },
  { rank: 3, name: "Noah Reynolds", initials: "NR", avatarTone: AVATAR_TONES.sky, school: "Brookside School", kd: 1.29 },
];

export type Achievement = {
  id: string;
  label: string;
  postedAt: string;
  tone: "crimson" | "gold" | "emerald" | "purple";
};

export const RECENT_ACHIEVEMENTS: Achievement[] = [
  { id: "a1", label: "4 Game Win Streak", postedAt: "Apr 28, 2026", tone: "crimson" },
  { id: "a2", label: "Clutch Play", postedAt: "Apr 27, 2026", tone: "purple" },
  { id: "a3", label: "Perfect Attendance", postedAt: "Apr 20, 2026", tone: "gold" },
];

export const PROFILE_HIGHLIGHT_CARDS: Array<{
  id: string;
  label: string;
  value: string;
  sub?: string;
  tone: "crimson" | "gold" | "emerald" | "purple";
}> = [
  { id: "h1", label: "Game Win Streak", value: "3", tone: "crimson" },
  { id: "h2", label: "in State", value: "#12", tone: "purple" },
  { id: "h3", label: "Top 15%", value: "Win Rate", tone: "gold" },
  { id: "h4", label: "Perfect Attendance", value: "100%", sub: "this season", tone: "emerald" },
];
