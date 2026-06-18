"use server";

/**
 * League staff management — a league owner/admin invites additional owners,
 * admins, or staff, revokes pending invites, or removes an existing admin.
 *
 * Authority (mirrors school invites, scaled to league roles):
 *   - OWNER can invite/manage OWNER, ADMIN, STAFF
 *   - ADMIN can invite/manage ADMIN, STAFF (never OWNER)
 *   - STAFF can do neither
 *
 * Invited people claim at /claim/[code] → acceptLeagueInvite upserts their
 * LeagueAdminship. League invites always lock to an email (no open links — an
 * open admin link would be a privilege-escalation footgun).
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { emailUrl, sendEmail } from "@/lib/email/send";
import {
  LeagueAdminInvite,
  leagueAdminInviteText,
} from "@/lib/email/templates/league-owner-invite";
import { generateInviteCode } from "@/lib/invite/helpers";
import { requireLeagueAdmin } from "@/lib/league-admin/dashboard";

type LeagueRole = "OWNER" | "ADMIN" | "STAFF";

const ROLE_LABEL: Record<LeagueRole, string> = {
  OWNER: "Owner",
  ADMIN: "League Admin",
  STAFF: "Staff",
};

/** Which roles a given viewer role is allowed to grant/manage. */
function grantableRoles(viewerRole: LeagueRole): LeagueRole[] {
  if (viewerRole === "OWNER") return ["OWNER", "ADMIN", "STAFF"];
  if (viewerRole === "ADMIN") return ["ADMIN", "STAFF"];
  return [];
}

function revalidateAdminSurfaces() {
  revalidatePath("/admin/admins");
  revalidatePath("/admin");
}

// --- createLeagueInvite ------------------------------------------------

const CreateLeagueInviteInput = z.object({
  role: z.enum(["OWNER", "ADMIN", "STAFF"]),
  intendedEmail: z.string().email("Use a valid email."),
  inviteeName: z.string().trim().max(120).optional(),
  expiresDays: z.number().int().min(1).max(365).default(30),
});

export type CreateLeagueInviteInputType = z.infer<typeof CreateLeagueInviteInput>;

export type CreateLeagueInviteResult =
  | {
      ok: true;
      inviteId: string;
      code: string;
      url: string;
      role: LeagueRole;
      intendedEmail: string;
      expiresAt: Date;
    }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function createLeagueInvite(
  input: CreateLeagueInviteInputType,
): Promise<CreateLeagueInviteResult> {
  const parsed = CreateLeagueInviteInput.safeParse(input);
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
  if (!ctx) return { ok: false, error: "Only league admins can invite staff." };

  if (!grantableRoles(ctx.admin.role).includes(data.role)) {
    return {
      ok: false,
      error:
        ctx.admin.role === "STAFF"
          ? "Staff can't invite other admins. Ask an owner or admin."
          : `As ${ROLE_LABEL[ctx.admin.role]} you can't grant the ${ROLE_LABEL[data.role]} role.`,
    };
  }

  const intendedEmail = data.intendedEmail.trim().toLowerCase();

  // Already an admin of this league?
  const existingAdmin = await prisma.leagueAdminship.findFirst({
    where: { leagueId: ctx.league.id, user: { email: intendedEmail } },
    select: { id: true },
  });
  if (existingAdmin) {
    return {
      ok: false,
      error: `${intendedEmail} already helps run ${ctx.league.name}.`,
      fieldErrors: { intendedEmail: "Already an admin." },
    };
  }

  const code = generateInviteCode();
  const expiresAt = new Date(Date.now() + data.expiresDays * 24 * 60 * 60 * 1000);

  const invite = await prisma.$transaction(async (tx) => {
    const created = await tx.invite.create({
      data: {
        code,
        scope: "LEAGUE",
        leagueId: ctx.league.id,
        createdById: user.id,
        rolesGranted: [data.role],
        grantsOwnership: data.role === "OWNER",
        intendedEmail,
        maxUses: 1,
        expiresAt,
        status: "ACTIVE",
      },
      select: { id: true },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: user.id,
        action: "LEAGUE_ADMIN.INVITE",
        entityType: "Invite",
        entityId: created.id,
        after: { role: data.role, intendedEmail },
        metadata: data.inviteeName ? { inviteeName: data.inviteeName } : undefined,
        leagueId: ctx.league.id,
      },
    });

    return created;
  });

  revalidateAdminSurfaces();

  const claimUrl = emailUrl(`/claim/${code}`);
  await sendEmail({
    to: intendedEmail,
    subject: `${user.fullName} invited you to help run ${ctx.league.name} on ArcLight`,
    react: LeagueAdminInvite({
      invitedByName: user.fullName,
      leagueName: ctx.league.name,
      roleLabel: ROLE_LABEL[data.role],
      claimUrl,
      expiresAt,
    }),
    text: leagueAdminInviteText({
      invitedByName: user.fullName,
      leagueName: ctx.league.name,
      roleLabel: ROLE_LABEL[data.role],
      claimUrl,
    }),
    tags: [
      { name: "kind", value: "league_admin_invite" },
      { name: "league_id", value: ctx.league.id },
    ],
  });

  return {
    ok: true,
    inviteId: invite.id,
    code,
    url: `/claim/${code}`,
    role: data.role,
    intendedEmail,
    expiresAt,
  };
}

// --- revokeLeagueInvite ------------------------------------------------

export type RevokeLeagueInviteResult =
  | { ok: true; inviteId: string }
  | { ok: false; error: string };

export async function revokeLeagueInvite(input: {
  inviteId: string;
}): Promise<RevokeLeagueInviteResult> {
  const inviteId = String(input?.inviteId ?? "");
  if (!inviteId) return { ok: false, error: "Invalid input." };

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const ctx = await requireLeagueAdmin(user.id);
  if (!ctx) return { ok: false, error: "Only league admins can revoke invites." };

  const invite = await prisma.invite.findUnique({
    where: { id: inviteId },
    select: { id: true, scope: true, leagueId: true, status: true, rolesGranted: true, grantsOwnership: true },
  });
  if (!invite || invite.scope !== "LEAGUE" || invite.leagueId !== ctx.league.id) {
    return { ok: false, error: "Invite not found in your league." };
  }
  if (invite.status !== "ACTIVE") {
    return { ok: false, error: `Invite is already ${invite.status.toLowerCase()}.` };
  }
  const targetIsOwner = invite.grantsOwnership || invite.rolesGranted.includes("OWNER");
  if (targetIsOwner && ctx.admin.role !== "OWNER") {
    return { ok: false, error: "Only an owner can revoke an owner invite." };
  }
  if (ctx.admin.role === "STAFF") {
    return { ok: false, error: "Staff can't revoke invites." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.invite.update({ where: { id: inviteId }, data: { status: "REVOKED" } });
    await tx.auditLog.create({
      data: {
        actorUserId: user.id,
        action: "LEAGUE_ADMIN.REVOKE_INVITE",
        entityType: "Invite",
        entityId: inviteId,
        before: { status: "ACTIVE" },
        after: { status: "REVOKED" },
        leagueId: ctx.league.id,
      },
    });
  });

  revalidateAdminSurfaces();
  return { ok: true, inviteId };
}

// --- removeLeagueAdmin -------------------------------------------------

export type RemoveLeagueAdminResult =
  | { ok: true; userId: string }
  | { ok: false; error: string };

export async function removeLeagueAdmin(input: {
  userId: string;
}): Promise<RemoveLeagueAdminResult> {
  const targetUserId = String(input?.userId ?? "");
  if (!targetUserId) return { ok: false, error: "Invalid input." };

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const ctx = await requireLeagueAdmin(user.id);
  if (!ctx) return { ok: false, error: "Only league admins can manage staff." };
  if (ctx.admin.role !== "OWNER") {
    return { ok: false, error: "Only an owner can remove admins." };
  }
  if (targetUserId === user.id) {
    return { ok: false, error: "You can't remove yourself. Ask another owner." };
  }

  const target = await prisma.leagueAdminship.findUnique({
    where: { leagueId_userId: { leagueId: ctx.league.id, userId: targetUserId } },
    select: { id: true, role: true },
  });
  if (!target) return { ok: false, error: "That person isn't an admin of your league." };

  if (target.role === "OWNER") {
    const ownerCount = await prisma.leagueAdminship.count({
      where: { leagueId: ctx.league.id, role: "OWNER" },
    });
    if (ownerCount <= 1) {
      return { ok: false, error: "You can't remove the last owner of the league." };
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.leagueAdminship.delete({ where: { id: target.id } });
    await tx.auditLog.create({
      data: {
        actorUserId: user.id,
        action: "LEAGUE_ADMIN.REMOVE",
        entityType: "LeagueAdminship",
        entityId: target.id,
        before: { role: target.role },
        metadata: { removedUserId: targetUserId },
        leagueId: ctx.league.id,
      },
    });
  });

  revalidateAdminSurfaces();
  return { ok: true, userId: targetUserId };
}
