"use server";

/**
 * `submitForfeit` — coach-side multi-step forfeit submission.
 *
 * Authoritative server-side flow that mirrors the 3-step UI:
 *   Step 1: rescheduleAttempted (boolean, required) + optional notes
 *   Step 2: reason (ForfeitReason enum, required); `forfeitNotes` is required
 *           when reason === OTHER
 *   Step 3: confirmation (UI-only)
 *
 * Rules:
 *  - Caller must be on the forfeiting side's roster as COACH / CAPTAIN /
 *    MANAGER, OR be a LeagueAdminship on the match's league (admin override).
 *  - Match must not already be forfeited / finished / canceled.
 *  - If any games were played before the forfeit, status becomes FINISHED
 *    (mid-match forfeit). Otherwise FORFEITED (whole-match no-show).
 *  - Every successful submission writes an AuditLog entry with before/after
 *    state and a metadata flag distinguishing coach submissions from admin
 *    overrides.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { emailUrl, sendEmail } from "@/lib/email/send";
import {
  ForfeitSubmitted,
  forfeitSubmittedText,
} from "@/lib/email/templates/forfeit-submitted";

// --- Public input shape -------------------------------------------------

export const FORFEIT_REASONS = [
  "OPPONENT_NO_SHOW",
  "SCHEDULING_CONFLICT",
  "INSUFFICIENT_ROSTER",
  "TECHNICAL_ISSUES",
  "PLAYER_ILLNESS",
  "ELIGIBILITY_ISSUE",
  "WEATHER_TRAVEL",
  "OPPONENT_CONDUCT",
  "OTHER",
] as const;

export type ForfeitReasonValue = (typeof FORFEIT_REASONS)[number];

const SubmitForfeitInput = z
  .object({
    matchId: z.string().min(1, "Match id is required."),
    side: z.enum(["HOME", "AWAY"]),
    rescheduleAttempted: z.boolean({
      message: "Please answer Yes or No — did you try to reschedule first?",
    }),
    rescheduleNotes: z.string().max(500).optional(),
    reason: z.enum(FORFEIT_REASONS),
    forfeitNotes: z.string().max(1000).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.reason === "OTHER" && !val.forfeitNotes?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["forfeitNotes"],
        message: "Please describe what happened (required when reason is 'Other').",
      });
    }
  });

export type SubmitForfeitInputType = z.infer<typeof SubmitForfeitInput>;

export type SubmitForfeitResult =
  | { ok: true; matchId: string; status: "FORFEITED" | "FINISHED" }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

// --- Action -------------------------------------------------------------

export async function submitForfeit(input: SubmitForfeitInputType): Promise<SubmitForfeitResult> {
  // 1. Validate input
  const parsed = SubmitForfeitInput.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path.join(".");
      if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }
  const { matchId, side, rescheduleAttempted, rescheduleNotes, reason, forfeitNotes } =
    parsed.data;

  // 2. Auth
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You need to be signed in to forfeit a match." };

  // 3. Load match + permission scope
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      status: true,
      isForfeit: true,
      _count: { select: { games: true } },
      stage: {
        select: {
          competition: {
            select: {
              id: true,
              season: { select: { leagueId: true } },
            },
          },
        },
      },
      homeRoster: {
        select: {
          id: true,
          members: {
            where: { userId: user.id },
            select: { role: true },
          },
        },
      },
      awayRoster: {
        select: {
          id: true,
          members: {
            where: { userId: user.id },
            select: { role: true },
          },
        },
      },
    },
  });

  if (!match) return { ok: false, error: "We couldn't find that match." };
  if (match.isForfeit) return { ok: false, error: "This match has already been forfeited." };
  if (match.status === "FINISHED" || match.status === "CANCELED") {
    return { ok: false, error: `This match is already ${match.status.toLowerCase()}.` };
  }

  // 4. Permission check — caller must be on the chosen side's roster as
  //    COACH / CAPTAIN / MANAGER, OR be a league admin (override path).
  const sideRoster = side === "HOME" ? match.homeRoster : match.awayRoster;
  const onSide = sideRoster.members.some((m) =>
    m.role === "COACH" || m.role === "CAPTAIN" || m.role === "MANAGER",
  );

  let asAdminOverride = false;
  if (!onSide) {
    const leagueId = match.stage.competition.season.leagueId;
    const adminship = await prisma.leagueAdminship.findFirst({
      where: { userId: user.id, leagueId },
      select: { id: true },
    });
    if (adminship) {
      asAdminOverride = true;
    } else {
      return {
        ok: false,
        error: "You don't have permission to forfeit this match for that team.",
      };
    }
  }

  // 5. Compute new status from games played
  const newStatus: "FORFEITED" | "FINISHED" = match._count.games > 0 ? "FINISHED" : "FORFEITED";

  // 6. Combine reschedule notes into the persisted notes blob so the board
  //    can surface them later. The reason enum stays the primary signal.
  const combinedNotes = [
    rescheduleNotes?.trim() ? `Reschedule attempt: ${rescheduleNotes.trim()}` : null,
    forfeitNotes?.trim() ?? null,
  ]
    .filter((s): s is string => Boolean(s))
    .join("\n\n") || null;

  // 7. Winner is the OTHER side
  const winnerRosterId = side === "HOME" ? match.awayRoster.id : match.homeRoster.id;

  // 8. Transaction: update match + write audit log
  const before = { status: match.status, isForfeit: match.isForfeit };
  const now = new Date();

  const updated = await prisma.$transaction(async (tx) => {
    const upd = await tx.match.update({
      where: { id: matchId },
      data: {
        isForfeit: true,
        forfeitReason: reason,
        forfeitNotes: combinedNotes,
        rescheduleAttempted,
        forfeitingSide: side,
        forfeitedAt: now,
        forfeitedById: user.id,
        status: newStatus,
        winnerRosterId,
        finishedAt: now,
      },
      select: { id: true, status: true },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: user.id,
        action: asAdminOverride ? "MATCH.FORFEIT_ADMIN_OVERRIDE" : "MATCH.FORFEIT_SUBMIT",
        entityType: "Match",
        entityId: matchId,
        before,
        after: {
          status: newStatus,
          isForfeit: true,
          forfeitReason: reason,
          rescheduleAttempted,
          forfeitingSide: side,
        },
        metadata: {
          submittedBy: asAdminOverride ? "league_admin_override" : "coach",
          rescheduleNotes: rescheduleNotes?.trim() || null,
          gamesPlayedAtForfeit: match._count.games,
        },
        matchId,
        leagueId: match.stage.competition.season.leagueId,
        competitionId: match.stage.competition.id,
      },
    });

    return upd;
  });

  // 9. Revalidate every page that surfaces match state
  revalidatePath(`/dashboard/matches/${matchId}`);
  revalidatePath(`/admin/matches/${matchId}`);
  revalidatePath(`/admin/board`);
  revalidatePath(`/admin`);
  revalidatePath(`/me`);

  // 10. Notify the OPPOSING side's coaches. They get a default win and need
  //     to know — most leagues penalize no-shows, but the win still counts.
  const opposingSide = side === "HOME" ? "AWAY" : "HOME";
  const enriched = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      scheduledAt: true,
      stage: {
        select: {
          competition: { select: { name: true } },
        },
      },
      homeRoster: {
        select: {
          team: {
            select: {
              schoolId: true,
              customName: true,
              colorTag: true,
              school: { select: { name: true, shortName: true } },
              gameTitle: { select: { name: true } },
            },
          },
        },
      },
      awayRoster: {
        select: {
          team: {
            select: {
              schoolId: true,
              customName: true,
              colorTag: true,
              school: { select: { name: true, shortName: true } },
              gameTitle: { select: { name: true } },
            },
          },
        },
      },
    },
  });
  if (enriched) {
    const forfeitingTeam =
      side === "HOME" ? enriched.homeRoster.team : enriched.awayRoster.team;
    const receivingTeam =
      opposingSide === "HOME" ? enriched.homeRoster.team : enriched.awayRoster.team;
    const receivingSchoolId = receivingTeam.schoolId;

    if (receivingSchoolId) {
      const coaches = await prisma.schoolMembership.findMany({
        where: {
          schoolId: receivingSchoolId,
          role: { in: ["COACH", "MANAGER"] },
          detached: false,
        },
        select: { user: { select: { fullName: true, email: true } } },
      });
      const forfeitingTeamName = composeTeamNameLocal(forfeitingTeam);
      const receivingTeamName = composeTeamNameLocal(receivingTeam);
      const matchUrl = emailUrl(`/dashboard/matches/${matchId}`);
      for (const c of coaches) {
        await sendEmail({
          to: c.user.email,
          subject: `${forfeitingTeamName} forfeited — ${receivingTeamName} takes the win`,
          react: ForfeitSubmitted({
            opponentCoachName: c.user.fullName,
            forfeitingTeamName,
            receivingTeamName,
            competitionName: enriched.stage.competition.name,
            scheduledAt: enriched.scheduledAt,
            reason,
            reasonNotes: combinedNotes,
            matchUrl,
          }),
          text: forfeitSubmittedText({
            forfeitingTeamName,
            receivingTeamName,
            competitionName: enriched.stage.competition.name,
            matchUrl,
          }),
          tags: [
            { name: "kind", value: "forfeit_submitted" },
            { name: "league_id", value: match.stage.competition.season.leagueId },
            { name: "match_id", value: matchId },
          ],
        });
      }
    }
  }

  return {
    ok: true,
    matchId: updated.id,
    status: updated.status as "FORFEITED" | "FINISHED",
  };
}

// --- Team name helper --------------------------------------------------

function composeTeamNameLocal(team: {
  customName: string | null;
  colorTag: string | null;
  school: { name: string; shortName: string | null };
  gameTitle: { name: string };
}): string {
  if (team.customName) return team.customName;
  const base = `${team.school.shortName ?? team.school.name} ${team.gameTitle.name}`;
  return team.colorTag ? `${base} ${team.colorTag}` : base;
}
