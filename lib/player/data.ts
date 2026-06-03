/**
 * Player profile data layer.
 *
 * `loadPlayerProfile(userId)` returns everything `/me` needs in one shot:
 *  - Identity (name, school, jersey, IGN)
 *  - All teams the player is on (via RosterMembership → Roster → Team)
 *  - Match history (last 60d, both upcoming and finished)
 *  - Computed stats: matches played, wins, win %, attendance %, streaks
 *  - Per-game breakdown
 *  - Active goals with current progress recomputed
 *  - Recent coach comments (PRIVATE only — for now this is the player's view)
 *
 * The page component then passes the profile to `generateInsights()` from
 * `lib/player/insights.ts` to produce the heuristic AI tips.
 */

import { prisma } from "@/lib/db/prisma";
import type { PlayerGoalKind, PlayerCommentKind } from "@prisma/client";

// --- Types ---------------------------------------------------------------

export type PlayerSide = "HOME" | "AWAY";

export type PlayerMatchRow = {
  matchId: string;
  scheduledAt: Date;
  finishedAt: Date | null;
  status: string;
  side: PlayerSide;
  ourScore: number | null;
  theirScore: number | null;
  result: "WIN" | "LOSS" | "FORFEIT_BY_US" | "FORFEIT_BY_THEM" | "PENDING";
  isForfeit: boolean;
  opponentTeamName: string;
  opponentSchool: string;
  competitionName: string;
  game: string;
  // Whether the player was on the roster at match time (true for all matches
  // we surface, but kept explicit for future "joined mid-season" handling)
  ownTeamName: string;
};

export type PlayerTeamRow = {
  teamId: string;
  teamName: string;
  schoolName: string;
  game: string;
  competitionName: string;
  role: "MANAGER" | "COACH" | "CAPTAIN" | "PLAYER";
  jerseyNumber: number | null;
  inGameName: string | null;
  isStarter: boolean;
};

export type PlayerStats = {
  matchesPlayed: number;
  wins: number;
  losses: number;
  winRate: number; // 0..100
  forfeits: number;
  attendanceRate: number; // 0..100 (matchesPlayed - forfeitsByUs) / matchesPlayed
  currentStreak: { kind: "WIN" | "LOSS" | "NONE"; length: number };
  longestWinStreak: number;
  rolling5WinRate: number; // 0..100, last 5 matches
  byGame: Array<{ game: string; matches: number; wins: number; winRate: number }>;
};

export type PlayerGoalRow = {
  id: string;
  kind: PlayerGoalKind;
  label: string;
  targetValue: number;
  currentValue: number;
  progressPct: number; // 0..100, capped
  achieved: boolean;
};

export type PlayerCommentRow = {
  id: string;
  authorName: string;
  authorRole: string; // e.g., "Coach · MCHS"
  kind: PlayerCommentKind;
  body: string;
  matchSummary: string | null; // "vs Fishers Tigers · Apr 28"
  createdAt: Date;
};

export type PlayerProfile = {
  loadedAt: Date;
  user: {
    id: string;
    fullName: string;
    email: string;
    initials: string;
    schoolName: string | null;
    schoolShortName: string | null;
  };
  teams: PlayerTeamRow[];
  matches: PlayerMatchRow[]; // last 60 days, both finished and upcoming
  upcoming: PlayerMatchRow[]; // future scheduled matches (next 30 days)
  recentResults: PlayerMatchRow[]; // last 5 finished, most recent first
  stats: PlayerStats;
  goals: PlayerGoalRow[];
  comments: PlayerCommentRow[]; // most recent first
};

// --- Loader --------------------------------------------------------------

const HISTORY_DAYS = 60;
const UPCOMING_DAYS = 30;
const RECENT_RESULTS_LIMIT = 5;
const ROLLING_WINDOW = 5;

export async function loadPlayerProfile(userId: string): Promise<PlayerProfile | null> {
  const now = new Date();
  const ms = (d: number) => d * 24 * 60 * 60 * 1000;
  const T_PAST = new Date(now.getTime() - ms(HISTORY_DAYS));
  const T_FUTURE = new Date(now.getTime() + ms(UPCOMING_DAYS));

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      fullName: true,
      email: true,
      schoolMemberships: {
        take: 1,
        orderBy: { createdAt: "asc" },
        include: { school: { select: { name: true, shortName: true } } },
      },
    },
  });
  if (!user) return null;

  const memberships = await prisma.rosterMembership.findMany({
    where: { userId },
    include: {
      roster: {
        include: {
          team: {
            include: {
              school: { select: { name: true, shortName: true } },
              gameTitle: { select: { name: true } },
            },
          },
          competition: {
            select: {
              name: true,
              gameTitle: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  const rosterIds = memberships.map((m) => m.rosterId);
  const memberRosterIds = new Set(rosterIds);

  // Pull match history — finished within last 60d OR scheduled within next 30d
  const matchesRaw = rosterIds.length === 0
    ? []
    : await prisma.match.findMany({
        where: {
          OR: [
            { homeRosterId: { in: rosterIds } },
            { awayRosterId: { in: rosterIds } },
          ],
          AND: {
            OR: [
              { finishedAt: { gte: T_PAST } },
              { scheduledAt: { gte: now, lte: T_FUTURE } },
            ],
          },
        },
        orderBy: { scheduledAt: "desc" },
        select: {
          id: true,
          status: true,
          isForfeit: true,
          forfeitingSide: true,
          scheduledAt: true,
          finishedAt: true,
          homeScore: true,
          awayScore: true,
          homeRosterId: true,
          awayRosterId: true,
          homeRoster: {
            select: {
              team: {
                select: {
                  customName: true,
                  colorTag: true,
                  school: { select: { name: true, shortName: true } },
                },
              },
            },
          },
          awayRoster: {
            select: {
              team: {
                select: {
                  customName: true,
                  colorTag: true,
                  school: { select: { name: true, shortName: true } },
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
      });

  // Map matches to player perspective
  const matches: PlayerMatchRow[] = matchesRaw.map((m) => {
    const isHome = memberRosterIds.has(m.homeRosterId);
    const side: PlayerSide = isHome ? "HOME" : "AWAY";
    const ourScore = isHome ? m.homeScore : m.awayScore;
    const theirScore = isHome ? m.awayScore : m.homeScore;
    const opponent = isHome ? m.awayRoster?.team : m.homeRoster?.team;
    const own = isHome ? m.homeRoster?.team : m.awayRoster?.team;

    let result: PlayerMatchRow["result"];
    if (m.status === "SCHEDULED" || m.status === "CHECKING_IN" || m.status === "IN_PROGRESS") {
      result = "PENDING";
    } else if (m.isForfeit) {
      result = m.forfeitingSide === side ? "FORFEIT_BY_US" : "FORFEIT_BY_THEM";
    } else if (ourScore != null && theirScore != null) {
      result = ourScore > theirScore ? "WIN" : "LOSS";
    } else {
      result = "PENDING";
    }

    return {
      matchId: m.id,
      scheduledAt: m.scheduledAt,
      finishedAt: m.finishedAt,
      status: m.status,
      side,
      ourScore: ourScore ?? null,
      theirScore: theirScore ?? null,
      result,
      isForfeit: m.isForfeit,
      opponentTeamName: teamLabel(opponent),
      opponentSchool: opponent?.school.shortName ?? opponent?.school.name ?? "—",
      competitionName: m.stage.competition.name.replace(/^Spring 2026 — /, ""),
      game: m.stage.competition.gameTitle.name,
      ownTeamName: teamLabel(own),
    } satisfies PlayerMatchRow;
  });

  // Split upcoming vs finished
  const upcoming = matches
    .filter((m) => m.result === "PENDING" && m.scheduledAt > now)
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());

  const finished = matches
    .filter((m) => m.result !== "PENDING")
    .sort((a, b) => {
      const at = a.finishedAt?.getTime() ?? a.scheduledAt.getTime();
      const bt = b.finishedAt?.getTime() ?? b.scheduledAt.getTime();
      return bt - at;
    });

  const recentResults = finished.slice(0, RECENT_RESULTS_LIMIT);

  // Stats
  const stats = computeStats(finished);

  // Goals (active = not archived)
  const goalRows = await prisma.playerGoal.findMany({
    where: { playerId: userId, archivedAt: null },
    orderBy: { createdAt: "asc" },
  });
  const goals: PlayerGoalRow[] = goalRows.map((g) => {
    const current = currentValueForGoal(g.kind, stats);
    const progressPct = g.targetValue > 0 ? Math.min(100, (current / g.targetValue) * 100) : 0;
    return {
      id: g.id,
      kind: g.kind,
      label: g.label ?? defaultGoalLabel(g.kind, g.targetValue),
      targetValue: g.targetValue,
      currentValue: current,
      progressPct,
      achieved: g.achievedAt !== null || current >= g.targetValue,
    };
  });

  // Coach / AI comments — most recent first
  const commentRows = await prisma.playerComment.findMany({
    where: { playerId: userId },
    orderBy: { createdAt: "desc" },
    take: 8,
    include: {
      author: { select: { fullName: true } },
      match: {
        select: {
          finishedAt: true,
          scheduledAt: true,
          homeRoster: { select: { team: { select: { customName: true, school: { select: { shortName: true, name: true } } } } } },
          awayRoster: { select: { team: { select: { customName: true, school: { select: { shortName: true, name: true } } } } } },
        },
      },
    },
  });

  const comments: PlayerCommentRow[] = commentRows.map((c) => {
    const matchDate = c.match?.finishedAt ?? c.match?.scheduledAt;
    const opponentName = c.match
      ? teamLabel(c.match.awayRoster?.team) // simplified; opponent resolution by side is over-engineering for now
      : null;
    return {
      id: c.id,
      authorName: c.author?.fullName ?? "AI Insight",
      authorRole: c.kind === "AI" ? "RIEL Insights" : c.kind === "RECRUITER" ? "College Coach" : "Coach",
      kind: c.kind,
      body: c.body,
      matchSummary:
        c.match && matchDate
          ? `vs ${opponentName ?? "—"} · ${matchDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
          : null,
      createdAt: c.createdAt,
    };
  });

  // Player teams payload
  const teams: PlayerTeamRow[] = memberships.map((m) => ({
    teamId: m.roster.teamId,
    teamName: teamLabel(m.roster.team),
    schoolName: m.roster.team.school.name,
    game: m.roster.team.gameTitle.name,
    competitionName: m.roster.competition.name.replace(/^Spring 2026 — /, ""),
    role: m.role,
    jerseyNumber: m.jerseyNumber,
    inGameName: m.inGameName,
    isStarter: m.isStarter,
  }));

  // Identity — fall back to first roster's school if no SchoolMembership
  const sm = user.schoolMemberships[0];
  const fallbackSchool = teams[0];
  const schoolName = sm?.school.name ?? fallbackSchool?.schoolName ?? null;
  const schoolShortName = sm?.school.shortName ?? null;

  return {
    loadedAt: now,
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      initials: deriveInitials(user.fullName),
      schoolName,
      schoolShortName,
    },
    teams,
    matches,
    upcoming,
    recentResults,
    stats,
    goals,
    comments,
  };
}

// --- Helpers -------------------------------------------------------------

function teamLabel(t: { customName: string | null; colorTag?: string | null; school: { shortName: string | null; name: string } } | null | undefined): string {
  if (!t) return "Unknown";
  const school = t.school.shortName ?? t.school.name;
  if (t.customName) return t.customName;
  return t.colorTag ? `${school} ${t.colorTag}` : school;
}

function deriveInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "??";
}

function computeStats(finished: PlayerMatchRow[]): PlayerStats {
  const matchesPlayed = finished.length;
  const wins = finished.filter((m) => m.result === "WIN" || m.result === "FORFEIT_BY_THEM").length;
  const losses = finished.filter((m) => m.result === "LOSS" || m.result === "FORFEIT_BY_US").length;
  const forfeits = finished.filter((m) => m.result === "FORFEIT_BY_US").length;
  const winRate = matchesPlayed > 0 ? (wins / matchesPlayed) * 100 : 0;
  const attendanceRate =
    matchesPlayed > 0 ? ((matchesPlayed - forfeits) / matchesPlayed) * 100 : 100;

  // Streaks — finished is already most-recent-first
  let currentStreakKind: "WIN" | "LOSS" | "NONE" = "NONE";
  let currentStreakLength = 0;
  for (const m of finished) {
    const isWin = m.result === "WIN" || m.result === "FORFEIT_BY_THEM";
    const isLoss = m.result === "LOSS" || m.result === "FORFEIT_BY_US";
    if (currentStreakKind === "NONE") {
      if (isWin) {
        currentStreakKind = "WIN";
        currentStreakLength = 1;
      } else if (isLoss) {
        currentStreakKind = "LOSS";
        currentStreakLength = 1;
      } else break;
    } else if ((currentStreakKind === "WIN" && isWin) || (currentStreakKind === "LOSS" && isLoss)) {
      currentStreakLength += 1;
    } else {
      break;
    }
  }

  // Longest win streak across the window (oldest → newest)
  let longestWinStreak = 0;
  let runningWin = 0;
  const oldestFirst = [...finished].reverse();
  for (const m of oldestFirst) {
    const isWin = m.result === "WIN" || m.result === "FORFEIT_BY_THEM";
    if (isWin) {
      runningWin += 1;
      longestWinStreak = Math.max(longestWinStreak, runningWin);
    } else {
      runningWin = 0;
    }
  }

  // Rolling 5-match win rate
  const last5 = finished.slice(0, ROLLING_WINDOW);
  const last5Wins = last5.filter((m) => m.result === "WIN" || m.result === "FORFEIT_BY_THEM").length;
  const rolling5WinRate = last5.length > 0 ? (last5Wins / last5.length) * 100 : 0;

  // Per-game
  const byGameMap = new Map<string, { matches: number; wins: number }>();
  for (const m of finished) {
    const e = byGameMap.get(m.game) ?? { matches: 0, wins: 0 };
    e.matches += 1;
    if (m.result === "WIN" || m.result === "FORFEIT_BY_THEM") e.wins += 1;
    byGameMap.set(m.game, e);
  }
  const byGame = Array.from(byGameMap.entries())
    .map(([game, v]) => ({
      game,
      matches: v.matches,
      wins: v.wins,
      winRate: v.matches > 0 ? (v.wins / v.matches) * 100 : 0,
    }))
    .sort((a, b) => b.matches - a.matches);

  return {
    matchesPlayed,
    wins,
    losses,
    winRate,
    forfeits,
    attendanceRate,
    currentStreak: { kind: currentStreakKind, length: currentStreakLength },
    longestWinStreak,
    rolling5WinRate,
    byGame,
  };
}

function currentValueForGoal(kind: PlayerGoalKind, stats: PlayerStats): number {
  switch (kind) {
    case "WINS":
      return stats.wins;
    case "WIN_RATE":
      return stats.rolling5WinRate;
    case "ATTENDANCE_RATE":
      return stats.attendanceRate;
    case "MATCHES_PLAYED":
      return stats.matchesPlayed;
    case "WIN_STREAK":
      return stats.currentStreak.kind === "WIN" ? stats.currentStreak.length : 0;
  }
}

function defaultGoalLabel(kind: PlayerGoalKind, target: number): string {
  switch (kind) {
    case "WINS":
      return `${target} wins`;
    case "WIN_RATE":
      return `${target}% win rate (last 5)`;
    case "ATTENDANCE_RATE":
      return `${target}% attendance`;
    case "MATCHES_PLAYED":
      return `Play ${target} matches`;
    case "WIN_STREAK":
      return `${target}-game win streak`;
  }
}
