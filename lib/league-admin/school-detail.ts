import type { EligibilityReason } from "@/lib/domain/eligibility";
import { SCHOOL_PARTICIPATION_AGREEMENT_VERSION } from "@/lib/compliance/agreements";
import { prisma } from "@/lib/db/prisma";
import { evaluateTeamCompetitionEligibility } from "@/lib/eligibility/team-competition";

export type LeagueSchoolRegistrationOption = {
  competitionId: string;
  competitionName: string;
  seasonName: string;
  divisionName: string | null;
  eligible: boolean;
  reason: EligibilityReason;
  message: string;
  existingRoster: {
    id: string;
    status: "PENDING" | "APPROVED" | "REJECTED";
    memberCount: number;
  } | null;
};

export type LeagueSchoolTeamDetail = {
  id: string;
  name: string;
  gameName: string;
  gameSlug: string;
  skillTier: string;
  archived: boolean;
  registrationOptions: LeagueSchoolRegistrationOption[];
};

export type LeagueSchoolDetail = {
  school: {
    id: string;
    name: string;
    shortName: string | null;
    ncesId: string | null;
    city: string | null;
    state: string | null;
    level: string | null;
    lowGrade: string | null;
    highGrade: string | null;
  };
  membershipStatus: "PENDING" | "ACTIVE" | "SUSPENDED";
  joinedAt: Date;
  agreementAccepted: boolean;
  staff: Array<{
    id: string;
    name: string;
    email: string;
    role: "MANAGER" | "COACH";
    isOwner: boolean;
  }>;
  teams: LeagueSchoolTeamDetail[];
};

/**
 * League-scoped school detail for the admin surface. A school that does not
 * belong to `leagueId` returns null even when its global id is valid.
 */
export async function loadLeagueSchoolDetail(
  leagueId: string,
  schoolId: string,
): Promise<LeagueSchoolDetail | null> {
  const membership = await prisma.leagueMembership.findUnique({
    where: { leagueId_schoolId: { leagueId, schoolId } },
    select: {
      status: true,
      joinedAt: true,
      school: {
        select: {
          id: true,
          name: true,
          shortName: true,
          ncesId: true,
          city: true,
          state: true,
          level: true,
          lowGrade: true,
          highGrade: true,
          memberships: {
            where: {
              detached: false,
              role: { in: ["MANAGER", "COACH"] },
            },
            orderBy: [{ isOwner: "desc" }, { createdAt: "asc" }],
            select: {
              id: true,
              role: true,
              isOwner: true,
              user: { select: { fullName: true, email: true } },
            },
          },
          teams: {
            orderBy: [{ archived: "asc" }, { createdAt: "asc" }],
            select: {
              id: true,
              customName: true,
              skillTier: true,
              gameTitleId: true,
              archived: true,
              gameTitle: { select: { name: true, slug: true } },
            },
          },
          agreementAcceptances: {
            where: {
              type: "SCHOOL_PARTICIPATION",
              version: SCHOOL_PARTICIPATION_AGREEMENT_VERSION,
              revokedAt: null,
              supersededAt: null,
            },
            take: 1,
            select: { id: true },
          },
        },
      },
    },
  });
  if (!membership) return null;

  const competitions = await prisma.competition.findMany({
    where: { season: { leagueId } },
    orderBy: [{ season: { startsAt: "desc" } }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      gameTitleId: true,
      gameTitle: { select: { slug: true } },
      skillTier: true,
      registrationOpensAt: true,
      registrationClosesAt: true,
      state: true,
      status: true,
      divisionId: true,
      division: { select: { name: true } },
      season: { select: { id: true, name: true } },
      rosters: {
        select: {
          id: true,
          teamId: true,
          registrationStatus: true,
          team: { select: { schoolId: true } },
          _count: { select: { members: true } },
        },
      },
    },
  });

  const classifications = await prisma.seasonSchoolClassification.findMany({
    where: { schoolId, season: { leagueId } },
    select: { seasonId: true, effectiveDivisionId: true },
  });
  const classificationBySeason = new Map(
    classifications.map((classification) => [classification.seasonId, classification]),
  );
  const agreementAccepted = membership.school.agreementAcceptances.length > 0;

  const teams: LeagueSchoolTeamDetail[] = membership.school.teams.map((team) => {
    const registrationOptions = competitions
      .filter(
        (competition) =>
          competition.gameTitleId === team.gameTitleId &&
          competition.skillTier === team.skillTier,
      )
      .map((competition): LeagueSchoolRegistrationOption => {
        const classification = classificationBySeason.get(competition.season.id);
        const existing =
          competition.rosters.find((roster) => roster.teamId === team.id) ?? null;
        const decision = evaluateTeamCompetitionEligibility({
          now: new Date(),
          school: {
            id: membership.school.id,
            name: membership.school.name,
            level: membership.school.level,
            lowGrade: membership.school.lowGrade,
            highGrade: membership.school.highGrade,
            verifiedInLeague: membership.status === "ACTIVE",
            agreementAccepted,
            divisionId: classification?.effectiveDivisionId ?? null,
            classificationMissing:
              competition.divisionId !== null && classification === undefined,
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
            gameSlug: competition.gameTitle.slug,
            skillTier: competition.skillTier,
            state: competition.state,
            status: competition.status,
            divisionId: competition.divisionId,
            registrationOpensAt: competition.registrationOpensAt,
            registrationClosesAt: competition.registrationClosesAt,
          },
          actor: { canRegister: true },
          state: {
            registeredTeamCount: competition.rosters.filter(
              (roster) =>
                roster.team.schoolId === schoolId &&
                roster.registrationStatus !== "REJECTED",
            ).length,
            existingRosterId: existing?.id ?? null,
          },
        });

        return {
          competitionId: competition.id,
          competitionName: competition.name,
          seasonName: competition.season.name,
          divisionName: competition.division?.name ?? null,
          eligible: decision.eligible,
          reason: decision.reason,
          message: decision.message,
          existingRoster: existing
            ? {
                id: existing.id,
                status: existing.registrationStatus,
                memberCount: existing._count.members,
              }
            : null,
        };
      });

    return {
      id: team.id,
      name:
        team.customName ??
        `${membership.school.shortName ?? membership.school.name} ${team.gameTitle.name}`,
      gameName: team.gameTitle.name,
      gameSlug: team.gameTitle.slug,
      skillTier: team.skillTier,
      archived: team.archived,
      registrationOptions,
    };
  });

  return {
    school: {
      id: membership.school.id,
      name: membership.school.name,
      shortName: membership.school.shortName,
      ncesId: membership.school.ncesId,
      city: membership.school.city,
      state: membership.school.state,
      level: membership.school.level,
      lowGrade: membership.school.lowGrade,
      highGrade: membership.school.highGrade,
    },
    membershipStatus: membership.status,
    joinedAt: membership.joinedAt,
    agreementAccepted,
    staff: membership.school.memberships.map((staff) => ({
      id: staff.id,
      name: staff.user.fullName,
      email: staff.user.email,
      role: staff.role as "MANAGER" | "COACH",
      isOwner: staff.isOwner,
    })),
    teams,
  };
}
