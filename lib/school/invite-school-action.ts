"use server";

/**
 * Admin-initiated school invite.
 *
 *   - `inviteSchoolToLeague(input)` — a league admin adds a school directly
 *     (without waiting for a /join application). Creates the School, an ACTIVE
 *     LeagueMembership, and a single-use SCHOOL invite locked to the contact's
 *     email (MANAGER role, grants ownership). The contact claims the school at
 *     /claim/[code], at which point they own it and can build rosters.
 *
 * Mirrors the school+invite half of approveSchoolApplication, but the inputs
 * come straight from the admin instead of a pending application row.
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
import { requireLeagueAdmin } from "@/lib/league-admin/dashboard";

const InviteSchoolInput = z.object({
  schoolName: z.string().trim().min(2, "School name is required.").max(160),
  schoolShort: z.string().trim().max(60).optional(),
  schoolCity: z.string().trim().max(120).optional(),
  schoolState: z.string().trim().max(40).optional(),
  contactName: z.string().trim().min(2, "Contact name is required.").max(120),
  contactEmail: z.string().trim().email("Use a valid email."),
});

export type InviteSchoolInputType = z.infer<typeof InviteSchoolInput>;

export type InviteSchoolResult =
  | {
      ok: true;
      schoolId: string;
      inviteCode: string;
      inviteUrl: string;
      schoolName: string;
      contactName: string;
      contactEmail: string;
    }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function inviteSchoolToLeague(
  input: InviteSchoolInputType,
): Promise<InviteSchoolResult> {
  const parsed = InviteSchoolInput.safeParse(input);
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

  const ctx = await requireLeagueAdmin(user.id);
  if (!ctx) return { ok: false, error: "Only league admins can invite schools." };

  const contactEmail = data.contactEmail.toLowerCase();

  // Guard against accidentally adding the same school twice to one league.
  const existing = await prisma.leagueMembership.findFirst({
    where: {
      leagueId: ctx.league.id,
      school: { name: { equals: data.schoolName, mode: "insensitive" } },
    },
    select: { schoolId: true },
  });
  if (existing) {
    return {
      ok: false,
      error: `${data.schoolName} is already in ${ctx.league.name}. Use the school's page to invite a coach instead.`,
      fieldErrors: { schoolName: "Already a member." },
    };
  }

  const inviteCode = generateInviteCode();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30d

  const result = await prisma.$transaction(async (tx) => {
    const school = await tx.school.create({
      data: {
        name: data.schoolName,
        shortName: data.schoolShort?.trim() || null,
        city: data.schoolCity?.trim() || null,
        state: data.schoolState?.trim() || null,
      },
      select: { id: true },
    });

    await tx.leagueMembership.create({
      data: {
        leagueId: ctx.league.id,
        schoolId: school.id,
        status: "ACTIVE",
      },
    });

    await tx.invite.create({
      data: {
        code: inviteCode,
        scope: "SCHOOL",
        schoolId: school.id,
        createdById: user.id,
        rolesGranted: ["MANAGER"],
        grantsOwnership: true,
        intendedEmail: contactEmail,
        maxUses: 1,
        expiresAt,
        status: "ACTIVE",
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: user.id,
        action: "SCHOOL.ADMIN_INVITE",
        entityType: "School",
        entityId: school.id,
        after: {
          schoolName: data.schoolName,
          contactEmail,
          contactName: data.contactName,
        },
        leagueId: ctx.league.id,
        schoolId: school.id,
      },
    });

    return { schoolId: school.id };
  });

  revalidatePath("/admin/schools");
  revalidatePath("/admin");

  // Fire-and-forget invite email (console fallback in dev).
  const claimUrl = emailUrl(`/claim/${inviteCode}`);
  await sendEmail({
    to: contactEmail,
    subject: `${user.fullName} invited ${data.schoolName} to ${ctx.league.name} on ArcLight`,
    react: SchoolInviteCreated({
      inviterName: user.fullName,
      schoolName: data.schoolName,
      role: "MANAGER",
      claimUrl,
      expiresAt,
      grantsOwnership: true,
    }),
    text: schoolInviteCreatedText({
      inviterName: user.fullName,
      schoolName: data.schoolName,
      role: "manager",
      claimUrl,
    }),
    tags: [
      { name: "kind", value: "school_admin_invite" },
      { name: "league_id", value: ctx.league.id },
    ],
  });

  return {
    ok: true,
    schoolId: result.schoolId,
    inviteCode,
    inviteUrl: `/claim/${inviteCode}`,
    schoolName: data.schoolName,
    contactName: data.contactName,
    contactEmail,
  };
}
