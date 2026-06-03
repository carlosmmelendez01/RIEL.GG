/**
 * League admin dashboard data layer.
 *
 * Loads everything `/admin` and its sub-routes need, scoped strictly to the
 * league(s) the signed-in admin runs. Admins at different leagues see
 * entirely different dashboards — no mock-data Carmel-everywhere leak.
 *
 * `requireLeagueAdmin(userId)` is the auth gate every /admin/* page should
 * call up front. Returns null when:
 *   - The user isn't signed in
 *   - The user has no LeagueAdminship row (i.e., not an admin anywhere)
 *
 * Multi-league admins are rare — for now we pick their first adminship as
 * primary. A proper "active league" cookie + switcher lands in a later sprint
 * (mirrors the future multi-school coach switcher).
 */

import { prisma } from "@/lib/db/prisma";

// --- Types --------------------------------------------------------------

export type AdminLeague = {
  id: string;
  slug: string;
  name: string;
  shortName: string;
};

export type AdminContext = {
  admin: {
    userId: string;
    name: string;
    initials: string;
    email: string;
    role: "OWNER" | "ADMIN" | "STAFF";
  };
  league: AdminLeague;
  /** Every league the user can admin — for the future switcher. */
  allLeagues: AdminLeague[];
};

export type LeagueAdminCounts = {
  memberSchools: number;
  pendingSchoolApplications: number;
  activeCompetitions: number;
  draftCompetitions: number;
  finishedCompetitions: number;
  teamsRegistered: number;
  expectedTeams: number;
  matchesThisWeek: number;
  activePlayers: number;
  openDisputes: number;
};

export type LeagueCompetition = {
  id: string;
  name: string;
  game: string;
  tier: string;
  state: "DRAFT" | "ACTIVE" | "COMPLETE";
  status: "SEEDING" | "IN_PROGRESS" | "FINISHED";
  registeredTeams: number;
  expectedTeams: number;
  matchesPlayed: number;
  matchesTotal: number;
  /** True when the competition has a single-elim playoff stage to run. */
  hasPlayoffStage: boolean;
};

export type LeagueDispute = {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  game: string;
  competition: string;
  scheduledAt: Date;
  raisedAt: Date;
  raisedByName: string | null;
};

export type LeagueActivityEntry = {
  id: string;
  action: string;
  actorName: string | null;
  when: Date;
  entityType: string;
  entityId: string;
  matchId: string | null;
  schoolId: string | null;
};

export type LeagueAdminDashboardData = {
  ctx: AdminContext;
  counts: LeagueAdminCounts;
  competitions: LeagueCompetition[];
  disputes: LeagueDispute[];
  recentActivity: LeagueActivityEntry[];
};

// --- Auth gate ----------------------------------------------------------

/**
 * Resolve the signed-in user's admin context. Returns null when they
 * aren't a league admin anywhere — caller renders the no-admin empty state.
 */
export async function requireLeagueAdmin(userId: string): Promise<AdminContext | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, fullName: true, email: true },
  });
  if (!user) return null;

  const adminships = await prisma.leagueAdminship.findMany({
    where: { userId },
    include: {
      league: { select: { id: true, slug: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  if (adminships.length === 0) return null;

  const primary = adminships[0];
  const league: AdminLeague = {
    id: primary.league.id,
    slug: primary.league.slug,
    name: primary.league.name,
    shortName: shortNameFor(primary.league.name),
  };
  const allLeagues: AdminLeague[] = adminships.map((a) => ({
    id: a.league.id,
    slug: a.league.slug,
    name: a.league.name,
    shortName: shortNameFor(a.league.name),
  }));

  return {
    admin: {
      userId: user.id,
      name: user.fullName,
      initials: deriveInitials(user.fullName),
      email: user.email,
      role: primary.role,
    },
    league,
    allLeagues,
  };
}

// --- Full dashboard payload --------------------------------------------

export async function loadLeagueAdminDashboard(
  userId: string,
): Promise<LeagueAdminDashboardData | null> {
  const ctx = await requireLeagueAdmin(userId);
  if (!ctx) return null;

  const leagueId = ctx.league.id;

  // -- 1. Member school count + pending applications + active players --
  const [memberSchools, pendingApplications, leagueMembershipRows] = await Promise.all([
    prisma.leagueMembership.count({ where: { leagueId } }),
    prisma.schoolApplication.count({ where: { leagueId, status: "PENDING" } }),
    prisma.leagueMembership.findMany({
      where: { leagueId },
      select: { school: { select: { id: true } } },
    }),
  ]);
  const schoolIds = leagueMembershipRows.map((m) => m.school.id);

  // Distinct players across all teams at member schools
  const playerCountRows = schoolIds.length === 0
    ? []
    : await prisma.rosterMembership.findMany({
        where: { roster: { team: { schoolId: { in: schoolIds } } } },
        select: { userId: true },
        distinct: ["userId"],
      });
  const activePlayers = playerCountRows.length;

  // -- 2. Competitions for this league's current season ----------------
  const competitions = await prisma.competition.findMany({
    where: { season: { leagueId } },
    orderBy: { createdAt: "asc" },
    include: {
      gameTitle: { select: { name: true } },
      rosters: {
        select: {
          id: true,
          _count: { select: { members: true } },
        },
      },
      stages: {
        select: {
          kind: true,
          schedulingMethod: true,
          _count: { select: { matches: true } },
          matches: {
            where: { status: { in: ["FINISHED", "FORFEITED"] } },
            select: { id: true },
          },
        },
      },
    },
  });

  const compRows: LeagueCompetition[] = competitions.map((c) => {
    const registeredTeams = c.rosters.length;
    const matchesTotal = c.stages.reduce((s, st) => s + st._count.matches, 0);
    const matchesPlayed = c.stages.reduce((s, st) => s + st.matches.length, 0);
    const hasPlayoffStage = c.stages.some(
      (st) => st.kind === "SINGLE_ELIM" || st.schedulingMethod === "SINGLE_ELIM",
    );
    // Expected teams — we don't track this on the schema yet; use a sensible
    // default of "registered + slack" so the progress bar still reads
    return {
      id: c.id,
      name: c.name.replace(/^Spring 2026 — /, ""),
      game: c.gameTitle.name,
      tier: c.skillTier,
      state: c.state as LeagueCompetition["state"],
      status: c.status as LeagueCompetition["status"],
      registeredTeams,
      expectedTeams: Math.max(registeredTeams + 4, 12),
      matchesPlayed,
      matchesTotal,
      hasPlayoffStage,
    };
  });

  // -- 3. This week's match count --------------------------------------
  const now = new Date();
  const weekStart = startOfWeek(now);
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
  const matchesThisWeek = await prisma.match.count({
    where: {
      stage: { competition: { season: { leagueId } } },
      scheduledAt: { gte: weekStart, lt: weekEnd },
    },
  });

  // -- 4. Disputes — matches with DISPUTED status ----------------------
  const disputeRows = await prisma.match.findMany({
    where: {
      stage: { competition: { season: { leagueId } } },
      status: "DISPUTED",
    },
    orderBy: { updatedAt: "desc" },
    take: 10,
    select: {
      id: true,
      scheduledAt: true,
      updatedAt: true,
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
            select: { name: true, gameTitle: { select: { name: true } } },
          },
        },
      },
      reports: {
        orderBy: { submittedAt: "desc" },
        take: 1,
        select: { reportedByMembership: { select: { user: { select: { fullName: true } } } } },
      },
    },
  });

  const disputes: LeagueDispute[] = disputeRows.map((m) => ({
    matchId: m.id,
    homeTeam: teamLabel(m.homeRoster?.team),
    awayTeam: teamLabel(m.awayRoster?.team),
    game: m.stage.competition.gameTitle.name,
    competition: m.stage.competition.name.replace(/^Spring 2026 — /, ""),
    scheduledAt: m.scheduledAt,
    raisedAt: m.updatedAt,
    raisedByName: m.reports[0]?.reportedByMembership.user.fullName ?? null,
  }));

  // -- 5. Recent activity from AuditLog --------------------------------
  const activityRows = await prisma.auditLog.findMany({
    where: { leagueId },
    orderBy: { createdAt: "desc" },
    take: 12,
    include: {
      actorUser: { select: { fullName: true } },
    },
  });

  const recentActivity: LeagueActivityEntry[] = activityRows.map((a) => ({
    id: a.id,
    action: a.action,
    actorName: a.actorUser?.fullName ?? null,
    when: a.createdAt,
    entityType: a.entityType,
    entityId: a.entityId,
    matchId: a.matchId,
    schoolId: a.schoolId,
  }));

  // -- 6. Roll up counts ----------------------------------------------
  const teamsRegistered = compRows.reduce((s, c) => s + c.registeredTeams, 0);
  const expectedTeams = compRows.reduce((s, c) => s + c.expectedTeams, 0);
  const counts: LeagueAdminCounts = {
    memberSchools,
    pendingSchoolApplications: pendingApplications,
    activeCompetitions: compRows.filter((c) => c.state === "ACTIVE").length,
    draftCompetitions: compRows.filter((c) => c.state === "DRAFT").length,
    finishedCompetitions: compRows.filter((c) => c.state === "COMPLETE").length,
    teamsRegistered,
    expectedTeams,
    matchesThisWeek,
    activePlayers,
    openDisputes: disputes.length,
  };

  return {
    ctx,
    counts,
    competitions: compRows,
    disputes,
    recentActivity,
  };
}

// --- League schools directory ------------------------------------------

export type LeagueSchoolRow = {
  schoolId: string;
  name: string;
  shortName: string | null;
  ncesId: string | null;
  state: string | null;
  city: string | null;
  joinedAt: Date;
  teamCount: number;
  playerCount: number;
  coachCount: number;
};

/**
 * Every school in the admin's league with team + player + coach counts.
 * Used by /admin/schools.
 */
export async function loadLeagueSchools(leagueId: string): Promise<LeagueSchoolRow[]> {
  const memberships = await prisma.leagueMembership.findMany({
    where: { leagueId },
    orderBy: { joinedAt: "asc" },
    select: {
      joinedAt: true,
      school: {
        select: {
          id: true,
          name: true,
          shortName: true,
          ncesId: true,
          state: true,
          city: true,
          teams: {
            select: {
              id: true,
              rosters: {
                select: {
                  _count: { select: { members: true } },
                  members: {
                    where: { role: { in: ["COACH", "MANAGER"] } },
                    select: { userId: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  return memberships.map((m) => {
    const teamCount = m.school.teams.length;
    let playerCount = 0;
    const coachIds = new Set<string>();
    for (const t of m.school.teams) {
      for (const r of t.rosters) {
        playerCount += r._count.members;
        for (const c of r.members) coachIds.add(c.userId);
      }
    }
    return {
      schoolId: m.school.id,
      name: m.school.name,
      shortName: m.school.shortName,
      ncesId: m.school.ncesId,
      state: m.school.state,
      city: m.school.city,
      joinedAt: m.joinedAt,
      teamCount,
      playerCount,
      coachCount: coachIds.size,
    };
  });
}

// --- Pending school applications ---------------------------------------

export type PendingApplicationRow = {
  id: string;
  schoolName: string;
  schoolShort: string | null;
  schoolCity: string | null;
  schoolState: string | null;
  schoolCode: string | null;
  ncesId: string | null;
  coachName: string;
  coachEmail: string;
  coachRole: string;
  reason: string | null;
  createdAt: Date;
  /** True when we already track a School row with this NCES id. */
  hasExistingSchool: boolean;
};

/**
 * Pending applications waiting on admin review. Sorted oldest-first so the
 * queue feels like a real queue.
 */
export async function loadPendingApplications(
  leagueId: string,
): Promise<PendingApplicationRow[]> {
  const rows = await prisma.schoolApplication.findMany({
    where: { leagueId, status: "PENDING" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      schoolId: true,
      schoolName: true,
      schoolShort: true,
      schoolCity: true,
      schoolState: true,
      schoolCode: true,
      ncesId: true,
      coachName: true,
      coachEmail: true,
      coachRole: true,
      reason: true,
      createdAt: true,
    },
  });

  return rows.map((r) => ({
    id: r.id,
    schoolName: r.schoolName,
    schoolShort: r.schoolShort,
    schoolCity: r.schoolCity,
    schoolState: r.schoolState,
    schoolCode: r.schoolCode,
    ncesId: r.ncesId,
    coachName: r.coachName,
    coachEmail: r.coachEmail,
    coachRole: r.coachRole,
    reason: r.reason,
    createdAt: r.createdAt,
    hasExistingSchool: r.schoolId !== null,
  }));
}

// --- League-wide match list --------------------------------------------

export type LeagueMatchRow = {
  matchId: string;
  scheduledAt: Date;
  finishedAt: Date | null;
  status: string;
  isForfeit: boolean;
  homeTeam: string;
  homeMonogram: string;
  homeSchoolShort: string;
  awayTeam: string;
  awayMonogram: string;
  awaySchoolShort: string;
  homeScore: number | null;
  awayScore: number | null;
  competition: string;
  game: string;
  tier: string;
};

/**
 * All matches in the admin's league, sorted by scheduledAt desc. Used by
 * the /admin/matches list view. Cross-school by design — admins NEED to
 * see every match in their league.
 */
export async function loadLeagueMatches(
  leagueId: string,
): Promise<LeagueMatchRow[]> {
  const rows = await prisma.match.findMany({
    where: { stage: { competition: { season: { leagueId } } } },
    orderBy: { scheduledAt: "desc" },
    take: 200, // safety cap; paginate later
    select: {
      id: true,
      status: true,
      isForfeit: true,
      scheduledAt: true,
      finishedAt: true,
      homeScore: true,
      awayScore: true,
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
              skillTier: true,
              gameTitle: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  return rows.map((m) => ({
    matchId: m.id,
    scheduledAt: m.scheduledAt,
    finishedAt: m.finishedAt,
    status: m.status,
    isForfeit: m.isForfeit,
    homeTeam: teamLabel(m.homeRoster?.team),
    homeMonogram: monogramFor(m.homeRoster?.team),
    homeSchoolShort:
      m.homeRoster?.team.school.shortName ?? m.homeRoster?.team.school.name ?? "—",
    awayTeam: teamLabel(m.awayRoster?.team),
    awayMonogram: monogramFor(m.awayRoster?.team),
    awaySchoolShort:
      m.awayRoster?.team.school.shortName ?? m.awayRoster?.team.school.name ?? "—",
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    competition: m.stage.competition.name.replace(/^Spring 2026 — /, ""),
    game: m.stage.competition.gameTitle.name,
    tier: m.stage.competition.skillTier,
  }));
}

// --- Single-match admin detail -----------------------------------------

export type LeagueMatchDetail = {
  id: string;
  status: string;
  isForfeit: boolean;
  forfeitReason: string | null;
  forfeitNotes: string | null;
  forfeitingSide: "HOME" | "AWAY" | null;
  rescheduleAttempted: boolean | null;
  scheduledAt: Date;
  finishedAt: Date | null;
  bestOf: number;
  homeScore: number | null;
  awayScore: number | null;
  home: TeamAdminView;
  away: TeamAdminView;
  game: string;
  competition: string;
  tier: string;
  reports: Array<{
    id: string;
    reportedByName: string;
    reportedByTeam: "HOME" | "AWAY";
    homeScore: number;
    awayScore: number;
    notes: string | null;
    submittedAt: Date;
  }>;
  matchAuditEntries: Array<{
    id: string;
    action: string;
    actorName: string | null;
    when: Date;
  }>;
};

export type TeamAdminView = {
  rosterId: string;
  schoolId: string;
  schoolName: string;
  schoolShort: string;
  teamName: string;
  monogram: string;
  lineup: Array<{
    userId: string;
    name: string;
    role: string;
    jerseyNumber: number | null;
    inGameName: string | null;
  }>;
};

/**
 * Full match detail for the league admin view. Scope-gates: returns null if
 * the match exists but doesn't belong to the admin's league.
 */
export async function loadLeagueMatchDetail(
  leagueId: string,
  matchId: string,
): Promise<LeagueMatchDetail | null> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      status: true,
      isForfeit: true,
      forfeitReason: true,
      forfeitNotes: true,
      forfeitingSide: true,
      rescheduleAttempted: true,
      scheduledAt: true,
      finishedAt: true,
      bestOf: true,
      homeScore: true,
      awayScore: true,
      homeRoster: rosterAdminSelect(),
      awayRoster: rosterAdminSelect(),
      stage: {
        select: {
          competition: {
            select: {
              name: true,
              skillTier: true,
              gameTitle: { select: { name: true } },
              season: { select: { leagueId: true } },
            },
          },
        },
      },
      reports: {
        orderBy: { submittedAt: "desc" },
        take: 10,
        select: {
          id: true,
          homeScore: true,
          awayScore: true,
          notes: true,
          submittedAt: true,
          reportedByUser: { select: { fullName: true } },
          reportedByMembership: { select: { rosterId: true } },
        },
      },
    },
  });

  if (!match) return null;

  // Scope gate — match must belong to the admin's league
  if (match.stage.competition.season.leagueId !== leagueId) return null;

  const homeRosterId = match.homeRoster?.id ?? "";
  const reports = match.reports.map((r) => ({
    id: r.id,
    reportedByName: r.reportedByUser.fullName,
    reportedByTeam: r.reportedByMembership.rosterId === homeRosterId
      ? ("HOME" as const)
      : ("AWAY" as const),
    homeScore: r.homeScore,
    awayScore: r.awayScore,
    notes: r.notes,
    submittedAt: r.submittedAt,
  }));

  // Per-match audit trail (override / dispute / forfeit history)
  const auditRows = await prisma.auditLog.findMany({
    where: { matchId },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { actorUser: { select: { fullName: true } } },
  });
  const matchAuditEntries = auditRows.map((a) => ({
    id: a.id,
    action: a.action,
    actorName: a.actorUser?.fullName ?? null,
    when: a.createdAt,
  }));

  return {
    id: match.id,
    status: match.status,
    isForfeit: match.isForfeit,
    forfeitReason: match.forfeitReason,
    forfeitNotes: match.forfeitNotes,
    forfeitingSide: match.forfeitingSide as "HOME" | "AWAY" | null,
    rescheduleAttempted: match.rescheduleAttempted,
    scheduledAt: match.scheduledAt,
    finishedAt: match.finishedAt,
    bestOf: match.bestOf,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    home: shapeTeam(match.homeRoster),
    away: shapeTeam(match.awayRoster),
    game: match.stage.competition.gameTitle.name,
    competition: match.stage.competition.name.replace(/^Spring 2026 — /, ""),
    tier: match.stage.competition.skillTier,
    reports,
    matchAuditEntries,
  };
}

// Plain function so Prisma's generated types pick up the select shape
// correctly. Returning the literal each call keeps the inferred input as
// mutable arrays (not readonly), which Prisma's input types require.
function rosterAdminSelect() {
  return {
    select: {
      id: true,
      team: {
        select: {
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
        orderBy: [
          { role: "asc" as const },
          { jerseyNumber: "asc" as const },
        ],
      },
    },
  };
}

type RosterAdminShape = {
  id: string;
  team: {
    customName: string | null;
    schoolId: string;
    school: { name: string; shortName: string | null };
  };
  members: Array<{
    role: string;
    jerseyNumber: number | null;
    inGameName: string | null;
    user: { id: string; fullName: string };
  }>;
};

function shapeTeam(r: RosterAdminShape | null | undefined): TeamAdminView {
  if (!r) {
    return {
      rosterId: "",
      schoolId: "",
      schoolName: "Unknown",
      schoolShort: "—",
      teamName: "Unknown",
      monogram: "—",
      lineup: [],
    };
  }
  return {
    rosterId: r.id,
    schoolId: r.team.schoolId,
    schoolName: r.team.school.name,
    schoolShort: r.team.school.shortName ?? r.team.school.name,
    teamName: r.team.customName ?? r.team.school.shortName ?? r.team.school.name,
    monogram: monogramFor(r.team),
    lineup: r.members.map((m) => ({
      userId: m.user.id,
      name: m.user.fullName,
      role: m.role,
      jerseyNumber: m.jerseyNumber,
      inGameName: m.inGameName,
    })),
  };
}

function monogramFor(
  t: { customName: string | null; school: { shortName: string | null; name: string } } | null | undefined,
): string {
  if (!t) return "—";
  const src = t.customName ?? t.school.shortName ?? t.school.name;
  return src.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "—";
}

// --- Helpers ------------------------------------------------------------

function teamLabel(
  t: { customName: string | null; school: { shortName: string | null; name: string } } | null | undefined,
): string {
  if (!t) return "Unknown";
  return t.customName ?? t.school.shortName ?? t.school.name;
}

function shortNameFor(leagueName: string): string {
  // "RIEL Esports League" -> "RIEL"
  // "Hoosier Esports Alliance" -> "HEA"
  // Pick whichever is more readable
  if (/^[A-Z]{2,5}\b/.test(leagueName)) {
    return leagueName.match(/^[A-Z]+/)![0];
  }
  return leagueName
    .split(/\s+/)
    .filter((w) => /^[A-Z]/.test(w))
    .map((w) => w[0])
    .join("")
    .slice(0, 4)
    .toUpperCase();
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

function startOfWeek(d: Date): Date {
  // Week starts Monday
  const day = d.getDay();
  const diff = (day + 6) % 7;
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  out.setDate(out.getDate() - diff);
  return out;
}

// --- Pending roster registrations --------------------------------------

export type PendingRosterRow = {
  rosterId: string;
  competitionId: string;
  competitionName: string;
  game: string;
  schoolId: string;
  schoolName: string;
  schoolShort: string;
  teamName: string;
  tier: string;
  rosterSize: number;
  submittedAt: Date;
};

/**
 * Every roster awaiting admin approval across the league. Sorted oldest-
 * first so the queue clears in order.
 */
export async function loadPendingRosters(
  leagueId: string,
): Promise<PendingRosterRow[]> {
  const rows = await prisma.roster.findMany({
    where: {
      registrationStatus: "PENDING",
      competition: { season: { leagueId } },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      createdAt: true,
      _count: { select: { members: true } },
      team: {
        select: {
          customName: true,
          colorTag: true,
          skillTier: true,
          school: { select: { id: true, name: true, shortName: true } },
          gameTitle: { select: { name: true } },
        },
      },
      competition: {
        select: {
          id: true,
          name: true,
          gameTitle: { select: { name: true } },
        },
      },
    },
  });

  return rows.map((r) => {
    const teamName =
      r.team.customName ??
      `${r.team.school.shortName ?? r.team.school.name} ${r.team.gameTitle.name}${
        r.team.colorTag ? ` ${r.team.colorTag}` : ""
      }`;
    return {
      rosterId: r.id,
      competitionId: r.competition.id,
      competitionName: r.competition.name,
      game: r.competition.gameTitle.name,
      schoolId: r.team.school.id,
      schoolName: r.team.school.name,
      schoolShort: r.team.school.shortName ?? r.team.school.name,
      teamName,
      tier: r.team.skillTier,
      rosterSize: r._count.members,
      submittedAt: r.createdAt,
    };
  });
}
