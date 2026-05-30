/**
 * Per-viewer social context for the /me right sidebar.
 *
 * Replaces the hardcoded arrays in `social-mock.ts` (TRENDING_PLAYERS,
 * WHO_TO_FOLLOW, RECENT_ACHIEVEMENTS, TEAM_PROPS voters) with real Prisma
 * queries scoped to the signed-in player. Each viewer now sees a different
 * sidebar — teammates from their roster, trending peers from their league,
 * achievements derived from their actual stats.
 *
 * The `Post` / `Follow` / `PlayerProp` schemas don't exist yet, so the
 * "props" widget reuses real teammate initials with generic prop labels
 * pending the proper Prop schema in a future sprint.
 */

import { prisma } from "@/lib/db/prisma";

import type { PlayerProfile, PlayerStats } from "@/lib/player/data";
import type {
  Achievement,
  TeamProp,
  TrendingPlayer,
  WhoToFollow,
} from "@/lib/player/social-mock";

const AVATAR_TONES = {
  crimson: "from-[color:var(--brand-crimson)] to-rose-700",
  purple: "from-[color:var(--brand-purple)] to-fuchsia-700",
  gold: "from-[color:var(--brand-gold)] to-amber-600",
  emerald: "from-emerald-500 to-emerald-700",
  sky: "from-sky-500 to-blue-700",
} as const;
const TONE_KEYS = Object.values(AVATAR_TONES);

export type RealTeammate = {
  userId: string;
  name: string;
  initials: string;
  avatarTone: string;
  role: string;
  teamName: string;
};

export type PlayerSocialContext = {
  teammates: RealTeammate[];
  whoToFollow: WhoToFollow[];
  trendingPlayers: TrendingPlayer[];
  recentAchievements: Achievement[];
  /** Mock placeholder props — labeled as "Coming soon" in the UI. */
  teamProps: { total: number; props: TeamProp[]; voterInitials: string[] };
  /** Player rank in their league by win rate. Null if not enough data. */
  ranking: { rank: number; scope: string; winRatePct: number } | null;
  /** Recent teammate name we can credibly attribute a mention to. */
  mentionFrom: RealTeammate | null;
};

const PROP_LABEL_POOL: Array<{ label: string; tone: TeamProp["tone"] }> = [
  { label: "Clutch Player", tone: "crimson" },
  { label: "Smart IGL", tone: "purple" },
  { label: "Great Calls", tone: "gold" },
];

const RECENT_FF_CONTEXT_DAYS = 30;

export async function loadPlayerSocialContext(
  profile: PlayerProfile,
): Promise<PlayerSocialContext> {
  const userId = profile.user.id;
  const teamIds = profile.teams.map((t) => t.teamId);

  // Resolve the schools the viewer is affiliated with — every social-discovery
  // widget must scope strictly to these schools. Players, coaches, even
  // league admins viewing /me only see content from schools they belong to.
  // This is the platform-level multi-tenancy rule for scholastic data
  // (FERPA-adjacent: don't leak student presence across institutions).
  const viewerSchoolIds = await resolveViewerSchoolIds(userId, teamIds);

  // --- 1. Real teammates on the viewer's rosters -----------------------
  const teammates = await loadRealTeammates(userId, teamIds);

  // --- 2. Who to follow — same-school players only ---------------------
  const whoToFollow = await loadWhoToFollow(userId, viewerSchoolIds, teammates);

  // --- 3. Trending — top win-rate players from the viewer's school(s) --
  const { trending, ranking } = await loadTrendingAndRanking(userId, viewerSchoolIds);

  // --- 4. Real achievements derived from stats -------------------------
  const recentAchievements = deriveAchievements(profile.stats);

  // --- 5. Team props — keep generic labels, real teammate initials -----
  const teamProps = buildTeamProps(teammates);

  // --- 6. Recent teammate mention candidate ----------------------------
  const mentionFrom = teammates[0] ?? null;

  return {
    teammates,
    whoToFollow,
    trendingPlayers: trending,
    recentAchievements,
    teamProps,
    ranking,
    mentionFrom,
  };
}

// --- 1. Real teammates --------------------------------------------------

async function loadRealTeammates(
  userId: string,
  teamIds: string[],
): Promise<RealTeammate[]> {
  if (teamIds.length === 0) return [];

  const rows = await prisma.rosterMembership.findMany({
    where: {
      userId: { not: userId },
      roster: { teamId: { in: teamIds } },
    },
    take: 20,
    orderBy: { createdAt: "asc" },
    include: {
      user: { select: { id: true, fullName: true } },
      roster: {
        select: {
          team: {
            select: {
              customName: true,
              school: { select: { name: true, shortName: true } },
            },
          },
        },
      },
    },
  });

  // Dedupe by userId — a player might be on multiple rosters of the same team
  const seen = new Set<string>();
  const out: RealTeammate[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (seen.has(r.user.id)) continue;
    seen.add(r.user.id);
    out.push({
      userId: r.user.id,
      name: r.user.fullName,
      initials: initialsOf(r.user.fullName),
      avatarTone: TONE_KEYS[i % TONE_KEYS.length],
      role: r.role,
      teamName:
        r.roster.team.customName ??
        r.roster.team.school.shortName ??
        r.roster.team.school.name,
    });
  }
  return out;
}

// --- 2. Who to follow — STRICT same-school scoping ---------------------

async function loadWhoToFollow(
  userId: string,
  viewerSchoolIds: string[],
  teammates: RealTeammate[],
): Promise<WhoToFollow[]> {
  if (viewerSchoolIds.length === 0) return [];

  const exclude = new Set<string>([userId, ...teammates.map((t) => t.userId)]);

  // Look up other roster members at the viewer's school(s) — captains/coaches
  // first so they sort to the top, then fill with players. NEVER cross-school.
  const sameSchoolMembers = await prisma.rosterMembership.findMany({
    where: {
      userId: { notIn: Array.from(exclude) },
      roster: { team: { schoolId: { in: viewerSchoolIds } } },
    },
    take: 24,
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    include: {
      user: { select: { id: true, fullName: true } },
      roster: {
        select: { team: { select: { school: { select: { shortName: true, name: true } } } } },
      },
    },
  });

  const seen = new Set<string>();
  const out: WhoToFollow[] = [];
  for (const r of sameSchoolMembers) {
    if (out.length >= 3) break;
    if (exclude.has(r.user.id) || seen.has(r.user.id)) continue;
    seen.add(r.user.id);
    out.push({
      name: r.user.fullName,
      handle: slugifyName(r.user.fullName),
      initials: initialsOf(r.user.fullName),
      avatarTone: TONE_KEYS[out.length % TONE_KEYS.length],
      affiliation: r.roster.team.school.shortName ?? r.roster.team.school.name,
    });
  }
  return out;
}

// --- 3. Trending players + ranking — STRICT same-school scoping --------

async function loadTrendingAndRanking(
  userId: string,
  viewerSchoolIds: string[],
): Promise<{ trending: TrendingPlayer[]; ranking: PlayerSocialContext["ranking"] }> {
  if (viewerSchoolIds.length === 0) return { trending: [], ranking: null };

  // Pull every roster membership at the viewer's school(s), including the
  // finished-match history for ranking. Strict school scoping — never look
  // at players from other institutions.
  const competitorRows = await prisma.rosterMembership.findMany({
    where: { roster: { team: { schoolId: { in: viewerSchoolIds } } } },
    include: {
      user: { select: { id: true, fullName: true } },
      roster: {
        select: {
          id: true,
          homeMatches: {
            where: { status: "FINISHED" },
            select: { winnerRosterId: true },
          },
          awayMatches: {
            where: { status: "FINISHED" },
            select: { winnerRosterId: true },
          },
          team: { select: { school: { select: { shortName: true, name: true } } } },
        },
      },
    },
  });

  // Per-user win rate — players may sit on multiple rosters; collapse the
  // matches together so the rank reflects their overall performance, not
  // any single roster.
  const byUser = new Map<
    string,
    { name: string; school: string; matches: number; wins: number }
  >();
  for (const m of competitorRows) {
    const all = [...m.roster.homeMatches, ...m.roster.awayMatches];
    const wins = all.filter((mm) => mm.winnerRosterId === m.roster.id).length;
    const matches = all.length;
    if (matches < 3) continue; // minimum threshold to keep noise down

    const existing = byUser.get(m.user.id);
    if (existing) {
      existing.matches += matches;
      existing.wins += wins;
    } else {
      byUser.set(m.user.id, {
        name: m.user.fullName,
        school: m.roster.team.school.shortName ?? m.roster.team.school.name,
        matches,
        wins,
      });
    }
  }

  const ranked = Array.from(byUser.entries())
    .map(([uid, v]) => ({
      userId: uid,
      ...v,
      winRatePct: (v.wins / v.matches) * 100,
    }))
    .sort((a, b) => b.winRatePct - a.winRatePct || b.matches - a.matches);

  const trending: TrendingPlayer[] = ranked
    .filter((p) => p.userId !== userId)
    .slice(0, 3)
    .map((p, i) => ({
      rank: i + 1,
      name: p.name,
      initials: initialsOf(p.name),
      avatarTone: TONE_KEYS[i % TONE_KEYS.length],
      school: p.school,
      // We don't track K/D yet — derive a soft pseudo-K/D from win rate so
      // the widget shape stays. When per-game stats land, swap this.
      kd: Number((0.9 + (p.winRatePct / 100) * 0.8).toFixed(2)),
    }));

  // Ranking for the viewer — scope label reflects the same-school view.
  const viewerIdx = ranked.findIndex((p) => p.userId === userId);
  const ranking =
    viewerIdx >= 0
      ? {
          rank: viewerIdx + 1,
          scope: "at school",
          winRatePct: ranked[viewerIdx].winRatePct,
        }
      : null;

  return { trending, ranking };
}

// --- Resolve every school the viewer is affiliated with ----------------

async function resolveViewerSchoolIds(
  userId: string,
  teamIds: string[],
): Promise<string[]> {
  // Schools via direct SchoolMembership (coaches, managers, students)
  const directMemberships = await prisma.schoolMembership.findMany({
    where: { userId },
    select: { schoolId: true },
  });
  const directIds = directMemberships.map((m) => m.schoolId);

  // Schools via team affiliation (every Team has a schoolId)
  let teamSchoolIds: string[] = [];
  if (teamIds.length > 0) {
    const teams = await prisma.team.findMany({
      where: { id: { in: teamIds } },
      select: { schoolId: true },
    });
    teamSchoolIds = teams.map((t) => t.schoolId);
  }

  return Array.from(new Set<string>([...directIds, ...teamSchoolIds]));
}

// --- 4. Achievements ----------------------------------------------------

function deriveAchievements(stats: PlayerStats): Achievement[] {
  const out: Achievement[] = [];

  if (stats.currentStreak.kind === "WIN" && stats.currentStreak.length >= 2) {
    out.push({
      id: "ach-current-streak",
      label: `${stats.currentStreak.length} Game Win Streak`,
      postedAt: "Current",
      tone: "crimson",
    });
  }

  if (stats.longestWinStreak >= 3) {
    out.push({
      id: "ach-longest-streak",
      label: `${stats.longestWinStreak}-Win Best Streak`,
      postedAt: "Season high",
      tone: "purple",
    });
  }

  if (stats.matchesPlayed >= 3 && stats.attendanceRate === 100) {
    out.push({
      id: "ach-perfect-attendance",
      label: "Perfect Attendance",
      postedAt: `${stats.matchesPlayed} matches, 0 forfeits`,
      tone: "gold",
    });
  }

  if (stats.matchesPlayed >= 10) {
    out.push({
      id: "ach-veteran",
      label: `${stats.matchesPlayed} Matches Logged`,
      postedAt: "All-time",
      tone: "emerald",
    });
  }

  if (stats.winRate >= 60 && stats.matchesPlayed >= 5) {
    out.push({
      id: "ach-elite-win-rate",
      label: `${stats.winRate.toFixed(0)}% Win Rate`,
      postedAt: "Season",
      tone: "crimson",
    });
  }

  return out.slice(0, 4);
}

// --- 5. Team props (placeholder) ---------------------------------------

function buildTeamProps(teammates: RealTeammate[]): PlayerSocialContext["teamProps"] {
  if (teammates.length === 0) {
    return { total: 0, props: [], voterInitials: [] };
  }
  // Synthesize prop counts that roughly reflect roster size; real schema
  // lands in a later sprint. Until then this widget is honest about scale
  // (3 voters = 3 counts) instead of inflating to 12.
  const voterInitials = teammates.slice(0, 6).map((t) => t.initials);
  const baseCount = Math.max(1, Math.floor(teammates.length / 3));
  const props: TeamProp[] = PROP_LABEL_POOL.map((p, i) => ({
    label: p.label,
    count: Math.max(1, baseCount + (i === 0 ? 1 : i === 1 ? 0 : -1)),
    tone: p.tone,
  }));
  return {
    total: props.reduce((s, p) => s + p.count, 0),
    props,
    voterInitials,
  };
}

// --- helpers -----------------------------------------------------------

function initialsOf(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "??"
  );
}

function slugifyName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24) || "user";
}

// `RECENT_FF_CONTEXT_DAYS` is exported for future reuse if we want to scope
// achievements to a recent window — referenced here to avoid TS unused
// warnings until that lands.
void RECENT_FF_CONTEXT_DAYS;
