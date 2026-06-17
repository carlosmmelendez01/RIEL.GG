"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";

const ConsentInput = z.object({
  schoolId: z.string().min(1),
  studentUserId: z.string().min(1),
  status: z.enum([
    "PENDING",
    "SCHOOL_AUTHORIZED",
    "PARENT_AUTHORIZED",
    "NOT_REQUIRED",
    "REVOKED",
    "EXPIRED",
  ]),
  ageBand: z.enum(["UNKNOWN", "UNDER_13", "AGE_13_TO_17", "AGE_18_PLUS"]),
  notes: z.string().max(1000).optional(),
});

const DeleteRequestInput = z.object({
  schoolId: z.string().min(1),
  studentUserId: z.string().min(1),
  reason: z.string().max(1000).optional(),
});

export type ComplianceActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function recordStudentConsent(
  input: z.infer<typeof ConsentInput>,
): Promise<ComplianceActionResult> {
  const parsed = ConsentInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid consent request." };

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const { schoolId, studentUserId, status, ageBand, notes } = parsed.data;
  const school = await requireSchoolManager(user.id, schoolId);
  if (!school) return { ok: false, error: "Only school managers can record consent." };

  const studentOk = await studentBelongsToSchool(studentUserId, schoolId);
  if (!studentOk) return { ok: false, error: "That student is not on this school's rosters." };

  const previous = await prisma.studentConsent.findUnique({
    where: { studentUserId_schoolId: { studentUserId, schoolId } },
    select: { status: true, ageBand: true, effectiveAt: true, expiresAt: true, revokedAt: true },
  });

  const now = new Date();
  const consent = await prisma.$transaction(async (tx) => {
    const row = await tx.studentConsent.upsert({
      where: { studentUserId_schoolId: { studentUserId, schoolId } },
      create: {
        studentUserId,
        schoolId,
        status,
        ageBand,
        basis: basisForStatus(status),
        recorderUserId: user.id,
        recorderName: user.fullName,
        notes: notes?.trim() || null,
        effectiveAt: activeStatus(status) ? now : null,
        revokedAt: status === "REVOKED" ? now : null,
      },
      update: {
        status,
        ageBand,
        basis: basisForStatus(status),
        recorderUserId: user.id,
        recorderName: user.fullName,
        notes: notes?.trim() || null,
        effectiveAt: activeStatus(status) ? now : null,
        revokedAt: status === "REVOKED" ? now : null,
      },
      select: { id: true },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: user.id,
        action: "STUDENT_PRIVACY.CONSENT_RECORD",
        entityType: "StudentConsent",
        entityId: row.id,
        before: previous
          ? {
              status: previous.status,
              ageBand: previous.ageBand,
              effectiveAt: previous.effectiveAt?.toISOString() ?? null,
              expiresAt: previous.expiresAt?.toISOString() ?? null,
              revokedAt: previous.revokedAt?.toISOString() ?? null,
            }
          : undefined,
        after: { status, ageBand, schoolId, studentUserId },
        metadata: { notes: notes?.trim() || null, schoolName: school.name },
        schoolId,
      },
    });

    return row;
  });

  revalidateComplianceSurfaces(schoolId);
  revalidatePath("/me");
  return { ok: true, id: consent.id };
}

export async function requestStudentDeletion(
  input: z.infer<typeof DeleteRequestInput>,
): Promise<ComplianceActionResult> {
  const parsed = DeleteRequestInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid deletion request." };

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const { schoolId, studentUserId, reason } = parsed.data;
  const school = await requireSchoolManager(user.id, schoolId);
  if (!school) return { ok: false, error: "Only school managers can request deletion." };

  const studentOk = await studentBelongsToSchool(studentUserId, schoolId);
  if (!studentOk) return { ok: false, error: "That student is not on this school's rosters." };

  const request = await prisma.$transaction(async (tx) => {
    const row = await tx.studentDataRequest.create({
      data: {
        schoolId,
        subjectUserId: studentUserId,
        requestedById: user.id,
        type: "DELETE",
        reason: reason?.trim() || null,
      },
      select: { id: true },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: user.id,
        action: "STUDENT_PRIVACY.DELETE_REQUEST",
        entityType: "StudentDataRequest",
        entityId: row.id,
        after: { schoolId, studentUserId, type: "DELETE", status: "OPEN" },
        metadata: { reason: reason?.trim() || null, schoolName: school.name },
        schoolId,
      },
    });

    return row;
  });

  revalidateComplianceSurfaces(schoolId);
  return { ok: true, id: request.id };
}

async function requireSchoolManager(userId: string, schoolId: string): Promise<{ name: string } | null> {
  const membership = await prisma.schoolMembership.findUnique({
    where: { schoolId_userId: { schoolId, userId } },
    select: {
      role: true,
      school: { select: { name: true } },
    },
  });
  if (!membership || membership.role !== "MANAGER") return null;
  return { name: membership.school.name };
}

async function studentBelongsToSchool(userId: string, schoolId: string): Promise<boolean> {
  const [schoolMembership, rosterMembership] = await Promise.all([
    prisma.schoolMembership.findUnique({
      where: { schoolId_userId: { schoolId, userId } },
      select: { id: true, role: true },
    }),
    prisma.rosterMembership.findFirst({
      where: {
        userId,
        role: { in: ["PLAYER", "CAPTAIN"] },
        roster: { team: { schoolId } },
      },
      select: { id: true },
    }),
  ]);
  return schoolMembership?.role === "PLAYER" || Boolean(rosterMembership);
}

function activeStatus(status: string) {
  return status === "SCHOOL_AUTHORIZED" || status === "PARENT_AUTHORIZED" || status === "NOT_REQUIRED";
}

function basisForStatus(status: string): string | null {
  switch (status) {
    case "SCHOOL_AUTHORIZED":
      return "School-authorized educational use";
    case "PARENT_AUTHORIZED":
      return "Verified parent/guardian consent recorded by school";
    case "NOT_REQUIRED":
      return "Consent not required for this student age band";
    default:
      return null;
  }
}

function revalidateComplianceSurfaces(schoolId: string) {
  revalidatePath("/dashboard/school");
  revalidatePath(`/dashboard/school?s=${schoolId}`);
  revalidatePath("/dashboard");
}
