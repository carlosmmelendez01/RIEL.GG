/**
 * Read-side loaders for the league admins/staff surface (/admin/admins).
 *
 * Plain async helpers (not server actions) — safe to call from server
 * components. Mutations live in admin-invite-actions.ts.
 */

import { prisma } from "@/lib/db/prisma";

export type LeagueRole = "OWNER" | "ADMIN" | "STAFF";

export type LeagueAdminRow = {
  userId: string;
  name: string;
  email: string;
  initials: string;
  role: LeagueRole;
  isYou: boolean;
  createdAt: Date;
};

export type LeagueOutstandingInvite = {
  id: string;
  code: string;
  url: string;
  role: LeagueRole;
  intendedEmail: string | null;
  grantsOwnership: boolean;
  expiresAt: Date | null;
  createdAt: Date;
  createdByName: string | null;
};

function initialsOf(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "??"
  );
}

function roleFromInvite(rolesGranted: string[], grantsOwnership: boolean): LeagueRole {
  if (grantsOwnership) return "OWNER";
  const found = rolesGranted.find((r) => r === "OWNER" || r === "ADMIN" || r === "STAFF");
  return (found as LeagueRole) ?? "ADMIN";
}

export async function loadLeagueAdmins(
  leagueId: string,
  viewerUserId: string,
): Promise<LeagueAdminRow[]> {
  const adminships = await prisma.leagueAdminship.findMany({
    where: { leagueId },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: {
      userId: true,
      role: true,
      createdAt: true,
      user: { select: { fullName: true, email: true } },
    },
  });

  return adminships.map((a) => ({
    userId: a.userId,
    name: a.user.fullName,
    email: a.user.email,
    initials: initialsOf(a.user.fullName),
    role: a.role as LeagueRole,
    isYou: a.userId === viewerUserId,
    createdAt: a.createdAt,
  }));
}

export async function loadOutstandingLeagueInvites(
  leagueId: string,
): Promise<LeagueOutstandingInvite[]> {
  const invites = await prisma.invite.findMany({
    where: { scope: "LEAGUE", leagueId, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      code: true,
      rolesGranted: true,
      grantsOwnership: true,
      intendedEmail: true,
      expiresAt: true,
      createdAt: true,
      createdBy: { select: { fullName: true } },
    },
  });

  return invites.map((i) => ({
    id: i.id,
    code: i.code,
    url: `/claim/${i.code}`,
    role: roleFromInvite(i.rolesGranted, i.grantsOwnership),
    intendedEmail: i.intendedEmail,
    grantsOwnership: i.grantsOwnership,
    expiresAt: i.expiresAt,
    createdAt: i.createdAt,
    createdByName: i.createdBy?.fullName ?? null,
  }));
}
