"use server";

/**
 * Competition server actions.
 *
 *   - `createCompetition(payload)` — writes Competition + initial Stage(s)
 *     based on the template the wizard picked. Idempotent helper for Season
 *     (find-or-create by (leagueId, name)).
 *   - `runScheduler(competitionId)` — generates a round-robin schedule for
 *     the league-play stage. Refuses to overwrite an existing schedule.
 *
 * Both are gated to league admins via `requireLeagueAdmin` and write an
 * AuditLog entry inside the transaction.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { requireLeagueAdmin } from "@/lib/league-admin/dashboard";

// --- Shared types ------------------------------------------------------

const STAGE_TEMPLATES = [
  "ROUND_ROBIN",
  "RR_SINGLE_ELIM",
  "RR_DOUBLE_ELIM",
  "SWISS",
  "BRACKET_ONLY",
  "CUSTOM",
] as const;

const SKILL_TIERS = [
  "CLUB",
  "JV",
  "VARSITY",
  "PREMIER",
  "ACADEMY",
  "MIDDLE_SCHOOL",
  "UNIFIED",
] as const;

const CONFIRMATION_MODES = ["CONSENSUS", "DELAYED_AUTO"] as const;

// --- Shared helpers ----------------------------------------------------

function revalidateCompetitionSurfaces(competitionId?: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/competitions");
  if (competitionId) revalidatePath(`/admin/competitions/${competitionId}`);
  revalidatePath("/admin/matches");
  revalidatePath("/admin/scheduler");
  revalidatePath("/admin/board");
}

// --- 1. createCompetition ----------------------------------------------

const CreateCompetitionInput = z
  .object({
    name: z.string().min(3, "Name is too short.").max(140),
    seasonName: z.string().min(3, "Pick a season name.").max(80),
    gameSlug: z.string().min(1, "Pick a game."),
    skillTier: z.enum(SKILL_TIERS),
    isOnline: z.boolean(),
    startsAt: z.string().min(1, "Start date is required."),
    endsAt: z.string().min(1, "End date is required."),
    registrationOpensAt: z.string().min(1),
    registrationClosesAt: z.string().min(1),
    template: z.enum(STAGE_TEMPLATES),
    expectedTeams: z.number().int().min(2).max(256),
    bestOf: z.number().int().min(1).max(15),
    matchIntervalMinutes: z.number().int().min(15).max(240),
    concurrentMatches: z.boolean(),
    checkInWindowMinutes: z.number().int().min(0).max(60),
    rescheduleCutoffHours: z.number().int().min(0).max(168),
    confirmationMode: z.enum(CONFIRMATION_MODES),
    autoFinishAfterMinutes: z.number().int().min(5).max(1440).optional(),
    activate: z.boolean().default(false), // false → save as DRAFT; true → publish
  })
  .refine(
    (v) => new Date(v.endsAt).getTime() > new Date(v.startsAt).getTime(),
    { message: "End date must be after start date.", path: ["endsAt"] },
  )
  .refine(
    (v) =>
      new Date(v.registrationClosesAt).getTime() >=
      new Date(v.registrationOpensAt).getTime(),
    { message: "Registration close must be on or after open.", path: ["registrationClosesAt"] },
  );

export type CreateCompetitionInputType = z.infer<typeof CreateCompetitionInput>;

export type CreateCompetitionResult =
  | { ok: true; competitionId: string; stageIds: string[] }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function createCompetition(
  input: CreateCompetitionInputType,
): Promise<CreateCompetitionResult> {
  const parsed = CreateCompetitionInput.safeParse(input);
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
  if (!ctx) return { ok: false, error: "Only league admins can create competitions." };

  // Look up the game by slug
  const game = await prisma.gameTitle.findUnique({
    where: { slug: data.gameSlug },
    select: { id: true, name: true },
  });
  if (!game) {
    return {
      ok: false,
      error: `We don't track a game with slug "${data.gameSlug}". Ask platform admin to add it first.`,
    };
  }

  const startsAt = new Date(data.startsAt);
  const endsAt = new Date(data.endsAt);
  const registrationOpensAt = new Date(data.registrationOpensAt);
  const registrationClosesAt = new Date(data.registrationClosesAt);

  const stagePlan = planStages(data.template, startsAt, endsAt);

  const result = await prisma.$transaction(async (tx) => {
    // Find-or-create Season — keyed by (leagueId, name). Multiple
    // competitions in the same season reuse one row.
    let season = await tx.season.findFirst({
      where: { leagueId: ctx.league.id, name: data.seasonName },
      select: { id: true, startsAt: true, endsAt: true },
    });
    if (!season) {
      const created = await tx.season.create({
        data: {
          leagueId: ctx.league.id,
          name: data.seasonName,
          startsAt,
          endsAt,
        },
        select: { id: true, startsAt: true, endsAt: true },
      });
      season = created;
    } else if (endsAt > season.endsAt || startsAt < season.startsAt) {
      // Stretch the season window to cover this competition.
      await tx.season.update({
        where: { id: season.id },
        data: {
          startsAt: startsAt < season.startsAt ? startsAt : season.startsAt,
          endsAt: endsAt > season.endsAt ? endsAt : season.endsAt,
        },
      });
    }

    const initialState = data.activate ? "ACTIVE" : "DRAFT";

    const competition = await tx.competition.create({
      data: {
        seasonId: season.id,
        name: data.name,
        gameTitleId: game.id,
        skillTier: data.skillTier,
        kind: data.template === "BRACKET_ONLY" ? "TOURNAMENT" : "SEASON_PLAY",
        state: initialState,
        status: "SEEDING",
        isOnline: data.isOnline,
        registrationOpensAt,
        registrationClosesAt,
      },
      select: { id: true },
    });

    // Create the stage plan
    const stageIds: string[] = [];
    for (let i = 0; i < stagePlan.length; i++) {
      const s = stagePlan[i];
      const stage = await tx.stage.create({
        data: {
          competitionId: competition.id,
          name: s.name,
          kind: s.kind,
          schedulingMethod: s.schedulingMethod,
          order: i,
          state: initialState,
          startsAt: s.startsAt,
          endsAt: s.endsAt,
          bestOf: data.bestOf,
          gamesPerMatch: data.bestOf,
          matchIntervalMinutes: data.matchIntervalMinutes,
          concurrentMatches: data.concurrentMatches,
          checkInWindowMinutes: data.checkInWindowMinutes,
          rescheduleCutoffHours: data.rescheduleCutoffHours,
          confirmationMode: data.confirmationMode,
          autoFinishAfterMinutes:
            data.confirmationMode === "DELAYED_AUTO"
              ? data.autoFinishAfterMinutes ?? 60
              : null,
        },
        select: { id: true },
      });
      stageIds.push(stage.id);
    }

    await tx.auditLog.create({
      data: {
        actorUserId: user.id,
        action: "COMPETITION.CREATE",
        entityType: "Competition",
        entityId: competition.id,
        after: {
          name: data.name,
          seasonName: data.seasonName,
          game: game.name,
          tier: data.skillTier,
          template: data.template,
          stageCount: stagePlan.length,
          state: initialState,
        },
        metadata: {
          expectedTeams: data.expectedTeams,
          bestOf: data.bestOf,
        },
        leagueId: ctx.league.id,
        competitionId: competition.id,
      },
    });

    return { competitionId: competition.id, stageIds };
  });

  revalidateCompetitionSurfaces(result.competitionId);
  return { ok: true, ...result };
}

// --- Stage planner -----------------------------------------------------

type StagePlan = {
  name: string;
  kind:
    | "LEAGUE_PLAY"
    | "GROUP_STAGE"
    | "ROUND_ROBIN"
    | "SWISS"
    | "SINGLE_ELIM"
    | "DOUBLE_ELIM"
    | "PLACEMENT"
    | "CUSTOM";
  schedulingMethod:
    | "CUSTOM"
    | "ROUND_ROBIN"
    | "SINGLE_ELIM"
    | "DOUBLE_ELIM"
    | "SWISS"
    | "PLACEMENT";
  startsAt: Date;
  endsAt: Date;
};

function planStages(
  template: (typeof STAGE_TEMPLATES)[number],
  startsAt: Date,
  endsAt: Date,
): StagePlan[] {
  // For templates with two stages, split 75% / 25% of the window between
  // regular season and playoffs.
  const midpoint = new Date(
    startsAt.getTime() + (endsAt.getTime() - startsAt.getTime()) * 0.75,
  );

  switch (template) {
    case "ROUND_ROBIN":
      return [
        {
          name: "Round Robin",
          kind: "ROUND_ROBIN",
          schedulingMethod: "ROUND_ROBIN",
          startsAt,
          endsAt,
        },
      ];
    case "RR_SINGLE_ELIM":
      return [
        {
          name: "League Play",
          kind: "LEAGUE_PLAY",
          schedulingMethod: "ROUND_ROBIN",
          startsAt,
          endsAt: midpoint,
        },
        {
          name: "Playoffs",
          kind: "SINGLE_ELIM",
          schedulingMethod: "SINGLE_ELIM",
          startsAt: midpoint,
          endsAt,
        },
      ];
    case "RR_DOUBLE_ELIM":
      return [
        {
          name: "League Play",
          kind: "LEAGUE_PLAY",
          schedulingMethod: "ROUND_ROBIN",
          startsAt,
          endsAt: midpoint,
        },
        {
          name: "Playoffs",
          kind: "DOUBLE_ELIM",
          schedulingMethod: "DOUBLE_ELIM",
          startsAt: midpoint,
          endsAt,
        },
      ];
    case "SWISS":
      return [
        {
          name: "Swiss Rounds",
          kind: "SWISS",
          schedulingMethod: "SWISS",
          startsAt,
          endsAt,
        },
      ];
    case "BRACKET_ONLY":
      return [
        {
          name: "Bracket",
          kind: "SINGLE_ELIM",
          schedulingMethod: "SINGLE_ELIM",
          startsAt,
          endsAt,
        },
      ];
    case "CUSTOM":
    default:
      return [
        {
          name: "Custom Stage",
          kind: "CUSTOM",
          schedulingMethod: "CUSTOM",
          startsAt,
          endsAt,
        },
      ];
  }
}

// --- 2. runScheduler ---------------------------------------------------

const RunSchedulerInput = z.object({
  competitionId: z.string().min(1),
});

export type RunSchedulerResult =
  | {
      ok: true;
      competitionId: string;
      stageId: string;
      matchesCreated: number;
      roundsCreated: number;
    }
  | { ok: false; error: string };

/**
 * Generate a round-robin schedule for the competition's first round-robin
 * stage. Uses the standard "circle method" to produce balanced pairings.
 *
 * Intentionally narrow for now:
 *  - Only schedules the first ROUND_ROBIN / LEAGUE_PLAY stage (the "regular
 *    season"). Playoff brackets seed later when standings exist.
 *  - Only includes rosters where `registrationStatus = APPROVED`.
 *  - Idempotent: refuses to write if matches already exist for the stage.
 *  - Uses stage.startsAt + N * matchIntervalMinutes as the slot times. No
 *    fancy availability solver yet (that's the future "AI scheduler").
 */
export async function runScheduler(input: { competitionId: string }): Promise<RunSchedulerResult> {
  const parsed = RunSchedulerInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  const { competitionId } = parsed.data;

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const ctx = await requireLeagueAdmin(user.id);
  if (!ctx) return { ok: false, error: "Only league admins can run the scheduler." };

  const competition = await prisma.competition.findUnique({
    where: { id: competitionId },
    select: {
      id: true,
      name: true,
      season: { select: { leagueId: true } },
      stages: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          name: true,
          kind: true,
          schedulingMethod: true,
          startsAt: true,
          endsAt: true,
          bestOf: true,
          matchIntervalMinutes: true,
          _count: { select: { matches: true } },
        },
      },
      rosters: {
        where: { registrationStatus: "APPROVED" },
        orderBy: { createdAt: "asc" },
        select: { id: true, team: { select: { id: true, customName: true } } },
      },
    },
  });
  if (!competition) return { ok: false, error: "Competition not found." };
  if (competition.season.leagueId !== ctx.league.id) {
    return { ok: false, error: "This competition isn't in your league." };
  }

  const stage = competition.stages.find(
    (s) =>
      s.schedulingMethod === "ROUND_ROBIN" ||
      s.kind === "LEAGUE_PLAY" ||
      s.kind === "ROUND_ROBIN",
  );
  if (!stage) {
    return {
      ok: false,
      error:
        "This competition doesn't have a round-robin stage. Bracket-only / Swiss formats land in a later sprint.",
    };
  }
  if (stage._count.matches > 0) {
    return {
      ok: false,
      error: `Stage "${stage.name}" already has matches. Clear them first if you want to re-generate.`,
    };
  }

  const rosters = competition.rosters;
  if (rosters.length < 2) {
    return {
      ok: false,
      error: `Need at least 2 approved rosters to schedule — found ${rosters.length}.`,
    };
  }

  // Build round-robin pairings via the circle method
  const pairings = buildRoundRobinPairings(rosters.map((r) => r.id));
  // pairings is an array of rounds, each round is array of [homeId, awayId] (or null for bye)

  const result = await prisma.$transaction(async (tx) => {
    let matchesCreated = 0;
    let roundsCreated = 0;
    const intervalMs = stage.matchIntervalMinutes * 60 * 1000;

    for (let r = 0; r < pairings.length; r++) {
      const roundDate = new Date(stage.startsAt.getTime() + r * 24 * 60 * 60 * 1000); // one round per day
      const round = await tx.round.create({
        data: {
          stageId: stage.id,
          name: `Week ${r + 1}`,
          order: r,
          startsAt: roundDate,
          endsAt: new Date(roundDate.getTime() + 24 * 60 * 60 * 1000),
        },
        select: { id: true },
      });
      roundsCreated++;

      const roundPairs = pairings[r];
      for (let p = 0; p < roundPairs.length; p++) {
        const pair = roundPairs[p];
        if (!pair) continue; // bye — odd team count
        const [homeId, awayId] = pair;
        const slotOffset = p * intervalMs;
        await tx.match.create({
          data: {
            stageId: stage.id,
            roundId: round.id,
            homeRosterId: homeId,
            awayRosterId: awayId,
            bracketRound: r + 1,
            bracketSlot: p,
            scheduledAt: new Date(roundDate.getTime() + slotOffset),
            status: "SCHEDULED",
            bestOf: stage.bestOf,
          },
        });
        matchesCreated++;
      }
    }

    await tx.auditLog.create({
      data: {
        actorUserId: user.id,
        action: "COMPETITION.RUN_SCHEDULER",
        entityType: "Stage",
        entityId: stage.id,
        after: {
          matchesCreated,
          roundsCreated,
          rosterCount: rosters.length,
        },
        leagueId: ctx.league.id,
        competitionId: competition.id,
      },
    });

    return { matchesCreated, roundsCreated, stageId: stage.id };
  });

  revalidateCompetitionSurfaces(competitionId);
  return { ok: true, competitionId, ...result };
}

// --- Round-robin builder -----------------------------------------------

/**
 * Circle method: returns N-1 rounds of (N/2) pairings (rounded up — a bye
 * shows up as `null`). Each team plays every other team exactly once.
 *
 * For odd N we add a sentinel "bye" slot, so each round one team rests.
 */
function buildRoundRobinPairings(
  rosterIds: string[],
): Array<Array<[string, string] | null>> {
  const teams = [...rosterIds];
  if (teams.length % 2 === 1) teams.push("__BYE__");
  const n = teams.length;
  const roundsCount = n - 1;
  const half = n / 2;

  const rounds: Array<Array<[string, string] | null>> = [];
  const arr = [...teams];

  for (let r = 0; r < roundsCount; r++) {
    const pairings: Array<[string, string] | null> = [];
    for (let i = 0; i < half; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      if (a === "__BYE__" || b === "__BYE__") {
        pairings.push(null);
      } else {
        // Alternate home/away each round so teams don't always play same side
        if (r % 2 === 0) pairings.push([a, b]);
        else pairings.push([b, a]);
      }
    }
    rounds.push(pairings);
    // Rotate — keep first fixed, rotate the rest clockwise
    const fixed = arr[0];
    const rest = arr.slice(1);
    rest.unshift(rest.pop() as string);
    arr.length = 0;
    arr.push(fixed, ...rest);
  }

  return rounds;
}
