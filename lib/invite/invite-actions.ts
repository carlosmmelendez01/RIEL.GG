"use server";

/**
 * Invite acceptance server actions.
 *
 *   - `acceptSchoolInvite(code)` — signed-in user claims a school invite.
 *     Validates the invite is ACTIVE, not expired, not exhausted, and that
 *     `intendedEmail` (if set) matches the signed-in user. On success,
 *     upserts a `SchoolMembership` granting the listed roles + ownership,
 *     increments `usedCount`, marks the invite EXHAUSTED if it's reached
 *     maxUses, and writes an `AuditLog` row.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { emailUrl, sendEmail } from "@/lib/email/send";
import {
  SchoolInviteCreated,
  schoolInviteCreatedText,
} from "@/lib/email/templates/school-invite-created";
import { generateInviteCode } from "@/lib/invite/helpers";

// --- Shared helpers ----------------------------------------------------

function revalidatePostClaim() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/teams");
  revalidatePath("/dashboard/school");
  revalidatePath("/me");
  revalidatePath("/admin/schools");
}

function revalidateSchoolInviteSurfaces(schoolId: string) {
  revalidatePath("/dashboard/school");
  revalidatePath(`/dashboard/school?s=${schoolId}`); // for future query-param switcher
  revalidatePath("/admin/schools");
}

const VALID_SCHOOL_ROLES = new Set(["MANAGER", "COACH", "PLAYER"]);

/**
 * Returns the SchoolMembership row if the user is a COACH or MANAGER at
 * the school, else null. Used to gate invite creation/revocation.
 */
async function loadSchoolCoach(userId: string, schoolId: string) {
  const m = await prisma.schoolMembership.findUnique({
    where: { schoolId_userId: { schoolId, userId } },
    select: { id: true, role: true, isOwner: true },
  });
  if (!m) return null;
  if (m.role !== "COACH" && m.role !== "MANAGER") return null;
  return m;
}

// --- acceptSchoolInvite ------------------------------------------------

const AcceptInput = z.object({
  code: z.string().min(8).max(64),
});

export type AcceptSchoolInviteResult =
  | {
      ok: true;
      schoolId: string;
      schoolName: string;
      role: "MANAGER" | "COACH" | "PLAYER";
      isOwner: boolean;
    }
  | { ok: false; error: string; code?: "EMAIL_MISMATCH" | "EXPIRED" | "EXHAUSTED" | "NOT_FOUND" | "WRONG_SCOPE" | "NO_USER" };

export async function acceptSchoolInvite(input: {
  code: string;
}): Promise<AcceptSchoolInviteResult> {
  const parsed = AcceptInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid invite code.", code: "NOT_FOUND" };
  }
  const { code } = parsed.data;

  const user = await getCurrentUser();
  if (!user) {
    return {
      ok: false,
      error: "Sign in first — then come back to claim this invite.",
      code: "NO_USER",
    };
  }

  const invite = await prisma.invite.findUnique({
    where: { code },
    select: {
      id: true,
      scope: true,
      schoolId: true,
      status: true,
      rolesGranted: true,
      grantsOwnership: true,
      intendedEmail: true,
      maxUses: true,
      usedCount: true,
      expiresAt: true,
      school: { select: { id: true, name: true } },
    },
  });
  if (!invite) {
    return {
      ok: false,
      error: "Invite not found. Double-check the link — it may have been mistyped.",
      code: "NOT_FOUND",
    };
  }
  if (invite.scope !== "SCHOOL" || !invite.schoolId || !invite.school) {
    return {
      ok: false,
      error: "This invite isn't for a school. Reach out to the league office if you got this link by mistake.",
      code: "WRONG_SCOPE",
    };
  }

  // Lifecycle checks
  const now = new Date();
  if (invite.status === "REVOKED") {
    return { ok: false, error: "This invite was revoked.", code: "EXHAUSTED" };
  }
  if (invite.status === "EXPIRED" || (invite.expiresAt && invite.expiresAt < now)) {
    return {
      ok: false,
      error: "This invite has expired. Ask the league admin to reissue it.",
      code: "EXPIRED",
    };
  }
  if (invite.status === "EXHAUSTED" || invite.usedCount >= invite.maxUses) {
    return {
      ok: false,
      error: "This invite has already been used.",
      code: "EXHAUSTED",
    };
  }

  // Email match — case-insensitive
  if (
    invite.intendedEmail &&
    invite.intendedEmail.toLowerCase() !== user.email.toLowerCase()
  ) {
    return {
      ok: false,
      error: `This invite was issued to ${invite.intendedEmail}. Sign in with that email to claim it.`,
      code: "EMAIL_MISMATCH",
    };
  }

  // Determine effective school role from rolesGranted. We narrow to MANAGER /
  // COACH / PLAYER; anything else falls back to PLAYER as a safe default so
  // we never grant unknown power.
  const requestedRole = invite.rolesGranted.find((r) => VALID_SCHOOL_ROLES.has(r)) ?? "PLAYER";
  const role = requestedRole as "MANAGER" | "COACH" | "PLAYER";
  const isOwner = invite.grantsOwnership;

  const schoolId = invite.schoolId;

  await prisma.$transaction(async (tx) => {
    await tx.schoolMembership.upsert({
      where: { schoolId_userId: { schoolId, userId: user.id } },
      update: { role, isOwner: isOwner || undefined, detached: false },
      create: {
        schoolId,
        userId: user.id,
        role,
        isOwner,
      },
    });

    const newUsed = invite.usedCount + 1;
    await tx.invite.update({
      where: { id: invite.id },
      data: {
        usedCount: newUsed,
        status: newUsed >= invite.maxUses ? "EXHAUSTED" : "ACTIVE",
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: user.id,
        action: "INVITE.ACCEPT_SCHOOL",
        entityType: "Invite",
        entityId: invite.id,
        before: { status: invite.status, usedCount: invite.usedCount },
        after: {
          status: newUsed >= invite.maxUses ? "EXHAUSTED" : "ACTIVE",
          usedCount: newUsed,
        },
        metadata: { role, isOwner, schoolId },
        schoolId,
      },
    });
  });

  revalidatePostClaim();
  return {
    ok: true,
    schoolId,
    schoolName: invite.school.name,
    role,
    isOwner,
  };
}

// --- createSchoolInvite ------------------------------------------------

const CreateSchoolInviteInput = z.object({
  schoolId: z.string().min(1),
  role: z.enum(["MANAGER", "COACH", "PLAYER"]),
  intendedEmail: z.string().email("Use a valid email.").optional(),
  maxUses: z.number().int().min(1).max(50).default(1),
  expiresDays: z.number().int().min(1).max(365).default(30),
  grantsOwnership: z.boolean().default(false),
});

export type CreateSchoolInviteInputType = z.infer<typeof CreateSchoolInviteInput>;

export type CreateSchoolInviteResult =
  | {
      ok: true;
      inviteId: string;
      code: string;
      url: string;
      role: "MANAGER" | "COACH" | "PLAYER";
      intendedEmail: string | null;
      expiresAt: Date;
    }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/**
 * School coach / manager mints a new invite. Role authority is hierarchical:
 *   - MANAGER can invite MANAGER / COACH / PLAYER (and pass ownership)
 *   - COACH   can invite COACH / PLAYER (no ownership pass-through)
 *   - PLAYER  cannot invite anyone (gated upstream by loadSchoolCoach)
 *
 * The intended email is optional — when set, only that user can claim,
 * which is what you want for targeted assistant/player invites. Leaving
 * it blank produces an open share link useful for bulk player onboarding
 * (paired with `maxUses > 1`).
 */
export async function createSchoolInvite(
  input: CreateSchoolInviteInputType,
): Promise<CreateSchoolInviteResult> {
  const parsed = CreateSchoolInviteInput.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path.join(".");
      if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }
  const data = parsed.data;

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const me = await loadSchoolCoach(user.id, data.schoolId);
  if (!me) {
    return {
      ok: false,
      error: "Only the school's coach or manager can issue invites.",
    };
  }

  // Role authority gate
  if (data.role === "MANAGER" && me.role !== "MANAGER") {
    return {
      ok: false,
      error: "Only school managers can invite other managers.",
    };
  }
  if (data.grantsOwnership && me.role !== "MANAGER") {
    return {
      ok: false,
      error: "Only school managers can pass ownership.",
    };
  }

  const code = generateInviteCode();
  const expiresAt = new Date(Date.now() + data.expiresDays * 24 * 60 * 60 * 1000);
  const normalizedEmail = data.intendedEmail
    ? data.intendedEmail.trim().toLowerCase()
    : null;

  const invite = await prisma.$transaction(async (tx) => {
    const created = await tx.invite.create({
      data: {
        code,
        scope: "SCHOOL",
        schoolId: data.schoolId,
        createdById: user.id,
        rolesGranted: [data.role],
        grantsOwnership: data.grantsOwnership,
        intendedEmail: normalizedEmail,
        maxUses: data.maxUses,
        expiresAt,
        status: "ACTIVE",
      },
      select: { id: true },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: user.id,
        action: "INVITE.CREATE_SCHOOL",
        entityType: "Invite",
        entityId: created.id,
        after: {
          schoolId: data.schoolId,
          role: data.role,
          intendedEmail: normalizedEmail,
          maxUses: data.maxUses,
          grantsOwnership: data.grantsOwnership,
        },
        schoolId: data.schoolId,
      },
    });

    return created;
  });

  revalidateSchoolInviteSurfaces(data.schoolId);

  // Email the recipient if we have a target address. Open links (no
  // intendedEmail) skip this — admin/coach is expected to share manually.
  if (normalizedEmail) {
    const school = await prisma.school.findUnique({
      where: { id: data.schoolId },
      select: { name: true },
    });
    if (school) {
      const claimUrl = emailUrl(`/claim/${code}`);
      await sendEmail({
        to: normalizedEmail,
        subject: `${user.fullName} invited you to ${school.name} on RIEL.GG`,
        react: SchoolInviteCreated({
          inviterName: user.fullName,
          schoolName: school.name,
          role: data.role,
          claimUrl,
          expiresAt,
          grantsOwnership: data.grantsOwnership,
        }),
        text: schoolInviteCreatedText({
          inviterName: user.fullName,
          schoolName: school.name,
          role: data.role.toLowerCase(),
          claimUrl,
        }),
        tags: [
          { name: "kind", value: "school_invite_created" },
          { name: "school_id", value: data.schoolId },
        ],
      });
    }
  }

  return {
    ok: true,
    inviteId: invite.id,
    code,
    url: `/claim/${code}`,
    role: data.role,
    intendedEmail: normalizedEmail,
    expiresAt,
  };
}

// --- revokeSchoolInvite ------------------------------------------------

const RevokeInviteInput = z.object({
  inviteId: z.string().min(1),
});

export type RevokeSchoolInviteResult =
  | { ok: true; inviteId: string }
  | { ok: false; error: string };

export async function revokeSchoolInvite(input: {
  inviteId: string;
}): Promise<RevokeSchoolInviteResult> {
  const parsed = RevokeInviteInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  const { inviteId } = parsed.data;

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const invite = await prisma.invite.findUnique({
    where: { id: inviteId },
    select: {
      id: true,
      scope: true,
      schoolId: true,
      status: true,
      rolesGranted: true,
    },
  });
  if (!invite) return { ok: false, error: "Invite not found." };
  if (invite.scope !== "SCHOOL" || !invite.schoolId) {
    return { ok: false, error: "This isn't a school invite." };
  }
  if (invite.status !== "ACTIVE") {
    return { ok: false, error: `Invite is already ${invite.status.toLowerCase()}.` };
  }

  const me = await loadSchoolCoach(user.id, invite.schoolId);
  if (!me) {
    return {
      ok: false,
      error: "Only the school's coach or manager can revoke invites.",
    };
  }
  // Don't let COACHes revoke MANAGER invites
  const targetIsManagerInvite = invite.rolesGranted.includes("MANAGER");
  if (targetIsManagerInvite && me.role !== "MANAGER") {
    return {
      ok: false,
      error: "Only school managers can revoke manager invites.",
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.invite.update({
      where: { id: inviteId },
      data: { status: "REVOKED" },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: user.id,
        action: "INVITE.REVOKE_SCHOOL",
        entityType: "Invite",
        entityId: inviteId,
        before: { status: invite.status },
        after: { status: "REVOKED" },
        schoolId: invite.schoolId,
      },
    });
  });

  revalidateSchoolInviteSurfaces(invite.schoolId);
  return { ok: true, inviteId };
}
