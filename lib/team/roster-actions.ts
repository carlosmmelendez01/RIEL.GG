"use server";

/**
 * Team + Roster server actions.
 *
 * Coach surface:
 *   - `createTeam`                     → new Team in the coach's school
 *   - `registerTeamForCompetition`     → new Roster (PENDING) under a Team
 *   - `addPlayerToRoster`              → finds an existing User by email +
 *                                        attaches as RosterMembership
 *   - `removePlayerFromRoster`         → drops a RosterMembership
 *
 * Admin surface:
 *   - `approveRoster(rosterId)`        → flips registrationStatus to APPROVED
 *   - `rejectRoster(rosterId, reason)` → flips to REJECTED + reason in audit
 *
 * All actions are zod-validated, run inside a transaction with an `AuditLog`
 * write, and revalidate the touched coach + admin surfaces. Authorization is
 * intentionally explicit per-action — the school-scope and league-scope
 * checks are different, so a single shared gate would hide intent.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { isSupportedGame } from "@/lib/games/supported";
import { emailUrl, sendEmail } from "@/lib/email/send";
import { RosterApproved, rosterApprovedText } from "@/lib/email/templates/roster-approved";
import { RosterRejected, rosterRejectedText } from "@/lib/email/templates/roster-rejected";
import { requireLeagueAdmin } from "@/lib/league-admin/dashboard";

// --- Shared types ------------------------------------------------------

const SKILL_TIERS = [
  "CLUB",
  "JV",
  "VARSITY",
  "PREMIER",
  "ACADEMY",
  "MIDDLE_SCHOOL",
  "UNIFIED",
] as const;

const ROSTER_ROLES = ["MANAGER", "COACH", "CAPTAIN", "PLAYER"] as const;

// --- Shared helpers ----------------------------------------------------

function revalidateCoachSurfaces(teamId?: string) {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/teams");
  if (teamId) revalidatePath(`/dashboard/teams/${teamId}`);
  revalidatePath("/me");
}

function revalidateAdminSurfaces(competitionId?: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/competitions");
  if (competitionId) revalidatePath(`/admin/competitions/${competitionId}`);
  revalidatePath("/admin/scheduler");
}

/**
 * Returns the SchoolMembership row if the user is a COACH or MANAGER at
 * the school. Coaches manage rosters; players don't.
 */
async function requireSchoolCoach(userId: string, schoolId: string) {
  const m = await prisma.schoolMembership.findUnique({
    where: { schoolId_userId: { schoolId, userId } },
    select: { id: true, role: true, isOwner: true },
  });
  if (!m) return null;
  if (m.role !== "COACH" && m.role !== "MANAGER") return null;
  return m;
}

// --- 1. createTeam -----------------------------------------------------

const CreateTeamInput = z.object({
  schoolId: z.string().min(1),
  gameSlug: z.string().min(1),
  skillTier: z.enum(SKILL_TIERS).default("VARSITY"),
  customName: z.string().min(2).max(80).optional(),
  colorTag: z.string().max(20).optional(),
});

export type CreateTeamResult =
  | { ok: true; teamId: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function createTeam(
  input: z.infer<typeof CreateTeamInput>,
): Promise<CreateTeamResult> {
  const parsed = CreateTeamInput.safeParse(input);
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

  const coach = await requireSchoolCoach(user.id, data.schoolId);
  if (!coach) {
    return {
      ok: false,
      error: "Only the school's coach or manager can create teams.",
    };
  }

  // MVP guard: only approved titles can spin up new teams.
  if (!isSupportedGame(data.gameSlug)) {
    return { ok: false, error: "That game isn't supported." };
  }

  const game = await prisma.gameTitle.findUnique({
    where: { slug: data.gameSlug },
    select: { id: true, name: true },
  });
  if (!game) {
    return { ok: false, error: `Unknown game "${data.gameSlug}".` };
  }

  const team = await prisma.$transaction(async (tx) => {
    const created = await tx.team.create({
      data: {
        schoolId: data.schoolId,
        gameTitleId: game.id,
        skillTier: data.skillTier,
        customName: data.customName?.trim() || null,
        colorTag: data.colorTag?.trim() || null,
      },
      select: { id: true },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: user.id,
        action: "TEAM.CREATE",
        entityType: "Team",
        entityId: created.id,
        after: {
          schoolId: data.schoolId,
          game: game.name,
          skillTier: data.skillTier,
          customName: data.customName ?? null,
        },
        schoolId: data.schoolId,
      },
    });

    return created;
  });

  revalidateCoachSurfaces();
  return { ok: true, teamId: team.id };
}

// --- 2. registerTeamForCompetition ------------------------------------

const RegisterInput = z.object({
  teamId: z.string().min(1),
  competitionId: z.string().min(1),
});

export type RegisterTeamResult =
  | { ok: true; rosterId: string }
  | { ok: false; error: string };

export async function registerTeamForCompetition(
  input: z.infer<typeof RegisterInput>,
): Promise<RegisterTeamResult> {
  const parsed = RegisterInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  const { teamId, competitionId } = parsed.data;

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  // Pull team + competition + scope context together for one round-trip.
  const [team, competition] = await Promise.all([
    prisma.team.findUnique({
      where: { id: teamId },
      select: {
        id: true,
        schoolId: true,
        gameTitleId: true,
        skillTier: true,
        archived: true,
      },
    }),
    prisma.competition.findUnique({
      where: { id: competitionId },
      select: {
        id: true,
        gameTitleId: true,
        gameTitle: { select: { slug: true } },
        skillTier: true,
        registrationOpensAt: true,
        registrationClosesAt: true,
        state: true,
        season: { select: { leagueId: true } },
      },
    }),
  ]);

  if (!team) return { ok: false, error: "Team not found." };
  if (team.archived) return { ok: false, error: "This team is archived." };
  if (!competition) return { ok: false, error: "Competition not found." };

  // Coach gate
  const coach = await requireSchoolCoach(user.id, team.schoolId);
  if (!coach) {
    return {
      ok: false,
      error: "Only the school's coach or manager can register a team.",
    };
  }

  // Competition must be in a league the school is a member of (active)
  const membership = await prisma.leagueMembership.findUnique({
    where: {
      leagueId_schoolId: {
        leagueId: competition.season.leagueId,
        schoolId: team.schoolId,
      },
    },
    select: { status: true },
  });
  if (!membership || membership.status !== "ACTIVE") {
    return {
      ok: false,
      error: "Your school isn't an active member of this competition's league.",
    };
  }

  if (competition.gameTitle && !isSupportedGame(competition.gameTitle.slug)) {
    return {
      ok: false,
      error: "This competition's game is no longer supported for new registrations.",
    };
  }
  if (competition.gameTitleId !== team.gameTitleId) {
    return {
      ok: false,
      error: "This team plays a different game than the competition.",
    };
  }
  if (competition.skillTier !== team.skillTier) {
    return {
      ok: false,
      error: `Competition is ${competition.skillTier.toLowerCase()} but this team is ${team.skillTier.toLowerCase()}.`,
    };
  }

  const now = new Date();
  if (competition.registrationOpensAt && now < competition.registrationOpensAt) {
    return { ok: false, error: "Registration hasn't opened yet." };
  }
  if (competition.registrationClosesAt && now > competition.registrationClosesAt) {
    return { ok: false, error: "Registration has closed for this competition." };
  }
  if (competition.state === "COMPLETE") {
    return { ok: false, error: "This competition has already finished." };
  }

  // Idempotent — the (teamId, competitionId) unique constraint protects us
  // but we want a friendlier message than a Prisma error code.
  const existing = await prisma.roster.findUnique({
    where: { teamId_competitionId: { teamId, competitionId } },
    select: { id: true, registrationStatus: true },
  });
  if (existing) {
    return {
      ok: false,
      error: `This team is already registered (${existing.registrationStatus.toLowerCase()}).`,
    };
  }

  const roster = await prisma.$transaction(async (tx) => {
    const created = await tx.roster.create({
      data: {
        teamId,
        competitionId,
        registrationStatus: "PENDING",
      },
      select: { id: true },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: user.id,
        action: "ROSTER.REGISTER",
        entityType: "Roster",
        entityId: created.id,
        after: {
          teamId,
          competitionId,
          status: "PENDING",
        },
        leagueId: competition.season.leagueId,
        competitionId: competition.id,
        schoolId: team.schoolId,
      },
    });

    return created;
  });

  revalidateCoachSurfaces(teamId);
  revalidateAdminSurfaces(competition.id);
  return { ok: true, rosterId: roster.id };
}

// --- 3. addPlayerToRoster ---------------------------------------------

const AddPlayerInput = z.object({
  rosterId: z.string().min(1),
  userEmail: z.string().email("Use a valid email."),
  role: z.enum(ROSTER_ROLES).default("PLAYER"),
  jerseyNumber: z.number().int().min(0).max(999).optional(),
  inGameName: z.string().max(80).optional(),
  isStarter: z.boolean().default(true),
});

export type AddPlayerResult =
  | { ok: true; membershipId: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function addPlayerToRoster(
  input: z.infer<typeof AddPlayerInput>,
): Promise<AddPlayerResult> {
  const parsed = AddPlayerInput.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path.join(".");
      if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }
  const data = parsed.data;
  const email = data.userEmail.trim().toLowerCase();

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const roster = await prisma.roster.findUnique({
    where: { id: data.rosterId },
    select: {
      id: true,
      registrationStatus: true,
      editLock: true,
      team: { select: { id: true, schoolId: true } },
      competition: { select: { id: true, season: { select: { leagueId: true } } } },
    },
  });
  if (!roster) return { ok: false, error: "Roster not found." };

  const coach = await requireSchoolCoach(user.id, roster.team.schoolId);
  if (!coach) {
    return {
      ok: false,
      error: "Only the school's coach or manager can manage rosters.",
    };
  }
  if (roster.editLock === "LOCKED") {
    return {
      ok: false,
      error: "Roster is locked for this competition — contact a league admin to make changes.",
    };
  }

  const player = await prisma.user.findUnique({
    where: { email },
    select: { id: true, fullName: true },
  });
  if (!player) {
    return {
      ok: false,
      error: `No account found for ${email}. The player has to sign up first — invites are coming next sprint.`,
    };
  }

  // Idempotent
  const existing = await prisma.rosterMembership.findUnique({
    where: { rosterId_userId: { rosterId: roster.id, userId: player.id } },
    select: { id: true },
  });
  if (existing) {
    return { ok: false, error: "That player is already on this roster." };
  }

  const membership = await prisma.$transaction(async (tx) => {
    const created = await tx.rosterMembership.create({
      data: {
        rosterId: roster.id,
        userId: player.id,
        role: data.role,
        jerseyNumber: data.jerseyNumber ?? null,
        inGameName: data.inGameName?.trim() || null,
        isStarter: data.isStarter,
      },
      select: { id: true },
    });

    // Best-effort: also attach as a SchoolMembership PLAYER if they're not
    // already at the school. Keeps the roster invitation from creating a
    // dangling player who can't see anything in the dashboard.
    await tx.schoolMembership.upsert({
      where: {
        schoolId_userId: { schoolId: roster.team.schoolId, userId: player.id },
      },
      update: {},
      create: {
        schoolId: roster.team.schoolId,
        userId: player.id,
        role: "PLAYER",
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: user.id,
        action: "ROSTER.ADD_PLAYER",
        entityType: "RosterMembership",
        entityId: created.id,
        after: {
          rosterId: roster.id,
          playerUserId: player.id,
          role: data.role,
        },
        leagueId: roster.competition.season.leagueId,
        competitionId: roster.competition.id,
        schoolId: roster.team.schoolId,
      },
    });

    return created;
  });

  revalidateCoachSurfaces(roster.team.id);
  return { ok: true, membershipId: membership.id };
}

// --- 4. removePlayerFromRoster ----------------------------------------

const RemovePlayerInput = z.object({
  membershipId: z.string().min(1),
});

export type RemovePlayerResult =
  | { ok: true }
  | { ok: false; error: string };

export async function removePlayerFromRoster(
  input: z.infer<typeof RemovePlayerInput>,
): Promise<RemovePlayerResult> {
  const parsed = RemovePlayerInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  const { membershipId } = parsed.data;

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const m = await prisma.rosterMembership.findUnique({
    where: { id: membershipId },
    select: {
      id: true,
      userId: true,
      role: true,
      roster: {
        select: {
          id: true,
          editLock: true,
          team: { select: { id: true, schoolId: true } },
          competition: {
            select: { id: true, season: { select: { leagueId: true } } },
          },
        },
      },
    },
  });
  if (!m) return { ok: false, error: "Player not found on this roster." };

  const coach = await requireSchoolCoach(user.id, m.roster.team.schoolId);
  if (!coach) {
    return {
      ok: false,
      error: "Only the school's coach or manager can manage rosters.",
    };
  }
  if (m.roster.editLock === "LOCKED") {
    return {
      ok: false,
      error: "Roster is locked — contact a league admin to make changes.",
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.rosterMembership.delete({ where: { id: m.id } });

    await tx.auditLog.create({
      data: {
        actorUserId: user.id,
        action: "ROSTER.REMOVE_PLAYER",
        entityType: "RosterMembership",
        entityId: m.id,
        before: {
          rosterId: m.roster.id,
          playerUserId: m.userId,
          role: m.role,
        },
        leagueId: m.roster.competition.season.leagueId,
        competitionId: m.roster.competition.id,
        schoolId: m.roster.team.schoolId,
      },
    });
  });

  revalidateCoachSurfaces(m.roster.team.id);
  return { ok: true };
}

// --- 5. approveRoster (admin) -----------------------------------------

const ApproveRosterInput = z.object({
  rosterId: z.string().min(1),
});

export type ApproveRosterResult =
  | { ok: true; rosterId: string }
  | { ok: false; error: string };

export async function approveRoster(
  input: z.infer<typeof ApproveRosterInput>,
): Promise<ApproveRosterResult> {
  const parsed = ApproveRosterInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  const { rosterId } = parsed.data;

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const ctx = await requireLeagueAdmin(user.id);
  if (!ctx) return { ok: false, error: "Only league admins can approve rosters." };

  const roster = await prisma.roster.findUnique({
    where: { id: rosterId },
    select: {
      id: true,
      registrationStatus: true,
      team: {
        select: {
          id: true,
          schoolId: true,
          customName: true,
          colorTag: true,
          school: { select: { name: true, shortName: true } },
          gameTitle: { select: { name: true } },
        },
      },
      competition: {
        select: {
          id: true,
          name: true,
          gameTitle: { select: { name: true } },
          season: { select: { leagueId: true } },
        },
      },
    },
  });
  if (!roster) return { ok: false, error: "Roster not found." };
  if (roster.competition.season.leagueId !== ctx.league.id) {
    return { ok: false, error: "This roster isn't in your league." };
  }
  if (roster.registrationStatus === "APPROVED") {
    return { ok: false, error: "Roster is already approved." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.roster.update({
      where: { id: rosterId },
      data: { registrationStatus: "APPROVED" },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: user.id,
        action: "ROSTER.APPROVE",
        entityType: "Roster",
        entityId: rosterId,
        before: { status: roster.registrationStatus },
        after: { status: "APPROVED" },
        leagueId: ctx.league.id,
        competitionId: roster.competition.id,
        schoolId: roster.team.schoolId,
      },
    });
  });

  revalidateCoachSurfaces();
  revalidateAdminSurfaces(roster.competition.id);

  // Notify the school's coaches/managers. Each gets their own personalized
  // email so they know it's about their roster, not a generic announcement.
  const coaches = await prisma.schoolMembership.findMany({
    where: {
      schoolId: roster.team.schoolId,
      role: { in: ["COACH", "MANAGER"] },
      detached: false,
    },
    select: { user: { select: { fullName: true, email: true } } },
  });
  const teamName = composeTeamName(roster.team);
  const teamUrl = emailUrl(`/dashboard/teams/${roster.team.id}`);
  for (const c of coaches) {
    await sendEmail({
      to: c.user.email,
      subject: `${teamName} is approved for ${roster.competition.name}`,
      react: RosterApproved({
        coachName: c.user.fullName,
        teamName,
        competitionName: roster.competition.name,
        game: roster.competition.gameTitle.name,
        teamUrl,
      }),
      text: rosterApprovedText({
        teamName,
        competitionName: roster.competition.name,
        teamUrl,
      }),
      tags: [
        { name: "kind", value: "roster_approved" },
        { name: "league_id", value: ctx.league.id },
        { name: "competition_id", value: roster.competition.id },
      ],
    });
  }

  return { ok: true, rosterId };
}

// --- 6. rejectRoster (admin) ------------------------------------------

const RejectRosterInput = z.object({
  rosterId: z.string().min(1),
  reason: z.string().min(5, "Required: 5+ chars so the coach knows why.").max(500),
});

export type RejectRosterResult =
  | { ok: true; rosterId: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function rejectRoster(
  input: z.infer<typeof RejectRosterInput>,
): Promise<RejectRosterResult> {
  const parsed = RejectRosterInput.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path.join(".");
      if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    return { ok: false, error: "Please add a reason.", fieldErrors };
  }
  const { rosterId, reason } = parsed.data;

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const ctx = await requireLeagueAdmin(user.id);
  if (!ctx) return { ok: false, error: "Only league admins can reject rosters." };

  const roster = await prisma.roster.findUnique({
    where: { id: rosterId },
    select: {
      id: true,
      registrationStatus: true,
      team: {
        select: {
          id: true,
          schoolId: true,
          customName: true,
          colorTag: true,
          school: { select: { name: true, shortName: true } },
          gameTitle: { select: { name: true } },
        },
      },
      competition: {
        select: {
          id: true,
          name: true,
          season: { select: { leagueId: true } },
        },
      },
    },
  });
  if (!roster) return { ok: false, error: "Roster not found." };
  if (roster.competition.season.leagueId !== ctx.league.id) {
    return { ok: false, error: "This roster isn't in your league." };
  }
  if (roster.registrationStatus === "REJECTED") {
    return { ok: false, error: "Roster is already rejected." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.roster.update({
      where: { id: rosterId },
      data: { registrationStatus: "REJECTED" },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: user.id,
        action: "ROSTER.REJECT",
        entityType: "Roster",
        entityId: rosterId,
        before: { status: roster.registrationStatus },
        after: { status: "REJECTED" },
        metadata: { reason: reason.trim() },
        leagueId: ctx.league.id,
        competitionId: roster.competition.id,
        schoolId: roster.team.schoolId,
      },
    });
  });

  revalidateCoachSurfaces();
  revalidateAdminSurfaces(roster.competition.id);

  // Notify the school's coaches with the admin's reason
  const coaches = await prisma.schoolMembership.findMany({
    where: {
      schoolId: roster.team.schoolId,
      role: { in: ["COACH", "MANAGER"] },
      detached: false,
    },
    select: { user: { select: { fullName: true, email: true } } },
  });
  const teamName = composeTeamName(roster.team);
  const teamUrl = emailUrl(`/dashboard/teams/${roster.team.id}`);
  for (const c of coaches) {
    await sendEmail({
      to: c.user.email,
      subject: `${teamName} couldn't join ${roster.competition.name}`,
      react: RosterRejected({
        coachName: c.user.fullName,
        teamName,
        competitionName: roster.competition.name,
        reason: reason.trim(),
        teamUrl,
      }),
      text: rosterRejectedText({
        teamName,
        competitionName: roster.competition.name,
        reason: reason.trim(),
        teamUrl,
      }),
      tags: [
        { name: "kind", value: "roster_rejected" },
        { name: "league_id", value: ctx.league.id },
        { name: "competition_id", value: roster.competition.id },
      ],
    });
  }

  return { ok: true, rosterId };
}

// --- Team name helper --------------------------------------------------

/**
 * Computes a display name for a team consistent with how the dashboard
 * shows it (custom name overrides, otherwise school + game + optional
 * color tag).
 */
function composeTeamName(team: {
  customName: string | null;
  colorTag: string | null;
  school: { name: string; shortName: string | null };
  gameTitle: { name: string };
}): string {
  if (team.customName) return team.customName;
  const base = `${team.school.shortName ?? team.school.name} ${team.gameTitle.name}`;
  return team.colorTag ? `${base} ${team.colorTag}` : base;
}
