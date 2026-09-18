import type { Prisma, PrismaClient } from "@prisma/client";

import { SCHOOL_PARTICIPATION_AGREEMENT_VERSION } from "@/lib/compliance/agreements";
import { prisma } from "@/lib/db/prisma";
import { can, type Actor } from "@/lib/domain/permissions";
import { evaluateTeamCompetitionEligibility } from "@/lib/eligibility/team-competition";

type DbClient = PrismaClient | Prisma.TransactionClient;

export type RegisterTeamForCompetitionResult =
  | { ok: true; rosterId: string; registrationStatus: "PENDING" | "APPROVED" }
  | { ok: false; error: string };

type RegistrationAuthority =
  | { kind: "SCHOOL"; userId: string }
  | { kind: "LEAGUE_ADMIN"; userId: string };

export async function registerTeamForCompetitionForUser(input: {
  userId: string;
  teamId: string;
  competitionId: string;
  db?: PrismaClient;
}): Promise<RegisterTeamForCompetitionResult> {
  return registerTeamForCompetition({
    authority: { kind: "SCHOOL", userId: input.userId },
    teamId: input.teamId,
    competitionId: input.competitionId,
    db: input.db,
  });
}

/**
 * Register an eligible member-school team on behalf of its coach.
 *
 * This does not impersonate the coach or grant the league admin roster-edit
 * access. The admin must hold an explicit league-side permission in the same
 * league as the competition, and the resulting roster is approved immediately
 * because the registering actor is also an approval authority.
 */
export async function registerTeamForCompetitionForLeagueAdmin(input: {
  userId: string;
  teamId: string;
  competitionId: string;
  db?: PrismaClient;
}): Promise<RegisterTeamForCompetitionResult> {
  return registerTeamForCompetition({
    authority: { kind: "LEAGUE_ADMIN", userId: input.userId },
    teamId: input.teamId,
    competitionId: input.competitionId,
    db: input.db,
  });
}

async function registerTeamForCompetition(input: {
  authority: RegistrationAuthority;
  teamId: string;
  competitionId: string;
  db?: PrismaClient;
}): Promise<RegisterTeamForCompetitionResult> {
  const db = input.db ?? prisma;
  const { authority, teamId, competitionId } = input;

  const [team, competition] = await Promise.all([
    db.team.findUnique({
      where: { id: teamId },
      select: {
        id: true,
        schoolId: true,
        school: {
          select: {
            id: true,
            name: true,
            level: true,
            lowGrade: true,
            highGrade: true,
          },
        },
        gameTitleId: true,
        skillTier: true,
        archived: true,
      },
    }),
    db.competition.findUnique({
      where: { id: competitionId },
      select: {
        id: true,
        name: true,
        gameTitleId: true,
        gameTitle: { select: { slug: true } },
        skillTier: true,
        registrationOpensAt: true,
        registrationClosesAt: true,
        registrationRequiresApproval: true,
        state: true,
        status: true,
        divisionId: true,
        season: { select: { id: true, leagueId: true } },
      },
    }),
  ]);

  if (!team) return { ok: false, error: "Team not found." };
  if (team.archived) return { ok: false, error: "This team is archived." };
  if (!competition) return { ok: false, error: "Competition not found." };

  const actorCanRegister = authority.kind === "SCHOOL"
    ? (await loadSchoolCoach(db, authority.userId, team.schoolId)) !== null
    : await leagueAdminCanRegisterForSchool(
        db,
        authority.userId,
        competition.season.leagueId,
      );
  const [agreementAccepted, membership, classification, competitionRosters] = await Promise.all([
    schoolAgreementAccepted(db, team.schoolId),
    db.leagueMembership.findUnique({
      where: {
        leagueId_schoolId: {
          leagueId: competition.season.leagueId,
          schoolId: team.schoolId,
        },
      },
      select: { status: true },
    }),
    db.seasonSchoolClassification.findUnique({
      where: {
        seasonId_schoolId: {
          seasonId: competition.season.id,
          schoolId: team.schoolId,
        },
      },
      select: { effectiveDivisionId: true },
    }),
    db.roster.findMany({
      where: { competitionId },
      select: {
        id: true,
        teamId: true,
        registrationStatus: true,
        team: { select: { schoolId: true } },
      },
    }),
  ]);

  const existing = competitionRosters.find((roster) => roster.teamId === teamId) ?? null;
  const decision = evaluateTeamCompetitionEligibility({
    now: new Date(),
    school: {
      id: team.school.id,
      name: team.school.name,
      level: team.school.level,
      lowGrade: team.school.lowGrade,
      highGrade: team.school.highGrade,
      verifiedInLeague: membership?.status === "ACTIVE",
      agreementAccepted,
      divisionId: classification?.effectiveDivisionId ?? null,
      classificationMissing: competition.divisionId !== null && !classification,
    },
    team: {
      id: team.id,
      gameTitleId: team.gameTitleId,
      skillTier: team.skillTier,
    },
    competition: {
      id: competition.id,
      name: competition.name,
      gameTitleId: competition.gameTitleId,
      gameSlug: competition.gameTitle?.slug ?? "",
      skillTier: competition.skillTier,
      state: competition.state,
      status: competition.status,
      divisionId: competition.divisionId,
      registrationOpensAt: competition.registrationOpensAt,
      registrationClosesAt: competition.registrationClosesAt,
    },
    actor: { canRegister: actorCanRegister },
    state: {
      registeredTeamCount: competitionRosters.filter(
        (roster) =>
          roster.team.schoolId === team.schoolId && roster.registrationStatus !== "REJECTED",
      ).length,
      existingRosterId: existing?.id ?? null,
    },
  });
  if (!decision.eligible) return { ok: false, error: decision.message };

  const registrationStatus = authority.kind === "LEAGUE_ADMIN"
    ? "APPROVED"
    : competition.registrationRequiresApproval
      ? "PENDING"
      : "APPROVED";

  const roster = await db.$transaction(async (tx) => {
    const created = await tx.roster.create({
      data: {
        teamId,
        competitionId,
        registrationStatus,
      },
      select: { id: true },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: authority.userId,
        action:
          authority.kind === "LEAGUE_ADMIN"
            ? "ROSTER.REGISTER_BY_LEAGUE_ADMIN"
            : "ROSTER.REGISTER",
        entityType: "Roster",
        entityId: created.id,
        after: {
          teamId,
          competitionId,
          status: registrationStatus,
        },
        metadata: {
          authority: authority.kind,
          registeredOnBehalfOfSchool: authority.kind === "LEAGUE_ADMIN",
        },
        leagueId: competition.season.leagueId,
        competitionId: competition.id,
        schoolId: team.schoolId,
      },
    });

    return created;
  });

  return { ok: true, rosterId: roster.id, registrationStatus };
}

async function leagueAdminCanRegisterForSchool(
  db: DbClient,
  userId: string,
  leagueId: string,
): Promise<boolean> {
  const adminship = await db.leagueAdminship.findUnique({
    where: { leagueId_userId: { leagueId, userId } },
    select: { role: true },
  });
  if (!adminship || adminship.role === "STAFF") return false;

  const actor: Actor = {
    userId,
    leagueRoles: [{ leagueId, role: adminship.role }],
    schoolRoles: [],
  };
  return can(actor, "registration.registerForSchool", { leagueId });
}

async function loadSchoolCoach(db: DbClient, userId: string, schoolId: string) {
  const membership = await db.schoolMembership.findUnique({
    where: { schoolId_userId: { schoolId, userId } },
    select: { id: true, role: true, isOwner: true },
  });
  if (!membership) return null;
  if (membership.role !== "COACH" && membership.role !== "MANAGER") return null;
  return membership;
}

async function schoolAgreementAccepted(db: DbClient, schoolId: string) {
  const row = await db.agreementAcceptance.findFirst({
    where: {
      schoolId,
      type: "SCHOOL_PARTICIPATION",
      version: SCHOOL_PARTICIPATION_AGREEMENT_VERSION,
      revokedAt: null,
      supersededAt: null,
    },
    select: { id: true },
  });
  return row !== null;
}
