"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/current-user";
import { studentHasActiveConsent } from "@/lib/compliance/consent";
import { prisma } from "@/lib/db/prisma";

type Side = "HOME" | "AWAY";
type RosterRole = "MANAGER" | "COACH" | "CAPTAIN" | "PLAYER";

const TEAM_CHECK_IN_ROLES: RosterRole[] = ["MANAGER", "COACH", "CAPTAIN"];
const CLOSED_STATUSES = ["FINISHED", "FORFEITED", "CANCELED", "DISPUTED"] as const;

const CheckInInput = z.object({
  matchId: z.string().min(1, "Match id is required."),
  rosterMembershipIds: z.array(z.string().min(1)).optional(),
});

export type CheckInResult =
  | {
      ok: true;
      matchId: string;
      status: "CHECKING_IN" | "IN_PROGRESS" | string;
      checkedInCount: number;
      opponentCheckedInCount: number;
      checkedInNames: string[];
    }
  | { ok: false; error: string };

export async function checkInForMatch(input: z.infer<typeof CheckInInput>): Promise<CheckInResult> {
  const parsed = CheckInInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid check-in request." };

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You need to be signed in to check in." };

  const { matchId } = parsed.data;
  const requestedIds = parsed.data.rosterMembershipIds ?? [];

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      status: true,
      homeRosterId: true,
      awayRosterId: true,
      stage: {
        select: {
          competition: {
            select: { id: true, season: { select: { leagueId: true } } },
          },
        },
      },
      homeRoster: {
        select: {
          id: true,
          team: {
            select: {
              schoolId: true,
              customName: true,
              colorTag: true,
              school: { select: { name: true, shortName: true } },
            },
          },
          members: {
            select: {
              id: true,
              userId: true,
              role: true,
              user: { select: { fullName: true } },
            },
          },
        },
      },
      awayRoster: {
        select: {
          id: true,
          team: {
            select: {
              schoolId: true,
              customName: true,
              colorTag: true,
              school: { select: { name: true, shortName: true } },
            },
          },
          members: {
            select: {
              id: true,
              userId: true,
              role: true,
              user: { select: { fullName: true } },
            },
          },
        },
      },
    },
  });

  if (!match) return { ok: false, error: "We couldn't find that match." };
  if ((CLOSED_STATUSES as readonly string[]).includes(match.status)) {
    return { ok: false, error: `This match is ${match.status.toLowerCase()} and can't be checked in.` };
  }

  const homeMember = match.homeRoster.members.find((m) => m.userId === user.id);
  const awayMember = match.awayRoster.members.find((m) => m.userId === user.id);
  const side: Side | null = homeMember ? "HOME" : awayMember ? "AWAY" : null;
  const viewerMembership = homeMember ?? awayMember ?? null;
  if (!side || !viewerMembership) {
    return { ok: false, error: "You aren't on either roster for this match." };
  }

  const ownRoster = side === "HOME" ? match.homeRoster : match.awayRoster;
  const opponentRoster = side === "HOME" ? match.awayRoster : match.homeRoster;
  const canCheckInTeam = TEAM_CHECK_IN_ROLES.includes(viewerMembership.role as RosterRole);
  const targetIds = requestedIds.length > 0 ? [...new Set(requestedIds)] : [viewerMembership.id];

  if (targetIds.length > 1 && !canCheckInTeam) {
    return { ok: false, error: "Only a coach, captain, or manager can check in multiple players." };
  }

  const selectedMembers = ownRoster.members.filter((m) => targetIds.includes(m.id));
  if (selectedMembers.length !== targetIds.length) {
    return { ok: false, error: "One or more selected players are not on your roster." };
  }
  if (!canCheckInTeam && selectedMembers.some((m) => m.id !== viewerMembership.id)) {
    return { ok: false, error: "Players can only check themselves in." };
  }

  const missingConsent = await Promise.all(
    selectedMembers
      .filter((member) => member.role === "PLAYER" || member.role === "CAPTAIN")
      .map(async (member) => ({
        name: member.user.fullName,
        ok: await studentHasActiveConsent(member.userId, ownRoster.team.schoolId),
      })),
  );
  const blockedStudents = missingConsent.filter((student) => !student.ok);
  if (blockedStudents.length > 0) {
    return {
      ok: false,
      error:
        blockedStudents.length === 1
          ? `${blockedStudents[0].name} needs consent recorded before check-in.`
          : `${blockedStudents.length} players need consent recorded before check-in.`,
    };
  }

  const before = {
    status: match.status,
    selectedRosterMembershipIds: targetIds,
  };

  const result = await prisma.$transaction(async (tx) => {
    for (const member of selectedMembers) {
      await tx.matchCheckIn.upsert({
        where: {
          matchId_rosterMembershipId: {
            matchId,
            rosterMembershipId: member.id,
          },
        },
        create: {
          matchId,
          rosterId: ownRoster.id,
          rosterMembershipId: member.id,
          userId: member.userId,
          checkedInById: user.id,
          side,
        },
        update: {
          checkedInById: user.id,
        },
      });
    }

    const [ownCount, opponentCount] = await Promise.all([
      tx.matchCheckIn.count({ where: { matchId, rosterId: ownRoster.id } }),
      tx.matchCheckIn.count({ where: { matchId, rosterId: opponentRoster.id } }),
    ]);

    const nextStatus =
      match.status === "SCHEDULED" || match.status === "CHECKING_IN"
        ? ownCount > 0 && opponentCount > 0
          ? "IN_PROGRESS"
          : "CHECKING_IN"
        : match.status;

    if (nextStatus !== match.status) {
      await tx.match.update({
        where: { id: matchId },
        data: { status: nextStatus },
      });
    }

    const checkedInNames = selectedMembers.map((m) => m.user.fullName);
    await tx.matchMessage.create({
      data: {
        matchId,
        kind: "SYSTEM",
        body:
          selectedMembers.length === 1
            ? `${checkedInNames[0]} checked in for ${teamLabel(ownRoster.team)}.`
            : `${teamLabel(ownRoster.team)} checked in ${selectedMembers.length} players.`,
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: user.id,
        action: "MATCH.CHECK_IN",
        entityType: "Match",
        entityId: matchId,
        before,
        after: {
          status: nextStatus,
          side,
          checkedInRosterMembershipIds: targetIds,
          checkedInCount: ownCount,
          opponentCheckedInCount: opponentCount,
        },
        metadata: {
          checkedInByRole: viewerMembership.role,
          checkedInNames,
          checkedInTeam: canCheckInTeam,
        },
        matchId,
        leagueId: match.stage.competition.season.leagueId,
        competitionId: match.stage.competition.id,
      },
    });

    return {
      status: nextStatus,
      checkedInCount: ownCount,
      opponentCheckedInCount: opponentCount,
      checkedInNames,
    };
  });

  revalidateMatchSurfaces(matchId);

  return {
    ok: true,
    matchId,
    ...result,
  };
}

function revalidateMatchSurfaces(matchId: string) {
  revalidatePath(`/dashboard/matches/${matchId}`);
  revalidatePath(`/admin/matches/${matchId}`);
  revalidatePath("/dashboard/matches");
  revalidatePath("/dashboard");
  revalidatePath("/admin/matches");
  revalidatePath("/admin");
  revalidatePath("/admin/health");
  revalidatePath("/me");
}

function teamLabel(t: {
  schoolId?: string;
  customName: string | null;
  colorTag?: string | null;
  school: { shortName: string | null; name: string };
}): string {
  const school = t.school.shortName ?? t.school.name;
  if (t.customName) return t.customName;
  return t.colorTag ? `${school} ${t.colorTag}` : school;
}
