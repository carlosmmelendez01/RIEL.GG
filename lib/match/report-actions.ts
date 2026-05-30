"use server";

/**
 * Coach-side match reporting server actions.
 *
 * Three actions that drive the consensus-confirmation flow:
 *   - `submitMatchReport`   — coach posts the final score
 *   - `confirmMatchReport`  — opposing coach agrees → match FINISHED
 *   - `disputeMatchReport`  — opposing coach disagrees → match DISPUTED
 *
 * Each action runs in a transaction with an `AuditLog` entry so any change
 * to a match's status is traceable. Revalidates every page that surfaces
 * match state (coach dashboard, admin dashboard, board, /me).
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";

// --- Helpers -----------------------------------------------------------

type Side = "HOME" | "AWAY";

const COACH_ROLES = ["COACH", "CAPTAIN", "MANAGER"] as const;

/**
 * Returns the side (HOME / AWAY) the user is on, by checking RosterMembership
 * against the match's two rosters. Returns null if the user is on neither
 * roster as a coach-class role.
 */
async function resolveSide(
  userId: string,
  homeRosterId: string,
  awayRosterId: string,
): Promise<{ side: Side; rosterId: string; membershipId: string } | null> {
  const memberships = await prisma.rosterMembership.findMany({
    where: {
      userId,
      rosterId: { in: [homeRosterId, awayRosterId] },
      role: { in: ["COACH", "CAPTAIN", "MANAGER"] },
    },
    select: { id: true, rosterId: true },
  });
  if (memberships.length === 0) return null;
  // If the user is on both rosters (rare but possible for cross-team coaches),
  // prefer HOME.
  const home = memberships.find((m) => m.rosterId === homeRosterId);
  if (home) return { side: "HOME", rosterId: homeRosterId, membershipId: home.id };
  const away = memberships.find((m) => m.rosterId === awayRosterId);
  if (away) return { side: "AWAY", rosterId: awayRosterId, membershipId: away.id };
  return null;
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

// --- 1. submitMatchReport ----------------------------------------------

const SubmitReportInput = z
  .object({
    matchId: z.string().min(1),
    homeScore: z.number().int().min(0).max(99),
    awayScore: z.number().int().min(0).max(99),
    notes: z.string().max(2000).optional(),
  })
  .refine((v) => v.homeScore !== v.awayScore, {
    message: "Scores must have a winner — ties aren't supported in scholastic play yet.",
    path: ["awayScore"],
  });

export type SubmitReportInputType = z.infer<typeof SubmitReportInput>;

export type SubmitReportResult =
  | { ok: true; reportId: string; status: "AWAITING_CONFIRMATION" }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/**
 * Coach submits a final score. The opposing coach must then confirm or
 * dispute before the match is recorded as FINISHED.
 */
export async function submitMatchReport(
  input: SubmitReportInputType,
): Promise<SubmitReportResult> {
  const parsed = SubmitReportInput.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path.join(".");
      if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }
  const { matchId, homeScore, awayScore, notes } = parsed.data;

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      status: true,
      isForfeit: true,
      homeRosterId: true,
      awayRosterId: true,
      stage: {
        select: {
          competition: {
            select: { id: true, season: { select: { leagueId: true } } },
          },
        },
      },
    },
  });
  if (!match) return { ok: false, error: "Match not found." };
  if (match.isForfeit) {
    return { ok: false, error: "This match has been forfeited — scores can't be reported." };
  }
  if (match.status === "FINISHED" || match.status === "CANCELED") {
    return {
      ok: false,
      error: `This match is already ${match.status.toLowerCase()}.`,
    };
  }
  if (match.status === "DISPUTED") {
    return {
      ok: false,
      error: "This match is in dispute. A league admin must resolve it before new reports can be filed.",
    };
  }

  const sideInfo = await resolveSide(user.id, match.homeRosterId, match.awayRosterId);
  if (!sideInfo) {
    return {
      ok: false,
      error: "Only the team's coach, captain, or manager can report a score.",
    };
  }

  const now = new Date();

  const updated = await prisma.$transaction(async (tx) => {
    const report = await tx.matchReport.create({
      data: {
        matchId,
        reportedByMembershipId: sideInfo.membershipId,
        reportedByUserId: user.id,
        homeScore,
        awayScore,
        notes: notes?.trim() || null,
      },
    });

    // Move match into AWAITING_CONFIRMATION and stamp the reporter's side
    // confirmedAt so we know they agree with their own submission.
    await tx.match.update({
      where: { id: matchId },
      data: {
        status: "AWAITING_CONFIRMATION",
        ...(sideInfo.side === "HOME"
          ? { homeConfirmedAt: now, homeConfirmedById: user.id }
          : { awayConfirmedAt: now, awayConfirmedById: user.id }),
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: user.id,
        action: "MATCH.SCORE_REPORT",
        entityType: "Match",
        entityId: matchId,
        before: { status: match.status },
        after: { status: "AWAITING_CONFIRMATION", homeScore, awayScore },
        metadata: { reportedSide: sideInfo.side, reportId: report.id },
        matchId,
        leagueId: match.stage.competition.season.leagueId,
        competitionId: match.stage.competition.id,
      },
    });

    return report;
  });

  revalidateMatchSurfaces(matchId);
  return { ok: true, reportId: updated.id, status: "AWAITING_CONFIRMATION" };
}

// --- 2. confirmMatchReport ---------------------------------------------

const ConfirmReportInput = z.object({
  matchId: z.string().min(1),
});

export type ConfirmReportResult =
  | { ok: true; matchId: string; status: "FINISHED" }
  | { ok: false; error: string };

/**
 * Opposing coach confirms the submitted score → match FINISHED.
 */
export async function confirmMatchReport(input: { matchId: string }): Promise<ConfirmReportResult> {
  const parsed = ConfirmReportInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid match id." };
  const { matchId } = parsed.data;

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      status: true,
      homeRosterId: true,
      awayRosterId: true,
      homeConfirmedById: true,
      awayConfirmedById: true,
      reports: {
        orderBy: { submittedAt: "desc" },
        take: 1,
        select: {
          id: true,
          homeScore: true,
          awayScore: true,
          reportedByMembership: { select: { rosterId: true } },
        },
      },
      stage: {
        select: {
          competition: { select: { id: true, season: { select: { leagueId: true } } } },
        },
      },
    },
  });
  if (!match) return { ok: false, error: "Match not found." };
  if (match.status !== "AWAITING_CONFIRMATION") {
    return {
      ok: false,
      error: `Match is ${match.status.toLowerCase().replace(/_/g, " ")} — there's nothing to confirm.`,
    };
  }
  const lastReport = match.reports[0];
  if (!lastReport) return { ok: false, error: "No report has been submitted yet." };

  const sideInfo = await resolveSide(user.id, match.homeRosterId, match.awayRosterId);
  if (!sideInfo) {
    return { ok: false, error: "Only the team's coach, captain, or manager can confirm a score." };
  }

  // Confirmer must be on the OPPOSITE side of the reporter
  const reporterSide: Side =
    lastReport.reportedByMembership.rosterId === match.homeRosterId ? "HOME" : "AWAY";
  if (sideInfo.side === reporterSide) {
    return {
      ok: false,
      error: "You submitted this report — the opposing coach has to confirm it.",
    };
  }

  const homeScore = lastReport.homeScore;
  const awayScore = lastReport.awayScore;
  const winnerRosterId =
    homeScore > awayScore ? match.homeRosterId : match.awayRosterId;
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.match.update({
      where: { id: matchId },
      data: {
        status: "FINISHED",
        homeScore,
        awayScore,
        winnerRosterId,
        finishedAt: now,
        ...(sideInfo.side === "HOME"
          ? { homeConfirmedAt: now, homeConfirmedById: user.id }
          : { awayConfirmedAt: now, awayConfirmedById: user.id }),
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: user.id,
        action: "MATCH.SCORE_CONFIRM",
        entityType: "Match",
        entityId: matchId,
        before: { status: "AWAITING_CONFIRMATION" },
        after: { status: "FINISHED", homeScore, awayScore },
        metadata: { confirmedSide: sideInfo.side, reportId: lastReport.id },
        matchId,
        leagueId: match.stage.competition.season.leagueId,
        competitionId: match.stage.competition.id,
      },
    });
  });

  revalidateMatchSurfaces(matchId);
  return { ok: true, matchId, status: "FINISHED" };
}

// --- 3. disputeMatchReport ---------------------------------------------

const DisputeReportInput = z.object({
  matchId: z.string().min(1),
  reason: z.string().min(5, "Tell the admin what's wrong (5+ chars).").max(1000),
});

export type DisputeReportResult =
  | { ok: true; matchId: string; status: "DISPUTED" }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/**
 * Opposing coach disputes the submitted score → match DISPUTED. A league
 * admin must then resolve via `forceMatchScore` or `overrideMatchStatus`.
 */
export async function disputeMatchReport(input: {
  matchId: string;
  reason: string;
}): Promise<DisputeReportResult> {
  const parsed = DisputeReportInput.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path.join(".");
      if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    return { ok: false, error: "Please describe what's wrong.", fieldErrors };
  }
  const { matchId, reason } = parsed.data;

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      status: true,
      homeRosterId: true,
      awayRosterId: true,
      reports: {
        orderBy: { submittedAt: "desc" },
        take: 1,
        select: { id: true, reportedByMembership: { select: { rosterId: true } } },
      },
      stage: {
        select: {
          competition: { select: { id: true, season: { select: { leagueId: true } } } },
        },
      },
    },
  });
  if (!match) return { ok: false, error: "Match not found." };
  if (match.status !== "AWAITING_CONFIRMATION") {
    return {
      ok: false,
      error: `Match is ${match.status.toLowerCase().replace(/_/g, " ")} — there's nothing to dispute.`,
    };
  }
  const lastReport = match.reports[0];
  if (!lastReport) return { ok: false, error: "No report exists to dispute." };

  const sideInfo = await resolveSide(user.id, match.homeRosterId, match.awayRosterId);
  if (!sideInfo) {
    return { ok: false, error: "Only the team's coach, captain, or manager can raise a dispute." };
  }

  const reporterSide: Side =
    lastReport.reportedByMembership.rosterId === match.homeRosterId ? "HOME" : "AWAY";
  if (sideInfo.side === reporterSide) {
    return {
      ok: false,
      error: "You can't dispute your own submission — withdraw it and submit a new report.",
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.match.update({
      where: { id: matchId },
      data: { status: "DISPUTED" },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: user.id,
        action: "MATCH.DISPUTE",
        entityType: "Match",
        entityId: matchId,
        before: { status: "AWAITING_CONFIRMATION" },
        after: { status: "DISPUTED" },
        metadata: {
          disputeReason: reason.trim(),
          disputedBy: sideInfo.side,
          contestedReportId: lastReport.id,
        },
        matchId,
        leagueId: match.stage.competition.season.leagueId,
        competitionId: match.stage.competition.id,
      },
    });
  });

  revalidateMatchSurfaces(matchId);
  return { ok: true, matchId, status: "DISPUTED" };
}
