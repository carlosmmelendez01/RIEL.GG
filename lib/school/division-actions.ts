"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { requireLeagueAdmin } from "@/lib/league-admin/dashboard";
import { overrideSeasonSchoolClassification } from "@/lib/classification/season-service";

const OverrideClassificationInput = z.object({
  seasonId: z.string().min(1),
  schoolId: z.string().min(1),
  divisionId: z.string().min(1).nullable(),
  reason: z.string().trim().min(5, "Add a reason.").max(500),
});

export type OverrideClassificationInputType = z.infer<typeof OverrideClassificationInput>;

export type OverrideClassificationResult =
  | {
      ok: true;
      schoolId: string;
      divisionId: string | null;
      divisionName: string | null;
      explanation: string;
      reviewNeeded: boolean;
    }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function overrideSchoolClassification(
  input: OverrideClassificationInputType,
): Promise<OverrideClassificationResult> {
  const parsed = OverrideClassificationInput.safeParse(input);
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
  if (!ctx) return { ok: false, error: "Only league admins can override classifications." };

  const season = await prisma.season.findFirst({
    where: {
      id: parsed.data.seasonId,
      leagueId: ctx.league.id,
    },
    select: { id: true },
  });
  if (!season) return { ok: false, error: "Season not found in this league." };

  try {
    const row = await overrideSeasonSchoolClassification({
      seasonId: parsed.data.seasonId,
      schoolId: parsed.data.schoolId,
      divisionId: parsed.data.divisionId,
      reason: parsed.data.reason,
      actorUserId: user.id,
    });

    revalidatePath("/admin/schools");
    revalidatePath("/admin");

    return {
      ok: true,
      schoolId: row.schoolId,
      divisionId: row.effectiveDivisionId,
      divisionName: row.effectiveDivision?.name ?? null,
      explanation: row.explanation,
      reviewNeeded: row.reviewNeeded,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unable to override classification.",
    };
  }
}
