"use server";

/**
 * School application server actions.
 *
 *   - `applyToLeague`            — public; called by /join
 *   - `approveSchoolApplication` — league admin; creates School (if needed)
 *                                  + LeagueMembership + SchoolMembership for
 *                                  the applicant as owner
 *   - `rejectSchoolApplication`  — league admin; flips status with a reason
 *
 * Approval is the load-bearing path: it has to be idempotent against partial
 * state (school exists, membership exists), so we look each step up before
 * we create it. Both review actions run in a transaction with an AuditLog
 * entry and revalidate the admin schools page.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { emailUrl, sendEmail } from "@/lib/email/send";
import {
  SchoolApplicationApproved,
  schoolApplicationApprovedText,
} from "@/lib/email/templates/school-application-approved";
import { generateInviteCode } from "@/lib/invite/helpers";
import { requireLeagueAdmin } from "@/lib/league-admin/dashboard";

// --- Shared helpers ----------------------------------------------------

function revalidateApplicationSurfaces() {
  revalidatePath("/admin/schools");
  revalidatePath("/admin");
  revalidatePath("/admin/board");
  revalidatePath("/join");
}

// --- 1. applyToLeague --------------------------------------------------

const ApplyInput = z.object({
  leagueSlug: z.string().min(1, "Pick a league."),
  schoolName: z.string().min(2, "School name is required."),
  schoolShort: z.string().max(60).optional(),
  schoolCity: z.string().max(120).optional(),
  schoolState: z.string().max(40).optional(),
  schoolCode: z.string().max(8).optional(),
  ncesId: z.string().max(40).optional(),
  coachName: z.string().min(2, "Your name is required."),
  coachEmail: z.string().email("Use a valid email."),
  coachRole: z.string().min(2).max(60),
  reason: z.string().max(2000).optional(),
});

export type ApplyToLeagueInput = z.infer<typeof ApplyInput>;

export type ApplyToLeagueResult =
  | { ok: true; applicationId: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/**
 * Public — anyone can submit. We deliberately don't require an authed user
 * because the applicant typically doesn't have an account yet; the email
 * we capture becomes the invite target on approval.
 */
export async function applyToLeague(input: ApplyToLeagueInput): Promise<ApplyToLeagueResult> {
  const parsed = ApplyInput.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path.join(".");
      if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }
  const data = parsed.data;

  const league = await prisma.league.findUnique({
    where: { slug: data.leagueSlug },
    select: { id: true, name: true },
  });
  if (!league) {
    return { ok: false, error: "We couldn't find that league — pick another from the list." };
  }

  // If the applicant picked an NCES id we already track, link it to the
  // existing School row so duplicate submissions cluster.
  const existingSchool = data.ncesId
    ? await prisma.school.findUnique({ where: { ncesId: data.ncesId }, select: { id: true } })
    : null;

  // De-dupe: same league + same school + still pending → reuse instead of
  // letting two applications race. Match on ncesId when we have it,
  // otherwise on (leagueId, coachEmail) as a softer match.
  const dupe = await prisma.schoolApplication.findFirst({
    where: {
      leagueId: league.id,
      status: "PENDING",
      OR: existingSchool
        ? [{ schoolId: existingSchool.id }, { coachEmail: data.coachEmail }]
        : [{ ncesId: data.ncesId ?? undefined }, { coachEmail: data.coachEmail }],
    },
    select: { id: true },
  });
  if (dupe) {
    return {
      ok: false,
      error: "An application from this school / email is already in the queue. Check your inbox for the league's reply.",
    };
  }

  const created = await prisma.$transaction(async (tx) => {
    const app = await tx.schoolApplication.create({
      data: {
        leagueId: league.id,
        schoolId: existingSchool?.id ?? null,
        schoolName: data.schoolName,
        schoolShort: data.schoolShort?.trim() || null,
        schoolCity: data.schoolCity?.trim() || null,
        schoolState: data.schoolState?.trim() || null,
        schoolCode: data.schoolCode?.trim() || null,
        ncesId: data.ncesId?.trim() || null,
        coachName: data.coachName.trim(),
        coachEmail: data.coachEmail.trim().toLowerCase(),
        coachRole: data.coachRole.trim(),
        reason: data.reason?.trim() || null,
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: null, // public submission — no signed-in actor
        action: "SCHOOL_APPLICATION.SUBMIT",
        entityType: "SchoolApplication",
        entityId: app.id,
        after: {
          leagueId: league.id,
          schoolName: data.schoolName,
          ncesId: data.ncesId ?? null,
          coachEmail: data.coachEmail.trim().toLowerCase(),
        },
        leagueId: league.id,
        schoolId: existingSchool?.id ?? null,
      },
    });

    return app;
  });

  revalidateApplicationSurfaces();
  return { ok: true, applicationId: created.id };
}

// --- 2. approveSchoolApplication ---------------------------------------

const ApproveInput = z.object({
  applicationId: z.string().min(1),
  notes: z.string().max(500).optional(),
});

export type ApproveApplicationResult =
  | {
      ok: true;
      applicationId: string;
      schoolId: string;
      membershipId: string;
      /** Random claim code embedded in the invite URL. Always returned. */
      inviteCode: string;
      /** Absolute path the admin can share — `/claim/{code}`. */
      inviteUrl: string;
    }
  | { ok: false; error: string };

export async function approveSchoolApplication(
  input: z.infer<typeof ApproveInput>,
): Promise<ApproveApplicationResult> {
  const parsed = ApproveInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  const { applicationId, notes } = parsed.data;

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const ctx = await requireLeagueAdmin(user.id);
  if (!ctx) return { ok: false, error: "Only league admins can review applications." };

  const app = await prisma.schoolApplication.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      leagueId: true,
      status: true,
      schoolId: true,
      schoolName: true,
      schoolShort: true,
      schoolCity: true,
      schoolState: true,
      schoolCode: true,
      ncesId: true,
      coachEmail: true,
      coachName: true,
    },
  });
  if (!app) return { ok: false, error: "Application not found." };
  if (app.leagueId !== ctx.league.id) {
    return { ok: false, error: "This application isn't in your league." };
  }
  if (app.status !== "PENDING") {
    return { ok: false, error: `Application is already ${app.status.toLowerCase()}.` };
  }

  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    // 1) School: prefer the linked one, then by NCES id, otherwise create.
    let schoolId = app.schoolId;
    if (!schoolId && app.ncesId) {
      const byNces = await tx.school.findUnique({
        where: { ncesId: app.ncesId },
        select: { id: true },
      });
      if (byNces) schoolId = byNces.id;
    }
    if (!schoolId) {
      const created = await tx.school.create({
        data: {
          name: app.schoolName,
          shortName: app.schoolShort,
          code: app.schoolCode,
          city: app.schoolCity,
          state: app.schoolState ?? null,
          ncesId: app.ncesId,
        },
        select: { id: true },
      });
      schoolId = created.id;
    }

    // 2) LeagueMembership — idempotent against the unique (leagueId, schoolId)
    const membership = await tx.leagueMembership.upsert({
      where: {
        leagueId_schoolId: { leagueId: ctx.league.id, schoolId },
      },
      update: { status: "ACTIVE" },
      create: { leagueId: ctx.league.id, schoolId, status: "ACTIVE" },
      select: { id: true },
    });

    // 3) Issue a single-use Invite for the coach to claim ownership. We do
    //    NOT attach a SchoolMembership directly even if a matching User
    //    already exists — the coach has to actively accept (so accidental
    //    approvals don't silently re-link to a stale account). The invite's
    //    `intendedEmail` locks claiming to whoever the application named.
    const inviteCode = generateInviteCode();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30d
    await tx.invite.create({
      data: {
        code: inviteCode,
        scope: "SCHOOL",
        schoolId,
        createdById: user.id,
        rolesGranted: ["MANAGER"],
        grantsOwnership: true,
        intendedEmail: app.coachEmail,
        maxUses: 1,
        expiresAt,
        status: "ACTIVE",
      },
    });

    // 4) Stamp the application
    await tx.schoolApplication.update({
      where: { id: app.id },
      data: {
        status: "APPROVED",
        reviewedById: user.id,
        reviewedAt: now,
        reviewerNotes: notes?.trim() || null,
        schoolId,
        resultMembershipId: membership.id,
      },
    });

    // 5) Audit
    await tx.auditLog.create({
      data: {
        actorUserId: user.id,
        action: "SCHOOL_APPLICATION.APPROVE",
        entityType: "SchoolApplication",
        entityId: app.id,
        before: { status: "PENDING" },
        after: {
          status: "APPROVED",
          schoolId,
          leagueMembershipId: membership.id,
          inviteCode,
        },
        metadata: notes?.trim() ? { notes: notes.trim() } : undefined,
        leagueId: ctx.league.id,
        schoolId,
      },
    });

    return { schoolId, membershipId: membership.id, inviteCode };
  });

  revalidateApplicationSurfaces();

  // Fire the approval email last — purely informational, never blocks the
  // result. `sendEmail` is non-throwing; even a Resend outage just logs.
  const claimUrl = emailUrl(`/claim/${result.inviteCode}`);
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  await sendEmail({
    to: app.coachEmail,
    subject: `${app.schoolName} is approved for ${ctx.league.name} — claim your account`,
    react: SchoolApplicationApproved({
      coachName: app.coachName,
      schoolName: app.schoolName,
      leagueName: ctx.league.name,
      claimUrl,
      expiresAt,
    }),
    text: schoolApplicationApprovedText({
      coachName: app.coachName,
      schoolName: app.schoolName,
      leagueName: ctx.league.name,
      claimUrl,
    }),
    tags: [
      { name: "kind", value: "school_application_approved" },
      { name: "league_id", value: ctx.league.id },
    ],
  });

  return {
    ok: true,
    applicationId: app.id,
    schoolId: result.schoolId,
    membershipId: result.membershipId,
    inviteCode: result.inviteCode,
    inviteUrl: `/claim/${result.inviteCode}`,
  };
}


// --- 3. rejectSchoolApplication ----------------------------------------

const RejectInput = z.object({
  applicationId: z.string().min(1),
  reason: z.string().min(5, "Required: 5+ chars so the coach gets context.").max(500),
});

export type RejectApplicationResult =
  | { ok: true; applicationId: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function rejectSchoolApplication(
  input: z.infer<typeof RejectInput>,
): Promise<RejectApplicationResult> {
  const parsed = RejectInput.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path.join(".");
      if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    return { ok: false, error: "Please add a reason.", fieldErrors };
  }
  const { applicationId, reason } = parsed.data;

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const ctx = await requireLeagueAdmin(user.id);
  if (!ctx) return { ok: false, error: "Only league admins can review applications." };

  const app = await prisma.schoolApplication.findUnique({
    where: { id: applicationId },
    select: { id: true, leagueId: true, status: true, schoolId: true },
  });
  if (!app) return { ok: false, error: "Application not found." };
  if (app.leagueId !== ctx.league.id) {
    return { ok: false, error: "This application isn't in your league." };
  }
  if (app.status !== "PENDING") {
    return { ok: false, error: `Application is already ${app.status.toLowerCase()}.` };
  }

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.schoolApplication.update({
      where: { id: app.id },
      data: {
        status: "REJECTED",
        reviewedById: user.id,
        reviewedAt: now,
        reviewerNotes: reason.trim(),
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: user.id,
        action: "SCHOOL_APPLICATION.REJECT",
        entityType: "SchoolApplication",
        entityId: app.id,
        before: { status: "PENDING" },
        after: { status: "REJECTED" },
        metadata: { reason: reason.trim() },
        leagueId: ctx.league.id,
        schoolId: app.schoolId ?? undefined,
      },
    });
  });

  revalidateApplicationSurfaces();
  return { ok: true, applicationId: app.id };
}
