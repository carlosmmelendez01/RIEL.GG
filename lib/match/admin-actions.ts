"use server";

/**
 * Admin-side match override server actions.
 *
 *   - `forceMatchScore`     — write a final score regardless of consensus
 *   - `markMatchDisputed`   — flag a match as disputed (admin escalation)
 *   - `overrideMatchStatus` — bump a match into any status
 *   - `revertMatchForfeit`  — undo a forfeit (clears all forfeit fields)
 *
 * Every action is gated to the match's league admins via
 * `requireLeagueAdmin(userId)` + a scope check, runs inside a transaction
 * with a `MATCH.*_ADMIN_OVERRIDE` audit log entry, and revalidates the
 * usual surfaces.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { requireLeagueAdmin } from "@/lib/league-admin/dashboard";

// --- Shared helpers ----------------------------------------------------

const MATCH_STATUSES = [
  "SCHEDULED",
  "CHECKING_IN",
  "IN_PROGRESS",
  "AWAITING_CONFIRMATION",
  "FINISHED",
  "FORFEITED",
  "CANCELED",
  "DISPUTED",
] as const;

type MatchStatus = (typeof MATCH_STATUSES)[number];

async function loadAndAuthorizeMatch(matchId: string, userId: string) {
  const ctx = await requireLeagueAdmin(userId);
  if (!ctx) return { ok: false as const, error: "Only league admins can override matches." };

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      status: true,
      isForfeit: true,
      homeRosterId: true,
      awayRosterId: true,
      homeScore: true,
      awayScore: true,
      winnerRosterId: true,
      finishedAt: true,
      forfeitReason: true,
      forfeitNotes: true,
      forfeitingSide: true,
      rescheduleAttempted: true,
      forfeitedAt: true,
      forfeitedById: true,
      _count: { select: { games: true } },
      stage: {
        select: {
          competition: { select: { id: true, season: { select: { leagueId: true } } } },
        },
      },
    },
  });
  if (!match) return { ok: false as const, error: "Match not found." };
  if (match.stage.competition.season.leagueId !== ctx.league.id) {
    return { ok: false as const, error: "This match isn't in your league." };
  }
  return { ok: true as const, ctx, match };
}

function revalidateMatchSurfaces(matchId: string) {
  revalidatePath(`/dashboard/matches/${matchId}`);
  revalidatePath(`/admin/matches/${matchId}`);
  revalidatePath("/admin/matches");
  revalidatePath("/admin");
  revalidatePath("/admin/board");
  revalidatePath("/dashboard");
  revalidatePath("/me");
}

// --- 1. forceMatchScore ------------------------------------------------

const ForceScoreInput = z
  .object({
    matchId: z.string().min(1),
    homeScore: z.number().int().min(0).max(99),
    awayScore: z.number().int().min(0).max(99),
    reason: z.string().min(5, "Required: brief explanation for audit log.").max(500),
  })
  .refine((v) => v.homeScore !== v.awayScore, {
    message: "Scores must have a winner.",
    path: ["awayScore"],
  });

export type ForceScoreResult =
  | { ok: true; matchId: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function forceMatchScore(input: z.infer<typeof ForceScoreInput>): Promise<ForceScoreResult> {
  const parsed = ForceScoreInput.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path.join(".");
      if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }
  const { matchId, homeScore, awayScore, reason } = parsed.data;

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const authz = await loadAndAuthorizeMatch(matchId, user.id);
  if (!authz.ok) return { ok: false, error: authz.error };
  const { ctx, match } = authz;

  const winnerRosterId =
    homeScore > awayScore ? match.homeRosterId : match.awayRosterId;
  const now = new Date();
  const before = {
    status: match.status,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
  };

  await prisma.$transaction(async (tx) => {
    await tx.match.update({
      where: { id: matchId },
      data: {
        status: "FINISHED",
        homeScore,
        awayScore,
        winnerRosterId,
        finishedAt: now,
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: user.id,
        action: "MATCH.FORCE_SCORE_ADMIN_OVERRIDE",
        entityType: "Match",
        entityId: matchId,
        before,
        after: { status: "FINISHED", homeScore, awayScore },
        metadata: { reason: reason.trim() },
        matchId,
        leagueId: ctx.league.id,
        competitionId: match.stage.competition.id,
      },
    });
  });

  revalidateMatchSurfaces(matchId);
  return { ok: true, matchId };
}

// --- 2. markMatchDisputed ----------------------------------------------

const MarkDisputedInput = z.object({
  matchId: z.string().min(1),
  reason: z.string().min(5, "Required: brief explanation for audit log.").max(500),
});

export type MarkDisputedResult = ForceScoreResult;

export async function markMatchDisputed(input: z.infer<typeof MarkDisputedInput>): Promise<MarkDisputedResult> {
  const parsed = MarkDisputedInput.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path.join(".");
      if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }
  const { matchId, reason } = parsed.data;

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const authz = await loadAndAuthorizeMatch(matchId, user.id);
  if (!authz.ok) return { ok: false, error: authz.error };
  const { ctx, match } = authz;

  if (match.status === "DISPUTED") {
    return { ok: false, error: "Match is already disputed." };
  }
  if (match.status === "CANCELED") {
    return { ok: false, error: "Can't dispute a canceled match." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.match.update({
      where: { id: matchId },
      data: { status: "DISPUTED" },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: user.id,
        action: "MATCH.MARK_DISPUTED_ADMIN_OVERRIDE",
        entityType: "Match",
        entityId: matchId,
        before: { status: match.status },
        after: { status: "DISPUTED" },
        metadata: { reason: reason.trim() },
        matchId,
        leagueId: ctx.league.id,
        competitionId: match.stage.competition.id,
      },
    });
  });

  revalidateMatchSurfaces(matchId);
  return { ok: true, matchId };
}

// --- 3. overrideMatchStatus --------------------------------------------

const OverrideStatusInput = z.object({
  matchId: z.string().min(1),
  newStatus: z.enum(MATCH_STATUSES),
  reason: z.string().min(5, "Required: brief explanation for audit log.").max(500),
});

export type OverrideStatusResult = ForceScoreResult;

export async function overrideMatchStatus(
  input: z.infer<typeof OverrideStatusInput>,
): Promise<OverrideStatusResult> {
  const parsed = OverrideStatusInput.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path.join(".");
      if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }
  const { matchId, newStatus, reason } = parsed.data;

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const authz = await loadAndAuthorizeMatch(matchId, user.id);
  if (!authz.ok) return { ok: false, error: authz.error };
  const { ctx, match } = authz;

  if (match.status === newStatus) {
    return { ok: false, error: `Match is already ${newStatus.toLowerCase()}.` };
  }

  await prisma.$transaction(async (tx) => {
    await tx.match.update({
      where: { id: matchId },
      data: {
        status: newStatus,
        // If we're pushing FORWARD to FINISHED without a forced score,
        // don't synthesize one — caller should use forceMatchScore.
        // If reverting from FINISHED, clear finishedAt + winner so the
        // standings recompute cleanly.
        ...(newStatus !== "FINISHED" && newStatus !== "FORFEITED"
          ? { finishedAt: null, winnerRosterId: null }
          : {}),
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: user.id,
        action: "MATCH.OVERRIDE_STATUS_ADMIN_OVERRIDE",
        entityType: "Match",
        entityId: matchId,
        before: { status: match.status },
        after: { status: newStatus },
        metadata: { reason: reason.trim() },
        matchId,
        leagueId: ctx.league.id,
        competitionId: match.stage.competition.id,
      },
    });
  });

  revalidateMatchSurfaces(matchId);
  return { ok: true, matchId };
}

// --- 4. revertMatchForfeit ---------------------------------------------

const RevertForfeitInput = z.object({
  matchId: z.string().min(1),
  reason: z.string().min(5, "Required: brief explanation for audit log.").max(500),
});

export type RevertForfeitResult = ForceScoreResult;

export async function revertMatchForfeit(
  input: z.infer<typeof RevertForfeitInput>,
): Promise<RevertForfeitResult> {
  const parsed = RevertForfeitInput.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path.join(".");
      if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }
  const { matchId, reason } = parsed.data;

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const authz = await loadAndAuthorizeMatch(matchId, user.id);
  if (!authz.ok) return { ok: false, error: authz.error };
  const { ctx, match } = authz;

  if (!match.isForfeit) {
    return { ok: false, error: "No forfeit to revert on this match." };
  }

  // If games were played before the forfeit, restore to FINISHED (with
  // the original scores intact — they're already on the match). Otherwise
  // bump back to SCHEDULED so the match can be replayed.
  const hadGamesPlayed = match._count.games > 0;
  const restoredStatus: MatchStatus = hadGamesPlayed ? "FINISHED" : "SCHEDULED";
  const restoredFinishedAt = hadGamesPlayed ? match.finishedAt : null;
  const restoredWinner = hadGamesPlayed ? match.winnerRosterId : null;

  const before = {
    status: match.status,
    isForfeit: true,
    forfeitReason: match.forfeitReason,
    forfeitingSide: match.forfeitingSide,
  };

  await prisma.$transaction(async (tx) => {
    await tx.match.update({
      where: { id: matchId },
      data: {
        status: restoredStatus,
        isForfeit: false,
        forfeitReason: null,
        forfeitNotes: null,
        rescheduleAttempted: null,
        forfeitingSide: null,
        forfeitedAt: null,
        forfeitedById: null,
        finishedAt: restoredFinishedAt,
        winnerRosterId: restoredWinner,
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: user.id,
        action: "MATCH.REVERT_FORFEIT_ADMIN_OVERRIDE",
        entityType: "Match",
        entityId: matchId,
        before,
        after: { status: restoredStatus, isForfeit: false },
        metadata: { reason: reason.trim(), hadGamesPlayed },
        matchId,
        leagueId: ctx.league.id,
        competitionId: match.stage.competition.id,
      },
    });
  });

  revalidateMatchSurfaces(matchId);
  return { ok: true, matchId };
}
