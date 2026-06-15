"use server";

/**
 * League provisioning server action.
 *
 *   - `createLeague(input)` — a platform admin provisions a new league. Creates
 *     the `League` row, then wires up its owner:
 *       · If the owner email already has a `User`, attach a `LeagueAdminship`
 *         (OWNER) immediately — they can hit /admin right away.
 *       · Otherwise mint a LEAGUE-scoped `Invite` locked to that email and (when
 *         email is configured) send them a claim link. They become OWNER when
 *         they accept at /claim/[code].
 *
 * Gated to platform admins (isPlatformAdmin). This backs the /platform/leagues/new
 * wizard's "Provision league" button.
 *
 * Note: the wizard also collects branding (secondary color), a games shortlist,
 * and a trial flag. The schema has no league↔game join (games are global) and no
 * secondary-color/trial columns, so those stay presentational for now — primary
 * color, name, slug, classification, and the owner are what we persist.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/current-user";
import { isPlatformAdmin } from "@/lib/auth/platform";
import { prisma } from "@/lib/db/prisma";
import { emailUrl, sendEmail } from "@/lib/email/send";
import {
  LeagueOwnerInvite,
  leagueOwnerInviteText,
} from "@/lib/email/templates/league-owner-invite";
import { generateInviteCode } from "@/lib/invite/helpers";

const CreateLeagueInput = z.object({
  name: z.string().trim().min(2, "Give the league a name.").max(120),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/, "Slug can use lowercase letters, numbers, and dashes only."),
  classification: z.enum(["SCHOLASTIC", "COLLEGIATE", "AMATEUR"]).default("SCHOLASTIC"),
  primaryColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color like #A31F34.")
    .optional(),
  description: z.string().trim().max(280).optional(),
  ownerName: z.string().trim().min(2, "Add the owner's name.").max(120),
  ownerEmail: z.string().trim().email("Use a valid owner email."),
});

export type CreateLeagueInputType = z.infer<typeof CreateLeagueInput>;

export type CreateLeagueResult =
  | {
      ok: true;
      leagueId: string;
      slug: string;
      /** True when the owner already had an account and is now an OWNER admin. */
      ownerAttached: boolean;
      /** Set when we minted an invite instead (owner had no account yet). */
      inviteUrl: string | null;
      inviteCode: string | null;
      ownerEmail: string;
    }
  | {
      ok: false;
      error: string;
      fieldErrors?: Record<string, string>;
      code?: "SLUG_TAKEN" | "FORBIDDEN";
    };

export async function createLeague(
  input: CreateLeagueInputType,
): Promise<CreateLeagueResult> {
  const parsed = CreateLeagueInput.safeParse(input);
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
  if (!user) return { ok: false, error: "You need to be signed in.", code: "FORBIDDEN" };
  if (!(await isPlatformAdmin())) {
    return {
      ok: false,
      error: "Only platform admins can provision leagues.",
      code: "FORBIDDEN",
    };
  }

  const slug = data.slug.toLowerCase();
  const ownerEmail = data.ownerEmail.toLowerCase();

  const existingSlug = await prisma.league.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (existingSlug) {
    return {
      ok: false,
      error: `The slug "${slug}" is already taken. Pick another.`,
      fieldErrors: { slug: "Already in use." },
      code: "SLUG_TAKEN",
    };
  }

  // Does the intended owner already have an account?
  const ownerUser = await prisma.user.findUnique({
    where: { email: ownerEmail },
    select: { id: true },
  });

  const code = ownerUser ? null : generateInviteCode();
  const expiresAt = ownerUser
    ? null
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const result = await prisma.$transaction(async (tx) => {
    const league = await tx.league.create({
      data: {
        name: data.name,
        slug,
        classification: data.classification,
        primaryColor: data.primaryColor ?? null,
        description: data.description ?? null,
      },
      select: { id: true, name: true, slug: true },
    });

    if (ownerUser) {
      await tx.leagueAdminship.upsert({
        where: { leagueId_userId: { leagueId: league.id, userId: ownerUser.id } },
        update: { role: "OWNER" },
        create: { leagueId: league.id, userId: ownerUser.id, role: "OWNER" },
      });
    } else {
      await tx.invite.create({
        data: {
          code: code!,
          scope: "LEAGUE",
          leagueId: league.id,
          createdById: user.id,
          rolesGranted: ["OWNER"],
          grantsOwnership: true,
          intendedEmail: ownerEmail,
          maxUses: 1,
          expiresAt: expiresAt!,
          status: "ACTIVE",
        },
      });
    }

    await tx.auditLog.create({
      data: {
        actorUserId: user.id,
        action: "LEAGUE.PROVISION",
        entityType: "League",
        entityId: league.id,
        after: {
          name: league.name,
          slug: league.slug,
          classification: data.classification,
          ownerEmail,
          ownerAttached: !!ownerUser,
        },
        metadata: { ownerName: data.ownerName },
        leagueId: league.id,
      },
    });

    return league;
  });

  // Fire-and-forget owner email when we issued an invite.
  if (!ownerUser && code) {
    const claimUrl = emailUrl(`/claim/${code}`);
    await sendEmail({
      to: ownerEmail,
      subject: `You're the owner of ${result.name} on RIEL.GG`,
      react: LeagueOwnerInvite({
        provisionedByName: user.fullName,
        leagueName: result.name,
        claimUrl,
        expiresAt: expiresAt!,
      }),
      text: leagueOwnerInviteText({
        provisionedByName: user.fullName,
        leagueName: result.name,
        claimUrl,
      }),
      tags: [
        { name: "kind", value: "league_owner_invite" },
        { name: "league_id", value: result.id },
      ],
    });
  }

  revalidatePath("/platform/leagues");
  revalidatePath("/platform");
  revalidatePath("/admin");

  return {
    ok: true,
    leagueId: result.id,
    slug: result.slug,
    ownerAttached: !!ownerUser,
    inviteUrl: code ? `/claim/${code}` : null,
    inviteCode: code,
    ownerEmail,
  };
}
