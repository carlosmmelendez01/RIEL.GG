"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { requireLeagueAdmin } from "@/lib/league-admin/dashboard";
import {
  RESOURCE_AUDIENCES,
  RESOURCE_CATEGORIES,
} from "@/lib/league/resources";

const nullableString = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : null))
  .nullable()
  .optional();

const ResourceInput = z.object({
  leagueId: z.string().min(1),
  title: z.string().trim().min(3, "Title must be at least 3 characters.").max(120),
  summary: nullableString,
  body: z.string().trim().min(10, "Add the actual rule or instruction text.").max(12000),
  url: nullableString.refine((value) => !value || /^https?:\/\//i.test(value), {
    message: "Use a full http(s) URL or leave it blank.",
  }),
  category: z.enum(RESOURCE_CATEGORIES),
  audience: z.enum(RESOURCE_AUDIENCES),
  gameTitleId: nullableString,
  seasonId: nullableString,
  competitionId: nullableString,
  pinned: z.boolean().default(false),
  published: z.boolean().default(true),
});

const UpdateResourceInput = ResourceInput.extend({
  resourceId: z.string().min(1),
});

export type ResourceActionResult =
  | { ok: true; resourceId?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

async function requireResourceAdmin(leagueId: string) {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const, error: "You need to be signed in." };

  const ctx = await requireLeagueAdmin(user.id);
  if (!ctx) {
    return { ok: false as const, error: "You do not have league admin access." };
  }
  if (ctx.league.id !== leagueId) {
    return { ok: false as const, error: "You can only manage resources for your active league." };
  }

  return { ok: true as const, user, ctx };
}

function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}

async function validateResourceScope(data: z.infer<typeof ResourceInput>) {
  const checks: Promise<boolean>[] = [];

  if (data.gameTitleId) {
    checks.push(
      prisma.gameTitle
        .count({ where: { id: data.gameTitleId } })
        .then((count) => count === 1),
    );
  }
  if (data.seasonId) {
    checks.push(
      prisma.season
        .count({ where: { id: data.seasonId, leagueId: data.leagueId } })
        .then((count) => count === 1),
    );
  }
  if (data.competitionId) {
    checks.push(
      prisma.competition
        .count({ where: { id: data.competitionId, season: { leagueId: data.leagueId } } })
        .then((count) => count === 1),
    );
  }

  const results = await Promise.all(checks);
  return results.every(Boolean);
}

function revalidateResourceSurfaces(slug: string) {
  revalidatePath("/admin/resources");
  revalidatePath("/dashboard/resources");
  revalidatePath(`/league/${slug}`);
  revalidatePath(`/league/${slug}/resources`);
}

export async function createLeagueResource(input: unknown): Promise<ResourceActionResult> {
  const parsed = ResourceInput.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }
  const data = parsed.data;

  const auth = await requireResourceAdmin(data.leagueId);
  if (!auth.ok) return auth;

  if (!(await validateResourceScope(data))) {
    return { ok: false, error: "One of the selected scope values does not belong to this league." };
  }

  const resource = await prisma.$transaction(async (tx) => {
    const created = await tx.leagueResource.create({
      data: {
        leagueId: data.leagueId,
        title: data.title,
        summary: data.summary ?? null,
        body: data.body,
        url: data.url ?? null,
        category: data.category,
        audience: data.audience,
        gameTitleId: data.gameTitleId ?? null,
        seasonId: data.seasonId ?? null,
        competitionId: data.competitionId ?? null,
        pinned: data.pinned,
        published: data.published,
        createdById: auth.user.id,
      },
      select: { id: true },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: auth.user.id,
        action: "LEAGUE_RESOURCE.CREATE",
        entityType: "LeagueResource",
        entityId: created.id,
        after: {
          title: data.title,
          category: data.category,
          audience: data.audience,
          published: data.published,
        },
        leagueId: data.leagueId,
      },
    });

    return created;
  });

  revalidateResourceSurfaces(auth.ctx.league.slug);
  return { ok: true, resourceId: resource.id };
}

export async function updateLeagueResource(input: unknown): Promise<ResourceActionResult> {
  const parsed = UpdateResourceInput.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }
  const { resourceId, ...data } = parsed.data;

  const auth = await requireResourceAdmin(data.leagueId);
  if (!auth.ok) return auth;

  const existing = await prisma.leagueResource.findUnique({
    where: { id: resourceId },
    select: {
      id: true,
      leagueId: true,
      title: true,
      category: true,
      audience: true,
      published: true,
      pinned: true,
    },
  });
  if (!existing || existing.leagueId !== data.leagueId) {
    return { ok: false, error: "Resource not found for this league." };
  }
  if (!(await validateResourceScope(data))) {
    return { ok: false, error: "One of the selected scope values does not belong to this league." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.leagueResource.update({
      where: { id: resourceId },
      data: {
        title: data.title,
        summary: data.summary ?? null,
        body: data.body,
        url: data.url ?? null,
        category: data.category,
        audience: data.audience,
        gameTitleId: data.gameTitleId ?? null,
        seasonId: data.seasonId ?? null,
        competitionId: data.competitionId ?? null,
        pinned: data.pinned,
        published: data.published,
        updatedById: auth.user.id,
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: auth.user.id,
        action: "LEAGUE_RESOURCE.UPDATE",
        entityType: "LeagueResource",
        entityId: resourceId,
        before: existing,
        after: {
          title: data.title,
          category: data.category,
          audience: data.audience,
          published: data.published,
          pinned: data.pinned,
        },
        leagueId: data.leagueId,
      },
    });
  });

  revalidateResourceSurfaces(auth.ctx.league.slug);
  return { ok: true, resourceId };
}

export async function deleteLeagueResource(input: {
  leagueId: string;
  resourceId: string;
}): Promise<ResourceActionResult> {
  const parsed = z
    .object({ leagueId: z.string().min(1), resourceId: z.string().min(1) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid resource id." };
  const { leagueId, resourceId } = parsed.data;

  const auth = await requireResourceAdmin(leagueId);
  if (!auth.ok) return auth;

  const existing = await prisma.leagueResource.findUnique({
    where: { id: resourceId },
    select: { id: true, leagueId: true, title: true, category: true, audience: true },
  });
  if (!existing || existing.leagueId !== leagueId) {
    return { ok: false, error: "Resource not found for this league." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.leagueResource.delete({ where: { id: resourceId } });
    await tx.auditLog.create({
      data: {
        actorUserId: auth.user.id,
        action: "LEAGUE_RESOURCE.DELETE",
        entityType: "LeagueResource",
        entityId: resourceId,
        before: existing,
        leagueId,
      },
    });
  });

  revalidateResourceSurfaces(auth.ctx.league.slug);
  return { ok: true };
}
