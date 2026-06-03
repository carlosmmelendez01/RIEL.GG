/**
 * Coach dashboard data layer.
 *
 * Loads everything `/dashboard` and its sub-routes need, scoped strictly
 * to the schools the signed-in coach is affiliated with. Coaches at
 * different schools see entirely different dashboards — no mock-data
 * Carmel-everywhere leak.
 *
 * A "coach" here means any user with either:
 *   - A `SchoolMembership` (any role — coach, manager, even player counts
 *     for school context), OR
 *   - A `RosterMembership` with role COACH / MANAGER / CAPTAIN on any roster
 *
 * If the user has no school context AT ALL, every loader returns null /
 * empty arrays and the page renders an empty state.
 */

import { prisma } from "@/lib/db/prisma";

// --- Types --------------------------------------------------------------

export type CoachSchool = {
  id: string;
  name: string;
  shortName: string | null;
  ncesCode: string | null;
};

export type CoachTeamRow = {
  id: string;
  name: string;
  game: string;
  tier: string;
  wins: number;
  losses: number;
  forfeits: number;
  streak: number;
  competitionName: string | null;
  rosterId: string | null;
  rosterSize: number;
};

export type CoachUpcomingMatch = {
  matchId: string;
  scheduledAt: Date;
  status: string;
  ownTeamName: string;
  ownTeamMonogram: string;
  opponentTeamName: string;
  opponentSchoolShort: string;
  opponentMonogram: string;
  game: string;
  competitionName: string;
  isHome: boolean;
};

export type CoachRecentResult = {
  matchId: string;
  finishedAt: Date;
  opponentTeamName: string;
  opponentSchoolShort: string;
  ourScore: number | null;
  theirScore: number | null;
  isWin: boolean;
  isForfeit: boolean;
  game: string;
};

export type CoachStandingRow = {
  competitionId: string;
  competitionName: string;
  game: string;
  teamId: string;
  teamName: string;
  wins: number;
  losses: number;
  rank: number;
  totalTeams: number;
};

export type CoachDashboardData = {
  coach: {
    name: string;
    initials: string;
    schoolName: string;
    schoolShortName: string | null;
  };
  schools: CoachSchool[];
  teams: CoachTeamRow[];
  upcomingMatches: CoachUpcomingMatch[];
  recentResults: CoachRecentResult[];
  standings: CoachStandingRow[];
  totalWins: number;
  totalLosses: number;
  totalForfeits: number;
  rosterSize: number;
};

// --- School resolution -------------------------------------------------

/**
 * Every school the user is affiliated with — via direct SchoolMembership
 * OR via roster team affiliation. Returns empty array if the user has no
 * school context at all (e.g., platform admin who hasn't joined a school).
 */
export async function getCoachSchools(userId: string): Promise<CoachSchool[]> {
  const [direct, viaRosters] = await Promise.all([
    prisma.schoolMembership.findMany({
      where: { userId },
      include: { school: { select: { id: true, name: true, shortName: true, ncesId: true } } },
    }),
    prisma.rosterMembership.findMany({
      where: { userId },
      select: {
        roster: {
          select: {
            team: {
              select: {
                school: { select: { id: true, name: true, shortName: true, ncesId: true } },
              },
            },
          },
        },
      },
    }),
  ]);

  const byId = new Map<string, CoachSchool>();
  for (const m of direct) {
    byId.set(m.school.id, {
      id: m.school.id,
      name: m.school.name,
      shortName: m.school.shortName,
      ncesCode: m.school.ncesId,
    });
  }
  for (const m of viaRosters) {
    const s = m.roster.team.school;
    if (!byId.has(s.id)) {
      byId.set(s.id, {
        id: s.id,
        name: s.name,
        shortName: s.shortName,
        ncesCode: s.ncesId,
      });
    }
  }
  return Array.from(byId.values());
}

// --- Main loader -------------------------------------------------------

/**
 * Full dashboard payload for a coach. Returns null if the user has no
 * school context — caller should render the "no school" empty state.
 */
export async function loadCoachDashboard(
  userId: string,
): Promise<CoachDashboardData | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { fullName: true },
  });
  if (!user) return null;

  const schools = await getCoachSchools(userId);
  if (schools.length === 0) return null;

  const schoolIds = schools.map((s) => s.id);
  const primarySchool = schools[0];

  // All teams at the coach's school(s) with their rosters + standings inputs.
  const teamRows = await prisma.team.findMany({
    where: { schoolId: { in: schoolIds } },
    include: {
      gameTitle: { select: { name: true } },
      rosters: {
        select: {
          id: true,
          _count: { select: { members: true } },
          competition: { select: { id: true, name: true, gameTitle: { select: { name: true } } } },
          // Finished match results for win/loss/forfeit counts
          homeMatches: {
            where: { status: { in: ["FINISHED", "FORFEITED"] } },
            select: { winnerRosterId: true, isForfeit: true, forfeitingSide: true, finishedAt: true },
          },
          awayMatches: {
            where: { status: { in: ["FINISHED", "FORFEITED"] } },
            select: { winnerRosterId: true, isForfeit: true, forfeitingSide: true, finishedAt: true },
          },
        },
      },
    },
  });

  const teams: CoachTeamRow[] = teamRows.map((t) => {
    // Pick the primary roster (first competition) for the summary row
    const primaryRoster = t.rosters[0] ?? null;
    let wins = 0;
    let losses = 0;
    let forfeits = 0;
    let streak = 0;
    let rosterSize = 0;

    if (primaryRoster) {
      const all = [
        ...primaryRoster.homeMatches.map((m) => ({ ...m, side: "HOME" as const })),
        ...primaryRoster.awayMatches.map((m) => ({ ...m, side: "AWAY" as const })),
      ].sort((a, b) => (b.finishedAt?.getTime() ?? 0) - (a.finishedAt?.getTime() ?? 0));

      for (const m of all) {
        const isWin = m.winnerRosterId === primaryRoster.id;
        if (isWin) wins += 1;
        else losses += 1;
        if (m.isForfeit && m.forfeitingSide === m.side) forfeits += 1;
      }

      // Streak — positive for wins, negative for losses (from most recent)
      if (all.length > 0) {
        const recentIsWin = all[0].winnerRosterId === primaryRoster.id;
        for (const m of all) {
          const w = m.winnerRosterId === primaryRoster.id;
          if (w === recentIsWin) streak += 1;
          else break;
        }
        if (!recentIsWin) streak = -streak;
      }

      rosterSize = primaryRoster._count.members;
    }

    return {
      id: t.id,
      name: t.customName ?? `${primarySchool.shortName ?? primarySchool.name} ${t.gameTitle.name}`,
      game: t.gameTitle.name,
      tier: t.skillTier,
      wins,
      losses,
      forfeits,
      streak,
      competitionName: primaryRoster?.competition.name.replace(/^Spring 2026 — /, "") ?? null,
      rosterId: primaryRoster?.id ?? null,
      rosterSize,
    };
  });

  // Upcoming matches — any match where one of the coach's rosters is on either side
  const rosterIds = teamRows.flatMap((t) => t.rosters.map((r) => r.id));
  const upcomingRaw = rosterIds.length === 0 ? [] : await prisma.match.findMany({
    where: {
      OR: [{ homeRosterId: { in: rosterIds } }, { awayRosterId: { in: rosterIds } }],
      status: { in: ["SCHEDULED", "CHECKING_IN", "IN_PROGRESS"] },
      scheduledAt: { gte: new Date() },
    },
    orderBy: { scheduledAt: "asc" },
    take: 12,
    select: matchSelectShape(),
  });

  const upcomingMatches: CoachUpcomingMatch[] = upcomingRaw.map((m) =>
    shapeMatchForCoach(m, rosterIds),
  );

  // Recent results — last 8 finished/forfeited matches for the coach's rosters
  const recentRaw = rosterIds.length === 0 ? [] : await prisma.match.findMany({
    where: {
      OR: [{ homeRosterId: { in: rosterIds } }, { awayRosterId: { in: rosterIds } }],
      status: { in: ["FINISHED", "FORFEITED"] },
    },
    orderBy: { finishedAt: "desc" },
    take: 8,
    select: matchSelectShape(),
  });

  const recentResults: CoachRecentResult[] = recentRaw.map((m) => {
    const isHome = m.homeRosterId !== null && rosterIds.includes(m.homeRosterId);
    const ourRosterId = isHome ? m.homeRosterId : m.awayRosterId;
    const ourScore = isHome ? m.homeScore : m.awayScore;
    const theirScore = isHome ? m.awayScore : m.homeScore;
    const isWin = m.winnerRosterId === ourRosterId;
    const opp = isHome ? m.awayRoster?.team : m.homeRoster?.team;
    return {
      matchId: m.id,
      finishedAt: m.finishedAt ?? m.scheduledAt,
      opponentTeamName: teamLabel(opp),
      opponentSchoolShort: opp?.school.shortName ?? opp?.school.name ?? "—",
      ourScore: ourScore ?? null,
      theirScore: theirScore ?? null,
      isWin,
      isForfeit: m.isForfeit,
      game: m.stage.competition.gameTitle.name,
    };
  });

  // Standings — for each competition the coach's teams are in, compute the
  // rank by wins among all rosters in that competition.
  const competitionIds = Array.from(
    new Set(teamRows.flatMap((t) => t.rosters.map((r) => r.competition.id))),
  );

  const standingsRows = competitionIds.length === 0 ? [] : await prisma.roster.findMany({
    where: { competitionId: { in: competitionIds } },
    select: {
      id: true,
      teamId: true,
      competitionId: true,
      competition: { select: { name: true, gameTitle: { select: { name: true } } } },
      team: { select: { customName: true, school: { select: { shortName: true, name: true } } } },
      homeMatches: { where: { status: "FINISHED" }, select: { winnerRosterId: true } },
      awayMatches: { where: { status: "FINISHED" }, select: { winnerRosterId: true } },
    },
  });

  const standingsByComp = new Map<string, Array<{ rosterId: string; teamId: string; teamName: string; wins: number; losses: number; competitionName: string; game: string }>>();
  for (const r of standingsRows) {
    const all = [...r.homeMatches, ...r.awayMatches];
    const wins = all.filter((m) => m.winnerRosterId === r.id).length;
    const losses = all.length - wins;
    const list = standingsByComp.get(r.competitionId) ?? [];
    list.push({
      rosterId: r.id,
      teamId: r.teamId,
      teamName:
        r.team.customName ??
        r.team.school.shortName ??
        r.team.school.name,
      wins,
      losses,
      competitionName: r.competition.name.replace(/^Spring 2026 — /, ""),
      game: r.competition.gameTitle.name,
    });
    standingsByComp.set(r.competitionId, list);
  }

  const standings: CoachStandingRow[] = [];
  for (const [competitionId, list] of standingsByComp) {
    const sorted = [...list].sort((a, b) => b.wins - a.wins || a.losses - b.losses);
    const totalTeams = sorted.length;
    for (const row of sorted) {
      // Only surface entries for teams the coach actually owns
      const ownTeam = teamRows.find((t) => t.id === row.teamId);
      if (!ownTeam) continue;
      standings.push({
        competitionId,
        competitionName: row.competitionName,
        game: row.game,
        teamId: row.teamId,
        teamName: row.teamName,
        wins: row.wins,
        losses: row.losses,
        rank: sorted.findIndex((s) => s.rosterId === row.rosterId) + 1,
        totalTeams,
      });
    }
  }

  const totalWins = teams.reduce((s, t) => s + t.wins, 0);
  const totalLosses = teams.reduce((s, t) => s + t.losses, 0);
  const totalForfeits = teams.reduce((s, t) => s + t.forfeits, 0);
  const rosterSize = teams.reduce((s, t) => s + t.rosterSize, 0);

  return {
    coach: {
      name: user.fullName,
      initials: deriveInitials(user.fullName),
      schoolName: primarySchool.name,
      schoolShortName: primarySchool.shortName,
    },
    schools,
    teams,
    upcomingMatches,
    recentResults,
    standings,
    totalWins,
    totalLosses,
    totalForfeits,
    rosterSize,
  };
}

// --- Standings tables (full per-competition) ---------------------------

export type StandingsTable = {
  competitionId: string;
  competitionName: string;
  game: string;
  rows: Array<{
    rank: number;
    rosterId: string;
    teamId: string;
    teamName: string;
    schoolShort: string;
    wins: number;
    losses: number;
    forfeits: number;
    streak: number;
    points: number;
    isOwnTeam: boolean;
  }>;
};

/**
 * Full standings tables for every competition the coach's school has a team
 * in. Each table is cross-school by nature (you can't rank without rivals),
 * but the set of tables is scoped to competitions the coach participates in.
 */
export async function loadCoachStandingsTables(
  userId: string,
): Promise<{ schoolName: string; tables: StandingsTable[] } | null> {
  const schools = await getCoachSchools(userId);
  if (schools.length === 0) return null;
  const schoolIds = schools.map((s) => s.id);

  // Which competitions are the coach's teams in?
  const coachRosters = await prisma.roster.findMany({
    where: { team: { schoolId: { in: schoolIds } } },
    select: { id: true, competitionId: true, teamId: true },
  });
  if (coachRosters.length === 0) {
    return { schoolName: schools[0].name, tables: [] };
  }
  const competitionIds = Array.from(new Set(coachRosters.map((r) => r.competitionId)));
  const ownRosterIds = new Set(coachRosters.map((r) => r.id));
  const ownTeamIds = new Set(coachRosters.map((r) => r.teamId));

  // Pull every roster in those competitions, with their finished matches
  const allRosters = await prisma.roster.findMany({
    where: { competitionId: { in: competitionIds } },
    select: {
      id: true,
      teamId: true,
      competitionId: true,
      competition: {
        select: { id: true, name: true, gameTitle: { select: { name: true } } },
      },
      team: {
        select: {
          customName: true,
          school: { select: { shortName: true, name: true } },
        },
      },
      homeMatches: {
        where: { status: { in: ["FINISHED", "FORFEITED"] } },
        select: { winnerRosterId: true, isForfeit: true, forfeitingSide: true, finishedAt: true },
      },
      awayMatches: {
        where: { status: { in: ["FINISHED", "FORFEITED"] } },
        select: { winnerRosterId: true, isForfeit: true, forfeitingSide: true, finishedAt: true },
      },
    },
  });

  // Group by competition
  const byComp = new Map<string, typeof allRosters>();
  for (const r of allRosters) {
    const list = byComp.get(r.competitionId) ?? [];
    list.push(r);
    byComp.set(r.competitionId, list);
  }

  const tables: StandingsTable[] = [];
  for (const [compId, roster] of byComp) {
    if (roster.length === 0) continue;
    const competitionName = roster[0].competition.name.replace(/^Spring 2026 — /, "");
    const game = roster[0].competition.gameTitle.name;

    const rows = roster.map((r) => {
      const all = [
        ...r.homeMatches.map((m) => ({ ...m, side: "HOME" as const })),
        ...r.awayMatches.map((m) => ({ ...m, side: "AWAY" as const })),
      ].sort((a, b) => (b.finishedAt?.getTime() ?? 0) - (a.finishedAt?.getTime() ?? 0));

      const wins = all.filter((m) => m.winnerRosterId === r.id).length;
      const losses = all.length - wins;
      const forfeits = all.filter((m) => m.isForfeit && m.forfeitingSide === m.side).length;

      // Streak — positive wins, negative losses, from most recent match
      let streak = 0;
      if (all.length > 0) {
        const recentIsWin = all[0].winnerRosterId === r.id;
        for (const m of all) {
          const w = m.winnerRosterId === r.id;
          if (w === recentIsWin) streak += 1;
          else break;
        }
        if (!recentIsWin) streak = -streak;
      }

      return {
        rosterId: r.id,
        teamId: r.teamId,
        teamName:
          r.team.customName ??
          r.team.school.shortName ??
          r.team.school.name,
        schoolShort: r.team.school.shortName ?? r.team.school.name,
        wins,
        losses,
        forfeits,
        streak,
        points: wins * 3 - forfeits, // 3 per win, -1 per forfeit
        isOwnTeam: ownRosterIds.has(r.id) || ownTeamIds.has(r.teamId),
        rank: 0, // filled in after sort
      };
    });

    rows.sort((a, b) => b.points - a.points || b.wins - a.wins || a.losses - b.losses);
    rows.forEach((row, i) => {
      row.rank = i + 1;
    });

    tables.push({ competitionId: compId, competitionName, game, rows });
  }

  // Sort tables by game name for stable tab order
  tables.sort((a, b) => a.game.localeCompare(b.game));

  return { schoolName: schools[0].name, tables };
}

// --- Single-match detail loader ----------------------------------------

export type CoachMatchLastReport = {
  id: string;
  reportedSide: "HOME" | "AWAY";
  reporterName: string;
  homeScore: number;
  awayScore: number;
  notes: string | null;
  submittedAt: Date;
};

export type CoachMatchDetail = {
  id: string;
  status: string;
  scheduledAt: Date;
  finishedAt: Date | null;
  isForfeit: boolean;
  homeScore: number | null;
  awayScore: number | null;
  side: "HOME" | "AWAY";
  /** True if the viewer's RosterMembership role is COACH/CAPTAIN/MANAGER. */
  canReport: boolean;
  /** Most recent MatchReport on the match — null if none yet. */
  lastReport: CoachMatchLastReport | null;
  ownTeam: {
    id: string;
    name: string;
    schoolName: string;
    schoolShort: string;
    monogram: string;
    rosterId: string;
    lineup: Array<{ userId: string; name: string; role: string; jerseyNumber: number | null; inGameName: string | null }>;
  };
  opponentTeam: {
    id: string;
    name: string;
    schoolName: string;
    schoolShort: string;
    monogram: string;
  };
  game: string;
  competitionName: string;
  bestOf: number;
};

/**
 * Look up a single match for the coach view, gated to matches their school
 * actually owns one side of. Returns null when:
 *   - The match doesn't exist
 *   - The match exists but neither roster belongs to the coach's school(s)
 *   - The coach has no school context at all
 */
export async function loadCoachMatch(
  userId: string,
  matchId: string,
): Promise<CoachMatchDetail | null> {
  const schools = await getCoachSchools(userId);
  if (schools.length === 0) return null;
  const schoolIds = new Set(schools.map((s) => s.id));

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      status: true,
      scheduledAt: true,
      finishedAt: true,
      isForfeit: true,
      homeScore: true,
      awayScore: true,
      bestOf: true,
      homeRoster: {
        select: {
          id: true,
          team: {
            select: {
              id: true,
              customName: true,
              schoolId: true,
              school: { select: { name: true, shortName: true } },
            },
          },
          members: {
            select: {
              role: true,
              jerseyNumber: true,
              inGameName: true,
              user: { select: { id: true, fullName: true } },
            },
            orderBy: [{ role: "asc" }, { jerseyNumber: "asc" }],
          },
        },
      },
      awayRoster: {
        select: {
          id: true,
          team: {
            select: {
              id: true,
              customName: true,
              schoolId: true,
              school: { select: { name: true, shortName: true } },
            },
          },
          members: {
            select: {
              role: true,
              jerseyNumber: true,
              inGameName: true,
              user: { select: { id: true, fullName: true } },
            },
            orderBy: [{ role: "asc" }, { jerseyNumber: "asc" }],
          },
        },
      },
      stage: {
        select: {
          competition: {
            select: { name: true, gameTitle: { select: { name: true } } },
          },
        },
      },
    },
  });

  if (!match) return null;

  const home = match.homeRoster;
  const away = match.awayRoster;
  const homeIsOwn = schoolIds.has(home.team.schoolId);
  const awayIsOwn = schoolIds.has(away.team.schoolId);
  if (!homeIsOwn && !awayIsOwn) return null; // not the coach's match

  const side: "HOME" | "AWAY" = homeIsOwn ? "HOME" : "AWAY";
  const ownRoster = side === "HOME" ? home : away;
  const oppRoster = side === "HOME" ? away : home;

  // Can the viewer report? They must be COACH / CAPTAIN / MANAGER on the
  // own-side roster. Players-only can't submit scores.
  const canReport = ownRoster.members.some(
    (m) =>
      m.user.id === userId &&
      (m.role === "COACH" || m.role === "CAPTAIN" || m.role === "MANAGER"),
  );

  // Latest report on the match (for confirm / dispute UI state)
  const lastReportRow = await prisma.matchReport.findFirst({
    where: { matchId: match.id },
    orderBy: { submittedAt: "desc" },
    select: {
      id: true,
      homeScore: true,
      awayScore: true,
      notes: true,
      submittedAt: true,
      reportedByUser: { select: { fullName: true } },
      reportedByMembership: { select: { rosterId: true } },
    },
  });
  const lastReport: CoachMatchLastReport | null = lastReportRow
    ? {
        id: lastReportRow.id,
        reportedSide:
          lastReportRow.reportedByMembership.rosterId === home.id ? "HOME" : "AWAY",
        reporterName: lastReportRow.reportedByUser.fullName,
        homeScore: lastReportRow.homeScore,
        awayScore: lastReportRow.awayScore,
        notes: lastReportRow.notes,
        submittedAt: lastReportRow.submittedAt,
      }
    : null;

  const teamLabelFor = (t: typeof home.team) =>
    t.customName ?? t.school.shortName ?? t.school.name;
  const monogramFor = (t: typeof home.team) =>
    (t.customName ?? t.school.shortName ?? t.school.name)
      .replace(/[^A-Za-z]/g, "")
      .slice(0, 3)
      .toUpperCase() || "—";

  return {
    id: match.id,
    status: match.status,
    scheduledAt: match.scheduledAt,
    finishedAt: match.finishedAt,
    isForfeit: match.isForfeit,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    side,
    canReport,
    lastReport,
    ownTeam: {
      id: ownRoster.team.id,
      name: teamLabelFor(ownRoster.team),
      schoolName: ownRoster.team.school.name,
      schoolShort: ownRoster.team.school.shortName ?? ownRoster.team.school.name,
      monogram: monogramFor(ownRoster.team),
      rosterId: ownRoster.id,
      lineup: ownRoster.members.map((m) => ({
        userId: m.user.id,
        name: m.user.fullName,
        role: m.role,
        jerseyNumber: m.jerseyNumber,
        inGameName: m.inGameName,
      })),
    },
    opponentTeam: {
      id: oppRoster.team.id,
      name: teamLabelFor(oppRoster.team),
      schoolName: oppRoster.team.school.name,
      schoolShort: oppRoster.team.school.shortName ?? oppRoster.team.school.name,
      monogram: monogramFor(oppRoster.team),
    },
    game: match.stage.competition.gameTitle.name,
    competitionName: match.stage.competition.name.replace(/^Spring 2026 — /, ""),
    bestOf: match.bestOf,
  };
}

// --- helpers -----------------------------------------------------------

function matchSelectShape() {
  return {
    id: true,
    status: true,
    isForfeit: true,
    forfeitingSide: true,
    scheduledAt: true,
    finishedAt: true,
    homeRosterId: true,
    awayRosterId: true,
    homeScore: true,
    awayScore: true,
    winnerRosterId: true,
    homeRoster: {
      select: {
        team: {
          select: {
            customName: true,
            school: { select: { shortName: true, name: true } },
          },
        },
      },
    },
    awayRoster: {
      select: {
        team: {
          select: {
            customName: true,
            school: { select: { shortName: true, name: true } },
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
  } as const;
}

type MatchSelectShape = Awaited<
  ReturnType<typeof prisma.match.findMany<{ select: ReturnType<typeof matchSelectShape> }>>
>[number];

function shapeMatchForCoach(
  m: MatchSelectShape,
  rosterIds: string[],
): CoachUpcomingMatch {
  const isHome = rosterIds.includes(m.homeRosterId);
  const own = isHome ? m.homeRoster?.team : m.awayRoster?.team;
  const opp = isHome ? m.awayRoster?.team : m.homeRoster?.team;
  return {
    matchId: m.id,
    scheduledAt: m.scheduledAt,
    status: m.status,
    ownTeamName: teamLabel(own),
    ownTeamMonogram: monogram(own),
    opponentTeamName: teamLabel(opp),
    opponentSchoolShort: opp?.school.shortName ?? opp?.school.name ?? "—",
    opponentMonogram: monogram(opp),
    game: m.stage.competition.gameTitle.name,
    competitionName: m.stage.competition.name.replace(/^Spring 2026 — /, ""),
    isHome,
  };
}

function teamLabel(t: { customName: string | null; school: { shortName: string | null; name: string } } | null | undefined): string {
  if (!t) return "Unknown";
  return t.customName ?? t.school.shortName ?? t.school.name;
}

function monogram(t: { customName: string | null; school: { shortName: string | null; name: string } } | null | undefined): string {
  if (!t) return "—";
  const src = t.customName ?? t.school.shortName ?? t.school.name;
  return src.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "—";
}

function deriveInitials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "??"
  );
}

// --- Team detail (coach) -----------------------------------------------

export type CoachTeamRoster = {
  rosterId: string;
  competitionId: string;
  competitionName: string;
  game: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  editLocked: boolean;
  members: Array<{
    membershipId: string;
    userId: string;
    name: string;
    email: string;
    role: "MANAGER" | "COACH" | "CAPTAIN" | "PLAYER";
    jerseyNumber: number | null;
    inGameName: string | null;
    isStarter: boolean;
  }>;
};

export type CoachTeamDetail = {
  id: string;
  name: string;
  game: string;
  gameSlug: string;
  tier: string;
  schoolId: string;
  schoolName: string;
  schoolShort: string;
  customName: string | null;
  colorTag: string | null;
  archived: boolean;
  rosters: CoachTeamRoster[];
};

/**
 * Full team detail for the coach view. Returns null if the team doesn't
 * exist OR if the coach isn't a COACH / MANAGER at its school.
 */
export async function loadCoachTeam(
  userId: string,
  teamId: string,
): Promise<CoachTeamDetail | null> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: {
      id: true,
      customName: true,
      colorTag: true,
      skillTier: true,
      archived: true,
      gameTitle: { select: { name: true, slug: true } },
      school: {
        select: {
          id: true,
          name: true,
          shortName: true,
        },
      },
      rosters: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          registrationStatus: true,
          editLock: true,
          competition: {
            select: {
              id: true,
              name: true,
              gameTitle: { select: { name: true } },
            },
          },
          members: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              userId: true,
              role: true,
              jerseyNumber: true,
              inGameName: true,
              isStarter: true,
              user: { select: { fullName: true, email: true } },
            },
          },
        },
      },
    },
  });
  if (!team) return null;

  // Coach gate — only COACH or MANAGER at the team's school can see this
  const membership = await prisma.schoolMembership.findUnique({
    where: { schoolId_userId: { schoolId: team.school.id, userId } },
    select: { role: true },
  });
  if (!membership) return null;
  if (membership.role !== "COACH" && membership.role !== "MANAGER") return null;

  const teamName =
    team.customName ??
    `${team.school.shortName ?? team.school.name} ${team.gameTitle.name}${
      team.colorTag ? ` ${team.colorTag}` : ""
    }`;

  return {
    id: team.id,
    name: teamName,
    game: team.gameTitle.name,
    gameSlug: team.gameTitle.slug,
    tier: team.skillTier,
    schoolId: team.school.id,
    schoolName: team.school.name,
    schoolShort: team.school.shortName ?? team.school.name,
    customName: team.customName,
    colorTag: team.colorTag,
    archived: team.archived,
    rosters: team.rosters.map((r) => ({
      rosterId: r.id,
      competitionId: r.competition.id,
      competitionName: r.competition.name,
      game: r.competition.gameTitle.name,
      status: r.registrationStatus,
      editLocked: r.editLock === "LOCKED",
      members: r.members.map((m) => ({
        membershipId: m.id,
        userId: m.userId,
        name: m.user.fullName,
        email: m.user.email,
        role: m.role,
        jerseyNumber: m.jerseyNumber,
        inGameName: m.inGameName,
        isStarter: m.isStarter,
      })),
    })),
  };
}

// --- Open competitions for a team --------------------------------------

export type OpenCompetitionRow = {
  competitionId: string;
  name: string;
  game: string;
  tier: string;
  registrationOpensAt: Date | null;
  registrationClosesAt: Date | null;
  registeredCount: number;
};

/**
 * Competitions the given team is eligible to register for:
 *   - belong to a league the team's school is an active member of
 *   - match the team's game + skill tier
 *   - registration window currently open (or open-ended)
 *   - team isn't already registered
 */
export async function loadOpenCompetitionsForTeam(
  teamId: string,
): Promise<OpenCompetitionRow[]> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: {
      gameTitleId: true,
      skillTier: true,
      schoolId: true,
      rosters: { select: { competitionId: true } },
    },
  });
  if (!team) return [];

  const memberships = await prisma.leagueMembership.findMany({
    where: { schoolId: team.schoolId, status: "ACTIVE" },
    select: { leagueId: true },
  });
  if (memberships.length === 0) return [];

  const alreadyRegistered = new Set(team.rosters.map((r) => r.competitionId));
  const now = new Date();

  const competitions = await prisma.competition.findMany({
    where: {
      gameTitleId: team.gameTitleId,
      skillTier: team.skillTier,
      season: { leagueId: { in: memberships.map((m) => m.leagueId) } },
      state: { in: ["DRAFT", "ACTIVE"] },
    },
    orderBy: { registrationOpensAt: "asc" },
    select: {
      id: true,
      name: true,
      registrationOpensAt: true,
      registrationClosesAt: true,
      skillTier: true,
      gameTitle: { select: { name: true } },
      _count: { select: { rosters: true } },
    },
  });

  return competitions
    .filter((c) => !alreadyRegistered.has(c.id))
    .filter((c) => !c.registrationOpensAt || c.registrationOpensAt <= now)
    .filter((c) => !c.registrationClosesAt || c.registrationClosesAt >= now)
    .map((c) => ({
      competitionId: c.id,
      name: c.name,
      game: c.gameTitle.name,
      tier: c.skillTier,
      registrationOpensAt: c.registrationOpensAt,
      registrationClosesAt: c.registrationClosesAt,
      registeredCount: c._count.rosters,
    }));
}
