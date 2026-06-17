import { prisma } from "@/lib/db/prisma";

export type ConsentGateSchool = {
  schoolId: string;
  schoolName: string;
  status: string | null;
  ageBand: string | null;
  expiresAt: Date | null;
};

const ACTIVE_CONSENT_STATUSES = [
  "SCHOOL_AUTHORIZED",
  "PARENT_AUTHORIZED",
  "NOT_REQUIRED",
] as const;

export function isActiveConsentStatus(status: string | null | undefined): boolean {
  return Boolean(status && (ACTIVE_CONSENT_STATUSES as readonly string[]).includes(status));
}

export function consentIsCurrentlyActive(consent: {
  status: string;
  expiresAt: Date | null;
  revokedAt: Date | null;
} | null): boolean {
  if (!consent) return false;
  if (!isActiveConsentStatus(consent.status)) return false;
  if (consent.revokedAt) return false;
  if (consent.expiresAt && consent.expiresAt.getTime() <= Date.now()) return false;
  return true;
}

export async function studentHasActiveConsent(userId: string, schoolId: string): Promise<boolean> {
  const consent = await prisma.studentConsent.findUnique({
    where: { studentUserId_schoolId: { studentUserId: userId, schoolId } },
    select: { status: true, expiresAt: true, revokedAt: true },
  });
  return consentIsCurrentlyActive(consent);
}

export async function loadStudentConsentGate(userId: string): Promise<{
  blocked: boolean;
  schools: ConsentGateSchool[];
}> {
  const [schoolMemberships, rosterMemberships] = await Promise.all([
    prisma.schoolMembership.findMany({
      where: { userId, detached: false, role: "PLAYER" },
      select: {
        schoolId: true,
        school: { select: { name: true } },
      },
    }),
    prisma.rosterMembership.findMany({
      where: { userId, role: { in: ["PLAYER", "CAPTAIN"] } },
      select: {
        roster: {
          select: {
            team: {
              select: {
                schoolId: true,
                school: { select: { name: true } },
              },
            },
          },
        },
      },
    }),
  ]);

  const schoolsById = new Map<string, string>();
  for (const membership of schoolMemberships) {
    schoolsById.set(membership.schoolId, membership.school.name);
  }
  for (const membership of rosterMemberships) {
    schoolsById.set(membership.roster.team.schoolId, membership.roster.team.school.name);
  }

  if (schoolsById.size === 0) return { blocked: false, schools: [] };

  const consents = await prisma.studentConsent.findMany({
    where: { studentUserId: userId, schoolId: { in: Array.from(schoolsById.keys()) } },
    select: {
      schoolId: true,
      status: true,
      ageBand: true,
      expiresAt: true,
      revokedAt: true,
    },
  });
  const consentBySchool = new Map(consents.map((consent) => [consent.schoolId, consent]));

  const schools = Array.from(schoolsById.entries()).map(([schoolId, schoolName]) => {
    const consent = consentBySchool.get(schoolId) ?? null;
    return {
      schoolId,
      schoolName,
      status: consent?.status ?? null,
      ageBand: consent?.ageBand ?? null,
      expiresAt: consent?.expiresAt ?? null,
      active: consentIsCurrentlyActive(consent),
    };
  });

  return {
    blocked: schools.some((school) => !school.active),
    schools: schools.map((school) => ({
      schoolId: school.schoolId,
      schoolName: school.schoolName,
      status: school.status,
      ageBand: school.ageBand,
      expiresAt: school.expiresAt,
    })),
  };
}
