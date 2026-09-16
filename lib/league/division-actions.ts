"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  upsertLeagueDivisions,
  type DivisionOption,
} from "@/lib/classification/season-service";
import { getCurrentUser } from "@/lib/auth/current-user";
import { requireLeagueAdmin } from "@/lib/league-admin/dashboard";

const DivisionInput = z.object({
  id: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1, "Division name is required.").max(60),
  description: z.string().trim().max(160).optional(),
  active: z.boolean().optional(),
});

const UpdateLeagueDivisionsInput = z.object({
  divisions: z.array(DivisionInput).max(12, "A league can have up to 12 divisions."),
});

export type UpdateLeagueDivisionsInputType = z.infer<typeof UpdateLeagueDivisionsInput>;

export type UpdateLeagueDivisionsResult =
  | { ok: true; divisions: DivisionOption[] }
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

  try {
    const divisions = await upsertLeagueDivisions({
      leagueId: ctx.league.id,
      actorUserId: user.id,
      divisions: parsed.data.divisions,
    });

    revalidatePath("/admin/schools");
    revalidatePath("/admin");

    return { ok: true, divisions };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unable to save divisions.",
    };
  }
}
