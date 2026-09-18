"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  classifySeasonMemberSchools,
  previewLeagueDivisionRules as previewLeagueDivisionRulesForSeason,
  replaceLeagueDivisionRules,
  upsertLeagueDivisions,
  type DivisionRuleOption,
  type DivisionRulePreview,
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

const DivisionRuleInput = z.object({
  id: z.string().trim().min(1).optional(),
  divisionId: z.string().trim().min(1).nullable(),
  schoolLevel: z.enum(["ELEMENTARY", "MIDDLE", "HIGH", "OTHER"]),
  minimumEnrollment: z.number().int().nonnegative().nullable(),
  maximumEnrollment: z.number().int().nonnegative().nullable(),
});

const DivisionRulesInput = z.object({
  seasonId: z.string().trim().min(1),
  rules: z
    .array(DivisionRuleInput)
    .min(1, "Add at least one division rule.")
    .max(40, "A league can have up to 40 active division rules."),
});

export type UpdateLeagueDivisionsInputType = z.infer<typeof UpdateLeagueDivisionsInput>;

export type UpdateLeagueDivisionsResult =
  | { ok: true; divisions: DivisionOption[] }
  | { ok: false; error: string };

export type DivisionRulesInputType = z.infer<typeof DivisionRulesInput>;

export type PreviewDivisionRulesResult =
  | { ok: true; preview: DivisionRulePreview }
  | { ok: false; error: string };

export type UpdateDivisionRulesResult =
  | {
      ok: true;
      rules: DivisionRuleOption[];
      classified: number;
      warning?: string;
    }
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

export async function previewLeagueDivisionRules(
  input: DivisionRulesInputType,
): Promise<PreviewDivisionRulesResult> {
  const parsed = DivisionRulesInput.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check the rule list and try again.",
    };
  }

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const ctx = await requireLeagueAdmin(user.id);
  if (!ctx) return { ok: false, error: "Only league admins can preview division rules." };

  try {
    const preview = await previewLeagueDivisionRulesForSeason({
      leagueId: ctx.league.id,
      seasonId: parsed.data.seasonId,
      rules: parsed.data.rules,
    });
    return { ok: true, preview };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unable to preview division rules.",
    };
  }
}

export async function updateLeagueDivisionRules(
  input: DivisionRulesInputType,
): Promise<UpdateDivisionRulesResult> {
  const parsed = DivisionRulesInput.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check the rule list and try again.",
    };
  }

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const ctx = await requireLeagueAdmin(user.id);
  if (!ctx) return { ok: false, error: "Only league admins can manage division rules." };

  try {
    const rules = await replaceLeagueDivisionRules({
      leagueId: ctx.league.id,
      seasonId: parsed.data.seasonId,
      actorUserId: user.id,
      rules: parsed.data.rules,
    });

    let classified = 0;
    let warning: string | undefined;
    try {
      const result = await classifySeasonMemberSchools({ seasonId: parsed.data.seasonId });
      classified = result.classified;
    } catch (error) {
      warning =
        "Rules were saved, but current schools could not be reclassified. " +
        (error instanceof Error ? error.message : "Try applying them again.");
    }

    revalidatePath("/admin/schools");
    revalidatePath("/admin");
    revalidatePath("/dashboard/teams");

    return { ok: true, rules, classified, ...(warning ? { warning } : {}) };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unable to save division rules.",
    };
  }
}
