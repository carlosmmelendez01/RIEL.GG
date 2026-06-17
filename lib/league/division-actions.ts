"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { requireLeagueAdmin } from "@/lib/league-admin/dashboard";
import {
  getLeagueDivisionOptions,
  type LeagueDivisionOption,
} from "@/lib/league/divisions";

const DivisionInput = z.object({
  value: z.string().trim().min(1).max(100).optional(),
  label: z.string().trim().min(1, "Division name is required.").max(60),
  description: z.string().trim().max(160).optional(),
});

const UpdateLeagueDivisionsInput = z.object({
  divisions: z.array(DivisionInput).max(12, "A league can have up to 12 divisions."),
});

export type UpdateLeagueDivisionsInputType = z.infer<typeof UpdateLeagueDivisionsInput>;

export type UpdateLeagueDivisionsResult =
  | { ok: true; divisions: LeagueDivisionOption[] }
  | { ok: false; error: string };

export async function updateLeagueDivisions(
  input: UpdateLeagueDivisionsInputType,
): Promise<UpdateLeagueDivisionsResult> {
  const parsed = UpdateLeagueDivisionsInput.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check the division list and try again.",
    };
  }

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const ctx = await requireLeagueAdmin(user.id);
  if (!ctx) return { ok: false, error: "Only league admins can manage divisions." };

  const labels = parsed.data.divisions.map((division) => division.label.toLowerCase());
  if (new Set(labels).size !== labels.length) {
    return { ok: false, error: "Division names must be unique." };
  }

  const currentOptions = getLeagueDivisionOptions(ctx.league);
  const currentByValue = new Map(currentOptions.map((option) => [option.value, option]));
  const submittedValues = parsed.data.divisions
    .map((division) => division.value)
    .filter((value): value is string => Boolean(value));
  if (new Set(submittedValues).size !== submittedValues.length) {
    return { ok: false, error: "The division list contains a duplicate entry." };
  }

  for (const division of parsed.data.divisions) {
    if (division.value && !currentByValue.has(division.value)) {
      return { ok: false, error: "The division list is out of date. Refresh and try again." };
    }
  }

  const divisions: LeagueDivisionOption[] = parsed.data.divisions.map((division) => ({
    value: division.value ?? `division_${randomUUID().replaceAll("-", "").slice(0, 16)}`,
    label: division.label,
    ...(division.description ? { description: division.description } : {}),
  }));

  const retainedValues = new Set(divisions.map((division) => division.value));
  const assignedRows = await prisma.leagueMembership.groupBy({
    by: ["division"],
    where: {
      leagueId: ctx.league.id,
      division: { not: null },
    },
    _count: { _all: true },
  });
  const removedAssigned = assignedRows.filter(
    (row) => row.division && !retainedValues.has(row.division),
  );
  if (removedAssigned.length > 0) {
    const details = removedAssigned
      .map((row) => {
        const label = currentByValue.get(row.division ?? "")?.label ?? row.division;
        return `${label} (${row._count._all} school${row._count._all === 1 ? "" : "s"})`;
      })
      .join(", ");
    return {
      ok: false,
      error: `Reassign schools before removing: ${details}.`,
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.league.update({
      where: { id: ctx.league.id },
      data: { schoolDivisions: divisions },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: user.id,
        action: "LEAGUE.DIVISIONS_UPDATE",
        entityType: "League",
        entityId: ctx.league.id,
        before: { schoolDivisions: currentOptions },
        after: { schoolDivisions: divisions },
        leagueId: ctx.league.id,
      },
    });
  });

  revalidatePath("/admin/schools");
  revalidatePath("/admin");

  return { ok: true, divisions };
}
