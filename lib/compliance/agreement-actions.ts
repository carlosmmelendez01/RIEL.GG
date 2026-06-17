"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/current-user";
import {
  LEAGUE_OPERATOR_AGREEMENT_VERSION,
  SCHOOL_PARTICIPATION_AGREEMENT_VERSION,
} from "@/lib/compliance/agreements";
import { prisma } from "@/lib/db/prisma";

const SchoolAgreementInput = z.object({
  schoolId: z.string().min(1),
  signerName: z.string().trim().min(2).max(120),
  signerTitle: z.string().trim().min(2).max(120),
  signerEmail: z.string().trim().email().max(180),
  coverageSource: z.enum([
    "DIRECT_SCHOOL_AUTHORIZATION",
    "LEAGUE_MASTER_AGREEMENT",
    "PARENT_GUARDIAN_REQUIRED",
  ]),
  attestations: z.object({
    authority: z.literal(true),
    terms: z.literal(true),
    privacy: z.literal(true),
    dpa: z.literal(true),
    educationalUse: z.literal(true),
    parentConsentResponsibility: z.literal(true),
  }),
});

const LeagueAgreementInput = z.object({
  leagueId: z.string().min(1),
  signerName: z.string().trim().min(2).max(120),
  signerTitle: z.string().trim().min(2).max(120),
  signerEmail: z.string().trim().email().max(180),
  attestations: z.object({
    authority: z.literal(true),
    terms: z.literal(true),
    privacy: z.literal(true),
    dpa: z.literal(true),
    schoolsNotAutomaticallyBound: z.literal(true),
  }),
});

export type AgreementActionResult =
  | { ok: true; id: string; redirectTo: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function acceptSchoolParticipationAgreement(
  input: unknown,
): Promise<AgreementActionResult> {
  const parsed = SchoolAgreementInput.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const data = parsed.data;
  if (data.signerEmail.toLowerCase() !== user.email.toLowerCase()) {
    return { ok: false, error: "Use the same email address you signed in with." };
  }

  const membership = await prisma.schoolMembership.findUnique({
    where: { schoolId_userId: { schoolId: data.schoolId, userId: user.id } },
    select: {
      role: true,
      isOwner: true,
      school: { select: { id: true, name: true } },
    },
  });
  if (!membership || membership.role !== "MANAGER") {
    return {
      ok: false,
      error: "Only a school manager or owner can accept the school agreement.",
    };
  }

  const requestMeta = await readRequestMeta();
  const agreement = await prisma.$transaction(async (tx) => {
    const row = await tx.agreementAcceptance.create({
      data: {
        type: "SCHOOL_PARTICIPATION",
        version: SCHOOL_PARTICIPATION_AGREEMENT_VERSION,
        schoolId: membership.school.id,
        acceptedById: user.id,
        signerName: data.signerName,
        signerTitle: data.signerTitle,
        signerEmail: data.signerEmail.toLowerCase(),
        coverageSource: data.coverageSource,
        ipAddress: requestMeta.ipAddress,
        userAgent: requestMeta.userAgent,
        attestations: {
          ...data.attestations,
          schoolName: membership.school.name,
          acceptedByEmail: user.email,
          acceptedByUserId: user.id,
        },
      },
      select: { id: true },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: user.id,
        action: "COMPLIANCE.SCHOOL_AGREEMENT_ACCEPTED",
        entityType: "AgreementAcceptance",
        entityId: row.id,
        after: {
          type: "SCHOOL_PARTICIPATION",
          version: SCHOOL_PARTICIPATION_AGREEMENT_VERSION,
          coverageSource: data.coverageSource,
          signerEmail: data.signerEmail.toLowerCase(),
        },
        metadata: {
          schoolName: membership.school.name,
          signerName: data.signerName,
          signerTitle: data.signerTitle,
          ipAddress: requestMeta.ipAddress,
          userAgent: requestMeta.userAgent,
        },
        schoolId: membership.school.id,
      },
    });

    return row;
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/school");
  revalidatePath("/admin/schools");
  revalidatePath(`/agreements/school/${membership.school.id}`);

  return { ok: true, id: agreement.id, redirectTo: "/dashboard/school" };
}

export async function acceptLeagueOperatorAgreement(
  input: unknown,
): Promise<AgreementActionResult> {
  const parsed = LeagueAgreementInput.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const data = parsed.data;
  if (data.signerEmail.toLowerCase() !== user.email.toLowerCase()) {
    return { ok: false, error: "Use the same email address you signed in with." };
  }

  const adminship = await prisma.leagueAdminship.findUnique({
    where: { leagueId_userId: { leagueId: data.leagueId, userId: user.id } },
    select: {
      role: true,
      league: { select: { id: true, name: true } },
    },
  });
  if (!adminship || (adminship.role !== "OWNER" && adminship.role !== "ADMIN")) {
    return {
      ok: false,
      error: "Only a league owner or admin can accept the league agreement.",
    };
  }

  const requestMeta = await readRequestMeta();
  const agreement = await prisma.$transaction(async (tx) => {
    const row = await tx.agreementAcceptance.create({
      data: {
        type: "LEAGUE_OPERATOR",
        version: LEAGUE_OPERATOR_AGREEMENT_VERSION,
        leagueId: adminship.league.id,
        acceptedById: user.id,
        signerName: data.signerName,
        signerTitle: data.signerTitle,
        signerEmail: data.signerEmail.toLowerCase(),
        ipAddress: requestMeta.ipAddress,
        userAgent: requestMeta.userAgent,
        attestations: {
          ...data.attestations,
          leagueName: adminship.league.name,
          acceptedByEmail: user.email,
          acceptedByUserId: user.id,
        },
      },
      select: { id: true },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: user.id,
        action: "COMPLIANCE.LEAGUE_AGREEMENT_ACCEPTED",
        entityType: "AgreementAcceptance",
        entityId: row.id,
        after: {
          type: "LEAGUE_OPERATOR",
          version: LEAGUE_OPERATOR_AGREEMENT_VERSION,
          signerEmail: data.signerEmail.toLowerCase(),
        },
        metadata: {
          leagueName: adminship.league.name,
          signerName: data.signerName,
          signerTitle: data.signerTitle,
          ipAddress: requestMeta.ipAddress,
          userAgent: requestMeta.userAgent,
        },
        leagueId: adminship.league.id,
      },
    });

    return row;
  });

  revalidatePath("/admin");
  revalidatePath("/admin/schools");
  revalidatePath("/platform/leagues");
  revalidatePath(`/agreements/league/${adminship.league.id}`);

  return { ok: true, id: agreement.id, redirectTo: "/admin" };
}

async function readRequestMeta(): Promise<{ ipAddress: string | null; userAgent: string | null }> {
  const headerStore = await headers();
  const forwardedFor = headerStore.get("x-forwarded-for");
  const ipAddress =
    forwardedFor?.split(",")[0]?.trim() ||
    headerStore.get("x-real-ip") ||
    headerStore.get("cf-connecting-ip");
  return {
    ipAddress: ipAddress || null,
    userAgent: headerStore.get("user-agent"),
  };
}

function validationError(error: z.ZodError): AgreementActionResult {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = issue.path.join(".");
    if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
  }
  return {
    ok: false,
    error: "Please complete every required agreement checkbox and signer field.",
    fieldErrors,
  };
}
