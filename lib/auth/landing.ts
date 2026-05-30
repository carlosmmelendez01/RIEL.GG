/**
 * Resolve where a user should land after sign-in based on their roles.
 *
 * Priority hierarchy (most powerful → least):
 *   1. Platform owner (`@riel.gg`)            → /admin (active league mgmt)
 *   2. League adminship (OWNER/ADMIN/STAFF)   → /admin
 *   3. School coach/manager                   → /dashboard
 *   4. Roster member (player only)            → /me
 *   5. No roles                               → /me  (empty state)
 *
 * Used by /auth/callback and /dev/sign-in. Players who are also coaches or
 * admins land on the operator surface (since that's where their action lives)
 * but can switch via the mode-switcher to /me when they want their personal
 * view.
 */

import { prisma } from "@/lib/db/prisma";

export async function getPrimaryLanding(userId: string, email: string): Promise<string> {
  const lower = email.toLowerCase();

  // 1. Platform owner shortcut (Carlos and friends)
  if (lower.endsWith("@riel.gg")) return "/admin";

  // 2. League adminship of any kind
  const adminship = await prisma.leagueAdminship.findFirst({
    where: { userId },
    select: { id: true },
  });
  if (adminship) return "/admin";

  // 3. Coach/manager on any school
  const coach = await prisma.schoolMembership.findFirst({
    where: { userId, role: { in: ["COACH", "MANAGER"] } },
    select: { id: true },
  });
  if (coach) return "/dashboard";

  // 4. & 5. Player or unassigned — both land on /me
  return "/me";
}
