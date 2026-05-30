/**
 * Server-side auth helpers — single source of truth for "who is signed in?"
 *
 * Bridge logic: when a user signs in for the first time via Supabase Auth, we
 * try to adopt an existing seeded `User` row by email match. This lets the
 * 24 mock users we already seeded "become real" the first time their owner
 * actually signs in. New users (no email match) get a fresh User row.
 */

import { cache } from "react";

import { prisma } from "@/lib/db/prisma";
import { createClient } from "@/lib/supabase/server";

import type { League, User as DbUser } from "@prisma/client";

export type CurrentUser = DbUser & {
  // Convenience derived fields
  initials: string;
};

/**
 * Resolve the current user from the Supabase session.
 *
 * - Returns null if no session.
 * - Adopts a seeded User row if the email matches.
 * - Creates a new User row if no email match.
 *
 * Cached per-request via React's `cache()` so multiple components in the
 * same render pass share one query.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser?.id || !authUser.email) return null;

  const email = authUser.email.toLowerCase();

  // 1. Already linked? (authId match)
  let dbUser = await prisma.user.findUnique({ where: { authId: authUser.id } });

  // 2. Not linked — try email match (bridge a seeded user)
  if (!dbUser) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      dbUser = await prisma.user.update({
        where: { id: existing.id },
        data: {
          authId: authUser.id,
          // Update fullName from auth metadata if available; keep DB value otherwise.
          fullName:
            (authUser.user_metadata?.full_name as string | undefined)?.trim() || existing.fullName,
          avatarUrl:
            (authUser.user_metadata?.avatar_url as string | undefined) ?? existing.avatarUrl,
        },
      });
    }
  }

  // 3. Still nothing — brand new user
  if (!dbUser) {
    dbUser = await prisma.user.create({
      data: {
        authId: authUser.id,
        email,
        fullName: (authUser.user_metadata?.full_name as string | undefined) || email.split("@")[0],
        avatarUrl: authUser.user_metadata?.avatar_url as string | undefined,
      },
    });
  }

  return {
    ...dbUser,
    initials: deriveInitials(dbUser.fullName),
  };
});

/**
 * Determine the league the user is currently operating in.
 *
 * Resolution order:
 *  1. If a `slug` is passed (e.g., /league/{slug}), use that league IF the user
 *     belongs to it.
 *  2. Otherwise pick the first league the user is OWNER/ADMIN/STAFF of.
 *  3. Otherwise pick the first league the user has a SchoolMembership in
 *     (via the school's LeagueMembership).
 *  4. null if none.
 */
export const getCurrentLeagueContext = cache(
  async (slug?: string): Promise<{ league: League; role: "OWNER" | "ADMIN" | "STAFF" | "MEMBER" } | null> => {
    const user = await getCurrentUser();
    if (!user) return null;

    if (slug) {
      const league = await prisma.league.findUnique({ where: { slug } });
      if (!league) return null;

      const adminship = await prisma.leagueAdminship.findFirst({
        where: { leagueId: league.id, userId: user.id },
      });

      // Even non-admins might have access via school membership
      return { league, role: adminship?.role ?? "MEMBER" };
    }

    // Prefer admin role
    const adminship = await prisma.leagueAdminship.findFirst({
      where: { userId: user.id },
      include: { league: true },
      orderBy: { createdAt: "asc" },
    });
    if (adminship) return { league: adminship.league, role: adminship.role };

    // Fall back to school memberships
    const schoolMembership = await prisma.schoolMembership.findFirst({
      where: { userId: user.id },
      include: {
        school: {
          include: {
            leagueMemberships: { include: { league: true }, take: 1 },
          },
        },
      },
    });
    const league = schoolMembership?.school.leagueMemberships[0]?.league;
    if (league) return { league, role: "MEMBER" };

    return null;
  },
);

/**
 * Pretty initials from a full name. "Carlos Melendez" → "CM".
 */
function deriveInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "??";
}

/**
 * Convenience role string for the topbar subtitle:
 *   "RIEL · League Admin"
 *   "MCHS Wolves · Head Coach"
 *   "RIEL.GG · Platform Owner"
 */
export async function getRoleSubtitle(mode: "platform" | "admin" | "coach"): Promise<string> {
  if (mode === "platform") return "RIEL.GG · Platform Owner";

  if (mode === "admin") {
    const ctx = await getCurrentLeagueContext();
    if (!ctx) return "League Admin";
    const roleLabel =
      ctx.role === "OWNER" ? "Owner" : ctx.role === "ADMIN" ? "League Admin" : ctx.role === "STAFF" ? "Staff" : "Member";
    return `${ctx.league.name} · ${roleLabel}`;
  }

  // coach
  const user = await getCurrentUser();
  if (!user) return "Coach";
  const sm = await prisma.schoolMembership.findFirst({
    where: { userId: user.id },
    include: { school: true },
  });
  if (!sm) return "Coach";
  const roleLabel = sm.role === "MANAGER" ? "Manager" : sm.role === "COACH" ? "Head Coach" : "Player";
  return `${sm.school.shortName ?? sm.school.name} · ${roleLabel}`;
}
