import { prisma } from "@/lib/db/prisma";

export const LEAGUE_OPERATOR_AGREEMENT_VERSION = "league-operator-v1-2026-06-16";
export const SCHOOL_PARTICIPATION_AGREEMENT_VERSION = "school-participation-v1-2026-06-16";

export type AgreementStatus = {
  accepted: boolean;
  acceptedAt: Date | null;
  signerName: string | null;
  signerTitle: string | null;
  signerEmail: string | null;
  coverageSource?: string | null;
  version: string;
};

export type PendingSchoolAgreement = {
  schoolId: string;
  schoolName: string;
};

export type PendingLeagueAgreement = {
  leagueId: string;
  leagueName: string;
};

export async function loadSchoolAgreementStatus(schoolId: string): Promise<AgreementStatus> {
  const row = await prisma.agreementAcceptance.findFirst({
    where: {
      schoolId,
      type: "SCHOOL_PARTICIPATION",
      version: SCHOOL_PARTICIPATION_AGREEMENT_VERSION,
      revokedAt: null,
      supersededAt: null,
    },
    orderBy: { createdAt: "desc" },
    select: {
      createdAt: true,
      signerName: true,
      signerTitle: true,
      signerEmail: true,
      coverageSource: true,
    },
  });

  return {
    accepted: Boolean(row),
    acceptedAt: row?.createdAt ?? null,
    signerName: row?.signerName ?? null,
    signerTitle: row?.signerTitle ?? null,
    signerEmail: row?.signerEmail ?? null,
    coverageSource: row?.coverageSource ?? null,
    version: SCHOOL_PARTICIPATION_AGREEMENT_VERSION,
  };
}

export async function loadLeagueAgreementStatus(leagueId: string): Promise<AgreementStatus> {
  const row = await prisma.agreementAcceptance.findFirst({
    where: {
      leagueId,
      type: "LEAGUE_OPERATOR",
      version: LEAGUE_OPERATOR_AGREEMENT_VERSION,
      revokedAt: null,
      supersededAt: null,
    },
    orderBy: { createdAt: "desc" },
    select: {
      createdAt: true,
      signerName: true,
      signerTitle: true,
      signerEmail: true,
    },
  });

  return {
    accepted: Boolean(row),
    acceptedAt: row?.createdAt ?? null,
    signerName: row?.signerName ?? null,
    signerTitle: row?.signerTitle ?? null,
    signerEmail: row?.signerEmail ?? null,
    coverageSource: null,
    version: LEAGUE_OPERATOR_AGREEMENT_VERSION,
  };
}

export async function findPendingSchoolAgreement(
  userId: string,
): Promise<PendingSchoolAgreement | null> {
  const memberships = await prisma.schoolMembership.findMany({
    where: { userId, detached: false, role: "MANAGER" },
    orderBy: [{ isOwner: "desc" }, { createdAt: "asc" }],
    select: {
      schoolId: true,
      school: { select: { name: true } },
    },
  });
  if (memberships.length === 0) return null;

  const schoolIds = memberships.map((membership) => membership.schoolId);
  const acceptedRows = await prisma.agreementAcceptance.findMany({
    where: {
      schoolId: { in: schoolIds },
      type: "SCHOOL_PARTICIPATION",
      version: SCHOOL_PARTICIPATION_AGREEMENT_VERSION,
      revokedAt: null,
      supersededAt: null,
    },
    select: { schoolId: true },
  });
  const acceptedSchoolIds = new Set(acceptedRows.map((row) => row.schoolId).filter(Boolean));

  const pending = memberships.find((membership) => !acceptedSchoolIds.has(membership.schoolId));
  if (!pending) return null;
  return { schoolId: pending.schoolId, schoolName: pending.school.name };
}

export async function findPendingLeagueAgreement(
  userId: string,
): Promise<PendingLeagueAgreement | null> {
  const adminships = await prisma.leagueAdminship.findMany({
    where: { userId, role: { in: ["OWNER", "ADMIN"] } },
    orderBy: { createdAt: "asc" },
    select: {
      leagueId: true,
      league: { select: { name: true } },
    },
  });
  if (adminships.length === 0) return null;

  const leagueIds = adminships.map((adminship) => adminship.leagueId);
  const acceptedRows = await prisma.agreementAcceptance.findMany({
    where: {
      leagueId: { in: leagueIds },
      type: "LEAGUE_OPERATOR",
      version: LEAGUE_OPERATOR_AGREEMENT_VERSION,
      revokedAt: null,
      supersededAt: null,
    },
    select: { leagueId: true },
  });
  const acceptedLeagueIds = new Set(acceptedRows.map((row) => row.leagueId).filter(Boolean));

  const pending = adminships.find((adminship) => !acceptedLeagueIds.has(adminship.leagueId));
  if (!pending) return null;
  return { leagueId: pending.leagueId, leagueName: pending.league.name };
}
