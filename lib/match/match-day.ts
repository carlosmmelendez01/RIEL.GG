/**
 * Match-day data layer — what `/me` needs to surface the 3-tap match flow.
 *
 * Returns a slim payload per match (identity, status, time-until-start, chat
 * unread count) for any match the player is on a roster for that's either
 * live right now or scheduled within an upcoming window.
 *
 * In production the window narrows to ~4 hours; for demo data we widen to
 * 30 days so the hub has something to show against synthetic seeds.
 */

import { prisma } from "@/lib/db/prisma";

export type MatchDayStatus = "LIVE" | "STARTING_SOON" | "TODAY" | "TOMORROW" | "UPCOMING";

export type ViewerRosterRole = "MANAGER" | "COACH" | "CAPTAIN" | "PLAYER";

export type MatchDayCard = {
  matchId: string;
  scheduledAt: Date;
  status: MatchDayStatus;
  /** Minutes until kickoff. Negative if already started. */
  minutesUntil: number;
  /** Source `Match.status` enum so we can reuse `<MatchStateMark>` if we like. */
  matchStatus: string;
  side: "HOME" | "AWAY";
  ownTeam: string;
  ownMonogram: string;
  ownSchoolShort: string;
  opponentTeam: string;
  opponentMonogram: string;
  opponentSchoolShort: string;
  competitionName: string;
  game: string;
  // For score reporting button visibility — only after the match starts
  hasGamesPlayed: boolean;
  // The viewer's role on this match's roster — drives action-button gating
  // (e.g., only COACH/CAPTAIN/MANAGER can report scores).
  viewerRole: ViewerRosterRole;
  // Chat preview state
  unreadCount: number;
  lastMessagePreview: string | null;
  lastMessageAt: Date | null;
};

const WINDOW_DAYS_DEFAULT = 30;
const LIVE_STATUSES = ["IN_PROGRESS", "CHECKING_IN", "AWAITING_CONFIRMATION"] as const;

/**
 * Load the player's match-day cards. Returns matches that are either
 * currently live or scheduled within `windowDays` days. Sorted by closest
 * first (live → starting soon → today → later).
 */
export async function loadMatchDay(
  userId: string,
  { windowDays = WINDOW_DAYS_DEFAULT }: { windowDays?: number } = {},
): Promise<MatchDayCard[]> {
  // 1. Resolve the player's rosters + role per roster
  const memberships = await prisma.rosterMembership.findMany({
    where: { userId },
    select: { rosterId: true, role: true },
  });
  const rosterIds = memberships.map((m) => m.rosterId);
  if (rosterIds.length === 0) return [];
  const roleByRoster = new Map<string, ViewerRosterRole>(
    memberships.map((m) => [m.rosterId, m.role as ViewerRosterRole]),
  );

  const now = new Date();
  const windowEnd = new Date(now.getTime() + windowDays * 24 * 60 * 60 * 1000);

  const matches = await prisma.match.findMany({
    where: {
      OR: [
        { homeRosterId: { in: rosterIds } },
        { awayRosterId: { in: rosterIds } },
      ],
      AND: {
        OR: [
          { status: { in: [...LIVE_STATUSES] } },
          { scheduledAt: { gte: now, lte: windowEnd } },
        ],
      },
    },
    orderBy: { scheduledAt: "asc" },
    select: {
      id: true,
      status: true,
      scheduledAt: true,
      homeRosterId: true,
      awayRosterId: true,
      _count: { select: { games: true, messages: true } },
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
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { body: true, createdAt: true },
      },
    },
  });

  if (matches.length === 0) return [];

  // 2. For each match the player is on, look up their per-match last-read
  //    bookmark to compute unread count. We don't have a ChatRead model yet,
  //    so for now any messages newer than 4 hours show as "unread". The API
  //    contract stays the same — when ChatRead lands the body of this loop
  //    becomes a real comparison.
  const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000);
  const unreadByMatch = new Map<string, number>();
  for (const m of matches) {
    const since = await prisma.matchMessage.count({
      where: { matchId: m.id, createdAt: { gte: fourHoursAgo } },
    });
    unreadByMatch.set(m.id, since);
  }

  // 3. Shape the cards
  const rosterSet = new Set(rosterIds);
  return matches
    .map((m): MatchDayCard => {
      const isHome = rosterSet.has(m.homeRosterId);
      const side: "HOME" | "AWAY" = isHome ? "HOME" : "AWAY";
      const own = isHome ? m.homeRoster?.team : m.awayRoster?.team;
      const opp = isHome ? m.awayRoster?.team : m.homeRoster?.team;

      const ownLabel = teamLabel(own);
      const oppLabel = teamLabel(opp);

      const minutesUntil = Math.round((m.scheduledAt.getTime() - now.getTime()) / 60000);
      const isLive = (LIVE_STATUSES as readonly string[]).includes(m.status);
      const status: MatchDayStatus = isLive
        ? "LIVE"
        : minutesUntil <= 60 * 4
          ? "STARTING_SOON"
          : sameDay(m.scheduledAt, now)
            ? "TODAY"
            : isTomorrow(m.scheduledAt, now)
              ? "TOMORROW"
              : "UPCOMING";

      const lastMsg = m.messages[0] ?? null;

      const ownRosterId = isHome ? m.homeRosterId : m.awayRosterId;
      const viewerRole = roleByRoster.get(ownRosterId) ?? "PLAYER";

      return {
        matchId: m.id,
        scheduledAt: m.scheduledAt,
        status,
        minutesUntil,
        matchStatus: m.status,
        side,
        ownTeam: ownLabel,
        ownMonogram: monogram(own),
        ownSchoolShort: own?.school.shortName ?? own?.school.name ?? "—",
        opponentTeam: oppLabel,
        opponentMonogram: monogram(opp),
        opponentSchoolShort: opp?.school.shortName ?? opp?.school.name ?? "—",
        competitionName: m.stage.competition.name.replace(/^Spring 2026 — /, ""),
        game: m.stage.competition.gameTitle.name,
        hasGamesPlayed: m._count.games > 0,
        viewerRole,
        unreadCount: unreadByMatch.get(m.id) ?? 0,
        lastMessagePreview: lastMsg?.body.slice(0, 80) ?? null,
        lastMessageAt: lastMsg?.createdAt ?? null,
      };
    })
    .sort((a, b) => {
      // Live first, then by soonest scheduledAt
      if (a.status === "LIVE" && b.status !== "LIVE") return -1;
      if (b.status === "LIVE" && a.status !== "LIVE") return 1;
      return a.scheduledAt.getTime() - b.scheduledAt.getTime();
    });
}

// --- helpers ----------------------------------------------------------

function teamLabel(
  t: { customName: string | null; colorTag?: string | null; school: { shortName: string | null; name: string } } | null | undefined,
): string {
  if (!t) return "Unknown";
  const school = t.school.shortName ?? t.school.name;
  if (t.customName) return t.customName;
  return t.colorTag ? `${school} ${t.colorTag}` : school;
}

function monogram(
  t: { customName: string | null; school: { shortName: string | null; name: string } } | null | undefined,
): string {
  if (!t) return "—";
  const source = t.customName ?? t.school.shortName ?? t.school.name;
  return source.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "—";
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isTomorrow(a: Date, now: Date): boolean {
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return sameDay(a, tomorrow);
}

// --- Chat sheet loader -----------------------------------------------

export type MatchChatPayload = {
  matchId: string;
  ownTeam: string;
  opponentTeam: string;
  messages: Array<{
    id: string;
    body: string;
    authorName: string;
    authorInitials: string;
    isSystem: boolean;
    isOwnTeam: boolean;
    createdAt: Date;
  }>;
};

/**
 * Load the chat thread for the slide-up ChatSheet. Reads MatchMessage rows
 * + author info, marks "own team" so the bubble alignment can flip.
 */
export async function loadMatchChat(
  matchId: string,
  userId: string,
): Promise<MatchChatPayload | null> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      homeRosterId: true,
      awayRosterId: true,
      homeRoster: {
        select: {
          members: { select: { userId: true } },
          team: { select: { customName: true, school: { select: { name: true, shortName: true } } } },
        },
      },
      awayRoster: {
        select: {
          members: { select: { userId: true } },
          team: { select: { customName: true, school: { select: { name: true, shortName: true } } } },
        },
      },
      messages: {
        orderBy: { createdAt: "asc" },
        take: 50,
        select: {
          id: true,
          body: true,
          kind: true,
          createdAt: true,
          authorUserId: true,
          author: { select: { fullName: true } },
        },
      },
    },
  });

  if (!match) return null;

  const homeUserIds = new Set(match.homeRoster.members.map((m) => m.userId));
  const awayUserIds = new Set(match.awayRoster.members.map((m) => m.userId));
  const viewerOnHome = homeUserIds.has(userId);

  return {
    matchId,
    ownTeam: teamLabel(viewerOnHome ? match.homeRoster.team : match.awayRoster.team),
    opponentTeam: teamLabel(viewerOnHome ? match.awayRoster.team : match.homeRoster.team),
    messages: match.messages.map((msg) => {
      const isSystem = msg.kind === "SYSTEM" || msg.authorUserId === null;
      const authorOnHome = msg.authorUserId ? homeUserIds.has(msg.authorUserId) : false;
      const authorOnAway = msg.authorUserId ? awayUserIds.has(msg.authorUserId) : false;
      const isOwnTeam = viewerOnHome ? authorOnHome : authorOnAway;
      return {
        id: msg.id,
        body: msg.body,
        authorName: isSystem ? "RIEL League Office" : msg.author?.fullName ?? "Unknown",
        authorInitials: isSystem
          ? "RL"
          : initialsOf(msg.author?.fullName ?? "??"),
        isSystem,
        isOwnTeam,
        createdAt: msg.createdAt,
      };
    }),
  };
}

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "??"
  );
}
