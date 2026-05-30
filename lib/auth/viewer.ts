/**
 * Resolve the `ViewerInfo` payload that the topbar / mode switcher needs.
 * Pulls real data from getCurrentUser() + Prisma.
 */

import { cache } from "react";

import { prisma } from "@/lib/db/prisma";
import { getCurrentUser, getCurrentLeagueContext } from "@/lib/auth/current-user";
import type { ViewerInfo } from "@/components/auth/mode-switcher";

export const getViewer = cache(async (): Promise<ViewerInfo | null> => {
  const user = await getCurrentUser();
  if (!user) return null;

  // Coach context — first SchoolMembership
  const schoolMembership = await prisma.schoolMembership.findFirst({
    where: { userId: user.id },
    include: { school: true },
    orderBy: { createdAt: "asc" },
  });

  // League admin context — first LeagueAdminship
  const adminship = await prisma.leagueAdminship.findFirst({
    where: { userId: user.id },
    include: { league: true },
    orderBy: { createdAt: "asc" },
  });

  // Platform owner — for now, anyone with `@riel.gg` email or the seeded
  // `cmelendez@riel.gg` user is treated as a platform owner. Replace with a
  // proper PlatformAdmin role once we model it.
  const isPlatformOwner = user.email.endsWith("@riel.gg");

  // Subtitles
  const coachSubtitle = schoolMembership
    ? `${schoolMembership.school.shortName ?? schoolMembership.school.name} · ${
        schoolMembership.role === "MANAGER"
          ? "Manager"
          : schoolMembership.role === "COACH"
            ? "Head Coach"
            : "Player"
      }`
    : "Not on a roster";

  const adminSubtitle = adminship
    ? `${adminship.league.name} · ${
        adminship.role === "OWNER" ? "Owner" : adminship.role === "ADMIN" ? "League Admin" : "Staff"
      }`
    : "No league access";

  // For the active mode subtitle (active mode is implied by URL on the topbar),
  // fall back to a sensible default if context isn't loaded yet.
  const ctx = await getCurrentLeagueContext();
  const activeAdminSubtitle = ctx
    ? `${ctx.league.name} · ${
        ctx.role === "OWNER" ? "Owner" : ctx.role === "ADMIN" ? "League Admin" : ctx.role === "STAFF" ? "Staff" : "Member"
      }`
    : adminSubtitle;

  return {
    name: user.fullName,
    initials: deriveInitials(user.fullName),
    email: user.email,
    subtitle: {
      coach: coachSubtitle,
      admin: activeAdminSubtitle,
      platform: "RIEL.GG · Platform Owner",
    },
    canView: {
      coach: !!schoolMembership,
      admin: !!adminship,
      platform: isPlatformOwner,
      // Board access — anyone with league admin rights or platform-owner
      // status can see league-wide forfeit aggregates. View-only board roles
      // (e.g. principals, ADs) come later when we add BOARD_MEMBER to the
      // LeagueRole enum.
      board: !!adminship || isPlatformOwner,
    },
  };
});

function deriveInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "??";
}
