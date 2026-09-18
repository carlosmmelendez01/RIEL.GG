"use server";

/**
 * Team + Roster server actions.
 *
 * Coach surface:
 *   - `createTeam`                     → new Team in the coach's school
 *   - `registerTeamForCompetition`     → new Roster (PENDING) under a Team
 *   - `addPlayerToRoster`              → finds an existing User by email +
 *                                        attaches as RosterMembership
 *   - `importRosterCsv`                → validates and imports up to 50 players,
 *                                        creating targeted invites as needed
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
import {
  SchoolInviteCreated,
  schoolInviteCreatedText,
} from "@/lib/email/templates/school-invite-created";
import { generateInviteCode } from "@/lib/invite/helpers";
import { requireLeagueAdmin } from "@/lib/league-admin/dashboard";
import { loadSchoolAgreementStatus } from "@/lib/compliance/agreements";
import {
  registerTeamForCompetitionForLeagueAdmin,
  registerTeamForCompetitionForUser,
  type RegisterTeamForCompetitionResult,
} from "@/lib/team/registration-service";

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
  revalidatePath("/admin/schools");
  revalidatePath("/admin/schools/[schoolId]", "page");
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

async function requireSchoolAgreement(schoolId: string) {
  const status = await loadSchoolAgreementStatus(schoolId);
  return status.accepted;
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
  if (!(await requireSchoolAgreement(data.schoolId))) {
    return {
      ok: false,
      error: "A school manager must accept the school agreement before creating teams.",
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

export type RegisterTeamResult = RegisterTeamForCompetitionResult;

export async function registerTeamForCompetition(
  input: z.infer<typeof RegisterInput>,
): Promise<RegisterTeamResult> {
  const parsed = RegisterInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  const { teamId, competitionId } = parsed.data;

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const result = await registerTeamForCompetitionForUser({
    userId: user.id,
    teamId,
    competitionId,
  });
  if (result.ok) {
    revalidateCoachSurfaces(teamId);
    revalidateAdminSurfaces(competitionId);
  }
  return result;
}

/**
 * League-side rescue path when a school needs help completing registration.
 * The service re-checks the exact competition league and limits this to an
 * OWNER or ADMIN adminship; STAFF can inspect the school but cannot mutate it.
 */
export async function registerTeamForCompetitionAsLeagueAdmin(
  input: z.infer<typeof RegisterInput>,
): Promise<RegisterTeamResult> {
  const parsed = RegisterInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const result = await registerTeamForCompetitionForLeagueAdmin({
    userId: user.id,
    teamId: parsed.data.teamId,
    competitionId: parsed.data.competitionId,
  });
  if (result.ok) {
    revalidateCoachSurfaces(parsed.data.teamId);
    revalidateAdminSurfaces(parsed.data.competitionId);
  }
  return result;
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
  if (!(await requireSchoolAgreement(roster.team.schoolId))) {
    return {
      ok: false,
      error: "A school manager must accept the school agreement before changing rosters.",
    };
  }
  if (roster.editLock === "LOCKED") {
    return {
      ok: false,
      error: "Roster is locked for this competition because league review has started.",
    };
  }

  const player = await prisma.user.findUnique({
    where: { email },
    select: { id: true, fullName: true },
  });
  if (!player) {
    return {
      ok: false,
      error: `No account found for ${email}. Invite them to the school, then add them after they claim access.`,
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

// --- 4. importRosterCsv -----------------------------------------------

const CsvRosterRow = z.object({
  sourceRow: z.number().int().min(2).max(1_001),
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  inGameName: z.string().trim().max(80).optional(),
  role: z.enum(["PLAYER", "CAPTAIN"]),
  isStarter: z.boolean(),
});

const ImportRosterCsvInput = z.object({
  rosterId: z.string().min(1),
  rows: z.array(CsvRosterRow).min(1).max(50),
});

export type RosterCsvImportRow = z.infer<typeof CsvRosterRow>;

export type ImportRosterCsvResult =
  | {
      ok: true;
      added: number;
      updated: number;
      invited: number;
      invitations: {
        email: string;
        url: string;
        delivery: "SENT" | "NOT_CONFIGURED" | "FAILED";
      }[];
    }
  | {
      ok: false;
      error: string;
      rowErrors?: { sourceRow: number; field: string; message: string }[];
    };

export async function importRosterCsv(input: {
  rosterId: string;
  rows: RosterCsvImportRow[];
}): Promise<ImportRosterCsvResult> {
  const parsed = ImportRosterCsvInput.safeParse(input);
  if (!parsed.success) {
    const rowErrors = parsed.error.issues.flatMap((issue) => {
      const rowIndex = typeof issue.path[1] === "number" ? issue.path[1] : null;
      if (rowIndex === null) return [];
      const sourceRow = input.rows[rowIndex]?.sourceRow ?? rowIndex + 2;
      return [{
        sourceRow,
        field: String(issue.path[2] ?? "row"),
        message: issue.message,
      }];
    });
    return {
      ok: false,
      error: rowErrors.length > 0 ? "Some CSV rows are invalid." : "Invalid CSV import.",
      rowErrors: rowErrors.length > 0 ? rowErrors : undefined,
    };
  }

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const roster = await prisma.roster.findUnique({
    where: { id: parsed.data.rosterId },
    select: {
      id: true,
      editLock: true,
      team: {
        select: {
          id: true,
          schoolId: true,
          school: { select: { name: true } },
        },
      },
      competition: {
        select: { id: true, season: { select: { leagueId: true } } },
      },
    },
  });
  if (!roster) return { ok: false, error: "Roster not found." };

  const coach = await requireSchoolCoach(user.id, roster.team.schoolId);
  if (!coach) {
    return { ok: false, error: "Only the school's coach or manager can import a roster." };
  }
  if (!(await requireSchoolAgreement(roster.team.schoolId))) {
    return {
      ok: false,
      error: "A school manager must accept the school agreement before changing rosters.",
    };
  }
  if (roster.editLock === "LOCKED") {
    return {
      ok: false,
      error: "Roster is locked for this competition because league review has started.",
    };
  }

  const rows = parsed.data.rows.map((row) => ({
    ...row,
    email: row.email.trim().toLowerCase(),
    fullName: row.fullName.trim(),
    inGameName: row.inGameName?.trim() || null,
  }));

  const seenEmails = new Set<string>();
  const duplicateErrors: { sourceRow: number; field: string; message: string }[] = [];
  for (const row of rows) {
    if (seenEmails.has(row.email)) {
      duplicateErrors.push({
        sourceRow: row.sourceRow,
        field: "email",
        message: "This email appears more than once in the CSV.",
      });
    }
    seenEmails.add(row.email);
  }
  if (duplicateErrors.length > 0) {
    return { ok: false, error: "Remove duplicate player emails and try again.", rowErrors: duplicateErrors };
  }

  const emails = rows.map((row) => row.email);
  const [existingUsers, existingMemberships] = await Promise.all([
    prisma.user.findMany({
      where: { email: { in: emails } },
      select: { id: true, email: true },
    }),
    prisma.rosterMembership.findMany({
      where: { rosterId: roster.id, user: { email: { in: emails } } },
      select: { user: { select: { email: true } } },
    }),
  ]);
  const usersByEmail = new Map(existingUsers.map((player) => [player.email.toLowerCase(), player]));
  const rosteredEmails = new Set(
    existingMemberships.map((membership) => membership.user.email.toLowerCase()),
  );
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1_000);

  const imported = await prisma.$transaction(
    async (tx) => {
      const invites: { email: string; code: string }[] = [];
      let added = 0;
      let updated = 0;

      for (const row of rows) {
        let player = usersByEmail.get(row.email);
        if (!player) {
          player = await tx.user.create({
            data: {
              authId: `csv:${crypto.randomUUID()}`,
              email: row.email,
              fullName: row.fullName,
            },
            select: { id: true, email: true },
          });
          usersByEmail.set(row.email, player);

          const code = generateInviteCode();
          await tx.invite.create({
            data: {
              code,
              scope: "SCHOOL",
              schoolId: roster.team.schoolId,
              createdById: user.id,
              rolesGranted: ["PLAYER"],
              grantsOwnership: false,
              intendedEmail: row.email,
              maxUses: 1,
              expiresAt,
              status: "ACTIVE",
            },
          });
          invites.push({ email: row.email, code });
        }

        await tx.schoolMembership.upsert({
          where: {
            schoolId_userId: { schoolId: roster.team.schoolId, userId: player.id },
          },
          update: { detached: false },
          create: {
            schoolId: roster.team.schoolId,
            userId: player.id,
            role: "PLAYER",
          },
        });

        await tx.studentConsent.upsert({
          where: {
            studentUserId_schoolId: {
              studentUserId: player.id,
              schoolId: roster.team.schoolId,
            },
          },
          update: {},
          create: {
            studentUserId: player.id,
            schoolId: roster.team.schoolId,
            status: "PENDING",
            ageBand: "UNKNOWN",
          },
        });

        await tx.rosterMembership.upsert({
          where: { rosterId_userId: { rosterId: roster.id, userId: player.id } },
          update: {
            role: row.role,
            inGameName: row.inGameName,
            isStarter: row.isStarter,
          },
          create: {
            rosterId: roster.id,
            userId: player.id,
            role: row.role,
            inGameName: row.inGameName,
            isStarter: row.isStarter,
          },
        });

        if (rosteredEmails.has(row.email)) updated += 1;
        else added += 1;
      }

      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          action: "ROSTER.IMPORT_CSV",
          entityType: "Roster",
          entityId: roster.id,
          after: {
            rowCount: rows.length,
            added,
            updated,
            invited: invites.length,
          },
          leagueId: roster.competition.season.leagueId,
          competitionId: roster.competition.id,
          schoolId: roster.team.schoolId,
        },
      });

      return { added, updated, invites };
    },
    { maxWait: 5_000, timeout: 20_000 },
  );

  const invitationResults = await Promise.all(
    imported.invites.map(async (invite) => {
      const claimUrl = emailUrl(`/claim/${invite.code}`);
      const emailResult = await sendEmail({
        to: invite.email,
        subject: `${user.fullName} added you to ${roster.team.school.name} on ArcLight`,
        react: SchoolInviteCreated({
          inviterName: user.fullName,
          schoolName: roster.team.school.name,
          role: "PLAYER",
          claimUrl,
          expiresAt,
          grantsOwnership: false,
        }),
        text: schoolInviteCreatedText({
          inviterName: user.fullName,
          schoolName: roster.team.school.name,
          role: "player",
          claimUrl,
        }),
        tags: [
          { name: "kind", value: "roster_csv_invite" },
          { name: "school_id", value: roster.team.schoolId },
        ],
      });
      return {
        email: invite.email,
        url: claimUrl,
        delivery: !emailResult.ok
          ? "FAILED" as const
          : emailResult.provider === "console"
            ? "NOT_CONFIGURED" as const
            : "SENT" as const,
      };
    }),
  );

  revalidateCoachSurfaces(roster.team.id);
  return {
    ok: true,
    added: imported.added,
    updated: imported.updated,
    invited: imported.invites.length,
    invitations: invitationResults,
  };
}

// --- 5. removePlayerFromRoster ----------------------------------------

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
  if (!(await requireSchoolAgreement(m.roster.team.schoolId))) {
    return {
      ok: false,
      error: "A school manager must accept the school agreement before changing rosters.",
    };
  }
  if (m.roster.editLock === "LOCKED") {
    return {
      ok: false,
      error: "Roster is locked because league review has started.",
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

// --- 6. approveRoster (admin) -----------------------------------------

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

// --- 7. rejectRoster (admin) ------------------------------------------

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
