"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { requireLeagueAdmin } from "@/lib/league-admin/dashboard";
import {
  findLeagueDivisionOption,
  getLeagueDivisionOptions,
} from "@/lib/league/divisions";

const UpdateSchoolDivisionInput = z.object({
  schoolId: z.string().min(1),
  division: z.string().trim().min(1, "Choose a division.").max(80),
});

export type UpdateSchoolDivisionInputType = z.infer<typeof UpdateSchoolDivisionInput>;

export type UpdateSchoolDivisionResult =
  | {
      ok: true;
      schoolId: string;
      division: string;
      divisionLabel: string;
    }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function updateSchoolDivision(
  input: UpdateSchoolDivisionInputType,
): Promise<UpdateSchoolDivisionResult> {
  const parsed = UpdateSchoolDivisionInput.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path.join(".");
      if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const ctx = await requireLeagueAdmin(user.id);
  if (!ctx) return { ok: false, error: "Only league admins can update school divisions." };

  const divisionOptions = getLeagueDivisionOptions(ctx.league);
  if (divisionOptions.length === 0) {
    return { ok: false, error: "This league does not have configured school divisions." };
  }

  const division = parsed.data.division.trim();
  const divisionOption = findLeagueDivisionOption(divisionOptions, division);
  if (!divisionOption) {
    return {
      ok: false,
      error: "Choose a valid division for this league.",
      fieldErrors: { division: "Choose a valid division." },
    };
  }

  const membership = await prisma.leagueMembership.findUnique({
    where: {
      leagueId_schoolId: {
        leagueId: ctx.league.id,
        schoolId: parsed.data.schoolId,
      },
    },
    select: {
      id: true,
      division: true,
      school: { select: { id: true, name: true } },
    },
  });
  if (!membership) {
    return { ok: false, error: "School not found in this league." };
  }

  if (membership.division === divisionOption.value) {
    return {
      ok: true,
      schoolId: membership.school.id,
      division: divisionOption.value,
      divisionLabel: divisionOption.label,
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.leagueMembership.update({
      where: { id: membership.id },
      data: { division: divisionOption.value },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: user.id,
        action: "SCHOOL.DIVISION_UPDATE",
        entityType: "LeagueMembership",
        entityId: membership.id,
        before: {
          schoolId: membership.school.id,
          schoolName: membership.school.name,
          division: membership.division,
        },
        after: {
          schoolId: membership.school.id,
          schoolName: membership.school.name,
          division: divisionOption.value,
        },
        leagueId: ctx.league.id,
        schoolId: membership.school.id,
      },
    });
  });

  revalidatePath("/admin/schools");
  revalidatePath("/admin");

  return {
    ok: true,
    schoolId: membership.school.id,
    division: divisionOption.value,
    divisionLabel: divisionOption.label,
  };
}
