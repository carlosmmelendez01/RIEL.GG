/**
 * Shared data layer for the Board Dashboard.
 *
 * `loadBoardData()`    — full payload for /admin/board (trend, by-game, top
 *                         offenders, recent feed, all hero stats).
 * `loadBoardSummary()` — slim payload for the /admin command-center snapshot
 *                         (just the essential 30-day numbers + 4 recent FFs).
 *
 * Both use a single Prisma query of matches in the last 60 days, then
 * aggregate in JS — at our current scale (~100 matches in window) this is
 * far cheaper than multiple round-trips.
 */

import { prisma } from "@/lib/db/prisma";

import type { ForfeitReason } from "@prisma/client";

// --- Constants -----------------------------------------------------------

export const TREND_WEEKS = 8;
export const TOP_FF_TEAMS = 5;
export const RECENT_FF_LIMIT = 10;
export const SUMMARY_FF_LIMIT = 4;

// --- Types ---------------------------------------------------------------

export type ForfeitFeedItem = {
  matchId: string;
  forfeiterTeam: string;
  forfeiterSchool: string;
  opponentTeam: string;
  opponentSchool: string;
  competition: string;
  game: string;
  reason: string | null;
  when: Date;
  partial: boolean; // true if status FINISHED (mid-match), false if FORFEITED
};

export type TopOffender = {
  teamId: string;
  teamName: string;
  schoolName: string;
  game: string;
  ff: number;
  matches: number;
};

export type TrendPoint = { weekStart: Date; matches: number; ff: number };
export type GameRow = { game: string; matches: number; ff: number };

/**
 * Per-reason forfeit count, sorted by count desc. `pct` is the share of all
 * forfeits in the period — board members compare reasons not absolutes.
 */
export type ReasonRow = {
  reason: ForfeitReason | "UNKNOWN";
  count: number;
  pct: number;
};

/**
 * Reschedule-attempt stats. The board cares about the *rate* (what % of
 * forfeits had a coach try to reschedule first) — a high rate suggests the
 * scheduler tooling is the bottleneck; a low rate suggests culture / training.
 */
export type RescheduleStats = {
  totalForfeits: number;
  attempted: number;
  notAttempted: number;
  unknown: number; // legacy forfeits before the workflow shipped
  attemptedRate: number; // 0..100
};

export type BoardHeadline = {
  matches: number;
  ff: number;
  matches30: number;
  matchesPrior30: number;
  ff30: number;
  ffPrior30: number;
  ffRate30: number;
  ffRatePrior30: number;
  ffRateDelta: number;
  ffDeltaPct: number | null;
  matchesDeltaPct: number | null;
  ffAllTime: number;
  matchesAllTime: number;
};

export type BoardData = {
  headline: BoardHeadline;
  trend: TrendPoint[];
  byGame: GameRow[];
  topOffenders: TopOffender[];
  recent: ForfeitFeedItem[];
  reasonBreakdown: ReasonRow[];
  rescheduleStats: RescheduleStats;
};

export type BoardSummary = {
  headline: BoardHeadline;
  recent: ForfeitFeedItem[]; // up to SUMMARY_FF_LIMIT
  repeatOffenderCount: number;
};

// --- Loaders -------------------------------------------------------------

/**
 * Full Board Dashboard payload — everything /admin/board needs.
 *
 * Pass `leagueId` to scope the aggregates to a single league (the normal
 * /admin/board path). Omit it for the platform-wide view (future
 * /platform/board surface).
 */
export async function loadBoardData(leagueId?: string): Promise<BoardData> {
  const { periodMatches, allTimeMatches, allTimeFf } = await fetchPeriod(leagueId);

  const headline = computeHeadline(periodMatches, allTimeMatches, allTimeFf);
  const trend = computeTrend(periodMatches);
  const byGame = computeByGame(periodMatches);
  const topOffenders = computeTopOffenders(periodMatches);
  const recent = computeRecentForfeits(periodMatches, RECENT_FF_LIMIT);
  const reasonBreakdown = computeReasonBreakdown(periodMatches);
  const rescheduleStats = computeRescheduleStats(periodMatches);

  return { headline, trend, byGame, topOffenders, recent, reasonBreakdown, rescheduleStats };
}

/**
 * Slim summary for the command-center snapshot. Fetches the same underlying
 * data but only computes what the snapshot displays.
 */
export async function loadBoardSummary(leagueId?: string): Promise<BoardSummary> {
  const { periodMatches, allTimeMatches, allTimeFf } = await fetchPeriod(leagueId);

  const headline = computeHeadline(periodMatches, allTimeMatches, allTimeFf);
  const recent = computeRecentForfeits(periodMatches, SUMMARY_FF_LIMIT);
  const repeatOffenderCount = computeTopOffenders(periodMatches).filter(
    (t) => t.ff >= 3,
  ).length;

  return { headline, recent, repeatOffenderCount };
}

// --- Internal: shared fetch + compute ------------------------------------

async function fetchPeriod(leagueId?: string) {
  const now = new Date();
  const ms = (d: number) => d * 24 * 60 * 60 * 1000;
  const T60 = new Date(now.getTime() - ms(60));

  // Scope filter: when leagueId is provided, only consider matches in that
  // league's competitions. The path traverses Match -> Stage -> Competition
  // -> Season -> League.
  const leagueScope = leagueId
    ? { stage: { competition: { season: { leagueId } } } }
    : undefined;

  const [periodMatches, allTimeMatches, allTimeFf] = await Promise.all([
    prisma.match.findMany({
      where: {
        ...leagueScope,
        OR: [{ status: "FINISHED" }, { status: "FORFEITED" }],
        finishedAt: { gte: T60 },
      },
      select: {
        id: true,
        status: true,
        isForfeit: true,
        forfeitReason: true,
        forfeitNotes: true,
        rescheduleAttempted: true,
        forfeitingSide: true,
        forfeitedAt: true,
        finishedAt: true,
        homeRoster: {
          select: {
            team: {
              select: {
                id: true,
                customName: true,
                colorTag: true,
                school: { select: { name: true, shortName: true } },
                gameTitle: { select: { name: true } },
              },
            },
          },
        },
        awayRoster: {
          select: {
            team: {
              select: {
                id: true,
                customName: true,
                colorTag: true,
                school: { select: { name: true, shortName: true } },
                gameTitle: { select: { name: true } },
              },
            },
          },
        },
        stage: {
          select: {
            competition: {
              select: {
                name: true,
                gameTitle: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: { finishedAt: "desc" },
    }),
    prisma.match.count({
      where: {
        ...leagueScope,
        OR: [{ status: "FINISHED" }, { status: "FORFEITED" }],
      },
    }),
    prisma.match.count({
      where: { ...leagueScope, isForfeit: true },
    }),
  ]);

  return { periodMatches, allTimeMatches, allTimeFf };
}

type PeriodMatch = Awaited<ReturnType<typeof fetchPeriod>>["periodMatches"][number];
type TeamLite = NonNullable<PeriodMatch["homeRoster"]>["team"];

function teamLabel(t: TeamLite | null): string {
  if (!t) return "Unknown";
  const school = t.school.shortName ?? t.school.name;
  if (t.customName) return t.customName;
  return t.colorTag ? `${school} ${t.colorTag}` : school;
}

function computeHeadline(
  periodMatches: PeriodMatch[],
  allTimeMatches: number,
  allTimeFf: number,
): BoardHeadline {
  const now = new Date();
  const ms = (d: number) => d * 24 * 60 * 60 * 1000;
  const T30 = new Date(now.getTime() - ms(30));
  const T60 = new Date(now.getTime() - ms(60));

  let matches30 = 0;
  let matchesPrior30 = 0;
  let ff30 = 0;
  let ffPrior30 = 0;

  for (const m of periodMatches) {
    const t = m.finishedAt;
    if (!t) continue;
    if (t >= T30) {
      matches30 += 1;
      if (m.isForfeit) ff30 += 1;
    } else if (t >= T60) {
      matchesPrior30 += 1;
      if (m.isForfeit) ffPrior30 += 1;
    }
  }

  const ffRate30 = matches30 > 0 ? (ff30 / matches30) * 100 : 0;
  const ffRatePrior30 = matchesPrior30 > 0 ? (ffPrior30 / matchesPrior30) * 100 : 0;
  const ffRateDelta = ffRate30 - ffRatePrior30;
  const ffDeltaPct = ffPrior30 > 0 ? ((ff30 - ffPrior30) / ffPrior30) * 100 : null;
  const matchesDeltaPct =
    matchesPrior30 > 0 ? ((matches30 - matchesPrior30) / matchesPrior30) * 100 : null;

  return {
    matches: periodMatches.length,
    ff: periodMatches.filter((m) => m.isForfeit).length,
    matches30,
    matchesPrior30,
    ff30,
    ffPrior30,
    ffRate30,
    ffRatePrior30,
    ffRateDelta,
    ffDeltaPct,
    matchesDeltaPct,
    ffAllTime: allTimeFf,
    matchesAllTime: allTimeMatches,
  };
}

function computeTrend(periodMatches: PeriodMatch[]): TrendPoint[] {
  const now = new Date();
  const ms = (d: number) => d * 24 * 60 * 60 * 1000;
  const trend: TrendPoint[] = [];
  for (let i = TREND_WEEKS - 1; i >= 0; i--) {
    const weekEnd = new Date(now.getTime() - ms(i * 7));
    const weekStart = new Date(weekEnd.getTime() - ms(7));
    let matches = 0;
    let ff = 0;
    for (const m of periodMatches) {
      if (!m.finishedAt) continue;
      if (m.finishedAt >= weekStart && m.finishedAt < weekEnd) {
        matches += 1;
        if (m.isForfeit) ff += 1;
      }
    }
    trend.push({ weekStart, matches, ff });
  }
  return trend;
}

function computeByGame(periodMatches: PeriodMatch[]): GameRow[] {
  const map = new Map<string, { matches: number; ff: number }>();
  for (const m of periodMatches) {
    const game = m.stage.competition.gameTitle.name;
    const e = map.get(game) ?? { matches: 0, ff: 0 };
    e.matches += 1;
    if (m.isForfeit) e.ff += 1;
    map.set(game, e);
  }
  return Array.from(map.entries())
    .map(([game, v]) => ({ game, ...v }))
    .sort((a, b) => b.ff / Math.max(1, b.matches) - a.ff / Math.max(1, a.matches));
}

function computeTopOffenders(periodMatches: PeriodMatch[]): TopOffender[] {
  const teamMatches = new Map<string, number>();
  const teamFf = new Map<
    string,
    { teamName: string; schoolName: string; game: string; ff: number }
  >();

  for (const m of periodMatches) {
    const home = m.homeRoster?.team;
    const away = m.awayRoster?.team;
    if (home) teamMatches.set(home.id, (teamMatches.get(home.id) ?? 0) + 1);
    if (away) teamMatches.set(away.id, (teamMatches.get(away.id) ?? 0) + 1);

    if (!m.isForfeit) continue;
    const forfeiter = m.forfeitingSide === "AWAY" ? away : home;
    if (!forfeiter) continue;
    const e =
      teamFf.get(forfeiter.id) ??
      {
        teamName: teamLabel(forfeiter),
        schoolName: forfeiter.school.name,
        game: forfeiter.gameTitle?.name ?? m.stage.competition.gameTitle.name,
        ff: 0,
      };
    e.ff += 1;
    teamFf.set(forfeiter.id, e);
  }

  return Array.from(teamFf.entries())
    .map(([teamId, v]) => ({
      teamId,
      ...v,
      matches: teamMatches.get(teamId) ?? 0,
    }))
    .sort((a, b) => b.ff - a.ff || b.matches - a.matches);
}

function computeRecentForfeits(
  periodMatches: PeriodMatch[],
  limit: number,
): ForfeitFeedItem[] {
  return periodMatches
    .filter((m) => m.isForfeit)
    .sort((a, b) => {
      const at = a.forfeitedAt?.getTime() ?? 0;
      const bt = b.forfeitedAt?.getTime() ?? 0;
      return bt - at;
    })
    .slice(0, limit)
    .map((m) => {
      const home = m.homeRoster?.team ?? null;
      const away = m.awayRoster?.team ?? null;
      const forfeiter = m.forfeitingSide === "AWAY" ? away : home;
      const opponent = m.forfeitingSide === "AWAY" ? home : away;
      return {
        matchId: m.id,
        forfeiterTeam: teamLabel(forfeiter),
        forfeiterSchool: forfeiter?.school.shortName ?? forfeiter?.school.name ?? "—",
        opponentTeam: teamLabel(opponent),
        opponentSchool: opponent?.school.shortName ?? opponent?.school.name ?? "—",
        competition: m.stage.competition.name.replace(/^Spring 2026 — /, ""),
        game: m.stage.competition.gameTitle.name,
        reason: m.forfeitReason,
        when: m.forfeitedAt ?? m.finishedAt ?? new Date(),
        partial: m.status === "FINISHED",
      } satisfies ForfeitFeedItem;
    });
}

/**
 * Group forfeits in the period by reason and return sorted rows with %.
 * Legacy forfeits (pre-workflow) with no reason fall under `UNKNOWN`.
 */
function computeReasonBreakdown(periodMatches: PeriodMatch[]): ReasonRow[] {
  const counts = new Map<ForfeitReason | "UNKNOWN", number>();
  let totalFf = 0;
  for (const m of periodMatches) {
    if (!m.isForfeit) continue;
    totalFf += 1;
    const key = (m.forfeitReason ?? "UNKNOWN") as ForfeitReason | "UNKNOWN";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([reason, count]) => ({
      reason,
      count,
      pct: totalFf > 0 ? (count / totalFf) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Did the forfeiting coach attempt to reschedule first? A high rate suggests
 * the scheduler tooling is the bottleneck; a low rate suggests training /
 * culture is. `unknown` covers legacy forfeits seeded before the workflow.
 */
function computeRescheduleStats(periodMatches: PeriodMatch[]): RescheduleStats {
  let totalForfeits = 0;
  let attempted = 0;
  let notAttempted = 0;
  let unknown = 0;
  for (const m of periodMatches) {
    if (!m.isForfeit) continue;
    totalForfeits += 1;
    if (m.rescheduleAttempted === true) attempted += 1;
    else if (m.rescheduleAttempted === false) notAttempted += 1;
    else unknown += 1;
  }
  const known = attempted + notAttempted;
  const attemptedRate = known > 0 ? (attempted / known) * 100 : 0;
  return { totalForfeits, attempted, notAttempted, unknown, attemptedRate };
}
