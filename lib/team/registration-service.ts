import type { Prisma, PrismaClient } from "@prisma/client";

import { SCHOOL_PARTICIPATION_AGREEMENT_VERSION } from "@/lib/compliance/agreements";
import { prisma } from "@/lib/db/prisma";
import { evaluateTeamCompetitionEligibility } from "@/lib/eligibility/team-competition";

type DbClient = PrismaClient | Prisma.TransactionClient;

export type RegisterTeamForCompetitionResult =
  | { ok: true; rosterId: string; registrationStatus: "PENDING" | "APPROVED" }
  | { ok: false; error: string };

export async function registerTeamForCompetitionForUser(input: {
  userId: string;
  teamId: string;
  competitionId: string;
  db?: PrismaClient;
}): Promise<RegisterTeamForCompetitionResult> {
  const db = input.db ?? prisma;
  const { userId, teamId, competitionId } = input;

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

  const coach = await loadSchoolCoach(db, userId, team.schoolId);
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
    actor: { canRegister: coach !== null },
    state: {
      registeredTeamCount: competitionRosters.filter(
        (roster) =>
          roster.team.schoolId === team.schoolId && roster.registrationStatus !== "REJECTED",
      ).length,
      existingRosterId: existing?.id ?? null,
    },
  });
  if (!decision.eligible) return { ok: false, error: decision.message };

  const registrationStatus = competition.registrationRequiresApproval ? "PENDING" : "APPROVED";

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
        actorUserId: userId,
        action: "ROSTER.REGISTER",
        entityType: "Roster",
        entityId: created.id,
        after: {
          teamId,
          competitionId,
          status: registrationStatus,
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
